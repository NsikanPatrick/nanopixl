import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('email_verifications')
@Index(['token'], { unique: true })
@Index(['userId', 'verified'])
@Index(['expiresAt'])
export class EmailVerification {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ type: 'uuid' })
    userId!: string; // Non-null: Required field

    @Column({ length: 500, unique: true })
    token!: string; // Non-null: Required field

    @Column({ length: 255 })
    email!: string; // Non-null: Required field

    @Column({ default: false })
    verified!: boolean; // Non-null: Has default

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt: Date | null; // Optional: Can be null

    @Column({ type: 'timestamp' })
    expiresAt!: Date; // Non-null: Required field

    @Column({ length: 45, nullable: true })
    ipAddress?: string; // Optional: Can be null

    @Column({ length: 500, nullable: true })
    userAgent?: string; // Optional: Can be null

    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        verificationMethod?: 'email' | 'sms' | 'whatsapp';
        attempts?: number;
        resentCount?: number;
        resentAt?: Date[];
        otpCode?: string;
    };

    @CreateDateColumn()
    createdAt!: Date; // Non-null: Auto-generated

    @ManyToOne(() => User, user => user.emailVerifications)
    @JoinColumn({ name: 'userId' })
    user!: User; // Non-null: Always exists

    // Methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    markAsVerified(): void {
        this.verified = true;
        this.verifiedAt = new Date();
    }

    incrementResendCount(): void {
        if (!this.metadata) this.metadata = {};
        if (!this.metadata.resentCount) this.metadata.resentCount = 0;
        if (!this.metadata.resentAt) this.metadata.resentAt = [];

        this.metadata.resentCount += 1;
        this.metadata.resentAt.push(new Date());
    }
}