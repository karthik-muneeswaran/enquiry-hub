import { IsOptional, IsEnum, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EnquiryStatus } from '@prisma/client';
import { BaseQueryDto } from '../../../common/dto';

export class ListEnquiriesDto extends BaseQueryDto {
  @ApiPropertyOptional({
    enum: EnquiryStatus,
    description: 'Filter by enquiry status',
  })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'name', 'email'],
    default: 'createdAt',
    description: 'Field to sort results by',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'name', 'email'])
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'email' = 'createdAt';
}
