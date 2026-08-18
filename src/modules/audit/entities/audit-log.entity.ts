import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    Index,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../../core/auth/entities/user.entity';

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['ipAddress'])
@Index(['sessionId'])
@Index(['requestId'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string; // Non-null: Auto generated

    // ====== User Information ======
    @Column({ type: 'uuid', nullable: true })
    userId?: string; // Optional: Could be system action or unauthenticated

    @Column({ length: 255, nullable: true })
    userEmail?: string; // Optional: Snapshot of user email at time of action

    @Column({ length: 100, nullable: true })
    username?: string; // Optional: Snapshot of username at time of action

    @Column({ length: 255, nullable: true })
    userAgent?: string; // Optional: Browser/device info

    @Column({ length: 45, nullable: true })
    ipAddress?: string; // Optional: IP address of request

    @Column({ length: 255, nullable: true })
    sessionId?: string; // Optional: Session identifier

    // ====== Action Information ======
    @Column({ length: 100 })
    action!: string; // Non-null: e.g., 'user.login', 'generation.create'

    @Column({
        type: 'enum',
        enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PUBLISH', 'REGENERATE', 'OTHER'],
        default: 'OTHER'
    })
    operationType!: string; // Non-null: CRUD operation type

    @Column({ length: 255 })
    resourceType!: string; // Non-null: e.g., 'User', 'Generation', 'Image'

    @Column({ length: 255, nullable: true })
    resourceId?: string; // Optional: ID of the resource being acted upon

    @Column({ length: 255, nullable: true })
    resourceName?: string; // Optional: Human-readable name of resource

    // ====== Request Information ======
    @Column({ length: 255, nullable: true })
    requestId?: string; // Optional: Correlation ID for request tracing

    @Column({ length: 10, nullable: true })
    httpMethod?: string; // Optional: GET, POST, PUT, DELETE, etc.

    @Column({ length: 500, nullable: true })
    endpoint?: string; // Optional: API endpoint accessed

    @Column({ type: 'int', nullable: true })
    statusCode?: number; // Optional: HTTP status code

    @Column({ type: 'int', nullable: true })
    responseTime?: number; // Optional: Response time in milliseconds

    // ====== Changes ======
    @Column({ type: 'jsonb', nullable: true })
    changes?: { // Optional: What changed (for UPDATE operations)
        before?: Record<string, any>;
        after?: Record<string, any>;
        diff?: Record<string, { before: any; after: any }>;
    };

    @Column({ type: 'jsonb', nullable: true })
    metadata?: { // Optional: Additional context
        reason?: string;
        source?: string;
        environment?: 'development' | 'staging' | 'production';
        version?: string;
        ipLocation?: {
            country?: string;
            city?: string;
            latitude?: number;
            longitude?: number;
        };
        [key: string]: any;
    };

    // ====== Result ======
    @Column({ default: true })
    isSuccess!: boolean; // Non-null: Was the action successful?

    @Column({ length: 500, nullable: true })
    errorMessage?: string; // Optional: Error message if failed

    @Column({ length: 500, nullable: true })
    errorStack?: string; // Optional: Error stack trace (only in development)

    // ====== Timestamps ======
    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date; // Non-null: Auto-generated

    // ====== Relations ======
    @ManyToOne(() => User, user => user.id)
    @JoinColumn({ name: 'userId' })
    user?: User; // Optional: User who performed the action
}
