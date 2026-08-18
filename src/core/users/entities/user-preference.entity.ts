import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('user_preferences')
@Index(['userId'], { unique: true })
export class UserPreference {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ type: 'uuid' })
    userId!: string; // Non-null: Required field

    @Column({ type: 'jsonb', default: {} })
    uiPreferences!: { // Non-null: Has default
        theme?: 'light' | 'dark' | 'system';
        language?: string;
        defaultTone?: string;
        defaultPlatform?: string;
        notificationsEnabled?: boolean;
        // NEW: Additional UI preferences
        timezone?: string;
        dateFormat?: string;
        timeFormat?: '12h' | '24h';
        sidebarCollapsed?: boolean;
        fontSize?: 'small' | 'medium' | 'large';
        compactMode?: boolean;
        animations?: boolean;
    };

    @Column({ type: 'jsonb', default: {} })
    defaultSettings!: { // Non-null: Has default
        tone?: string;
        platform?: string;
        language?: string;
        maxImages?: number;
        autoSave?: boolean;
        // Additional defaults
        exportFormat?: 'json' | 'csv' | 'pdf';
        descriptionLength?: 'short' | 'medium' | 'long';
        includeAudience?: boolean;
        includeMaterials?: boolean;
        includeTags?: boolean;
        includeKeywords?: boolean;
    };

    @Column({ type: 'jsonb', default: {} })
    apiPreferences!: { // Non-null: Has default
        aiProvider?: 'openai' | 'anthropic' | 'custom';
        modelVersion?: string;
        temperature?: number;
        // Additional API preferences
        maxTokens?: number;
        timeout?: number;
        retryAttempts?: number;
    };

    // NEW: Notification preferences
    @Column({ type: 'jsonb', default: {} })
    notificationPreferences!: { // Non-null: Has default
        email?: {
            marketing?: boolean;
            productUpdates?: boolean;
            securityAlerts?: boolean;
            weeklyDigest?: boolean;
            generationCompleted?: boolean;
            batchCompleted?: boolean;
        };
        push?: {
            enabled?: boolean;
            generationCompleted?: boolean;
            securityAlerts?: boolean;
        };
        inApp?: {
            enabled?: boolean;
            generationCompleted?: boolean;
            batchCompleted?: boolean;
            systemAlerts?: boolean;
        };
    };

    // NEW: Security preferences
    @Column({ type: 'jsonb', default: {} })
    securityPreferences!: { // Non-null: Has default
        twoFactorEnabled?: boolean;
        twoFactorMethod?: 'authenticator' | 'sms' | 'email';
        sessionTimeout?: number; // in minutes
        maxSessions?: number;
        loginNotifications?: boolean;
        deviceManagement?: {
            rememberDevices?: boolean;
            maxDevices?: number;
        };
    };

    @CreateDateColumn()
    createdAt!: Date; // Non-null: Auto-generated

    @UpdateDateColumn()
    updatedAt!: Date; // Non-null: Auto-generated

    @OneToOne(() => User, user => user.preferences)
    @JoinColumn({ name: 'userId' })
    user!: User; // Non-null: Always exists
}