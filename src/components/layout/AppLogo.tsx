import { useState } from 'react'
import { cn } from '../../lib/utils'

const LOGO_ALT = 'NunFi'
/** Logos ficam na raiz de public (fora de favicon). */
const LOGO_PATHS = ['/logo.png', '/logo.svg']
const WHITE_LOGO_PATHS = ['/white-logo.png', '/white-logo.svg']

export interface AppLogoProps {
  className?: string
  /** Classes do texto quando a imagem não carrega (ex.: text-primary-400 no sidebar). */
  fallbackClassName?: string
  /** Altura do logo em pixels (ex.: 32). */
  height?: number
  /** Para sidebar escura: tenta white-logo.png, logo-white.png, etc. */
  light?: boolean
}

export function AppLogo({ className, fallbackClassName = 'font-semibold text-surface-900', height = 32, light }: AppLogoProps) {
  const [error, setError] = useState(false)
  const [lightIndex, setLightIndex] = useState(0)
  const [pathIndex, setPathIndex] = useState(0)
  const lightPaths = WHITE_LOGO_PATHS
  const src = light && lightIndex < lightPaths.length
    ? lightPaths[lightIndex]
    : LOGO_PATHS[pathIndex]

  const handleError = () => {
    if (light && lightIndex < lightPaths.length) {
      setLightIndex((i) => i + 1)
      return
    }
    if (pathIndex < LOGO_PATHS.length - 1) setPathIndex((i) => i + 1)
    else setError(true)
  }

  if (error) {
    return <span className={cn(fallbackClassName, className)}>{LOGO_ALT}</span>
  }

  return (
    <img
      src={src}
      alt={LOGO_ALT}
      style={{ height: `${height}px` }}
      className={cn('object-contain object-left w-auto', className)}
      onError={handleError}
    />
  )
}
