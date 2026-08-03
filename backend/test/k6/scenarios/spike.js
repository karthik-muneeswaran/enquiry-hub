import { check, sleep } from 'k6';
import { createEnquiry, listEnquiries, sendWebhookEvent, queryGraphQL, checkHealth } from '../helpers/api-client.js';
import { generateEnquiryPayload, generateWebhookPayload, generatePropertiesQuery } from '../helpers/test-data.js';

/**
 * Spike Test Scenario
 *
 * Purpose: Test system behavior under sudden traffic spike and recovery.
 * VUs: 10 → 500 → 10 over 5 minutes.
 * Thresholds: p95 < 500ms, error rate < 1%
 *
 * Success Criteria: Recovery within 30s of spike end, no crashes.
 */
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Baseline
    { duration: '30s', target: 500 },  // Spike up
    { duration: '1m', target: 500 },   // Stay at peak
    { duration: '30s', target: 10 },   // Spike down
    { duration: '2m30s', target: 10 }, // Recovery period
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:enquiry_create}': ['p(95)<500'],
    'http_req_duration{endpoint:enquiry_list}': ['p(95)<500'],
    'http_req_duration{endpoint:graphql}': ['p(95)<500'],
  },
};

export default function () {
  const action = Math.random();

  if (action < 0.4) {
    // 40% - Create enquiry (main spike load)
    const payload = generateEnquiryPayload();
    const res = createEnquiry(payload);
    check(res, {
      'create: accepted or rate-limited': (r) => r.status === 201 || r.status === 429 || r.status === 503,
      'create: no unrecoverable errors': (r) => r.status !== 500,
    });
  } else if (action < 0.7) {
    // 30% - List enquiries
    const res = listEnquiries({ limit: 10 });
    check(res, {
      'list: accepted or rate-limited': (r) => r.status === 200 || r.status === 429 || r.status === 503,
      'list: no unrecoverable errors': (r) => r.status !== 500,
    });
  } else if (action < 0.85) {
    // 15% - GraphQL
    const gqlBody = generatePropertiesQuery(5);
    const res = queryGraphQL(gqlBody);
    check(res, {
      'graphql: accepted or rate-limited': (r) => r.status === 200 || r.status === 429 || r.status === 503,
      'graphql: no unrecoverable errors': (r) => r.status !== 500,
    });
  } else if (action < 0.95) {
    // 10% - Webhook
    const webhookPayload = generateWebhookPayload();
    const res = sendWebhookEvent(webhookPayload);
    check(res, {
      'webhook: accepted or rate-limited': (r) => r.status === 202 || r.status === 429 || r.status === 503,
      'webhook: no unrecoverable errors': (r) => r.status !== 500,
    });
  } else {
    // 5% - Health check (monitoring during spike)
    const res = checkHealth();
    check(res, {
      'health: responds during spike': (r) => r.status === 200 || r.status === 503,
    });
  }

  sleep(0.3);
}
