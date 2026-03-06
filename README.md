# My Fin App

SPA de finanças pessoais com React 18 + Vite 5, TypeScript, armazenamento local (IndexedDB via Dexie) e sincronização opcional com Supabase.

## Stack

- **React 18** + **Vite 5**
- **TypeScript** (strict)
- **TailwindCSS v3**
- **React Router v6** (hash-based)
- **Zustand** (estado global)
- **Dexie.js v3** (IndexedDB, offline-first)
- **@supabase/supabase-js v2** (sync na nuvem)
- **Recharts** (gráficos)
- **date-fns** (datas)
- **react-hot-toast** (notificações)
- **lucide-react** (ícones)

## Estrutura principal

```
src/
  db/           # Schema e instância Dexie
  sync/         # Motor de sync (push/pull) e hook useSyncStatus
  features/     # dashboard, transactions, accounts, categories, reports, budgets
  hooks/        # useTransactions, useAccounts, useCategories
  components/   # layout (AppShell, Sidebar, BottomNav) e ui
  store/        # Zustand appStore
  lib/           # supabase client e utils
```

## Setup

1. **Clonar e instalar dependências**

   ```bash
   npm install
   ```

2. **Variáveis de ambiente (opcional – para sync com Supabase)**

   Copie o exemplo e preencha com sua URL e chave anônima do Supabase:

   ```bash
   cp .env.example .env
   ```

   Edite `.env`:

   ```
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```

   Sem `.env` configurado, o app funciona 100% offline (Dexie apenas).

3. **Rodar em desenvolvimento**

   ```bash
   npm run dev
   ```

4. **Build para produção**

   ```bash
   npm run build
   ```

5. **Preview do build**

   ```bash
   npm run preview
   ```

## Rotas (Hash)

- `#/` – Dashboard  
- `#/transactions` – Transações  
- `#/accounts` – Contas  
- `#/categories` – Categorias  
- `#/reports` – Relatórios  
- `#/budgets` – Orçamentos  

## Sync

- Leituras e escritas são feitas primeiro no Dexie (offline-first).
- Alterações entram na `sync_queue` e são enviadas ao Supabase em `pushChanges()`.
- `pullChanges(since)` traz registros atualizados do Supabase e mescla no Dexie (last-write-wins por `updated_at`).
- Auto-sync: ao dar foco na janela, ao voltar online e a cada 5 minutos (quando Supabase está configurado).

## PWA

O projeto está preparado para PWA com `vite-plugin-pwa`:

- Manifest: nome "FinApp", short_name "FinApp", theme_color "#10b981".
- Workbox: cache de assets estáticos e estratégia network-first para chamadas de API.

Para ícones PWA, adicione `public/pwa-192x192.png` e `public/pwa-512x512.png` ou ajuste o `manifest` em `vite.config.ts`.
