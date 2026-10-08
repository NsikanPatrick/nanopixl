import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

export interface UploadResult {
    url: string;
    publicId: string;
}

@Injectable()
export class FileUploadService {
    private readonly logger = new Logger(FileUploadService.name);

    constructor(private readonly configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('appConfig.objectStore.cloudName'),
            api_key: this.configService.get<string>('appConfig.objectStore.apiKey'),
            api_secret: this.configService.get<string>('appConfig.objectStore.apiSecret'),
        });
    }

    /**
     * Upload an image buffer to Cloudinary.
     * Applies a face-centered square crop and returns the secure HTTPS URL
     * plus the public_id needed for later deletion/replacement.
     */
    async uploadImage(
        file: Express.Multer.File,
        folder = 'nanopixl/profile_pictures',
    ): Promise<UploadResult> {
        if (!file?.buffer?.length) {
            throw new BadRequestException('No file provided or file is empty');
        }

        try {
            return await new Promise<UploadResult>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder,
                        resource_type: 'image',
                        // Face-centered 400x400 crop, auto quality + format
                        transformation: [
                            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                            { quality: 'auto', fetch_format: 'auto' },
                        ],
                        overwrite: false,
                    },
                    (error, result?: UploadApiResponse) => {
                        if (error || !result) {
                            return reject(error ?? new Error('Cloudinary upload failed'));
                        }
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id,
                        });
                    },
                );

                Readable.from(file.buffer).pipe(uploadStream);
            });
        } catch (error) {
            this.logger.error(`Cloudinary upload failed: ${error.message}`, error.stack);
            throw new InternalServerErrorException('Failed to upload image');
        }
    }

    /**
     * Delete an asset by its public_id.
     * Errors are logged but not thrown — a failed delete shouldn't block
     * an otherwise-successful profile update.
     */
    async deleteImage(publicId: string): Promise<void> {
        if (!publicId) return;
        try {
            await cloudinary.uploader.destroy(publicId);
        } catch (error) {
            this.logger.warn(`Failed to delete Cloudinary asset ${publicId}`, error.stack);
        }
    }
}