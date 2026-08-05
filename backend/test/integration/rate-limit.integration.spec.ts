import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@/database/prisma.service';
import { REDIS_CLIENT } from '@/cache/cache.service';
import Redis from 'ioredis';
import { createTestApp, cleanDatabase, flushRedis } from './setup/test-module.factory';

describe('Rate Limit Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let redis: Redis;

  beforeAll(async () => {
    ({ app, module } = await createTestApp());
    prisma = module.get(PrismaService);
    redis = module.get(REDIS_CLIENT);
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await flushRedis(redis);
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  const validEnquiryPayload = {
    name: 'Rate Limit User',
    email: 'ratelimit@example.com',
    phone: '+61400000000',
    propertyId: 'prop-rl-001',
    propertyTitle: 'Rate Limit Test Property',
    message: 'Testing rate limiting.',
    source: 'website',
    consentGiven: true,
  };

  describe('POST /api/v1/enquiry rate limiting (10/min per IP)', () => {
    it('should include rate limit headers on successful responses', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(201);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should return 429 after exceeding rate limit', async () => {
      // POST /enquiry is limited to 10/min per IP
      // Fire 15 requests sequentially to reliably trigger rate limiting
      const responses: any[] = [];
      for (let i = 0; i < 15; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/enquiry')
          .set('Content-Type', 'application/json')
          .send({
            ...validEnquiryPayload,
            email: `ratelimit${i}@example.com`,
            propertyId: `prop-rl-${i}`,
          });
        responses.push(res);
      }

      // At least one response should be 429
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThanOrEqual(1);

      // 429 responses should include Retry-After header
      if (rateLimited.length > 0) {
        expect(rateLimited[0].headers['retry-after']).toBeDefined();
      }
    });

    it('should decrement X-RateLimit-Remaining on successive requests', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send({ ...validEnquiryPayload, email: 'dec1@example.com', propertyId: 'prop-dec-1' });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send({ ...validEnquiryPayload, email: 'dec2@example.com', propertyId: 'prop-dec-2' });

      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);
      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

      // Remaining should decrease
      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('GET /api/v1/enquiries rate limiting (60/min per IP)', () => {
    it('should allow higher rate for GET list endpoint', async () => {
      // GET /enquiries has a 60/min limit — much more lenient
      const response = await request(app.getHttpServer()).get('/api/v1/enquiries').expect(200);

      const limit = parseInt(response.headers['x-ratelimit-limit'], 10);
      // The limit for GET enquiries should be 60
      expect(limit).toBe(60);
    });
  });

  describe('IP isolation', () => {
    it('should track rate limits independently per IP', async () => {
      // Simulate requests from two different IPs using X-Forwarded-For
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ ...validEnquiryPayload, email: 'ip1@example.com', propertyId: 'prop-ip-1' });

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ ...validEnquiryPayload, email: 'ip2@example.com', propertyId: 'prop-ip-2' });

      // Both should have full remaining counts (independent windows)
      const remaining1 = parseInt(res1.headers['x-ratelimit-remaining'], 10);
      const remaining2 = parseInt(res2.headers['x-ratelimit-remaining'], 10);

      expect(remaining1).toBe(remaining2);
    });
  });
});
