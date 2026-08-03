import { gql } from '@apollo/client';

export const GET_PROPERTIES = gql`
  query Properties($first: Int, $after: String, $search: String) {
    properties(first: $first, after: $after, search: $search) {
      edges {
        node {
          id
          slug
          title
          excerpt
          featuredImage
          price
          bedrooms
          location
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const GET_PROPERTY = gql`
  query Property($slug: String!) {
    property(slug: $slug) {
      id
      slug
      title
      content
      excerpt
      featuredImage
      price
      bedrooms
      bathrooms
      area
      location
      propertyType
    }
  }
`;

export interface PropertyNode {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featuredImage: string | null;
  price: number | null;
  bedrooms: number | null;
  location: string | null;
}

export interface PropertyEdge {
  node: PropertyNode;
  cursor: string;
}

export interface PropertiesData {
  properties: {
    edges: PropertyEdge[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

export interface PropertiesVars {
  first?: number;
  after?: string | null;
  search?: string;
}

export interface PropertyDetail {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  featuredImage: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  location: string | null;
  propertyType: string | null;
}

export interface PropertyData {
  property: PropertyDetail | null;
}

export interface PropertyVars {
  slug: string;
}
