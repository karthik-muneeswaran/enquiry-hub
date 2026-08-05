import { Module } from '@nestjs/common';
import { WordPressClient } from './wordpress.client';
import { PropertyResolver } from './property.resolver';
import { PropertyService } from './property.service';
import { PropertyCacheService } from './property-cache.service';
import { AppConfigModule } from '@config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [WordPressClient, PropertyResolver, PropertyService, PropertyCacheService],
  exports: [WordPressClient, PropertyService, PropertyCacheService],
})
export class PropertyModule {}
