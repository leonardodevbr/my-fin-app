import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Hash pode vir como #/path#access_token=... (magic link). O Supabase só entende #access_token=...
// Normalizamos antes do client Supabase ser criado, e guardamos o path para redirecionar depois do login.
const rawHash = window.location.hash.slice(1)
if (rawHash.includes('access_token')) {
  const idx = rawHash.indexOf('access_token')
  const pathPart = rawHash.slice(0, idx).replace(/^#+/, '').trim() || '/'
  const authPart = rawHash.slice(idx)
  window.history.replaceState(null, '', `${window.location.pathname}#${authPart}`)
  if (pathPart && pathPart !== '/') {
    try {
      sessionStorage.setItem('finapp_redirect_after_auth', pathPart.startsWith('/') ? pathPart : `/${pathPart}`)
    } catch {
      // ignore
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
