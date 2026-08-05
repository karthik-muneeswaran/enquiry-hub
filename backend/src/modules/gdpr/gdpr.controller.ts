import { Controller, Get, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RateLimit } from '@common/decorators';
import { GdprService } from './gdpr.service';
import { GdprExportQueryDto } from './dto';

@ApiTags('GDPR')
@Controller('gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  /**
   * GET /api/v1/gdpr/export/:email — Export all data for a given email (GDPR) — paginated
   */
  @Get('export/:email')
  @RateLimit({ limit: 5, window: 60, scope: 'ip' })
  @ApiOperation({
    summary: 'Export all data for a given email (GDPR) — paginated',
  })
  @ApiParam({
    name: 'email',
    type: String,
    description: 'Email address to export data for',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (max 100, default 50)',
  })
  @ApiQuery({
    name: 'entity',
    required: false,
    enum: ['enquiry', 'audit', 'all'],
    description: 'Filter by entity type',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated records associated with the email',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async exportData(@Param('email') email: string, @Query() query: GdprExportQueryDto) {
    return this.gdprService.exportData(email, query);
  }

  /**
   * DELETE /api/v1/gdpr/erase/:email — Erase all personal data for a given email (GDPR)
   */
  @Delete('erase/:email')
  @RateLimit({ limit: 3, window: 60, scope: 'ip' })
  @ApiOperation({
    summary: 'Erase all personal data for a given email (GDPR)',
  })
  @ApiParam({
    name: 'email',
    type: String,
    description: 'Email address to erase data for',
  })
  @ApiResponse({
    status: 200,
    description: 'Data erased/anonymized successfully',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async eraseData(@Param('email') email: string) {
    return this.gdprService.eraseData(email);
  }
}
