import { Controller, Post, Body, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AiGenerationService } from './ai-generation.service';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { User } from '../../core/auth/entities/user.entity';
import { GenerateProductDto } from './dto/generate-product.dto';

@Controller('ai-generation')
@UseGuards(JwtAuthGuard)
export class AiGenerationController {
  constructor(private readonly aiService: AiGenerationService) { }

  @Post('generate')
  async generate(
    @CurrentUser() user: User,
    @Body() dto: GenerateProductDto,
    @Res() res: Response,
  ) {
    // 1. Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const stream = this.aiService.generateProductStream(
        user, dto.imageId, dto.tone, dto.platform, dto.language,
      );

      for await (const event of stream) {
        // Format as SSE: "data: {...}\n\n"
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    } finally {
      res.end();
    }
  }
}

// ai-generation controller => Uses Query mthd to accept parameters, then stream outputs via Server Sent Events(SSE)
// import { BadRequestException, Controller, Get, Query, Sse, MessageEvent, UseGuards } from '@nestjs/common';
// import { Observable, from } from 'rxjs';
// import { map } from 'rxjs/operators';
// import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
// import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
// import { User } from '../../core/auth/entities/user.entity';
// import { AiGenerationService } from './ai-generation.service';
// import { PLATFORM_CONSTRAINTS, SupportedPlatform } from './constants/platform.constants';

// const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_CONSTRAINTS) as SupportedPlatform[];

// @Controller('ai-generation')
// @UseGuards(JwtAuthGuard)
// export class AiGenerationController {
//   constructor(private readonly aiService: AiGenerationService) { }

//   @Sse('generate')
//   generate(
//     @CurrentUser() user: User,
//     @Query('imageId') imageId: string,
//     @Query('tone') tone: string,
//     @Query('platform') platform: string,
//     @Query('language') language: string,
//   ): Observable<MessageEvent> {
//     // Validate the platform BEFORE starting the stream.
//     // Errors are thrown synchronously — Nest will return a 400 before headers are sent.
//     if (!SUPPORTED_PLATFORMS.includes(platform as SupportedPlatform)) {
//       throw new BadRequestException(
//         `Invalid platform. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`,
//       );
//     }

//     const generator = this.aiService.generateProductStream(
//       user,
//       imageId,
//       tone,
//       platform as SupportedPlatform,
//       language,
//     );

//     return from(generator).pipe(map((event) => ({ data: event })));
//   }
// }