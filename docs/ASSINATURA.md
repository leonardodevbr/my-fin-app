# Assinatura NunFí Pro

## Hoje

- **Acesso:** sem trial ou Pro ativo, o usuário **não acessa** o app — só as telas **Assinatura** e **Perfil**. O restante (Início, Transações, Contas, Relatórios, etc.) redireciona para `/subscription`. Versão free = bem capada.
- **Pagamento:** apenas PIX (cobrança única, R$ 9,90/mês).
- **Cancelamento:** pedido por e-mail (processamento manual). Devolução PIX via webhook cancela a assinatura e marca pagamento como "Devolvido".
- **Direito de arrependimento:** 7 dias (lei). Você não paga taxa para devolver; paga só para receber.

## Política para inibir “assina e cancela”

Uma opção é **não reembolsar ao solicitar cancelamento**: a pessoa mantém o Pro até o fim do período e você simplesmente não gera nova cobrança. Assim evita taxa em duas operações. O “Solicitar cancelamento” já pode ser tratado assim pelo suporte (e-mail avisa quando é assinatura recente).

## Assinatura com cartão (Efi) – por que não está implementada

A **Efi tem API de assinatura/recorrência com cartão** (plano + inscrição + cobrança automática). Documentação: [Assinatura | API Cobranças Efi](https://dev.efipay.com.br/docs/api-cobrancas/assinatura/) e [Cartão](https://dev.efipay.com.br/docs/api-cobrancas/cartao).

Não está no app hoje porque:

1. Exige **payment_token** gerado no front com a lib JS da Efi (dados do cartão criptografados no browser).
2. Fluxo diferente: criar plano, criar inscrição, definir forma de pagamento (cartão), webhooks de transação recorrente.
3. PIX foi implementado primeiro (mais simples, sem formulário de cartão).

Para implementar depois: usar API de Cobranças (não só PIX), criar plano de R$ 9,90/mês, tela de “Assinar com cartão” que gera o token e chama a API de inscrição; webhook de confirmação de pagamento recorrente para ativar/renovar Pro. Com cartão, o “cancelar” pode ser só “não cobrar no próximo ciclo”, sem devolução.
