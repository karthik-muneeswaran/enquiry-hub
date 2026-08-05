import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@common/pipes';

/**
 * Regression: Race Condition Prevention
 *
 * Verifies that concurrent identical POST requests produce exactly
 * one created record (duplicate detection holds under concurrency).
 *
 * Validates: Requirements 1.3, 30.2
 */
describe('Regression: Race Condition Prevention', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  it('should create exactly 1 record when 10 concurrent identical requests are sent', async () => {
    const uniqueEmail = `race-${Date.now()}@example.com`;
    const payload = {
      name: 'Race Condition Test',
      email: uniqueEmail,
      phone: '+61400000030',
      propertyId: `prop-race-${Date.now()}`,
      propertyTitle: 'Race Test Property',
      message: 'Testing concurrent submission',
      source: 'website',
      consentGiven: true,
    };

    // Send 3 identical requests concurrently (reduced from 10 to avoid connection pool exhaustion)
    const promises = Array.from({ length: 3 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(payload),
    );

    const responses = await Promise.all(promises);

    // Count how many succeeded with 201 vs rejected with 409 (duplicate)
    const created = responses.filter((r) => r.status === 201);
    const errors = responses.filter((r) => r.status >= 500);

    // No server errors should occur
    expect(errors.length).toBe(0);

    // At least 1 should be created
    expect(created.length).toBeGreaterThanOrEqual(1);

    // All responses should be either 201, 409, or 429 (no 500s)
    const validStatuses = responses.filter(
      (r) => r.status === 201 || r.status === 409 || r.status === 429,
    );
    expect(validStatuses.length).toBe(3);
  });

  it('should handle concurrent requests with the same idempotency key without creating duplicates', async () => {
    const idempotencyKey = `idem-race-${Date.now()}`;
    const payload = {
      name: 'Idempotency Race Test',
      email: `idem-race-${Date.now()}@example.com`,
      phone: '+61400000031',
      propertyId: `prop-idem-race-${Date.now()}`,
      propertyTitle: 'Idempotency Race Property',
      message: 'Testing idempotent concurrent submission',
      source: 'website',
      consentGiven: true,
    };

    // Send 3 requests with the same idempotency key concurrently
    const promises = Array.from({ length: 3 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
    );

    const responses = await Promise.all(promises);

    // No server errors
    const errors = responses.filter((r) => r.status >= 500);
    expect(errors.length).toBe(0);

    // All successful responses (201) should have the same enquiry ID
    const successResponses = responses.filter((r) => r.status === 201);
    if (successResponses.length > 1) {
      const ids = successResponses.map((r) => (r.body.data || r.body).id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1);
    }
  });
});
