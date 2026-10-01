import { NextResponse } from "next/server";

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CursorPaginationParams {
  cursor: string | null;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Parse pagination params from URL search params.
 * Defaults: page=1, limit=20, max limit=100
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {}
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || String(defaults.page || "1")));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaults.limit || "20")))
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Parse cursor pagination params from URL search params.
 */
export function parseCursorParams(
  searchParams: URLSearchParams,
  defaults: { limit?: number } = {}
): CursorPaginationParams {
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || String(defaults.limit || "20")))
  );
  const cursor = searchParams.get("cursor") || null;
  return { cursor, limit };
}

/**
 * Create a paginated JSON response with Cache-Control headers.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
  cacheMaxAge: number = 30
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / params.limit);
  const response: PaginatedResponse<T> = {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };

  return NextResponse.json(response, {
    headers: {
      // `private` — responses are tenant-scoped; shared caches must never
      // store one farm's data and serve it to another.
      "Cache-Control": `private, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`,
      "X-Total-Count": String(total),
      "X-Page": String(params.page),
      "X-Per-Page": String(params.limit),
    },
  });
}

/**
 * Create a cursor-paginated JSON response.
 */
export function cursorPaginatedResponse<T>(
  data: T[],
  nextCursor: string | null,
  params: CursorPaginationParams,
  cacheMaxAge: number = 30
): NextResponse<CursorPaginatedResponse<T>> {
  const response: CursorPaginatedResponse<T> = {
    data,
    pagination: {
      nextCursor,
      hasMore: nextCursor !== null,
      limit: params.limit,
    },
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": `private, max-age=${cacheMaxAge}, stale-while-revalidate=${cacheMaxAge * 2}`,
    },
  });
}

/**
 * Create a simple cached JSON response (for non-paginated GET routes).
 */
export function cachedJsonResponse<T>(data: T, maxAge: number = 30): NextResponse<T> {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
    },
  });
}
