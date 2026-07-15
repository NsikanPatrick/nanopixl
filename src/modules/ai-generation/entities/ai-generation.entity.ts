
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    OneToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../../core/users/entities/user.entity';
import { Image } from '../../images/entities/image.entity';
import { GenerationImage } from '../../images/entities/image.entity';
import { Draft } from '../../drafts/entities/draft.entity';
import { History } from '../../history/entities/history.entity';
import { BatchJobItem } from '../../batch/entities/batch-job.entity';

@Entity('generations')
@Index(['userId', 'createdAt'])
@Index(['userId', 'tone', 'platform'])
@Index(['productName'])
export class Generation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    primaryImageId: string;

    @Column({ length: 255 })
    productName: string;

    @Column({ type: 'text', nullable: true })
    productFeatures: string; // JSON string of bullet points

    @Column({ type: 'text', nullable: true })
    targetAudience: string;

    @Column({ type: 'text', nullable: true })
    materialsUsed: string;

    @Column({ type: 'text', nullable: true })
    styleTags: string; // JSON array of tags

    @Column({ type: 'text', nullable: true })
    keywords: string; // JSON array of keywords

    @Column({ type: 'text', nullable: true })
    optimizedDescription: string;

    @Column({ length: 255, nullable: true })
    seoTitle: string;

    @Column({ length: 255, nullable: true })
    urlSlug: string;

    @Column({
        type: 'enum',
        enum: ['professional', 'playful', 'luxury', 'minimalist', 'friendly']
    })
    tone: string;

    @Column({
        type: 'enum',
        enum: ['ebay', 'etsy', 'amazon', 'shopify', 'woocommerce']
    })
    platform: string;

    @Column({ length: 10 })
    language: string; // 'en-US', 'en-UK', 'es', 'de', 'fr', etc.

    @Column({ type: 'jsonb', nullable: true })
    platformSpecificData: {
        ebay?: {
            categoryId?: string;
            condition?: string;
            duration?: string;
            paymentMethods?: string[];
        };
        etsy?: {
            categoryId?: string;
            isDigital?: boolean;
            processingTime?: string;
        };
        amazon?: {
            categoryId?: string;
            condition?: string;
            fulfillmentType?: string;
        };
        shopify?: {
            productType?: string;
            vendor?: string;
            tags?: string[];
        };
        woocommerce?: {
            categoryIds?: number[];
            stockStatus?: string;
            shippingClass?: string;
        };
    };

    @Column({ type: 'jsonb', nullable: true })
    seoData: {
        keywordDifficulty?: number;
        searchVolumeHints?: string[];
        trends?: string[];
        holidays?: string[];
        localization?: {
            currency?: string;
            unitSystem?: 'metric' | 'imperial';
            dateFormat?: string;
        };
    };

    @Column({ type: 'jsonb', nullable: true })
    variations: {
        title?: string[];
        description?: string[];
        features?: string[][];
    };

    @Column({ type: 'jsonb', nullable: true })
    competitiveAnalysis: {
        competitorASINs?: string[];
        differentiators?: string[];
        marketGaps?: string[];
        suggestions?: string[];
    };

    @Column({ default: false })
    isDraft: boolean;

    @Column({ default: false })
    isPublished: boolean;

    @Column({ nullable: true })
    publishedAt: Date;

    @Column({ nullable: true })
    publishedPlatformId: string;

    @Column({ type: 'jsonb', nullable: true })
    regenerationHistory: {
        field: string;
        previousValue: string;
        newValue: string;
        regeneratedAt: Date;
    }[];

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        processingTime?: number;
        tokensUsed?: number;
        aiProvider?: string;
        modelVersion?: string;
        temperature?: number;
        confidenceScore?: number;
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.generations)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Image)
    @JoinColumn({ name: 'primaryImageId' })
    primaryImage: Image;

    @OneToMany(() => GenerationImage, generationImage => generationImage.generation)
    generationImages: GenerationImage[];

    @OneToMany(() => Draft, draft => draft.generation)
    drafts: Draft[];

    @OneToMany(() => History, history => history.generation)
    historyEntries: History[];

    @OneToMany(() => BatchJobItem, batchItem => batchItem.generation)
    batchItems: BatchJobItem[];
}