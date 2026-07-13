import { Test, TestingModule } from '@nestjs/testing';
import { SeoIntelController } from './seo-intel.controller';
import { SeoIntelService } from './seo-intel.service';

describe('SeoIntelController', () => {
  let controller: SeoIntelController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeoIntelController],
      providers: [SeoIntelService],
    }).compile();

    controller = module.get<SeoIntelController>(SeoIntelController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
