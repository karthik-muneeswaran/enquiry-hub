import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../ui/cn';
import { useAuth } from '../../auth';
import { UserRole } from '../../auth/users';
import {
  HomeIcon,
  BuildingOfficeIcon,
  PlusCircleIcon,
  QueueListIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { type ReactNode } from 'react';

import { Permission } from '../../auth/users';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  adminOnly?: boolean;
  requiredPermission?: Permission;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <ChartBarIcon className="h-5 w-5" />, adminOnly: true },
  { label: 'Properties', to: '/properties', icon: <BuildingOfficeIcon className="h-5 w-5" /> },
  { label: 'New Enquiry', to: '/enquiry/new', icon: <PlusCircleIcon className="h-5 w-5" /> },
  { label: 'Enquiries', to: '/enquiries', icon: <HomeIcon className="h-5 w-5" />, requiredPermission: Permission.ENQUIRY_LIST },
  { label: 'Queues', to: '/admin/queues', icon: <QueueListIcon className="h-5 w-5" />, adminOnly: true },
  { label: 'GDPR', to: '/admin/gdpr', icon: <ShieldCheckIcon className="h-5 w-5" />, adminOnly: true },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, hasRole, hasPermission, logout } = useAuth();
  const location = useLocation();
  const isAdmin = hasRole(UserRole.ADMIN);

  const filteredItems = navItems.filter(
    (item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
      return true;
    },
  );

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-surface-200',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-64',
        'hidden lg:flex',
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-surface-100 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <span className="text-sm font-bold text-white">E</span>
            </div>
            <span className="text-lg font-semibold text-surface-900">Enquiry</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <span className="text-sm font-bold text-white">E</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== '/enquiries' && location.pathname.startsWith(item.to));

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900',
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <span className={cn('shrink-0', isActive && 'text-brand-600')}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-surface-100 p-3">
        {!collapsed && user && (
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <span className="text-xs font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-surface-500 truncate">{user.role}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!collapsed && (
            <button
              onClick={logout}
              className="flex-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              Logout
            </button>
          )}
          <button
            onClick={onToggle}
            className={cn(
              'rounded-xl p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors',
              collapsed && 'mx-auto',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon className="h-5 w-5" />
            ) : (
              <ChevronLeftIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
