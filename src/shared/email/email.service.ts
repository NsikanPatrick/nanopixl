import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly resend: Resend;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('RESEND_API_KEY');
        if (!apiKey) {
            this.logger.warn('RESEND_API_KEY is not set. Emails will not be sent.');
        }
        this.resend = new Resend(apiKey);
    }

    async sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
        const fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'NanoPixl';
        const fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS') || 'onboarding@resend.dev';
        const from = `${fromName} <${fromAddress}>`;

        const subjectMap: Record<string, string> = {
            email_verification: 'Verify your NanoPixl account',
            password_reset: 'Reset your NanoPixl password',
            login: 'Your NanoPixl login code',
        };
        
        const subject = subjectMap[purpose] || 'Your verification code';

        try {
            const { error } = await this.resend.emails.send({
                from,
                to,
                subject,
                html: `
          <h2>Your Verification Code</h2>
          <p>Use the code below to complete your request:</p>
          <h1 style="letter-spacing: 4px; font-size: 32px;">${code}</h1>
          <p>This code expires in 15 minutes. If you didn't request this, you can safely ignore this email.</p>
        `,
            });

            if (error) {
                this.logger.error(`Failed to send OTP email to ${to}: ${error.message}`);
                throw new Error(error.message);
            }

            this.logger.log(`OTP email sent to ${to} for ${purpose}`);
        } catch (err) {
            this.logger.error(`Error sending OTP email to ${to}`, err);
            throw err;
        }
    }
}