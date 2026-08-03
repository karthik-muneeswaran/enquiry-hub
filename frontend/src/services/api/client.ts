import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { NormalizedApiError } from './types';

/**
 * Centralized Axios API client with:
 * - Auth token injection
 * - Idempotency-Key header on POST requests
 * - Response envelope unwrapping
 * - Retry with exponential backoff (3 attempts, 4^n seconds)
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TIMEOUT = 15_000;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: AxiosError): boolean {
  if (!error.response) {
    // Network error (no response received)
    return true;
  }
  const status = error.response.status;
  return status >= 500 && status <= 599;
}

function normalizeError(error: AxiosError<unknown>): NormalizedApiError {
  const data = error.response?.data as Record<string, unknown> | undefined;

  if (data && typeof data === 'object' && 'error' in data) {
    const errorPayload = data.error as Record<string, unknown>;
    return {
      code: (errorPayload.code as string) || 'UNKNOWN_ERROR',
      message: (errorPayload.message as string) || error.message,
      details: errorPayload.details as NormalizedApiError['details'],
      requestId: (data.request_id as string) || '',
    };
  }

  return {
    code: 'NETWORK_ERROR',
    message: error.message || 'An unexpected error occurred',
    requestId: '',
  };
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach auth token + idempotency key on POST
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Auto-generate Idempotency-Key for POST requests
  if (
    config.method?.toLowerCase() === 'post' &&
    !config.headers['Idempotency-Key']
  ) {
    config.headers['Idempotency-Key'] = crypto.randomUUID();
  }

  return config;
});

// Response interceptor: unwrap BOTH the Axios wrapper and the backend's
// { success, data, request_id, timestamp } envelope so consumers get
// the inner payload directly.
client.interceptors.response.use(
  (response) => {
    const body = response.data;
    // Unwrap the backend's TransformInterceptor envelope
    if (body && typeof body === 'object' && 'success' in body && body.success === true) {
      return body.data;
    }
    return body;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/**
 * Makes a request with retry logic for 5xx and network errors.
 * Retries up to 3 times with backoff delays: 1s, 4s, 16s (4^attempt).
 */
async function requestWithRetry<T>(config: AxiosRequestConfig): Promise<T> {
  let lastError: AxiosError | undefined;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await client.request<unknown, T>(config);
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      lastError = axiosError;

      const isLastAttempt = attempt === MAX_RETRIES - 1;
      if (!isRetryableError(axiosError) || isLastAttempt) {
        throw normalizeError(axiosError);
      }

      // Backoff: 4^0=1s, 4^1=4s, 4^2=16s
      await delay(Math.pow(4, attempt) * 1000);
    }
  }

  throw normalizeError(lastError!);
}

export const apiClient = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return requestWithRetry<T>({ ...config, method: 'GET', url });
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return requestWithRetry<T>({ ...config, method: 'POST', url, data });
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return requestWithRetry<T>({ ...config, method: 'PUT', url, data });
  },

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return requestWithRetry<T>({ ...config, method: 'PATCH', url, data });
  },

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return requestWithRetry<T>({ ...config, method: 'DELETE', url });
  },
};
