// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserSession } from './entities/user-session.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { UserLoginHistory } from './entities/user-login-history.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { TwoFactorMethod } from './entities/two-factor-method.entity';
import { OtpVerification } from './entities/otp-verification.entity';

// Controllers
import { AuthController } from './auth.controller';

// Services
import { AuthService } from './auth.service';
import { TokenService } from './services/refresh-token.service';
import { SessionService } from './services/session.service';
import { PasswordService } from './services/password.service';
import { TwoFactorService } from './services/two-factor.service';
import { OAuthService } from './services/oauth.service';
import { SecurityService } from './services/security.service';
import { OtpVerificationService } from './services/otp-verification.service';


// Strategies
import { JwtStrategy } from '../../shared/auth/strategies/jwt.strategy';
import { LocalStrategy } from '../../shared/auth/strategies/local.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
// import { GoogleOAuthStrategy, FacebookOAuthStrategy, GithubOAuthStrategy } from '../../shared/auth/strategies/oauth.strategy'; => All oAuthStrategies from the file
import { GoogleOAuthStrategy } from '../../shared/auth/strategies/oauth.strategy';

// Guards
import { JwtAuthGuard, RolesGuard, RateLimitGuard } from '../../shared/auth/guards/index';
import { TwoFactorGuard } from './guards/two-factor.guard';

// Decorators
// Add custom decorators here

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Entities
      User,
      RefreshToken,
      UserSession,
      PasswordReset,
      EmailVerification,
      UserLoginHistory,
      UserPreference,
      TwoFactorMethod,
      OtpVerification,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,
    TokenService,
    SessionService,
    PasswordService,
    TwoFactorService,
    OAuthService,
    SecurityService,
    OtpVerificationService,

    // Strategies
    JwtStrategy,
    LocalStrategy,
    RefreshStrategy,
    GoogleOAuthStrategy,

    // Guards
    JwtAuthGuard,
    RolesGuard,
    TwoFactorGuard,
    RateLimitGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    SessionService,
    OtpVerificationService,
    JwtModule,
    PassportModule,
    TypeOrmModule,
  ],
})
export class AuthModule { }