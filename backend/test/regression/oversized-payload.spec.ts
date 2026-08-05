import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import * as express from 'express';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@common/pipes';

/**
 * Regression: Oversized Payload Rejection
 *
 * Verifies that the platform rejects request bodies exceeding
 * the configured size limit (1MB) with a 413 status code.
 *
 * Validates: Requirements 12.4, 30.2
 */
describe('Regression: Oversized Payload Rejection', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply body size limit (same as main.ts)
    app.use(express.json({ limit: '1mb' }));

    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health/(.*)', method: 0 }],
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject a payload exceeding 1MB with 413 status', async () => {
    // Generate a string just over 1MB (1,048,577 bytes)
    const oversizedMessage = 'x'.repeat(1_100_000);

    const payload = {
      name: 'Test User',
      email: 'oversize@example.com',
      phone: '+61400000020',
      propertyId: 'prop-size-001',
      propertyTitle: 'Property',
      message: oversizedMessage,
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    // Should be rejected with 413 Payload Too Large
    expect(response.status).toBe(413);
  });

  it('should accept a payload under 1MB', async () => {
    // Generate a string safely under 1MB
    const normalMessage = 'Hello, I am interested in this property.';

    const payload = {
      name: 'Normal User',
      email: 'normal-size@example.com',
      phone: '+61400000021',
      propertyId: 'prop-size-002',
      propertyTitle: 'Normal Property',
      message: normalMessage,
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    // Should be processed normally (201, 409, or 429 — not 413 or 500)
    expect(response.status).not.toBe(413);
    expect(response.status).not.toBe(500);
    expect([201, 409, 429]).toContain(response.status);
  });
});
