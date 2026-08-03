import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { WordPressClient, WPPropertyNode } from './wordpress.client';
import { PropertyRepository } from './property.repository';
import { PropertyCacheService } from './property-cache.service';
import { chunk } from '@common/utils';

/** Queue name for property sync jobs */
export const PROPERTY_SYNC_QUEUE = 'property-sync';

/** Batch size for property upserts within a single transaction */
const BATCH_SIZE = 50;

/** Cron expression: every 30 minutes */
const SYNC_CRON = '*/30 * * * *';

/** Repeatable job ID to prevent duplicates */
const SYNC_JOB_ID = 'property-sync-repeatable';

@Processor(PROPERTY_SYNC_QUEUE)
@Injectable()
export class PropertySyncJob extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PropertySyncJob.name);

  constructor(
    @InjectQueue(PROPERTY_SYNC_QUEUE) private readonly syncQueue: Queue,
    private readonly wordpressClient: WordPressClient,
    private readonly propertyRepository: PropertyRepository,
    private readonly propertyCacheService: PropertyCacheService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Register the repeatable sync job (every 30 minutes)
    await this.syncQueue.upsertJobScheduler(
      SYNC_JOB_ID,
      { pattern: SYNC_CRON },
      {
        name: 'sync-properties',
        data: {},
        opts: {
          removeOnComplete: { age: 24 * 60 * 60, count: 48 }, // Keep last 48 runs (24h)
          removeOnFail: { age: 7 * 24 * 60 * 60, count: 100 },
        },
      },
    );

    this.logger.log(`Property sync job scheduled: ${SYNC_CRON}`);
  }

  /**
   * Process the property sync job.
   * Fetches all properties from WPGraphQL and upserts them into the local Property table.
   */
  async process(job: Job): Promise<void> {
    this.logger.log(`Starting property sync (job ${job.id})`);

    try {
      // 1. Fetch all properties from WordPress (paginate through all pages)
      const allProperties = await this.fetchAllProperties();
      this.logger.log(`Fetched ${allProperties.length} properties from WordPress`);

      if (allProperties.length === 0) {
        this.logger.warn('No properties fetched from WordPress — skipping sync');
        return;
      }

      // 2. Chunk properties into batches of 50
      const batches = chunk(allProperties, BATCH_SIZE);

      // 3. Upsert each batch within a transaction (ReadCommitted)
      for (const batch of batches) {
        const upsertData = batch.map((node) => ({
          wpId: node.databaseId,
          slug: node.slug,
          title: node.title,
          content: node.content || null,
          excerpt: node.excerpt || null,
          featuredImage: node.featuredImage?.node?.sourceUrl || null,
        }));

        await this.propertyRepository.upsertBatch(upsertData);
      }

      this.logger.log(
        `Synced ${allProperties.length} properties in ${batches.length} batch(es)`,
      );
    } catch (error) {
      this.logger.error(
        `Property sync failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Don't rethrow — job will retry on next scheduled interval
    }
  }

  /**
   * Trigger an immediate sync by adding a one-off job to the queue.
   */
  async triggerImmediateSync(): Promise<void> {
    await this.syncQueue.add('sync-properties-immediate', {}, {
      removeOnComplete: { age: 60 * 60, count: 10 },
      removeOnFail: { age: 24 * 60 * 60, count: 50 },
    });
    this.logger.log('Immediate property sync triggered');
  }

  /**
   * Fetches all properties from WPGraphQL by paginating through all pages.
   */
  private async fetchAllProperties(): Promise<WPPropertyNode[]> {
    const allNodes: WPPropertyNode[] = [];
    let hasNextPage = true;
    let after: string | undefined;
    const pageSize = 100; // Fetch 100 at a time from WP

    while (hasNextPage) {
      const connection = await this.wordpressClient.fetchProperties(pageSize, after);

      for (const edge of connection.edges) {
        allNodes.push(edge.node);
      }

      hasNextPage = connection.pageInfo.hasNextPage;
      after = connection.pageInfo.endCursor ?? undefined;
    }

    return allNodes;
  }
}
