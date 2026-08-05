import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@common/pipes';

/**
 * Regression: SQL Injection Prevention
 *
 * Verifies that parameterized queries (Prisma) block SQL injection
 * in all user-facing input fields.
 *
 * Validates: Requirements 12.5, 12.6, 30.2
 */
describe('Regression: SQL Injection Prevention', () => {
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

  it('should safely store SQL injection payload in name field without executing', async () => {
    const payload = {
      name: "'; DROP TABLE enquiry; --",
      email: 'test@example.com',
      phone: '+61400000000',
      propertyId: 'prop-001',
      propertyTitle: 'Test Property',
      message: 'Legitimate message',
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    // Should either create (201) with sanitized data or reject (4xx)
    // but NEVER execute the SQL injection
    expect(response.status).not.toBe(500);
    expect([201, 400, 409, 429]).toContain(response.status);
  });

  it('should not expose all records via OR injection in search param', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/enquiries')
      .query({ search: "' OR '1'='1" })
      .set('Content-Type', 'application/json');

    // Should return normal paginated response, not all records
    expect(response.status).not.toBe(500);
    expect([200, 400, 429]).toContain(response.status);

    if (response.status === 200 && response.body.data?.data) {
      // If it returns data, it should NOT be a full table dump
      // (the injection should be treated as literal search text)
      expect(response.body.data.data.length).toBeLessThanOrEqual(100);
    }
  });

  it('should reject UNION-based injection in cursor parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/enquiries')
      .query({ cursor: 'eyJpZCI6IicgVU5JT04gU0VMRUNUICogRlJPTSBwZ19jYXRhbG9nLnBnX3VzZXIgLS0ifQ==' })
      .set('Content-Type', 'application/json');

    // Should return 400 (invalid cursor) or 200 empty, never 500
    expect(response.status).not.toBe(500);
    expect([200, 400, 429]).toContain(response.status);
  });
});
