import api from './api'

/** Downloads a file from an authenticated API route (Excel exports, templates, PDF). */
export async function downloadFile(path: string, fileName: string, params?: Record<string, unknown>) {
  const res = await api.get(path, { params, responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
