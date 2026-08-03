import { Module } from '@nestjs/common';
import { CacheModule } from '@cache/cache.module';
import { EnquiryController } from './enquiry.controller';
import { EnquiryRepository } from './enquiry.repository';
import { EnquiryService } from './enquiry.service';
import { EnquiryCacheService } from './enquiry-cache.service';
import { MetricsService } from '@observability/metrics.service';

@Module({
  imports: [CacheModule],
  controllers: [EnquiryController],
  providers: [EnquiryRepository, EnquiryService, EnquiryCacheService, MetricsService],
  exports: [EnquiryRepository, EnquiryService],
})
export class EnquiryModule {}
