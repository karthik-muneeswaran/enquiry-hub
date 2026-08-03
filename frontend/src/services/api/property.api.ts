import { apiClient } from './client';
import { PaginationMeta } from './types';

/**
 * Property API module.
 * Note: Most property data is fetched via GraphQL (Apollo Client).
 * This REST module serves as a fallback or for simple lookups.
 */

export interface Property {
  id: string;
  wpId: number;
  title: string;
  slug: string;
  content: unknown;
  excerpt?: string;
  imageUrl?: string;
  cachedAt: string;
}

export interface ListPropertiesParams {
  cursor?: string;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

interface PropertiesListResponse {
  data: Property[];
  pagination: PaginationMeta;
}

export const propertyApi = {
  getBySlug(slug: string): Promise<Property> {
    return apiClient.get<Property>(`/property/${slug}`);
  },

  list(params?: ListPropertiesParams): Promise<PropertiesListResponse> {
    return apiClient.get<PropertiesListResponse>('/properties', { params });
  },
};
