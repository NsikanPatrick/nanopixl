
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

@Entity('platform_connections')
@Index(['userId', 'platform'], { unique: true })
@Index(['platform', 'platformUserId'])
export class PlatformConnection {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({
        type: 'enum',
        enum: ['ebay', 'etsy', 'amazon', 'shopify', 'woocommerce']
    })
    platform: string;

    @Column({ length: 255 })
    platformUserId: string;

    @Column({ length: 255, nullable: true })
    platformUsername: string;

    @Column({ type: 'jsonb' })
    credentials: {
        accessToken?: string;
        refreshToken?: string;
        apiKey?: string;
        apiSecret?: string;
        storeId?: string;
        shopifyDomain?: string;
        woocommerceUrl?: string;
        consumerKey?: string;
        consumerSecret?: string;
        expiresAt?: Date;
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    settings: {
        autoPublish?: boolean;
        defaultCategory?: string;
        defaultCondition?: string;
        shippingProfile?: string;
        returnPolicy?: string;
        [key: string]: any;
    };

    @Column({ default: true })
    isActive: boolean;

    @Column({ nullable: true })
    lastSyncedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        apiVersion?: string;
        rateLimit?: {
            remaining: number;
            resetAt: Date;
        };
        [key: string]: any;
    };

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.platformConnections)
    @JoinColumn({ name: 'userId' })
    user: User;
}