import { motion } from 'framer-motion';
import { BuildingOfficeIcon, PaperAirplaneIcon, BellAlertIcon } from '@heroicons/react/24/outline';
import { type ReactNode } from 'react';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Property Listed',
    description:
      'Properties are synced automatically from WordPress. Each listing gets a unique enquiry form ready to capture leads.',
    icon: <BuildingOfficeIcon className="h-7 w-7" />,
  },
  {
    number: '02',
    title: 'Enquiry Submitted',
    description:
      'Visitors submit enquiries with consent. The system validates, deduplicates, and queues each submission for processing.',
    icon: <PaperAirplaneIcon className="h-7 w-7" />,
  },
  {
    number: '03',
    title: 'Team Notified',
    description:
      'Your team gets instant notifications. Enquiries flow through the dashboard with status tracking and response time metrics.',
    icon: <BellAlertIcon className="h-7 w-7" />,
  },
];

export function HowItWorks() {
  return (
    <section className="relative bg-white py-20 sm:py-28 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-brand-50 blur-3xl opacity-40" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-sm font-semibold text-brand-600 uppercase tracking-wide"
          >
            How it works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-3 text-3xl font-bold text-surface-900 sm:text-4xl"
          >
            Three steps to better lead management
          </motion.h2>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="relative text-center"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute top-12 left-[calc(50%+40px)] hidden h-0.5 w-[calc(100%-80px)] bg-gradient-to-r from-brand-200 to-brand-100 md:block" />
              )}

              {/* Icon circle */}
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-brand-100 bg-brand-50 text-brand-600 shadow-glow">
                {step.icon}
              </div>

              {/* Step number */}
              <span className="mt-4 inline-block rounded-full bg-surface-100 px-3 py-1 text-xs font-bold text-surface-500">
                STEP {step.number}
              </span>

              {/* Content */}
              <h3 className="mt-3 text-xl font-semibold text-surface-900">{step.title}</h3>
              <p className="mt-2 text-sm text-surface-600 leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
