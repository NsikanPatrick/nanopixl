
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../../core/users/entities/user.entity';
import { Generation } from '../../../modules/ai-generation/entities/ai-generation.entity';

@Entity('history')
@Index(['userId', 'createdAt'])
@Index(['userId', 'generationId'])
@Index(['searchTerms'], { type: 'gin' }) // For full-text search
export class History {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    generationId: string;

    @Column({ type: 'jsonb' })
    snapshot: {
        productName: string;
        tone: string;
        platform: string;
        language: string;
        features: string[];
        audience: string;
        materials: string;
        tags: string[];
        keywords: string[];
        description: string;
        seoTitle: string;
    };

    @Column({ type: 'jsonb', nullable: true })
    searchTerms: string[]; // For search functionality

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        imagesCount?: number;
        processingTime?: number;
        aiProvider?: string;
        tokensUsed?: number;
        actions?: {
            type: 'created' | 'regenerated' | 'exported' | 'published';
            details?: any;
        }[];
        [key: string]: any;
    };

    @Column({ default: 0 })
    version: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User, user => user.history)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Generation, generation => generation.historyEntries)
    @JoinColumn({ name: 'generationId' })
    generation: Generation;
}