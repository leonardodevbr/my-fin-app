import { useWebPush } from '../hooks/useWebPush'
import { useAuth } from '../hooks/useAuth'

export function WebPushInit() {
  const { user } = useAuth()
  useWebPush(user?.id ?? undefined)
  return null
}
