import { useState } from 'react'
import { Plus } from 'lucide-react'
import { C } from './tema'

// Buscador de proveedores con alta rápida: escribe para filtrar por nombre o RFC.
export default function ComboProveedor({ proveedores, valor, onChange, onAgregar }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')

  const seleccionado = proveedores.find((p) => p.id === valor) || null
  const filtro = texto.trim().toLowerCase()
  const coincidencias = filtro
    ? proveedores.filter((p) =>
        p.nombre.toLowerCase().includes(filtro) ||
        (p.rfc || '').toLowerCase().includes(filtro))
    : proveedores
  const opciones = coincidencias.slice(0, 40)

  const elegir = (p) => {
    onChange(p ? p.id : '')
    setTexto('')
    setAbierto(false)
  }

  return (
    <div style={{ position:'relative' }}>
      <input
        style={s.input}
        placeholder={`Escribe para buscar entre ${proveedores.length} proveedores...`}
        value={abierto ? texto : (seleccionado?.nombre || '')}
        onFocus={() => { setTexto(''); setAbierto(true) }}
        // El cierre se retrasa para que alcance a registrarse el clic en una opción.
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
      />
      {abierto && (
        <div style={s.combo}>
          <div style={{ ...s.comboItem, color:'var(--pc-gris)' }}
            onMouseDown={() => elegir(null)}>
            — Ninguno —
          </div>
          {opciones.map((p) => (
            <div key={p.id} style={s.comboItem} onMouseDown={() => elegir(p)}>
              <span>{p.nombre}</span>
              {p.rfc && <span style={s.comboRfc}>{p.rfc}</span>}
            </div>
          ))}
          {coincidencias.length === 0 && (
            <div style={{ ...s.comboItem, color:'var(--pc-gris-3)' }}>Sin coincidencias.</div>
          )}
          {coincidencias.length > opciones.length && (
            <div style={s.comboMas}>
              +{coincidencias.length - opciones.length} más — sigue escribiendo para acotar.
            </div>
          )}
          {onAgregar && (
            <div style={s.comboNuevo}
              onMouseDown={(e) => {
                e.preventDefault()
                setAbierto(false)
                onAgregar(texto.trim())
              }}>
              <Plus size={15} /> Agregar nuevo proveedor{texto.trim() ? ` "${texto.trim()}"` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  input: { width:'100%', border:'1px solid var(--pc-borde)', borderRadius:8, padding:'9px 11px',
           fontSize:14, boxSizing:'border-box' },
  combo: { position:'absolute', top:'100%', left:0, right:0, zIndex:60, marginTop:4,
           background:'var(--pc-superficie)', border:'1px solid var(--pc-borde)', borderRadius:8,
           maxHeight:240, overflowY:'auto', boxShadow:'0 12px 28px rgba(0,0,0,0.14)' },
  comboItem: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:10,
               padding:'8px 11px', fontSize:13.5, cursor:'pointer',
               borderBottom:'1px solid var(--pc-linea)' },
  comboRfc: { fontFamily:'var(--pc-mono)', fontSize:11, color:'var(--pc-gris-3)', whiteSpace:'nowrap' },
  comboMas: { padding:'8px 11px', fontSize:12, color:'var(--pc-gris-3)', background:'var(--pc-superficie-2)' },
  comboNuevo: { position:'sticky', bottom:0, padding:'9px 11px', fontSize:13.5, fontWeight:600, display:'flex', alignItems:'center', gap:6,
                cursor:'pointer', color:C.aqua, background:C.aquaBg,
                borderTop:`1px solid ${C.aqua}` },
}
