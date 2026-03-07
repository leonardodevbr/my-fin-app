import { ImportWizard } from './ImportWizard'

export function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-surface-900">Importar planilha</h1>
      <p className="text-sm text-surface-600">
        Use uma planilha no formato controle_financeiro_leo_2026_v3.xlsx para importar transações e parcelamentos.
      </p>
      <ImportWizard />
    </div>
  )
}
