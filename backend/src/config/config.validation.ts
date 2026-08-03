import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required (PostgreSQL connection string)',
  }),

  // Redis
  REDIS_URL: Joi.string().required().messages({
    'any.required': 'REDIS_URL is required (Redis connection string)',
  }),

  // Swagger
  SWAGGER_ENABLED: Joi.boolean().default(true),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),

  // Security
  HMAC_SECRET: Joi.string().required().messages({
    'any.required': 'HMAC_SECRET is required for webhook signature validation',
  }),
  API_KEYS: Joi.string().required().messages({
    'any.required': 'API_KEYS is required (comma-separated list of valid API keys)',
  }),

  // SMTP
  SMTP_HOST: Joi.string().required().messages({
    'any.required': 'SMTP_HOST is required for email notifications',
  }),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required().messages({
    'any.required': 'SMTP_USER is required for email notifications',
  }),
  SMTP_PASS: Joi.string().required().messages({
    'any.required': 'SMTP_PASS is required for email notifications',
  }),

  // External services
  CRM_WEBHOOK_URL: Joi.string().uri().required().messages({
    'any.required': 'CRM_WEBHOOK_URL is required for CRM integration',
  }),
  WORDPRESS_GRAPHQL_URL: Joi.string().uri().required().messages({
    'any.required': 'WORDPRESS_GRAPHQL_URL is required for property data',
  }),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
});
