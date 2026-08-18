import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    OneToOne,
    Index,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { Image } from '../../../modules/images/entities/image.entity';
import { Generation } from '../../../modules/ai-generation/entities/ai-generation.entity';
import { Draft } from '../../../modules/drafts/entities/draft.entity';
import { Template } from '../../../modules/templates/entities/template.entity';
import { BrandVoice } from '../../../modules/templates/entities/brand-voice.entity';
import { PlatformConnection } from '../../../modules/platforms/entities/platform-connection.entity';
import { History } from '../../../modules/history/entities/history.entity';
import { BatchJob } from '../../../modules/batch/entities/batch-job.entity';
import { UserPreference } from '../../users/entities/user-preference.entity';
// Import Auth entities
import { RefreshToken } from './refresh-token.entity';
import { UserSession } from './user-session.entity';
import { PasswordReset } from './password-reset.entity';
import { EmailVerification } from './email-verification.entity';
import { OtpVerification } from './otp-verification.entity';
import { UserLoginHistory } from './user-login-history.entity';
import { TwoFactorMethod } from './two-factor-method.entity';

export enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
    SUPER_ADMIN = 'super_admin',
    MODERATOR = 'moderator',
}

export enum AccountStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    PENDING_VERIFICATION = 'pending_verification',
    SUSPENDED = 'suspended',
}


@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
@Index(['isActive', 'email'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Always generated

    @Column({ length: 100 })
    username!: string; // Non-null: Required field

    @Column({ length: 255, unique: true })
    email!: string; // Non-null: Required field

    @Column({ length: 255 })
    @Exclude()
    passwordHash!: string; // Non-null: Required field

    @Column({ length: 100, nullable: true })
    firstName?: string; // Optional: Can be null

    @Column({ length: 100, nullable: true })
    lastName?: string; // Optional: Can be null

    // NEW: Added avatar URL for user profile
    @Column({ length: 255, nullable: true })
    avatarUrl?: string; // Optional: Can be null

    // NEW: Added OAuth support
    @Column({
        type: 'enum',
        enum: ['email', 'google', 'facebook', 'github', 'apple'],
        default: 'email'
    })
    provider!: string; // Non-null: Has default

    // NEW: OAuth provider ID
    @Column({ nullable: true })
    providerId?: string; // Optional: Can be null

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER
    })
    role!: UserRole;

    @Column({
        type: 'enum',
        enum: AccountStatus,
        default: AccountStatus.PENDING_VERIFICATION
    })
    status!: AccountStatus;

    @Column({
        type: 'enum',
        enum: ['free', 'pro', 'enterprise'],
        default: 'free'
    })
    subscriptionTier!: string; // Non-null: Has default

    @Column({ default: true })
    isActive!: boolean; // Non-null: Has default

    // NEW: Email verification status
    @Column({ default: false })
    isEmailVerified!: boolean; // Non-null: Has default

    // NEW: Two-factor authentication status
    @Column({ default: false })
    isTwoFactorEnabled!: boolean; // Non-null: Has default

    // NEW: Two-factor secret (encrypted)
    @Column({ nullable: true })
    twoFactorSecret?: string; // Optional: Can be null

    // NEW: Two-factor backup codes (encrypted)
    @Column({ type: 'jsonb', nullable: true })
    twoFactorBackupCodes?: string[]; // Optional: Can be null

    @Column({ type: 'timestamp', nullable: true })
    lastLoginAt?: Date; // Optional: Can be null

    // NEW: Last login IP for security
    @Column({ nullable: true })
    lastLoginIp?: string; // Optional: Can be null

    // NEW: Last login user agent for device tracking
    @Column({ nullable: true })
    lastLoginUserAgent?: string; // Optional: Can be null

    // NEW: Login attempts for rate limiting
    @Column({ type: 'int', default: 0 })
    loginAttempts!: number; // Non-null: Has default

    // NEW: Account lockout until date
    @Column({ type: 'timestamp', nullable: true })
    lockedUntil: Date | null; // Optional: Can be null

    // NEW: Soft delete support
    @Column({ type: 'timestamp', nullable: true })
    deletedAt?: Date; // Optional: Can be null

    @Column({ type: 'jsonb', nullable: true })
    metadata?: Record<string, any>; // Optional: Can be null

    @CreateDateColumn({ type: 'timestamp' })
    createdAt!: Date; // Non-null: Auto-generated

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt!: Date; // Non-null: Auto-generated

    // Existing relations
    @OneToMany(() => Image, image => image.user)
    images!: Image[]; // Non-null: Will be empty array if none

    @OneToMany(() => Generation, generation => generation.user)
    generations!: Generation[]; // Non-null: Will be empty array if none

    @OneToMany(() => Draft, draft => draft.user)
    drafts!: Draft[]; // Non-null: Will be empty array if none

    @OneToMany(() => Template, template => template.user)
    templates!: Template[]; // Non-null: Will be empty array if none

    @OneToOne(() => BrandVoice, brandVoice => brandVoice.user)
    brandVoice?: BrandVoice; // Optional: Can be null

    @OneToMany(() => PlatformConnection, connection => connection.user)
    platformConnections!: PlatformConnection[]; // Non-null: Will be empty array if none

    @OneToMany(() => History, history => history.user)
    history!: History[]; // Non-null: Will be empty array if none

    @OneToMany(() => BatchJob, batchJob => batchJob.user)
    batchJobs!: BatchJob[]; // Non-null: Will be empty array if none

    @OneToOne(() => UserPreference, preference => preference.user)
    preferences?: UserPreference; // Optional: Can be null

    // NEW: Auth relations
    @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
    refreshTokens!: RefreshToken[]; // Non-null: Will be empty array if none

    @OneToMany(() => UserSession, session => session.user)
    sessions!: UserSession[]; // Non-null: Will be empty array if none

    @OneToMany(() => PasswordReset, passwordReset => passwordReset.user)
    passwordResets!: PasswordReset[]; // Non-null: Will be empty array if none

    @OneToMany(() => EmailVerification, verification => verification.user)
    emailVerifications!: EmailVerification[]; // Non-null: Will be empty array if none

    @OneToMany(() => UserLoginHistory, loginHistory => loginHistory.user)
    loginHistory!: UserLoginHistory[]; // Non-null: Will be empty array if none

    @OneToMany(() => TwoFactorMethod, method => method.user)
    twoFactorMethods!: TwoFactorMethod[]; // Non-null: Will be empty array if none

    @OneToMany(() => OtpVerification, otp => otp.user)
    otpVerifications!: OtpVerification[];

    // Hash password before save
    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        if (this.passwordHash && this.passwordHash.length < 60) {
            this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
        }
    }

    // Utility methods
    async validatePassword(password: string): Promise<boolean> {
        if (!this.passwordHash) return false;
        return bcrypt.compare(password, this.passwordHash);
    }

    get fullName(): string {
        return `${this.firstName || ''} ${this.lastName || ''}`.trim() || this.username;
    }

    isLocked(): boolean {
        if (!this.lockedUntil) return false;
        return new Date() < this.lockedUntil;
    }

    incrementLoginAttempts(): void {
        this.loginAttempts += 1;
        if (this.loginAttempts >= 5) {
            this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        }
    }

    resetLoginAttempts(): void {
        this.loginAttempts = 0;
        this.lockedUntil = null;
    }

    // isEmailVerified(): boolean {
    //     return this.emailVerifiedAt !== null || this.isEmailVerified === true;
    // }
}