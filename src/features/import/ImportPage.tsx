import { ImportWizard } from './ImportWizard'

export function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-surface-900">Importar planilha</h1>
      <p className="text-sm text-surface-600">
        Importe suas transações e grupos a partir da planilha <strong>finapp_import_v3.xlsx</strong>.
      </p>
      <ImportWizard />
    </div>
  )
}