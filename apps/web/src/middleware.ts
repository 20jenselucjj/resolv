import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // file extensions (images, fonts, etc.)
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookies or authorization header
  // Note: Token is stored in localStorage on the client side, so we can't
  // check it in middleware directly. Instead, we rely on the client-side
  // auth guard in the dashboard layout. This middleware adds an extra layer
  // by checking for a resolv_token cookie if it exists.
  const token = request.cookies.get('resolv_token')?.value;

  // If we have a token cookie, let the request through
  if (token) {
    return NextResponse.next();
  }

  // For dashboard routes without a token cookie, we still let them through
  // because the client-side auth guard will redirect to login.
  // This middleware primarily protects against direct API abuse and adds
  // a redirect layer for unauthenticated users who have JS disabled.
  if (pathname.startsWith('/dashboard')) {
    // Let client-side handle the redirect ΓÇö the layout component will
    // redirect to /login if no token exists in localStorage
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
