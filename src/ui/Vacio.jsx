// Estado vacío: ícono en círculo, título, explicación y acción opcional.
export default function Vacio({ icono: Icono, titulo, children, accion, compacto, style }) {
  return (
    <div style={{ ...s.caja, ...(compacto ? s.compacto : {}), ...style }}>
      {Icono && (
        <div style={s.circulo}><Icono size={compacto ? 20 : 24} strokeWidth={1.7} /></div>
      )}
      <div style={s.titulo}>{titulo}</div>
      {children && <div style={s.texto}>{children}</div>}
      {accion && <div style={{ marginTop: 16 }}>{accion}</div>}
    </div>
  )
}

const s = {
  caja: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          padding: '48px 24px', color: 'var(--pc-gris)' },
  compacto: { padding: '28px 20px' },
  circulo: { width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center',
             background: 'var(--pc-aqua-bg)', color: 'var(--pc-aqua)', marginBottom: 14 },
  titulo: { fontSize: 15.5, fontWeight: 650, color: 'var(--pc-tinta)' },
  texto: { fontSize: 13.5, marginTop: 4, maxWidth: 420, lineHeight: 1.5 },
}
