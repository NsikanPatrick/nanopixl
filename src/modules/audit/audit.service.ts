import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike, FindOptionsWhere } from 'typeorm';
import { Request } from 'express';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../../core/auth/entities/user.entity';
import { CreateAuditDto } from './dto/create-audit.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

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

  // ==================== CREATE (Append-Only) ====================

  /**
   * Create a new audit log (append-only)
   * This is the ONLY write operation allowed
   */
  async create(createAuditDto: CreateAuditDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(createAuditDto);
    return this.auditLogRepository.save(auditLog);
  }

  // ==================== READ OPERATIONS ====================

  /**
   * Find all audit logs with pagination and filtering
   */
  async findAll(queryDto: QueryAuditDto): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = queryDto;

    const skip = (page - 1) * limit;
    const where: FindOptionsWhere<AuditLog> = {};

    if (userId) {
      where.userId = userId;
    }
    if (action) {
      where.action = ILike(`%${action}%`);
    }
    if (resourceType) {
      where.resourceType = resourceType;
    }
    if (resourceId) {
      where.resourceId = resourceId;
    }
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = Between(new Date(startDate), new Date());
    } else if (endDate) {
      where.createdAt = Between(new Date(0), new Date(endDate));
    }

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      select: {
        id: true,
        userId: true,
        userEmail: true,
        username: true,
        action: true,
        operationType: true,
        resourceType: true,
        resourceId: true,
        resourceName: true,
        ipAddress: true,
        userAgent: true,
        httpMethod: true,
        endpoint: true,
        statusCode: true,
        responseTime: true,
        changes: true,
        metadata: true,
        isSuccess: true,
        errorMessage: true,
        createdAt: true,
      },
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
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
   * Find a single audit log by ID
   */
  async findOne(id: string): Promise<AuditLog> {
    const auditLog = await this.auditLogRepository.findOne({
      where: { id },
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found`);
    }

    return auditLog;
  }

  /**
   * Get audit logs for a specific user
   */
  async findByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific resource
   */
  async findByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get audit logs by action type
   */
  async findByAction(action: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { action: ILike(`%${action}%`) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit: number = 20): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byOperationType: Record<string, number>;
    byAction: Record<string, number>;
    successRate: number;
    recentActivity: { date: string; count: number }[];
  }> {
    const total = await this.auditLogRepository.count();

    // Get operation type distribution
    const operationTypes = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.operationType', 'operationType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.operationType')
      .getRawMany();

    const byOperationType: Record<string, number> = {};
    operationTypes.forEach((item) => {
      byOperationType[item.operationType] = parseInt(item.count);
    });

    // Get action distribution (top 10)
    const actions = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.action')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const byAction: Record<string, number> = {};
    actions.forEach((item) => {
      byAction[item.action] = parseInt(item.count);
    });

    // Calculate success rate
    const successful = await this.auditLogRepository.count({
      where: { isSuccess: true },
    });
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Get recent activity (last 7 days)
    const recentActivity = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select("DATE(audit_log.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('audit_log.createdAt >= :date', { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
      .groupBy("DATE(audit_log.createdAt)")
      .orderBy("date", 'ASC')
      .getRawMany();

    return {
      total,
      byOperationType,
      byAction,
      successRate: Math.round(successRate * 100) / 100,
      recentActivity: recentActivity.map((item) => ({
        date: item.date,
        count: parseInt(item.count),
      })),
    };
  }

  // ==================== CONVENIENCE LOGGING METHODS ====================

  /**
   * Log an audit event (append-only)
   * This is the primary logging method used by interceptors and services
   */
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
      ipAddress: data.request?.ip || data.request?.socket?.remoteAddress,
      userAgent: data.request?.headers?.['user-agent'] as string,
      httpMethod: data.request?.method,
      endpoint: data.request?.url,
      sessionId: data.request?.session?.id || data.request?.headers?.['x-session-id'] as string,
      requestId: data.request?.headers?.['x-request-id'] as string,
    });

    return this.auditLogRepository.save(auditLog);
  }

  /**
   * Log a login attempt
   */
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
        loginMethod: 'email',
      },
    });
  }

  /**
   * Log a logout
   */
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

  /**
   * Log a generation creation
   */
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

  /**
   * Log a regeneration
   */
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

  /**
   * Log an export
   */
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
        fileSize: 0,
      },
    });
  }

  /**
   * Log a publish event
   */
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

  /**
   * Log an error
   */
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

  // ==================== HELPER METHODS ====================

  private getClientIp(request: ExtendedRequest): string | undefined {
    const forwarded = request.headers?.['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const cfConnectingIp = request.headers?.['cf-connecting-ip'] as string;
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    return request?.ip || request?.socket?.remoteAddress;
  }

  private getUserAgent(request: ExtendedRequest): string | undefined {
    return request?.headers?.['user-agent'] as string || undefined;
  }

  private getSessionId(request: ExtendedRequest): string | undefined {
    return request?.session?.id || request?.headers?.['x-session-id'] as string || undefined;
  }

  private getRequestId(request: ExtendedRequest): string | undefined {
    return request?.headers?.['x-request-id'] as string || undefined;
  }

  // update() method - Audit logs are immutable! so they can't be updated!
  // remove() method - Audit logs are never deleted!
  // softDelete() method - Audit logs are never deleted!
}