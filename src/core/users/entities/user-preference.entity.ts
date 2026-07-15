import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'jsonb', default: {} })
    uiPreferences: {
        theme?: 'light' | 'dark' | 'system';
        language?: string;
        defaultTone?: string;
        defaultPlatform?: string;
        notificationsEnabled?: boolean;
    };

    @Column({ type: 'jsonb', default: {} })
    defaultSettings: {
        tone?: string;
        platform?: string;
        language?: string;
        maxImages?: number;
        autoSave?: boolean;
    };

    @Column({ type: 'jsonb', default: {} })
    apiPreferences: {
        aiProvider?: 'openai' | 'anthropic' | 'custom';
        modelVersion?: string;
        temperature?: number;
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;
}