// src/core/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity'
import { TokenService } from './services/token.service';
import { SecurityService } from './services/security.service';
import { OtpVerificationService } from './services/otp-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private tokenService: TokenService,
    private securityService: SecurityService,
    private otpVerificationService: OtpVerificationService,
    private configService: ConfigService,
  ) { }

  /**
   * Validate user credentials for local strategy
   * This is called by the LocalStrategy
   */
  async validateUser(email: string, password: string): Promise<any> {
    // Find user by email (case insensitive)
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase(), isActive: true },
    });

    // User not found
    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new UnauthorizedException('Account is locked. Please try again later.');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed login attempts
      user.incrementLoginAttempts();
      await this.userRepository.save(user);
      return null;
    }

    // Reset login attempts on successful login
    user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Return user without password hash
    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    const { email, username, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
      throw new BadRequestException('User with this email or username already exists');
    }

    // Hash password
    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = this.userRepository.create({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      isActive: false, // User must verify email first
      isEmailVerified: false,
      subscriptionTier: 'free',
      loginAttempts: 0,
    });

    await this.userRepository.save(user);

    // Generate and send OTP for email verification
    try {
      await this.otpVerificationService.generateOtp(
        user.email,
        'email_verification',
        {
          sendEmail: true,
          expiresIn: 15,
        }
      );
    } catch (error) {
      // Log error but don't fail registration
      console.error('Failed to send verification OTP:', error);
    }

    return {
      message: 'User registered successfully. Please verify your email.',
      userId: user.id,
    };
  }

  /**
   * Login user with email and password
   */
  async login(loginDto: LoginDto, request: any): Promise<any> {
    const { email, password } = loginDto;

    // Validate credentials
    const user = await this.validateUser(email, password);
    if (!user) {
      // Record failed login attempt
      await this.securityService.recordLoginAttempt(
        null,
        request.ip,
        request.headers['user-agent'],
        false,
        'Invalid credentials'
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      // Resend verification OTP
      await this.otpVerificationService.generateOtp(
        user.email,
        'email_verification',
        {
          sendEmail: true,
          expiresIn: 15,
        }
      );
      throw new UnauthorizedException('Please verify your email first. A new verification code has been sent.');
    }

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled) {
      // Return user info and require 2FA
      return {
        requireTwoFactor: true,
        userId: user.id,
        email: user.email,
        message: 'Two-factor authentication required',
      };
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceId: request.headers['x-device-id'],
      deviceName: request.headers['x-device-name'],
    });

    // Record successful login
    await this.securityService.recordLoginAttempt(
      user.id,
      request.ip,
      request.headers['user-agent'],
      true
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionTier: user.subscriptionTier,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  /**
   * Verify 2FA code during login
   */
  async verifyTwoFactor(userId: string, code: string, request: any): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify 2FA code
    const isValid = await this.securityService.validateTwoFactor(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceId: request.headers['x-device-id'],
      deviceName: request.headers['x-device-name'],
    });

    // Record successful login
    await this.securityService.recordLoginAttempt(
      user.id,
      request.ip,
      request.headers['user-agent'],
      true
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionTier: user.subscriptionTier,
      },
    };
  }

  /**
   * Verify email with OTP
   */
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const { valid, otp } = await this.otpVerificationService.verifyOtp(
      email.toLowerCase(),
      code,
      'email_verification'
    );

    if (!valid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.isEmailVerified = true;
    user.isActive = true;
    await this.userRepository.save(user);

    return {
      message: 'Email verified successfully. You can now login.',
    };
  }

  /**
   * Resend verification OTP
   */
  async resendVerificationOtp(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.otpVerificationService.generateOtp(
      user.email,
      'email_verification',
      {
        sendEmail: true,
        expiresIn: 15,
      }
    );

    return {
      message: 'Verification code sent successfully',
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Don't reveal if user exists or not (security)
      return {
        message: 'If an account exists with this email, you will receive a password reset link.',
      };
    }

    await this.otpVerificationService.generateOtp(
      user.email,
      'password_reset',
      {
        sendEmail: true,
        expiresIn: 15,
      }
    );

    return {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const { valid, otp } = await this.otpVerificationService.verifyOtp(
      email.toLowerCase(),
      code,
      'password_reset'
    );

    if (!valid) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.resetLoginAttempts();
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.tokenService.revokeAllUserRefreshTokens(user.id, 'Password reset');

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }

  /**
   * Logout user
   */
  async logout(userId: string, refreshToken?: string): Promise<{ message: string }> {
    // Revoke all refresh tokens
    await this.tokenService.revokeAllUserRefreshTokens(userId, 'User logout');

    // If specific refresh token provided, revoke it
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken, 'User logout');
    }

    return {
      message: 'Logged out successfully',
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, request: any): Promise<any> {
    const tokens = await this.tokenService.refreshAccessToken(refreshToken, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return tokens;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.tokenService.revokeAllUserRefreshTokens(user.id, 'Password changed');

    return {
      message: 'Password changed successfully',
    };
  }
}