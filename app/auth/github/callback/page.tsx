import { redirect } from 'next/navigation'

type CallbackPageProps = {
  searchParams?: {
    code?: string
    state?: string
  }
}

export default function GitHubCallbackPage({ searchParams }: CallbackPageProps) {
  const code = searchParams?.code
  const state = searchParams?.state

  if (!code) {
    redirect('/dashboard?auth_error=missing_code')
  }

  const params = new URLSearchParams({ code })
  if (state) {
    params.set('state', state)
  }

  redirect(`/api/auth/github/callback?${params.toString()}`)
}
