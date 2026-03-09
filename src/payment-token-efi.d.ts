declare module 'payment-token-efi' {
  interface CreditCardData {
    brand: string
    number: string
    cvv: string
    expirationMonth: string
    expirationYear: string
    holderName?: string
    holderDocument?: string
    reuse?: boolean
  }

  interface PaymentTokenResult {
    payment_token: string
    card_mask?: string
  }

  interface CreditCardAPI {
    setAccount(account: string): this
    setEnvironment(env: 'production' | 'sandbox'): this
    setCreditCardData(data: CreditCardData): this
    setCardNumber(number: string): this
    verifyCardBrand(): Promise<string>
    getPaymentToken(): Promise<PaymentTokenResult>
  }

  interface EfiPayNamespace {
    CreditCard: CreditCardAPI
  }

  const EfiPay: EfiPayNamespace
  export default EfiPay
}

