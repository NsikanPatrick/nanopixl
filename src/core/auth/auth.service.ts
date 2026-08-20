import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Multer } from 'multer';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, AccountStatus } from './entities/user.entity';
import { TokenService } from './services/token.service';
import { SecurityService } from './services/security.service';
import { OtpVerificationService } from './services/otp-verification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as crypto from 'crypto';

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

  /* ================== Validate user credentials for local strategy =========
  
  This method is called by the LocalStrategy */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase(), isActive: true },
    });

    if (!user) {
      return null;
    }

    if (user.isLocked()) {
      throw new UnauthorizedException('Account is locked. Please try again later.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      user.incrementLoginAttempts();
      await this.userRepository.save(user);
      return null;
    }

    user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const { passwordHash, ...result } = user;
    return result;
  }

  /* ================== Register a new user =================*/
  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    const { email, username, password, firstName, lastName } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
      throw new ConflictException('User with this email or username already exists');
    }

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = this.userRepository.create({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      isActive: false,
      isEmailVerified: false,
      subscriptionTier: 'free',
      loginAttempts: 0,
    });

    await this.userRepository.save(user);

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
      console.error('Failed to send verification OTP:', error);
    }

    return {
      message: 'User registered successfully. Please verify your email.',
      userId: user.id,
    };
  }

  /* ================== Login user with email and password =================*/
  async login(loginDto: LoginDto, request: any): Promise<any> {
    const { email, password } = loginDto;

    const user = await this.validateUser(email, password);
    if (!user) {
      await this.securityService.recordLoginAttempt(
        null,
        request.ip,
        request.headers['user-agent'],
        false,
        'Invalid credentials'
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
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

    if (user.isTwoFactorEnabled) {
      return {
        requireTwoFactor: true,
        userId: user.id,
        email: user.email,
        message: 'Two-factor authentication required',
      };
    }

    const tokens = await this.tokenService.generateTokens(user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceId: request.headers['x-device-id'],
      deviceName: request.headers['x-device-name'],
    });

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

  /* ================== Verify 2FA code during login ==================== */
  async verifyTwoFactor(userId: string, code: string, request: any): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await this.securityService.validateTwoFactor(userId, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const tokens = await this.tokenService.generateTokens(user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      deviceId: request.headers['x-device-id'],
      deviceName: request.headers['x-device-name'],
    });

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

  /* ================== Verify email with OTP ==================== */
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const { valid } = await this.otpVerificationService.verifyOtp(
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

  /* ================== Resend verification OTP ====================== */
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

  /* ================== Request password reset ====================== */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
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

  /* ================== Reset password with OTP ====================== */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const { valid } = await this.otpVerificationService.verifyOtp(
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

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.resetLoginAttempts();
    await this.userRepository.save(user);

    await this.tokenService.revokeAllUserRefreshTokens(user.id, 'Password reset');

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }

  /* ======================== Logout user ========================= */
  async logout(userId: string, refreshToken?: string): Promise<{ message: string }> {
    await this.tokenService.revokeAllUserRefreshTokens(userId, 'User logout');

    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken, 'User logout');
    }

    return {
      message: 'Logged out successfully',
    };
  }

  /* ================== Refresh access token ==================== */
  async refreshToken(refreshToken: string, request: any): Promise<any> {
    const tokens = await this.tokenService.refreshAccessToken(refreshToken, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return tokens;
  }

  /* ================== Get user by ID ====================== */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /* ================== Get user by email ====================== */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  /* ================== Change password ====================== */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await this.userRepository.save(user);

    await this.tokenService.revokeAllUserRefreshTokens(user.id, 'Password changed');

    return {
      message: 'Password changed successfully',
    };
  }

  // ==================== UTILITY METHODs ====================

  /* ================== Send OTP to user's email ===================== */
  async sendOtp(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new BadRequestException('User not found');
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
      message: 'OTP sent successfully to your email.',
    };
  }

  /* ================== Verify OTP and login ===================== */
  async verifyOtpAndLogin(
    email: string,
    code: string,
    request: any
  ): Promise<any> {
    const { valid } = await this.otpVerificationService.verifyOtp(
      email.toLowerCase(),
      code,
      'email_verification'
    );

    if (!valid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.userRepository.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Mark email as verified if not already
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.isActive = true;
      await this.userRepository.save(user);
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
      true,
      'OTP login'
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

  /* ================== Update user profile ====================== */
  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    file?: Express.Multer.File
  ): Promise<{ message: string; user: any }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update fields if provided
    if (updateProfileDto.username) {
      user.username = updateProfileDto.username;
    }
    if (updateProfileDto.firstName) {
      user.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName) {
      user.lastName = updateProfileDto.lastName;
    }
    if (updateProfileDto.profilePicture) {
      user.profilePicture = updateProfileDto.profilePicture;
    }
    if (updateProfileDto.avatarUrl) {
      user.avatarUrl = updateProfileDto.avatarUrl;
    }
    if (updateProfileDto.bio) {
      user.metadata = {
        ...user.metadata,
        bio: updateProfileDto.bio,
      };
    }

    // Handle file upload if provided
    if (file) {
      // You can integrate your file upload service here
      // user.profilePicture = await this.fileUploadService.uploadFile(file);
    }

    const updatedUser = await this.userRepository.save(user);

    const { passwordHash, ...result } = updatedUser;
    return {
      message: 'Profile updated successfully',
      user: result,
    };
  }

  /* ================== Create admin user (Admin only) =================== */
  async createAdmin(registerDto: RegisterDto, creatorId: string): Promise<{ message: string; user: any }> {
    const creator = await this.userRepository.findOne({ where: { id: creatorId } });
    if (!creator || creator.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Only admins can create admin accounts');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS') || '10');
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    const newAdmin = this.userRepository.create({
      email: registerDto.email.toLowerCase(),
      username: registerDto.username || registerDto.email.split('@')[0],
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.ADMIN,
      status: AccountStatus.ACTIVE,
      isActive: true,
      isEmailVerified: true,
      subscriptionTier: 'free',
    });

    const savedAdmin = await this.userRepository.save(newAdmin);

    const { passwordHash: _, ...result } = savedAdmin;
    return {
      message: 'Admin user created successfully',
      user: result,
    };
  }

  /* ================== Get all users with pagination (Admin only) ========= */
  async getAllUsers(page: number = 1, limit: number = 10): Promise<any> {
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository.findAndCount({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        profilePicture: true,
      },
      skip,
      take: limit,
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /* ================== Update user status (Admin only) =================== */
  async updateUserStatus(userId: string, status: string): Promise<{ message: string; user: any }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate status
    if (!Object.values(AccountStatus).includes(status as AccountStatus)) {
      throw new BadRequestException('Invalid status');
    }

    user.status = status as AccountStatus;
    if (status === AccountStatus.ACTIVE) {
      user.isActive = true;
    } else if (status === AccountStatus.INACTIVE || status === AccountStatus.SUSPENDED) {
      user.isActive = false;
    }

    const updatedUser = await this.userRepository.save(user);

    const { passwordHash, ...result } = updatedUser;
    return {
      message: `User status updated to ${status}`,
      user: result,
    };
  }

  /* ================== Update user role (Admin only) =================== */
  async updateUserRole(userId: string, role: string, adminId: string): Promise<{ message: string; user: any }> {
    // Prevent admin from changing their own role
    if (userId === adminId) {
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate role
    if (!Object.values(UserRole).includes(role as UserRole)) {
      throw new BadRequestException('Invalid role');
    }

    user.role = role as UserRole;
    const updatedUser = await this.userRepository.save(user);

    const { passwordHash, ...result } = updatedUser;
    return {
      message: `User role updated to ${role} successfully`,
      user: result,
    };
  }

  /* ================== Delete user (Admin only) ===================== */
  async deleteUser(userId: string, adminId: string): Promise<{ message: string }> {
    // Prevent admin from deleting themselves
    if (userId === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hard delete the user
    await this.userRepository.remove(user);

    return {
      message: 'User account deleted successfully',
    };
  }
}