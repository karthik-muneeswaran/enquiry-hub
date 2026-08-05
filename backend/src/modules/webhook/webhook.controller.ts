import { Controller, Post, Get, Body, Query, Res, UseGuards, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { Response } from 'express';
import { WebhookStatus } from '@prisma/client';
import { RateLimit } from '@common/decorators';
import { ApiKeyGuard, HmacGuard } from '@common/guards';
import { WebhookService } from './webhook.service';
import {
  WebhookPayloadDto,
  ListWebhookEventsDto,
  WebhookEventResponseDto,
  PaginatedWebhookEventResponseDto,
} from './dto';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /api/v1/webhook/crm — Receive a CRM webhook event
   *
   * - Validates API key and HMAC signature
   * - Returns 202 for new events accepted for processing
   * - Returns 200 for duplicate events (already processed, idempotent)
   * - Returns 422 for schema validation failures
   */
  @Post('crm')
  @UseGuards(ApiKeyGuard, HmacGuard)
  @RateLimit({ limit: 200, window: 60, scope: 'apiKey' })
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Receive CRM webhook event' })
  @ApiHeader({
    name: 'X-API-Key',
    required: true,
    description: 'API key for authentication',
  })
  @ApiHeader({
    name: 'X-Webhook-Signature',
    required: true,
    description: 'HMAC-SHA256 signature of the request body (sha256=<hex>)',
  })
  @ApiResponse({
    status: 202,
    description: 'Webhook accepted for processing',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Duplicate event — already received and processed',
    type: WebhookEventResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid HMAC signature',
  })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing API key',
  })
  @ApiResponse({
    status: 422,
    description: 'Webhook payload failed schema validation',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async receiveCrmEvent(
    @Body() payload: WebhookPayloadDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.webhookService.processEvent(payload);

    if (result.isDuplicate) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.ACCEPTED);
    }

    return result.event;
  }

  /**
   * GET /api/v1/webhook/events — List webhook events with pagination, filtering, and sorting
   */
  @Get('events')
  @RateLimit({ limit: 60, window: 60, scope: 'ip' })
  @ApiOperation({
    summary: 'List webhook events with pagination, filtering, and sorting',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (opaque token)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (1-100, default 20)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WebhookStatus,
    description: 'Filter by event status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by event type',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    type: String,
    description: 'Filter by event source',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    description: 'Filter records created on or after this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    description: 'Filter records created on or before this date (ISO 8601)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in eventId, type, source',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'processedAt'],
    description: 'Field to sort by (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction (default: desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of webhook events',
    type: PaginatedWebhookEventResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async listEvents(@Query() query: ListWebhookEventsDto) {
    return this.webhookService.findAll(query);
  }
}
