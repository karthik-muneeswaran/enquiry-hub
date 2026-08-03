import { check, sleep } from 'k6';
import { createEnquiry, getEnquiry, listEnquiries, sendWebhookEvent, queryGraphQL } from '../helpers/api-client.js';
import { generateEnquiryPayload, generateWebhookPayload, generatePropertiesQuery } from '../helpers/test-data.js';

/**
 * Stress Test Scenario
 *
 * Purpose: Determine system behavior under increasing load up to beyond expected capacity.
 * VUs: Ramps from 0 to 200 over 10 minutes.
 * Thresholds: p95 < 500ms, error rate < 1%
 *
 * Success Criteria: Graceful degradation (429s, not 500s) above capacity.
 */
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to normal load
    { duration: '3m', target: 100 },  // Push to moderate load
    { duration: '3m', target: 200 },  // Push to high load
    { duration: '2m', target: 0 },    // Ramp down to recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:enquiry_create}': ['p(95)<500'],
    'http_req_duration{endpoint:enquiry_list}': ['p(95)<200'],
    'http_req_duration{endpoint:graphql}': ['p(95)<300'],
  },
};

export default function () {
  const action = Math.random();

  if (action < 0.3) {
    // 30% - Create enquiry
    const payload = generateEnquiryPayload();
    const res = createEnquiry(payload);
    check(res, {
      'create: status is 201 or 429': (r) => r.status === 201 || r.status === 429,
      'create: no 5xx errors': (r) => r.status < 500,
    });

    if (res.status === 201) {
      const body = JSON.parse(res.body);
      const getRes = getEnquiry(body.data.id);
      check(getRes, {
        'get: status is 200': (r) => r.status === 200,
      });
    }
  } else if (action < 0.6) {
    // 30% - List enquiries
    const res = listEnquiries({ limit: 20 });
    check(res, {
      'list: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'list: no 5xx errors': (r) => r.status < 500,
    });
  } else if (action < 0.8) {
    // 20% - GraphQL query
    const gqlBody = generatePropertiesQuery(10);
    const res = queryGraphQL(gqlBody);
    check(res, {
      'graphql: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'graphql: no 5xx errors': (r) => r.status < 500,
    });
  } else {
    // 20% - Webhook
    const webhookPayload = generateWebhookPayload();
    const res = sendWebhookEvent(webhookPayload);
    check(res, {
      'webhook: status is 202 or 429': (r) => r.status === 202 || r.status === 429,
      'webhook: no 5xx errors': (r) => r.status < 500,
    });
  }

  sleep(0.5);
}
