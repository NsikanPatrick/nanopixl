// src/modules/auth/services/otp-verification.service.ts
import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { OtpVerification } from '../entities/otp-verification.entity';

@Injectable()
export class OtpVerificationService {
    constructor(
        @InjectRepository(OtpVerification)
        private otpRepository: Repository<OtpVerification>,
        // private emailService: EmailService, // Optional
        // private smsService: SmsService, // Optional
    ) { }

    /**
     * Generate and send an OTP for verification
     */
    async generateOtp(
        identifier: string,
        purpose: string,
        options?: {
            length?: number;
            expiresIn?: number; // in minutes
            sendEmail?: boolean;
            sendSms?: boolean;
        }
    ): Promise<{ code: string; otp: OtpVerification }> {
        // Rate limiting - check recent requests
        const recentOtps = await this.otpRepository.count({
            where: {
                identifier,
                purpose,
                createdAt: LessThan(new Date(Date.now() - 1 * 60 * 1000)), // Last 1 minute
            },
        });

        if (recentOtps >= 3) {
            // Using HttpException with 429 status code
            throw new HttpException(
                'Too many OTP requests. Please wait a moment.',
                HttpStatus.TOO_MANY_REQUESTS
            );

            // Other Options of throwing the error
            // Using ThrottlerException (if using @nestjs/throttler)
            // throw new ThrottlerException('Too many OTP requests. Please wait a moment.');
        }

        // Generate random 6-digit code
        const length = options?.length || 6;
        const code = this.generateCode(length);
        const expiresIn = options?.expiresIn || 15; // 15 minutes default

        // Create OTP record
        const otp = this.otpRepository.create({
            identifier,
            code,
            purpose,
            expiresAt: new Date(Date.now() + expiresIn * 60 * 1000),
            metadata: {
                attempts: 0,
            },
        });

        await this.otpRepository.save(otp);

        // Send OTP via email if requested
        if (options?.sendEmail) {
            await this.sendOtpEmail(identifier, code, purpose);
        }

        // Send OTP via SMS if requested
        if (options?.sendSms) {
            await this.sendOtpSms(identifier, code);
        }

        return { code, otp };
    }

    /**
     * Verify an OTP
     */
    async verifyOtp(
        identifier: string,
        code: string,
        purpose: string
    ): Promise<{ valid: boolean; otp: OtpVerification | null }> {
        const otp = await this.otpRepository.findOne({
            where: {
                identifier,
                code,
                purpose,
                used: false,
            },
        });

        if (!otp) {
            return { valid: false, otp: null };
        }

        // Check if expired
        if (otp.isExpired()) {
            return { valid: false, otp: null };
        }

        // Check if max attempts exceeded
        if (otp.hasMaxAttempts()) {
            return { valid: false, otp: null };
        }

        // Increment attempts
        otp.incrementAttempts();
        await this.otpRepository.save(otp);

        // Mark as used if valid
        otp.markAsUsed();
        await this.otpRepository.save(otp);

        return { valid: true, otp };
    }

    /**
     * Resend an OTP
     */
    async resendOtp(
        identifier: string,
        purpose: string,
        options?: {
            sendEmail?: boolean;
            sendSms?: boolean;
        }
    ): Promise<{ code: string; otp: OtpVerification }> {
        // Find the last unused OTP
        const otp = await this.otpRepository.findOne({
            where: {
                identifier,
                purpose,
                used: false,
            },
            order: { createdAt: 'DESC' },
        });

        if (!otp) {
            throw new BadRequestException('No active OTP found. Please request a new one.');
        }

        // Check if max resends exceeded
        if (otp.hasMaxResends()) {
            // ✅ Use HttpException with 429 status code
            throw new HttpException(
                'Maximum resend limit reached. Please request a new OTP.',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        // Check if expired
        if (otp.isExpired()) {
            // Generate a new OTP
            return this.generateOtp(identifier, purpose, options);
        }

        // Resend the same OTP
        otp.incrementResendCount();
        await this.otpRepository.save(otp);

        // Send the OTP again
        if (options?.sendEmail) {
            await this.sendOtpEmail(identifier, otp.code, purpose);
        }

        if (options?.sendSms) {
            await this.sendOtpSms(identifier, otp.code);
        }

        return { code: otp.code, otp };
    }

    /**
     * Clean up expired OTPs
     */
    async cleanupExpiredOtps(): Promise<number> {
        const result = await this.otpRepository.delete({
            expiresAt: LessThan(new Date()),
        });
        return result.affected || 0;
    }

    /**
     * Generate a random code
     */
    private generateCode(length: number): string {
        return Math.floor(Math.random() * Math.pow(10, length))
            .toString()
            .padStart(length, '0');
    }

    /**
     * Send OTP via email
     */
    private async sendOtpEmail(identifier: string, code: string, purpose: string): Promise<void> {
        // Implement email sending logic
        console.log(`Sending OTP ${code} to ${identifier} for ${purpose}`);
        // Example: await this.emailService.sendOtp(identifier, code, purpose);
    }

    /**
     * Send OTP via SMS
     */
    private async sendOtpSms(identifier: string, code: string): Promise<void> {
        // Implement SMS sending logic
        console.log(`Sending SMS OTP ${code} to ${identifier}`);
        // Example: await this.smsService.sendOtp(identifier, code);
    }
}