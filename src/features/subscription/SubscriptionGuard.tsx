import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { RefreshCw } from 'lucide-react'

const ALLOWED_WITHOUT_ACCESS = ['/subscription', '/profile']

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { hasAccess, loading } = useSubscription()
  const location = useLocation()
  const pathname = (location.pathname || '/').replace(/^#/, '') || '/'
  const isAllowedWithoutAccess = ALLOWED_WITHOUT_ACCESS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!hasAccess && !isAllowedWithoutAccess) {
    return <Navigate to="/subscription" replace state={{ from: pathname }} />
  }

  return <>{children}</>
}
