import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  // Application
  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  // Database
  get databaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  // Redis
  get redisUrl(): string {
    return this.configService.getOrThrow<string>('REDIS_URL');
  }

  // Swagger
  get swaggerEnabled(): boolean {
    return this.configService.get<boolean>('SWAGGER_ENABLED', true);
  }

  // Logging
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'info');
  }

  // Security
  get hmacSecret(): string {
    return this.configService.getOrThrow<string>('HMAC_SECRET');
  }

  get apiKeys(): string[] {
    const keys = this.configService.getOrThrow<string>('API_KEYS');
    return keys.split(',').map((k) => k.trim());
  }

  // SMTP
  get smtpHost(): string {
    return this.configService.getOrThrow<string>('SMTP_HOST');
  }

  get smtpPort(): number {
    return this.configService.get<number>('SMTP_PORT', 587);
  }

  get smtpUser(): string {
    return this.configService.getOrThrow<string>('SMTP_USER');
  }

  get smtpPass(): string {
    return this.configService.getOrThrow<string>('SMTP_PASS');
  }

  // External services
  get crmWebhookUrl(): string {
    return this.configService.getOrThrow<string>('CRM_WEBHOOK_URL');
  }

  get wordpressGraphqlUrl(): string {
    return this.configService.getOrThrow<string>('WORDPRESS_GRAPHQL_URL');
  }

  // CORS
  get corsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS', 'http://localhost:5173');
    return origins.split(',').map((o) => o.trim());
  }

  // Rate limiting
  get rateLimitEnabled(): boolean {
    return this.configService.get<boolean>('RATE_LIMIT_ENABLED', true);
  }
}
