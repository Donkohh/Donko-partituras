const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAGIC_BYTES_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export interface ResultadoValidacionPdf {
  valido: boolean;
  error?: string;
}

/**
 * Valida un archivo PDF en el cliente:
 * 1. Extensión .pdf
 * 2. MIME application/pdf
 * 3. Tamaño <= 50 MB
 * 4. Magic bytes: primeros 5 bytes "%PDF-"
 */
export async function validarArchivoPdf(archivo: File): Promise<ResultadoValidacionPdf> {
  // 1. Validar extensión
  if (!archivo.name.toLowerCase().endsWith('.pdf')) {
    return { valido: false, error: 'El archivo no tiene extensión .pdf' };
  }

  // 2. Validar tipo MIME si está presente
  if (archivo.type && archivo.type !== 'application/pdf') {
    return { valido: false, error: `Tipo MIME inválido: ${archivo.type}. Se requiere application/pdf` };
  }

  // 3. Validar tamaño máximo
  if (archivo.size > MAX_FILE_SIZE_BYTES) {
    const tamanoMb = (archivo.size / (1024 * 1024)).toFixed(1);
    return { valido: false, error: `El archivo supera los 50 MB permitidos (${tamanoMb} MB)` };
  }

  if (archivo.size < 5) {
    return { valido: false, error: 'El archivo está dañado o vacío' };
  }

  // 4. Validar Magic Bytes (%PDF-)
  try {
    const cabeceraSlice = archivo.slice(0, 5);
    const buffer = await cabeceraSlice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < MAGIC_BYTES_PDF.length; i++) {
      if (bytes[i] !== MAGIC_BYTES_PDF[i]) {
        return { valido: false, error: 'Firma de archivo inválida. No es un documento PDF legítimo' };
      }
    }
  } catch (err: unknown) {
    return { valido: false, error: 'No se pudo leer la firma del archivo PDF' };
  }

  return { valido: true };
}

/**
 * Limpia el nombre del archivo para generar el nombre visual inicial:
 * - Remueve la extensión .pdf
 * - Reemplaza guiones y guiones bajos por espacios
 * - Colapsa espacios múltiples y aplica trim
 */
export function limpiarNombreArchivo(nombreOriginal: string): string {
  return nombreOriginal
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
