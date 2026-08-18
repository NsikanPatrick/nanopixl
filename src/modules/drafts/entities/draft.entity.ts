
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
import { Generation } from '../../ai-generation/entities/ai-generation.entity';

@Entity('drafts')
@Index(['userId', 'generationId'])
@Index(['userId', 'createdAt'])
export class Draft {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    generationId: string;

    @Column({ length: 255 })
    name: string;

    @Column({ type: 'jsonb' })
    content: {
        productName: string;
        productFeatures: string[];
        targetAudience: string;
        materialsUsed: string;
        styleTags: string[];
        keywords: string[];
        optimizedDescription: string;
        seoTitle: string;
        urlSlug?: string;
        platformSpecificData?: any;
        seoData?: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    originalGeneration: Record<string, any>; // Snapshot of original generation

    @Column({ type: 'jsonb', nullable: true })
    edits: {
        field: string;
        originalValue: any;
        editedValue: any;
        editedAt: Date;
    }[];

    @Column({
        type: 'enum',
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    })
    status: string;

    @Column({ nullable: true })
    publishedAt: Date;

    @Column({ nullable: true })
    publishedPlatformId: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.drafts)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Generation, generation => generation.drafts)
    @JoinColumn({ name: 'generationId' })
    generation: Generation;
}