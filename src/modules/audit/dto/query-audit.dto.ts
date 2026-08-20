import { IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditDto {
    @IsUUID()
    @IsOptional()
    userId?: string;

    @IsString()
    @IsOptional()
    action?: string;

    @IsString()
    @IsOptional()
    resourceType?: string;

    @IsString()
    @IsOptional()
    resourceId?: string;

    @IsDateString()
    @IsOptional()
    startDate?: string;

    @IsDateString()
    @IsOptional()
    endDate?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    @Type(() => Number)
    limit?: number = 20;
}