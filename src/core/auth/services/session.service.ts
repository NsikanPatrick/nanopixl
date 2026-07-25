import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSession } from '../entities/user-session.entity';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class SessionService {
    constructor(
        @InjectRepository(UserSession)
        private sessionRepository: Repository<UserSession>,
    ) { }

    async createSession(user: User, data: any): Promise<UserSession> {
        const session = this.sessionRepository.create({
            userId: user.id,
            sessionToken: data.sessionToken,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            deviceType: data.deviceType,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            location: data.location,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
        return this.sessionRepository.save(session);
    }

    async revokeSession(sessionId: string): Promise<void> {
        await this.sessionRepository.update(sessionId, {
            isActive: false,
            lastActivityAt: new Date(),
        });
    }

    async revokeAllUserSessions(userId: string): Promise<void> {
        await this.sessionRepository.update(
            { userId, isActive: true },
            { isActive: false }
        );
    }

    async getActiveSessions(userId: string): Promise<UserSession[]> {
        return this.sessionRepository.find({
            where: { userId, isActive: true },
            order: { createdAt: 'DESC' },
        });
    }
}
