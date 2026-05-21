import { NextRequest, NextResponse } from 'next/server'


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    // Validate required parameters
    if (!code) {
      console.warn('GitHub callback missing authorization code')
      return NextResponse.redirect(
        new URL('/dashboard?auth_error=missing_code', request.url)
      )
    }

    if (!state) {
      console.warn('GitHub callback missing state parameter (CSRF token)')
      return NextResponse.redirect(
        new URL('/dashboard?auth_error=missing_state', request.url)
      )
    }

    // Get the backend API URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 
                       process.env.API_URL ||
                       'http://localhost:8000'

    console.log('Exchanging GitHub code for token at:', backendUrl)

    // Call backend API to exchange authorization code for access token
    const tokenResponse = await fetch(
      `${backendUrl}/api/auth/github/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          redirectUri: new URL('/api/auth/github/callback', request.url).toString()
        })
      }
    )

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(
        `Backend OAuth exchange failed: ${tokenResponse.status}`,
        errorData
      )
      return NextResponse.redirect(
        new URL(`/dashboard?auth_error=token_exchange_failed&status=${tokenResponse.status}`, request.url)
      )
    }

    const data = await tokenResponse.json()

    if (!data.token && !data.access_token) {
      console.error('Backend did not return an access token')
      return NextResponse.redirect(
        new URL('/dashboard?auth_error=no_token_returned', request.url)
      )
    }

    const token = data.token || data.access_token
    const dashboardUrl = new URL('/dashboard', request.url)
    
    // Add success indicator to URL if provided
    if (data.userId) {
      dashboardUrl.searchParams.set('auth_success', 'true')
    }

    const response = NextResponse.redirect(dashboardUrl)

    // Store authentication token in secure httpOnly cookie
    // httpOnly: prevents JavaScript access (security)
    // secure: only sent over HTTPS in production
    // sameSite: prevents CSRF attacks
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    // Optional: Store additional user info in a non-httpOnly cookie (if needed by frontend)
    if (data.user) {
      response.cookies.set('user_info', JSON.stringify(data.user), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    console.log('GitHub OAuth callback successful for user:', data.userId || 'unknown')
    return response

  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/dashboard?auth_error=callback_error&details=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}

/**
 * Optional: Handle POST requests if your GitHub App is configured to send POST requests
 * (Some configurations prefer POST for security)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, state } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      )
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 
                       process.env.API_URL ||
                       'http://localhost:8000'

    // Exchange code for token
    const tokenResponse = await fetch(
      `${backendUrl}/api/auth/github/callback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      }
    )

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: tokenResponse.status }
      )
    }

    const data = await tokenResponse.json()
    const response = NextResponse.json(data, { status: 200 })

    // Set cookie in response
    if (data.token) {
      response.cookies.set('auth_token', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return response

  } catch (error) {
    console.error('POST callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
