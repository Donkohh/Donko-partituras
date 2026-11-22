/**
 * Verifica (o actualiza con --fix) los hashes de la CSP de public/_headers.
 * Los hashes se calculan sobre el contenido inline exacto generado en dist/.
 * Ejecutar siempre después de `npm run build`:
 *   npm run verificar:csp
 *   npm run verificar:csp -- --fix
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const HEADERS_FILE = 'public/_headers';
const DIST_DIR = 'dist';
const arreglar = process.argv.includes('--fix');

function archivosHtml(directorio) {
  const encontrados = [];
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...archivosHtml(ruta));
    } else if (entrada.endsWith('.html')) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

function hashSha256Base64(texto) {
  return createHash('sha256').update(texto, 'utf8').digest('base64');
}

function hashesInline() {
  const scripts = new Set();
  const estilos = new Set(); // Se calculan por si en el futuro se endurece style-src.

  for (const archivo of archivosHtml(DIST_DIR)) {
    const html = readFileSync(archivo, 'utf8');
    for (const coincidencia of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      scripts.add(`sha256-${hashSha256Base64(coincidencia[1])}`);
    }
    for (const coincidencia of html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)) {
      estilos.add(`sha256-${hashSha256Base64(coincidencia[1])}`);
    }
  }

  return { scripts: [...scripts].sort(), estilos: [...estilos].sort() };
}

function reconstruirDirectiva(directiva, hashes) {
  const partes = directiva.trim().split(/\s+/);
  const nombre = partes[0];
  // 'unsafe-inline' nunca debe aparecer en script-src; se elimina también aquí.
  const base = partes.slice(1).filter(
    (parte) => !parte.startsWith("'sha256-") && !(nombre === 'script-src' && parte === "'unsafe-inline'")
  );
  return [nombre, ...base, ...hashes.map((hash) => `'${hash}'`)].join(' ');
}

const contenido = readFileSync(HEADERS_FILE, 'utf8');
const salto = contenido.includes('\r\n') ? '\r\n' : '\n';
const lineas = contenido.split(/\r?\n/);
const indiceCsp = lineas.findIndex((linea) => linea.trimStart().startsWith('Content-Security-Policy:'));

if (indiceCsp === -1) {
  console.error(`No se encontró la directiva Content-Security-Policy en ${HEADERS_FILE}`);
  process.exit(1);
}

const { scripts } = hashesInline();
const prefijo = lineas[indiceCsp].slice(0, lineas[indiceCsp].indexOf(':') + 1);
const directivas = lineas[indiceCsp].slice(lineas[indiceCsp].indexOf(':') + 1).trim().split(';').map((d) => d.trim()).filter(Boolean);

let encontroScriptSrc = false;
const directivasActualizadas = directivas.map((directiva) => {
  if (directiva.startsWith('script-src')) {
    encontroScriptSrc = true;
    return reconstruirDirectiva(directiva, scripts);
  }
  return directiva;
});

if (!encontroScriptSrc) {
  console.error('La CSP no contiene script-src.');
  process.exit(1);
}

const lineaEsperada = `${prefijo} ${directivasActualizadas.join('; ')}`;

if (arreglar) {
  lineas[indiceCsp] = lineaEsperada;
  writeFileSync(HEADERS_FILE, lineas.join(salto), 'utf8');
  if (existsSync(join(DIST_DIR, '_headers'))) {
    writeFileSync(join(DIST_DIR, '_headers'), lineas.join(salto), 'utf8');
  }
  console.log(`CSP actualizada en ${HEADERS_FILE} y ${DIST_DIR}/_headers con ${scripts.length} hash(es) de script.`);
  process.exit(0);
}

if (lineas[indiceCsp] !== lineaEsperada) {
  console.error('La CSP de public/_headers no coincide con los scripts inline generados en dist/.');
  console.error('Ejecuta: npm run verificar:csp -- --fix');
  console.error('Hashes esperados:', scripts.join(', '));
  process.exit(1);
}

console.log(`CSP correcta: script-src sin 'unsafe-inline' y ${scripts.length} hash(es) vigentes.`);
