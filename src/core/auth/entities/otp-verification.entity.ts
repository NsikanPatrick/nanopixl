import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';

@Entity('otp_verifications')
@Index(['identifier', 'code'], { unique: true })
@Index(['expiresAt'])
@Index(['used'])
export class OtpVerification {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    // Who is this OTP for? (email, phone, or user ID)
    @Column({ type: 'varchar', length: 255 })
    identifier!: string; // e.g., "john@example.com", "+1234567890", "user_123"

    // The actual 6-digit code
    @Column({ type: 'varchar', length: 10 })
    code!: string; // e.g., "123456"

    // What is this OTP for?
    @Column({
        type: 'enum',
        enum: [
            'email_verification',   // Verify email address
            'password_reset',       // Reset password
            'login',               // Login without password
            'phone_verification',  // Verify phone number
            'two_factor_setup',    // Setup 2FA
        ],
        default: 'email_verification'
    })
    purpose!: string;

    // Has this OTP been used?
    @Column({ type: 'boolean', default: false })
    used!: boolean;

    // When was it used?
    @Column({ type: 'timestamp', nullable: true })
    usedAt?: Date;

    // When does this OTP expire?
    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    // Additional metadata
    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        attempts?: number;        // How many times tried
        ipAddress?: string;       // IP that requested the OTP
        userAgent?: string;       // Browser/device info
        resentCount?: number;     // How many times resent
        resentAt?: Date[];        // When it was resent
        deviceId?: string;        // Device identifier
    };

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    // Methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    markAsUsed(): void {
        this.used = true;
        this.usedAt = new Date();
    }

    incrementAttempts(): void {
        if (!this.metadata) this.metadata = {};
        if (!this.metadata.attempts) this.metadata.attempts = 0;
        this.metadata.attempts += 1;
    }

    incrementResendCount(): void {
        if (!this.metadata) this.metadata = {};
        if (!this.metadata.resentCount) this.metadata.resentCount = 0;
        if (!this.metadata.resentAt) this.metadata.resentAt = [];

        this.metadata.resentCount += 1;
        this.metadata.resentAt.push(new Date());
    }

    hasMaxAttempts(maxAttempts: number = 3): boolean {
        return (this.metadata?.attempts || 0) >= maxAttempts;
    }

    hasMaxResends(maxResends: number = 5): boolean {
        return (this.metadata?.resentCount || 0) >= maxResends;
    }
}