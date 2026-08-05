# Frontend Architecture

## Overview

The Enquiry Hub Frontend is a React single-page application (SPA) that provides an admin dashboard for managing property enquiries, viewing property listings (sourced from WordPress via GraphQL), and performing administrative operations (queues, GDPR, metrics). It communicates with the backend via a dual data-fetching strategy: REST (TanStack React Query) for enquiry CRUD and GraphQL (Apollo Client) for property data.

**Tech Stack:**

- Framework: React 18
- Build Tool: Vite 5
- Language: TypeScript 5.5
- Styling: TailwindCSS 3.4
- Routing: React Router v6
- REST Data Fetching: TanStack React Query v5
- GraphQL Data Fetching: Apollo Client v3.10
- Forms: React Hook Form v7
- Charts: Recharts v2
- Animations: Framer Motion v11
- Testing: Vitest + React Testing Library
- Linting: ESLint + Prettier

---

## System Context

```
┌─────────────────────────────────────────────────────┐
│                 Frontend (React SPA)                  │
│                                                      │
│  ┌──────────────┐         ┌────────────────────┐    │
│  │ Apollo Client│──────▶  │ Backend /graphql    │    │
│  │ (Properties) │         │ (WordPress proxy)   │    │
│  └──────────────┘         └────────────────────┘    │
│                                                      │
│  ┌──────────────┐         ┌────────────────────┐    │
│  │ React Query  │──────▶  │ Backend /api/v1/*   │    │
│  │ (Enquiries)  │         │ (REST endpoints)    │    │
│  └──────────────┘         └────────────────────┘    │
│                                                      │
│  ┌──────────────┐                                    │
│  │ Offline Queue│── (localStorage) ──▶ Flush on     │
│  │              │                     reconnect      │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

---

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                    # Root component (routing + providers)
│   ├── main.tsx                   # Entry point (renders App)
│   ├── auth/                      # Authentication & authorization
│   │   ├── AuthContext.tsx        # Auth provider + useAuth hook
│   │   ├── users.ts              # Static user definitions, roles, permissions
│   │   ├── ProtectedRoute.tsx    # Route-level auth guard
│   │   ├── PermissionGate.tsx    # Component-level permission gate
│   │   └── index.ts
│   ├── providers/                 # Context providers
│   │   ├── QueryProvider.tsx     # TanStack React Query config
│   │   ├── ApolloProvider.tsx    # Apollo Client config
│   │   ├── UIProvider.tsx        # Toast notifications
│   │   └── index.ts
│   ├── hooks/                     # Custom hooks
│   │   ├── useOnlineStatus.ts   # Browser connectivity detection
│   │   ├── useApiData.ts        # Generic data-fetching with AbortController
│   │   ├── useCreateEnquiry.ts  # Enquiry creation mutation
│   │   ├── useEnquiries.ts      # Enquiry list query with auto-refresh
│   │   ├── useUpdateEnquiryStatus.ts # Status update mutation
│   │   ├── usePersistedForm.ts  # localStorage form draft persistence
│   │   └── index.ts
│   ├── services/                  # External service integrations
│   │   ├── api/
│   │   │   ├── client.ts        # Axios client (retry, auth, idempotency)
│   │   │   ├── enquiry.api.ts   # Enquiry API functions
│   │   │   └── types.ts         # Shared API types
│   │   └── OfflineQueue.ts      # Offline submission queue
│   ├── graphql/                   # GraphQL queries & types
│   │   └── queries.ts           # Property queries (cursor-based)
│   ├── pages/                     # Page-level components
│   │   ├── LoginPage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── AdminDashboardPage.tsx    # Enquiry list (admin)
│   │   ├── EnquiryFormPage.tsx       # New enquiry form
│   │   ├── EnquiryDetailPage.tsx     # Single enquiry view
│   │   ├── PropertyListPage.tsx      # Property listings (GraphQL)
│   │   ├── PropertyDetailPage.tsx    # Single property view
│   │   ├── MetricsDashboardPage.tsx  # System metrics
│   │   ├── QueueDashboardPage.tsx    # Queue management
│   │   ├── GdprToolsPage.tsx        # GDPR data export/erase
│   │   ├── UnauthorizedPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── components/                # Shared components
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     # Sidebar + main content + mobile nav
│   │   │   ├── Sidebar.tsx       # Desktop collapsible sidebar
│   │   │   └── MobileNav.tsx     # Bottom navigation (mobile)
│   │   ├── ui/                   # Design system primitives
│   │   │   └── cn.ts            # Tailwind class merge utility
│   │   ├── landing/              # Landing page sections
│   │   ├── ErrorBoundary.tsx    # Per-section error isolation
│   │   ├── OfflineBanner.tsx    # Offline status + queue indicator
│   │   ├── SkeletonLoader.tsx   # Loading placeholders
│   │   └── AppHeader.tsx
│   └── index.css                  # TailwindCSS imports
├── test/
│   ├── setup.ts                  # Vitest global setup
│   └── unit/                     # Component & hook unit tests
├── index.html                    # Vite entry HTML
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
├── tsconfig.json
├── Dockerfile                    # Multi-stage (dev + production/nginx)
└── package.json
```

