export interface Partitura {
  id: string;
  nombre: string;
  archivo_path: string;
  hash_sha256: string;
  etiquetas: string[];
  tamano_bytes: number;
  creado_en: string;
}

export interface Carpeta {
  id: string;
  nombre: string;
  creado_en: string;
  cantidad_partituras?: number;
}

export interface PartituraCarpeta {
  partitura_id: string;
  carpeta_id: string;
}
