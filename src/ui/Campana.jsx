import { useState, useEffect } from 'react'
import { Bell, BellOff, CheckCheck, PackageOpen, Pencil, X } from 'lucide-react'
import { haceCuanto } from './avisos'
import { C } from './tema'

const ICONOS = { surtido: PackageOpen, modificacion: Pencil }

// Campana con los avisos del usuario (cambios a órdenes en curso, surtidos parciales).
export default function Campana({ avisos, onAbrirOrden }) {
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e) => { if (e.key === 'Escape') setAbierta(false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierta])

  if (!avisos.disponible) return null
  const { no_leidas: n } = avisos

  const abrir = (a) => {
    if (!a.leida_at) avisos.marcar([a.id])
    setAbierta(false)
    if (a.orden_id) onAbrirOrden(a.orden_id)
  }

  return (
    <>
      <button className="pc-icono-btn" style={{ position: 'relative', marginLeft: 'auto' }}
        onClick={() => setAbierta((v) => !v)}
        aria-label={n ? `${n} avisos sin leer` : 'Avisos'} title="Avisos" aria-expanded={abierta}>
        <Bell size={16} />
        {n > 0 && <span style={s.punto}>{n > 9 ? '9+' : n}</span>}
      </button>

      {abierta && (<>
        <div style={s.velo} onClick={() => setAbierta(false)} />
        <div className="pc-campana-panel pc-modal" role="dialog" aria-label="Avisos">
          <div style={s.cabeza}>
            <span style={{ fontWeight: 650, fontSize: 14.5 }}>Avisos</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {n > 0 && (
                <button style={s.accion} onClick={() => avisos.marcar(null)}>
                  <CheckCheck size={14} /> Marcar todo leído
                </button>
              )}
              <button style={s.cerrar} onClick={() => setAbierta(false)} aria-label="Cerrar avisos"><X size={15} /></button>
            </div>
          </div>
          <div style={s.lista}>
            {avisos.avisos.length === 0 && (
              <div style={s.vacio}>
                <BellOff size={22} style={{ color: 'var(--pc-gris-3)' }} />
                <div>Sin avisos por ahora.</div>
                <div style={{ fontSize: 12 }}>Aquí verás cuando alguien edite una orden en curso o registre un surtido parcial.</div>
              </div>
            )}
            {avisos.avisos.map((a) => {
              const Icono = ICONOS[a.tipo] || Bell
              return (
                <button key={a.id} style={{ ...s.aviso, ...(a.leida_at ? {} : s.avisoNuevo) }} onClick={() => abrir(a)}>
                  <span style={s.icono}><Icono size={15} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={s.titulo}>{a.titulo}</span>
                    {a.detalle && <span style={s.detalle}>{a.detalle}</span>}
                    <span style={s.meta}>{haceCuanto(a.created_at)}</span>
                  </span>
                  {!a.leida_at && <span style={s.noLeido} aria-label="sin leer" />}
                </button>
              )
            })}
          </div>
        </div>
      </>)}
    </>
  )
}

const s = {
  punto: { position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9,
           background: 'var(--pc-acento)', color: '#fff', fontSize: 10, fontWeight: 700,
           display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--pc-superficie)' },
  velo: { position: 'fixed', inset: 0, zIndex: 80 },
  cabeza: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 12px 10px 16px',
            borderBottom: '1px solid var(--pc-borde)' },
  accion: { border: 'none', background: 'none', color: C.aqua, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            padding: '4px 8px', borderRadius: 6 },
  cerrar: { border: 'none', background: 'none', color: 'var(--pc-gris)', cursor: 'pointer', width: 28, height: 28,
            borderRadius: 6, display: 'inline-grid', placeItems: 'center' },
  lista: { overflowY: 'auto', flex: 1 },
  vacio: { padding: '36px 24px', textAlign: 'center', color: 'var(--pc-gris)', fontSize: 13.5, display: 'flex',
           flexDirection: 'column', alignItems: 'center', gap: 6 },
  aviso: { width: '100%', display: 'flex', gap: 11, alignItems: 'flex-start', textAlign: 'left', padding: '12px 14px',
           border: 'none', borderBottom: '1px solid var(--pc-linea)', background: 'none', cursor: 'pointer',
           font: 'inherit', color: 'inherit' },
  avisoNuevo: { background: 'var(--pc-aqua-bg)' },
  icono: { width: 30, height: 30, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center',
           background: 'var(--pc-superficie-3)', color: 'var(--pc-gris-2)' },
  titulo: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--pc-tinta)', lineHeight: 1.35 },
  detalle: { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
             fontSize: 12.5, color: 'var(--pc-gris-2)', marginTop: 3, whiteSpace: 'pre-line', lineHeight: 1.4 },
  meta: { display: 'block', fontSize: 11.5, color: 'var(--pc-gris-3)', marginTop: 4 },
  noLeido: { width: 8, height: 8, borderRadius: '50%', background: C.aqua, flex: 'none', marginTop: 6 },
}
