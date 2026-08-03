import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Audit log record ID' })
  id: string;

  @ApiProperty({ description: 'Entity type (e.g., Enquiry, WebhookEvent, GDPR)' })
  entity: string;

  @ApiProperty({ description: 'Entity ID that was changed' })
  entityId: string;

  @ApiProperty({
    description: 'Action performed',
    enum: ['CREATE', 'UPDATE', 'DELETE'],
  })
  action: string;

  @ApiPropertyOptional({
    description: 'State before the change (null for CREATE actions)',
    type: 'object',
    nullable: true,
  })
  before: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: 'State after the change (null for DELETE actions)',
    type: 'object',
    nullable: true,
  })
  after: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Identity that performed the action' })
  performedBy: string | null;

  @ApiPropertyOptional({ description: 'Request ID for correlation' })
  requestId: string | null;

  @ApiProperty({ format: 'date-time', description: 'Timestamp of the change' })
  createdAt: string;
}

export class PaginatedAuditLogResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

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
