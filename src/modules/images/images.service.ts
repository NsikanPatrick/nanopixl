import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';
import { User } from '../../core/auth/entities/user.entity';
import { FileUploadService } from '../../shared/file-upload/file-upload.service';
import { computeFileHash } from './utils/file-hash.util';
import { extractImageMetadata } from './utils/image-metadata.util';
import { mapWithConcurrency } from './utils/concurrency.util';

// Return type that carries dedup information
export interface UploadResult {
    image: Image;
    deduplicated: boolean;
}

// Batch response shape — typed so the controller can rely on it
export interface BatchUploadResult {
    total: number;
    succeeded: number;
    failed: number;
    results: Array<
        | {
            originalName: string;
            success: true;
            imageId: string;
            deduplicated: boolean;
        }
        | {
            originalName: string;
            success: false;
            error: string;
        }
    >;
}

@Injectable()
export class ImagesService {
    // Logger for observing batch behavior
    private readonly logger = new Logger(ImagesService.name);

    // Guards against pathological batches
    private static readonly MAX_BATCH_FILES = 10;
    private static readonly MAX_BATCH_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB
    private static readonly BATCH_CONCURRENCY = 3;

    constructor(
        @InjectRepository(Image)
        private readonly imageRepository: Repository<Image>,
        private readonly fileUploadService: FileUploadService,
    ) { }

    // =================== UPLOAD A SINGLE IMAGE =======================
    /* Now a thin wrapper over uploadWithMeta() so the return
     * type stays `Image` for existing callers (non-breaking).
     * The entire upload() workload is delegated to the uploadWithMeta()
     */
    async upload(user: User, file: Express.Multer.File): Promise<Image> {
        const { image } = await this.uploadWithMeta(user, file);
        return image;
    }

    // ====== Upload a single image and report if it was newly created 
    // or deduplicated against an existing row =========
     
     /* This is the "real" upload method. The `upload()` method delegates here.
     */
    async uploadWithMeta(
        user: User,
        file: Express.Multer.File,
    ): Promise<UploadResult> {
        // Guard against zero-byte uploads (mimetype check passes,
        // but sharp will fail with a confusing error)
        if (!file || !file.buffer?.length) {
            throw new BadRequestException('No file provided or file is empty');
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
        const hash = computeFileHash(file.buffer);

        const existing = await this.imageRepository.findOne({
            where: { userId: user.id, hash },
        });

        // Return the dedup flag instead of a bare Image
        if (existing) {
            return { image: existing, deduplicated: true };
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

        const saved = await this.imageRepository.save(image);

        // Distinguish new file upload from dedup
        return { image: saved, deduplicated: false };
    }

    // List the user's images (paginated, newest first).
    async findAll(
        userId: string,
        page = 1,
        limit = 20,
    ): Promise<{
        data: Image[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
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

    // ========= GET A SINGLE IMAGE, scoped to the owner. ==========
    async findOne(userId: string, id: string): Promise<Image> {
        const image = await this.imageRepository.findOne({
            where: { id, userId },
        });

        if (!image) {
            throw new NotFoundException('Image not found');
        }

        return image;
    }

    //========== DELETE AN IMAGE from the DB and Cloudinary. =============
    async remove(userId: string, id: string): Promise<{ message: string }> {
        const image = await this.findOne(userId, id);

        if (image.publicId) {
            await this.fileUploadService.deleteImage(image.publicId);
        }

        await this.imageRepository.remove(image);

        return { message: 'Image deleted successfully' };
    }

    // ============ UPLOAD MULTIPLE IMAGES IN ONE REQUEST. =============
    /**  - Guards: max file count, max total bytes, empty-array check
     *  - Per-file success/failure reporting (a bad file doesn't fail the batch)
     *  - Correct `deduplicated` flag on each result
     *  - Bounded concurrency so we don't overwhelm Cloudinary or RAM
     */
    async uploadBatch(
        user: User,
        files: Express.Multer.File[],
    ): Promise<BatchUploadResult> {
        // Empty-array guard (check)
        if (!files?.length) {
            throw new BadRequestException('No files provided');
        }

        // File-count guard (defense-in-depth — interceptor also caps)
        if (files.length > ImagesService.MAX_BATCH_FILES) {
            throw new BadRequestException(
                `Cannot upload more than ${ImagesService.MAX_BATCH_FILES} files at once`,
            );
        }

        // Total-size guard. The interceptor caps per-file size,
        // but 10 × 10 MB would still be 100 MB in RAM.
        const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
        if (totalBytes > ImagesService.MAX_BATCH_TOTAL_BYTES) {
            throw new BadRequestException(
                `Batch exceeds ${ImagesService.MAX_BATCH_TOTAL_BYTES / 1024 / 1024}MB total`,
            );
        }

        // Call the concurrency method from utils
        const results = await mapWithConcurrency(
            files,
            ImagesService.BATCH_CONCURRENCY,
            async (file) => {
                try {
                    // Use uploadWithMeta so we can report dedup correctly
                    const { image, deduplicated } = await this.uploadWithMeta(user, file);
                    return {
                        originalName: file.originalname,
                        success: true as const,
                        imageId: image.id,
                        deduplicated, 
                    };
                } catch (error) {
                    // Keep the batch going even if one file fails
                    this.logger.warn(
                        `Batch upload failed for "${file.originalname}": ${error.message}`,
                    );
                    return {
                        originalName: file.originalname,
                        success: false as const,
                        error: error.message ?? 'Unknown error',
                    };
                }
            },
        );

        const succeeded = results.filter((r) => r.success).length;

        return {
            total: files.length,
            succeeded,
            failed: files.length - succeeded,
            results,
        };
    }

    /** DELETE ALL IMAGES BELONGING TO A USER.
    * Cloudinary assets are deleted in one bulk call (fast).
    * DB rows are deleted in a single query.
    * Idempotent: calling it when the user has no images is a no-op.
    */
    async removeAllForUser(userId: string): Promise<{ deleted: number }> {
        // 1. Find all the user's images
        const images = await this.imageRepository.find({
            where: { userId },
            select: {
                id: true,
                publicId: true,
            },
        });

        if (images.length === 0) {
            return { deleted: 0 };
        }

        // 2. Delete Cloudinary assets in bulk (one API call, not N)
        const publicIds = images.map((img) => img.publicId).filter((id): id is string => !!id);

        if (publicIds.length > 0) {
            await this.fileUploadService.deleteImages(publicIds);
        }

        // 3. Delete DB rows
        const result = await this.imageRepository.delete({ userId });

        // 4. Delete the now-empty folder from cloudinary
        await this.fileUploadService.deleteFolder(`nanopixl/user_images/${userId}`);

        this.logger.log(
            `Deleted ${result.affected ?? 0} images for user ${userId}`,
        );

        return { deleted: result.affected ?? 0 };
    }
}