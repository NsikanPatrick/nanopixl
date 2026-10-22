import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchUploadQueryDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)     // safety cap — adjust depending on infra
    @Type(() => Number)
    limit?: number = 20;
}