import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';
import { User } from '../../core/auth/entities/user.entity';
import { FileUploadService } from '../../shared/file-upload/file-upload.service';
import { computeFileHash } from './utils/file-hash.util';
import { computePerceptualHash } from './utils/perceptual-hash.util';
import { extractImageMetadata } from './utils/image-metadata.util';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    private readonly fileUploadService: FileUploadService,
  ) { }

  /**
   * Upload a single image.
   * 1. Validate: format, size, resolution
   * 2. Compute hash → dedup check
   * 3. Upload to Cloudinary
   * 4. Save Image row
   */
  async upload(user: User, file: Express.Multer.File): Promise<Image> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // 1. Metadata + validation
    const meta = await extractImageMetadata(file.buffer);

    const MIN_DIMENSION = 400;
    if (meta.width < MIN_DIMENSION || meta.height < MIN_DIMENSION) {
      throw new BadRequestException(
        `Image must be at least ${MIN_DIMENSION}x${MIN_DIMENSION}px`,
      );
    }

    // 2. Hash + dedup
    // Using normal file hash
    // const hash = await computeFileHash(file.buffer);
    // Using perceptual hash
    const hash = await computePerceptualHash(file.buffer);

    const existing = await this.imageRepository.findOne({
      where: { userId: user.id, hash },
    });

    if (existing) {
      return existing; // Idempotent upload
    }

    // 3. Upload to Cloudinary
    const { url, publicId } = await this.fileUploadService.uploadImage(
      file,
      `nanopixl/user_images/${user.id}`,
    );

    // 4. Save row
    const image = this.imageRepository.create({
      userId: user.id,
      originalName: file.originalname,
      storagePath: url,
      publicId,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      width: meta.width,
      height: meta.height,
      hash,
      isProcessed: true,
      processedAt: new Date(),
      metadata: { format: meta.format },
    });

    return this.imageRepository.save(image);
  }

  /**
   * List the user's images (paginated, newest first).
   */
  async findAll(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Image[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.imageRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single image, scoped to the owner.
   */
  async findOne(userId: string, id: string): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { id, userId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return image;
  }

  /**
   * Delete an image from the DB and Cloudinary.
   */
  async remove(userId: string, id: string): Promise<{ message: string }> {
    const image = await this.findOne(userId, id);

    if (image.publicId) {
      await this.fileUploadService.deleteImage(image.publicId);
    }

    await this.imageRepository.remove(image);

    return { message: 'Image deleted successfully' };
  }
}