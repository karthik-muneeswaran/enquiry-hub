import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

export function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-100/50 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-sm">
            <span className="text-base font-bold text-white">E</span>
          </div>
          <span className="text-xl font-semibold text-surface-900">
            Enquiry<span className="text-brand-600">Hub</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="md">
              Sign In
            </Button>
          </Link>
          <Link to="/login" className="hidden sm:block">
            <Button variant="primary" size="md">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
