import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import request from 'supertest';
import * as crypto from 'crypto';
import { PrismaService } from '@/database/prisma.service';
import { REDIS_CLIENT } from '@/cache/cache.service';
import { QUEUE_NAMES } from '@/queue/queue.constants';
import Redis from 'ioredis';
import { createTestApp, cleanDatabase, flushRedis } from './setup/test-module.factory';

describe('Queue Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let prisma: PrismaService;
  let redis: Redis;
  let emailQueue: Queue;
  let crmQueue: Queue;

  beforeAll(async () => {
    ({ app, module } = await createTestApp());
    prisma = module.get(PrismaService);
    redis = module.get(REDIS_CLIENT);
    emailQueue = module.get(getQueueToken(QUEUE_NAMES.EMAIL));
    crmQueue = module.get(getQueueToken(QUEUE_NAMES.CRM));
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await flushRedis(redis);
    // Drain queues to start fresh
    await emailQueue.drain();
    await crmQueue.drain();
  });

  afterAll(async () => {
    await app.close();
  }, 30000);

  const validEnquiryPayload = {
    name: 'Queue Test User',
    email: 'queuetest@example.com',
    phone: '+61412345678',
    propertyId: 'prop-queue-001',
    propertyTitle: 'Test Property',
    message: 'Integration test for queue.',
    source: 'website',
    consentGiven: true,
  };

  describe('Enquiry creation triggers queue jobs', () => {
    it('should enqueue email jobs when an enquiry is created', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/enquiry')
        .set('Content-Type', 'application/json')
        .send(validEnquiryPayload)
        .expect(201);

      // Give BullMQ a moment to register the job
      await new Promise((resolve) => setTimeout(resolve, 500));

      const waitingJobs = await emailQueue.getWaiting();
      const activeJobs = await emailQueue.getActive();
      const completedJobs = await emailQueue.getCompleted();

      const totalJobs = waitingJobs.length + activeJobs.length + completedJobs.length;
      // At least 1 email job (confirmation email) should be enqueued
      expect(totalJobs).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CRM queue processing', () => {
    it('should enqueue a CRM job when webhook event is received', async () => {
      const HMAC_SECRET = process.env.HMAC_SECRET || 'test-hmac-secret-key';
      const API_KEY = process.env.API_KEYS?.split(',')[0] || 'test-api-key-001';

      const webhookPayload = {
        type: 'enquiry.status_changed',
        source: 'crm',
        data: { enquiryId: 'enq-001', status: 'COMPLETED' },
      };

      const signature = crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(JSON.stringify(webhookPayload))
        .digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/webhook/crm')
        .set('Content-Type', 'application/json')
        .set('X-API-Key', API_KEY)
        .set('X-Webhook-Signature', signature)
        .set('X-Webhook-Event-Id', 'evt-queue-test-001')
        .send(webhookPayload)
        .expect(202);

      await new Promise((resolve) => setTimeout(resolve, 500));

      const waitingJobs = await crmQueue.getWaiting();
      const activeJobs = await crmQueue.getActive();
      const completedJobs = await crmQueue.getCompleted();

      const totalJobs = waitingJobs.length + activeJobs.length + completedJobs.length;
      expect(totalJobs).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Admin queue operations', () => {
    it('should report queue statistics via admin endpoint', async () => {
      const response = await request(app.getHttpServer()).get('/admin/queues/stats').expect(200);

      expect(response.body).toBeDefined();
    });

    it('should pause and resume a queue', async () => {
      // Pause
      await request(app.getHttpServer())
        .post(`/admin/queues/${QUEUE_NAMES.EMAIL}/pause`)
        .expect(201);

      // Check paused state
      const isPaused = await emailQueue.isPaused();
      expect(isPaused).toBe(true);

      // Resume
      await request(app.getHttpServer())
        .post(`/admin/queues/${QUEUE_NAMES.EMAIL}/resume`)
        .expect(201);

      const isStillPaused = await emailQueue.isPaused();
      expect(isStillPaused).toBe(false);
    });
  });
});
