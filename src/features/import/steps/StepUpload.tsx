import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseSpreadsheet } from '../importParser'
import type { ParseResult } from '../importParser'

const ACCEPT = '.xlsx'
const MAX_SIZE_MB = 10

export interface StepUploadProps {
  onParsed: (result: ParseResult) => void
}

export function StepUpload({ onParsed }: StepUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError('Aceito apenas arquivos .xlsx')
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Arquivo muito grande (máx. ${MAX_SIZE_MB} MB)`)
        return
      }
      setLoading(true)
      try {
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array' })
        const result = parseSpreadsheet(workbook)
        onParsed(result)
      } catch {
        setError('Arquivo inválido ou formato não reconhecido')
      } finally {
        setLoading(false)
      }
    },
    [onParsed]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) void processFile(file)
    },
    [processFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void processFile(file)
      e.target.value = ''
    },
    [processFile]
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600">
        Envie a planilha no formato <strong>controle_financeiro_leo_2026_v3.xlsx</strong> (.xlsx).
      </p>
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors
          ${dragging ? 'border-primary-500 bg-primary-50' : 'border-surface-300 bg-surface-50'}
          ${loading ? 'pointer-events-none opacity-70' : 'cursor-pointer hover:border-primary-400'}
        `}
      >
        <input
          type="file"
          accept={ACCEPT}
          onChange={onFileInput}
          disabled={loading}
          className="sr-only"
        />
        {loading ? (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span className="mt-3 text-sm text-surface-600">Lendo planilha…</span>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-surface-400" />
            <span className="mt-3 text-sm font-medium text-surface-700">
              Arraste o arquivo aqui ou clique para escolher
            </span>
            <span className="mt-1 text-xs text-surface-500">Apenas .xlsx</span>
          </>
        )}
      </label>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
