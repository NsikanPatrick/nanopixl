
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../../core/auth/entities/user.entity';

@Entity('templates')
@Index(['userId', 'name'], { unique: true })
@Index(['userId', 'isDefault'])
export class Template {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

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
    language: string;

    @Column({ type: 'jsonb' })
    settings: {
        maxFeatures?: number;
        minFeatures?: number;
        includeAudience?: boolean;
        includeMaterials?: boolean;
        includeTags?: boolean;
        includeKeywords?: boolean;
        descriptionLength?: 'short' | 'medium' | 'long';
        seoOptimization?: boolean;
        customInstructions?: string;
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    promptOverrides: {
        productName?: string;
        features?: string;
        description?: string;
        keywords?: string;
        [key: string]: any;
    };

    @Column({ default: false })
    isDefault: boolean;

    @Column({ default: 0 })
    usageCount: number;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.templates)
    @JoinColumn({ name: 'userId' })
    user: User;
}