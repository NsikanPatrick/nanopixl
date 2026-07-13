import { PartialType } from '@nestjs/mapped-types';
import { CreateSeoIntelDto } from './create-seo-intel.dto';

export class UpdateSeoIntelDto extends PartialType(CreateSeoIntelDto) {}
