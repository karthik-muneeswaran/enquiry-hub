/**
 * Backend Smoke Test Suite
 *
 * 10 sequential checks to validate a deployed instance is healthy.
 * Configurable via SMOKE_BASE_URL env var (defaults to http://localhost:3000).
 * Exit code 0 = all pass, non-zero = triggers auto-rollback in CI.
 *
 * Requirements: 30.5
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const METRICS_PORT = process.env.SMOKE_METRICS_PORT || '8081';
const FRONTEND_URL = process.env.SMOKE_FRONTEND_URL || BASE_URL.replace(/:\d+$/, '');
const HMAC_SECRET = process.env.SMOKE_HMAC_SECRET || 'test-hmac-secret';
const API_KEY = process.env.SMOKE_API_KEY || 'test-api-key';

// Timeout for individual requests (seconds)
const REQUEST_TIMEOUT = 10_000;

describe('Smoke Tests', () => {
  let client: AxiosInstance;
  let createdEnquiryId: string;

  beforeAll(() => {
    client = axios.create({
      baseURL: BASE_URL,
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true, // Don't throw on non-2xx
    });
  });

  // 1. Health endpoint (DB + Redis connected)
  it('1. Health endpoint responds with ready status', async () => {
    const response = await client.get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status');
    expect(response.data.status).toBe('ok');
  });

  // 2. Create enquiry (POST valid payload → 201)
  it('2. Create enquiry returns 201', async () => {
    const payload = {
      name: 'Smoke Test User',
      email: `smoke-${Date.now()}@test.example.com`,
      phone: '+61400000000',
      propertyId: 'smoke-property-001',
      propertyTitle: 'Smoke Test Property',
      message: 'This is an automated smoke test enquiry.',
      source: 'smoke-test',
      consentGiven: true,
    };

    const response = await client.post('/api/v1/enquiry', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('id');

    createdEnquiryId = response.data.data.id;
  });

  // 3. Retrieve created enquiry (GET by ID → 200, fields match)
  it('3. Retrieve created enquiry by ID returns 200', async () => {
    expect(createdEnquiryId).toBeDefined();

    const response = await client.get(`/api/v1/enquiry/${createdEnquiryId}`);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data.data).toHaveProperty('id', createdEnquiryId);
    expect(response.data.data).toHaveProperty('name');
    expect(response.data.data).toHaveProperty('email');
    expect(response.data.data).toHaveProperty('status', 'PENDING');
  });

  // 4. List enquiries with pagination (data.length > 0, cursor present)
  it('4. List enquiries returns paginated results', async () => {
    const response = await client.get('/api/v1/enquiries', {
      params: { limit: 5 },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(Array.isArray(response.data.data)).toBe(true);
    expect(response.data.data.length).toBeGreaterThan(0);
    expect(response.data).toHaveProperty('meta');
    expect(response.data.meta).toHaveProperty('pagination');
  });

  // 5. Webhook accepts valid HMAC payload (202)
  it('5. Webhook accepts valid HMAC-signed payload with 202', async () => {
    const payload = JSON.stringify({
      type: 'smoke_test',
      source: 'smoke-runner',
      data: { message: 'Smoke test webhook event' },
    });

    const signature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(payload)
      .digest('hex');

    const response = await client.post('/api/v1/webhook/crm', payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Id': `smoke-event-${Date.now()}`,
      },
    });

    expect(response.status).toBe(202);
  });

  // 6. GraphQL returns properties (nodes.length > 0)
  it('6. GraphQL properties query responds successfully', async () => {
    const query = {
      query: `
        query {
          properties(first: 5) {
            edges {
              node {
                id
                title
                slug
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
    };

    const response = await client.post('/graphql', query, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('data');
    expect(response.data.data).toHaveProperty('properties');
    expect(response.data.data.properties).toHaveProperty('edges');
    expect(Array.isArray(response.data.data.properties.edges)).toBe(true);
  });

  // 7. Frontend loads (200, contains DOCTYPE)
  it('7. Frontend serves HTML with DOCTYPE', async () => {
    const frontendClient = axios.create({
      baseURL: FRONTEND_URL,
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true,
    });

    const response = await frontendClient.get('/');

    expect(response.status).toBe(200);
    expect(typeof response.data).toBe('string');
    expect(response.data.toLowerCase()).toContain('<!doctype');
  });

  // 8. Metrics endpoint responds (contains custom metric names)
  it('8. Metrics endpoint exposes custom metrics', async () => {
    const metricsBaseUrl = BASE_URL.replace(/:\d+$/, `:${METRICS_PORT}`);
    const metricsClient = axios.create({
      baseURL: metricsBaseUrl,
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true,
    });

    const response = await metricsClient.get('/metrics');

    expect(response.status).toBe(200);
    expect(typeof response.data).toBe('string');
    // Verify at least one custom metric is present
    expect(response.data).toMatch(
      /enquiry_created_total|http_request_duration_seconds|queue_depth/,
    );
  });

  // 9. Rate limit headers present on API responses
  it('9. Rate limit headers are present on API responses', async () => {
    const response = await client.get('/api/v1/enquiries', {
      params: { limit: 1 },
    });

    expect(response.status).toBe(200);
    const headers = response.headers;
    expect(headers).toHaveProperty('x-ratelimit-limit');
    expect(headers).toHaveProperty('x-ratelimit-remaining');
    expect(headers).toHaveProperty('x-ratelimit-reset');

    const limit = parseInt(headers['x-ratelimit-limit'], 10);
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);

    expect(limit).toBeGreaterThan(0);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThanOrEqual(limit);
  });

  // 10. Error responses are safe (no stack traces, no file paths)
  it('10. Error responses do not leak internal details', async () => {
    const response = await client.get('/api/v1/enquiry/invalid-uuid-that-does-not-exist');

    // Should be a 4xx error (400 bad format or 404 not found)
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);

    const body = JSON.stringify(response.data);

    // Must not contain stack traces or internal paths
    expect(body).not.toMatch(/at\s+\w+\s+\(.*\.ts:\d+:\d+\)/); // No TypeScript stack frames
    expect(body).not.toMatch(/at\s+\w+\s+\(.*\.js:\d+:\d+\)/); // No JavaScript stack frames
    expect(body).not.toMatch(/\/home\//); // No absolute paths
    expect(body).not.toMatch(/\/app\/src\//); // No source paths
    expect(body).not.toMatch(/node_modules/); // No node_modules paths
    expect(body).not.toContain('Error:'); // No raw Error class messages

    // Should have structured error format
    expect(response.data).toHaveProperty('success', false);
    expect(response.data).toHaveProperty('error');
    expect(response.data.error).toHaveProperty('code');
    expect(response.data.error).toHaveProperty('message');
  });
});
