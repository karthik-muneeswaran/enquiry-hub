import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Property } from '@prisma/client';
import { PropertyRepository } from './property.repository';

/**
 * PropertyDataLoader uses the DataLoader library to batch and deduplicate
 * property resolution requests within a single request lifecycle.
 *
 * Scoped to REQUEST so each GraphQL request gets its own DataLoader instance,
 * preventing cross-request cache pollution.
 */
@Injectable({ scope: Scope.REQUEST })
export class PropertyDataLoader {
  private readonly loader: DataLoader<string, Property | null>;

  constructor(private readonly propertyRepository: PropertyRepository) {
    this.loader = new DataLoader<string, Property | null>(
      async (ids: readonly string[]) => {
        const properties = await this.propertyRepository.findByIds([...ids]);

        // Map results back to the order of requested IDs
        const propertyMap = new Map<string, Property>();
        for (const property of properties) {
          propertyMap.set(property.id, property);
        }

        return ids.map((id) => propertyMap.get(id) ?? null);
      },
      {
        // Deduplicate requests for the same ID within a batch
        cacheKeyFn: (key) => key,
      },
    );
  }

  /**
   * Load a single property by ID (batched).
   */
  async load(id: string): Promise<Property | null> {
    return this.loader.load(id);
  }

  /**
   * Load multiple properties by IDs (batched).
   */
  async loadMany(ids: string[]): Promise<(Property | null | Error)[]> {
    return this.loader.loadMany(ids);
  }

  /**
   * Prime the DataLoader cache with a known value.
   */
  prime(id: string, property: Property): void {
    this.loader.prime(id, property);
  }

  /**
   * Clear a specific key from the DataLoader cache.
   */
  clear(id: string): void {
    this.loader.clear(id);
  }
}
