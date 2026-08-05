import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as crypto from 'crypto';
import { PrismaService } from '@/database/prisma.service';
import { REDIS_CLIENT } from '@/cache/cache.service';
import Redis from 'ioredis';
import { createTestApp, cleanDatabase, flushRedis } from './setup/test-module.factory';

describe('Webhook Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let redis: Redis;

  // These should match values from .env.development or .env.test
  const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-hmac-secret-for-testing-only';
  const API_KEY = process.env.API_KEYS?.split(',')[0] || 'dev-api-key-1';

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

  function computeHmacSignature(payload: object, secret: string): string {
    const body = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  const webhookPayload = {
    eventId: 'evt-unique-001',
    type: 'enquiry.status_changed',
    source: 'crm-system',
    payload: {
      enquiryId: 'enq-001',
      status: 'COMPLETED',
      updatedAt: '2025-01-15T10:00:00Z',
    },
  };

  describe('POST /api/v1/webhook/crm', () => {
    it('should accept a valid webhook with correct HMAC and API key (202)', async () => {
      const testPayload = { ...webhookPayload, eventId: 'evt-unique-001' };
      const signature = computeHmacSignature(testPayload, HMAC_SECRET);

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', signature)
        .send(testPayload)
        .expect(202);

      expect(response.body.success).toBe(true);

      // Verify WebhookEvent was persisted
      const event = await prisma.webhookEvent.findUnique({
        where: { eventId: 'evt-unique-001' },
      });
      expect(event).not.toBeNull();
      expect(event?.status).toBe('RECEIVED');
    });

    it('should return 401 for invalid HMAC signature', async () => {
      const testPayload = { ...webhookPayload, eventId: 'evt-002' };
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', 'invalid-signature-value')
        .send(testPayload)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for missing or invalid API key', async () => {
      const testPayload = { ...webhookPayload, eventId: 'evt-003' };
      const signature = computeHmacSignature(testPayload, HMAC_SECRET);

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', signature)
        .send(testPayload)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should deduplicate events with the same eventId (return 200)', async () => {
      const testPayload = { ...webhookPayload, eventId: 'evt-duplicate-001' };
      const signature = computeHmacSignature(testPayload, HMAC_SECRET);

      // First request
      await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', signature)
        .send(testPayload)
        .expect(202);

      // Second request with same eventId — should be deduplicated
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', signature)
        .send(testPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Only one record should exist
      const events = await prisma.webhookEvent.findMany({
        where: { eventId: 'evt-duplicate-001' },
      });
      expect(events.length).toBe(1);
    });

    it('should return 400 for invalid webhook payload schema', async () => {
      const invalidPayload = { invalid: true }; // Missing required fields
      const signature = computeHmacSignature(invalidPayload, HMAC_SECRET);

      await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', signature)
        .send(invalidPayload)
        .expect(400);
    });
  });
});
