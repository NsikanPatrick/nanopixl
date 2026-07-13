import { Injectable } from '@nestjs/common';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';

@Injectable()
export class PlatformsService {
  create(createPlatformDto: CreatePlatformDto) {
    return 'This action adds a new platform';
  }

  findAll() {
    return `This action returns all platforms`;
  }

  findOne(id: number) {
    return `This action returns a #${id} platform`;
  }

  update(id: number, updatePlatformDto: UpdatePlatformDto) {
    return `This action updates a #${id} platform`;
  }

  remove(id: number) {
    return `This action removes a #${id} platform`;
  }
}
