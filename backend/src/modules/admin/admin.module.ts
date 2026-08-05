import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '@queue/queue.constants';
import { DatabaseModule } from '@database/database.module';
import { AdminController } from './admin.controller';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.PUSH },
      { name: QUEUE_NAMES.CRM },
    ),
  ],
  controllers: [AdminController],
  providers: [AdminAuthGuard],
})
export class AdminModule implements NestModule {
  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH) private readonly pushQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CRM) private readonly crmQueue: Queue,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues/board');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.emailQueue) as any,
        new BullMQAdapter(this.pushQueue) as any,
        new BullMQAdapter(this.crmQueue) as any,
      ],
      serverAdapter,
    });

    consumer.apply(serverAdapter.getRouter()).forRoutes('/admin/queues/board');
  }
}
