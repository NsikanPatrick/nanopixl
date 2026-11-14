import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { User, UserRole, AccountStatus } from '../src/core/auth/entities/user.entity';
import { OtpVerificationService } from '../src/core/auth/services/otp-verification.service';
import { EmailService } from '../src/shared/email/email.service';
import { AiGenerationService } from '../src/modules/ai-generation/ai-generation.service';
import { GoogleOAuthStrategy } from '../src/core/auth/strategies/oauth.strategy';

jest.setTimeout(30000);

describe('Auth (E2E)', () => {
    let app: INestApplication;
    let dataSource: DataSource;

    // Shared state between tests — set up in beforeAll, cleaned in afterAll
    let userToken: string;
    let adminToken: string;
    let userId: string;
    let adminId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(OtpVerificationService)
            .useValue({
                generateOtp: jest.fn().mockResolvedValue({ code: '123456', otp: {} }),
                verifyOtp: jest.fn().mockResolvedValue({ valid: true, otp: {} }),
            })
            .overrideProvider(EmailService)
            .useValue({
                sendOtpEmail: jest.fn().mockResolvedValue(true),
            })
            .overrideProvider(AiGenerationService)
            .useValue({
                generateProductStream: jest.fn(),
            })
            .overrideProvider(GoogleOAuthStrategy)
            .useValue({})
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
        dataSource = app.get(DataSource);
    });

    beforeAll(async () => {
        const userEmail = `e2e-user-${Date.now()}@test.local`;
        const userName = `e2euser${Date.now()}`;

        // Register User
        const registerUser = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: userEmail,
                username: userName,
                password: 'Password123!',
                firstName: 'E2E',
                lastName: 'User',
            })
            .expect(201);

        userId = registerUser.body.userId;

        // Mark as verified
        await dataSource.getRepository(User).update(userId, {
            isEmailVerified: true,
            isActive: true,
            status: AccountStatus.ACTIVE,
        });

        // Login User
        const userLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: userEmail, password: 'Password123!' })
            .expect(200);

        userToken = userLogin.body.accessToken;

        // Register Admin
        const adminEmail = `e2e-admin-${Date.now()}@test.local`;
        const adminName = `e2eadmin${Date.now()}`;

        const registerAdmin = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: adminEmail,
                username: adminName,
                password: 'Password123!',
                firstName: 'E2E',
                lastName: 'Admin',
            })
            .expect(201);

        adminId = registerAdmin.body.userId;

        // Mark as Admin and verified
        await dataSource.getRepository(User).update(adminId, {
            role: UserRole.ADMIN,
            isEmailVerified: true,
            isActive: true,
            status: AccountStatus.ACTIVE,
        });

        // Login Admin
        const adminLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: adminEmail, password: 'Password123!' })
            .expect(200);

        adminToken = adminLogin.body.accessToken;
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-%@test.local'`);
        }
        if (app) {
            await app.close();
        }
    });

    describe('Guard chain — I already hit this bug once', () => {
        it('should return 401 when no token is provided', async () => {
            await request(app.getHttpServer())
                .get('/auth/profile')
                .expect(401);
        });

        it('should return 401 when the token is malformed', async () => {
            await request(app.getHttpServer())
                .get('/auth/profile')
                .set('Authorization', 'Bearer not-a-real-token')
                .expect(401);
        });

        it('should return 200 on a protected route with a valid user token', async () => {
            await request(app.getHttpServer())
                .get('/auth/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);
        });

        it('should return 403 when a regular user hits an admin route', async () => {
            await request(app.getHttpServer())
                .get('/auth/admin/users')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);
        });

        it('should return 200 when an admin hits an admin route', async () => {
            await request(app.getHttpServer())
                .get('/auth/admin/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
        });

        it('should reflect the correct role in the JWT payload', async () => {
            const payload = JSON.parse(
                Buffer.from(adminToken.split('.')[1], 'base64').toString(),
            );
            expect(payload.roles).toContain(UserRole.ADMIN);
            expect(payload.roles).not.toContain('free');
        });
    });

    describe('Response sanitization', () => {
        it('should not expose passwordHash, twoFactorSecret, or backup codes', async () => {
            const res = await request(app.getHttpServer())
                .get('/auth/profile')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body).not.toHaveProperty('passwordHash');
            expect(res.body).not.toHaveProperty('twoFactorSecret');
            expect(res.body).not.toHaveProperty('twoFactorBackupCodes');
        });
    });

    describe('Validation', () => {
        it('should reject registration with an invalid email', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    email: 'not-an-email',
                    username: 'e2ebad',
                    password: 'Password123!',
                })
                .expect(400);
        });

        it('should reject registration with a short password', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send({
                    email: `e2e-short-${Date.now()}@test.local`,
                    username: `e2eshort${Date.now()}`,
                    password: '123',
                })
                .expect(400);
        });

        it('should reject login with missing fields', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'only@email.com' })
                .expect(400);
        });
    });

    describe('Admin self-delete protection', () => {
        it('should return 400 when an admin tries to delete their own account', async () => {
            await request(app.getHttpServer())
                .delete(`/auth/admin/users/${adminId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(400);
        });
    });
});