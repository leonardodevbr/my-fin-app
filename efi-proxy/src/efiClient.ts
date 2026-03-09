import axios, { AxiosInstance } from 'axios'
import https from 'https'

const IS_SANDBOX = process.env.EFI_SANDBOX === 'true'

export const EFI_BASE = IS_SANDBOX
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br'

let _client: AxiosInstance | null = null
let _token: string | null = null
let _tokenExpiry = 0

export function getEfiClient(): AxiosInstance {
  if (_client) return _client

  const certBase64 = process.env.EFI_CERT_BASE64
  if (!certBase64) throw new Error('EFI_CERT_BASE64 não configurado')

  const pfx = Buffer.from(certBase64, 'base64')
  const passphrase = process.env.EFI_CERT_PASSPHRASE ?? ''

  // pfx = formato .p12 — o https.Agent do Node aceita nativamente
  const httpsAgent = new https.Agent({ pfx, passphrase })

  _client = axios.create({
    baseURL: EFI_BASE,
    httpsAgent,
    headers: { 'Content-Type': 'application/json' },
  })

  return _client
}

export async function getEfiToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token

  const client = getEfiClient()
  const creds = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString('base64')

  const res = await client.post<{ access_token: string; expires_in: number }>(
    '/oauth/token',
    { grant_type: 'client_credentials' },
    { headers: { Authorization: `Basic ${creds}` } }
  )

  _token = res.data.access_token
  _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000
  console.log('[efi] Token obtido, expira em', res.data.expires_in, 's')
  return _token
}
