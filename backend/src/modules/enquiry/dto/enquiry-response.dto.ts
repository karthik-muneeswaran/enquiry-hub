import { ApiProperty } from '@nestjs/swagger';
import { EnquiryStatus } from '@prisma/client';

export class EnquiryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ format: 'email', example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: '+61412345678', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'prop-uuid-123' })
  propertyId: string;

  @ApiProperty({ example: '3 Bed Apartment in Sydney CBD' })
  propertyTitle: string;

  @ApiProperty({ example: 'I am interested in scheduling a viewing.' })
  message: string;

  @ApiProperty({ example: 'website' })
  source: string;

  @ApiProperty({ description: 'GDPR consent for data processing' })
  consent: boolean;

  @ApiProperty({ enum: EnquiryStatus, example: 'PENDING' })
  status: EnquiryStatus;

  @ApiProperty({ nullable: true, description: 'Idempotency key if provided' })
  idempotencyKey: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty({ nullable: true, description: 'Cursor for the next page' })
  nextCursor: string | null;

  @ApiProperty({ nullable: true, description: 'Cursor for the previous page' })
  previousCursor: string | null;

  @ApiProperty({ description: 'Whether more results exist' })
  hasMore: boolean;

  @ApiProperty({ description: 'Total number of matching records' })
  totalCount: number;
}

export class PaginatedEnquiryResponseDto {
  @ApiProperty({ type: [EnquiryResponseDto] })
  data: EnquiryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
