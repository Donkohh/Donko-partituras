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
