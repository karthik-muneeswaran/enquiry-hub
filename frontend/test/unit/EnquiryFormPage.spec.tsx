import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockedProvider } from '@apollo/client/testing';
import { describe, it, expect, vi } from 'vitest';
import { EnquiryFormPage } from '../../src/pages/EnquiryFormPage';
import { UIProvider } from '../../src/providers/UIProvider';
import { GET_PROPERTIES } from '../../src/graphql/queries';

// Mock useCreateEnquiry hook
const mockMutate = vi.fn();
vi.mock('../../src/hooks/useCreateEnquiry', () => ({
  useCreateEnquiry: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Mock useOnlineStatus
vi.mock('../../src/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

// Mock offlineQueue
vi.mock('../../src/services/OfflineQueue', () => ({
  offlineQueue: {
    enqueue: vi.fn(),
    flush: vi.fn(),
    getPendingCount: () => 0,
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
}));

const propertyMocks = [
  {
    request: {
      query: GET_PROPERTIES,
      variables: { first: 50 },
    },
    result: {
      data: {
        properties: {
          edges: [
            { node: { id: 'prop-1', slug: 'prop-1', title: 'Test Property', excerpt: null, featuredImage: null, price: null, bedrooms: null, location: 'Sydney' }, cursor: 'c1' },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockedProvider mocks={propertyMocks}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/?propertyId=prop-1&propertyTitle=Test+Property']}>
            <UIProvider>{children}</UIProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </MockedProvider>
    );
  };
}

function renderForm() {
  return render(<EnquiryFormPage />, { wrapper: createWrapper() });
}

describe('EnquiryFormPage', () => {
  it('renders all form fields', () => {
    renderForm();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByText(/test property/i)).toBeInTheDocument(); // pre-filled from URL
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/i consent/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit enquiry/i })).toBeInTheDocument();
  });

  it('shows validation errors for required fields on submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /submit enquiry/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/message is required/i)).toBeInTheDocument();
    });
  });

  it('calls mutate with correct payload on valid submission', async () => {
    const user = userEvent.setup();
    renderForm();

    // Property is pre-filled from URL params (propertyId=prop-1&propertyTitle=Test+Property)
    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/^email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/phone/i), '+61412345678');
    await user.type(screen.getByLabelText(/message/i), 'Interested in viewing');
    await user.click(screen.getByLabelText(/i consent/i));
    await user.click(screen.getByRole('button', { name: /submit enquiry/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          propertyId: 'prop-1',
          propertyTitle: 'Test Property',
          consentGiven: true,
        }),
        expect.anything(),
      );
    });
  });

  it('shows consent validation error when checkbox is not checked', async () => {
    const user = userEvent.setup();
    renderForm();

    // Property is pre-filled from URL params
    await user.type(screen.getByLabelText(/full name/i), 'John Doe');
    await user.type(screen.getByLabelText(/^email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/message/i), 'Hello');
    // Don't check consent
    await user.click(screen.getByRole('button', { name: /submit enquiry/i }));

    await waitFor(() => {
      expect(screen.getByText(/you must consent to proceed/i)).toBeInTheDocument();
    });
  });
});
