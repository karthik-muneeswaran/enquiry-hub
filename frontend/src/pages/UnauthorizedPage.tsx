import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
          <ShieldExclamationIcon className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-surface-900">Access Denied</h1>
        <p className="mt-2 text-sm text-surface-500 max-w-sm mx-auto">
          You don&apos;t have permission to access this page. Contact your administrator for access.
        </p>
        <Link to="/" className="inline-block mt-6">
          <Button variant="secondary">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
