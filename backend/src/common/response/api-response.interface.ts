export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  request_id: string;
  timestamp: string;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
  constraint: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    request_id: string;
    timestamp: string;
  };
}
