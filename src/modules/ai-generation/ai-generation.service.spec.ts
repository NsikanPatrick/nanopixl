import { Test, TestingModule } from '@nestjs/testing';
import { AiGenerationService } from './ai-generation.service';

describe('AiGenerationService', () => {
  let service: AiGenerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiGenerationService],
    }).compile();

    service = module.get<AiGenerationService>(AiGenerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
