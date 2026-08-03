import { Module } from '@nestjs/common';
import { EnquiryController } from './enquiry.controller';
import { EnquiryRepository } from './enquiry.repository';
import { EnquiryService } from './enquiry.service';

@Module({
  controllers: [EnquiryController],
  providers: [EnquiryRepository, EnquiryService],
  exports: [EnquiryRepository, EnquiryService],
})
export class EnquiryModule {}
