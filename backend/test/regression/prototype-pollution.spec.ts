import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@common/pipes';

/**
 * Regression: Prototype Pollution Prevention
 *
 * Verifies that __proto__ and constructor.prototype payloads
 * do not pollute Object.prototype on the server.
 *
 * Validates: Requirements 12.5, 30.2
 */
describe('Regression: Prototype Pollution Prevention', () => {
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

  it('should not allow __proto__ payload to pollute Object.prototype', async () => {
    const maliciousPayload = JSON.stringify({
      name: 'Attacker',
      email: 'attack@example.com',
      phone: '+61400000010',
      propertyId: 'prop-proto-001',
      propertyTitle: 'Property',
      message: 'Test',
      source: 'website',
      consentGiven: true,
      __proto__: { isAdmin: true, role: 'superuser' },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(maliciousPayload);

    // Verify Object.prototype was not polluted
    const cleanObj: Record<string, unknown> = {};
    expect((cleanObj as any).isAdmin).toBeUndefined();
    expect((cleanObj as any).role).toBeUndefined();

    // Request should either succeed (stripped) or be rejected, never 500
    expect(response.status).not.toBe(500);
  });

  it('should not allow constructor.prototype pollution via nested payload', async () => {
    const maliciousPayload = JSON.stringify({
      name: 'Attacker',
      email: 'proto2@example.com',
      phone: '+61400000011',
      propertyId: 'prop-proto-002',
      propertyTitle: 'Property',
      message: 'Test',
      source: 'website',
      consentGiven: true,
      constructor: { prototype: { polluted: true } },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(maliciousPayload);

    // Verify prototype was not polluted
    const cleanObj: Record<string, unknown> = {};
    expect((cleanObj as any).polluted).toBeUndefined();

    // Should not crash the server
    expect(response.status).not.toBe(500);

    // Subsequent requests should work normally (no pollution carried over)
    const healthResponse = await request(app.getHttpServer()).get('/health/live');
    expect(healthResponse.status).toBe(200);
  });
});
