import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';

export interface ImageMetadata {
    width: number;
    height: number;
    format: string;
}

export async function extractImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
        const meta = await sharp(buffer).metadata();
        if (!meta.width || !meta.height) {
            throw new BadRequestException('Could not read image dimensions');
        }
        return {
            width: meta.width,
            height: meta.height,
            format: meta.format ?? 'unknown',
        };
    } catch (err) {
        throw new BadRequestException('Invalid or corrupted image file');
    }
}