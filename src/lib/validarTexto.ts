/**
 * Límites y saneado centralizado de inputs de texto.
 * Los mismos límites se refuerzan en la BD mediante CHECK (ver schema.sql).
 */
export const LIMITES = {
  nombrePartitura: 255,
  nombreCarpeta: 100,
  etiqueta: 40,
  maxEtiquetas: 10,
  maxArchivosPorLote: 200,
} as const;

function colapsarEspacios(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

export function limpiarNombrePartitura(valor: string): string {
  return colapsarEspacios(valor).slice(0, LIMITES.nombrePartitura);
}

export function limpiarNombreCarpeta(valor: string): string {
  return colapsarEspacios(valor).slice(0, LIMITES.nombreCarpeta);
}

/**
 * Acepta una cadena separada por comas o un array y devuelve hasta 10 etiquetas
 * únicas de 40 caracteres como máximo, recortando espacios sobrantes.
 */
export function sanitizarEtiquetas(entrada: string | string[] | null | undefined): string[] {
  const crudas = Array.isArray(entrada) ? entrada : (entrada || '').split(',');
  const vistas = new Set<string>();
  const resultado: string[] = [];

  for (const cruda of crudas) {
    const etiqueta = colapsarEspacios(String(cruda)).slice(0, LIMITES.etiqueta);
    const clave = etiqueta.toLocaleLowerCase('es');
    if (!etiqueta || vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(etiqueta);
    if (resultado.length >= LIMITES.maxEtiquetas) break;
  }

  return resultado;
}

export function avisosSanitizacion(entrada: string | string[] | null | undefined): string[] {
  const crudas = Array.isArray(entrada) ? entrada : (entrada || '').split(',');
  const avisos: string[] = [];
  const etiquetasLargas = crudas.some((t) => colapsarEspacios(String(t)).length > LIMITES.etiqueta);
  const cantidad = crudas.filter((t) => colapsarEspacios(String(t)).length > 0).length;

  if (etiquetasLargas) avisos.push(`Las etiquetas se recortaron a ${LIMITES.etiqueta} caracteres.`);
  if (cantidad > LIMITES.maxEtiquetas) avisos.push(`Solo se permiten ${LIMITES.maxEtiquetas} etiquetas; se descartaron las restantes.`);
  return avisos;
}
