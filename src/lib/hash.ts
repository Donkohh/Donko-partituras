/**
 * Calcula el hash criptográfico SHA-256 de un archivo en el cliente usando Web Crypto API.
 * Devuelve el hash como cadena hexadecimal en minúsculas.
 */
export async function calcularSha256(archivo: File): Promise<string> {
  const arrayBuffer = await archivo.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
