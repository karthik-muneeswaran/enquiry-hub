import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { ArrowRightIcon } from '@heroicons/react/20/solid';

export function CTAFooter() {
  return (
    <section className="relative bg-white py-20 sm:py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-brand-50/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-surface-900 sm:text-4xl lg:text-5xl">
            Ready to streamline your{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              enquiry workflow
            </span>
            ?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-surface-600 leading-relaxed">
            Start managing property enquiries today. Set up takes minutes,
            not hours. No credit card required.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link to="/login">
              <Button size="xl" iconRight={<ArrowRightIcon className="h-5 w-5" />}>
                Start Now
              </Button>
            </Link>
            <Link to="/properties">
              <Button variant="outline" size="xl">
                View Properties
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-sm text-surface-400">
            Free to use &middot; No setup fees &middot; GDPR compliant
          </p>
        </motion.div>
      </div>
    </section>
  );
}
