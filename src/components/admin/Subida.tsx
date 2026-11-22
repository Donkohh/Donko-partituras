import React, { useState, useEffect, useRef } from 'react';
import { supabase, obtenerCarpetas, invalidarCache } from '../../lib/supabase';
import { validarArchivoPdf, limpiarNombreArchivo } from '../../lib/validarPdf';
import { calcularSha256 } from '../../lib/hash';
import type { Carpeta } from '../../lib/tipos';

interface ArchivoEnCola {
  id: string;
  archivo: File;
  nombreVisual: string;
  hash?: string;
  estado: 'pendiente' | 'procesando' | 'subiendo' | 'completado' | 'duplicado' | 'error';
  mensajeError?: string;
  progreso: number;
}

interface ResumenSubida {
  total: number;
  exitosos: number;
  duplicados: { nombre: string; motivo: string }[];
  errores: { nombre: string; motivo: string }[];
}

const CONCURRENCIA_MAX = 3;

export const Subida: React.FC = () => {
  const [cola, setCola] = useState<ArchivoEnCola[]>([]);
  const [estaSubiendo, setEstaSubiendo] = useState(false);
  const [etiquetasLote, setEtiquetasLote] = useState<string>('');
  const [carpetasDisponibles, setCarpetasDisponibles] = useState<Carpeta[]>([]);
  const [carpetasSeleccionadas, setCarpetasSeleccionadas] = useState<string[]>([]);
  const [resumen, setResumen] = useState<ResumenSubida | null>(null);

  const canceladoRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar carpetas disponibles para asignación opcional
  useEffect(() => {
    obtenerCarpetas().then(setCarpetasDisponibles).catch(console.error);
  }, []);

  // Manejo de selección de archivos
  const agregarArchivos = (archivosNuevos: FileList | File[]) => {
    const lista = Array.from(archivosNuevos);
    const nuevosItems: ArchivoEnCola[] = lista.map((file) => ({
      id: crypto.randomUUID(),
      archivo: file,
      nombreVisual: limpiarNombreArchivo(file.name),
      estado: 'pendiente',
      progreso: 0,
    }));

    setCola((prev) => [...prev, ...nuevosItems]);
    setResumen(null);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      agregarArchivos(e.dataTransfer.files);
    }
  };

  // Limpiar cola
  const limpiarCola = () => {
    if (estaSubiendo) return;
    setCola([]);
    setResumen(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cancelar subida
  const cancelarSubida = () => {
    canceladoRef.current = true;
  };

  // Parsear y sanitizar etiquetas del lote (máx 10 etiquetas, máx 40 caracteres cada una)
  const sanitizarEtiquetas = (input: string): string[] => {
    const separadas = input
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => t.slice(0, 40));

    // Desduplicar y tomar máximo 10
    return Array.from(new Set(separadas)).slice(0, 10);
  };

  // Proceso principal de validación, hashes, desduplicación y subida
  const iniciarSubida = async () => {
    if (cola.length === 0 || estaSubiendo) return;

    setEstaSubiendo(true);
    canceladoRef.current = false;
    setResumen(null);

    const etiquetasFinales = sanitizarEtiquetas(etiquetasLote);
    const carpetasFinales = [...carpetasSeleccionadas];

    const duplicadosList: { nombre: string; motivo: string }[] = [];
    const erroresList: { nombre: string; motivo: string }[] = [];
    let exitososCount = 0;

    // FASE 1: Validar formato, magic bytes y calcular SHA-256
    const itemsProcesables: ArchivoEnCola[] = [];
    const hashesEnLote = new Set<string>();

    for (let i = 0; i < cola.length; i++) {
      if (canceladoRef.current) break;

      const item = cola[i];
      setCola((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, estado: 'procesando' } : it))
      );

      // Validar PDF
      const validacion = await validarArchivoPdf(item.archivo);
      if (!validacion.valido) {
        erroresList.push({ nombre: item.archivo.name, motivo: validacion.error || 'Inválido' });
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, estado: 'error', mensajeError: validacion.error }
              : it
          )
        );
        continue;
      }

      // Calcular Hash SHA-256
      try {
        const hash = await calcularSha256(item.archivo);
        item.hash = hash;

        // Verificar duplicado dentro del mismo lote
        if (hashesEnLote.has(hash)) {
          duplicadosList.push({
            nombre: item.archivo.name,
            motivo: 'Archivo duplicado dentro del mismo lote de subida',
          });
          setCola((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, estado: 'duplicado', mensajeError: 'Duplicado en el mismo lote', hash }
                : it
            )
          );
          continue;
        }

        hashesEnLote.add(hash);
        itemsProcesables.push(item);
      } catch (err) {
        erroresList.push({ nombre: item.archivo.name, motivo: 'Error al calcular hash' });
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, estado: 'error', mensajeError: 'Error al calcular SHA-256' } : it
          )
        );
      }
    }

    if (canceladoRef.current) {
      setEstaSubiendo(false);
      return;
    }

    // FASE 2: Consultar hashes en base de datos en bloques de 100
    const hashesParaConsultar = itemsProcesables.map((it) => it.hash!).filter(Boolean);
    const hashesExistentesBD = new Set<string>();

    const TAMANO_BLOQUE_HASH = 100;
    for (let i = 0; i < hashesParaConsultar.length; i += TAMANO_BLOQUE_HASH) {
      const bloque = hashesParaConsultar.slice(i, i + TAMANO_BLOQUE_HASH);
      const { data: partiturasExistentes, error: errHash } = await supabase
        .from('partituras')
        .select('hash_sha256, nombre')
        .in('hash_sha256', bloque);

      if (errHash) {
        console.error('Error al verificar duplicados en BD:', errHash.message);
      } else if (partiturasExistentes) {
        for (const p of partiturasExistentes) {
          hashesExistentesBD.add(p.hash_sha256);
        }
      }
    }

    // Filtrar los que ya existen en la base de datos
    const listosParaSubir: ArchivoEnCola[] = [];
    for (const item of itemsProcesables) {
      if (hashesExistentesBD.has(item.hash!)) {
        duplicadosList.push({
          nombre: item.archivo.name,
          motivo: 'Ya existe en el repertorio con el mismo contenido',
        });
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, estado: 'duplicado', mensajeError: 'Ya existe en el repertorio' }
              : it
          )
        );
      } else {
        listosParaSubir.push(item);
      }
    }

    // FASE 3: Subida con concurrencia limitada (máx 3 simultáneos)
    let indiceActual = 0;

    const subirArchivo = async (item: ArchivoEnCola) => {
      if (canceladoRef.current) return;

      setCola((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, estado: 'subiendo', progreso: 20 } : it))
      );

      const archivoUuid = crypto.randomUUID();
      const rutaStorage = `${archivoUuid}.pdf`;

      try {
        // 1. Subir archivo a Storage
        const { error: errStorage } = await supabase.storage
          .from('partituras')
          .upload(rutaStorage, item.archivo, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (errStorage) {
          throw new Error(`Error en storage: ${errStorage.message}`);
        }

        setCola((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, progreso: 65 } : it))
        );

        if (canceladoRef.current) {
          // Si se canceló justo al terminar storage, limpiar huérfano
          await supabase.storage.from('partituras').remove([rutaStorage]);
          return;
        }

        // 2. Insertar registro en BD
        const { data: partituraInsertada, error: errInsert } = await supabase
          .from('partituras')
          .insert({
            id: archivoUuid,
            nombre: item.nombreVisual,
            archivo_path: rutaStorage,
            hash_sha256: item.hash!,
            etiquetas: etiquetasFinales,
            tamano_bytes: item.archivo.size,
          })
          .select('id')
          .single();

        if (errInsert || !partituraInsertada) {
          // LIMPIEZA DE HUÉRFANO OBLIGATORIA
          console.warn('Fallo inserción en BD, borrando archivo huérfano del storage:', rutaStorage);
          await supabase.storage.from('partituras').remove([rutaStorage]);
          throw new Error(`Error al registrar en BD: ${errInsert?.message || 'Error desconocido'}`);
        }

        // 3. Asignar a carpetas si fueron seleccionadas
        if (carpetasFinales.length > 0) {
          const relaciones = carpetasFinales.map((cId) => ({
            partitura_id: partituraInsertada.id,
            carpeta_id: cId,
          }));

          const { error: errCarpetas } = await supabase
            .from('partitura_carpeta')
            .insert(relaciones);

          if (errCarpetas) {
            console.warn('Advertencia: no se pudo asociar a algunas carpetas:', errCarpetas.message);
          }
        }

        exitososCount++;
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, estado: 'completado', progreso: 100 } : it
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar subida';
        erroresList.push({ nombre: item.archivo.name, motivo: msg });
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, estado: 'error', mensajeError: msg, progreso: 0 } : it
          )
        );
      }
    };

    // Pool de concurrencia de máx 3 trabajadores
    const ejecutarPool = async () => {
      const trabajadores = Array.from({ length: CONCURRENCIA_MAX }).map(async () => {
        while (indiceActual < listosParaSubir.length && !canceladoRef.current) {
          const siguienteItem = listosParaSubir[indiceActual++];
          if (siguienteItem) {
            await subirArchivo(siguienteItem);
          }
        }
      });

      await Promise.all(trabajadores);
    };

    await ejecutarPool();

    // Invalidar caché de sesión para reflejar las nuevas partituras
    invalidarCache();

    setResumen({
      total: cola.length,
      exitosos: exitososCount,
      duplicados: duplicadosList,
      errores: erroresList,
    });

    setEstaSubiendo(false);
  };

  // Estadísticas globales de progreso
  const completados = cola.filter((c) => c.estado === 'completado').length;
  const porcentajeGlobal = cola.length > 0 ? Math.round((completados / cola.length) * 100) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Zona Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative border-2 border-dashed border-white/10 hover:border-[#f5b942]/40 rounded-2xl p-8 text-center bg-[#14141c] transition-all group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={(e) => e.target.files && agregarArchivos(e.target.files)}
          className="hidden"
          id="file-picker"
          disabled={estaSubiendo}
        />

        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-3xl mb-4 group-hover:scale-105 transition-transform">
            📄
          </div>

          <h3 className="text-lg font-semibold text-gray-200 mb-1">
            Arrastra tus partituras aquí o selecciónalas
          </h3>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            Sube desde 1 hasta 200 archivos PDF. Validaremos magic bytes (%PDF-), tamaño (≤50 MB) y
            desduplicación por hash SHA-256 automáticamente.
          </p>

          <label
            htmlFor="file-picker"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f5b942] to-[#e0a331] text-[#0a0a0f] font-semibold text-xs tracking-wide hover:opacity-90 cursor-pointer shadow-lg shadow-[#f5b942]/10 transition-all inline-block"
          >
            Seleccionar archivos PDF
          </label>
        </div>
      </div>

      {/* Opciones de Lote: Etiquetas y Carpetas */}
      {cola.length > 0 && (
        <div className="bg-[#14141c] border border-white/5 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Etiquetas para todo el lote (separadas por coma)
            </label>
            <input
              type="text"
              value={etiquetasLote}
              onChange={(e) => setEtiquetasLote(e.target.value)}
              placeholder="Adoración, Coral, Himnos..."
              disabled={estaSubiendo}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0f] border border-white/10 text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-[#f5b942]/50"
            />
            <span className="text-[11px] text-gray-500 mt-1 block">
              Máximo 10 etiquetas, hasta 40 caracteres cada una.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Asignar a carpetas (opcional)
            </label>
            {carpetasDisponibles.length === 0 ? (
              <span className="text-xs text-gray-500 italic block py-2">
                No hay carpetas creadas aún.
              </span>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1">
                {carpetasDisponibles.map((c) => {
                  const seleccionada = carpetasSeleccionadas.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={estaSubiendo}
                      onClick={() =>
                        setCarpetasSeleccionadas((prev) =>
                          seleccionada ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        )
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        seleccionada
                          ? 'bg-[#8b5cf6]/20 text-[#c4b5fd] border-[#8b5cf6]/50'
                          : 'bg-[#0a0a0f] text-gray-400 border-white/5 hover:border-white/20'
                      }`}
                    >
                      📁 {c.nombre} {seleccionada && '✓'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Barra de estado y acciones */}
      {cola.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#14141c] border border-white/5 rounded-2xl p-4">
          <div className="text-xs text-gray-300">
            <strong>{cola.length}</strong> {cola.length === 1 ? 'archivo en cola' : 'archivos en cola'}{' '}
            {estaSubiendo && (
              <span className="text-[#f5b942] ml-2">
                (Subiendo... {completados}/{cola.length} - {porcentajeGlobal}%)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {estaSubiendo ? (
              <button
                type="button"
                onClick={cancelarSubida}
                className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 text-xs font-medium transition-colors"
              >
                Cancelar subida
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={limpiarCola}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Limpiar lista
                </button>
                <button
                  type="button"
                  onClick={iniciarSubida}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#f5b942] to-[#e0a331] text-[#0a0a0f] font-semibold text-xs tracking-wide hover:opacity-90 transition-opacity shadow-md shadow-[#f5b942]/10"
                >
                  Subir {cola.length} {cola.length === 1 ? 'partitura' : 'partituras'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resumen Final */}
      {resumen && (
        <div className="p-6 rounded-2xl bg-[#14141c] border border-white/10 shadow-xl space-y-4">
          <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
            <span>📊</span>
            <span>Resumen de la subida</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
              ✓ Subidas exitosamente: <strong>{resumen.exitosos}</strong>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
              ⚠️ Omitidas por duplicadas: <strong>{resumen.duplicados.length}</strong>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 font-medium">
              ✕ Con error: <strong>{resumen.errores.length}</strong>
            </div>
          </div>

          {resumen.duplicados.length > 0 && (
            <div className="pt-2 text-xs">
              <span className="font-semibold text-gray-300 block mb-1">
                Archivos duplicados omitidos:
              </span>
              <ul className="list-disc list-inside space-y-1 text-gray-400 max-h-32 overflow-y-auto">
                {resumen.duplicados.map((d, i) => (
                  <li key={i}>
                    <strong className="text-gray-300">{d.nombre}</strong> — {d.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumen.errores.length > 0 && (
            <div className="pt-2 text-xs">
              <span className="font-semibold text-red-300 block mb-1">Archivos con error:</span>
              <ul className="list-disc list-inside space-y-1 text-red-400 max-h-32 overflow-y-auto">
                {resumen.errores.map((e, i) => (
                  <li key={i}>
                    <strong className="text-gray-300">{e.nombre}</strong>: {e.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Lista de Archivos en Cola */}
      {cola.length > 0 && (
        <div className="bg-[#14141c] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-xs font-medium text-gray-400">
            Archivos seleccionados
          </div>
          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {cola.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-200 truncate">{item.nombreVisual}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">
                      ({(item.archivo.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  {item.mensajeError && (
                    <span className="text-[11px] text-red-400 block">{item.mensajeError}</span>
                  )}
                  {item.estado === 'subiendo' && (
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-[#f5b942] h-full transition-all duration-200"
                        style={{ width: `${item.progreso}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {item.estado === 'pendiente' && (
                    <span className="px-2.5 py-1 rounded-md bg-white/5 text-gray-400 text-[11px]">
                      Pendiente
                    </span>
                  )}
                  {item.estado === 'procesando' && (
                    <span className="px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-300 text-[11px]">
                      Validando...
                    </span>
                  )}
                  {item.estado === 'subiendo' && (
                    <span className="px-2.5 py-1 rounded-md bg-[#f5b942]/10 text-[#f5b942] text-[11px] animate-pulse">
                      Subiendo...
                    </span>
                  )}
                  {item.estado === 'completado' && (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px]">
                      ✓ Listo
                    </span>
                  )}
                  {item.estado === 'duplicado' && (
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 text-[11px]">
                      Duplicado
                    </span>
                  )}
                  {item.estado === 'error' && (
                    <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-[11px]">
                      Error
                    </span>
                  )}

                  {!estaSubiendo && item.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => setCola((prev) => prev.filter((it) => it.id !== item.id))}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                      title="Eliminar de la cola"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
