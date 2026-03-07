import { useState } from 'react'
import { formatCurrency } from '../../../lib/utils'
import type { ParseResult } from '../importParser'

export interface StepPreviewProps {
  result: ParseResult
  selectedTxIds: Set<string>
  selectedGroupIds: Set<string>
  onSelectedTxIdsChange: (ids: Set<string>) => void
  onSelectedGroupIdsChange: (ids: Set<string>) => void
}

type Tab = 'transactions' | 'groups' | 'warnings'

export function StepPreview({
  result,
  selectedTxIds,
  selectedGroupIds,
  onSelectedTxIdsChange,
  onSelectedGroupIdsChange,
}: StepPreviewProps) {
  const [tab, setTab] = useState<Tab>('transactions')

  const toggleTx = (id: string) => {
    const next = new Set(selectedTxIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedTxIdsChange(next)
  }

  const toggleGroup = (id: string) => {
    const next = new Set(selectedGroupIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedGroupIdsChange(next)
  }

  const selectAllTx = () => onSelectedTxIdsChange(new Set(result.transactions.map((t) => t.id)))
  const deselectAllTx = () => onSelectedTxIdsChange(new Set())
  const selectAllGroups = () => onSelectedGroupIdsChange(new Set(result.groups.map((g) => g.id)))
  const deselectAllGroups = () => onSelectedGroupIdsChange(new Set())

  const totalInstallments = result.groups.reduce(
    (acc, g) => acc + (g.payment_mode === 'single' ? 1 : g.installments_total ?? 1),
    0
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'transactions', label: 'Transações únicas' },
    { key: 'groups', label: 'Grupos/Parcelamentos' },
    { key: 'warnings', label: 'Avisos' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-surface-200">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-surface-600 hover:text-surface-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-surface-600">
              {result.transactions.length} transações — {selectedTxIds.size} selecionadas
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTx}
                className="text-xs text-primary-600 hover:underline"
              >
                Selecionar todas
              </button>
              <button
                type="button"
                onClick={deselectAllTx}
                className="text-xs text-surface-500 hover:underline"
              >
                Desmarcar
              </button>
            </div>
          </div>
          <div className="border border-surface-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50">
                <tr>
                  <th className="w-10 px-2 py-2 text-left" />
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Descrição</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Pago</th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-surface-100 hover:bg-surface-50"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.has(t.id)}
                        onChange={() => toggleTx(t.id)}
                        className="rounded border-surface-300"
                      />
                    </td>
                    <td className="px-3 py-2">{t.date}</td>
                    <td className="px-3 py-2">{t.description}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrencyFromCents(t.amountCents)}
                    </td>
                    <td className="px-3 py-2">{t.is_paid ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-surface-600">
              {result.groups.length} grupos — {selectedGroupIds.size} selecionados • {totalInstallments} parcelas a gerar
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllGroups}
                className="text-xs text-primary-600 hover:underline"
              >
                Selecionar todos
              </button>
              <button
                type="button"
                onClick={deselectAllGroups}
                className="text-xs text-surface-500 hover:underline"
              >
                Desmarcar
              </button>
            </div>
          </div>
          <div className="border border-surface-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50">
                <tr>
                  <th className="w-10 px-2 py-2 text-left" />
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Modo</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Parcelas</th>
                  <th className="px-3 py-2 text-left">Início</th>
                </tr>
              </thead>
              <tbody>
                {result.groups.map((g) => (
                  <tr
                    key={g.id}
                    className="border-t border-surface-100 hover:bg-surface-50"
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        className="rounded border-surface-300"
                      />
                    </td>
                    <td className="px-3 py-2">{g.name}</td>
                    <td className="px-3 py-2">{g.payment_mode}</td>
                    <td className="px-3 py-2 text-right">
                      {g.amount_total != null
                        ? formatCurrency(g.amount_total)
                        : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {g.installments_total ?? (g.payment_mode === 'recurring' ? 'mensal' : '1')}
                    </td>
                    <td className="px-3 py-2">{g.start_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'warnings' && (
        <div className="space-y-2">
          <p className="text-sm text-surface-600">
            {result.warnings.length} aviso(s) — linhas ignoradas ou com valor zero
          </p>
          <ul className="border border-surface-200 rounded-lg divide-y divide-surface-100 max-h-64 overflow-y-auto">
            {result.warnings.length === 0 ? (
              <li className="px-3 py-2 text-sm text-surface-500">Nenhum aviso.</li>
            ) : (
              result.warnings.map((w, i) => (
                <li key={i} className="px-3 py-2 text-sm">
                  <span className="font-medium">{w.sheet}</span> linha {w.row}: {w.reason}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <p className="text-sm text-surface-500 pt-2">
        Total: <strong>{selectedTxIds.size}</strong> transações, <strong>{selectedGroupIds.size}</strong> grupos,{' '}
        <strong>
          {selectedGroupIds.size
            ? result.groups
                .filter((g) => selectedGroupIds.has(g.id))
                .reduce(
                  (acc, g) =>
                    acc + (g.payment_mode === 'single' ? 1 : g.installments_total ?? 1),
                  0
                )
            : 0}
        </strong>{' '}
        parcelas a gerar.
      </p>
    </div>
  )
}
