import { Download, Mail } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { ImportWizard } from './ImportWizard'
import { downloadTemplate } from './downloadTemplate'

export function ImportPage() {
  const { user } = useAuth()

  const handleDownloadTemplate = () => {
    downloadTemplate()
    toast.success('Modelo baixado')
  }

  const handleSendToEmail = () => {
    if (user?.email) {
      const subject = encodeURIComponent('Planilha modelo My Fin App')
      const body = encodeURIComponent(
        'Baixe o modelo em Importar planilha > Baixar modelo e preencha conforme as instruções.'
      )
      window.open(`mailto:${user.email}?subject=${subject}&body=${body}`, '_blank')
      toast.success('Abra seu e-mail e envie para si mesmo')
    } else {
      toast.error('Faça login para usar esta opção')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-surface-900">Importar planilha</h1>
      <p className="text-sm text-surface-600">
        Importe suas transações e grupos a partir da planilha modelo.
      </p>
      <div className="inline-flex flex-wrap gap-2 rounded-xl border border-surface-200 bg-surface-50/80 p-2">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-sm hover:bg-primary-50"
        >
          <Download className="h-4 w-4" />
          Baixar modelo
        </button>
        <button
          type="button"
          onClick={handleSendToEmail}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-100"
        >
          <Mail className="h-4 w-4" />
          Enviar para meu e-mail
        </button>
      </div>
      <ImportWizard />
    </div>
  )
}