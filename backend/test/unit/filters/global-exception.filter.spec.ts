import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      id: 'req-123',
      method: 'POST',
      url: '/api/v1/enquiries',
    };

    mockHost = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  describe('HttpException handling', () => {
    it('should handle 400 BadRequestException', () => {
      const exception = new BadRequestException('Invalid input');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Invalid input',
            request_id: 'req-123',
          }),
        }),
      );
    });

    it('should handle 404 NotFoundException', () => {
      const exception = new NotFoundException('Enquiry not found');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'Enquiry not found',
          }),
        }),
      );
    });

    it('should handle 403 ForbiddenException', () => {
      const exception = new ForbiddenException('Access denied');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle validation errors (array of messages)', () => {
      const exception = new BadRequestException({
        message: ['email must be an email', 'name should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.error.message).toBe('Validation failed');
      expect(jsonCall.error.details).toHaveLength(2);
      expect(jsonCall.error.details[0]).toEqual(
        expect.objectContaining({
          field: 'email',
          constraint: 'isEmail',
        }),
      );
      expect(jsonCall.error.details[1]).toEqual(
        expect.objectContaining({
          field: 'name',
          constraint: 'isNotEmpty',
        }),
      );
    });
  });

  describe('Prisma error handling', () => {
    it('should handle P2002 (unique constraint violation) as 409', () => {
      const exception = { code: 'P2002', meta: { target: ['email'] } };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'A record with this value already exists',
          }),
        }),
      );
    });

    it('should handle P2025 (record not found) as 404', () => {
      const exception = { code: 'P2025', meta: {} };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should handle unknown Prisma errors as 500', () => {
      const exception = { code: 'P9999' };

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Unknown error handling', () => {
    it('should handle unknown errors as 500 without leaking internals', () => {
      const exception = new Error('Sensitive database connection details');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.error.message).toBe('An unexpected error occurred');
      expect(jsonCall.error.message).not.toContain('database connection');
    });

    it('should handle non-Error thrown values', () => {
      filter.catch('some string error', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: 'An unexpected error occurred',
          }),
        }),
      );
    });
  });

  describe('GraphQL context', () => {
    it('should re-throw exception for GraphQL context', () => {
      const gqlHost = {
        getType: () => 'graphql',
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };

      const exception = new Error('GQL error');

      expect(() => filter.catch(exception, gqlHost as any)).toThrow('GQL error');
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Response structure', () => {
    it('should include timestamp in ISO format', () => {
      const exception = new NotFoundException('Not found');

      filter.catch(exception, mockHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should include request_id from request', () => {
      const exception = new NotFoundException('Not found');

      filter.catch(exception, mockHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.error.request_id).toBe('req-123');
    });

    it('should use "unknown" if request has no id', () => {
      mockRequest.id = undefined;
      const exception = new NotFoundException('Not found');

      filter.catch(exception, mockHost);

      const jsonCall = mockResponse.json.mock.calls[0][0];
      expect(jsonCall.error.request_id).toBe('unknown');
    });
  });
});