---

## Provider Architecture

The application wraps the component tree with a layered provider hierarchy:

```
QueryProvider (TanStack React Query)
  └── ApolloProvider (Apollo Client)
        └── UIProvider (Toast notifications)
              └── BrowserRouter (React Router)
                    └── AuthProvider (Authentication context)
                          └── Suspense (Code-split loading)
                                └── Routes (Page components)
```

### QueryProvider (TanStack React Query)

Manages REST API data fetching with sensible defaults:

```typescript
{
  queries: {
    staleTime: 30_000,          // 30s before data is considered stale
    gcTime: 300_000,            // 5min garbage collection window
    retry: 2,                   // Retry failed requests twice
    refetchOnWindowFocus: false  // No refetch on tab focus
  }
}
```

### ApolloProvider (GraphQL)

Manages property data from WordPress via GraphQL:

- `cache-and-network` fetch policy (show cached, fetch fresh in background)
- `InMemoryCache` with custom type policies for merge-based pagination
- Configurable endpoint via `VITE_GRAPHQL_URL` env variable

### UIProvider (Toast System)

Global notification system with:
- Four toast types: `success`, `error`, `warning`, `info`
- Auto-dismiss after 5 seconds (configurable per toast)
- `aria-live="polite"` for accessibility
- Manual dismiss via close button

---

## Routing & Navigation

### Route Structure

| Path | Page | Permission Required |
|------|------|---------------------|
| `/` | Landing (public) or Dashboard redirect | None (public) |
| `/login` | Login page | None |
| `/unauthorized` | Access denied page | None |
| `/enquiries` | Enquiry list (admin dashboard) | `ENQUIRY_LIST` |
| `/enquiry/new` | New enquiry form | `ENQUIRY_READ` |
| `/enquiry/:id` | Enquiry detail | `ENQUIRY_READ` |
| `/properties` | Property listing (GraphQL) | `PROPERTY_VIEW` |
| `/properties/:slug` | Property detail | `PROPERTY_VIEW` |
| `/dashboard` | Metrics dashboard | `ADMIN_DASHBOARD` |
| `/admin/queues` | Queue management | `QUEUE_MANAGE` |
| `/admin/gdpr` | GDPR tools | `GDPR_EXPORT` |
| `*` | 404 Not Found | None |

### Protected Route Pattern

```typescript
// Route-level protection (redirect to login/unauthorized)
<ProtectedRoute permission={Permission.ENQUIRY_LIST}>
  <AppLayout>
    <AdminDashboardPage />
  </AppLayout>
</ProtectedRoute>
```

### Smart Root Redirect

The root `/` route performs role-based redirection:
1. **Admin** → `/dashboard` (metrics)
2. **Agent** (has ENQUIRY_LIST) → `/enquiries`
3. **Viewer** → `/properties`
4. **Unauthenticated** → Landing page

---

## Authentication & Authorization

### Authentication Model

The frontend uses a **static user authentication** system with localStorage persistence:

- Users defined in `auth/users.ts` with email/password credentials
- Login validates against static user list (no backend auth endpoint)
- Authenticated user stored in `localStorage` with key `auth_user`
- On reload, stored user is validated against the static user list for integrity

### Role-Based Access Control (RBAC)

**Roles:**

| Role | Description |
|------|-------------|
| `ADMIN` | Full system access (all permissions) |
| `AGENT` | Enquiry management + property viewing |
| `VIEWER` | Read-only access to enquiries and properties |

**Permissions (11 total):**

| Permission | Admin | Agent | Viewer |
|------------|-------|-------|--------|
| `ENQUIRY_CREATE` | Yes | Yes | No |
| `ENQUIRY_READ` | Yes | Yes | Yes |
| `ENQUIRY_LIST` | Yes | Yes | No |
| `ENQUIRY_UPDATE_STATUS` | Yes | Yes | No |
| `WEBHOOK_VIEW` | Yes | Yes | No |
| `PROPERTY_VIEW` | Yes | Yes | Yes |
| `GDPR_EXPORT` | Yes | No | No |
| `GDPR_ERASE` | Yes | No | No |
| `QUEUE_MANAGE` | Yes | No | No |
| `AUDIT_VIEW` | Yes | No | No |
| `ADMIN_DASHBOARD` | Yes | No | No |

