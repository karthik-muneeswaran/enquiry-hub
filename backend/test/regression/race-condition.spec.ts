import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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

    // Send 10 identical requests concurrently
    const promises = Array.from({ length: 10 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(payload),
    );

    const responses = await Promise.all(promises);

    // Count how many succeeded with 201 vs rejected with 409 (duplicate)
    const created = responses.filter((r) => r.status === 201);
    const duplicates = responses.filter((r) => r.status === 409);
    const rateLimited = responses.filter((r) => r.status === 429);
    const errors = responses.filter((r) => r.status >= 500);

    // No server errors should occur
    expect(errors.length).toBe(0);

    // Exactly 1 should be created (the rest are duplicates or rate-limited)
    expect(created.length).toBe(1);

    // Remaining should be 409 duplicates or 429 rate limited
    expect(duplicates.length + rateLimited.length).toBe(9);
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

    // Send 5 requests with the same idempotency key concurrently
    const promises = Array.from({ length: 5 }, () =>
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
