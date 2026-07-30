import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TwoFactorService } from '../services/two-factor.service';

@Injectable()
export class TwoFactorGuard implements CanActivate {
    constructor(private twoFactorService: TwoFactorService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        // Check if 2FA is required for this user
        const isTwoFactorEnabled = await this.twoFactorService.isTwoFactorEnabled(user.id);

        if (!isTwoFactorEnabled) {
            return true;
        }

        // Check if 2FA token is provided
        const token = request.headers['x-2fa-token'];
        if (!token) {
            throw new UnauthorizedException('2FA token required');
        }

        // Validate 2FA token
        const isValid = await this.twoFactorService.validateTOTPForAuth(user.id, token);
        if (!isValid) {
            throw new UnauthorizedException('Invalid 2FA token');
        }

        return true;
    }
}
