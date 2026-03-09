import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'NunFí-efi-proxy',
    env: process.env.EFI_SANDBOX === 'true' ? 'sandbox' : 'production',
    ts: new Date().toISOString(),
  })
})
