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

@Entity('user_login_history')
@Index(['userId', 'createdAt'])
@Index(['ipAddress'])
@Index(['isSuccessful'])
export class UserLoginHistory {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ type: 'uuid' })
    userId!: string; // Non-null: Required field

    @Column({ type: 'varchar', length: 45, nullable: true })
    ipAddress?: string; // Optional: Can be null

    @Column({ type: 'varchar', length: 500, nullable: true })
    userAgent?: string; // Optional: Can be null

    @Column({ length: 255, nullable: true })
    deviceId?: string; // Optional: Can be null

    @Column({ length: 255, nullable: true })
    location?: string; // Optional: Can be null

    @Column({
        type: 'enum',
        enum: ['email', 'google', 'facebook', 'github', 'apple', 'refresh_token'],
        default: 'email'
    })
    loginMethod!: string; // Non-null: Has default

    @Column({ default: true })
    isSuccessful!: boolean; // Non-null: Has default

    @Column({ length: 255, nullable: true })
    failureReason?: string; // Optional: Can be null

    @Column({ type: 'jsonb', nullable: true })
    metadata?: {
        browser?: string;
        os?: string;
        screenResolution?: string;
        timezone?: string;
        language?: string;
    };

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date; // Non-null: Auto-generated

    @ManyToOne(() => User, user => user.loginHistory)
    @JoinColumn({ name: 'userId' })
    user!: User; // Non-null: Always exists

    // Static factory methods
    static createSuccess(userId: string, data: Partial<UserLoginHistory>): UserLoginHistory {
        const history = new UserLoginHistory();
        history.userId = userId;
        history.isSuccessful = true;
        history.ipAddress = data?.ipAddress;
        history.userAgent = data?.userAgent;
        history.deviceId = data?.deviceId;
        history.location = data?.location;
        history.loginMethod = data?.loginMethod || 'email';
        history.metadata = data?.metadata;
        return history;
    }

    static createFailure(userId: string, reason: string, data: Partial<UserLoginHistory>): UserLoginHistory {
        const history = new UserLoginHistory();
        history.userId = userId;
        history.isSuccessful = false;
        history.failureReason = reason;
        history.ipAddress = data?.ipAddress;
        history.userAgent = data?.userAgent;
        history.deviceId = data?.deviceId;
        history.location = data?.location;
        history.loginMethod = data?.loginMethod || 'email';
        history.metadata = data?.metadata;
        return history;
    }
}