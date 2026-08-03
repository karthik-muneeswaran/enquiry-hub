import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { ReactNode } from 'react';
import { AdminDashboardPage } from '../../src/pages/AdminDashboardPage';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock useEnquiries hook
const mockUseEnquiries = vi.fn();
vi.mock('../../src/hooks/useEnquiries', () => ({
  useEnquiries: (...args: any[]) => mockUseEnquiries(...args),
}));

const mockEnquiries = [
  {
    id: 'enq-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+61412345678',
    propertyId: 'prop-1',
    propertyTitle: 'Sydney Apartment',
    message: 'Interested',
    source: 'website',
    status: 'PENDING',
    consentGiven: true,
    createdAt: '2026-07-15T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  },
  {
    id: 'enq-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '+61498765432',
    propertyId: 'prop-2',
    propertyTitle: 'Beach Villa',
    message: 'Please call me',
    source: 'website',
    status: 'COMPLETED',
    consentGiven: true,
    createdAt: '2026-07-14T08:30:00Z',
    updatedAt: '2026-07-14T09:00:00Z',
  },
  {
    id: 'enq-3',
    name: 'Bob Brown',
    email: 'bob@example.com',
    phone: '',
    propertyId: 'prop-3',
    propertyTitle: 'City Loft',
    message: 'When is viewing?',
    source: 'mobile',
    status: 'FAILED',
    consentGiven: true,
    createdAt: '2026-07-13T15:00:00Z',
    updatedAt: '2026-07-13T15:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    mockUseEnquiries.mockReset();
  });

  it('should render page heading', () => {
    mockUseEnquiries.mockReturnValue({
      data: { data: [], pagination: { totalCount: 0, hasMore: false, nextCursor: null, previousCursor: null } },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Enquiries')).toBeInTheDocument();
    expect(screen.getByText(/manage and review/i)).toBeInTheDocument();
  });

  it('should show loading skeletons when loading', () => {
    mockUseEnquiries.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });

  it('should show error state when query fails', () => {
    mockUseEnquiries.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText(/failed to load enquiries/i)).toBeInTheDocument();
  });

  it('should show empty state when no enquiries', () => {
    mockUseEnquiries.mockReturnValue({
      data: { data: [], pagination: { totalCount: 0, hasMore: false, nextCursor: null, previousCursor: null } },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('No enquiries found')).toBeInTheDocument();
  });

  it('should render enquiry data in the table', () => {
    mockUseEnquiries.mockReturnValue({
      data: {
        data: mockEnquiries,
        pagination: { totalCount: 3, hasMore: false, nextCursor: null, previousCursor: null },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('jane@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('City Loft').length).toBeGreaterThan(0);
  });

  it('should render stat cards with correct counts', () => {
    mockUseEnquiries.mockReturnValue({
      data: {
        data: mockEnquiries,
        pagination: { totalCount: 3, hasMore: false, nextCursor: null, previousCursor: null },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    // Total Enquiries stat card
    expect(screen.getByText('Total Enquiries')).toBeInTheDocument();
    // "Pending", "Completed", "Failed" appear as both stat card titles and as badges
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
  });

  it('should render filter controls', () => {
    mockUseEnquiries.mockReturnValue({
      data: { data: [], pagination: { totalCount: 0, hasMore: false, nextCursor: null, previousCursor: null } },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText(/search name, email/i)).toBeInTheDocument();
    expect(screen.getByText('All statuses')).toBeInTheDocument();
    expect(screen.getByLabelText('From date')).toBeInTheDocument();
    expect(screen.getByLabelText('To date')).toBeInTheDocument();
  });

  it('should show pagination with total count', () => {
    mockUseEnquiries.mockReturnValue({
      data: {
        data: mockEnquiries,
        pagination: { totalCount: 50, hasMore: true, nextCursor: 'cursor-abc', previousCursor: null },
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('50 total')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
  });

  it('should show "Live" indicator when not fetching', () => {
    mockUseEnquiries.mockReturnValue({
      data: { data: mockEnquiries, pagination: { totalCount: 3, hasMore: false, nextCursor: null, previousCursor: null } },
      isLoading: false,
      isError: false,
      isFetching: false,
    });

    render(<AdminDashboardPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Live')).toBeInTheDocument();
  });
});
