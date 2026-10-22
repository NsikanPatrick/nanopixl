import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import axios from 'axios';

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

    /**
    * Delete multiple images - Cloudinary assets by public_id in one API call.
    * Swallows errors — a failed cleanup should not break the caller.
    */
    async deleteImages(publicIds: string[]): Promise<void> {
        if (!publicIds.length) return;

        try {
            // Cloudinary caps at 100 public_ids per call; chunk if needed.
            const CHUNK = 100;
            for (let i = 0; i < publicIds.length; i += CHUNK) {
                const chunk = publicIds.slice(i, i + CHUNK);
                await cloudinary.api.delete_resources(chunk);
            }
        } catch (error) {
            this.logger.warn(
                `Failed to bulk-delete Cloudinary assets: ${error.message}`,
                error.stack,
            );
        }
    }

    // ================= DELETE EMPTY IMAGE FOLDERS ===============
    // This is because no user can own a folder in cloudinary except they've
    // uploaded an image there at least (Uploading an image gives the user a folder to upload to)
    // 
    /** Delete an empty folder from Cloudinary.
    * The folder must be empty (all assets already deleted).*/
    async deleteFolder(folderPath: string): Promise<void> {
        const cloudName = this.configService.get<string>('appConfig.cloudinary.cloudName');
        const apiKey = this.configService.get<string>('appConfig.cloudinary.apiKey');
        const apiSecret = this.configService.get<string>('appConfig.cloudinary.apiSecret');

        if (!cloudName || !apiKey || !apiSecret) {
            this.logger.warn('Cloudinary credentials missing; skipping folder deletion');
            return;
        }

        const url = `https://api.cloudinary.com/v1_1/${cloudName}/folders/${encodeURIComponent(folderPath)}`;

        try {
            await axios.delete(url, {
                auth: { username: apiKey, password: apiSecret },
            });
            this.logger.log(`Deleted Cloudinary folder: ${folderPath}`);
        } catch (error) {
            // Common: "Folder is not empty" (400) if assets weren't fully deleted
            // or folder doesn't exist (404)
            this.logger.warn(
                `Failed to delete Cloudinary folder "${folderPath}": ${error.response?.data?.error?.message ?? error.message}`,
            );
        }
    }
}