import { IsUUID, IsString, IsIn } from 'class-validator';
import type { SupportedPlatform } from '../constants/platform.constants';

export class GenerateProductDto {
    @IsUUID() imageId: string;
    @IsString() tone: string; // e.g., 'professional', 'playful'
    @IsIn(['amazon', 'shopify', 'woocommerce', 'etsy']) platform: SupportedPlatform;
    @IsString() language: string;
}