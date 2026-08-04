import { motion } from 'framer-motion';
import {
  BoltIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { type ReactNode } from 'react';

interface Feature {
  title: string;
  description: string;
  icon: ReactNode;
  color: string;
}

const features: Feature[] = [
  {
    title: 'Smart Queue Processing',
    description:
      'Enquiries are automatically routed through intelligent queues with retry logic, dead-letter handling, and priority-based processing.',
    icon: <BoltIcon className="h-6 w-6" />,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
  },
  {
    title: 'GDPR Compliant',
    description:
      'Built-in data export and erasure tools ensure compliance with privacy regulations. Consent tracking on every enquiry.',
    icon: <ShieldCheckIcon className="h-6 w-6" />,
    color: 'bg-green-50 text-green-600 border-green-200',
  },
  {
    title: 'Real-time Sync',
    description:
      'Properties sync from WordPress via GraphQL. Enquiry status updates flow in real-time with auto-refresh dashboards.',
    icon: <ArrowPathIcon className="h-6 w-6" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    title: 'Offline Resilient',
    description:
      'Submissions are queued locally when offline and automatically sent when connectivity returns. Never lose a lead.',
    icon: <GlobeAltIcon className="h-6 w-6" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function Features() {
  return (
    <section className="relative bg-surface-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-brand-600 uppercase tracking-wide"
          >
            Why EnquiryHub
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-bold text-surface-900 sm:text-4xl"
          >
            Everything you need to manage enquiries
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-surface-600"
          >
            From capture to conversion, built for modern real estate teams.
          </motion.p>
        </div>

        {/* Feature cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              className="group relative rounded-2xl border border-surface-200 bg-white p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
            >
              <div className={`inline-flex rounded-xl border p-3 ${feature.color}`}>
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-surface-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-surface-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
