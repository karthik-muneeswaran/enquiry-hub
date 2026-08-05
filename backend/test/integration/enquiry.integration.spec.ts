import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@/database/prisma.service';
import { REDIS_CLIENT } from '@/cache/cache.service';
import Redis from 'ioredis';
import { createTestApp, cleanDatabase, flushRedis } from './setup/test-module.factory';

describe('Enquiry Integration Tests', () => {
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
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+61412345678',
    propertyId: 'prop-uuid-123',
    propertyTitle: '3 Bed Apartment in Sydney CBD',
    message: 'I am interested in scheduling a viewing.',
    source: 'website',
    consentGiven: true,
  };

  describe('POST /api/v1/enquiry', () => {
    it('should create an enquiry with valid payload and return 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com',
        status: 'PENDING',
        propertyId: 'prop-uuid-123',
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.request_id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return 400 with field-level errors for invalid payload', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send({ name: '', email: 'not-an-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });

    it('should return 409 for duplicate enquiry within 10-minute window', async () => {
      // First request succeeds
      await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(201);

      // Second identical request within 10 min should be rejected
      const response = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should support idempotency key - same response without new record', async () => {
      const idempotencyKey = 'test-idem-key-001';

      const first = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', idempotencyKey)
        .send(validEnquiryPayload)
        .expect(201);

      // Use a different email to avoid duplicate detection, but same idempotency key
      const second = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', idempotencyKey)
        .send({ ...validEnquiryPayload, email: 'other@example.com' })
        .expect(201);

      // Both responses should have the same enquiry ID
      expect(second.body.data.id).toBe(first.body.data.id);
    });
  });

  describe('GET /api/v1/enquiry/:id', () => {
    it('should return an enquiry by ID with ETag header', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(201);

      const enquiryId = createRes.body.data.id;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/enquiry/${enquiryId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(enquiryId);
      expect(response.body.data.email).toBe('john@example.com');
      expect(response.headers['etag']).toBeDefined();
    });

    it('should return 404 for non-existent enquiry', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/enquiry/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();
    });
  });

  describe('GET /api/v1/enquiries', () => {
    it('should return paginated results with cursor metadata', async () => {
      // Create multiple enquiries
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/enquiry')
          .set('Content-Type', 'application/json')
          .send({
            ...validEnquiryPayload,
            email: `user${i}@example.com`,
          })
          .expect(201);
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/enquiries?limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.data.length).toBe(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.hasMore).toBe(true);
      expect(response.body.data.pagination.nextCursor).toBeDefined();
    });
  });
});
