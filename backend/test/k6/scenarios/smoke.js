import { check, sleep } from 'k6';
import { createEnquiry, getEnquiry, listEnquiries, sendWebhookEvent, queryGraphQL, checkHealth } from '../helpers/api-client.js';
import { generateEnquiryPayload, generateWebhookPayload, generatePropertiesQuery } from '../helpers/test-data.js';

/**
 * Smoke Test Scenario
 *
 * Purpose: Quick baseline validation that the system is functional under minimal load.
 * VUs: 5
 * Duration: 1 minute
 * Thresholds: p95 < 500ms, error rate < 1%
 */
export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:enquiry_create}': ['p(95)<500'],
    'http_req_duration{endpoint:enquiry_list}': ['p(95)<500'],
    'http_req_duration{endpoint:graphql}': ['p(95)<500'],
  },
};

export default function () {
  // Health check
  const healthRes = checkHealth();
  check(healthRes, {
    'health: status is 200': (r) => r.status === 200,
  });

  // Create enquiry
  const payload = generateEnquiryPayload();
  const createRes = createEnquiry(payload);
  check(createRes, {
    'create enquiry: status is 201': (r) => r.status === 201,
    'create enquiry: response has id': (r) => {
      const body = JSON.parse(r.body);
      return body.data && body.data.id;
    },
  });

  // Get created enquiry
  if (createRes.status === 201) {
    const body = JSON.parse(createRes.body);
    const getRes = getEnquiry(body.data.id);
    check(getRes, {
      'get enquiry: status is 200': (r) => r.status === 200,
      'get enquiry: fields match': (r) => {
        const data = JSON.parse(r.body).data;
        return data.email === payload.email.toLowerCase();
      },
    });
  }

  // List enquiries
  const listRes = listEnquiries({ limit: 10 });
  check(listRes, {
    'list enquiries: status is 200': (r) => r.status === 200,
    'list enquiries: returns array': (r) => {
      const body = JSON.parse(r.body);
      return Array.isArray(body.data);
    },
  });

  // Send webhook
  const webhookPayload = generateWebhookPayload();
  const webhookRes = sendWebhookEvent(webhookPayload);
  check(webhookRes, {
    'webhook: status is 202': (r) => r.status === 202,
  });

  // GraphQL properties query
  const gqlBody = generatePropertiesQuery(5);
  const gqlRes = queryGraphQL(gqlBody);
  check(gqlRes, {
    'graphql: status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
