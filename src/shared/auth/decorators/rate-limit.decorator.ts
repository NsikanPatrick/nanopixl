import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (limit: number = 10, ttl: number = 60) =>
    SetMetadata(RATE_LIMIT_KEY, { limit, ttl });