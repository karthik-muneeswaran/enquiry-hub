import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { NotificationProducer } from './notification.producer';
import { EmailWorker } from './workers/email.worker';
import { PushWorker } from './workers/push.worker';
import { CrmSyncWorker } from './workers/crm-sync.worker';
import { RetentionWorker } from './workers/retention.worker';
import { AdminQueueController } from './admin-queue.controller';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>('REDIS_URL');
        const url = new URL(redisUrl);

        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port, 10) || 6379,
            password: url.password || undefined,
            db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.PUSH },
      { name: QUEUE_NAMES.CRM },
      { name: QUEUE_NAMES.MAINTENANCE },
    ),
  ],
  controllers: [AdminQueueController],
  providers: [NotificationProducer, EmailWorker, PushWorker, CrmSyncWorker, RetentionWorker],
  exports: [NotificationProducer, BullModule],
})
export class QueueModule {}
