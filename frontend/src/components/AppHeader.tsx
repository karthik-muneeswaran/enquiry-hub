import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { UserRole } from '../auth/users';

export function AppHeader() {
  const { user, isAuthenticated, logout, hasRole } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = hasRole(UserRole.ADMIN);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Left: Navigation links */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/properties"
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              Properties
            </NavLink>
            <NavLink
              to="/enquiry/new"
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              New Enquiry
            </NavLink>
            {isAdmin && (
              <>
                <NavLink
                  to="/admin/queues"
                  className={({ isActive }) =>
                    `rounded px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  Queues
                </NavLink>
                <NavLink
                  to="/admin/gdpr"
                  className={({ isActive }) =>
                    `rounded px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  GDPR
                </NavLink>
              </>
            )}
          </nav>

          {/* Right: User info + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {user.name}{' '}
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                {user.role}
              </span>
            </span>
            <button
              onClick={logout}
              className="rounded bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
