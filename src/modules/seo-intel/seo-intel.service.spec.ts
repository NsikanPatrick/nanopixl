import { Test, TestingModule } from '@nestjs/testing';
import { SeoIntelService } from './seo-intel.service';

describe('SeoIntelService', () => {
  let service: SeoIntelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeoIntelService],
    }).compile();

    service = module.get<SeoIntelService>(SeoIntelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
