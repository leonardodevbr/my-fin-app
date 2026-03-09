import { Router, Request, Response } from 'express'
import axios from 'axios'

const EFI_WEBHOOK_IP = '34.193.116.226'

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].trim()
  }
  return req.socket.remoteAddress ?? ''
}

function hasValidClientCert(req: Request): boolean {
  const sock = req.socket as { getPeerCertificate?: () => { subject?: unknown } }
  const cert = sock.getPeerCertificate?.()
  return !!(cert && typeof cert === 'object' && Object.keys(cert).length > 0 && cert.subject)
}

export const efiWebhookRouter = Router()

efiWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req)
    const certPresent = hasValidClientCert(req)

    if (!certPresent && clientIp !== EFI_WEBHOOK_IP) {
      console.warn(`[efi-webhook] Rejeitado: IP=${clientIp} (esperado ${EFI_WEBHOOK_IP}), cert=${certPresent}`)
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabaseWebhookUrl = process.env.SUPABASE_WEBHOOK_URL
    const proxySecret = process.env.PROXY_SECRET
    if (!supabaseWebhookUrl || !proxySecret) {
      console.error('[efi-webhook] SUPABASE_WEBHOOK_URL ou PROXY_SECRET não configurado')
      return res.status(500).json({ error: 'Configuração inválida' })
    }

    console.log(`[efi-webhook] Encaminhando para Supabase (IP=${clientIp}, cert=${certPresent})`)

    const forwardRes = await axios.post(supabaseWebhookUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxySecret}`,
      },
      validateStatus: () => true,
      timeout: 30_000,
    })

    res.status(forwardRes.status).json(forwardRes.data ?? {})
  } catch (e: unknown) {
    const err = e as { message?: string }
    console.error('[efi-webhook] Erro ao encaminhar:', err?.message ?? e)
    res.status(500).json({ error: err?.message ?? 'Erro interno' })
  }
})

efiWebhookRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).send('OK')
})
