// AuthSharedModule acts as a global infrastructure layer providing guards, decorators, and JWT validation across all feature modules, whereas AuthModule handles domain - specific authentication logic, database entities, and API endpoints.

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Guards (Generic guards, Domain-specific ones are in auth.module.ts)
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

// Strategies => Strategies are now in core/auth/strategies
// import { JwtStrategy } from './strategies/jwt.strategy';
// import { LocalStrategy } from './strategies/local.strategy';
// import { GoogleOAuthStrategy } from './strategies/oauth.strategy';

// Decorators - exported from index file
export * from './decorators/public.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/permissions.decorator';
export * from './decorators/rate-limit.decorator';
export * from './decorators/current-user.decorator';

@Global() // Make available to all modules
@Module({
    imports: [
        // AuthModule, // Import AuthModule to get AuthService
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_ACCESS_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_ACCESS_EXPIRY') || '15m',
                },
            }),
        }),
    ],
    providers: [
        // Guards
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        RateLimitGuard,
        // Strategies
        // JwtStrategy,
        // LocalStrategy,
        // GoogleOAuthStrategy,
    ],
    exports: [
        // Guards
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        RateLimitGuard,
        // Strategies
        // JwtStrategy,
        // LocalStrategy,
        // GoogleOAuthStrategy,
        JwtModule,
        // AuthModule,
    ],
})
export class AuthSharedModule { }