### Authorization Components

1. **`ProtectedRoute`** — Route-level guard; redirects to `/login` or `/unauthorized`
2. **`PermissionGate`** — Component-level conditional rendering with optional fallback

```typescript
// Hide a button unless user has permission
<PermissionGate permission={Permission.ENQUIRY_UPDATE_STATUS}>
  <StatusUpdateButton />
</PermissionGate>
```

---

## Data Fetching Strategy

### Dual-Client Architecture

The frontend uses two separate data-fetching clients based on the data source:

| Data Source | Client | Use Case |
|-------------|--------|----------|
| Backend REST API (`/api/v1/*`) | TanStack React Query + Axios | Enquiries, admin operations |
| Backend GraphQL (`/graphql`) | Apollo Client | Property listings from WordPress |

### REST Client (`services/api/client.ts`)

Centralized Axios client with production-grade features:

**Request Interceptors:**
- Auto-injects `Authorization: Bearer <token>` from localStorage
- Auto-generates `Idempotency-Key` UUID for all POST requests

**Response Interceptors:**
- Unwraps the backend's `{ success, data, request_id, timestamp }` envelope
- Consumers receive the inner `data` payload directly
- 401 responses trigger automatic logout and redirect to `/login`

**Retry with Exponential Backoff:**
```
Attempt 0: Immediate
Attempt 1: Wait 1 second  (4^0)
Attempt 2: Wait 4 seconds (4^1)
Attempt 3: Wait 16 seconds (4^2) — final attempt
```

Retry conditions:
- Network errors (no response received)
- 5xx server errors
- Does NOT retry 4xx client errors

**Error Normalization:**
All API errors are normalized to a consistent `NormalizedApiError` shape:
```typescript
{
  code: string;       // e.g., "VALIDATION_ERROR", "NETWORK_ERROR"
  message: string;    // Human-readable message
  details?: FieldError[];  // Per-field validation errors
  requestId: string;  // Backend-assigned request ID
}
```

### React Query Hooks

| Hook | Purpose | Config |
|------|---------|--------|
| `useEnquiries(params)` | Paginated enquiry list | 30s auto-refresh |
| `useCreateEnquiry()` | Create mutation + cache invalidation | Invalidates `['enquiries']` |
| `useUpdateEnquiryStatus()` | Status mutation + optimistic UI | Invalidates affected queries |
| `useApiData(fetcher, deps)` | Generic fetch with AbortController | Cancels on unmount |

### Apollo Client (GraphQL)

Used exclusively for property data (proxied from WordPress):

```graphql
query Properties($first: Int, $after: String, $search: String) {
  properties(first: $first, after: $after, search: $search) {
    edges { node { id, slug, title, ... } cursor }
    pageInfo { hasNextPage, endCursor }
  }
}
```

- Cursor-based pagination (Relay-style)
- Cache merge policy for infinite scroll behavior
- `cache-and-network` for instant UI + background freshness

---

