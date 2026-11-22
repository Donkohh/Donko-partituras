import { createClient } from '@supabase/supabase-js';
import type { Partitura, Carpeta } from './tipos';

const rawUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const rawKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(rawUrl && rawKey);

// Fallback para que el build estático no falle si aún no se ha colocado el archivo .env
const supabaseUrl = rawUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = rawKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function getPublicPdfUrl(archivoPath: string): string {
  if (!rawUrl || !archivoPath) return '#';
  return `${rawUrl}/storage/v1/object/public/partituras/${archivoPath}`;
}

// Caché en memoria durante la sesión del navegador
let cachePartituras: Partitura[] | null = null;
let cacheCarpetas: Carpeta[] | null = null;

export function invalidarCache() {
  cachePartituras = null;
  cacheCarpetas = null;
}

/**
 * Trae todas las partituras paginando con .range() (máximo 1000 por página)
 * y almacena en caché en memoria durante la sesión.
 */
export async function obtenerPartituras(forzarRecarga = false): Promise<Partitura[]> {
  if (cachePartituras && !forzarRecarga) {
    return cachePartituras;
  }

  if (!isSupabaseConfigured) {
    console.warn('Supabase URL o Anon Key no configuradas en el entorno');
    return [];
  }

  const todas: Partitura[] = [];
  const TAMANO_PAGINA = 1000;
  let desde = 0;
  let hayMas = true;

  while (hayMas) {
    const { data, error } = await supabase
      .from('partituras')
      .select('id, nombre, archivo_path, hash_sha256, etiquetas, tamano_bytes, creado_en')
      .order('nombre', { ascending: true })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      console.error('Error al obtener partituras:', error.message);
      throw error;
    }

    if (data && data.length > 0) {
      todas.push(...(data as Partitura[]));
      if (data.length < TAMANO_PAGINA) {
        hayMas = false;
      } else {
        desde += TAMANO_PAGINA;
      }
    } else {
      hayMas = false;
    }
  }

  cachePartituras = todas;
  return todas;
}

/**
 * Obtiene la lista de carpetas públicas y la cantidad de partituras asociadas a cada una.
 */
export async function obtenerCarpetas(forzarRecarga = false): Promise<Carpeta[]> {
  if (cacheCarpetas && !forzarRecarga) {
    return cacheCarpetas;
  }

  if (!isSupabaseConfigured) {
    return [];
  }

  const { data: carpetasData, error: errCarpetas } = await supabase
    .from('carpetas')
    .select('id, nombre, creado_en')
    .order('nombre', { ascending: true });

  if (errCarpetas) {
    console.error('Error al obtener carpetas:', errCarpetas.message);
    throw errCarpetas;
  }

  // Traer conteo de partituras por carpeta
  const { data: relaciones, error: errRelaciones } = await supabase
    .from('partitura_carpeta')
    .select('carpeta_id');

  if (errRelaciones) {
    console.warn('No se pudieron obtener relaciones partitura_carpeta:', errRelaciones.message);
  }

  const conteos: Record<string, number> = {};
  if (relaciones) {
    for (const rel of relaciones) {
      conteos[rel.carpeta_id] = (conteos[rel.carpeta_id] || 0) + 1;
    }
  }

  const resultado: Carpeta[] = (carpetasData || []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    creado_en: c.creado_en,
    cantidad_partituras: conteos[c.id] || 0,
  }));

  cacheCarpetas = resultado;
  return resultado;
}

/**
 * Obtiene las partituras pertenecientes a una carpeta específica por su ID.
 */
export async function obtenerPartiturasDeCarpeta(carpetaId: string): Promise<Partitura[]> {
  if (!isSupabaseConfigured || !carpetaId) return [];

  const { data, error } = await supabase
    .from('partitura_carpeta')
    .select('partituras(id, nombre, archivo_path, hash_sha256, etiquetas, tamano_bytes, creado_en)')
    .eq('carpeta_id', carpetaId);

  if (error) {
    console.error(`Error al obtener partituras de carpeta ${carpetaId}:`, error.message);
    throw error;
  }

  if (!data) return [];

  const lista: Partitura[] = [];
  for (const item of data) {
    if (item.partituras) {
      if (Array.isArray(item.partituras)) {
        lista.push(...(item.partituras as unknown as Partitura[]));
      } else {
        lista.push(item.partituras as unknown as Partitura);
      }
    }
  }

  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

/**
 * Obtiene todas las relaciones partitura_carpeta: mapa de partitura_id -> Set de carpeta_ids
 */
export async function obtenerMapaRelacionesCarpetas(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured) return {};

  const { data, error } = await supabase
    .from('partitura_carpeta')
    .select('partitura_id, carpeta_id');

  if (error) {
    console.error('Error al obtener mapa de carpetas:', error.message);
    return {};
  }

  const mapa: Record<string, string[]> = {};
  for (const item of data || []) {
    if (!mapa[item.partitura_id]) {
      mapa[item.partitura_id] = [];
    }
    mapa[item.partitura_id].push(item.carpeta_id);
  }
  return mapa;
}

// -------------------------------------------------------------
// FUNCIONES ADMINISTRATIVAS (Exigen rol admin vía RLS)
// -------------------------------------------------------------

/**
 * Actualiza ÚNICAMENTE el nombre visual y las etiquetas de una partitura.
 * El archivo PDF y su archivo_path nunca cambian.
 */
