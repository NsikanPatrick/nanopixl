import { User } from '../entities/user.entity';

const SENSITIVE_FIELDS = ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes', 'metadata' ] as const;

export function sanitizeUser(user: User): Omit<User, typeof SENSITIVE_FIELDS[number]> {
    const clone = { ...user };
    for (const field of SENSITIVE_FIELDS) {
        delete (clone as any)[field];
    }
    return clone as any;
}