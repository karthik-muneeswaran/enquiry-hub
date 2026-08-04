import { lazy } from 'react';

// Eagerly loaded pages (public routes)
export { LoginPage } from './LoginPage';
export { LandingPage } from './LandingPage';
export { UnauthorizedPage } from './UnauthorizedPage';

// Lazy loaded pages (protected routes)
export const AdminDashboardPage = lazy(() =>
  import('./AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);

export const EnquiryFormPage = lazy(() =>
  import('./EnquiryFormPage').then((m) => ({ default: m.EnquiryFormPage })),
);

export const PropertyListPage = lazy(() =>
  import('./PropertyListPage').then((m) => ({ default: m.PropertyListPage })),
);

export const PropertyDetailPage = lazy(() =>
  import('./PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })),
);

export const QueueDashboardPage = lazy(() =>
  import('./QueueDashboardPage').then((m) => ({ default: m.QueueDashboardPage })),
);

export const GdprToolsPage = lazy(() =>
  import('./GdprToolsPage').then((m) => ({ default: m.GdprToolsPage })),
);

export const EnquiryDetailPage = lazy(() =>
  import('./EnquiryDetailPage').then((m) => ({ default: m.EnquiryDetailPage })),
);

export const MetricsDashboardPage = lazy(() =>
  import('./MetricsDashboardPage').then((m) => ({ default: m.MetricsDashboardPage })),
);
