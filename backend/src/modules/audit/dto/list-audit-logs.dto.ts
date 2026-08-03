import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '@common/dto/base-query.dto';

export class ListAuditLogsDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g., Enquiry, WebhookEvent, GDPR)',
  })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific entity ID',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action type',
    enum: ['CREATE', 'UPDATE', 'DELETE'],
  })
  @IsOptional()
  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  action?: 'CREATE' | 'UPDATE' | 'DELETE';

  @ApiPropertyOptional({
    description: 'Filter by performing identity',
  })
  @IsOptional()
  @IsString()
  performedBy?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt'])
  sortBy?: 'createdAt' = 'createdAt';
}
