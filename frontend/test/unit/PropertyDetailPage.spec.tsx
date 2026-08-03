import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { describe, it, expect, vi } from 'vitest';
import { PropertyDetailPage } from '../../src/pages/PropertyDetailPage';
import { GET_PROPERTY } from '../../src/graphql/queries';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const mockProperty = {
  id: 'prop-1',
  slug: 'nice-apartment',
  title: 'Nice Apartment in Sydney',
  content: '<p>Beautiful apartment with city views</p>',
  excerpt: 'Beautiful apartment with city views',
  featuredImage: 'https://example.com/img.jpg',
  price: 650000,
  bedrooms: 3,
  bathrooms: 2,
  area: 150,
  location: 'Sydney CBD',
  propertyType: 'Apartment',
};

function createMock(property: any = mockProperty): MockedResponse[] {
  return [
    {
      request: {
        query: GET_PROPERTY,
        variables: { slug: 'nice-apartment' },
      },
      result: {
        data: { property },
      },
    },
  ];
}

function renderPage(mocks: MockedResponse[] = createMock()) {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemoryRouter initialEntries={['/properties/nice-apartment']}>
        <Routes>
          <Route path="/properties/:slug" element={<PropertyDetailPage />} />
          <Route path="/properties" element={<div>Properties List</div>} />
          <Route path="/enquiry/new" element={<div>Enquiry Form</div>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('PropertyDetailPage', () => {
  it('should show loading skeleton initially', () => {
    renderPage();

    // Title shouldn't be visible yet
    expect(screen.queryByText('Nice Apartment in Sydney')).not.toBeInTheDocument();
  });

  it('should render property title after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nice Apartment in Sydney')).toBeInTheDocument();
    });
  });

  it('should display property meta badges', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('3 Bedrooms')).toBeInTheDocument();
      expect(screen.getByText('2 Bathrooms')).toBeInTheDocument();
      expect(screen.getByText('Sydney CBD')).toBeInTheDocument();
      expect(screen.getByText('Apartment')).toBeInTheDocument();
    });
  });

  it('should render property content as HTML', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Beautiful apartment with city views')).toBeInTheDocument();
    });
  });

  it('should show Make Enquiry button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /make enquiry/i })).toBeInTheDocument();
    });
  });

  it('should show Back to Properties link', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/back to properties/i)).toBeInTheDocument();
    });
  });

  it('should show error state on query failure', async () => {
    const errorMocks: MockedResponse[] = [
      {
        request: {
          query: GET_PROPERTY,
          variables: { slug: 'nice-apartment' },
        },
        error: new Error('Network error'),
      },
    ];

    renderPage(errorMocks);

    await waitFor(() => {
      expect(screen.getByText(/property unavailable/i)).toBeInTheDocument();
    });
  });

  it('should show not found state when property is null', async () => {
    const notFoundMocks = createMock(null);

    renderPage(notFoundMocks);

    await waitFor(() => {
      expect(screen.getByText(/property not found/i)).toBeInTheDocument();
    });
  });

  it('should show featured image when available', async () => {
    renderPage();

    await waitFor(() => {
      const img = screen.getByAltText('Nice Apartment in Sydney');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
    });
  });
});
