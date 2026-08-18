import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { TokenService } from '../services/token.service';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
    constructor(private tokenService: TokenService) {
        super();
    }

    async validate(request: Request): Promise<any> {
        // Get refresh token from body
        const refreshToken = request.body?.refreshToken;

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token is required');
        }

        // Validate refresh token
        const isValid = await this.tokenService.validateRefreshToken(refreshToken);
        if (!isValid) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        // Get user from refresh token
        const user = await this.tokenService.getUserFromRefreshToken(refreshToken);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Check if user is active
        if (!user.isActive) {
            throw new UnauthorizedException('User account is inactive');
        }

        // Attach refresh token to user for later use
        return {
            user,
            refreshToken,
        };
    }
}