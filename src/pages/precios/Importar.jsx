import { useRef, useState } from 'react'
import { UploadCloud, FolderOpen, FileArchive, CheckCircle2, AlertTriangle } from 'lucide-react'
import { unzipSync } from 'fflate'
import api from '../../api'
import { mensajeError } from '../../constants'
import { useToast } from '../../ui/feedback-context'
import { s as base } from './estilos'

const POR_ENVIO = 50
const BYTES_POR_ENVIO = 6 * 1024 * 1024
const EN_PARALELO = 2
const CLAVE_RFC = 'pc-rfc-empresa'

const TIPOS = { I: 'I', INGRESO: 'I', E: 'E', EGRESO: 'E', P: 'P', PAGO: 'P', T: 'T', TRASLADO: 'T', N: 'N', NOMINA: 'N' }

const leerLocal = (k) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
const guardarLocal = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }

const atributo = (etiqueta, nombre) => {
  const m = etiqueta?.match(new RegExp(`\\s${nombre}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1].trim() : ''
}

// Lectura rápida en el navegador: solo lo necesario para decidir qué subir.
// El servidor vuelve a leer cada XML completo.
async function revisarXml(archivo) {
  const texto = await archivo.text()
  const comprobante = texto.match(/<(?:[\w-]+:)?Comprobante\b[^>]*>/)
  if (!comprobante) return { archivo, valido: false }
  const emisor = texto.match(/<(?:[\w-]+:)?Emisor\b[^>]*>/)?.[0]
  const receptor = texto.match(/<(?:[\w-]+:)?Receptor\b[^>]*>/)?.[0]
  const tipo = atributo(comprobante[0], 'TipoDeComprobante').toUpperCase()
  return {
    archivo,
    valido: true,
    tipo: TIPOS[tipo] || tipo || 'I',
    fecha: atributo(comprobante[0], 'Fecha').slice(0, 10),
    rfc_emisor: atributo(emisor, 'Rfc').toUpperCase(),
    rfc_receptor: atributo(receptor, 'Rfc').toUpperCase(),
    uuid: (texto.match(/\sUUID\s*=\s*"([^"]+)"/i)?.[1] || '').toUpperCase(),
  }
}

async function archivosDeEntrada(entrada) {
  if (!entrada) return []
  if (entrada.isFile) return [await new Promise((ok, mal) => entrada.file(ok, mal))]
  if (!entrada.isDirectory) return []
  const lector = entrada.createReader()
  const hijos = []
  let lote
  do {
    lote = await new Promise((ok, mal) => lector.readEntries(ok, mal))
    hijos.push(...lote)
  } while (lote.length)
  return (await Promise.all(hijos.map(archivosDeEntrada))).flat()
}

// Los ZIP se abren aquí mismo: al servidor solo viajan los XML.
async function expandir(archivos) {
  const xmls = []
  let zips = 0
  for (const a of archivos) {
    const nombre = a.name.toLowerCase()
    if (nombre.endsWith('.xml')) xmls.push(a)
    else if (nombre.endsWith('.zip')) {
      zips += 1
      const contenido = unzipSync(new Uint8Array(await a.arrayBuffer()), {
        filter: (f) => f.name.toLowerCase().endsWith('.xml') && !f.name.includes('__MACOSX'),
      })
      Object.entries(contenido).forEach(([ruta, datos]) => {
        xmls.push(new File([datos], ruta.split('/').pop(), { type: 'application/xml' }))
      })
    }
  }
  return { xmls, zips }
}

function rfcMasFrecuente(revisados) {
  const conteo = {}
  revisados.forEach((r) => new Set([r.rfc_emisor, r.rfc_receptor]).forEach((rfc) => { if (rfc) conteo[rfc] = (conteo[rfc] || 0) + 1 }))
  return Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

const ETIQUETAS = {
  importada: 'Importadas', completada: 'Completadas', duplicada: 'Ya estaban', ignorada: 'Ignoradas',
  no_compra: 'No son compras', invalida: 'Con error',
}

export default function Importar({ resumen, onCambio, onIr }) {
  const [fase, setFase] = useState('elegir')
  const [leyendo, setLeyendo] = useState('')
  const [revision, setRevision] = useState(null)
  const [rfc, setRfc] = useState('')
  const [avance, setAvance] = useState({ hechos: 0, total: 0 })
  const [resultado, setResultado] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const cancelar = useRef(false)
  const entradaArchivos = useRef(null)
  const entradaCarpeta = useRef(null)
  const toast = useToast()

  async function preparar(archivos) {
    if (!archivos.length) return
    setFase('leyendo')
    try {
      setLeyendo('Abriendo archivos...')
      const { xmls, zips } = await expandir(archivos)
      if (!xmls.length) {
        toast('No encontramos archivos .xml (ni dentro de ZIP)', 'error')
        setFase('elegir')
        return
      }
      const revisados = []
      for (let i = 0; i < xmls.length; i += 200) {
        setLeyendo(`Leyendo ${Math.min(i + 200, xmls.length).toLocaleString('es-MX')} de ${xmls.length.toLocaleString('es-MX')} XML...`)
        revisados.push(...await Promise.all(xmls.slice(i, i + 200).map(revisarXml)))
      }
      // El mismo XML puede venir dos veces (dos carpetas, ZIP y suelto).
      const vistos = new Set()
      const unicos = revisados.filter((r) => {
        if (!r.valido || !r.uuid) return true
        if (vistos.has(r.uuid)) return false
        vistos.add(r.uuid)
        return true
      })
      const sugerido = leerLocal(CLAVE_RFC) || rfcMasFrecuente(unicos.filter((r) => r.valido))
      setRfc(sugerido)
      setRevision({ revisados: unicos, repetidos: revisados.length - unicos.length, zips })
      setFase('revisar')
    } catch (e) {
      toast('No se pudieron leer los archivos: ' + (e?.message || e), 'error')
      setFase('elegir')
    }
  }

  const empresa = new Set(rfc.toUpperCase().split(/[\s,;]+/).filter(Boolean))
  const clasificacion = (() => {
    if (!revision) return null
    const c = { compras: [], ventas: 0, otroTipo: 0, otroRfc: 0, ilegibles: 0, fechas: [] }
    revision.revisados.forEach((r) => {
      if (!r.valido) c.ilegibles += 1
      else if (r.tipo !== 'I') c.otroTipo += 1
      else if (empresa.size && !empresa.has(r.rfc_receptor)) {
        if (empresa.has(r.rfc_emisor)) c.ventas += 1; else c.otroRfc += 1
      } else {
        c.compras.push(r)
        if (r.fecha) c.fechas.push(r.fecha)
      }
    })
    c.fechas.sort()
    return c
  })()

  async function importar() {
    const lista = clasificacion.compras.map((r) => r.archivo)
    guardarLocal(CLAVE_RFC, rfc.trim().toUpperCase())
    const envios = []
    let actual = [], bytes = 0
    lista.forEach((a) => {
      if (actual.length >= POR_ENVIO || (actual.length && bytes + a.size > BYTES_POR_ENVIO)) {
        envios.push(actual); actual = []; bytes = 0
      }
      actual.push(a); bytes += a.size
    })
    if (actual.length) envios.push(actual)

    cancelar.current = false
    setFase('subiendo')
    setAvance({ hechos: 0, total: lista.length })
    const total = { resumen: {}, renglones: 0, reconocidos: 0, problemas: [] }
    const sumar = (data) => {
      Object.entries(data.resumen).forEach(([k, n]) => { total.resumen[k] = (total.resumen[k] || 0) + n })
      total.renglones += data.renglones
      total.reconocidos += data.reconocidos
      total.problemas.push(...data.resultados.filter((r) => ['invalida', 'no_compra', 'ignorada'].includes(r.estado)))
    }

    async function enviar(archivos, intento = 1) {
      const datos = new FormData()
      archivos.forEach((a) => datos.append('archivos', a, a.name))
      datos.append('rfc_empresa', rfc)
      try {
        const { data } = await api.post('/precios/importar', datos, { timeout: 180000 })
        sumar(data)
      } catch (e) {
        if (intento < 2 && !cancelar.current) return enviar(archivos, intento + 1)
        const mensaje = mensajeError(e)
        sumar({ resumen: { invalida: archivos.length }, renglones: 0, reconocidos: 0,
                resultados: archivos.map((a) => ({ archivo: a.name, estado: 'invalida', mensaje })) })
      }
      setAvance((v) => ({ ...v, hechos: v.hechos + archivos.length }))
    }

    let siguiente = 0
    const trabajador = async () => {
      while (siguiente < envios.length && !cancelar.current) {
        const lote = envios[siguiente++]
        await enviar(lote)
      }
    }
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))

    setResultado({ ...total, cancelado: cancelar.current, desde: clasificacion.fechas[0], hasta: clasificacion.fechas.at(-1) })
    setFase('listo')
    onCambio()
  }

  function reiniciar() {
    setRevision(null)
    setResultado(null)
    setFase('elegir')
  }

  const anio = (f) => (f ? f.slice(0, 4) : '')

  if (fase === 'leyendo' || fase === 'subiendo') {
    const pct = avance.total ? Math.round((avance.hechos / avance.total) * 100) : 0
    return (
      <section style={s.panel} aria-live="polite">
        <div style={s.icono}><UploadCloud size={22} /></div>
        <div style={{ fontSize: 15, fontWeight: 650 }}>
          {fase === 'leyendo' ? leyendo : `Importando ${avance.hechos.toLocaleString('es-MX')} de ${avance.total.toLocaleString('es-MX')} facturas`}
        </div>
        {fase === 'subiendo' && (
          <>
            <div style={s.barra} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ ...s.relleno, width: `${pct}%` }} />
            </div>
            <div style={base.sub}>No cierres esta pestaña. Puedes seguir trabajando en otra.</div>
            <button style={{ ...base.btnTexto, marginTop: 6 }} onClick={() => { cancelar.current = true }}>Detener</button>
          </>
        )}
      </section>
    )
  }

  if (fase === 'listo' && resultado) {
    const importadas = (resultado.resumen.importada || 0) + (resultado.resumen.completada || 0)
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <section style={{ ...s.resumen }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ ...s.icono, margin: 0 }}><CheckCircle2 size={22} /></span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 650 }}>
                {resultado.cancelado ? 'Importación detenida' : 'Importación terminada'}
              </div>
              <div style={base.sub}>
                {importadas.toLocaleString('es-MX')} facturas
                {resultado.desde ? ` de ${anio(resultado.desde)} a ${anio(resultado.hasta)}` : ''} · guardadas como históricas
              </div>
            </div>
          </div>
          <div style={s.cifras}>
            <Cifra n={resultado.renglones} texto="renglones leídos" />
            <Cifra n={resultado.reconocidos} texto="reconocidos solos" color="var(--pc-aqua)" />
            <Cifra n={resumen?.textos_por_clasificar ?? 0} texto="textos por clasificar" color="var(--pc-acento)" />
          </div>
        </section>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(resultado.resumen).map(([k, n]) => (
            <span key={k} style={base.chip}>{n.toLocaleString('es-MX')} {ETIQUETAS[k] || k}</span>
          ))}
        </div>

        <p style={{ ...base.help, marginTop: 0 }}>
          El histórico ya funciona: busca cualquier insumo en «Insumos», aunque no esté clasificado. Clasificar junta las
          distintas formas en que los proveedores escriben lo mismo, y con eso las referencias y los avisos se vuelven más precisos.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={base.btnPrimario} onClick={() => onIr('clasificar')}>Clasificar textos</button>
          <button style={base.btnSecundario} onClick={() => onIr('insumos')}>Ver precios</button>
          <button style={base.btnTexto} onClick={reiniciar}>Importar más</button>
        </div>

        {resultado.problemas.length > 0 && (
          <details style={s.detalle}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              {resultado.problemas.length} archivo{resultado.problemas.length === 1 ? '' : 's'} sin importar
            </summary>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
              {resultado.problemas.slice(0, 500).map((r, i) => (
                <div key={i} style={s.linea}>
                  <span style={{ fontFamily: 'var(--pc-mono)', fontSize: 12 }}>{r.archivo}</span>
                  <span style={{ color: 'var(--pc-gris)' }}>{r.mensaje}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

  if (fase === 'revisar' && clasificacion) {
    const c = clasificacion
    return (
      <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
        <section style={s.resumen}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>
              {revision.revisados.length.toLocaleString('es-MX')} XML encontrados
              {revision.zips ? ` en ${revision.zips} ZIP` : ''}
            </div>
            <div style={base.sub}>
              {revision.repetidos > 0 ? `${revision.repetidos} repetidos se omitieron · ` : ''}
              Revisa qué se va a importar antes de continuar.
            </div>
          </div>
        </section>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pc-gris-2)' }} htmlFor="pc-rfc-empresa">
            RFC de la empresa (quien recibe las facturas de compra)
          </label>
          <input id="pc-rfc-empresa" style={{ ...base.input, maxWidth: 360, marginTop: 6, fontFamily: 'var(--pc-mono)' }}
            value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} placeholder="Si son varias razones sociales, sepáralas con coma" />
          <p style={base.nota}>Lo detectamos porque aparece en casi todos los XML. Las facturas que la empresa emitió son ventas y no se mezclan con precios de compra.</p>
        </div>

        <div style={s.tabla}>
          <Fila icono="ok" n={c.compras.length} texto="facturas de compra se importarán"
            nota={c.fechas.length ? `del ${c.fechas[0]} al ${c.fechas.at(-1)}` : ''} />
          {c.ventas > 0 && <Fila n={c.ventas} texto="emitidas por la empresa (ventas): no se importan" />}
          {c.otroRfc > 0 && <Fila n={c.otroRfc} texto="recibidas por otro RFC: no se importan" nota="Si es otra razón social de la empresa, agrégala arriba." />}
          {c.otroTipo > 0 && <Fila n={c.otroTipo} texto="notas de crédito, pagos, nómina o traslados: no se importan" />}
          {c.ilegibles > 0 && <Fila icono="mal" n={c.ilegibles} texto="archivos que no son CFDI" />}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={{ ...base.btnPrimario, opacity: c.compras.length ? 1 : 0.45 }} disabled={!c.compras.length} onClick={importar}>
            Importar {c.compras.length.toLocaleString('es-MX')} facturas
          </button>
          <button style={base.btnSecundario} onClick={reiniciar}>Elegir otros archivos</button>
        </div>
        <p style={base.nota}>Las que ya estaban cargadas se detectan por su folio fiscal (UUID) y no se duplican.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {resumen?.facturas_historicas > 0 && (
        <div style={s.yaHay}>
          Ya hay {resumen.facturas_historicas.toLocaleString('es-MX')} facturas históricas. Puedes volver a subir la misma
          carpeta: solo se agregan las que falten.
        </div>
      )}
      <div
        style={{ ...s.zona, ...(arrastrando ? s.zonaActiva : {}) }}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setArrastrando(false)
          const entradas = Array.from(e.dataTransfer.items || []).map((i) => i.webkitGetAsEntry?.()).filter(Boolean)
          const archivos = entradas.length
            ? (await Promise.all(entradas.map(archivosDeEntrada))).flat()
            : Array.from(e.dataTransfer.files || [])
          preparar(archivos)
        }}>
        <div style={s.icono}><UploadCloud size={22} /></div>
        <div style={{ fontSize: 15, fontWeight: 650 }}>Arrastra aquí la carpeta, los ZIP o los XML</div>
        <div style={{ ...base.sub, margin: '4px 0 14px', fontSize: 12.5 }}>
          Sin límite de archivos: se suben por tandas. Tal como los descargas del SAT o del correo.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={base.btnAqua} onClick={() => entradaCarpeta.current?.click()}><FolderOpen size={15} /> Elegir carpeta</button>
          <button style={base.btnSecundario} onClick={() => entradaArchivos.current?.click()}><FileArchive size={15} /> Elegir XML o ZIP</button>
        </div>
        <input ref={entradaCarpeta} type="file" hidden webkitdirectory="" directory=""
          onChange={(e) => { const a = Array.from(e.target.files || []); e.target.value = ''; preparar(a) }} />
        <input ref={entradaArchivos} type="file" hidden multiple accept=".xml,.zip,text/xml,application/xml,application/zip"
          onChange={(e) => { const a = Array.from(e.target.files || []); e.target.value = ''; preparar(a) }} />
      </div>
      <ul style={s.puntos}>
        <li>Solo entran facturas de compra (de ingreso, recibidas por la empresa). Las ventas, notas de crédito y pagos se descartan solos.</li>
        <li>Se guardan como históricas: no aparecen en «Facturas sin vincular» ni se ligan a órdenes.</li>
        <li>Si después subes una de esas facturas en Facturas o en una orden, se vincula normalmente.</li>
      </ul>
    </div>
  )
}

function Cifra({ n, texto, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 21, fontWeight: 700, color: color || 'var(--pc-tinta)' }}>{Number(n || 0).toLocaleString('es-MX')}</div>
      <div style={base.sub}>{texto}</div>
    </div>
  )
}

function Fila({ icono, n, texto, nota }) {
  const Icono = icono === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div style={s.fila}>
      <Icono size={16} style={{ color: icono === 'ok' ? 'var(--pc-aqua)' : 'var(--pc-gris)', flex: 'none', marginTop: 2 }} />
      <div>
        <b>{n.toLocaleString('es-MX')}</b> {texto}
        {nota && <div style={base.sub}>{nota}</div>}
      </div>
    </div>
  )
}

const s = {
  zona: { border: '1.5px dashed var(--pc-borde)', borderRadius: 12, padding: '30px 18px', textAlign: 'center',
          background: 'var(--pc-superficie)', transition: 'border-color 0.15s, background 0.15s' },
  zonaActiva: { borderColor: 'var(--pc-aqua)', background: 'var(--pc-aqua-bg)' },
  icono: { width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 10px',
           background: 'var(--pc-aqua-bg)', color: 'var(--pc-aqua)', flex: 'none' },
  panel: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: '30px 20px',
           textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' },
  barra: { width: '100%', maxWidth: 420, height: 8, borderRadius: 4, background: 'var(--pc-superficie-3)', overflow: 'hidden' },
  relleno: { height: '100%', background: 'var(--pc-aqua)', borderRadius: 4, transition: 'width 0.3s' },
  resumen: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, padding: 18,
             display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, alignItems: 'center' },
  cifras: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 },
  tabla: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 12, overflow: 'hidden' },
  fila: { display: 'flex', gap: 10, padding: '11px 14px', borderBottom: '1px solid var(--pc-linea)', fontSize: 13.5, lineHeight: 1.45 },
  detalle: { background: 'var(--pc-superficie)', border: '1px solid var(--pc-borde)', borderRadius: 10, padding: '10px 14px' },
  linea: { display: 'flex', gap: 10, flexWrap: 'wrap', padding: '5px 0', borderTop: '1px dashed var(--pc-borde)', fontSize: 12.5 },
  puntos: { margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--pc-gris-2)', lineHeight: 1.6 },
  yaHay: { fontSize: 13, background: 'var(--pc-aqua-bg)', color: 'var(--pc-aqua)', borderRadius: 10, padding: '10px 14px' },
}
