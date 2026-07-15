
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

@Entity('export_records')
@Index(['userId', 'createdAt'])
@Index(['exportType'])
export class ExportRecord {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    generationId: string;

    @Column({ type: 'jsonb', nullable: true })
    generationIds: string[]; // For batch exports

    @Column({
        type: 'enum',
        enum: ['json', 'csv', 'pdf', 'shopify_csv', 'plain_text']
    })
    exportType: string;

    @Column({ length: 255 })
    fileName: string;

    @Column({ length: 500 })
    filePath: string;

    @Column({ type: 'int' })
    fileSize: number;

    @Column({ type: 'jsonb', nullable: true })
    exportOptions: {
        includeImages?: boolean;
        includeMetadata?: boolean;
        format?: string;
        compression?: string;
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    content: {
        productName?: string;
        features?: string[];
        description?: string;
        [key: string]: any;
    };

    @Column({ default: 0 })
    downloadCount: number;

    @Column({ nullable: true })
    lastDownloadedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Generation)
    @JoinColumn({ name: 'generationId' })
    generation: Generation;
}