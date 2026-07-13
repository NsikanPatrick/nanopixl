import { Injectable } from '@nestjs/common';
import { CreateSeoIntelDto } from './dto/create-seo-intel.dto';
import { UpdateSeoIntelDto } from './dto/update-seo-intel.dto';

@Injectable()
export class SeoIntelService {
  create(createSeoIntelDto: CreateSeoIntelDto) {
    return 'This action adds a new seoIntel';
  }

  findAll() {
    return `This action returns all seoIntel`;
  }

  findOne(id: number) {
    return `This action returns a #${id} seoIntel`;
  }

  update(id: number, updateSeoIntelDto: UpdateSeoIntelDto) {
    return `This action updates a #${id} seoIntel`;
  }

  remove(id: number) {
    return `This action removes a #${id} seoIntel`;
  }
}
