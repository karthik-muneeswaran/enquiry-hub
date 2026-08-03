import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@queue/queue.constants';
import { AppConfigModule } from '@config/config.module';
import { WebhookController } from './webhook.controller';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    AppConfigModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.CRM }),
  ],
  controllers: [WebhookController],
  providers: [WebhookRepository, WebhookService],
  exports: [WebhookRepository, WebhookService],
})
export class WebhookModule {}
