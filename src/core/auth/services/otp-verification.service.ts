import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { EmailService } from '../../../shared/email/email.service';
import { OtpVerification } from '../entities/otp-verification.entity';

@Injectable()
export class OtpVerificationService {
    constructor(
        @InjectRepository(OtpVerification)
        private otpRepository: Repository<OtpVerification>,
        private emailService: EmailService,
        // private smsService: smsService, // Optional
    ) { }

    /** Generate and send an OTP for verification */
    async generateOtp(
        identifier: string,
        purpose: string,
        options?: {
            length?: number;
            expiresIn?: number; // in minutes
            sendEmail?: boolean;
            // sendSms?: boolean;
        }
    ): Promise<{ code: string; otp: OtpVerification }> {
        // ==================== RATE LIMITING (Sliding Window) ====================
        // Two-layer protection:
        // Can only send a max of 3 OTPs in a min and a max of 10 within an hour, any request higher than that is blocked
        //   - Short burst:  max 3 OTPs per minute  (blocks rapid re-request spam)
        //   - Sustained:    max 10 OTPs per hour   (blocks slow-drip abuse / enumeration)

        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // This gave errors because the typeORM's MoreThan() needed the timezone to be set at the db level as there's a 1 hour drift between local machine time and the remote db's UTC timezone
        // Solution: set the timezone at the db table level => @CreateDateColumn({ type: 'timestamptz' }) in the otp-verifications table, it's currently timestamp not timestamptz

        // const [lastMinuteCount, lastHourCount] = await Promise.all([
        //     // The two count queries below are independent — running them in parallel with Promise.all cuts latency at least by half compared to awaiting them sequentially.
        //     this.otpRepository.count({
        //         where: {
        //             identifier,
        //             purpose,
        //             createdAt: MoreThan(oneMinuteAgo), // Count only the ones sent within the last minute, not the ones before that
        //         },
        //     }),
        //     this.otpRepository.count({
        //         where: {
        //             identifier,
        //             purpose,
        //             createdAt: MoreThan(oneHourAgo), // Count only the ones sent within the last hour
        //         },
        //     }),
        // ]);

        // Same as above, but now makes use of raw SQL. It now works because everything now runs directly in postgres on the same clock. No serialization, no timezone mismatch.
        const [lastMinuteCount, lastHourCount] = await Promise.all([
            this.otpRepository
                .createQueryBuilder('otp')
                .where('otp.identifier = :identifier', { identifier })
                .andWhere('otp.purpose = :purpose', { purpose })
                .andWhere("otp.createdAt > NOW() - INTERVAL '1 minute'")
                .getCount(),
            this.otpRepository
                .createQueryBuilder('otp')
                .where('otp.identifier = :identifier', { identifier })
                .andWhere('otp.purpose = :purpose', { purpose })
                .andWhere("otp.createdAt > NOW() - INTERVAL '1 hour'")
                .getCount(),
        ]);

        console.log('[OTP RATE LIMIT DEBUG]', {
            identifier,
            purpose,
            oneMinuteAgo: oneMinuteAgo.toISOString(),
            oneHourAgo: oneHourAgo.toISOString(),
            now: new Date().toISOString(),
            lastMinuteCount,
            lastHourCount,
        });

        if (lastMinuteCount >= 3) {
            throw new HttpException(
                'Too many OTP requests. Please wait a minute and try again.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        if (lastHourCount >= 10) {
            throw new HttpException(
                'Too many OTP requests. Please try again later.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        // ONE LAYER PROTECTION - BY MINUTE
        // The above already handles both, so this code is only for references
        // async generateOtp(
        //     identifier: string,
        //     purpose: string,
        //     options?: {
        //         length?: number;
        //         expiresIn?: number; // in minutes
        //         sendEmail?: boolean;
        //         // sendSms?: boolean;
        //     }
        // ): Promise<{ code: string; otp: OtpVerification }> {
        //     // Rate limiting - count the number of otps generated within the last minute

        //     //  Count OTPs created in the LAST 60 seconds. Excluding all d previous ones before the last minute
        //     const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

        //     const recentOtps = await this.otpRepository.count({
        //         where: {
        //             identifier,
        //             purpose,
        //             createdAt: MoreThan(oneMinuteAgo), // Last 1 minute
        //         },
        //     });

        //     // Through a 429 exception if d number of otps generated within d last min is more than 3 
        //     if (recentOtps >= 3) {
        //         // Using HttpException with 429 status code
        //         throw new HttpException(
        //             'Too many OTP requests. Please wait a moment.',
        //             HttpStatus.TOO_MANY_REQUESTS
        //         );

        //         // Other Options of throwing the same error
        //         // Using ThrottlerException (if using @nestjs/throttler)
        //         // throw new ThrottlerException('Too many OTP requests. Please wait a moment.');
        //     }

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
        // if (options?.sendSms) {
        //     await this.sendOtpSms(identifier, code);
        // }

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

    /** Send OTP via email */
    private async sendOtpEmail(identifier: string, code: string, purpose: string): Promise<void> {
        // Implement email sending logic via d eamil service => shared/email/email.service
        await this.emailService.sendOtpEmail(identifier, code, purpose);
    }

    /** Send OTP via SMS */
    private async sendOtpSms(identifier: string, code: string): Promise<void> {
        // Implement SMS sending logic
        console.log(`Sending SMS OTP ${code} to ${identifier}`);
        // Example: await this.smsService.sendOtp(identifier, code);
    }
}