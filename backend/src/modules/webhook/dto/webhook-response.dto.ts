import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookStatus } from '@prisma/client';

export class WebhookEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Unique event identifier' })
  eventId: string;

  @ApiProperty({ description: 'Event type' })
  type: string;

  @ApiProperty({ description: 'Event source system' })
  source: string;

  @ApiProperty({ description: 'Event payload data' })
  payload: Record<string, unknown>;

  @ApiProperty({ enum: WebhookStatus, description: 'Current processing status' })
  status: WebhookStatus;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Associated enquiry ID' })
  enquiryId?: string | null;

  @ApiPropertyOptional({ format: 'date-time', description: 'When the event was processed' })
  processedAt?: string | null;

  @ApiProperty({ description: 'Number of processing attempts' })
  attemptCount: number;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class PaginatedWebhookEventResponseDto {
  @ApiProperty({ type: [WebhookEventResponseDto] })
  data: WebhookEventResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      nextCursor: 'eyJpZCI6Ij...',
      previousCursor: null,
      hasMore: true,
      totalCount: 42,
    },
  })
  pagination: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasMore: boolean;
    totalCount: number;
  };
}
