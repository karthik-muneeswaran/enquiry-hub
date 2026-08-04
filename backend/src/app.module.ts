import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { LoggerModule } from 'nestjs-pino';
import { configValidationSchema } from './config/config.validation';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue';
import { CacheModule } from './cache';
import { EnquiryModule } from './modules/enquiry/enquiry.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PropertyModule } from './modules/property/property.module';
import { AuditModule } from './modules/audit';
import { GdprModule } from './modules/gdpr';
import { HealthModule } from './modules/health';
import { AdminModule } from './modules/admin';
import { RateLimitModule } from './modules/rate-limit';
import { EventLoopMonitor, GracefulShutdownService } from './common/services';
import { HttpMetricsInterceptor, LoadSheddingInterceptor, RequestIdInterceptor, TransformInterceptor } from './common/interceptors';
import { getLoggerConfig } from './observability';
import { MetricsService } from './observability/metrics.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
    LoggerModule.forRoot(getLoggerConfig()),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }: { req: any; res: any }) => ({ req, res }),
    }),
    AppConfigModule,
    DatabaseModule,
    QueueModule,
    CacheModule,
    AuditModule,
    GdprModule,
    EnquiryModule,
    WebhookModule,
    PropertyModule,
    HealthModule,
    AdminModule,
    RateLimitModule,
  ],
  providers: [
    MetricsService,
    EventLoopMonitor,
    GracefulShutdownService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoadSheddingInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class AppModule {}
