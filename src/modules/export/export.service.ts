import { Injectable } from '@nestjs/common';
import { CreateExportDto } from './dto/create-export.dto';
import { UpdateExportDto } from './dto/update-export.dto';

@Injectable()
export class ExportService {
  create(createExportDto: CreateExportDto) {
    return 'This action adds a new export';
  }

  findAll() {
    return `This action returns all export`;
  }

  findOne(id: number) {
    return `This action returns a #${id} export`;
  }

  update(id: number, updateExportDto: UpdateExportDto) {
    return `This action updates a #${id} export`;
  }

  remove(id: number) {
    return `This action removes a #${id} export`;
  }
}
