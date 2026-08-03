import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WebhookPayloadDto {
  @ApiProperty({
    description: 'Unique event identifier for deduplication',
    example: 'evt_abc123',
  })
  @IsNotEmpty()
  @IsString()
  eventId: string;

  @ApiProperty({
    description: 'Event type identifier',
    example: 'enquiry.status_changed',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Event source system',
    example: 'salesforce',
  })
  @IsNotEmpty()
  @IsString()
  source: string;

  @ApiProperty({
    description: 'Event payload data',
    example: { status: 'completed', updatedAt: '2025-01-15T10:00:00Z' },
  })
  @IsNotEmpty()
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Associated enquiry ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  enquiryId?: string;
}
