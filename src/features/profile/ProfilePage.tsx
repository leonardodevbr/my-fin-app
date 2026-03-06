import { useState, useRef, useEffect } from 'react'
import { User, Mail, Pencil, Check, X, RefreshCw, Lock, Eye, EyeOff, Camera, ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { useSyncStatus } from '../../sync/useSyncStatus'
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

const AVATAR_BUCKET = 'avatars'
const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function uploadAvatar(userId: string, file: File): Promise<string> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase não configurado')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  if (!/^(jpe?g|png|webp|gif)$/.test(ext)) throw new Error('Use imagem (JPG, PNG, WebP ou GIF).')
  if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Máximo ${MAX_SIZE_MB} MB.`)
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`),
  })
  if (error) throw error
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

function getInitials(user: { user_metadata?: { full_name?: string }; email?: string }): string {
  const name = user.user_metadata?.full_name?.trim()
  if (name) {
    const parts = name.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const email = user.email ?? ''
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase() || '?'
}

function getAvatarUrl(user: { user_metadata?: { avatar_url?: string; picture?: string } }): string | null {
  return user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
}

export function ProfilePage() {
  const { user, updateProfile, updatePassword } = useAuth()
  const { forceFullSync, syncing } = useSyncStatus()
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [showCameraView, setShowCameraView] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!showCameraView) return
    let stream: MediaStream | null = null
    const video = videoRef.current
    const start = async () => {
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 640 } } })
        }
        streamRef.current = stream
        if (video) {
          video.srcObject = stream
          await video.play()
        }
      } catch (err) {
        toast.error('Não foi possível acessar a câmera. Use a galeria.')
        setShowCameraView(false)
      }
    }
    start()
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (video) video.srcObject = null
    }
  }, [showCameraView])

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-surface-900">Perfil</h1>
        <p className="text-surface-500">Carregando…</p>
      </div>
    )
  }

  const displayName = user.user_metadata?.full_name?.trim() || user.email?.split('@')[0] || 'Usuário'
  const avatar = getAvatarUrl(user)
  const initials = getInitials(user)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateProfile({
      full_name: fullName.trim() || undefined,
      avatar_url: avatarUrl.trim() || undefined,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Perfil atualizado.')
    setEditing(false)
  }

  const handleCancel = () => {
    setFullName(user.user_metadata?.full_name ?? '')
    setAvatarUrl(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? '')
    setEditing(false)
  }

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Use uma imagem (JPG, PNG, WebP ou GIF).')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`A imagem deve ter no máximo ${MAX_SIZE_MB} MB.`)
      return
    }
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
    setPreviewFile(file)
    setPreviewObjectUrl(URL.createObjectURL(file))
  }

  const handleCancelPreview = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
    setPreviewFile(null)
    setPreviewObjectUrl(null)
  }

  const handleCapturePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        setShowCameraView(false)
        if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
        setPreviewFile(file)
        setPreviewObjectUrl(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.9
    )
  }

  const handleConfirmUpload = async () => {
    if (!previewFile) return
    setUploadingAvatar(true)
    try {
      const url = await uploadAvatar(user.id, previewFile)
      const urlWithCache = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
      setAvatarUrl(urlWithCache)
      const { error } = await updateProfile({ avatar_url: url })
      if (error) throw error
      toast.success('Foto atualizada.')
      if (!editing) setEditing(true)
      handleCancelPreview()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto.'
      toast.error(msg.includes('Bucket') ? `${msg} Crie o bucket "avatars" no Supabase (Storage) e rode a migration 003.` : msg)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('As senhas não conferem')
      return
    }
    setChangingPassword(true)
    const { error } = await updatePassword(newPassword)
    setChangingPassword(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setNewPassword('')
    setNewPasswordConfirm('')
    toast.success('Senha alterada.')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Perfil</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Meus dados</CardTitle>
          {!editing ? (
            <button
              type="button"
              onClick={() => {
                setFullName(user.user_metadata?.full_name ?? '')
                setAvatarUrl(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? '')
                setEditing(true)
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-surface-600 hover:bg-surface-100"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center w-full sm:w-auto sm:items-start gap-3">
<<<<<<< HEAD
            {showCameraView ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="relative w-full aspect-square max-w-[280px] rounded-full overflow-hidden border-2 border-surface-200 bg-surface-900">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-2 justify-center">
=======
            <div className="h-24 w-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold border-2 border-surface-200 overflow-hidden shrink-0">
              {(editing ? avatarUrl.trim() : avatar) ? (
                <img
                  src={(editing ? avatarUrl.trim() : avatar) ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    const fallback = el.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <span
                className="h-full w-full flex items-center justify-center"
                style={{
                  display: (editing ? avatarUrl.trim() : avatar) ? 'none' : 'flex',
                }}
              >
                {initials}
              </span>
            </div>
            {isSupabaseConfigured && (
              <div className="w-full space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
>>>>>>> 36a8968842d40958ba9c07e197aad181dcec4921
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    Capturar foto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      streamRef.current?.getTracks().forEach((t) => t.stop())
                      streamRef.current = null
                      if (videoRef.current) videoRef.current.srcObject = null
                      setShowCameraView(false)
                    }}
                    className="rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-24 w-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-semibold border-2 border-surface-200 overflow-hidden shrink-0 relative">
                  {previewObjectUrl ? (
                    <img src={previewObjectUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (editing ? avatarUrl.trim() : avatar) ? (
                    <img
                      src={(editing ? avatarUrl.trim() : avatar) ?? ''}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        const fallback = el.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {!previewObjectUrl && (
                    <span
                      className="h-full w-full flex items-center justify-center"
                      style={{
                        display: (editing ? avatarUrl.trim() : avatar) ? 'none' : 'flex',
                      }}
                    >
                      {initials}
                    </span>
                  )}
                </div>
                {isSupabaseConfigured && (
                  <div className="w-full space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarFileSelect}
                    />
                    {previewObjectUrl ? (
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={handleConfirmUpload}
                      disabled={uploadingAvatar}
                      className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {uploadingAvatar ? 'Enviando…' : 'Enviar foto'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelPreview}
                      disabled={uploadingAvatar}
                      className="rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setShowCameraView(true)}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      Câmera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Galeria
                    </button>
                  </div>
                )}
                {editing && (
                  <>
                    <p className="text-xs text-surface-500">Ou use um link:</p>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-sm"
                    />
                  </>
                )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex-1 space-y-4 min-w-0">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-1">
                <User className="h-4 w-4" />
                Nome
              </label>
              {editing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900"
                />
              ) : (
                <p className="text-surface-900">{displayName}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-surface-700 mb-1">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <p className="text-surface-600">{user.email}</p>
              <p className="text-xs text-surface-400 mt-0.5">Alterar email não está disponível aqui.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isSupabaseConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Nova senha</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 pr-10 text-surface-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-surface-500 hover:text-surface-700"
                    aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Confirmar nova senha</label>
                <div className="relative">
                  <input
                    type={showNewPasswordConfirm ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 pr-10 text-surface-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-surface-500 hover:text-surface-700"
                    aria-label={showNewPasswordConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showNewPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={changingPassword || !newPassword || !newPasswordConfirm}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {changingPassword ? 'Alterando…' : 'Alterar senha'}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {isSupabaseConfigured && (
        <Card>
          <CardHeader>
            <CardTitle>Sincronização</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-600 mb-3">
              Se categorias ou contas não aparecerem (mesmo estando no servidor), recarregue os dados do servidor.
            </p>
            <button
              type="button"
              onClick={() => {
                toast.loading('Recarregando…', { id: 'force-sync' })
                forceFullSync()
                  .then(() => toast.success('Dados recarregados.', { id: 'force-sync' }))
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Erro ao recarregar', { id: 'force-sync' }))
              }}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 disabled:opacity-50"
            >
              <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Recarregar categorias e contas do servidor
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
