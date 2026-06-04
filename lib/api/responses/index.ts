import { NextRequest, NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export function successResponse<T>(data: T, extra?: Partial<ApiResponse<T>>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    ...extra,
  };
}

export function errorResponse(code: string, message: string, details?: any): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

export function handleApiError(error: unknown, context?: string): NextResponse {
  console.error('[API Error]', error);

  const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
  const stack = error instanceof Error ? error.stack : undefined;

  import('@/lib/logger').then(({ logger: systemLogger }) => {
    systemLogger.log({
      nivel: 'error',
      mensagem,
      contexto: 'api',
      caminho: context,
      detalhes: { stack },
    }).catch(() => {});
  }).catch(() => {});

  if (error instanceof ApiError) {
    return NextResponse.json(
      errorResponse(error.code, error.message, error.details),
      { status: error.status }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message),
      { status: 500 }
    );
  }

  return NextResponse.json(
    errorResponse('UNKNOWN_ERROR', 'Erro desconhecido'),
    { status: 500 }
  );
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: any) {
    return new ApiError('BAD_REQUEST', message, 400, details);
  }

  static notFound(message: string = 'Recurso nao encontrado') {
    return new ApiError('NOT_FOUND', message, 404);
  }

  static conflict(message: string) {
    return new ApiError('CONFLICT', message, 409);
  }

  static internal(message: string = 'Erro interno do servidor') {
    return new ApiError('INTERNAL_ERROR', message, 500);
  }
}
