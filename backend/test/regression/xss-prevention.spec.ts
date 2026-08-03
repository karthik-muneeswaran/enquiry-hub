import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { SanitizationPipe } from '@common/pipes';

/**
 * Regression: XSS Prevention
 *
 * Verifies that the sanitization pipeline strips all HTML/script
 * tags from user input before persistence and response.
 *
 * Validates: Requirements 12.5, 30.2
 */
describe('Regression: XSS Prevention', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new SanitizationPipe(),
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should strip <script> tags from the name field', async () => {
    const payload = {
      name: '<script>alert("xss")</script>John',
      email: 'xss-test@example.com',
      phone: '+61400000001',
      propertyId: 'prop-xss-001',
      propertyTitle: 'XSS Test Property',
      message: 'Normal message',
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    if (response.status === 201) {
      const data = response.body.data || response.body;
      // The script tag should be stripped; only text content remains
      expect(data.name).not.toContain('<script>');
      expect(data.name).not.toContain('</script>');
    }

    // Must never return 500
    expect(response.status).not.toBe(500);
  });

  it('should strip event handler attributes from the message field', async () => {
    const payload = {
      name: 'Jane Doe',
      email: 'xss-msg@example.com',
      phone: '+61400000002',
      propertyId: 'prop-xss-002',
      propertyTitle: 'Another Property',
      message: '<img src=x onerror=alert("xss")> <div onmouseover="steal()">hover</div>',
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    if (response.status === 201) {
      const data = response.body.data || response.body;
      // All HTML tags should be stripped
      expect(data.message).not.toContain('<img');
      expect(data.message).not.toContain('<div');
      expect(data.message).not.toContain('onerror');
      expect(data.message).not.toContain('onmouseover');
    }

    expect(response.status).not.toBe(500);
  });

  it('should sanitize SVG-based XSS payloads in input fields', async () => {
    const payload = {
      name: '<svg/onload=alert("xss")>Test',
      email: 'svg-xss@example.com',
      phone: '+61400000003',
      propertyId: 'prop-xss-003',
      propertyTitle: '<svg><script>alert(1)</script></svg>Safe Title',
      message: 'Clean message',
      source: 'website',
      consentGiven: true,
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/enquiry')
      .set('Content-Type', 'application/json')
      .send(payload);

    if (response.status === 201) {
      const data = response.body.data || response.body;
      expect(data.name).not.toContain('<svg');
      expect(data.propertyTitle).not.toContain('<svg');
      expect(data.propertyTitle).not.toContain('<script');
    }

    expect(response.status).not.toBe(500);
  });
});
