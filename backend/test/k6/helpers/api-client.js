import http from 'k6/http';
import crypto from 'k6/crypto';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';
const HMAC_SECRET = __ENV.HMAC_SECRET || 'test-hmac-secret';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Create a new enquiry.
 */
export function createEnquiry(payload) {
  const url = `${BASE_URL}/api/v1/enquiry`;
  const body = JSON.stringify(payload);
  const headers = {
    ...DEFAULT_HEADERS,
    'Idempotency-Key': crypto.randomBytes(16, 'hex'),
  };

  return http.post(url, body, {
    headers,
    tags: { endpoint: 'enquiry_create' },
  });
}

/**
 * Get an enquiry by ID.
 */
export function getEnquiry(id) {
  const url = `${BASE_URL}/api/v1/enquiry/${id}`;

  return http.get(url, {
    headers: DEFAULT_HEADERS,
    tags: { endpoint: 'enquiry_get' },
  });
}

/**
 * List enquiries with pagination.
 */
export function listEnquiries(params = {}) {
  const query = new URLSearchParams({
    limit: String(params.limit || 20),
    ...(params.cursor ? { cursor: params.cursor } : {}),
    ...(params.status ? { status: params.status } : {}),
  }).toString();

  const url = `${BASE_URL}/api/v1/enquiries?${query}`;

  return http.get(url, {
    headers: DEFAULT_HEADERS,
    tags: { endpoint: 'enquiry_list' },
  });
}

/**
 * Send a CRM webhook event with HMAC signature.
 */
export function sendWebhookEvent(payload) {
  const url = `${BASE_URL}/api/v1/webhook/crm`;
  const body = JSON.stringify(payload);
  const signature = crypto.hmac('sha256', HMAC_SECRET, body, 'hex');

  const headers = {
    ...DEFAULT_HEADERS,
    'X-API-Key': API_KEY,
    'X-Webhook-Signature': signature,
    'X-Webhook-Event-Id': payload.eventId,
  };

  return http.post(url, body, {
    headers,
    tags: { endpoint: 'webhook_crm' },
  });
}

/**
 * Execute a GraphQL query.
 */
export function queryGraphQL(body) {
  const url = `${BASE_URL}/graphql`;

  return http.post(url, body, {
    headers: DEFAULT_HEADERS,
    tags: { endpoint: 'graphql' },
  });
}

/**
 * Check health readiness endpoint.
 */
export function checkHealth() {
  const url = `${BASE_URL}/health/ready`;

  return http.get(url, {
    tags: { endpoint: 'health' },
  });
}
