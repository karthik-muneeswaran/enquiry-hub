import {
  IsNotEmpty,
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnquiryDto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the enquirer' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'john@example.com', format: 'email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: '+61412345678',
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: 'prop-uuid-123', description: 'Property identifier' })
  @IsNotEmpty()
  @IsString()
  propertyId: string;

  @ApiProperty({ example: '3 Bed Apartment in Sydney CBD' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  propertyTitle: string;

  @ApiProperty({
    example: 'I am interested in scheduling a viewing.',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiProperty({
    example: 'website',
    description: "Lead source identifier (e.g., 'website', 'mobile', 'api')",
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  source: string;

  @ApiProperty({
    example: true,
    description: 'GDPR consent for data processing',
  })
  @IsBoolean()
  consentGiven: boolean;
}
