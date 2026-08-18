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

@Entity('password_resets')
@Index(['token'], { unique: true })
@Index(['userId', 'used'])
@Index(['expiresAt'])
export class PasswordReset {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ type: 'uuid' })
    userId!: string; // Non-null: Required field

    @Column({ length: 500, unique: true })
    token!: string; // Non-null: Required field

    @Column({ default: false })
    used!: boolean; // Non-null: Has default

    @Column({ type: 'timestamp', nullable: true })
    usedAt?: Date | null;

    @Column({ type: 'timestamp' })
    expiresAt!: Date; // Non-null: Required field

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress: string | null; // Optional: Can be null

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent: string | null; // Optional: Can be null

    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        requestedFrom?: string;
        browser?: string;
        os?: string;
    } | null;

    @CreateDateColumn()
    createdAt!: Date; // Non-null: Auto-generated

    @ManyToOne(() => User, user => user.passwordResets)
    @JoinColumn({ name: 'userId' })
    user!: User; // Non-null: Always exists

    // Methods
    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    markAsUsed(): void {
        this.used = true;
        this.usedAt = new Date();
    }
}