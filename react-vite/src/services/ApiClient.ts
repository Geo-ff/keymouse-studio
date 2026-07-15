import type { ErrorDetail, ErrorResponse } from '../types';

export class ApiError extends Error {
  readonly detail: ErrorDetail;

  constructor(detail: ErrorDetail) {
    super(detail.message);
    this.name = 'ApiError';
    this.detail = detail;
  }
}

export class ApiClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch (cause) {
      throw new ApiError({
        code: 'CONNECTION_ERROR',
        message: cause instanceof Error ? cause.message : '无法连接自动化服务',
        details: {},
        retryable: true,
        operationId: null,
      });
    }

    if (!response.ok) {
      let body: ErrorResponse | null = null;
      try {
        body = await response.json() as ErrorResponse;
      } catch {
        body = null;
      }
      throw new ApiError(body?.error ?? {
        code: 'ENGINE_INTERNAL_ERROR',
        message: `请求失败 (${response.status})`,
        details: { status: response.status },
        retryable: response.status >= 500,
        operationId: null,
      });
    }

    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete(path: string): Promise<void> {
    return this.request<void>(path, { method: 'DELETE' });
  }
}