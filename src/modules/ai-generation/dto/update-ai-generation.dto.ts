import { PartialType } from '@nestjs/mapped-types';
import { CreateAiGenerationDto } from './create-ai-generation.dto';

export class UpdateAiGenerationDto extends PartialType(CreateAiGenerationDto) {}
