// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthService } from '../../core/auth/auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshTokenDto,
} from '../../core/auth/dto/index';
import { Public } from '../../shared/auth/decorators/public.decorator';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { Roles } from '../../shared/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/auth/guards/roles.guard';
import { User, UserRole } from '../../core/auth/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // ==================== PUBLIC ENDPOINTS ====================

  /* ================== Register a new user ==================
  
  POST /auth/register */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /* ================== Login user =====================
  
  POST /auth/login */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: any,
  ) {
    return this.authService.login(loginDto, req);
  }

  /* ================== Verify email with OTP ====================
  
  POST /auth/verify-email */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body('email') email: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyEmail(email, code);
  }

  /* ================== Resend verification OTP =====================
  
  POST /auth/resend-verification */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationOtp(email);
  }

  /* ================== Forgot password - send reset link ===========
  
  POST /auth/forgot-password */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto.email);
  }

  /* ================== Reset password with OTP ======================
   
  POST /auth/reset-password */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.email,
      resetPasswordDto.code,
      resetPasswordDto.newPassword,
    );
  }

  /* ================== Refresh access token =========================
  
  POST /auth/refresh */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: any) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken, req);
  }

  
  /* ================== Send OTP for email verification ===================
   
  POST /auth/send-otp */
  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() otpRequestDto: OtpRequestDto) {
    return this.authService.sendOtp(otpRequestDto.email);
  }

  /* ================== Verify OTP and login ====================
  
  POST /auth/verify-otp */
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtpAndLogin(
    @Body() otpVerifyDto: OtpVerifyDto,
    @Req() req: any,
  ) {
    return this.authService.verifyOtpAndLogin(
      otpVerifyDto.email,
      otpVerifyDto.code,
      req,
    );
  }

  // ==================== PROTECTED ENDPOINTS ====================

  /* ================== Logout user ======================
  
  POST /auth/logout */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: User,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.logout(user.id, refreshToken);
  }

  /* ================== Get current user profile =================
  
  GET /auth/me */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getUserById(user.id);
  }

  /* ================== Update user profile ===================
  
  PUT /auth/profile */
  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.updateProfile(user.id, updateProfileDto, file);
  }

  /* ================== Change password ==================
  
  POST /auth/change-password */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }

  /* ================== Verify 2FA code ========================
  
  POST /auth/verify-2fa */
  @Post('verify-2fa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @CurrentUser() user: User,
    @Body('code') code: string,
    @Req() req: any,
  ) {
    return this.authService.verifyTwoFactor(user.id, code, req);
  }

  // ==================== ADMIN ONLY ENDPOINTS ====================

  /* ================== Create admin user (Admin only) ====================
  
  POST /auth/admin/create */
  @Post('admin/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(
    @Body() registerDto: RegisterDto,
    @CurrentUser() admin: User,
  ) {
    return this.authService.createAdmin(registerDto, admin.id);
  }

  /* ================== Get all users (Admin only) ======================
  
  GET /auth/admin/users?page=1&limit=10 */
  @Get('admin/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.authService.getAllUsers(page, limit);
  }

  /* ================== Get user by ID (Admin only) ====================
  
  GET /auth/admin/users/:userId */
  @Get('admin/users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getUserById(@Param('userId') userId: string) {
    return this.authService.getUserById(userId);
  }

  /* ================== Update user status (Admin only) ==================
  
  PATCH /auth/admin/users/:userId/status */
  @Patch('admin/users/:userId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body('status') status: string,
  ) {
    return this.authService.updateUserStatus(userId, status as any);
  }

  /* ================== Update user role (Admin only) ====================
  
  PATCH /auth/admin/users/:userId/role */
  @Patch('admin/users/:userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: string,
    @CurrentUser() admin: User,
  ) {
    return this.authService.updateUserRole(userId, role, admin.id);
  }

  /* ================== Delete user (Admin only) ========================
  
  DELETE /auth/admin/users/:userId */
  @Delete('admin/users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser() admin: User,
  ) {
    return this.authService.deleteUser(userId, admin.id);
  }
}