import { Global, Module, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '@config/config.service';
import { AppConfigModule } from '@config/config.module';
import { CacheService, REDIS_CLIENT } from './cache.service';

const logger = new Logger('CacheModule');

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: AppConfigService): Redis => {
        const redis = new Redis(configService.redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy(times: number) {
            if (times > 10) {
              logger.error('Redis: max reconnection attempts reached');
              return null;
            }
            const delay = Math.min(times * 200, 5000);
            logger.log(`Redis: reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          },
          commandTimeout: 2000,
          connectTimeout: 5000,
        });

        redis.on('error', (err: Error) => {
          logger.error(`Redis client error: ${err.message}`);
        });

        redis.on('close', () => {
          logger.warn('Redis client connection closed');
        });

        redis.on('reconnecting', () => {
          logger.log('Redis client reconnecting...');
        });

        redis.on('ready', () => {
          logger.log('Redis client ready');
        });

        return redis;
      },
      inject: [AppConfigService],
    },
    CacheService,
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule {}
