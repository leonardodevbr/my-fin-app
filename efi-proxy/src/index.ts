import express, { Request, Response, NextFunction } from 'express'
import { chargeRouter } from './routes/charge'
import { healthRouter } from './routes/health'
import { registerWebhookRouter } from './routes/registerWebhook'
import { efiWebhookRouter } from './routes/efiWebhook'

const app = express()
app.use(express.json())

const PROXY_SECRET = process.env.PROXY_SECRET
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/health')) return next()
  if (req.path.startsWith('/efi-webhook')) return next()
  if (!PROXY_SECRET) return next()

  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${PROXY_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

app.use('/health', healthRouter)
app.use('/charge', chargeRouter)
app.use('/register-webhook', registerWebhookRouter)
app.use('/efi-webhook', efiWebhookRouter)

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Erro:', err.message)
  res.status(500).json({ error: err.message })
})

const PORT = parseInt(process.env.PORT ?? '3000', 10)
app.listen(PORT, () => {
  console.log(`[efi-proxy] Porta ${PORT} | Sandbox: ${process.env.EFI_SANDBOX === 'true'}`)
})
