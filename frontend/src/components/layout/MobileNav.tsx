import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../ui/cn';
import { useAuth } from '../../auth';
import { UserRole } from '../../auth/users';
import {
  HomeIcon,
  BuildingOfficeIcon,
  PlusCircleIcon,
  ChartBarIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOfficeIcon as BuildingOfficeIconSolid,
  PlusCircleIcon as PlusCircleIconSolid,
  ChartBarIcon as ChartBarIconSolid,
} from '@heroicons/react/24/solid';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QueueListIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface MobileNavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  adminOnly?: boolean;
}

const mainNavItems: MobileNavItem[] = [
  {
    label: 'Home',
    to: '/enquiries',
    icon: <HomeIcon className="h-6 w-6" />,
    activeIcon: <HomeIconSolid className="h-6 w-6" />,
  },
  {
    label: 'Properties',
    to: '/properties',
    icon: <BuildingOfficeIcon className="h-6 w-6" />,
    activeIcon: <BuildingOfficeIconSolid className="h-6 w-6" />,
  },
  {
    label: 'Enquiry',
    to: '/enquiry/new',
    icon: <PlusCircleIcon className="h-6 w-6" />,
    activeIcon: <PlusCircleIconSolid className="h-6 w-6" />,
  },
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: <ChartBarIcon className="h-6 w-6" />,
    activeIcon: <ChartBarIconSolid className="h-6 w-6" />,
    adminOnly: true,
  },
];

export function MobileNav() {
  const { hasRole, logout } = useAuth();
  const location = useLocation();
  const isAdmin = hasRole(UserRole.ADMIN);
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleItems = mainNavItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-[72px] z-40 mx-4 mb-2 rounded-2xl border border-surface-200 bg-white p-4 shadow-elevated"
          >
            <div className="space-y-1">
              {isAdmin && (
                <>
                  <NavLink
                    to="/admin/queues"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-surface-700 hover:bg-surface-50"
                  >
                    <QueueListIcon className="h-5 w-5 text-surface-500" />
                    Queue Management
                  </NavLink>
                  <NavLink
                    to="/admin/gdpr"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-surface-700 hover:bg-surface-50"
                  >
                    <ShieldCheckIcon className="h-5 w-5 text-surface-500" />
                    GDPR Tools
                  </NavLink>
                </>
              )}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setMoreOpen(false)} />
      )}

      {/* Bottom nav bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-200 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-[72px] max-w-lg items-center justify-around px-4">
          {visibleItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== '/enquiries' && location.pathname.startsWith(item.to));

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-1 px-3 py-1"
              >
                <span
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-brand-600' : 'text-surface-400',
                  )}
                >
                  {isActive ? item.activeIcon : item.icon}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    isActive ? 'text-brand-600' : 'text-surface-500',
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center gap-1 px-3 py-1"
          >
            <span
              className={cn('transition-colors', moreOpen ? 'text-brand-600' : 'text-surface-400')}
            >
              <EllipsisHorizontalIcon className="h-6 w-6" />
            </span>
            <span
              className={cn(
                'text-[10px] font-medium',
                moreOpen ? 'text-brand-600' : 'text-surface-500',
              )}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
