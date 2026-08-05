import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { RateLimit } from '@common/decorators';
import { AuditService } from './audit.service';
import { ListAuditLogsDto, PaginatedAuditLogResponseDto } from './dto';

@ApiTags('Audit')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/audit — List audit logs with cursor pagination and filtering
   */
  @Get()
  @RateLimit({ limit: 30, window: 60, scope: 'ip' })
  @ApiOperation({
    summary: 'List audit logs with pagination, filtering, and sorting',
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
    name: 'entity',
    required: false,
    type: String,
    description: 'Filter by entity type (Enquiry, WebhookEvent, GDPR)',
  })
  @ApiQuery({
    name: 'entityId',
    required: false,
    type: String,
    description: 'Filter by specific entity ID',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    description: 'Filter by action type',
  })
  @ApiQuery({
    name: 'performedBy',
    required: false,
    type: String,
    description: 'Filter by performing identity',
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
    description: 'Search in entity, entityId, performedBy, requestId',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt'],
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
    description: 'Paginated list of audit logs',
    type: PaginatedAuditLogResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async listAuditLogs(@Query() query: ListAuditLogsDto) {
    return this.auditService.findAll(query);
  }
}
