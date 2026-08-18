import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../entities/user.entity';
import { UserSession } from '../entities/user-session.entity';

export interface TokenPayload {
    sub: string; // User ID
    email: string;
    username: string;
    roles?: string[];
    [key: string]: any;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}

@Injectable()
export class TokenService {
    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
        @InjectRepository(RefreshToken)
        private refreshTokenRepository: Repository<RefreshToken>,
        @InjectRepository(UserSession)
        private sessionRepository: Repository<UserSession>,
    ) { }

    /**
     * Generate access token (short-lived JWT)
     */
    generateAccessToken(user: User): string {
        const payload: TokenPayload = {
            sub: user.id,
            email: user.email,
            username: user.username,
            roles: [user.subscriptionTier],
        };

        return this.jwtService.sign(payload);
    }

    /**
     * Generate refresh token (long-lived, stored in DB)
     */
    async generateRefreshToken(
        user: User,
        sessionData?: {
            ipAddress?: string;
            userAgent?: string;
            deviceId?: string;
            deviceName?: string;
        }
    ): Promise<RefreshToken> {
        // Revoke all existing refresh tokens for this user
        await this.revokeAllUserRefreshTokens(user.id);

        const token = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days default

        const refreshToken = this.refreshTokenRepository.create({
            userId: user.id,
            token,
            expiresAt,
            metadata: {
                ipAddress: sessionData?.ipAddress,
                userAgent: sessionData?.userAgent,
                deviceId: sessionData?.deviceId,
                deviceName: sessionData?.deviceName,
            },
        });

        await this.refreshTokenRepository.save(refreshToken);
        return refreshToken;
    }

    /**
     * Generate both access and refresh tokens
     */
    async generateTokens(
        user: User,
        sessionData?: {
            ipAddress?: string;
            userAgent?: string;
            deviceId?: string;
            deviceName?: string;
        }
    ): Promise<TokenResponse> {
        const accessToken = this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user, sessionData);
        const expiresIn = parseInt(this.configService.get('JWT_EXPIRATION') || '900');

        // Create a session record
        await this.createSession(user, {
            sessionToken: refreshToken.token,
            ...sessionData,
        });

        return {
            accessToken,
            refreshToken: refreshToken.token,
            expiresIn,
            tokenType: 'Bearer',
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshTokenString: string, requestData?: {
        ipAddress?: string;
        userAgent?: string;
    }): Promise<TokenResponse> {
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: {
                token: refreshTokenString,
                revoked: false,
            },
            relations: {
                user: true,
            },
        });

        if (!refreshToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Check if token is expired
        if (refreshToken.isExpired()) {
            throw new UnauthorizedException('Refresh token expired');
        }

        // Check if user is active
        if (!refreshToken.user?.isActive) {
            throw new UnauthorizedException('User account is inactive');
        }

        // ✅ FIXED: Update metadata with new request info
        if (requestData) {
            // Get existing metadata or create new object
            const existingMetadata = refreshToken.metadata || {};

            // Create updated metadata with only allowed fields
            refreshToken.metadata = {
                ipAddress: requestData.ipAddress || existingMetadata.ipAddress,
                userAgent: requestData.userAgent || existingMetadata.userAgent,
                deviceId: existingMetadata.deviceId,
                deviceName: existingMetadata.deviceName,
                // Add additional fields as a separate nested object if needed
                usage: {
                    lastUsedIp: requestData.ipAddress,
                    lastUsedAt: new Date().toISOString(),
                    usageCount: (existingMetadata as any)?.usage?.usageCount ? (existingMetadata as any).usage.usageCount + 1 : 1,
                },
            };

            await this.refreshTokenRepository.save(refreshToken);
        }

        // Generate new tokens
        const accessToken = this.generateAccessToken(refreshToken.user);
        const expiresIn = parseInt(this.configService.get('JWT_EXPIRATION') || '900');

        // Optionally rotate refresh token
        const shouldRotate = this.configService.get('REFRESH_TOKEN_ROTATE') === 'true';
        if (shouldRotate) {
            const newRefreshToken = await this.generateRefreshToken(refreshToken.user, {
                ipAddress: requestData?.ipAddress,
                userAgent: requestData?.userAgent,
            });

            // Revoke the old refresh token
            refreshToken.revoke('Rotated');
            await this.refreshTokenRepository.save(refreshToken);

            return {
                accessToken,
                refreshToken: newRefreshToken.token,
                expiresIn,
                tokenType: 'Bearer',
            };
        }

        return {
            accessToken,
            refreshToken: refreshTokenString,
            expiresIn,
            tokenType: 'Bearer',
        };
    }

    /**
     * Verify and decode access token
     */
    verifyAccessToken(token: string): TokenPayload {
        try {
            return this.jwtService.verify(token);
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired access token');
        }
    }

    /**
     * Decode token without verification
     */
    decodeToken(token: string): TokenPayload | null {
        try {
            return this.jwtService.decode(token) as TokenPayload;
        } catch (error) {
            return null;
        }
    }

    /**
     * Revoke a specific refresh token
     */
    async revokeRefreshToken(token: string, reason?: string): Promise<void> {
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: { token },
        });

        if (refreshToken) {
            refreshToken.revoke(reason);
            await this.refreshTokenRepository.save(refreshToken);
        }
    }

    /**
     * Revoke all refresh tokens for a user
     */
    async revokeAllUserRefreshTokens(userId: string, reason?: string): Promise<void> {
        const tokens = await this.refreshTokenRepository.find({
            where: { userId, revoked: false },
        });

        for (const token of tokens) {
            token.revoke(reason || 'User logout');
            await this.refreshTokenRepository.save(token);
        }
    }

    /**
     * Clean up expired refresh tokens
     */
    async cleanupExpiredTokens(): Promise<number> {
        const result = await this.refreshTokenRepository.delete({
            expiresAt: LessThan(new Date()),
        });
        return result.affected || 0;
    }

    /**
     * Create user session
     */
    private async createSession(
        user: User,
        data: {
            sessionToken: string;
            ipAddress?: string;
            userAgent?: string;
            deviceId?: string;
            deviceName?: string;
        }
    ): Promise<UserSession> {
        // Revoke old sessions if max sessions exceeded
        const maxSessions = parseInt(this.configService.get('MAX_USER_SESSIONS') || '5');
        const activeSessions = await this.sessionRepository.count({
            where: { userId: user.id, isActive: true },
        });

        if (activeSessions >= maxSessions) {
            // Revoke oldest session
            const oldestSession = await this.sessionRepository.findOne({
                where: { userId: user.id, isActive: true },
                order: { lastActivityAt: 'ASC' },
            });
            if (oldestSession) {
                oldestSession.revoke();
                await this.sessionRepository.save(oldestSession);
            }
        }

        const session = this.sessionRepository.create({
            userId: user.id,
            sessionToken: data.sessionToken,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            deviceType: this.detectDeviceType(data.userAgent),
            lastActivityAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });

        return this.sessionRepository.save(session);
    }

    /**
     * Detect device type from user agent
     */
    private detectDeviceType(userAgent?: string): string {
        if (!userAgent) return 'unknown';

        const ua = userAgent.toLowerCase();
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
            return 'mobile';
        }
        if (ua.includes('tablet') || ua.includes('ipad')) {
            return 'tablet';
        }
        if (ua.includes('bot') || ua.includes('crawler')) {
            return 'bot';
        }
        return 'desktop';
    }

    /**
     * Get user from refresh token
     */
    async getUserFromRefreshToken(token: string): Promise<User | null> {
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: {
                token,
                revoked: false
            },
            relations: {
                user: true,
            },
        });

        if (!refreshToken || refreshToken.isExpired()) {
            return null;
        }

        return refreshToken.user || null;
    }

    /**
     * Validate refresh token
     */
    async validateRefreshToken(token: string): Promise<boolean> {
        const refreshToken = await this.refreshTokenRepository.findOne({
            where: {
                token,
                revoked: false
            },
        });

        if (!refreshToken || refreshToken.isExpired()) {
            return false;
        }

        return true;
    }

    /**
     * Get token expiry time in seconds
     */
    getTokenExpiryInSeconds(): number {
        const expiry = this.configService.get('JWT_EXPIRATION') || '15m';
        const match = expiry.match(/^(\d+)([mhd])$/);
        if (!match) return 900;

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 60 * 60 * 24;
            default: return 900;
        }
    }

    /**
     * Generate OTP token (for 2FA, password reset, etc.)
     */
    generateOTP(length: number = 6): string {
        return Math.floor(Math.random() * Math.pow(10, length))
            .toString()
            .padStart(length, '0');
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }
}