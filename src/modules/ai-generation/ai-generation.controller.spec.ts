import { Test, TestingModule } from '@nestjs/testing';
import { AiGenerationController } from './ai-generation.controller';
import { AiGenerationService } from './ai-generation.service';

describe('AiGenerationController', () => {
  let controller: AiGenerationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiGenerationController],
      providers: [AiGenerationService],
    }).compile();

    controller = module.get<AiGenerationController>(AiGenerationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
