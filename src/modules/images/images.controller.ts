import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { User } from '../../core/auth/entities/user.entity';

@Controller('images')
@UseGuards(JwtAuthGuard)
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) { }

  /* ================== Upload an image ==================
  POST /images
  Body: multipart/form-data with a single `file` field. */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new Error('Only JPG, PNG, and WEBP are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.imagesService.upload(user, file);
  }

  /* ================== List my images ==================
  GET /images?page=1&limit=20 */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.imagesService.findAll(user.id, +page, +limit);
  }

  /* ================== Get one image ==================
  GET /images/:id */
  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.imagesService.findOne(user.id, id);
  }

  /* ================== Delete an image ==================
  DELETE /images/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.imagesService.remove(user.id, id);
  }
}