// src/modules/auth/entities/user-session.entity.ts
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

@Entity('user_sessions')
@Index(['userId', 'sessionToken'], { unique: true })
@Index(['userId', 'isActive'])
@Index(['expiresAt'])
export class UserSession {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    userId!: string;

    @Column({ type: 'varchar', length: 500 })
    sessionToken!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    deviceId?: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    deviceName?: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    deviceType?: string | null;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent?: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    location?: string | null;

    @Column({ type: 'boolean', default: true })
    isActive!: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt?: Date | null;

    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        browser?: string;
        os?: string;
        screenResolution?: string;
        language?: string;
        timezone?: string;
    } | null;

    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date;

    @ManyToOne(() => User, user => user.sessions)
    @JoinColumn({ name: 'userId' })
    user!: User;

    isExpired(): boolean {
        return new Date() > this.expiresAt;
    }

    extendSession(days: number = 7): void {
        this.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        this.lastActivityAt = new Date();
    }

    revoke(): void {
        this.isActive = false;
    }
}