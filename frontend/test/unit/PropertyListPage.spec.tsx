import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { describe, it, expect, vi } from 'vitest';
import { PropertyListPage } from '../../src/pages/PropertyListPage';
import { GET_PROPERTIES } from '../../src/graphql/queries';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockProperties = [
  {
    node: {
      id: 'prop-1',
      slug: 'nice-apartment',
      title: 'Nice Apartment',
      excerpt: 'A lovely place to live',
      featuredImage: 'https://example.com/img1.jpg',
      price: 450000,
      bedrooms: 3,
      location: 'Sydney',
    },
    cursor: 'cursor-1',
  },
  {
    node: {
      id: 'prop-2',
      slug: 'beach-house',
      title: 'Beach House',
      excerpt: 'Right on the sand',
      featuredImage: null,
      price: 800000,
      bedrooms: 4,
      location: 'Gold Coast',
    },
    cursor: 'cursor-2',
  },
];

function createMock(overrides: Partial<MockedResponse> = {}): MockedResponse[] {
  return [
    {
      request: {
        query: GET_PROPERTIES,
        variables: { first: 12, search: undefined },
      },
      result: {
        data: {
          properties: {
            edges: mockProperties,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
      ...overrides,
    },
  ];
}

function renderPage(mocks: MockedResponse[] = createMock()) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemoryRouter>
        <PropertyListPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PropertyListPage', () => {
  it('should show loading skeletons initially', () => {
    renderPage();

    // Skeletons render as animated pulse divs - check that no property titles are shown yet
    expect(screen.queryByText('Nice Apartment')).not.toBeInTheDocument();
  });

  it('should render property cards after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nice Apartment')).toBeInTheDocument();
    });

    expect(screen.getByText('Beach House')).toBeInTheDocument();
  });

  it('should display listing count', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('2 listings')).toBeInTheDocument();
    });
  });

  it('should display property bedrooms and location badges', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('3 beds')).toBeInTheDocument();
      expect(screen.getByText('Sydney')).toBeInTheDocument();
    });
  });

  it('should show error state on query failure', async () => {
    const errorMocks: MockedResponse[] = [
      {
        request: {
          query: GET_PROPERTIES,
          variables: { first: 12, search: undefined },
        },
        error: new Error('Network error'),
      },
    ];

    renderPage(errorMocks);

    await waitFor(() => {
      expect(screen.getByText(/properties temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it('should show empty state when no properties match search', async () => {
    const emptyMocks: MockedResponse[] = [
      {
        request: {
          query: GET_PROPERTIES,
          variables: { first: 12, search: undefined },
        },
        result: {
          data: {
            properties: {
              edges: [],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      },
    ];

    renderPage(emptyMocks);

    await waitFor(() => {
      expect(screen.getByText('No properties found')).toBeInTheDocument();
    });
  });

  it('should have a search input with accessible label', async () => {
    renderPage();

    const searchInput = screen.getByLabelText(/search properties/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('should show Load More button when hasNextPage is true', async () => {
    const morePagesMocks: MockedResponse[] = [
      {
        request: {
          query: GET_PROPERTIES,
          variables: { first: 12, search: undefined },
        },
        result: {
          data: {
            properties: {
              edges: mockProperties,
              pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
            },
          },
        },
      },
    ];

    renderPage(morePagesMocks);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });
  });
});
