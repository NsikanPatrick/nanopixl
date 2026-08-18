// src/modules/auth/entities/refresh-token.entity.ts
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

@Entity('refresh_tokens')
@Index(['token'], { unique: true })
@Index(['userId', 'revoked'])
@Index(['expiresAt'])
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar', length: 500, unique: true })
    token!: string;


    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        deviceId?: string;
        deviceName?: string;
        location?: string;
        createdAt?: string;
        lastUsedIp?: string;
        lastUsedAt?: string;
        usageCount?: number;
    };

    @Column({ type: 'boolean', default: false })
    revoked!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    revokedAt?: Date | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    revokedReason?: string | null;

    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date;

    @ManyToOne(() => User, user => user.refreshTokens)
    @JoinColumn({ name: 'userId' })
    user!: User;

    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    revoke(reason?: string): void {
        this.revoked = true;
        this.revokedAt = new Date();
        this.revokedReason = reason || 'Revoked by user';
    }
}