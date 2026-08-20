import {
    IsString,
    IsOptional,
    IsUUID,
    IsBoolean,
    IsNumber,
    IsObject,
    IsEnum,
    IsEmail,
} from 'class-validator';

export class CreateAuditDto {
    @IsUUID()
    @IsOptional()
    userId?: string;

    @IsEmail()
    @IsOptional()
    userEmail?: string;

    @IsString()
    @IsOptional()
    username?: string;

    @IsString()
    action!: string;

    @IsEnum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PUBLISH', 'REGENERATE', 'OTHER'])
    @IsOptional()
    operationType?: string;

    @IsString()
    resourceType!: string;

    @IsString()
    @IsOptional()
    resourceId?: string;

    @IsString()
    @IsOptional()
    resourceName?: string;

    @IsObject()
    @IsOptional()
    changes?: {
        before?: Record<string, any>;
        after?: Record<string, any>;
        diff?: Record<string, { before: any; after: any }>;
    };

    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    isSuccess?: boolean;

    @IsString()
    @IsOptional()
    errorMessage?: string;

    @IsString()
    @IsOptional()
    errorStack?: string;

    @IsString()
    @IsOptional()
    ipAddress?: string;

    @IsString()
    @IsOptional()
    userAgent?: string;

    @IsString()
    @IsOptional()
    httpMethod?: string;

    @IsString()
    @IsOptional()
    endpoint?: string;

    @IsString()
    @IsOptional()
    sessionId?: string;

    @IsString()
    @IsOptional()
    requestId?: string;

    @IsNumber()
    @IsOptional()
    statusCode?: number;

    @IsNumber()
    @IsOptional()
    responseTime?: number;
}