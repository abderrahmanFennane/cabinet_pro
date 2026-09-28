import api from './api'

/** Medical files need the auth header, so they are fetched as a blob and opened from a local URL. */
export async function openAttachment(cabinetId: string, patientId: string, attachmentId: string) {
  const win = window.open('', '_blank')
  const response = await api.get(`/cabinets/${cabinetId}/patients/${patientId}/attachments/${attachmentId}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  if (win) win.location.href = url
  else window.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`)
