import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { User, UserRole, AccountStatus } from './entities/user.entity';
import { TokenService } from './services/token.service';
import { SecurityService } from './services/security.service';
import { OtpVerificationService } from './services/otp-verification.service';
import { FileUploadService } from '../../shared/file-upload/file-upload.service';
import { ImagesService } from '../../modules/images/images.service';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK STRATEGY
//
// We are unit-testing AuthService, so we replace EVERY dependency with a mock.
// Real bcrypt is slow (~100ms per hash), so we mock it too. Real sanitizeUser
// is pure and fast, so we let it run — that way, the util is tested too.
// ─────────────────────────────────────────────────────────────────────────────
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// ─────────────────────────────────────────────────────────────────────────────
// TEST DATA FACTORY
//
// Creates a plain object shaped like a User. We don't `new User()` because
// TypeORM entities have decorators and hooks that we don't want to trigger.
// The methods (isLocked, incrementLoginAttempts, etc.) are jest.fn() so we
// can assert on them.
// ─────────────────────────────────────────────────────────────────────────────
const createMockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1234',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    status: AccountStatus.ACTIVE,
    subscriptionTier: 'free',
    isActive: true,
    isEmailVerified: true,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
    loginAttempts: 0,
    lockedUntil: null,
    metadata: {},
    profilePicture: null,
    objectStorePublicId: null,
    lastLoginAt: null,
    isLocked: jest.fn().mockReturnValue(false),
    incrementLoginAttempts: jest.fn(),
    resetLoginAttempts: jest.fn(),
    ...overrides,
  }) as unknown as User;

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let tokenService: jest.Mocked<TokenService>;
  let securityService: jest.Mocked<SecurityService>;
  let otpVerificationService: jest.Mocked<OtpVerificationService>;
  let fileUploadService: jest.Mocked<FileUploadService>;
  let imagesService: jest.Mocked<ImagesService>;

  beforeEach(async () => {
    // ── Build mocks for every dependency ────────────────────────────────
    // TypeScript helper: jest.fn() returns `any`, but we cast the whole
    // object to the service's type so the compiler helps us catch typos.
    const mockRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockTokenService = {
      generateTokens: jest.fn(),
      revokeAllUserRefreshTokens: jest.fn(),
      revokeRefreshToken: jest.fn(),
      refreshAccessToken: jest.fn(),
    };

    const mockSecurityService = {
      recordLoginAttempt: jest.fn(),
      validateTwoFactor: jest.fn(),
    };

    const mockOtpService = {
      generateOtp: jest.fn(),
      verifyOtp: jest.fn(),
    };

    const mockFileUpload = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
      deleteImages: jest.fn(),
    };

    const mockImagesService = {
      removeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: TokenService, useValue: mockTokenService },
        { provide: SecurityService, useValue: mockSecurityService },
        { provide: OtpVerificationService, useValue: mockOtpService },
        { provide: FileUploadService, useValue: mockFileUpload },
        { provide: ImagesService, useValue: mockImagesService },
        {
          provide: ConfigService,
          useValue: {
            // bcryptSaltRounds is read via appConfig — we return
            // a deterministic number so tests don't depend on env.
            get: jest.fn((key: string) => {
              if (key === 'BCRYPT_ROUNDS') return '10';
              if (key === 'appConfig.auth.bcryptSaltRounds') return 10;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    tokenService = module.get(TokenService);
    securityService = module.get(SecurityService);
    otpVerificationService = module.get(OtpVerificationService);
    fileUploadService = module.get(FileUploadService);
    imagesService = module.get(ImagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // validateUser
  // ═════════════════════════════════════════════════════════════════════════
  describe('validateUser', () => {
    it('should return null when the email is not registered', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nobody@example.com', 'pass');

      expect(result).toBeNull();
      // Verify the email was lowercased in the query — case-insensitivity
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'nobody@example.com' },
      });
    });

    it('should throw UnauthorizedException when the account is locked', async () => {
      const lockedUser = createMockUser({
        isLocked: jest.fn().mockReturnValue(true),
      });
      userRepository.findOne.mockResolvedValue(lockedUser);

      await expect(
        service.validateUser('test@example.com', 'pass'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should increment login attempts and return null on wrong password', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('test@example.com', 'wrong');

      expect(result).toBeNull();
      expect(user.incrementLoginAttempts).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });

    it('should reset attempts and return the user (no passwordHash) on success', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'correct');

      expect(result).not.toBeNull();
      expect(result.passwordHash).toBeUndefined(); // Leak check
      expect(user.resetLoginAttempts).toHaveBeenCalledTimes(1);
      expect(userRepository.save).toHaveBeenCalledWith(user);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // register
  // ═════════════════════════════════════════════════════════════════════════
  describe('register', () => {
    const dto = {
      email: 'New@Example.com',
      username: 'NewUser',
      password: 'plain-password',
      firstName: 'New',
      lastName: 'User',
    };

    it('should throw ConflictException if a user with that email already exists', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());

      await expect(service.register(dto)).rejects.toThrow(ConflictException);

      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should lowercase email/username, hash the password, and create the user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      userRepository.create.mockReturnValue(createMockUser());
      userRepository.save.mockResolvedValue(createMockUser());
      otpVerificationService.generateOtp.mockResolvedValue({} as any);

      await service.register(dto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          username: 'newuser',
          passwordHash: 'hashed-password',
          isActive: false,
          isEmailVerified: false,
        }),
      );
    });

    it('should send a verification OTP after creating the user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      userRepository.create.mockReturnValue(createMockUser());
      userRepository.save.mockResolvedValue(createMockUser());
      otpVerificationService.generateOtp.mockResolvedValue({} as any);

      await service.register(dto);

      expect(otpVerificationService.generateOtp).toHaveBeenCalledWith(
        'test@example.com',
        'email_verification',
        expect.objectContaining({ sendEmail: true, length: 6, expiresIn: 15 }),
      );
    });

    it('should throw BadRequestException if OTP delivery fails', async () => {
      userRepository.findOne.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      userRepository.create.mockReturnValue(createMockUser());
      userRepository.save.mockResolvedValue(createMockUser());
      otpVerificationService.generateOtp.mockRejectedValue(
        new Error('Resend API down'),
      );

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // login
  // ═════════════════════════════════════════════════════════════════════════
  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'correct' };
    const request = {
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-tests' },
    } as any;

    it('should record a failed attempt and throw on invalid credentials', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login(dto, request)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(securityService.recordLoginAttempt).toHaveBeenCalledWith(
        null,
        '127.0.0.1',
        'jest-tests',
        false,
        'Invalid credentials',
      );
    });

    it('should throw if the email has not been verified', async () => {
      const unverified = createMockUser({ isEmailVerified: false });
      jest.spyOn(service, 'validateUser').mockResolvedValue(unverified as any);

      await expect(service.login(dto, request)).rejects.toThrow(
        /verify your email/i,
      );

      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    // 2FA is suspended so the test is skipped. The test will be Re-enabled when 
    // the login branch is uncommented in AuthService.login().
    it.skip('should return { requireTwoFactor } when 2FA is enabled', async () => {
      const user2fa = createMockUser({ isTwoFactorEnabled: true });
      jest.spyOn(service, 'validateUser').mockResolvedValue(user2fa as any);

      const result = await service.login(dto, request);

      expect(result).toEqual(
        expect.objectContaining({
          requireTwoFactor: true,
          userId: user2fa.id,
        }),
      );
      expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    it('should generate tokens and record a successful attempt on success', async () => {
      const user = createMockUser();
      jest.spyOn(service, 'validateUser').mockResolvedValue(user as any);
      tokenService.generateTokens.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      } as any);

      const result = await service.login(dto, request);

      expect(result).toEqual(
        expect.objectContaining({ accessToken: 'access', refreshToken: 'refresh' }),
      );
      expect(securityService.recordLoginAttempt).toHaveBeenCalledWith(
        user.id,
        '127.0.0.1',
        'jest-tests',
        true,
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // changePassword
  // ═════════════════════════════════════════════════════════════════════════
  describe('changePassword', () => {
    it('should throw NotFoundException if the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword('missing-id', 'old', 'new'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if the current password is wrong', async () => {
      userRepository.findOne.mockResolvedValue(createMockUser());
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword('user-uuid-1234', 'wrong', 'new'),
      ).rejects.toThrow(/Current password is incorrect/);
    });

    it('should hash the new password and revoke refresh tokens', async () => {
      const user = createMockUser();
      userRepository.findOne.mockResolvedValue(user);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('new-hashed' as never);

      await service.changePassword(user.id, 'old', 'new-password');

      expect(user.passwordHash).toBe('new-hashed');
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(tokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(
        user.id,
        'Password changed',
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // deleteUser
  // ═════════════════════════════════════════════════════════════════════════
  describe('deleteUser', () => {
    it('should refuse to delete your own account', async () => {
      await expect(
        service.deleteUser('same-id', 'same-id'),
      ).rejects.toThrow(/cannot delete your own account/);
    });

    it('should throw NotFoundException if the target user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteUser('missing-id', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should clean up Cloudinary assets BEFORE deleting the DB row', async () => {
      const user = createMockUser({
        objectStorePublicId: 'profile/abc',
      });
      userRepository.findOne.mockResolvedValue(user);
      imagesService.removeAllForUser.mockResolvedValue({ deleted: 3 });
      fileUploadService.deleteImage.mockResolvedValue(undefined);

      // Order matters — if removeAllForUser ran AFTER userRepository.remove,
      // the publicIds would be gone from the DB.
      const callOrder: string[] = [];
      imagesService.removeAllForUser.mockImplementation(async () => {
        callOrder.push('images');
        return { deleted: 3 };
      });
      userRepository.remove.mockImplementation(async () => {
        callOrder.push('user');
        return user;
      });

      await service.deleteUser('target-id', 'admin-id');

      expect(callOrder).toEqual(['images', 'user']);
      expect(imagesService.removeAllForUser).toHaveBeenCalledWith('target-id');
      expect(fileUploadService.deleteImage).toHaveBeenCalledWith('profile/abc');
    });

    it('should still delete the user if Cloudinary cleanup fails', async () => {
      const user = createMockUser({ objectStorePublicId: undefined });
      userRepository.findOne.mockResolvedValue(user);
      imagesService.removeAllForUser.mockRejectedValue(
        new Error('Cloudinary is down'),
      );

      await expect(
        service.deleteUser('target-id', 'admin-id'),
      ).resolves.toBeDefined();

      expect(userRepository.remove).toHaveBeenCalledWith(user);
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // createAdmin
  // ═════════════════════════════════════════════════════════════════════════
  describe('createAdmin', () => {
    const dto = {
      email: 'admin@example.com',
      username: 'admin2',
      password: 'password',
    };

    it('should throw UnauthorizedException if the creator is not an admin', async () => {
      userRepository.findOne.mockResolvedValue(
        createMockUser({ role: UserRole.USER }),
      );

      await expect(
        service.createAdmin(dto, 'creator-id'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ConflictException if the email already exists', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(createMockUser({ role: UserRole.ADMIN }))
        .mockResolvedValueOnce(createMockUser({ email: dto.email }));

      await expect(
        service.createAdmin(dto, 'creator-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create an active, verified admin', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(createMockUser({ role: UserRole.ADMIN }))
        .mockResolvedValueOnce(null);
      mockedBcrypt.hash.mockResolvedValue('hashed' as never);
      userRepository.create.mockReturnValue(createMockUser());
      userRepository.save.mockResolvedValue(createMockUser());

      await service.createAdmin(dto, 'creator-id');

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.ADMIN,
          status: AccountStatus.ACTIVE,
          isActive: true,
          isEmailVerified: true,
        }),
      );
    });
  });

  // ═════════════════════════════════════════════════════════════════════════
  // getUserById — sanitization check
  // ═════════════════════════════════════════════════════════════════════════
  describe('getUserById', () => {
    it('should return null when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      expect(await service.getUserById('missing')).toBeNull();
    });

    it('should never expose passwordHash or 2FA secrets', async () => {
      const user = createMockUser({
        twoFactorSecret: 'secret-xyz',
        twoFactorBackupCodes: ['code1', 'code2'],
      });
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getUserById(user.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('twoFactorSecret');
      expect(result).not.toHaveProperty('twoFactorBackupCodes');
    });
  });
});