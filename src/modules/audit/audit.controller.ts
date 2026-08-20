// src/modules/audit/audit.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/auth/guards/roles.guard';
import { Roles } from '../../shared/auth/decorators/roles.decorator';
import { UserRole } from '../../core/auth/entities/user.entity';
import { Public } from '../../shared/auth/decorators/public.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Only admins can access audit logs
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  /**
   * Create a new audit log (internal use only)
   * This is typically called by the AuditInterceptor or AuditService internally
   */
  @Post()
  create(@Body() createAuditDto: CreateAuditDto) {
    return this.auditService.create(createAuditDto);
  }

  /**
   * Get all audit logs with pagination and filtering
   */
  @Get()
  findAll(@Query() queryDto: QueryAuditDto) {
    return this.auditService.findAll(queryDto);
  }

  /**
   * Get audit log statistics
   */
  @Get('statistics')
  getStatistics() {
    return this.auditService.getStatistics();
  }

  /**
   * Get recent audit logs
   */
  @Get('recent')
  getRecent(@Query('limit') limit?: number) {
    return this.auditService.getRecent(limit || 20);
  }

  /**
   * Get audit logs for a specific user
   */
  @Get('user/:userId')
  findByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findByUser(userId, limit || 50);
  }

  /**
   * Get audit logs for a specific resource
   */
  @Get('resource/:resourceType/:resourceId')
  findByResource(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.findByResource(resourceType, resourceId);
  }

  /**
   * Get audit logs by action
   */
  @Get('action/:action')
  findByAction(
    @Param('action') action: string,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.findByAction(action, limit || 50);
  }

  /**
   * Get a single audit log by ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  // @Patch(':id') update() - Audit logs are immutable! so they can't be updated!
  // @Delete(':id') remove() - Audit logs are never deleted! so they can't be deleted!
}