/**
 * Normaliza una cadena de texto para comparaciones y búsquedas:
 * - Convierte a minúsculas
 * - Remueve diacríticos / tildes mediante NFD
 * - Elimina espacios sobrantes
 */
export function normalizarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Comprueba si un texto objetivo coincide con el término de búsqueda.
 */
export function coincideBusqueda(objetivo: string, termino: string): boolean {
  const normObjetivo = normalizarTexto(objetivo);
  const normTermino = normalizarTexto(termino);
  if (!normTermino) return true;
  return normObjetivo.includes(normTermino);
}
