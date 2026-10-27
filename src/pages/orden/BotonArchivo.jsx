import { useRef } from 'react'

// Botón que abre el selector de archivos del sistema.
export default function BotonArchivo({ children, accept, multiple, disabled, style, onArchivos }) {
  const input = useRef(null)
  return (
    <>
      <button type="button" style={style} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </button>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple}
        onChange={(e) => {
          const archivos = Array.from(e.target.files || [])
          e.target.value = ''
          if (archivos.length) onArchivos(archivos)
        }} />
    </>
  )
}
