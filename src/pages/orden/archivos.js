import api from '../../api'

export const ACEPTA_DOCUMENTOS = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*'
export const ACEPTA_FACTURA = '.pdf,.xml,application/pdf,text/xml,application/xml'

export function subirAdjunto(ordenId, tipo, archivo) {
  const datos = new FormData()
  datos.append('tipo', tipo)
  datos.append('archivo', archivo)
  return api.post(`/ordenes/${ordenId}/adjuntos`, datos)
}

// Los archivos viven en un bucket privado: el backend da una URL firmada de
// pocos minutos. La pestaña se abre antes de pedirla para que el navegador no
// la bloquee como ventana emergente.
export async function abrirEnPestana(rutaApi) {
  const ventana = window.open('', '_blank')
  try {
    const { data } = await api.get(rutaApi)
    if (ventana) ventana.location.href = data.url
    else window.location.href = data.url
  } catch (e) {
    if (ventana) ventana.close()
    throw e
  }
}

export async function descargarPdfOrden(orden) {
  try {
    const res = await api.get(`/ordenes/${orden.id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `orden-${orden.folio}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    // Con responseType blob el cuerpo del error también llega como Blob.
    if (e.response?.data instanceof Blob) {
      try {
        const detalle = JSON.parse(await e.response.data.text()).detail
        if (detalle) e.response.data = { detail: detalle }
      } catch { /* sin detalle legible */ }
    }
    throw e
  }
}
