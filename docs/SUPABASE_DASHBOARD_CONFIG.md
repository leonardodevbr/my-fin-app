# Configuração no Dashboard do Supabase (sem CLI)

## 1. Onde ficam as coisas

- **Edge Functions**: menu lateral → **Edge Functions**
- **Secrets (variáveis de ambiente)**: **Edge Functions** → aba **Secrets** (ou **Project Settings** → **Edge Functions** → **Secrets**, dependendo da versão do dashboard)

---

## 2. Deploy das funções (pelo Editor do Dashboard)

Como você não usa o CLI, precisa criar/deployar as funções pelo editor do Dashboard:

1. Vá em **Edge Functions**.
2. Clique em **Deploy a new function** (ou **Create function**).
3. Escolha **Via Editor** (código no navegador).
4. Para cada função abaixo, crie uma função com o **nome exato** e cole o código do arquivo correspondente em `supabase/functions/` no seu projeto.

### Funções que o app usa

| Função                  | Arquivo no projeto                              |
|-------------------------|--------------------------------------------------|
| `send-report-email`     | `supabase/functions/send-report-email/index.ts`  |
| `send-template-email`  | envia planilha modelo                            |
| `trigger-pusher`       | `supabase/functions/trigger-pusher/index.ts`      |
| `scheduler-due-notifications` | chamada pelo pg_cron (Pusher + Web Push + email) |

Depois de colar o código, clique em **Deploy function**.

---

## 3. Secrets (variáveis de ambiente)

Em **Edge Functions** → **Secrets**, adicione as **chaves** e **valores** abaixo.

### Para `send-report-email` e `send-template-email` (e-mail com Resend)

| Nome             | Onde pegar                    | Obrigatório |
|------------------|-------------------------------|-------------|
| `RESEND_API_KEY` | [Resend](https://resend.com) → API Keys | Sim         |
| `FROM_EMAIL`     | Ex.: `NunFi <noreply@seudominio.com>`   | Não (usa padrão Resend) |

### Para `trigger-pusher` (notificações em tempo real)

| Nome               | Onde pegar                                      | Obrigatório |
|--------------------|--------------------------------------------------|-------------|
| `PUSHER_APP_ID`    | Dashboard [Pusher](https://dashboard.pusher.com) → App Keys | Sim |
| `PUSHER_KEY`       | Mesmo lugar (Key)                                | Sim         |
| `PUSHER_SECRET`    | Mesmo lugar (Secret)                             | Sim         |
| `PUSHER_CLUSTER`   | Mesmo lugar (Cluster), ex.: `sa1`                | Sim         |

- Se você não for usar a função `trigger-pusher`, não precisa configurar os secrets do Pusher.
- Os secrets ficam disponíveis para **todas** as Edge Functions do projeto; não é preciso “atribuir” por função.

---

## 4. URLs das funções

O app chama as funções em:

- `https://<SEU_PROJECT_REF>.supabase.co/functions/v1/send-report-email`
- `https://<SEU_PROJECT_REF>.supabase.co/functions/v1/trigger-pusher`

O **Project Ref** é o ID do projeto (ex.: `abcdefghijk`) que aparece na URL do Dashboard:  
`https://supabase.com/dashboard/project/abcdefghijk/...`

No frontend você já usa `VITE_SUPABASE_URL`; a URL das functions é sempre `VITE_SUPABASE_URL + '/functions/v1/NOME_DA_FUNCAO'`, então não precisa configurar mais nada no app para a URL.

---

## 5. Resumo rápido

1. **Edge Functions** → criar/deployar `send-report-email` e, se quiser, `trigger-pusher`, colando o código dos arquivos do repositório.
2. **Edge Functions** → **Secrets** → adicionar no mínimo:
   - `RESEND_API_KEY` (para relatório e planilha por e-mail)
   - Se for usar Pusher: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`.
   - Para Web Push (notificação com app fechado): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (gerar com `npx web-push generate-vapid-keys`).
3. **Frontend** (`.env`): `VITE_VAPID_PUBLIC_KEY` = mesma chave pública VAPID.

Não é necessário reinstalar o CLI nem rodar comandos no terminal para isso.
