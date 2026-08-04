import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { ArrowRightIcon } from '@heroicons/react/20/solid';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-accent-100/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-brand-50/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse-slow" />
              Modern Property Enquiry Platform
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-8 text-4xl font-bold tracking-tight text-surface-900 sm:text-5xl md:text-display-xl lg:text-display-2xl"
          >
            Streamline Your{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              Property Enquiries
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-surface-600 leading-relaxed sm:text-xl"
          >
            Capture, manage, and convert property enquiries with a platform built for real estate
            teams. Real-time processing, smart queues, and GDPR compliance out of the box.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link to="/login">
              <Button size="xl" iconRight={<ArrowRightIcon className="h-5 w-5" />}>
                Get Started Free
              </Button>
            </Link>
            <Link to="/properties">
              <Button variant="secondary" size="xl">
                Browse Properties
              </Button>
            </Link>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative mt-16 sm:mt-20"
          >
            <div className="relative mx-auto max-w-5xl">
              {/* Browser frame */}
              <div className="rounded-2xl border border-surface-200 bg-white shadow-elevated overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-2 border-b border-surface-100 bg-surface-50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="rounded-lg bg-white border border-surface-200 px-4 py-1 text-xs text-surface-400">
                      enquiryhub.io/dashboard
                    </div>
                  </div>
                </div>
                {/* Dashboard preview */}
                <div className="bg-surface-50 p-6 sm:p-8">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-white p-4 shadow-card border border-surface-100">
                      <p className="text-xs text-surface-500">Total Enquiries</p>
                      <p className="mt-1 text-2xl font-bold text-surface-900">2,847</p>
                      <p className="mt-1 text-xs text-green-600">+12% this week</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 shadow-card border border-surface-100">
                      <p className="text-xs text-surface-500">Active Properties</p>
                      <p className="mt-1 text-2xl font-bold text-surface-900">156</p>
                      <p className="mt-1 text-xs text-green-600">+3 new today</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 shadow-card border border-surface-100">
                      <p className="text-xs text-surface-500">Avg Response</p>
                      <p className="mt-1 text-2xl font-bold text-surface-900">2.4h</p>
                      <p className="mt-1 text-xs text-green-600">-18% improvement</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-white p-4 shadow-card border border-surface-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-surface-900">Recent Enquiries</p>
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {[
                        { name: 'Sarah M.', property: '3BR Apartment, Sydney', time: '2m ago' },
                        {
                          name: 'James L.',
                          property: 'Waterfront Villa, Gold Coast',
                          time: '15m ago',
                        },
                        { name: 'Emma W.', property: 'Studio, Melbourne CBD', time: '1h ago' },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-medium text-surface-800">{item.name}</p>
                            <p className="text-[10px] text-surface-500">{item.property}</p>
                          </div>
                          <span className="text-[10px] text-surface-400">{item.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow effect behind */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-brand-200/20 via-brand-100/10 to-accent-200/20 blur-2xl" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
