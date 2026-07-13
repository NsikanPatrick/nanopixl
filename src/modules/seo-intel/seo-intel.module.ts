import { Module } from '@nestjs/common';
import { SeoIntelService } from './seo-intel.service';
import { SeoIntelController } from './seo-intel.controller';

@Module({
  controllers: [SeoIntelController],
  providers: [SeoIntelService],
})
export class SeoIntelModule {}
