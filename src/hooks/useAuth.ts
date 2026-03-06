import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  /** true quando o usuário voltou pelo link de redefinir senha e precisa definir uma nova */
  needsNewPassword: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
  clearNeedsNewPassword: () => void
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsNewPassword, setNeedsNewPassword] = useState(false)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    const setSessionFromClient = (): void => {
      void supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s)
        setLoading(false)
      })
    }

    setSessionFromClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setLoading(false)
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsNewPassword(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ error: Error | null }> => {
    const supabase = getSupabase()
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ?? null }
  }

  const signInWithOtp = async (email: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabase()
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Sem path no redirect: assim o callback fica só #access_token=... e o Supabase reconhece
        emailRedirectTo: `${window.location.origin}${window.location.pathname || '/'}`,
      },
    })
    return { error: error ?? null }
  }

  const resetPasswordForEmail = async (email: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabase()
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname || '/'}`,
    })
    return { error: error ?? null }
  }

  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    const supabase = getSupabase()
    if (!supabase) return { error: new Error('Supabase não configurado') }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ?? null }
  }

  const signOut = async (): Promise<void> => {
    const supabase = getSupabase()
    if (supabase) await supabase.auth.signOut()
  }

  return {
    user: session?.user ?? null,
    session,
    loading,
    needsNewPassword,
    signInWithPassword,
    signInWithOtp,
    resetPasswordForEmail,
    updatePassword,
    clearNeedsNewPassword: () => setNeedsNewPassword(false),
    signOut,
  }
}

export function useAuthRequired(): AuthState & { showLogin: boolean; showSetPassword: boolean } {
  const auth = useAuth()
  const showLogin =
    isSupabaseConfigured && !auth.loading && !auth.session && !auth.needsNewPassword
  const showSetPassword = Boolean(isSupabaseConfigured && auth.session && auth.needsNewPassword)
  return { ...auth, showLogin, showSetPassword }
}
