import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

// Entities
import { User } from './entities/user.entity';
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
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { PasswordService } from './services/password.service';
import { TwoFactorService } from './services/two-factor.service';
import { OAuthService } from './services/oauth.service';
import { SecurityService } from './services/security.service';
import { OtpVerificationService } from './services/otp-verification.service';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { GoogleOAuthStrategy } from './strategies/oauth.strategy';

// Guards
import { TwoFactorGuard } from './guards/two-factor.guard';

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

    // Guards (Only omain-specific guard, Generic ones are in shared/auth/auth-shared.module)
    TwoFactorGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    SessionService,
    OtpVerificationService,
    PassportModule,
    TypeOrmModule,
    OAuthService,
  ],
})
export class AuthModule { }