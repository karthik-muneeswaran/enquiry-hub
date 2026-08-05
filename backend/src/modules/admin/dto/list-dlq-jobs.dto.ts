import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '@common/dto/base-query.dto';

/**
 * DTO for querying dead-letter queue jobs with filtering, sorting, and pagination.
 * Extends BaseQueryDto for cursor pagination, search, and date filtering.
 *
 * Search applies ILIKE on error message and serialized job data.
 */
export class ListDlqJobsDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by queue name',
    enum: ['email', 'push', 'crm'],
  })
  @IsOptional()
  @IsIn(['email', 'push', 'crm'])
  queueName?: 'email' | 'push' | 'crm';

  @ApiPropertyOptional({
    description: 'Sort field for DLQ jobs',
    enum: ['failedAt', 'attemptsMade'],
    default: 'failedAt',
  })
  @IsOptional()
  @IsIn(['failedAt', 'attemptsMade'])
  sortBy?: 'failedAt' | 'attemptsMade' = 'failedAt';
}
