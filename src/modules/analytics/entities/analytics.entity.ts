
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index
} from 'typeorm';

@Entity('analytics_events')
@Index(['userId', 'eventType', 'createdAt'])
@Index(['sessionId'])
export class AnalyticsEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true })
    userId: string;

    @Column({ length: 100 })
    eventType: string; // 'generation_created', 'image_uploaded', 'export_downloaded', etc.

    @Column({ type: 'jsonb' })
    properties: {
        tone?: string;
        platform?: string;
        language?: string;
        imagesCount?: number;
        processingTime?: number;
        tokensUsed?: number;
        errorType?: string;
        [key: string]: any;
    };

    @Column({ length: 255, nullable: true })
    sessionId: string;

    @Column({ length: 45, nullable: true })
    ipAddress: string;

    @Column({ length: 255, nullable: true })
    userAgent: string;

    @Column({ length: 50, nullable: true })
    referrer: string;

    @Column({ type: 'jsonb', nullable: true })
    context: {
        page?: string;
        component?: string;
        action?: string;
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;
}