import Cors, { CorsOptions } from 'cors';
import { RequestHandler } from 'express';

export interface ICorsOptions {
  /** Exact origins (`https://host[:port]`) allowed to call with credentials. Empty: no CORS headers for anyone. */
  origins: string[];
  /** Request headers the app reads beyond Content-Type and Authorization. */
  allowedHeaders?: string[];
}

const ORIGIN = /^https?:\/\/[^/?#\s]+$/;

/** Throws on an entry that is not a bare origin: a trailing slash or a path never matches a browser's Origin header. */
export function validateCorsOrigins(origins: string[]): string[] {
  for (const origin of origins) {
    if (!ORIGIN.test(origin)) {
      throw new Error(`Invalid CORS origin "${origin}": expected scheme://host[:port] with no path or trailing slash`);
    }
  }
  return origins;
}

/**
 * A listed origin gets its own value back with credentials allowed; any other origin gets no
 * CORS header at all. The Origin header is never reflected unchecked.
 */
export function corsOptions(options?: ICorsOptions): CorsOptions {
  const allowed = new Set(validateCorsOrigins(options?.origins ?? []));
  return {
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', ...(options?.allowedHeaders ?? [])],
    maxAge: 600,
  };
}

export function corsMiddleware(options?: ICorsOptions): RequestHandler {
  return Cors(corsOptions(options));
}