## Offline Support

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Offline Support Flow                    │
│                                                          │
│  User submits enquiry while offline                       │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────┐                                     │
│  │  OfflineQueue    │ ── enqueue() ──▶ localStorage      │
│  └─────────────────┘                                     │
│                                                          │
│  Browser goes online (event)                             │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────┐                                     │
│  │  OfflineBanner   │ ── auto-flush ──▶ API calls        │
│  │  (auto-detects)  │                                    │
│  └─────────────────┘                                     │
│         │                                                │
│         ▼                                                │
│  ✓ Success: Remove from queue, show toast                │
│  ✗ Failure: Keep in queue for next attempt               │
└─────────────────────────────────────────────────────────┘
```

### Components

**`OfflineQueue` (service/singleton):**
- localStorage-backed submission queue
- Serializes submissions as `{ id, endpoint, data, timestamp }`
- `enqueue()` — adds submission to queue
- `flush()` — attempts all queued submissions, keeps failed ones
- `getPendingCount()` — current queue depth
- `clear()` — manual queue reset

**`useOnlineStatus` (hook):**
- Tracks `navigator.onLine` state
- Listens to `window` `online`/`offline` events
- Returns boolean indicating connectivity

**`OfflineBanner` (component):**
- Displays yellow warning when offline with pending count
- Auto-flushes queue when connectivity restores
- Shows green success banner after flush
- Uses `aria-live="assertive"` for screen reader announcement

---

## Form Management

### React Hook Form Integration

Forms use `react-hook-form` for performance and validation:
- Uncontrolled components (no re-renders on each keystroke)
- Schema-based validation
- Field-level error display

### Form Draft Persistence (`usePersistedForm`)

Prevents data loss on accidental navigation or browser crash:

```typescript
const { savedValues, hasSavedData, saveValues, clearSaved } = usePersistedForm('enquiry-form', defaultValues);
```

- **Debounced saves** — Writes to localStorage every 500ms (not on every keystroke)
- **Auto-restore** — On mount, checks for saved draft
- **Clear on submit** — Removes draft after successful submission
- **Storage key format** — `form_draft:{key}` (namespaced)
- **Graceful failure** — Silently ignores localStorage quota errors

---

## Error Handling

### Three-Layer Strategy

1. **Error Boundary (Component Crashes)**
   - Class component wrapping page sections
   - Catches render-time JavaScript errors
   - Displays retry button without crashing entire app
   - Optional `onError` callback for telemetry integration
   - Custom fallback UI support

2. **API Error Normalization (Network/Server Errors)**
   - All API errors normalized to `NormalizedApiError` shape
   - Field-level validation errors surfaced to form fields
   - Error codes mapped from backend's structured responses
   - Network errors distinguished from server errors

3. **React Query Error States (Data Loading)**
   - Per-query `error` state available in every hook
   - Global error handling via query client configuration
   - Automatic retry (2 attempts) before surfacing error

### Error Flow

```
Component renders
      │
      ├── Render error ─────▶ ErrorBoundary catches ─▶ Retry UI
      │
      └── Data fetch
            │
            ├── Network error ──▶ Retry (3x backoff) ──▶ NormalizedApiError
            ├── 4xx error ──────▶ NormalizedApiError (no retry)
            ├── 5xx error ──────▶ Retry (3x backoff) ──▶ NormalizedApiError
            └── 401 ────────────▶ Auto-logout + redirect to /login
```

---

## UI Architecture

### Layout System

```
┌─────────────────────────────────────────────────┐
│ OfflineBanner (conditional)                      │
├─────────────────────────────────────────────────┤
│ ┌───────┐                                       │
│ │Sidebar│  Main Content Area                    │
│ │(desktop│  (max-w-7xl, responsive padding)     │
│ │collapse│                                       │
│ │ible)  │                                       │
│ │       │                                       │
│ └───────┘                                       │
├─────────────────────────────────────────────────┤
│ MobileNav (bottom nav, mobile only)              │
└─────────────────────────────────────────────────┘
```

**Responsive Design:**
- Desktop: Collapsible sidebar (72px collapsed, 256px expanded) + main content
- Mobile: Bottom navigation bar + full-width content
- Smooth transitions (300ms) on sidebar toggle
- `max-w-7xl` content container with responsive padding

### Design System

- **TailwindCSS** for utility-first styling
- **Custom theme tokens**: `brand-*`, `surface-*` color scales
- **`cn()` utility** — Tailwind class merging (via `tailwind-merge` + `clsx`)
- **Skeleton loaders** for loading states
- **Framer Motion** for page transitions and micro-interactions
- **Heroicons** for consistent iconography

### Accessibility

- `aria-live` regions for dynamic content (toasts, offline banner)
- `role="alert"` for error states and important notifications
- Keyboard navigation support
- Focus management on route transitions
- Semantic HTML structure
- Color contrast compliance via Tailwind defaults

---

## State Management

The application uses a **distributed state** approach (no global store like Redux):

| State Type | Solution | Scope |
|------------|----------|-------|
| Server state (REST) | TanStack React Query | Global cache |
| Server state (GraphQL) | Apollo Client cache | Global cache |
| Auth state | React Context (`AuthProvider`) | Global |
| UI state (toasts) | React Context (`UIProvider`) | Global |
| Form state | React Hook Form + `usePersistedForm` | Component-local |
| Offline queue | localStorage + singleton service | Global (persistent) |
| Online status | `useOnlineStatus` hook | Component-local |

### Why No Redux/Zustand?

- Server state is the dominant state type — React Query and Apollo handle it with caching, invalidation, and background refetch
- Auth is simple (single user object) — Context is sufficient
- UI state is minimal (toast array) — Context is sufficient
- No complex client-side state transformations needed

---

## API Integration Patterns

### Idempotency

Every POST request automatically gets an `Idempotency-Key` header (UUID):
- Generated by the Axios request interceptor
- Backend returns the same response for duplicate keys (24h window)
- Prevents double-submission from network retries or user double-clicks

### Cursor-Based Pagination

Both REST and GraphQL use cursor-based pagination:

**REST (Enquiries):**
```typescript
{ cursor?: string, limit?: number, sortBy?, sortDir? }
→ { data: [...], pagination: { nextCursor, previousCursor, hasMore, totalCount } }
```

**GraphQL (Properties):**
```graphql
properties(first: 20, after: "cursor") →
  edges { node {...}, cursor }
  pageInfo { hasNextPage, endCursor }
