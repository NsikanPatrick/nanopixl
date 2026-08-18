// src/modules/auth/services/password.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import { PasswordReset } from '../entities/password-reset.entity';
import { User } from '../entities/user.entity';
// import { EmailService } from '../../email/email.service'; // If you have email module

@Injectable()
export class PasswordService {
    constructor(
        @InjectRepository(PasswordReset)
        private passwordResetRepository: Repository<PasswordReset>,
        // private emailService: EmailService, // Optional
    ) { }

    /**
     * Create a password reset token for a user
     */
    async createPasswordResetToken(
        user: User,
        ipAddress?: string,
        userAgent?: string
    ): Promise<string> {
        // Invalidate all existing unused tokens for this user
        await this.passwordResetRepository.update(
            {
                userId: user.id,
                used: false
            },
            {
                used: true,
                usedAt: new Date()
            }
        );

        // Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');

        // ✅ FIXED: Create the reset record with proper type
        const reset = this.passwordResetRepository.create({
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
            ipAddress,
            userAgent,
            // ✅ FIXED: Only include metadata that matches the entity type
            metadata: {
                requestedFrom: ipAddress,
                browser: userAgent?.split(' ').slice(0, 2).join(' '),
                os: this.detectOS(userAgent),
            },
        });

        await this.passwordResetRepository.save(reset);
        return token;
    }

    /**
     * Detect OS from user agent
     */
    private detectOS(userAgent?: string): string {
        if (!userAgent) return 'unknown';

        const ua = userAgent.toLowerCase();
        if (ua.includes('windows')) return 'Windows';
        if (ua.includes('mac')) return 'macOS';
        if (ua.includes('linux')) return 'Linux';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
        return 'unknown';
    }

    /**
     * Validate a reset token
     */
    async validateResetToken(token: string): Promise<PasswordReset> {
        // ✅ FIXED: Use proper relations syntax
        const reset = await this.passwordResetRepository.findOne({
            where: {
                token,
                used: false
            },
            relations: {
                user: true,
            },
        });

        if (!reset) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Check if token is expired
        if (reset.isExpired()) {
            throw new BadRequestException('Reset token has expired');
        }

        // Check if user is active
        if (reset.user && !reset.user.isActive) {
            throw new BadRequestException('User account is inactive');
        }

        return reset;
    }

    /**
     * Validate a reset token without throwing errors (returns boolean)
     */
    async isValidResetToken(token: string): Promise<boolean> {
        try {
            const reset = await this.passwordResetRepository.findOne({
                where: {
                    token,
                    used: false
                },
            });

            if (!reset || reset.isExpired()) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Mark a token as used
     */
    async markTokenAsUsed(token: string): Promise<void> {
        const result = await this.passwordResetRepository.update(
            { token },
            {
                used: true,
                usedAt: new Date()
            }
        );

        if (result.affected === 0) {
            throw new NotFoundException('Reset token not found');
        }
    }

    /**
     * Get reset token by token string
     */
    async getResetToken(token: string): Promise<PasswordReset | null> {
        return this.passwordResetRepository.findOne({
            where: { token },
            relations: {
                user: true,
            },
        });
    }

    /**
     * Get all reset tokens for a user
     */
    async getUserResetTokens(userId: string): Promise<PasswordReset[]> {
        return this.passwordResetRepository.find({
            where: {
                userId,
                used: false,
            },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Clean up expired and used tokens
     */
    async cleanupTokens(): Promise<{
        expiredRemoved: number;
        usedRemoved: number;
    }> {
        const now = new Date();

        // Remove expired tokens
        const expiredResult = await this.passwordResetRepository.delete({
            expiresAt: LessThan(now),
        });

        // Remove used tokens older than 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const usedResult = await this.passwordResetRepository.delete({
            used: true,
            usedAt: LessThan(sevenDaysAgo),
        });

        return {
            expiredRemoved: expiredResult.affected || 0,
            usedRemoved: usedResult.affected || 0,
        };
    }

    /**
     * Check if a user has recent reset requests (rate limiting)
     */
    async hasRecentResetRequest(userId: string, minutes: number = 5): Promise<boolean> {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - minutes);

        const count = await this.passwordResetRepository.count({
            where: {
                userId,
                createdAt: LessThan(cutoffTime),
            },
        });

        return count > 0;
    }

    /**
     * Get the remaining attempts for a user
     */
    async getRemainingAttempts(userId: string, maxAttempts: number = 3): Promise<number> {
        const recentResets = await this.passwordResetRepository.count({
            where: {
                userId,
                createdAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Last 24 hours
            },
        });

        return Math.max(0, maxAttempts - recentResets);
    }
}