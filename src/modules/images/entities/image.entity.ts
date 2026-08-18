// src/modules/images/entities/image.entity.ts
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    Index,
    JoinColumn
} from 'typeorm';
import { User } from '../../../core/auth/entities/user.entity';
import { Generation } from '../../../modules/ai-generation/entities/ai-generation.entity';

@Entity('images')
@Index(['userId', 'hash'])
@Index(['userId', 'createdAt'])
export class Image {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ length: 255 })
    originalName: string;

    @Column({ length: 500 })
    storagePath: string;

    @Column({ length: 500, nullable: true })
    thumbnailPath: string;

    @Column({ length: 500, nullable: true })
    compressedPath: string;

    @Column({ length: 50 })
    mimeType: string;

    @Column({ type: 'int' })
    sizeBytes: number;

    @Column({ type: 'int' })
    width: number;

    @Column({ type: 'int' })
    height: number;

    @Column({ length: 64, unique: true })
    hash: string; // Perceptual hash for deduplication (caching)

    @Column({ type: 'jsonb', nullable: true })
    exifData: {
        orientation?: number;
        make?: string;
        model?: string;
        dateTaken?: string;
        gps?: { lat: number; lng: number };
        [key: string]: any;
    };

    @Column({ type: 'jsonb', nullable: true })
    processingData: {
        orientationCorrected?: boolean;
        compressed?: boolean;
        cropApplied?: boolean;
        cropCoordinates?: { x: number; y: number; width: number; height: number };
    };

    @Column({ default: false })
    isProcessed: boolean;

    @Column({ nullable: true })
    processedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => User, user => user.images)
    @JoinColumn({ name: 'userId' })
    user: User;

    @OneToMany(() => Generation, generation => generation.primaryImage)
    primaryGenerations: Generation[];

    @OneToMany(() => GenerationImage, generationImage => generationImage.image)
    generationImages: GenerationImage[];
}



@Entity('generation_images')
@Index(['generationId', 'imageId'])
export class GenerationImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    generationId: string;

    @Column({ type: 'uuid' })
    imageId: string;

    @Column({ type: 'int', default: 0 })
    order: number;

    @Column({ type: 'boolean', default: false })
    isPrimary: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Generation, generation => generation.generationImages)
    @JoinColumn({ name: 'generationId' })
    generation: Generation;

    @ManyToOne(() => Image, image => image.generationImages)
    @JoinColumn({ name: 'imageId' })
    image: Image;
}