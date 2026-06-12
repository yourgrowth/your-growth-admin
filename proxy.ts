import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000

export async function proxy(request: NextRequest) {
  // Surface missing env clearly instead of crashing the whole middleware
  // (a module-level throw produces an opaque 500 with no logs on Vercel).
  const missing = [
    !SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
    !ANON_KEY && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !SERVICE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (missing.length > 0) {
    return new NextResponse(
      `Server misconfigured — missing environment variable(s): ${missing.join(', ')}. ` +
        `Set these in Vercel → Settings → Environment Variables (Production) and redeploy.`,
      { status: 500, headers: { 'content-type': 'text/plain' } },
    )
  }

  let supabaseResponse = NextResponse.next({ request })
  const { pathname, searchParams } = request.nextUrl
  const isLoginPath = pathname === '/login' || pathname.startsWith('/login/')
  const isApiPath = pathname.startsWith('/api/')

  // Rate limit — check before auth so locked-out users see the right error
  // Wrapped in try/catch so a missing login_attempts table never blocks login
  if (pathname === '/login' && !searchParams.has('error')) {
    try {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        '127.0.0.1'

      const adminClient = createAdminSupabaseClient(SUPABASE_URL!, SERVICE_KEY!)
      const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count } = await adminClient
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .eq('success', false)
        .gte('attempted_at', cutoff)

      if ((count ?? 0) >= 5) {
        return NextResponse.redirect(new URL('/login?error=too_many_attempts', request.url))
      }
    } catch {
      // login_attempts table not yet created — skip rate limiting gracefully
    }
  }

  const supabase = createServerClient(SUPABASE_URL!, ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    if (!isLoginPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Session timeout — only on protected routes
  if (!isLoginPath && !isApiPath) {
    const lastActive = request.cookies.get('last_active')?.value
    if (lastActive && Date.now() - parseInt(lastActive, 10) > SESSION_TIMEOUT_MS) {
      await supabase.auth.signOut()
      const redirect = NextResponse.redirect(
        new URL('/login?error=session_expired', request.url),
      )
      for (const { name, value, ...opts } of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(
          name,
          value,
          opts as Parameters<typeof redirect.cookies.set>[2],
        )
      }
      redirect.cookies.delete('last_active')
      return redirect
    }
    supabaseResponse.cookies.set('last_active', Date.now().toString(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TIMEOUT_MS / 1000,
    })
  }

  if (isLoginPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export default proxy

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
