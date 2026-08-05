import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@/common/pipes';
import { ContentTypeGuard } from '@/common/guards';
import { GlobalExceptionFilter } from '@/common/filters';
import { PrismaService } from '@/database/prisma.service';

/**
 * Integration test module factory.
 * Creates a fully configured NestJS application instance
 * connected to real PostgreSQL and Redis (from Docker Compose).
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  module: TestingModule;
}> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(ConfigModule)
    .useModule(
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env.test', '.env.development'],
        ignoreEnvFile: false,
        validationOptions: {
          abortEarly: false,
          allowUnknown: true,
        },
      }),
    )
    .compile();

  const app = module.createNestApplication();

  // Mirror main.ts configuration
  app.use(express.json({ limit: '1mb' }));

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/(.*)', method: 0 },
    ],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalGuards(new ContentTypeGuard());

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.init();

  return { app, module };
}

/**
 * Cleans up test data between tests.
 * Truncates all tables in the correct order respecting FK constraints.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "WebhookEvent", "AuditLog", "Enquiry", "Property" CASCADE;
  `);
}

/**
 * Flushes Redis test data.
 */
export async function flushRedis(redis: any): Promise<void> {
  try {
    await redis.flushdb();
  } catch {
    // Redis may not be available — ignore in test cleanup
  }
}
