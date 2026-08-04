import {
  ApolloClient,
  ApolloProvider as BaseApolloProvider,
  InMemoryCache,
  HttpLink,
} from '@apollo/client';
import { ReactNode } from 'react';

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        properties: {
          keyArgs: ['filter', 'sort'],
          merge(existing, incoming, { args }) {
            const offset = args?.offset ?? 0;
            const merged = existing ? [...existing.items] : [];
            const incomingItems = incoming?.items ?? [];

            for (let i = 0; i < incomingItems.length; i++) {
              merged[offset + i] = incomingItems[i];
            }

            return {
              ...incoming,
              items: merged,
            };
          },
        },
      },
    },
  },
});

const apolloClient = new ApolloClient({
  link: httpLink,
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

interface ApolloProviderProps {
  children: ReactNode;
}

export function ApolloProvider({ children }: ApolloProviderProps) {
  return <BaseApolloProvider client={apolloClient}>{children}</BaseApolloProvider>;
}
