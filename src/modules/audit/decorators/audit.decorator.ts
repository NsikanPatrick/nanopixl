import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
    action: string;
    resourceType: string;
    operationType?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'PUBLISH' | 'REGENERATE' | 'OTHER';
    logChanges?: boolean;
    logRequestBody?: boolean;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

// Usage:
// @Audit({
//     action: 'user.create',
//     resourceType: 'User',
//     operationType: 'CREATE',
//     logChanges: true,
// })
// async createUser(@Body() dto: CreateUserDto) {
//     // ...
// }