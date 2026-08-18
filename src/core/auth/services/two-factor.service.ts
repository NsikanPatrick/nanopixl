import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { TwoFactorMethod } from '../entities/two-factor-method.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class TwoFactorService {
    constructor(
        @InjectRepository(TwoFactorMethod)
        private twoFactorRepository: Repository<TwoFactorMethod>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    /**
     * Generate 2FA secret and QR code for authenticator app
     */
    async generateSecret(user: User): Promise<{ secret: string; qrCode: string }> {
        // Generate secret
        const secret = speakeasy.generateSecret({
            name: `NanoPixl:${user.email}`,
        });

        // Check if otpauth_url exists
        if (!secret.otpauth_url) {
            throw new BadRequestException('Failed to generate 2FA secret');
        }

        // Generate QR code
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);

        // Check if user already has a 2FA method
        const existingMethod = await this.twoFactorRepository.findOne({
            where: {
                userId: user.id,
                method: 'authenticator',
                isActive: true,
            },
        });

        if (existingMethod) {
            // Update existing method
            existingMethod.secret = secret.base32;
            existingMethod.isVerified = false;
            existingMethod.verifiedAt = undefined; // ✅ Use undefined instead of null
            await this.twoFactorRepository.save(existingMethod);
        } else {
            // Create new method
            const method = this.twoFactorRepository.create({
                userId: user.id,
                method: 'authenticator',
                secret: secret.base32,
                isVerified: false,
                isPrimary: true,
                isActive: true,
            });
            await this.twoFactorRepository.save(method);
        }

        // Update user's 2FA status
        user.isTwoFactorEnabled = true;
        await this.userRepository.save(user);

        return {
            secret: secret.base32,
            qrCode,
        };
    }

    /**
     * Verify TOTP token
     */
    async verifyTOTP(userId: string, token: string): Promise<boolean> {
        const method = await this.twoFactorRepository.findOne({
            where: {
                userId,
                method: 'authenticator',
                isActive: true,
            },
        });

        if (!method || !method.secret) {
            return false;
        }

        const verified = speakeasy.totp.verify({
            secret: method.secret,
            encoding: 'base32',
            token,
            window: 1, // Allow 1 step before/after for time drift
        });

        if (verified) {
            // Mark as verified if not already
            if (!method.isVerified) {
                method.isVerified = true;
                method.verifiedAt = new Date();
                await this.twoFactorRepository.save(method);
            }
        }

        return verified;
    }

    /**
     * Enable 2FA for user
     */
    async enableTwoFactor(
        userId: string,
        method: string = 'authenticator',
        token?: string,
    ): Promise<void> {
        // If token is provided, verify it first
        if (token && method === 'authenticator') {
            const isValid = await this.verifyTOTP(userId, token);
            if (!isValid) {
                throw new BadRequestException('Invalid 2FA code');
            }
        }

        const existing = await this.twoFactorRepository.findOne({
            where: {
                userId,
                method,
            },
        });

        if (existing) {
            existing.isActive = true;
            existing.isVerified = true;
            existing.verifiedAt = new Date();
            await this.twoFactorRepository.save(existing);
        } else {
            // Create new method
            const newMethod = this.twoFactorRepository.create({
                userId,
                method,
                isVerified: true,
                isActive: true,
                isPrimary: true,
            });
            await this.twoFactorRepository.save(newMethod);
        }

        // Update user
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.isTwoFactorEnabled = true;
            await this.userRepository.save(user);
        }
    }

    /**
     * Disable 2FA for user
     */
    async disableTwoFactor(userId: string): Promise<void> {
        // Deactivate all 2FA methods for user
        await this.twoFactorRepository.update(
            { userId, isActive: true },
            { isActive: false }
        );

        // Update user
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.isTwoFactorEnabled = false;
            user.twoFactorSecret = undefined; // ✅ Use undefined instead of null
            user.twoFactorBackupCodes = undefined; // ✅ Use undefined instead of null
            await this.userRepository.save(user);
        }
    }

    /**
     * Generate backup codes for 2FA
     */
    async generateBackupCodes(userId: string): Promise<string[]> {
        const codes = Array.from({ length: 10 }, () =>
            Math.random().toString(36).substring(2, 8).toUpperCase()
        );

        // Save backup codes
        await this.twoFactorRepository.update(
            { userId, isActive: true },
            { backupCodes: codes }
        );

        // Update user
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.twoFactorBackupCodes = codes;
            await this.userRepository.save(user);
        }

        return codes;
    }

    /**
     * Verify backup code
     */
    async verifyBackupCode(userId: string, code: string): Promise<boolean> {
        const method = await this.twoFactorRepository.findOne({
            where: {
                userId,
                isActive: true,
                isVerified: true,
            },
        });

        if (!method || !method.backupCodes) {
            return false;
        }

        // Check if code exists and remove it (one-time use)
        const codeIndex = method.backupCodes.indexOf(code);
        if (codeIndex === -1) {
            return false;
        }

        // Remove used backup code
        method.backupCodes.splice(codeIndex, 1);
        await this.twoFactorRepository.save(method);

        // Update user
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user) {
            user.twoFactorBackupCodes = method.backupCodes;
            await this.userRepository.save(user);
        }

        return true;
    }

    /**
     * Get user's 2FA methods
     */
    async getUserMethods(userId: string): Promise<TwoFactorMethod[]> {
        return this.twoFactorRepository.find({
            where: { userId, isActive: true },
            order: { isPrimary: 'DESC', createdAt: 'ASC' },
        });
    }

    /**
     * Set primary 2FA method
     */
    async setPrimaryMethod(userId: string, methodId: string): Promise<void> {
        // Unset all primary flags
        await this.twoFactorRepository.update(
            { userId, isActive: true },
            { isPrimary: false }
        );

        // Set the selected method as primary
        await this.twoFactorRepository.update(
            { id: methodId, userId },
            { isPrimary: true }
        );
    }

    /**
     * Remove a 2FA method
     */
    async removeMethod(userId: string, methodId: string): Promise<void> {
        const method = await this.twoFactorRepository.findOne({
            where: { id: methodId, userId },
        });

        if (!method) {
            throw new BadRequestException('2FA method not found');
        }

        // Deactivate the method
        method.isActive = false;
        await this.twoFactorRepository.save(method);

        // If this was the primary method, set another as primary
        if (method.isPrimary) {
            const otherMethod = await this.twoFactorRepository.findOne({
                where: { userId, isActive: true },
                order: { createdAt: 'ASC' },
            });

            if (otherMethod) {
                otherMethod.isPrimary = true;
                await this.twoFactorRepository.save(otherMethod);
            }
        }

        // Check if user has any active methods
        const activeMethods = await this.twoFactorRepository.count({
            where: { userId, isActive: true },
        });

        if (activeMethods === 0) {
            // Disable 2FA for user
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user) {
                user.isTwoFactorEnabled = false;
                user.twoFactorSecret = undefined; // ✅ Use undefined instead of null
                user.twoFactorBackupCodes = undefined; // ✅ Use undefined instead of null
                await this.userRepository.save(user);
            }
        }
    }

    /**
     * Check if user has 2FA enabled
     */
    async isTwoFactorEnabled(userId: string): Promise<boolean> {
        const count = await this.twoFactorRepository.count({
            where: { userId, isActive: true, isVerified: true },
        });
        return count > 0;
    }

    /**
     * Get primary 2FA method
     */
    async getPrimaryMethod(userId: string): Promise<TwoFactorMethod | null> {
        return this.twoFactorRepository.findOne({
            where: { userId, isActive: true, isPrimary: true },
        });
    }

    /**
     * Validate TOTP for authentication
     */
    async validateTOTPForAuth(userId: string, token: string): Promise<boolean> {
        // First try to verify TOTP
        const isValid = await this.verifyTOTP(userId, token);
        if (isValid) {
            return true;
        }

        // If TOTP fails, try backup code
        return this.verifyBackupCode(userId, token);
    }
}