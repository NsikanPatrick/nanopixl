import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { AiGenerationService } from './ai-generation.service';
import { Generation } from './entities/ai-generation.entity';
import { Image } from '../images/entities/image.entity';
import { PLATFORM_CONSTRAINTS } from './constants/platform.constants';

// Mock the GoogleGenAI SDK
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContentStream: jest.fn(),
      },
    })),
    ThinkingLevel: { MINIMAL: 'minimal' },
  };
});

describe('AiGenerationService', () => {
  let service: AiGenerationService;
  let generationRepo: jest.Mocked<Repository<Generation>>;
  let imageRepo: jest.Mocked<Repository<Image>>;
  let mockAi: any;

  const mockUser = { id: 'user-uuid-1234' } as any;
  const mockImage = {
    id: 'image-uuid-1234',
    userId: 'user-uuid-1234',
    storagePath: 'https://cloudinary.com/img.jpg',
    mimeType: 'image/jpeg',
  } as Image;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiGenerationService,
        { provide: getRepositoryToken(Generation), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(Image), useValue: { findOne: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('fake-api-key'), get: jest.fn().mockReturnValue('gemini-3.5-flash-lite') } },
      ],
    }).compile();

    service = module.get<AiGenerationService>(AiGenerationService);
    generationRepo = module.get(getRepositoryToken(Generation));
    imageRepo = module.get(getRepositoryToken(Image));

    // Grab the mocked instance of the AI client
    mockAi = (service as any).ai;
  });

  it('should throw error if image is not found or belongs to another user', async () => {
    imageRepo.findOne.mockResolvedValue(null);

    const generator = service.generateProductStream(mockUser, 'bad-id', 'professional', 'shopify', 'en');
    await expect(generator.next()).rejects.toThrow('Image not found or access denied');
  });

  it('should handle retries on transient Gemini errors (503)', async () => {
    imageRepo.findOne.mockResolvedValue(mockImage);

    // Fail twice, succeed on the 3rd try
    mockAi.models.generateContentStream
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce((async function* () { yield { text: '{"productName":"Test"}' }; })());

    // Mock the DB save so the service doesn't crash on `saved.id`
    generationRepo.create.mockReturnValue({ id: 'retry-gen-id' } as Generation);
    generationRepo.save.mockResolvedValue({ id: 'retry-gen-id' } as Generation); 
    const generator = service.generateProductStream(mockUser, mockImage.id, 'professional', 'shopify', 'en');

    // We have to iterate through the generator to trigger the logic
    let result: any;
    for await (const chunk of generator) { result = chunk; }

    expect(mockAi.models.generateContentStream).toHaveBeenCalledTimes(3);
    // The final chunk should be the "done" event
    expect(result.done).toBe(true);
    expect(result.generationId).toBe('retry-gen-id'); // Verify it used the mock
  });

  it('should NOT retry on 400 Bad Request errors', async () => {
    imageRepo.findOne.mockResolvedValue(mockImage);
    mockAi.models.generateContentStream.mockRejectedValueOnce({ status: 400 });

    const generator = service.generateProductStream(mockUser, mockImage.id, 'professional', 'shopify', 'en');

    await expect(generator.next()).rejects.toEqual({ status: 400 });
    expect(mockAi.models.generateContentStream).toHaveBeenCalledTimes(1); // Should only try once
  });

  it('should stream chunks, parse them, and save to database', async () => {
    imageRepo.findOne.mockResolvedValue(mockImage);

    const fakeJson = '{"productName":"Test","features":["a"],"styleTags":["b"],"keywords":["c"],"targetAudience":"x","materials":"y","description":"z","seoTitle":"t"}';

    // Simulate streaming by yielding chunks
    mockAi.models.generateContentStream.mockResolvedValueOnce((async function* () {
      yield { text: fakeJson.slice(0, 10) };
      yield { text: fakeJson.slice(10) };
    })());

    generationRepo.create.mockReturnValue({ id: 'gen-id-123' } as Generation);
    generationRepo.save.mockResolvedValue({ id: 'gen-id-123' } as Generation);

    const generator = service.generateProductStream(mockUser, mockImage.id, 'professional', 'shopify', 'en');

    // Define the exact type of the yielded chunks
    type ChunkType = Awaited<ReturnType<typeof generator.next>>['value'];

    const chunks: ChunkType[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // Expect 2 text chunks + 1 done chunk
    expect(chunks.length).toBe(3);

    // TypeScript needs a type guard here because ChunkType is a union
    const firstChunk = chunks[0] as { chunk: string };
    expect(firstChunk.chunk).toBe(fakeJson.slice(0, 10));

    const lastChunk = chunks[2] as { done: true; generationId: string };
    expect(lastChunk.done).toBe(true);
    expect(lastChunk.generationId).toBe('gen-id-123');

    expect(generationRepo.save).toHaveBeenCalled();
  
  });
});