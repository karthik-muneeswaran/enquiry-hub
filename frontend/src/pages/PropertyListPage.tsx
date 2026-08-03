import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GET_PROPERTIES,
  PropertiesData,
  PropertiesVars,
  PropertyNode,
} from '../graphql/queries';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  HomeModernIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';

function PropertyCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-card">
      <div className="h-48 bg-surface-200" />
      <div className="p-5 space-y-3">
        <div className="h-5 w-3/4 rounded-lg bg-surface-200" />
        <div className="h-4 w-full rounded-lg bg-surface-100" />
        <div className="h-4 w-2/3 rounded-lg bg-surface-100" />
        <div className="flex gap-3 pt-2">
          <div className="h-7 w-20 rounded-full bg-surface-200" />
          <div className="h-7 w-16 rounded-full bg-surface-200" />
        </div>
      </div>
    </div>
  );
}

function PropertyCard({ property, onClick }: { property: PropertyNode; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="w-full rounded-2xl border border-surface-200 bg-white text-left overflow-hidden shadow-card transition-shadow duration-300 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    >
      {/* Image */}
      {property.featuredImage ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={property.featuredImage}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {property.price != null && (
            <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1 text-sm font-bold text-surface-900 shadow-sm">
              ${property.price.toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center bg-surface-100">
          <HomeModernIcon className="h-12 w-12 text-surface-300" />
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-semibold text-surface-900 line-clamp-1">
          {property.title}
        </h3>
        {property.excerpt && (
          <p
            className="mt-1.5 text-sm text-surface-500 line-clamp-2 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: property.excerpt }}
          />
        )}

        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {property.bedrooms != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
              {property.bedrooms} bed{property.bedrooms !== 1 ? 's' : ''}
            </span>
          )}
          {property.location && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-600">
              <MapPinIcon className="h-3 w-3" />
              {property.location}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export function PropertyListPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, loading, error, fetchMore } = useQuery<PropertiesData, PropertiesVars>(
    GET_PROPERTIES,
    {
      variables: {
        first: 12,
        search: searchTerm || undefined,
      },
      notifyOnNetworkStatusChange: true,
    },
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(searchInput);
  };

  const handleLoadMore = () => {
    if (!data?.properties.pageInfo.endCursor) return;
    fetchMore({
      variables: {
        after: data.properties.pageInfo.endCursor,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          properties: {
            ...fetchMoreResult.properties,
            edges: [...prev.properties.edges, ...fetchMoreResult.properties.edges],
          },
        };
      },
    });
  };

  // Network error fallback
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
            <HomeModernIcon className="h-8 w-8 text-surface-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-surface-700">
            Properties temporarily unavailable
          </h2>
          <p className="mt-2 text-sm text-surface-500 max-w-sm mx-auto">
            We&apos;re having trouble loading properties right now. Please try again shortly.
          </p>
        </div>
      </div>
    );
  }

  const edges = data?.properties.edges ?? [];
  const hasNextPage = data?.properties.pageInfo.hasNextPage ?? false;
  const showSkeletons = loading && edges.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">
            Properties
          </h1>
          <p className="mt-1 text-sm text-surface-500">
            Browse available listings
          </p>
        </div>
        {edges.length > 0 && (
          <span className="text-sm text-surface-400">
            {edges.length} listing{edges.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or location..."
            className="block w-full rounded-xl border border-surface-200 bg-white py-3 pl-11 pr-4 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            aria-label="Search properties"
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {/* Property cards grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {showSkeletons
          ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
          : edges.map(({ node }, index) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                <PropertyCard
                  property={node}
                  onClick={() => navigate(`/properties/${node.slug}`)}
                />
              </motion.div>
            ))}
      </div>

      {/* Empty state */}
      {!loading && edges.length === 0 && (
        <div className="py-16 text-center">
          <HomeModernIcon className="mx-auto h-12 w-12 text-surface-300" />
          <p className="mt-3 text-sm font-medium text-surface-600">No properties found</p>
          <p className="mt-1 text-xs text-surface-400">Try adjusting your search</p>
        </div>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleLoadMore}
            loading={loading}
            icon={<ArrowDownIcon className="h-4 w-4" />}
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
