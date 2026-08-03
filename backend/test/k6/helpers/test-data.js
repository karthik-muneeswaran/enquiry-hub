import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const SOURCES = ['website', 'mobile', 'partner', 'referral', 'social'];
const FIRST_NAMES = ['John', 'Jane', 'Alex', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa', 'Tom', 'Amy'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor'];

/**
 * Generate a random valid enquiry payload.
 */
export function generateEnquiryPayload() {
  const firstName = FIRST_NAMES[randomIntBetween(0, FIRST_NAMES.length - 1)];
  const lastName = LAST_NAMES[randomIntBetween(0, LAST_NAMES.length - 1)];
  const uniqueId = randomString(8);

  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uniqueId}@loadtest.example.com`,
    phone: `+6141${randomIntBetween(1000000, 9999999)}`,
    propertyId: `prop-${randomString(12)}`,
    propertyTitle: `${randomIntBetween(1, 5)} Bed Apartment in ${randomString(6)}`,
    message: `I am interested in this property. Reference: ${uniqueId}. ${randomString(50)}`,
    source: SOURCES[randomIntBetween(0, SOURCES.length - 1)],
    consentGiven: true,
  };
}

/**
 * Generate a random valid webhook payload.
 */
export function generateWebhookPayload() {
  return {
    eventId: `evt-${randomString(16)}`,
    type: 'enquiry.updated',
    source: 'crm',
    payload: {
      enquiryId: `enq-${randomString(12)}`,
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generate a GraphQL properties query payload.
 */
export function generatePropertiesQuery(first = 20) {
  return JSON.stringify({
    query: `
      query GetProperties($first: Int) {
        properties(first: $first) {
          edges {
            node {
              id
              title
              slug
              excerpt
              imageUrl
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    variables: { first },
  });
}
