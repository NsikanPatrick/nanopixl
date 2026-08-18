import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleOAuthStrategy } from './strategies/oauth.strategy';

// Decorators - exported from index file
export * from './decorators/public.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/permissions.decorator';
export * from './decorators/rate-limit.decorator';
export * from './decorators/current-user.decorator';

@Global() // Make available to all modules
@Module({
    imports: [
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get('JWT_EXPIRATION') || '15m',
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
        JwtStrategy,
        LocalStrategy,
        GoogleOAuthStrategy,
    ],
    exports: [
        // Guards
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        RateLimitGuard,
        // Strategies
        JwtStrategy,
        LocalStrategy,
        GoogleOAuthStrategy,
        JwtModule,
    ],
})
export class AuthSharedModule { }