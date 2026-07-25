import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../../modules/audit/audit.service';
import { AUDIT_KEY, AuditOptions } from '../../../modules/audit/decorators/audit.decorator';

@Injectable()
export class AuditGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private auditService: AuditService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const options = this.reflector.get<AuditOptions>(
            AUDIT_KEY,
            context.getHandler(),
        );

        if (!options) return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const startTime = Date.now();

        // Store audit metadata on request for later
        request.auditData = {
            options,
            user,
            startTime,
            timestamp: new Date(),
        };

        return true;
    }
}