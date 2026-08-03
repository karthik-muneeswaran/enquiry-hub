import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  function createMockContext(type: string = 'http', requestId?: string): ExecutionContext {
    return {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => ({ id: requestId || 'req-123', headers: {} }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  function createMockHandler(data: any): CallHandler {
    return { handle: () => of(data) };
  }

  it('should wrap response in success envelope for HTTP', async () => {
    const context = createMockContext('http', 'req-456');
    const handler = createMockHandler({ id: 1, name: 'Test' });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: { id: 1, name: 'Test' },
        request_id: 'req-456',
      }),
    );
  });

  it('should include ISO timestamp in response', async () => {
    const context = createMockContext('http');
    const handler = createMockHandler({ id: 1 });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$) as any;

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should pass through data unchanged for GraphQL context', async () => {
    const context = createMockContext('graphql');
    const handler = createMockHandler({ id: 1, name: 'GraphQL' });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ id: 1, name: 'GraphQL' });
  });

  it('should wrap null data in envelope', async () => {
    const context = createMockContext('http');
    const handler = createMockHandler(null);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$) as any;

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('should wrap array data in envelope', async () => {
    const context = createMockContext('http');
    const handler = createMockHandler([{ id: 1 }, { id: 2 }]);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$) as any;

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('should use "unknown" when request has no id', async () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    const handler = createMockHandler({ x: 1 });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$) as any;

    expect(result.request_id).toBe('unknown');
  });
});
