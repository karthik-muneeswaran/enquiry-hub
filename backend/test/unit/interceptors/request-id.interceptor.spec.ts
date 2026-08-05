import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { RequestIdInterceptor } from '@/common/interceptors/request-id.interceptor';

describe('RequestIdInterceptor', () => {
  let interceptor: RequestIdInterceptor;

  beforeEach(() => {
    interceptor = new RequestIdInterceptor();
  });

  function createMockContext(headers: Record<string, string> = {}): {
    context: ExecutionContext;
    request: any;
    response: any;
  } {
    const request: any = { headers };
    const response: any = { setHeader: jest.fn() };

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { context, request, response };
  }

  const mockHandler: CallHandler = { handle: () => of('result') };

  it('should generate a UUID and attach it to request.id', async () => {
    const { context, request } = createMockContext();

    await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(request.id).toBeDefined();
    expect(request.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('should use provided X-Request-Id header if present', async () => {
    const { context, request } = createMockContext({
      'x-request-id': 'custom-req-id-abc',
    });

    await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(request.id).toBe('custom-req-id-abc');
  });

  it('should set X-Request-Id response header', async () => {
    const { context, response } = createMockContext({
      'x-request-id': 'my-id',
    });

    await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', 'my-id');
  });

  it('should set generated UUID in response header when no request header', async () => {
    const { context, response, request } = createMockContext();

    await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', request.id);
  });

  it('should proceed with handler and return its output', async () => {
    const { context } = createMockContext();

    const result = await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(result).toBe('result');
  });
});
