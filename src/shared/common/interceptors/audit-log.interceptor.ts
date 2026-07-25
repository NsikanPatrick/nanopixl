import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../../modules/audit/audit.service';
import { Request, Response } from 'express';

// Define the operation type union
type OperationType = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'PUBLISH' | 'REGENERATE' | 'OTHER';

// Define paths to exclude from auditing
const EXCLUDED_PATHS = [
    '/health',
    '/health/',
    '/metrics',
    '/metrics/',
    '/favicon.ico',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(private auditService: AuditService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        // Skip auditing for excluded paths
        if (this.shouldSkipAudit(request.path)) {
            return next.handle();
        }

        const user = (request as any).user;
        const startTime = Date.now();

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const responseTime = Date.now() - startTime;

                    // Log in background - don't block the response
                    this.auditService.log({
                        userId: user?.id,
                        userEmail: user?.email,
                        username: user?.username,
                        action: this.getAction(request),
                        operationType: this.getOperationType(request.method),
                        resourceType: this.getResourceType(request.path),
                        resourceId: this.getResourceId(request),
                        isSuccess: true,
                        request,
                        statusCode: response.statusCode || 200,
                        responseTime,
                        metadata: this.getMetadata(request, data),
                    }).catch(err => console.error('Failed to log audit:', err));
                },
                error: (error) => {
                    const responseTime = Date.now() - startTime;

                    // Log error in background
                    this.auditService.log({
                        userId: user?.id,
                        userEmail: user?.email,
                        username: user?.username,
                        action: this.getAction(request),
                        operationType: this.getOperationType(request.method),
                        resourceType: this.getResourceType(request.path),
                        resourceId: this.getResourceId(request),
                        isSuccess: false,
                        errorMessage: error.message,
                        request,
                        statusCode: error.status || 500,
                        responseTime,
                        metadata: this.getErrorMetadata(request, error),
                    }).catch(err => console.error('Failed to log audit error:', err));
                },
            }),
        );
    }

    // Helper to get action from request
    private getAction(request: Request): string {
        const method = request.method.toLowerCase();
        const path = request.path;
        return `${method}.${path}`;
    }

    // Return the specific union type with proper mapping
    private getOperationType(method: string): OperationType {
        const map: Record<string, OperationType> = {
            GET: 'READ',
            POST: 'CREATE',
            PUT: 'UPDATE',
            PATCH: 'UPDATE',
            DELETE: 'DELETE',
        };
        return map[method] || 'OTHER';
    }

    // Get resource type from path
    private getResourceType(path: string): string {
        // Remove query parameters
        const cleanPath = path.split('?')[0];
        const parts = cleanPath.split('/').filter(Boolean);

        if (parts.length === 0) return 'Root';

        // Get the first part as resource type
        let resource = parts[0];

        // Remove common suffixes
        resource = resource.replace(/s$/, ''); // Remove plural 's'
        resource = resource.replace(/es$/, ''); // Remove plural 'es'

        // Capitalize first letter
        return resource.charAt(0).toUpperCase() + resource.slice(1) || 'Unknown';
    }

    // Safely get resource ID
    private getResourceId(request: Request): string | undefined {
        // Check if there's an ID in the params
        if (request.params?.id) {
            const id = request.params.id;
            return Array.isArray(id) ? id[0] : id;
        }

        // Check for ID in the URL pattern (e.g., /users/123)
        const pathParts = request.path.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            const lastPart = pathParts[pathParts.length - 1];
            // Check if it looks like a UUID or number
            if (this.isValidId(lastPart)) {
                return lastPart;
            }
        }

        return undefined;
    }

    // Helper to check if string looks like an ID
    private isValidId(value: string): boolean {
        // Check for UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(value)) return true;

        // Check for number
        if (/^\d+$/.test(value)) return true;

        return false;
    }

    // Get additional metadata from request
    private getMetadata(request: Request, data: any): Record<string, any> {
        const metadata: Record<string, any> = {};

        // Add request body for mutations (but filter sensitive data)
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
            const body = { ...request.body };
            // Remove sensitive fields
            this.removeSensitiveFields(body);
            metadata.requestBody = body;
        }

        // Add query parameters
        if (request.query && Object.keys(request.query).length > 0) {
            metadata.queryParams = request.query;
        }

        // Add response summary
        if (data && typeof data === 'object') {
            metadata.responseSummary = {
                hasData: true,
                type: Array.isArray(data) ? 'array' : 'object',
                count: Array.isArray(data) ? data.length : undefined,
            };
        }

        return metadata;
    }

    // Get error metadata
    private getErrorMetadata(request: Request, error: Error): Record<string, any> {
        const metadata: Record<string, any> = {};

        // Add request body for mutations (filter sensitive data)
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
            const body = { ...request.body };
            this.removeSensitiveFields(body);
            metadata.requestBody = body;
        }

        // Add query parameters
        if (request.query && Object.keys(request.query).length > 0) {
            metadata.queryParams = request.query;
        }

        // Add error details (stack only in development)
        if (process.env.NODE_ENV !== 'production') {
            metadata.errorStack = error.stack;
            metadata.errorName = error.name;
        }

        return metadata;
    }

    // Remove sensitive fields from objects
    private removeSensitiveFields(obj: Record<string, any>): void {
        const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'key', 'authorization'];
        for (const field of sensitiveFields) {
            if (field in obj) {
                obj[field] = '[REDACTED]';
            }
        }

        // Recursively check nested objects
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object') {
                this.removeSensitiveFields(obj[key]);
            }
        }
    }

    // Check if path should be skipped from auditing
    private shouldSkipAudit(path: string): boolean {
        return EXCLUDED_PATHS.some(excludedPath =>
            path === excludedPath || path.startsWith(excludedPath)
        );
    }
}