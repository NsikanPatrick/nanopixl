import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SeoIntelService } from './seo-intel.service';
import { CreateSeoIntelDto } from './dto/create-seo-intel.dto';
import { UpdateSeoIntelDto } from './dto/update-seo-intel.dto';

@Controller('seo-intel')
export class SeoIntelController {
  constructor(private readonly seoIntelService: SeoIntelService) {}

  @Post()
  create(@Body() createSeoIntelDto: CreateSeoIntelDto) {
    return this.seoIntelService.create(createSeoIntelDto);
  }

  @Get()
  findAll() {
    return this.seoIntelService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.seoIntelService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSeoIntelDto: UpdateSeoIntelDto) {
    return this.seoIntelService.update(+id, updateSeoIntelDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.seoIntelService.remove(+id);
  }
}
