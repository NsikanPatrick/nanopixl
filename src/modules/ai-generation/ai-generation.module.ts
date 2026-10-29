import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGenerationService } from './ai-generation.service';
import { AiGenerationController } from './ai-generation.controller';
import { Generation } from './entities/ai-generation.entity';
import { Image } from '../images/entities/image.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Generation, Image]), 
  ],
  controllers: [AiGenerationController],
  providers: [AiGenerationService],
  exports: [AiGenerationService],
})
export class AiGenerationModule { }
