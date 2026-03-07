import { useCallback, useRef, useState } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseSpreadsheet } from '../importParser'
import type { ParseResult } from '../importParser'

const ACCEPT = '.xlsx'
const MAX_SIZE_MB = 10

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'
  }
  return (bytes / 1024).toFixed(1).replace('.', ',') + ' KB'
}

export interface StepUploadProps {
  onParsed: (result: ParseResult) => void
}

export function StepUpload({ onParsed }: StepUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        setSelectedFile(file)
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

  const handleTrocarArquivo = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedFile(null)
    setError(null)
    inputRef.current?.click()
  }, [])

  const isError = !!error
  const isEmpty = !selectedFile && !loading && !isError
  const isSuccess = !!selectedFile && !loading

  const labelClassName = [
    'flex flex-col items-center justify-center rounded-xl border-2 p-8 transition-colors',
    isError
      ? 'border-red-400 bg-red-50'
      : isSuccess
        ? 'border-primary-500 bg-primary-50 border-solid'
        : `border-dashed ${dragging ? 'border-primary-500 bg-primary-50' : 'border-surface-300 bg-surface-50'}`,
    loading ? 'pointer-events-none opacity-70' : 'cursor-pointer hover:border-primary-400',
  ].join(' ')

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600">
        Envie a planilha no formato <strong>finapp_import.xlsx</strong> (.xlsx).
      </p>
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={labelClassName}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileInput}
          disabled={loading}
          className="sr-only"
        />
        {loading && (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span className="mt-3 text-sm text-surface-600">Lendo planilha…</span>
          </>
        )}
        {!loading && isError && (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-10 w-10 text-red-500 shrink-0" />
            <span className="text-sm font-medium text-red-700" role="alert">
              {error}
            </span>
          </div>
        )}
        {!loading && !isError && isEmpty && (
          <>
            <Upload className="h-10 w-10 text-surface-400" />
            <span className="mt-3 text-sm font-medium text-surface-700">
              Arraste o arquivo aqui ou clique para escolher
            </span>
            <span className="mt-1 text-xs text-surface-500">Apenas .xlsx</span>
          </>
        )}
        {!loading && !isError && isSuccess && selectedFile && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="relative">
              <FileSpreadsheet className="h-12 w-12 text-primary-600" />
              <CheckCircle2
                className="absolute -bottom-0.5 -right-0.5 h-5 w-5 text-emerald-500 fill-white"
                aria-hidden
              />
            </div>
            <span className="mt-3 font-semibold text-surface-900 truncate max-w-full px-2">
              {selectedFile.name}
            </span>
            <span className="mt-0.5 text-xs text-surface-500">
              {formatFileSize(selectedFile.size)}
            </span>
            <span className="mt-1 text-sm text-primary-700">
              Arquivo carregado com sucesso
            </span>
            <button
              type="button"
              onClick={handleTrocarArquivo}
              className="mt-2 text-xs text-surface-500 underline cursor-pointer hover:text-surface-700 focus:outline-none"
            >
              Trocar arquivo
            </button>
          </div>
        )}
      </label>
    </div>
  )
}
