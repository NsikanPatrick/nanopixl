import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { AppModule } from '../src/app.module';
import { User, UserRole, AccountStatus } from '../src/core/auth/entities/user.entity';
import { OtpVerificationService } from '../src/core/auth/services/otp-verification.service';
import { EmailService } from '../src/shared/email/email.service';
import { AiGenerationService } from '../src/modules/ai-generation/ai-generation.service';
import { GoogleOAuthStrategy } from '../src/core/auth/strategies/oauth.strategy';
import { FileUploadService } from '../src/shared/file-upload/file-upload.service';
import { Image } from '../src/modules/images/entities/image.entity';

jest.setTimeout(30000);

describe('Images (E2E)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userToken: string;
    let userId: string;

    // Create a dummy image file buffer for testing 
    let dummyImageBuffer: Buffer;

    // (a 1x1 transparent PNG) - The 1x1 didnt work because the service expected 500x500
    // const dummyImageBuffer = Buffer.from(
    //     'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    //     'base64'
    // );

    
    beforeAll(async () => {
        // GENERATE A VALID 500x500 PNG BUFFER FOR TESTING
        dummyImageBuffer = await sharp({
            create: {
                width: 500,
                height: 500,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 1 }
            }
        }).png().toBuffer();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(OtpVerificationService).useValue({ generateOtp: jest.fn(), verifyOtp: jest.fn().mockResolvedValue({ valid: true }) })
            .overrideProvider(EmailService).useValue({ sendOtpEmail: jest.fn() })
            .overrideProvider(AiGenerationService).useValue({ generateProductStream: jest.fn() })
            .overrideProvider(GoogleOAuthStrategy).useValue({})
            // MOCK CLOUDINARY SO WE DON'T ACTUALLY UPLOAD TO THE CLOUD DURING TESTS
            .overrideProvider(FileUploadService)
            .useValue({
                uploadImage: jest.fn().mockResolvedValue({ url: 'https://cloudinary.com/test.jpg', publicId: 'test-public-id' }),
                deleteImage: jest.fn().mockResolvedValue(true),
                deleteImages: jest.fn().mockResolvedValue(true),
                deleteFolder: jest.fn().mockResolvedValue(true),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        dataSource = app.get(DataSource);

        // Seed a user
        const userEmail = `e2e-img-user-${Date.now()}@test.local`;
        const registerUser = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: userEmail, username: `imguser${Date.now()}`, password: 'Password123!' })
            .expect(201);

        userId = registerUser.body.userId;
        await dataSource.getRepository(User).update(userId, { isEmailVerified: true, isActive: true, status: AccountStatus.ACTIVE });

        const userLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: userEmail, password: 'Password123!' })
            .expect(200);

        userToken = userLogin.body.accessToken;
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            // Cascade delete will remove images tied to this user
            await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-img-user-%@test.local'`);
        }
        if (app) await app.close();
    });

    describe('POST /images (Upload)', () => {
        it('should reject upload without auth token (401)', async () => {
            await request(app.getHttpServer())
                .post('/images')
                .attach('file', dummyImageBuffer, 'test.png')
                .expect(401);
        });

        it('should upload an image successfully (201)', async () => {
            const res = await request(app.getHttpServer())
                .post('/images')
                .set('Authorization', `Bearer ${userToken}`)
                .attach('file', dummyImageBuffer, 'test.png')
                .expect(201);

            expect(res.body.id).toBeDefined();
            expect(res.body.storagePath).toBe('https://cloudinary.com/test.jpg');
            expect(res.body.publicId).toBe('test-public-id');
        });
    });

    describe('GET /images', () => {
        it('should list all images for the user', async () => {
            const res = await request(app.getHttpServer())
                .get('/images')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.data.length).toBeGreaterThan(0);
            expect(res.body.data[0].storagePath).toBeDefined();
        });
    });

    describe('DELETE /images', () => {
        it('should delete all images for the user', async () => {
            const res = await request(app.getHttpServer())
                .delete('/images')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(res.body.deleted).toBeGreaterThan(0);

            // Verify DB is empty for this user
            const remaining = await dataSource.getRepository(Image).count({ where: { userId } });
            expect(remaining).toBe(0);
        });
    });
});