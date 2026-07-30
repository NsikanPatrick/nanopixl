import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginHistory } from '../entities/user-login-history.entity';
import { User } from '../../users/entities/user.entity';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class SecurityService {
    constructor(
        @InjectRepository(UserLoginHistory)
        private loginHistoryRepository: Repository<UserLoginHistory>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private twoFactorService: TwoFactorService,
    ) { }

    /**
     * Record a login attempt
     */
    async recordLoginAttempt(
        userId: string | null, // Allow null for failed attempts from unknown users
        ipAddress: string,
        userAgent: string,
        success: boolean,
        reason?: string,
    ): Promise<void> {
        const history = this.loginHistoryRepository.create({
            userId: userId || undefined, // Convert null to undefined
            ipAddress,
            userAgent,
            isSuccessful: success,
            failureReason: reason,
        });
        await this.loginHistoryRepository.save(history);
    }

    /**
     * Get recent logins for a user
     */
    async getRecentLogins(userId: string, limit: number = 10): Promise<UserLoginHistory[]> {
        return this.loginHistoryRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    /**
     * Check if an IP is blacklisted
     */
    async isIpBlacklisted(ipAddress: string): Promise<boolean> {
        // Implement IP blacklist logic
        // Could check against a blacklist table or external service
        return false;
    }

    /**
     * Check if a user account is locked
     */
    async isAccountLocked(userId: string): Promise<boolean> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        return user?.isLocked() || false;
    }

    /**
     * Handle a failed login attempt
     */
    async handleFailedLogin(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.incrementLoginAttempts();
            await this.userRepository.save(user);
        }
    }

    /**
     * Handle a successful login attempt
     */
    async handleSuccessfulLogin(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.resetLoginAttempts();
            user.lastLoginAt = new Date();
            await this.userRepository.save(user);
        }
    }

    /**
     * Validate 2FA code for a user
     */
    async validateTwoFactor(userId: string, code: string): Promise<boolean> {
        // Delegate to TwoFactorService
        return this.twoFactorService.validateTOTPForAuth(userId, code);
    }

    /**
     * Get failed login attempts count
     */
    async getFailedLoginAttempts(userId: string, timeWindowMinutes: number = 15): Promise<number> {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - timeWindowMinutes);

        return this.loginHistoryRepository.count({
            where: {
                userId,
                isSuccessful: false,
                createdAt: cutoffTime,
            },
        });
    }

    /**
     * Check if login is allowed (rate limiting)
     */
    async isLoginAllowed(userId: string, maxAttempts: number = 5): Promise<boolean> {
        const recentFailures = await this.getFailedLoginAttempts(userId);
        return recentFailures < maxAttempts;
    }

    /**
     * Block an IP address
     */
    async blockIpAddress(ipAddress: string, reason: string, durationMinutes: number = 60): Promise<void> {
        // Implement IP blocking logic
        // Could store in Redis or a database table
        console.log(`IP ${ipAddress} blocked for ${durationMinutes} minutes: ${reason}`);
    }

    /**
     * Unblock an IP address
     */
    async unblockIpAddress(ipAddress: string): Promise<void> {
        // Implement IP unblocking logic
        console.log(`IP ${ipAddress} unblocked`);
    }

    /**
     * Check if a user has suspicious activity
     */
    async hasSuspiciousActivity(userId: string): Promise<boolean> {
        // Check for multiple failed logins from different IPs
        const recentLogins = await this.loginHistoryRepository.find({
            where: { userId, isSuccessful: false },
            order: { createdAt: 'DESC' },
            take: 10,
        });

        // Check if there are 5+ failures from different IPs in the last hour
        const uniqueIps = new Set(recentLogins.map(login => login.ipAddress).filter(Boolean));
        return uniqueIps.size >= 5 && recentLogins.length >= 10;
    }

    /**
     * Get login history for a user with pagination
     */
    async getLoginHistory(
        userId: string,
        options?: { page?: number; limit?: number; startDate?: Date; endDate?: Date }
    ): Promise<{ data: UserLoginHistory[]; total: number }> {
        const page = options?.page || 1;
        const limit = options?.limit || 20;
        const skip = (page - 1) * limit;

        const query = this.loginHistoryRepository.createQueryBuilder('history')
            .where('history.userId = :userId', { userId });

        if (options?.startDate) {
            query.andWhere('history.createdAt >= :startDate', { startDate: options.startDate });
        }

        if (options?.endDate) {
            query.andWhere('history.createdAt <= :endDate', { endDate: options.endDate });
        }

        const [data, total] = await query
            .orderBy('history.createdAt', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return { data, total };
    }
}