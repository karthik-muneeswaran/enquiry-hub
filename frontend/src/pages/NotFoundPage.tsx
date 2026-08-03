import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { HomeIcon } from '@heroicons/react/24/outline';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-bold text-surface-900">Page not found</h1>
        <p className="mt-2 text-sm text-surface-500 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="inline-block mt-6">
          <Button variant="secondary" icon={<HomeIcon className="h-4 w-4" />}>
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
