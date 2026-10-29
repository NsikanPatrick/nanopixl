// With retry logic = Slower Time To First Token (TTFT)
// import { Injectable, Logger } from '@nestjs/common';
// import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
// import { ConfigService } from '@nestjs/config';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Generation } from './entities/ai-generation.entity';
// import { Image } from '../images/entities/image.entity';
// import { productOutputJsonSchema } from './schemas/product-output.schema';
// import { PLATFORM_CONSTRAINTS, SupportedPlatform } from './constants/platform.constants';
// import { ThinkingLevel } from '@google/genai';

// @Injectable()
// export class AiGenerationService {
//   private readonly logger = new Logger(AiGenerationService.name);
//   private readonly ai: GoogleGenAI;
//   private readonly model: string;

//   // Retry configuration (Should be moved to env file)
//   private static readonly MAX_RETRIES = 2;
//   private static readonly RETRY_BASE_DELAY_MS = 500; // 500ms, then 1000ms

//   constructor(
//     private readonly configService: ConfigService,
//     @InjectRepository(Generation) private readonly generationRepo: Repository<Generation>,
//     @InjectRepository(Image) private readonly imageRepo: Repository<Image>,
//   ) {
//     this.ai = new GoogleGenAI({ apiKey: this.configService.getOrThrow('GEMINI_API_KEY') });
//     this.model = this.configService.get('GEMINI_MODEL', 'gemini-3.5-flash-lite');
//   }

//   async *generateProductStream(
//     user: any,
//     imageId: string,
//     tone: string,
//     platform: SupportedPlatform,
//     language: string,
//   ): AsyncGenerator<{ chunk: string } | { done: true; generationId: string }> {
//     // 1. Fetch image & validate ownership
//     const image = await this.imageRepo.findOne({ where: { id: imageId, userId: user.id } });
//     if (!image) throw new Error('Image not found or access denied');

//     // 2. Build the prompt with platform constraints
//     const constraints = PLATFORM_CONSTRAINTS[platform];
//     const prompt = this.buildPrompt(image, tone, language, constraints);

//     // 3. Call Gemini with retry logic (delegated to helper method that actually calls gemini with retry, its below)
//     const stream = await this.createGeminiStreamWithRetry(prompt);

//     let fullJsonString = '';
//     for await (const chunk of stream) {
//       if (chunk.text) {
//         fullJsonString += chunk.text;
//         yield { chunk: chunk.text }; // Stream partial JSON to client
//       }
//     }

//     // 4. Stream finished: Parse and Persist to database
//     try {
//       const parsed = JSON.parse(fullJsonString);
//       const generation = this.generationRepo.create({
//         userId: user.id,
//         primaryImageId: image.id,
//         tone,
//         platform,
//         language,
//         productName: parsed.productName,
//         productFeatures: JSON.stringify(parsed.features),
//         targetAudience: parsed.targetAudience,
//         materialsUsed: parsed.materials,
//         styleTags: JSON.stringify(parsed.styleTags),
//         keywords: JSON.stringify(parsed.keywords),
//         optimizedDescription: parsed.description,
//         seoTitle: parsed.seoTitle,
//         isDraft: false,
//       });
//       const saved = await this.generationRepo.save(generation);
//       yield { done: true, generationId: saved.id };
//     } catch (parseError) {
//       this.logger.error('Failed to parse Gemini JSON output', parseError);
//       throw new Error('AI generated invalid JSON. Please try again.');
//     }
//   }

//   /** Wrapper around generateContentStream with retry logic.
//    *
//    * Retries on transient errors only:
//    *   - 429 (rate limit / RESOURCE_EXHAUSTED)
//    *   - 500 (internal server error)
//    *   - 503 (service unavailable)
//    *
//    * Does NOT retry on:
//    *   - 400 (bad request — invalid schema, malformed prompt - Invalid inputs cannot self-correct)
//    *   - 401/403 (auth — bad API key)
//    *   - 404 (model not found)
//    *
//    * Uses exponential backoff: 500ms → 1000ms.
//    *
//    * NOTE: This only handles failures BEFORE the stream starts. If Gemini
//    * fails mid-stream, the error propagates from the `for await` loop and
//    * cannot be resumed — the frontend must retry the whole request.
//    */
//   private async createGeminiStreamWithRetry(
//     prompt: any[],
//   ): Promise<AsyncIterable<GenerateContentResponse>> {
//     for (let attempt = 0; attempt <= AiGenerationService.MAX_RETRIES; attempt++) {
//       try {
//         return await this.ai.models.generateContentStream({
//           model: this.model,
//           contents: prompt,
//           config: {
//             responseMimeType: 'application/json',
//             responseSchema: productOutputJsonSchema as any,
//             temperature: 0.7,
//             thinkingConfig: {
//               thinkingLevel: ThinkingLevel.MINIMAL,
//             },
//           },
//         });
//       } catch (error) {
//         // Extract HTTP status from various error shapes the SDK might throw
//         const status =
//           error?.status ??
//           error?.code ??
//           error?.response?.status ??
//           error?.error?.code;

