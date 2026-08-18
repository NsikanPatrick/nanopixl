// src/modules/batch/entities/batch-job.entity.ts
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index
} from 'typeorm';
import { User } from '../../../core/auth/entities/user.entity';
import { Generation } from '../../../modules/ai-generation/entities/ai-generation.entity';

@Entity('batch_jobs')
@Index(['userId', 'createdAt'])
@Index(['status'])
export class BatchJob {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ length: 255 })
    name: string;

    @Column({
        type: 'enum',
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled']
    })
    status: string;

    @Column({ type: 'jsonb' })
    config: {
        tone: string;
        platform: string;
        language: string;
        settings: {
            maxFeatures?: number;
            descriptionLength?: string;
            includeAudience?: boolean;
            includeMaterials?: boolean;
            includeTags?: boolean;
            includeKeywords?: boolean;
            seoOptimization?: boolean;
        };
    };

    @Column({ type: 'int', default: 0 })
    totalItems: number;

    @Column({ type: 'int', default: 0 })
    processedItems: number;

    @Column({ type: 'int', default: 0 })
    successfulItems: number;

    @Column({ type: 'int', default: 0 })
    failedItems: number;

    @Column({ type: 'jsonb', nullable: true })
    inputData: {
        csvFile?: string;
        imageFolder?: string;
        productList?: any[];
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    results: {
        exportFile?: string;
        summary?: {
            totalGenerations: number;
            averageProcessingTime: number;
            mostCommonTone?: string;
            errors?: string[];
        };
        [key: string]: any;
    };

    @Column({ nullable: true })
    startedAt: Date;

    @Column({ nullable: true })
    completedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.batchJobs)
    @JoinColumn({ name: 'userId' })
    user: User;

    @OneToMany(() => BatchJobItem, item => item.batchJob)
    items: BatchJobItem[];
}

@Entity('batch_job_items')
@Index(['batchJobId', 'status'])
export class BatchJobItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    batchJobId: string;

    @Column({ type: 'uuid', nullable: true })
    generationId: string;

    @Column({ type: 'int' })
    rowIndex: number;

    @Column({ type: 'jsonb' })
    input: {
        productName?: string;
        imageId?: string;
        imagePath?: string;
        additionalData?: any;
    };

    @Column({
        type: 'enum',
        enum: ['pending', 'processing', 'completed', 'failed']
    })
    status: string;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @Column({ type: 'jsonb', nullable: true })
    result: {
        generationId?: string;
        productName?: string;
        features?: string[];
        description?: string;
        [key: string]: any;
    };

    @Column({ nullable: true })
    processedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => BatchJob, batchJob => batchJob.items)
    @JoinColumn({ name: 'batchJobId' })
    batchJob: BatchJob;

    @ManyToOne(() => Generation)
    @JoinColumn({ name: 'generationId' })
    generation: Generation;
}