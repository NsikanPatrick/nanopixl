// Service for security checks
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLoginHistory } from '../entities/user-login-history.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class SecurityService {
    constructor(
        @InjectRepository(UserLoginHistory)
        private loginHistoryRepository: Repository<UserLoginHistory>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async recordLoginAttempt(
        userId: string,
        ipAddress: string,
        userAgent: string,
        success: boolean,
        reason?: string,
    ): Promise<void> {
        const history = this.loginHistoryRepository.create({
            userId,
            ipAddress,
            userAgent,
            isSuccessful: success,
            failureReason: reason,
        });
        await this.loginHistoryRepository.save(history);
    }

    async getRecentLogins(userId: string, limit: number = 10): Promise<UserLoginHistory[]> {
        return this.loginHistoryRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }

    async isIpBlacklisted(ipAddress: string): Promise<boolean> {
        // Implement IP blacklist logic
        // Could check against a blacklist table or external service
        return false;
    }

    async isAccountLocked(userId: string): Promise<boolean> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        return user?.isLocked() || false;
    }

    async handleFailedLogin(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.incrementLoginAttempts();
            await this.userRepository.save(user);
        }
    }

    async handleSuccessfulLogin(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.resetLoginAttempts();
            user.lastLoginAt = new Date();
            await this.userRepository.save(user);
        }
    }
}