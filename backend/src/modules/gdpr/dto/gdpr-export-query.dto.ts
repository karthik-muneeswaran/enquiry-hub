import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GdprExportQueryDto {
  @ApiPropertyOptional({
    description: 'Pagination cursor (opaque token)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Page size (1-100, default 50)',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: ['enquiry', 'audit', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['enquiry', 'audit', 'all'])
  entity?: 'enquiry' | 'audit' | 'all' = 'all';
}
