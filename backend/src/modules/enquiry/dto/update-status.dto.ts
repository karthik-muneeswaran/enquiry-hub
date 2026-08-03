import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EnquiryStatus } from '@prisma/client';

export class UpdateEnquiryStatusDto {
  @ApiProperty({
    enum: EnquiryStatus,
    description: 'New status for the enquiry',
    example: 'PROCESSING',
  })
  @IsNotEmpty()
  @IsEnum(EnquiryStatus)
  status: EnquiryStatus;
}
