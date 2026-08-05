import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { ContentTypeGuard } from './common/guards';
import { SanitizationPipe } from './common/pipes';
import { GlobalExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Body size limit: reject payloads exceeding 1MB (returns 413)
  app.use(express.json({ limit: '1mb' }));

  // Security headers via Helmet with explicit directives
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 63072000, // 2 years in seconds
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
    }),
  );

  // Global prefix: all routes start with /api
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/(.*)', method: 0 }, // RequestMethod.GET = 0
    ],
  });

  // URI versioning: /api/v1/..., /api/v2/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global exception filter: structured error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global pipes: sanitize first, then validate
  app.useGlobalPipes(
    new SanitizationPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global guard: reject non-JSON Content-Type on POST/PUT/PATCH (returns 415)
  app.useGlobalGuards(new ContentTypeGuard());

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigins.split(',').map((o: string) => o.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Swagger setup (conditional on environment)
  const swaggerEnabled = configService.get<boolean>('SWAGGER_ENABLED', true);
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Enquiry Backend Platform')
      .setDescription('API for managing property enquiries, CRM integrations, and notifications')
      .setVersion('1.0.0')
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .addTag('Enquiry', 'Property enquiry CRUD operations')
      .addTag('Webhook', 'CRM webhook ingestion')
      .addTag('Property', 'WordPress property data (GraphQL)')
      .addTag('GDPR', 'Data export and erasure')
      .addTag('Health', 'Liveness and readiness probes')
      .addTag('Admin', 'Queue management and dashboard')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorterAlpha: true,
      },
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
