import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { motion } from 'framer-motion';
import { GET_PROPERTIES, PropertiesData, PropertiesVars, PropertyNode } from '../graphql/queries';
import { useCreateEnquiry } from '../hooks/useCreateEnquiry';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useUI } from '../providers/UIProvider';
import { offlineQueue } from '../services/OfflineQueue';
import { NormalizedApiError } from '../services/api/types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { cn } from '../components/ui/cn';
import {
  PaperAirplaneIcon,
  BuildingOfficeIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface EnquiryFormValues {
  name: string;
  email: string;
  phone: string;
  propertyId: string;
  propertyTitle: string;
  message: string;
  source: string;
  consent: boolean;
}

export function EnquiryFormPage() {
  const [searchParams] = useSearchParams();
  const { addToast } = useUI();
  const createEnquiry = useCreateEnquiry();
  const isOnline = useOnlineStatus();

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);

  // Property selector state
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; title: string } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EnquiryFormValues>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      propertyId: searchParams.get('propertyId') || '',
      propertyTitle: searchParams.get('propertyTitle') || '',
      message: '',
      source: 'website',
      consent: false,
    },
  });

  const { data: propertiesData, loading: propertiesLoading } = useQuery<
    PropertiesData,
    PropertiesVars
  >(GET_PROPERTIES, { variables: { first: 50 } });

  const filteredProperties = (propertiesData?.properties.edges ?? []).filter(({ node }) => {
    if (!propertySearch.trim()) return true;
    const term = propertySearch.toLowerCase();
    return (
      node.title.toLowerCase().includes(term) ||
      (node.location?.toLowerCase().includes(term) ?? false)
    );
  });

  useEffect(() => {
    const urlPropertyId = searchParams.get('propertyId');
    const urlPropertyTitle = searchParams.get('propertyTitle');
    if (urlPropertyId && urlPropertyTitle) {
      setSelectedProperty({ id: urlPropertyId, title: urlPropertyTitle });
      setValue('propertyId', urlPropertyId);
      setValue('propertyTitle', urlPropertyTitle);
    }
  }, [searchParams, setValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-property-select]')) {
        setShowPropertyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (rateLimitSeconds === null || rateLimitSeconds <= 0) return;
    const timer = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const handlePropertySelect = (property: PropertyNode) => {
    setSelectedProperty({ id: property.slug, title: property.title });
    setValue('propertyId', property.slug);
    setValue('propertyTitle', property.title);
    setShowPropertyDropdown(false);
    setPropertySearch('');
  };

  const onSubmit = useCallback(
    (data: EnquiryFormValues) => {
      setDuplicateWarning(null);
      setRateLimitSeconds(null);

      const payload = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        propertyId: data.propertyId,
        propertyTitle: data.propertyTitle,
        message: data.message,
        source: data.source,
        consentGiven: data.consent,
      };

      if (!isOnline) {
        offlineQueue.enqueue('/enquiry', payload);
        addToast(
          'warning',
          'You are offline. Your enquiry has been queued and will be sent when you reconnect.',
        );
        reset();
        setSelectedProperty(null);
        return;
      }

      createEnquiry.mutate(payload, {
        onSuccess: () => {
          reset();
          setSelectedProperty(null);
        },
        onError: (error: NormalizedApiError) => {
          if (error.code === 'DUPLICATE_ENQUIRY') {
            setDuplicateWarning(
              'You have already submitted an enquiry for this property recently.',
            );
          } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
            setRateLimitSeconds(60);
            addToast('error', 'Too many requests. Please wait before trying again.');
          } else {
            addToast('error', error.message || 'Failed to submit enquiry.');
          }
        },
      });
    },
    [createEnquiry, reset, addToast, isOnline],
  );

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-surface-900 sm:text-display-xs">
            Submit an Enquiry
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Fill out the form below and we&apos;ll get back to you shortly.
          </p>
        </div>

        {/* Alerts */}
        {duplicateWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-orange-800">{duplicateWarning}</p>
          </motion.div>
        )}

        {rateLimitSeconds !== null && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <p className="text-sm font-medium text-red-800">
              Rate limited. Try again in <span className="font-bold">{rateLimitSeconds}s</span>
            </p>
          </motion.div>
        )}

        {/* Form */}
        <Card padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-surface-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="John Smith"
                aria-invalid={!!errors.name}
                className={cn(
                  'block w-full rounded-xl border bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-offset-0',
                  errors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-surface-200 focus:border-brand-500 focus:ring-brand-200',
                )}
                {...register('name', {
                  required: 'Name is required',
                  maxLength: { value: 100, message: 'Name must be at most 100 characters' },
                })}
              />
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                className={cn(
                  'block w-full rounded-xl border bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-offset-0',
                  errors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-surface-200 focus:border-brand-500 focus:ring-brand-200',
                )}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-surface-700 mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+61 400 000 000"
                className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-0"
                {...register('phone', {
                  maxLength: { value: 20, message: 'Phone must be at most 20 characters' },
                })}
              />
              {errors.phone && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Property Selection */}
            <div className="relative" data-property-select>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Property <span className="text-red-500">*</span>
              </label>

              {selectedProperty ? (
                <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="h-4 w-4 text-brand-600" />
                    <span className="text-sm font-medium text-surface-900">
                      {selectedProperty.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProperty(null);
                      setValue('propertyId', '');
                      setValue('propertyTitle', '');
                    }}
                    className="rounded-lg p-1 text-surface-400 hover:bg-white hover:text-surface-600 transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                  <input
                    type="text"
                    placeholder="Search properties..."
                    value={propertySearch}
                    onChange={(e) => {
                      setPropertySearch(e.target.value);
                      setShowPropertyDropdown(true);
                    }}
                    onFocus={() => setShowPropertyDropdown(true)}
                    className="block w-full rounded-xl border border-surface-200 bg-white py-3 pl-10 pr-4 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-0"
                    aria-label="Search and select a property"
                  />

                  {showPropertyDropdown && (
                    <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-surface-200 bg-white shadow-elevated">
                      {propertiesLoading ? (
                        <div className="px-4 py-3 text-sm text-surface-500">Loading...</div>
                      ) : filteredProperties.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-surface-500">
                          No properties found
                        </div>
                      ) : (
                        filteredProperties.map(({ node }) => (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => handlePropertySelect(node)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-surface-50 focus:bg-surface-50 focus:outline-none transition-colors"
                          >
                            <BuildingOfficeIcon className="h-4 w-4 shrink-0 text-surface-400" />
                            <div>
                              <span className="font-medium text-surface-900">{node.title}</span>
                              {node.location && (
                                <span className="ml-2 text-surface-400">{node.location}</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {errors.propertyId && !selectedProperty && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  Please select a property
                </p>
              )}
              <input
                type="hidden"
                {...register('propertyId', { required: 'Please select a property' })}
              />
              <input type="hidden" {...register('propertyTitle', { required: true })} />
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                rows={5}
                placeholder="I'm interested in this property and would like to know more about..."
                aria-invalid={!!errors.message}
                className={cn(
                  'block w-full rounded-xl border bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-offset-0',
                  errors.message
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-surface-200 focus:border-brand-500 focus:ring-brand-200',
                )}
                {...register('message', {
                  required: 'Message is required',
                  maxLength: { value: 2000, message: 'Message must be at most 2000 characters' },
                })}
              />
              {errors.message && (
                <p className="mt-1.5 text-sm text-red-600" role="alert">
                  {errors.message.message}
                </p>
              )}
            </div>

            <input type="hidden" {...register('source', { required: true })} />

            {/* Consent */}
            <div className="flex items-start gap-3 rounded-xl bg-surface-50 p-4">
              <input
                id="consent"
                type="checkbox"
                aria-invalid={!!errors.consent}
                className="mt-0.5 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                {...register('consent', {
                  validate: (value) => value === true || 'You must consent to proceed',
                })}
              />
              <label htmlFor="consent" className="text-sm text-surface-600 leading-relaxed">
                I consent to the processing of my personal data in accordance with the privacy
                policy. <span className="text-red-500">*</span>
              </label>
            </div>
            {errors.consent && (
              <p className="text-sm text-red-600" role="alert">
                {errors.consent.message}
              </p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isSubmitting || createEnquiry.isPending}
              disabled={rateLimitSeconds !== null}
              icon={<PaperAirplaneIcon className="h-5 w-5" />}
            >
              {createEnquiry.isPending ? 'Submitting...' : 'Submit Enquiry'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