```

### Auto-Refresh

The enquiry list auto-refreshes every 30 seconds via React Query's `refetchInterval`:
```typescript
useQuery({
  queryKey: ['enquiries', params],
  queryFn: () => enquiryApi.list(params),
  refetchInterval: 30_000,
});
```

---

## Build & Deployment

### Development

```bash
npm run dev    # Vite dev server (port 5173, HMR)
npm run lint   # ESLint check
npm run format # Prettier formatting
npm test       # Vitest run (single pass)
```

### Production Build

```bash
npm run build  # tsc type-check → vite build
```

- TypeScript compilation for type safety
- Vite bundling with tree-shaking and code splitting
- Output: static files served by NGINX container

### Docker (Multi-Stage)

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
RUN npm ci && npm run build

# Stage 2: Serve
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_API_BASE_URL` | REST API base URL | `/api/v1` |
| `VITE_GRAPHQL_URL` | GraphQL endpoint | `http://localhost:3000/graphql` |
| `VITE_ADMIN_API_KEY` | Admin API key (optional) | — |

---

## Testing Strategy

### Framework: Vitest + React Testing Library

```
test/
├── setup.ts              # Global test setup (cleanup, mocks)
└── unit/                 # Component + hook unit tests
    ├── AuthContext.spec.tsx
    ├── ProtectedRoute.spec.tsx
    ├── PermissionGate.spec.tsx
    ├── LoginPage.spec.tsx
    ├── AdminDashboardPage.spec.tsx
    ├── EnquiryFormPage.spec.tsx
    ├── PropertyListPage.spec.tsx
    ├── PropertyDetailPage.spec.tsx
    ├── ErrorBoundary.spec.tsx
    ├── useCreateEnquiry.spec.tsx
    ├── useEnquiries.spec.tsx
    ├── usePersistedForm.spec.ts
    ├── useApiData.spec.ts
    └── OfflineQueue.spec.ts
```

### Testing Approach

| Category | What's Tested | Tools |
|----------|--------------|-------|
| Component rendering | Correct output for props/state | Testing Library |
| User interactions | Click, type, submit flows | `@testing-library/user-event` |
| Hook behavior | State transitions, side effects | `renderHook` from Testing Library |
| API integration | Mock API responses, error handling | Vitest mocks |
| Auth flows | Login, logout, permission checks | Context mocking |
| Offline behavior | Queue enqueue, flush, persistence | localStorage mocks |

### Test Setup

```typescript
// Global cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// Mocked globals
window.matchMedia    // Media query mock
crypto.randomUUID   // Deterministic UUID for snapshots
```

---

## Performance Patterns

| Pattern | Implementation |
|---------|---------------|
| Code splitting | `React.lazy` + `Suspense` for route-based splitting |
| Cache-first rendering | Apollo `cache-and-network` + React Query `staleTime` |
| Debounced persistence | 500ms debounce on form saves |
| Request deduplication | React Query deduplicates identical query keys |
| Abort on unmount | `AbortController` in `useApiData` cancels in-flight requests |
| Optimistic updates | Mutation hooks invalidate relevant queries on success |
| Skeleton loading | Placeholder UI during data fetch |
| Background refresh | 30s auto-refetch for enquiry list |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dual fetching (React Query + Apollo) | Properties are GraphQL (WordPress origin), enquiries are REST — use the natural client for each |
| No global state management library | Server state dominates; React Query/Apollo handle caching; minimal client state fits Context |
| Static user auth (no JWT) | Development/demo simplicity; production would swap to real auth |
| localStorage offline queue | Progressive enhancement for mobile users on spotty connections |
| Auto-generated idempotency keys | Prevents duplicate submissions without user awareness |
| Debounced form persistence | Balances data safety vs localStorage write frequency |
| ErrorBoundary per section | Isolates failures to page sections, not full-app crash |
| `cache-and-network` for GraphQL | Instant cached UI + background freshness for property data |
| Cursor pagination (not offset) | Consistent with backend; stable under concurrent writes |
| TailwindCSS (not CSS-in-JS) | Consistent with utility-first approach; tree-shakeable; fast build |
| Vitest (not Jest) | Native Vite integration, faster execution, ESM support |
| Responsive sidebar + mobile nav | Desktop power users get sidebar; mobile users get bottom nav |
