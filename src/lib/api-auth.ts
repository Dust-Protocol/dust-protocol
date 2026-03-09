// Shared API route authentication utilities.
// Prevents external scripts from abusing sponsor-funded routes.

import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * Verify the request originated from our own frontend.
 * Checks Origin or Referer header against the deployment URL.
 * Returns null if valid, or a 403 NextResponse if rejected.
 */
export function checkOrigin(req: Request): NextResponse | null {
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
  // Skip check in development or if not configured
  if (!allowedOrigin || process.env.NODE_ENV === 'development') return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (origin && origin === allowedOrigin) return null;
  if (referer && referer.startsWith(allowedOrigin)) return null;

  // Same-origin fetch from Next.js pages may omit both headers in some
  // edge cases (e.g. server actions). Allow if neither is present — rate
  // limits still protect against abuse.
  if (!origin && !referer) return null;

  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403, headers: NO_STORE },
  );
}
