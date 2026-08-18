import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('two_factor_methods')
@Index(['userId', 'isPrimary'])
@Index(['userId', 'method'])
export class TwoFactorMethod {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ type: 'uuid' })
    userId!: string; // Non-null: Required field

    @Column({
        type: 'enum',
        enum: ['authenticator', 'sms', 'email', 'backup_code'],
        default: 'authenticator'
    })
    method!: string; // Non-null: Has default

    @Column({ length: 255, nullable: true })
    identifier?: string; // Optional: Can be null

    @Column({ length: 255, nullable: true })
    secret?: string; // Optional: Can be null

    @Column({ type: 'jsonb', nullable: true })
    backupCodes?: string[]; // Optional: Can be null

    @Column({ default: false })
    isVerified!: boolean; // Non-null: Has default

    @Column({ type: 'timestamp', nullable: true })
    verifiedAt?: Date; // Optional: Can be null

    @Column({ default: false })
    isPrimary!: boolean; // Non-null: Has default

    @Column({ default: true })
    isActive!: boolean; // Non-null: Has default

    @Column({ type: 'jsonb', nullable: true })
    metadata?: { // Optional: Can be null
        phoneNumber?: string;
        email?: string;
        lastUsedAt?: Date;
        failedAttempts?: number;
    };

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date; // Non-null: Auto-generated

    @ManyToOne(() => User, user => user.twoFactorMethods)
    @JoinColumn({ name: 'userId' })
    user!: User; // Non-null: Always exists

    // Methods
    markAsVerified(): void {
        this.isVerified = true;
        this.verifiedAt = new Date();
    }

    setAsPrimary(): void {
        this.isPrimary = true;
    }

    unsetAsPrimary(): void {
        this.isPrimary = false;
    }

    deactivate(): void {
        this.isActive = false;
    }

    activate(): void {
        this.isActive = true;
    }
}