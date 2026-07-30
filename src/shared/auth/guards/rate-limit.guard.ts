import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const rateLimit = this.reflector.getAllAndOverride<{ limit: number; ttl: number }>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()]
        );

        if (!rateLimit) {
            return true;
        }

        // Implement rate limiting logic using Redis or other store
        // This is a simplified example
        const request = context.switchToHttp().getRequest();
        const key = `rate_limit:${request.ip}:${request.path}`;

        // Check if rate limit exceeded
        // throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);

        return true;
    }
}