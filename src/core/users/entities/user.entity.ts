// src/modules/users/entities/user.entity.ts
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    OneToOne,
    Index
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Image } from '../../../modules/images/entities/image.entity';
import { Generation } from '../../../modules/ai-generation/entities/ai-generation.entity';
import { Draft } from '../../../modules/drafts/entities/draft.entity';
import { Template } from '../../../modules/templates/entities/template.entity';
import { BrandVoice } from '../../../modules/templates/entities/brand-voice.entity';
import { PlatformConnection } from '../../../modules/platforms/entities/platform-connection.entity';
import { History } from '../../../modules/history/entities/history.entity';
import { BatchJob } from '../../../modules/batch/entities/batch-job.entity';
import { UserPreference } from './user-preference.entity';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    username: string;

    @Column({ length: 255, unique: true })
    email: string;

    @Column({ length: 255 })
    @Exclude()
    passwordHash: string;

    @Column({ length: 100, nullable: true })
    firstName: string;

    @Column({ length: 100, nullable: true })
    lastName: string;

    @Column({
        type: 'enum',
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    })
    subscriptionTier: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ nullable: true })
    lastLoginAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Image, image => image.user)
    images: Image[];

    @OneToMany(() => Generation, generation => generation.user)
    generations: Generation[];

    @OneToMany(() => Draft, draft => draft.user)
    drafts: Draft[];

    @OneToMany(() => Template, template => template.user)
    templates: Template[];

    @OneToOne(() => BrandVoice, brandVoice => brandVoice.user)
    brandVoice: BrandVoice;

    @OneToMany(() => PlatformConnection, connection => connection.user)
    platformConnections: PlatformConnection[];

    @OneToMany(() => History, history => history.user)
    history: History[];

    @OneToMany(() => BatchJob, batchJob => batchJob.user)
    batchJobs: BatchJob[];

    @OneToOne(() => UserPreference, preference => preference.user)
    preferences: UserPreference;
}

