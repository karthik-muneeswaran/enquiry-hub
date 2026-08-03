import { IsOptional, IsString, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookStatus } from '@prisma/client';
import { BaseQueryDto } from '@common/dto/base-query.dto';

export class ListWebhookEventsDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by webhook event status',
    enum: WebhookStatus,
  })
  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @ApiPropertyOptional({
    description: 'Filter by event type',
    example: 'enquiry.status_changed',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by event source',
    example: 'salesforce',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'processedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'processedAt'])
  sortBy?: 'createdAt' | 'processedAt' = 'createdAt';
}
