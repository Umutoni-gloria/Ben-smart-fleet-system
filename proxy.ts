import { verifyJWT } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check if it is a public route
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  const token = req.cookies.get('token')?.value

  // Handlers for root path '/'
  if (pathname === '/') {
    if (token) {
      const payload = await verifyJWT(token)
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isPublicRoute) {
    if (token) {
      const payload = await verifyJWT(token)
      if (payload) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const payload = await verifyJWT(token)

  if (!payload) {
    // If token is invalid or expired, clear it and redirect to login
    const response = NextResponse.redirect(new URL('/login', req.url))
    response.cookies.delete('token')
    return response
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', payload.id)
  requestHeaders.set('x-user-role', payload.role)
  requestHeaders.set('x-user-email', payload.email)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|truck.jpg|api/).*)',
  ],
}