export async function actualizarPartitura(
  id: string,
  nombre: string,
  etiquetas: string[]
): Promise<void> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) throw new Error('El nombre de la partitura no puede estar vacío');

  const { error } = await supabase
    .from('partituras')
    .update({
      nombre: nombreLimpio,
      etiquetas,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Error al actualizar partitura: ${error.message}`);
  }

  invalidarCache();
}

/**
 * Elimina una partitura del general:
 * 1. Primero borra el objeto del storage.
 * 2. Luego borra la fila de la BD (el ON DELETE CASCADE la remueve de todas las carpetas).
 */
export async function eliminarPartitura(id: string, archivo_path: string): Promise<void> {
  // 1. Borrar de storage
  const { error: errStorage } = await supabase.storage
    .from('partituras')
    .remove([archivo_path]);

  if (errStorage) {
    console.warn('Advertencia al borrar de storage:', errStorage.message);
  }

  // 2. Borrar de base de datos
  const { error: errBD } = await supabase
    .from('partituras')
    .delete()
    .eq('id', id);

  if (errBD) {
    throw new Error(`Error al eliminar registro de BD: ${errBD.message}`);
  }

  invalidarCache();
}

/**
 * Eliminación masiva de partituras del general.
 */
export async function eliminarPartiturasMasivo(
  items: { id: string; archivo_path: string }[]
): Promise<void> {
  if (items.length === 0) return;

  const rutas = items.map((it) => it.archivo_path).filter(Boolean);
  const ids = items.map((it) => it.id);

  // 1. Borrar archivos del storage
  if (rutas.length > 0) {
    const { error: errStorage } = await supabase.storage
      .from('partituras')
      .remove(rutas);

    if (errStorage) {
      console.warn('Advertencia al borrar archivos de storage:', errStorage.message);
    }
  }

  // 2. Borrar registros de la base de datos
  const { error: errBD } = await supabase
    .from('partituras')
    .delete()
    .in('id', ids);

  if (errBD) {
    throw new Error(`Error al eliminar partituras de BD: ${errBD.message}`);
  }

  invalidarCache();
}

/**
 * Asigna una lista de partituras a una carpeta.
 */
export async function asignarPartiturasACarpeta(
  partituraIds: string[],
  carpetaId: string
): Promise<void> {
  if (partituraIds.length === 0 || !carpetaId) return;

  const registros = partituraIds.map((pId) => ({
    partitura_id: pId,
    carpeta_id: carpetaId,
  }));

  // Usar upsert para evitar errores de clave duplicada
  const { error } = await supabase
    .from('partitura_carpeta')
    .upsert(registros, { onConflict: 'partitura_id,carpeta_id', ignoreDuplicates: true });

  if (error) {
    throw new Error(`Error al asignar a carpeta: ${error.message}`);
  }

  invalidarCache();
}

/**
 * Quita una lista de partituras de una carpeta específica (sin borrarlas del general).
 */
export async function quitarPartiturasDeCarpeta(
  partituraIds: string[],
  carpetaId: string
): Promise<void> {
  if (partituraIds.length === 0 || !carpetaId) return;

  const { error } = await supabase
    .from('partitura_carpeta')
    .delete()
    .eq('carpeta_id', carpetaId)
    .in('partitura_id', partituraIds);

  if (error) {
    throw new Error(`Error al quitar de carpeta: ${error.message}`);
  }

  invalidarCache();
}

/**
 * Agrega etiquetas a múltiples partituras seleccionadas.
 */
export async function agregarEtiquetasMasivo(
  partituras: Partitura[],
  nuevasEtiquetas: string[]
): Promise<void> {
  if (partituras.length === 0 || nuevasEtiquetas.length === 0) return;

  for (const p of partituras) {
    const combinadas = Array.from(new Set([...(p.etiquetas || []), ...nuevasEtiquetas])).slice(0, 10);
    await supabase.from('partituras').update({ etiquetas: combinadas }).eq('id', p.id);
  }

  invalidarCache();
}

/**
 * Quita una etiqueta específica de múltiples partituras seleccionadas.
 */
export async function quitarEtiquetaMasivo(
  partituras: Partitura[],
  etiquetaAQuitar: string
): Promise<void> {
  if (partituras.length === 0 || !etiquetaAQuitar) return;

  for (const p of partituras) {
    const filtradas = (p.etiquetas || []).filter((t) => t !== etiquetaAQuitar);
    await supabase.from('partituras').update({ etiquetas: filtradas }).eq('id', p.id);
  }

  invalidarCache();
}

/**
 * Crea una nueva carpeta pública.
 */
export async function crearCarpeta(nombre: string): Promise<Carpeta> {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) throw new Error('El nombre de la carpeta no puede estar vacío');

  const { data, error } = await supabase
    .from('carpetas')
    .insert({ nombre: nombreLimpio })
    .select('id, nombre, creado_en')
    .single();

  if (error || !data) {
    throw new Error(`Error al crear carpeta: ${error?.message || 'Desconocido'}`);
  }

  invalidarCache();
  return { ...data, cantidad_partituras: 0 };
}

/**
 * Renombra una carpeta existente.
 */
export async function renombrarCarpeta(id: string, nuevoNombre: string): Promise<void> {
  const nombreLimpio = nuevoNombre.trim();
  if (!nombreLimpio) throw new Error('El nombre de la carpeta no puede estar vacío');

  const { error } = await supabase
    .from('carpetas')
    .update({ nombre: nombreLimpio })
    .eq('id', id);

  if (error) {
    throw new Error(`Error al renombrar carpeta: ${error.message}`);
  }

  invalidarCache();
}

/**
 * Elimina una carpeta.
 * IMPORTANTE: Nunca borra partituras, solo la carpeta y las referencias en partitura_carpeta.
 */
export async function eliminarCarpeta(id: string): Promise<void> {
  const { error } = await supabase
    .from('carpetas')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar carpeta: ${error.message}`);
  }

  invalidarCache();
}
