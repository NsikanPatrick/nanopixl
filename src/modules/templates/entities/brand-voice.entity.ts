
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../../core/users/entities/user.entity';

@Entity('brand_voices')
@Index(['userId'], { unique: true })
export class BrandVoice {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', unique: true })
    userId: string;

    @Column({ length: 255 })
    brandName: string;

    @Column({ type: 'text', nullable: true })
    brandDescription: string;

    @Column({ type: 'jsonb', default: {} })
    voiceAttributes: {
        tone?: 'formal' | 'casual' | 'playful' | 'professional' | 'friendly';
        personality?: string[];
        values?: string[];
        targetAudience?: string;
        uniqueSellingPoints?: string[];
    };

    @Column({ type: 'jsonb', default: {} })
    writingStyle: {
        useEmojis?: boolean;
        useJargon?: boolean;
        sentenceLength?: 'short' | 'medium' | 'long';
        formality?: 'formal' | 'informal' | 'neutral';
        inclusivity?: boolean;
        [key: string]: any;
    };

    @Column({ type: 'jsonb', default: {} })
    vocabulary: {
        preferredWords?: string[];
        avoidWords?: string[];
        industryTerms?: string[];
        customTerms?: Record<string, string>;
    };

    @Column({ type: 'jsonb', default: {} })
    formatting: {
        useBulletPoints?: boolean;
        useBoldText?: boolean;
        useItalics?: boolean;
        headingStyle?: string;
    };

    @Column({ type: 'jsonb', nullable: true })
    examples: {
        goodExample?: string;
        badExample?: string;
        [key: string]: any;
    };

    @Column({ default: false })
    isActive: boolean;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(() => User, user => user.brandVoice)
    @JoinColumn({ name: 'userId' })
    user: User;
}