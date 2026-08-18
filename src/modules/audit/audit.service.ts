import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../../core/auth/entities/user.entity';

// Extend Express Request to include session if using express-session
// Or use any type for the request parameter
interface ExtendedRequest extends Request {
  session?: {
    id?: string;
    [key: string]: any;
  };
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) { }

  async log(
    data: {
      userId?: string;
      userEmail?: string;
      username?: string;
      action: string;
      operationType?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'PUBLISH' | 'REGENERATE' | 'OTHER';
      resourceType: string;
      resourceId?: string;
      resourceName?: string;
      changes?: {
        before?: Record<string, any>;
        after?: Record<string, any>;
        diff?: Record<string, { before: any; after: any }>;
      };
      metadata?: Record<string, any>;
      isSuccess?: boolean;
      errorMessage?: string;
      errorStack?: string;
      request?: ExtendedRequest;
      statusCode?: number;
      responseTime?: number;
    },
  ): Promise<AuditLog> {
    // Properly type the create method with DeepPartial
    const auditLog = this.auditLogRepository.create({
      userId: data.userId,
      userEmail: data.userEmail,
      username: data.username,
      action: data.action,
      operationType: data.operationType || 'OTHER',
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      resourceName: data.resourceName,
      changes: data.changes,
      metadata: data.metadata,
      isSuccess: data.isSuccess ?? true,
      errorMessage: data.errorMessage,
      errorStack: data.errorStack,
      statusCode: data.statusCode,
      responseTime: data.responseTime,
      // connection is deprecated use socket.remoteAddress instead 
      ipAddress: data.request?.ip || data.request?.socket?.remoteAddress,
      // Access headers safely
      userAgent: data.request?.headers?.['user-agent'] as string,
      httpMethod: data.request?.method,
      endpoint: data.request?.url,
      // Check session safely
      sessionId: data.request?.session?.id || data.request?.headers?.['x-session-id'] as string,
      requestId: data.request?.headers?.['x-request-id'] as string,
    });

    // save() returns the entity directly, not an array
    return this.auditLogRepository.save(auditLog);
  }

  // Convenience methods for common operations
  // Login logs
  async logLogin(
    user: User,
    request: ExtendedRequest,
    isSuccess: boolean = true,
    errorMessage?: string,
  ): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'user.login',
      operationType: 'LOGIN',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: user.username,
      isSuccess,
      errorMessage,
      request,
      metadata: {
        loginMethod: 'email', // or 'google', 'facebook', etc.
      },
    });
  }

  // Logout logs
  async logLogout(user: User, request: ExtendedRequest): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'user.logout',
      operationType: 'LOGOUT',
      resourceType: 'User',
      resourceId: user.id,
      resourceName: user.username,
      request,
    });
  }

  // Image generation logs
  async logGenerationCreate(
    user: User,
    generationId: string,
    generationName: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'generation.create',
      operationType: 'CREATE',
      resourceType: 'Generation',
      resourceId: generationId,
      resourceName: generationName,
      metadata: {
        ...metadata,
        tone: metadata?.tone,
        platform: metadata?.platform,
        language: metadata?.language,
      },
    });
  }

  // Regeneration logs
  async logGenerationRegenerate(
    user: User,
    generationId: string,
    generationName: string,
    field: string,
    before: any,
    after: any,
  ): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'generation.regenerate',
      operationType: 'REGENERATE',
      resourceType: 'Generation',
      resourceId: generationId,
      resourceName: generationName,
      changes: {
        before: { [field]: before },
        after: { [field]: after },
        diff: {
          [field]: { before, after },
        },
      },
      metadata: {
        regeneratedField: field,
      },
    });
  }

  // Export logs
  async logExport(
    user: User,
    exportType: string,
    fileName: string,
    recordsCount: number,
  ): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'export.download',
      operationType: 'EXPORT',
      resourceType: 'Export',
      resourceName: fileName,
      metadata: {
        exportType,
        recordsCount,
        fileSize: 0, // Will be updated after file is created
      },
    });
  }

  // Publish logs - Incase publishing to platforms ()
  async logPublish(
    user: User,
    generationId: string,
    generationName: string,
    platform: string,
    platformId: string,
  ): Promise<AuditLog> {
    return this.log({
      userId: user.id,
      userEmail: user.email,
      username: user.username,
      action: 'generation.publish',
      operationType: 'PUBLISH',
      resourceType: 'Generation',
      resourceId: generationId,
      resourceName: generationName,
      metadata: {
        platform,
        platformId,
        publishedAt: new Date().toISOString(),
      },
    });
  }

  // Log errors
  async logError(
    user: User | null,
    action: string,
    resourceType: string,
    error: Error,
    metadata?: Record<string, any>,
    request?: ExtendedRequest,
  ): Promise<AuditLog> {
    return this.log({
      userId: user?.id,
      userEmail: user?.email,
      username: user?.username,
      action,
      operationType: 'OTHER',
      resourceType,
      isSuccess: false,
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      metadata,
      request,
    });
  }

  // Helper method to get client IP safely
  private getClientIp(request: ExtendedRequest): string | undefined {
    // Check for forwarded IP (when behind a proxy)
    const forwarded = request.headers?.['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    // Check for CloudFlare
    const cfConnectingIp = request.headers?.['cf-connecting-ip'] as string;
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback to socket or IP
    return request?.ip || request?.socket?.remoteAddress;
  }

  // Helper method to get user agent safely
  private getUserAgent(request: ExtendedRequest): string | undefined {
    return request?.headers?.['user-agent'] as string || undefined;
  }

  // Helper method to get session ID safely
  private getSessionId(request: ExtendedRequest): string | undefined {
    return request?.session?.id || request?.headers?.['x-session-id'] as string || undefined;
  }

  // Helper method to get request ID safely
  private getRequestId(request: ExtendedRequest): string | undefined {
    return request?.headers?.['x-request-id'] as string || undefined;
  }
}