//         const isRetryable =
//           status === 429 || // Rate limited
//           status === 500 || // Server error
//           status === 503;   // Service unavailable

//         const isLastAttempt = attempt === AiGenerationService.MAX_RETRIES;

//         if (!isRetryable || isLastAttempt) {
//           this.logger.error(
//             `Gemini call failed after ${attempt + 1} attempt(s) ` +
//             `(status=${status ?? 'unknown'}): ${error.message}`,
//           );
//           throw error;
//         }

//         // Exponential backoff: 500ms, 1000ms, 2000ms, ...
//         const delay =
//           AiGenerationService.RETRY_BASE_DELAY_MS * Math.pow(2, attempt);

//         this.logger.warn(
//           `Gemini returned ${status} — retrying in ${delay}ms ` +
//           `(attempt ${attempt + 1}/${AiGenerationService.MAX_RETRIES + 1})`,
//         );

//         await new Promise((resolve) => setTimeout(resolve, delay));
//       }
//     }

//     // TypeScript needs this — the loop always returns or throws
//     throw new Error('Unreachable: retry loop exhausted');
//   }

//   private buildPrompt(image: Image, tone: string, language: string, constraints: any): any[] {
//     const textPrompt = `You are an expert e-commerce copywriter. Analyze this image and generate product data.
//     Tone: ${tone}. Language: ${language}.
//     Platform limits: Title <= ${constraints.titleMaxLength} chars.
//     Return JSON matching the provided schema.`;

//     // Gemini accepts image URLs as parts in the content array
//     return [
//       { text: textPrompt },
//       { fileData: { fileUri: image.storagePath, mimeType: image.mimeType } },
//     ];
//   }
// }


// Without retry logic = Faster Time To First Token (TTFT)
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Generation } from './entities/ai-generation.entity';
import { Image } from '../images/entities/image.entity';
import { productOutputJsonSchema } from './schemas/product-output.schema';
import { PLATFORM_CONSTRAINTS, SupportedPlatform } from './constants/platform.constants';
import { ThinkingLevel } from '@google/genai';

@Injectable()
export class AiGenerationService {
  private readonly logger = new Logger(AiGenerationService.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Generation) private readonly generationRepo: Repository<Generation>,
    @InjectRepository(Image) private readonly imageRepo: Repository<Image>,
  ) {
    this.ai = new GoogleGenAI({ apiKey: this.configService.getOrThrow('GEMINI_API_KEY') });
    this.model = this.configService.get('GEMINI_MODEL', 'gemini-3.5-flash-lite');
  }

  async *generateProductStream(
    user: any,
    imageId: string,
    tone: string,
    platform: SupportedPlatform,
    language: string,
  ): AsyncGenerator<{ chunk: string } | { done: true; generationId: string }> {
    // 1. Fetch image & validate ownership
    const image = await this.imageRepo.findOne({ where: { id: imageId, userId: user.id } });
    if (!image) throw new Error('Image not found or access denied');

    // 2. Build the prompt with platform constraints
    const constraints = PLATFORM_CONSTRAINTS[platform];
    const prompt = this.buildPrompt(image, tone, language, constraints);

    // 3. Call Gemini with streaming and structured output
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: productOutputJsonSchema as any,
        temperature: 0.7,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL, 
        },
      },
    });

    let fullJsonString = '';
    for await (const chunk of stream) {
      if (chunk.text) {
        fullJsonString += chunk.text;
        yield { chunk: chunk.text }; // Stream partial JSON to client
      }
    }

    // 4. Stream finished: Parse and Persist
    try {
      const parsed = JSON.parse(fullJsonString);
      const generation = this.generationRepo.create({
        userId: user.id,
        primaryImageId: image.id,
        tone,
        platform,
        language,
        productName: parsed.productName,
        productFeatures: JSON.stringify(parsed.features),
        targetAudience: parsed.targetAudience,
        materialsUsed: parsed.materials,
        styleTags: JSON.stringify(parsed.styleTags),
        keywords: JSON.stringify(parsed.keywords),
        optimizedDescription: parsed.description,
        seoTitle: parsed.seoTitle,
        isDraft: false,
      });
      const saved = await this.generationRepo.save(generation);
      yield { done: true, generationId: saved.id };
    } catch (parseError) {
      this.logger.error('Failed to parse Gemini JSON output', parseError);
      throw new Error('AI generated invalid JSON. Please try again.');
    }
  }

  private buildPrompt(image: Image, tone: string, language: string, constraints: any): any[] {
    const textPrompt = `You are an expert e-commerce copywriter. Analyze this image and generate product data.
    Tone: ${tone}. Language: ${language}.
    Platform limits: Title <= ${constraints.titleMaxLength} chars.
    Return JSON matching the provided schema.`;

    // Gemini accepts image URLs as parts in the content array
    return [
      { text: textPrompt },
      { fileData: { fileUri: image.storagePath, mimeType: image.mimeType } },
    ];
  }
}