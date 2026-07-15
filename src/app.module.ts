
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { databaseConfig } from './shared/config/database.config';
import appConfig from './shared/config/app.config';

// Import all modules
import { UsersModule } from './core/users/users.module';
import { ImagesModule } from './modules/images/images.module';
import { AiGenerationModule } from './modules/ai-generation/ai-generation.module';
import { DraftsModule } from './modules/drafts/drafts.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { HistoryModule } from './modules/history/history.module';
import { BatchModule } from './modules/batch/batch.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExportModule } from './modules/export/export.module';

// Import Controller and Service
import { AppController } from './app.controller';
import { AppService } from './app.service';


@Module({
  imports: [
    ConfigModule.forRoot({
      load: [databaseConfig, appConfig],
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 2. Rate Limiting -> 10 req/min
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 10,
        },
      ],
    }),

    // 3. Cache module
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,
      max: 100, // Items in the cache
    }),

    // 4. Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
    }),

    // 5. Scheduled tasks
    ScheduleModule.forRoot(),

    // 6. Feature and utility modules (Feature - AuthModule & UserModule), (Utility - EventsModule and EmailModule)
    UsersModule,
    ImagesModule,
    AiGenerationModule,
    DraftsModule,
    TemplatesModule,
    PlatformsModule,
    HistoryModule,
    BatchModule,
    AnalyticsModule,
    ExportModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }