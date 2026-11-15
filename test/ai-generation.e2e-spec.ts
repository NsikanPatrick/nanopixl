import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { User, AccountStatus } from '../src/core/auth/entities/user.entity';
import { OtpVerificationService } from '../src/core/auth/services/otp-verification.service';
import { EmailService } from '../src/shared/email/email.service';
import { GoogleOAuthStrategy } from '../src/core/auth/strategies/oauth.strategy';
import { FileUploadService } from '../src/shared/file-upload/file-upload.service';
import { Image as ImageEntity } from '../src/modules/images/entities/image.entity';
import { AiGenerationService } from '../src/modules/ai-generation/ai-generation.service';

jest.setTimeout(30000);

describe('AiGeneration (E2E)', () => {
    let app: INestApplication;
    let dataSource: DataSource;
    let userToken: string;
    let imageId: string;

    beforeAll(async () => {
        // Create a fake generator that streams predictable JSON chunks
        const fakeGenerator = async function* () {
            const fakeJson = '{"productName":"Test AI Product","features":["Feature 1"],"targetAudience":"Devs","materials":"None","styleTags":["Tech"],"keywords":["test"],"description":"A description","seoTitle":"SEO Title"}';

            // Yield the string in two chunks to simulate streaming
            yield { chunk: fakeJson.slice(0, 20) };
            yield { chunk: fakeJson.slice(20) };

            // Yield the done event
            yield { done: true, generationId: 'fake-generation-id-1234' };
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(OtpVerificationService).useValue({ generateOtp: jest.fn(), verifyOtp: jest.fn().mockResolvedValue({ valid: true }) })
            .overrideProvider(EmailService).useValue({ sendOtpEmail: jest.fn() })
            .overrideProvider(GoogleOAuthStrategy).useValue({})
            .overrideProvider(FileUploadService).useValue({
                uploadImage: jest.fn().mockResolvedValue({ url: 'https://cloudinary.com/test.jpg', publicId: 'pub-id' }),
                deleteImage: jest.fn(), deleteImages: jest.fn(), deleteFolder: jest.fn()
            })
            // MOCK THE AI SERVICE
            .overrideProvider(AiGenerationService)
            .useValue({
                generateProductStream: jest.fn().mockImplementation(fakeGenerator),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        dataSource = app.get(DataSource);

        // 1. Seed User
        const userEmail = `e2e-ai-${Date.now()}@test.local`;
        const registerUser = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: userEmail, username: `aiuser${Date.now()}`, password: 'Password123!' })
            .expect(201);

        const userId = registerUser.body.userId;
        await dataSource.getRepository(User).update(userId, { isEmailVerified: true, isActive: true, status: AccountStatus.ACTIVE });

        const userLogin = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ email: userEmail, password: 'Password123!' });
        userToken = userLogin.body.accessToken;

        // 2. Seed an Image directly in the DB
        const imageRepo = dataSource.getRepository(ImageEntity);
        const savedImage = await imageRepo.save({
            userId: userId,
            originalName: 'test.jpg',
            storagePath: 'https://cloudinary.com/test.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 1024,
            width: 500,
            height: 500,
            hash: 'test-hash',
            isProcessed: true,
        });
        imageId = savedImage.id;
    });

    afterAll(async () => {
        if (dataSource?.isInitialized) {
            await dataSource.query(`DELETE FROM users WHERE email LIKE 'e2e-ai-%@test.local'`);
        }
        if (app) await app.close();
    });

    it('should stream AI generation data (SSE)', async () => {
        const res = await request(app.getHttpServer())
            .post('/ai-generation/generate')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                imageId: imageId,
                tone: 'professional',
                platform: 'shopify',
                language: 'en-US',
            })
            .buffer(true)
            .parse((res, callback) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => callback(null, data));
            })
            .expect(201);

        // Parse the SSE string output
        const responseText = res.body.toString();

        // Assert on the SSE stream format
        expect(responseText).toContain('data: {"chunk":"');
        expect(responseText).toContain('"done":true,"generationId":"fake-generation-id-1234"');
    });
});