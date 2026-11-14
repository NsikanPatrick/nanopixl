import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImagesService } from './images.service';
import { Image } from './entities/image.entity';
import { User } from '../../core/auth/entities/user.entity';
import { FileUploadService } from '../../shared/file-upload/file-upload.service';
import { extractImageMetadata } from './utils/image-metadata.util';
import { computeFileHash } from './utils/file-hash.util';

// Mock the utility functions so we control the output
jest.mock('./utils/image-metadata.util');
jest.mock('./utils/file-hash.util');

describe('ImagesService', () => {
  let service: ImagesService;
  let imageRepository: jest.Mocked<Repository<Image>>;
  let fileUploadService: jest.Mocked<FileUploadService>;

  const mockUser = { id: 'user-uuid-1234' } as User;
  const mockFile = { buffer: Buffer.from('test'), size: 1024 } as Express.Multer.File;

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const mockFileUpload = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
      deleteImages: jest.fn(),
      deleteFolder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getRepositoryToken(Image), useValue: mockRepo },
        { provide: FileUploadService, useValue: mockFileUpload },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
    imageRepository = module.get(getRepositoryToken(Image));
    fileUploadService = module.get(FileUploadService);

    jest.clearAllMocks();
  });

  describe('uploadWithMeta', () => {
    it('should throw BadRequestException if image resolution is too low', async () => {
      // Mock metadata to return a 200x200 image
      (extractImageMetadata as jest.Mock).mockResolvedValue({ width: 200, height: 200, format: 'jpeg' });

      await expect(service.uploadWithMeta(mockUser, mockFile)).rejects.toThrow(BadRequestException);
      expect(fileUploadService.uploadImage).not.toHaveBeenCalled();
    });

    it('should return deduplicated: true if hash already exists in DB', async () => {
      (extractImageMetadata as jest.Mock).mockResolvedValue({ width: 500, height: 500, format: 'jpeg' });
      (computeFileHash as jest.Mock).mockReturnValue('existing-hash');

      // Mock DB to return an existing image
      imageRepository.findOne.mockResolvedValue({ id: 'existing-image-id' } as Image);

      const result = await service.uploadWithMeta(mockUser, mockFile);

      expect(result.deduplicated).toBe(true);
      expect(result.image.id).toBe('existing-image-id');
      expect(fileUploadService.uploadImage).not.toHaveBeenCalled(); // Should NOT upload to Cloudinary
    });

    it('should upload to Cloudinary and save to DB if new image', async () => {
      (extractImageMetadata as jest.Mock).mockResolvedValue({ width: 500, height: 500, format: 'jpeg' });
      (computeFileHash as jest.Mock).mockReturnValue('new-hash');

      imageRepository.findOne.mockResolvedValue(null); // No existing image
      fileUploadService.uploadImage.mockResolvedValue({ url: 'http://cloudinary.com/img.jpg', publicId: 'public-id' });
      imageRepository.create.mockReturnValue({ id: 'new-id' } as Image);
      imageRepository.save.mockResolvedValue({ id: 'new-id' } as Image);

      const result = await service.uploadWithMeta(mockUser, mockFile);

      expect(result.deduplicated).toBe(false);
      expect(fileUploadService.uploadImage).toHaveBeenCalled();
      expect(imageRepository.save).toHaveBeenCalled();
    });
  });

  describe('uploadBatch', () => {
    it('should throw BadRequestException if batch exceeds max files', async () => {
      const files = new Array(11).fill(mockFile);
      await expect(service.uploadBatch(mockUser, files)).rejects.toThrow(/Cannot upload more than/);
    });
  });

  describe('removeAllForUser', () => {
    it('should delete assets from Cloudinary and DB', async () => {
      const images = [{ id: '1', publicId: 'pub1' }, { id: '2', publicId: 'pub2' }] as Image[];
      imageRepository.find.mockResolvedValue(images);
      imageRepository.delete.mockResolvedValue({ affected: 2 } as any);

      const result = await service.removeAllForUser('user-uuid-1234');

      expect(fileUploadService.deleteImages).toHaveBeenCalledWith(['pub1', 'pub2']);
      expect(imageRepository.delete).toHaveBeenCalledWith({ userId: 'user-uuid-1234' });
      expect(result.deleted).toBe(2);
    });
  });
});