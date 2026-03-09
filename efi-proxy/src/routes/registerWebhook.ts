import { Router, Request, Response } from 'express'
import { getEfiClient, getEfiToken } from '../efiClient'

export const registerWebhookRouter = Router()

registerWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { webhookUrl } = req.body as { webhookUrl?: string }

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ error: 'webhookUrl é obrigatório no body' })
    }

    const pixKey = process.env.EFI_PIX_KEY
    if (!pixKey) {
      return res.status(500).json({ error: 'EFI_PIX_KEY não configurado' })
    }

    const token = await getEfiToken()
    const client = getEfiClient()

    console.log(`[register-webhook] Registrando URL na Efi: ${webhookUrl}`)

    const putRes = await client.put(
      `/v2/webhook/${encodeURIComponent(pixKey)}`,
      { webhookUrl },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const raw = typeof putRes.data === 'string' ? putRes.data : JSON.stringify(putRes.data)
    console.log(`[register-webhook] Efi respondeu status=${putRes.status}`)

    return res.json({ ok: true, webhookUrl, raw })
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: unknown }; message?: string }
    const detail = err?.response?.data ?? err?.message ?? 'Erro interno'
    console.error('[register-webhook] Erro:', JSON.stringify(detail))
    return res.status(500).json({ ok: false, error: detail })
  }
})
