import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import { GET_PROPERTY, PropertyData, PropertyVars } from '../graphql/queries';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  ArrowLeftIcon,
  HomeModernIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  Square3Stack3DIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-64 w-full rounded-2xl bg-surface-200 sm:h-96" />
      <div className="h-8 w-2/3 rounded-lg bg-surface-200" />
      <div className="flex gap-3">
        <div className="h-8 w-24 rounded-full bg-surface-200" />
        <div className="h-8 w-24 rounded-full bg-surface-200" />
        <div className="h-8 w-24 rounded-full bg-surface-200" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-surface-100" />
        <div className="h-4 w-full rounded bg-surface-100" />
        <div className="h-4 w-3/4 rounded bg-surface-100" />
      </div>
    </div>
  );
}

export function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<PropertyData, PropertyVars>(GET_PROPERTY, {
    variables: { slug: slug! },
    skip: !slug,
  });

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
            <HomeModernIcon className="h-8 w-8 text-surface-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-surface-700">
            Property unavailable
          </h2>
          <p className="mt-2 text-sm text-surface-500">
            We&apos;re having trouble loading this property. Please try again.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/properties')}
          >
            Back to Properties
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl">
        <DetailSkeleton />
      </div>
    );
  }

  const property = data?.property;

  if (!property) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100">
            <HomeModernIcon className="h-8 w-8 text-surface-400" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-surface-700">
            Property not found
          </h2>
          <p className="mt-2 text-sm text-surface-500 max-w-sm mx-auto">
            The property you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/properties')}
          >
            Back to Properties
          </Button>
        </div>
      </div>
    );
  }

  const handleMakeEnquiry = () => {
    const params = new URLSearchParams({
      propertyId: property.slug,
      propertyTitle: property.title,
    });
    navigate(`/enquiry/new?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/properties')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Properties
      </button>

      {/* Featured image */}
      {property.featuredImage ? (
        <div className="relative overflow-hidden rounded-2xl shadow-card">
          <img
            src={property.featuredImage}
            alt={property.title}
            className="h-64 w-full object-cover sm:h-80 md:h-96"
          />
          {/* Price overlay */}
          {property.price != null && (
            <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 backdrop-blur-sm px-4 py-2 shadow-md">
              <span className="text-lg font-bold text-surface-900">
                ${property.price.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-surface-100 sm:h-96">
          <HomeModernIcon className="h-16 w-16 text-surface-300" />
        </div>
      )}

      {/* Title */}
      <h1 className="mt-6 text-2xl font-bold text-surface-900 sm:text-3xl">
        {property.title}
      </h1>

      {/* Property meta badges */}
      <div className="mt-4 flex flex-wrap gap-2">
        {property.price != null && (
          <Badge variant="success" size="md">
            <CurrencyDollarIcon className="h-3.5 w-3.5" />
            ${property.price.toLocaleString()}
          </Badge>
        )}
        {property.bedrooms != null && (
          <Badge variant="default" size="md">
            {property.bedrooms} Bedroom{property.bedrooms !== 1 ? 's' : ''}
          </Badge>
        )}
        {property.bathrooms != null && (
          <Badge variant="default" size="md">
            {property.bathrooms} Bathroom{property.bathrooms !== 1 ? 's' : ''}
          </Badge>
        )}
        {property.area != null && (
          <Badge variant="default" size="md">
            <Square3Stack3DIcon className="h-3.5 w-3.5" />
            {property.area.toLocaleString()} sqft
          </Badge>
        )}
        {property.location && (
          <Badge variant="info" size="md">
            <MapPinIcon className="h-3.5 w-3.5" />
            {property.location}
          </Badge>
        )}
        {property.propertyType && (
          <Badge variant="purple" size="md">
            {property.propertyType}
          </Badge>
        )}
      </div>

      {/* Content */}
      {property.content && (
        <div
          className="mt-8 prose prose-surface prose-sm max-w-none leading-relaxed
            prose-headings:text-surface-900 prose-p:text-surface-600
            prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline
            prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: property.content }}
        />
      )}

      {/* Make Enquiry CTA */}
      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-surface-200 bg-surface-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-surface-900">
            Interested in this property?
          </p>
          <p className="mt-1 text-sm text-surface-500">
            Send an enquiry and our team will get back to you.
          </p>
        </div>
        <Button
          size="lg"
          onClick={handleMakeEnquiry}
          icon={<EnvelopeIcon className="h-5 w-5" />}
        >
          Make Enquiry
        </Button>
      </div>
    </motion.div>
  );
}
