import { check, sleep } from 'k6';
import { createEnquiry, getEnquiry, listEnquiries, sendWebhookEvent, queryGraphQL, checkHealth } from '../helpers/api-client.js';
import { generateEnquiryPayload, generateWebhookPayload, generatePropertiesQuery } from '../helpers/test-data.js';

/**
 * Soak Test Scenario
 *
 * Purpose: Detect memory leaks, connection pool exhaustion, and latency creep
 * over extended runtime at moderate load.
 * VUs: 50 (constant)
 * Duration: 30 minutes
 * Thresholds: p95 < 500ms, error rate < 1%
 *
 * Success Criteria: Memory stable (< 10% growth), latency stable (no creep).
 */
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '26m', target: 50 },  // Sustained load
    { duration: '2m', target: 0 },    // Ramp down
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

  if (action < 0.25) {
    // 25% - Create enquiry
    const payload = generateEnquiryPayload();
    const res = createEnquiry(payload);
    check(res, {
      'create: status is 201': (r) => r.status === 201,
      'create: has response body': (r) => r.body.length > 0,
    });

    // Follow up with a GET to verify creation
    if (res.status === 201) {
      const body = JSON.parse(res.body);
      sleep(0.2);
      const getRes = getEnquiry(body.data.id);
      check(getRes, {
        'get created: status is 200': (r) => r.status === 200,
      });
    }
  } else if (action < 0.5) {
    // 25% - List enquiries with different params
    const res = listEnquiries({ limit: 20 });
    check(res, {
      'list: status is 200': (r) => r.status === 200,
      'list: valid pagination': (r) => {
        const body = JSON.parse(r.body);
        return body.meta && body.meta.pagination !== undefined;
      },
    });
  } else if (action < 0.7) {
    // 20% - GraphQL properties query
    const gqlBody = generatePropertiesQuery(10);
    const res = queryGraphQL(gqlBody);
    check(res, {
      'graphql: status is 200': (r) => r.status === 200,
      'graphql: has data': (r) => {
        const body = JSON.parse(r.body);
        return body.data !== undefined;
      },
    });
  } else if (action < 0.85) {
    // 15% - Webhook events
    const webhookPayload = generateWebhookPayload();
    const res = sendWebhookEvent(webhookPayload);
    check(res, {
      'webhook: status is 202': (r) => r.status === 202,
    });
  } else {
    // 15% - Health checks (monitoring stability)
    const res = checkHealth();
    check(res, {
      'health: status is 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
