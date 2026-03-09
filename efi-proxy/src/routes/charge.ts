import { Router, Request, Response } from 'express'
import { getEfiClient, getEfiToken } from '../efiClient'

export const chargeRouter = Router()

chargeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, amountCents, description } = req.body as {
      userId: string
      amountCents: number
      description?: string
    }

    if (!userId || !amountCents) {
      return res.status(400).json({ error: 'userId e amountCents são obrigatórios' })
    }

    const token = await getEfiToken()
    const client = getEfiClient()

    // txid único — máx 35 chars, só alfanumérico
    const uid = userId.replace(/-/g, '').slice(0, 20)
    const txid = `nf${uid}${Date.now().toString(36).slice(-8)}`

    console.log(`[charge] Criando cob txid=${txid} valor=${amountCents}`)

    const cobRes = await client.put(
      `/v2/cob/${txid}`,
      {
        calendario: { expiracao: 3600 },
        valor: { original: (amountCents / 100).toFixed(2) },
        chave: process.env.EFI_PIX_KEY!,
        solicitacaoPagador: description ?? 'NunFí Pro — Assinatura mensal',
        infoAdicionais: [{ nome: 'Plano', valor: 'NunFí Pro' }],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    const cob = cobRes.data as {
      txid: string
      pixCopiaECola: string
      loc: { id: number }
    }

    console.log(`[charge] Cob criada txid=${cob.txid}`)

    // Busca QR Code
    let qrCodeImage: string | null = null
    try {
      const qrRes = await client.get(`/v2/loc/${cob.loc.id}/qrcode`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      qrCodeImage = (qrRes.data as { imagemQrcode: string }).imagemQrcode
      console.log(`[charge] QR Code obtido loc=${cob.loc.id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown }; message?: string }
      console.warn('[charge] QR Code falhou:', err?.response?.data ?? err?.message)
    }

    return res.json({
      txid: cob.txid,
      pixCopiaECola: cob.pixCopiaECola,
      qrCodeImage,
      amountCents,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    })
  } catch (e: unknown) {
    const err = e as { response?: { data?: unknown }; message?: string }
    const detail = err?.response?.data ?? err?.message ?? 'Erro interno'
    console.error('[charge] Erro:', JSON.stringify(detail))
    return res.status(500).json({ error: detail })
  }
})
