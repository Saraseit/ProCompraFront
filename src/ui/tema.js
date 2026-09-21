// Los colores viven como variables CSS (definidas en index.css) para que el
// modo claro/oscuro cambie toda la interfaz con un solo atributo en <html>.
const v = (n) => `var(--pc-${n})`

export const C = {
  fondo: v('fondo'),
  tinta: v('tinta'),
  acento: v('acento'),
  borde: v('borde'),
  gris: v('gris'),
  aqua: v('aqua'),
  aquaBg: v('aqua-bg'),
  rojo: v('rojo'),
  rojoBg: v('rojo-bg'),
}
