import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { EnquiryStatus } from '@prisma/client';
import { RateLimit } from '@common/decorators';
import { ETagInterceptor } from '@common/interceptors/etag.interceptor';
import { EnquiryService } from './enquiry.service';
import {
  CreateEnquiryDto,
  ListEnquiriesDto,
  EnquiryResponseDto,
  PaginatedEnquiryResponseDto,
} from './dto';

@ApiTags('Enquiry')
@Controller()
export class EnquiryController {
  constructor(private readonly enquiryService: EnquiryService) {}

  /**
   * POST /api/v1/enquiry — Create a new property enquiry
   */
  @Post('enquiry')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 10, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'Create a new property enquiry' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'UUID for idempotent submission — repeated requests with the same key return the original response',
  })
  @ApiResponse({
    status: 201,
    description: 'Enquiry created successfully',
    type: EnquiryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing or invalid fields',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate enquiry detected within the 10-minute window',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async create(
    @Body() dto: CreateEnquiryDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.enquiryService.create(dto, idempotencyKey);
  }

  /**
   * GET /api/v1/enquiry/:id — Retrieve a single enquiry by ID
   */
  @Get('enquiry/:id')
  @RateLimit({ limit: 100, window: 60, scope: 'ip' })
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Get enquiry by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid', description: 'Enquiry UUID' })
  @ApiResponse({
    status: 200,
    description: 'Enquiry found',
    type: EnquiryResponseDto,
  })
  @ApiResponse({
    status: 304,
    description: 'Not modified (ETag match)',
  })
  @ApiResponse({
    status: 404,
    description: 'Enquiry not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async findOne(@Param('id') id: string) {
    return this.enquiryService.findById(id);
  }

  /**
   * GET /api/v1/enquiries — List enquiries with cursor pagination and filtering
   */
  @Get('enquiries')
  @RateLimit({ limit: 60, window: 60, scope: 'ip' })
  @ApiOperation({ summary: 'List enquiries with cursor pagination and filtering' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (opaque token)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (1-100, default 20)' })
  @ApiQuery({ name: 'status', required: false, enum: EnquiryStatus, description: 'Filter by enquiry status' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Filter records created on or after this date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'Filter records created on or before this date (ISO 8601)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in name, email, message' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'name', 'email'], description: 'Field to sort by (default: createdAt)' })
  @ApiQuery({ name: 'sortDir', required: false, enum: ['asc', 'desc'], description: 'Sort direction (default: desc)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of enquiries',
    type: PaginatedEnquiryResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async findAll(@Query() query: ListEnquiriesDto) {
    return this.enquiryService.findAll(query);
  }
}
