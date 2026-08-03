import { motion } from 'framer-motion';

interface Stat {
  value: string;
  label: string;
  suffix?: string;
}

const stats: Stat[] = [
  { value: '10K', label: 'Enquiries Processed', suffix: '+' },
  { value: '99.9', label: 'Uptime Guarantee', suffix: '%' },
  { value: '< 2s', label: 'Avg Response Time', suffix: '' },
  { value: '500', label: 'Properties Managed', suffix: '+' },
];

export function PlatformStats() {
  return (
    <section className="relative bg-surface-900 py-20 sm:py-24 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-accent-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Trusted by growing real estate teams
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-surface-300"
          >
            Built for performance, designed for scale.
          </motion.p>
        </div>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <p className="text-4xl font-bold text-white sm:text-5xl">
                {stat.value}
                {stat.suffix && (
                  <span className="text-brand-400">{stat.suffix}</span>
                )}
              </p>
              <p className="mt-2 text-sm text-surface-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
