import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Content rendered when no error is present. */
  children: ReactNode;
  /** Optional custom fallback UI. If not provided, a default error card is rendered. */
  fallback?: ReactNode;
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Per-page-section error boundary that isolates component failures.
 * If a child component throws, this boundary renders a fallback UI
 * with a "Try Again" button instead of crashing the entire page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging (could integrate with observability stack)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="mx-auto my-8 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center"
        >
          <svg
            className="mx-auto mb-3 h-10 w-10 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h2 className="mb-2 text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="mb-4 text-sm text-red-600">
            An unexpected error occurred in this section. You can try again or refresh the page.
          </p>
          <button
            onClick={this.handleRetry}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
