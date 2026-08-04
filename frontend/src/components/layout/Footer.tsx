import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-surface-200 bg-surface-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
                <span className="text-base font-bold text-white">E</span>
              </div>
              <span className="text-xl font-semibold text-surface-900">
                Enquiry<span className="text-brand-600">Hub</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-surface-500 leading-relaxed">
              A modern property enquiry management platform. Streamline communications, track leads,
              and grow your real estate business.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Platform</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/properties"
                  className="text-sm text-surface-500 hover:text-brand-600 transition-colors"
                >
                  Properties
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-surface-500 hover:text-brand-600 transition-colors"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Legal</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-sm text-surface-500">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-surface-500">Terms of Service</span>
              </li>
              <li>
                <span className="text-sm text-surface-500">GDPR Compliance</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-surface-200 pt-6 text-center">
          <p className="text-sm text-surface-400">
            &copy; {new Date().getFullYear()} EnquiryHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
