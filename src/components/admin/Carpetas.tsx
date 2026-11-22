import React, { useState, useEffect, useMemo } from 'react';
import type { Carpeta, Partitura } from '../../lib/tipos';
import {
  obtenerCarpetas,
  obtenerPartituras,
  obtenerPartiturasDeCarpeta,
  crearCarpeta,
  renombrarCarpeta,
  eliminarCarpeta,
  asignarPartiturasACarpeta,
  quitarPartiturasDeCarpeta,
  getPublicPdfUrl,
} from '../../lib/supabase';
import { normalizarTexto } from '../../lib/normalizar';
import { useDebouncedValor, useEscape } from '../../lib/hooks';
import { LIMITES, limpiarNombreCarpeta } from '../../lib/validarTexto';

export const Carpetas: React.FC = () => {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ mensaje: string; tipo: 'ok' | 'error' } | null>(null);

  // Crear carpeta
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState('');
  const [creando, setCreando] = useState(false);

  // Renombrar carpeta
  const [carpetaARenombrar, setCarpetaARenombrar] = useState<Carpeta | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');

  // Eliminar carpeta
  const [carpetaAEliminar, setCarpetaAEliminar] = useState<Carpeta | null>(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Gestión de contenido de carpeta
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<Carpeta | null>(null);
  const [partiturasEnCarpeta, setPartiturasEnCarpeta] = useState<Partitura[]>([]);
  const [todasLasPartituras, setTodasLasPartituras] = useState<Partitura[]>([]);
  const [cargandoContenido, setCargandoContenido] = useState(false);
  const [errorContenido, setErrorContenido] = useState<string | null>(null);

  // Modal para agregar partituras a la carpeta seleccionada
  const [mostrarModalAgregar, setMostrarModalAgregar] = useState(false);
  const [busquedaModal, setBusquedaModal] = useState('');
  const busquedaModalDebounced = useDebouncedValor(busquedaModal, 100);
  const [seleccionadosParaAgregar, setSeleccionadosParaAgregar] = useState<Set<string>>(new Set());

  useEscape(Boolean(carpetaARenombrar), () => setCarpetaARenombrar(null));
  useEscape(Boolean(carpetaAEliminar), () => setCarpetaAEliminar(null));
  useEscape(mostrarModalAgregar, () => setMostrarModalAgregar(false));

  const notificar = (mensaje: string, tipo: 'ok' | 'error' = 'ok') => {
    setFeedback({ mensaje, tipo });
    window.setTimeout(() => setFeedback(null), 5000);
  };

  const cargarCarpetas = async (forzar = false) => {
    try {
      setCargando(true);
      setErrorCarga(null);
      const data = await obtenerCarpetas(forzar);
      setCarpetas(data);
    } catch (err) {
      console.error('Error al cargar carpetas:', err);
      setErrorCarga(err instanceof Error ? err.message : 'No se pudieron cargar las carpetas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCarpetas();
  }, []);

  // Cargar contenido de la carpeta activa
  const abrirGestionContenido = async (c: Carpeta) => {
    setCarpetaSeleccionada(c);
    try {
      setCargandoContenido(true);
      setErrorContenido(null);
      const [enCarpeta, todas] = await Promise.all([
        obtenerPartiturasDeCarpeta(c.id),
        obtenerPartituras(),
      ]);
      setPartiturasEnCarpeta(enCarpeta);
      setTodasLasPartituras(todas);
    } catch (err) {
      console.error(err);
      setErrorContenido(err instanceof Error ? err.message : 'No se pudo cargar el contenido de la carpeta');
    } finally {
      setCargandoContenido(false);
    }
  };

  // Crear carpeta
  const handleCrearCarpeta = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = limpiarNombreCarpeta(nombreNuevaCarpeta);
    if (!nombre) {
      notificar('El nombre de la carpeta no puede estar vacío.', 'error');
      return;
    }

    try {
      setCreando(true);
      const nueva = await crearCarpeta(nombre);
      setCarpetas((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setNombreNuevaCarpeta('');
      notificar(`Carpeta "${nueva.nombre}" creada.`);
    } catch (err: unknown) {
      notificar(err instanceof Error ? err.message : 'Error al crear carpeta', 'error');
    } finally {
      setCreando(false);
    }
  };

  // Renombrar carpeta
  const handleRenombrarCarpeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carpetaARenombrar) return;
    const nombre = limpiarNombreCarpeta(nuevoNombre);
    if (!nombre) {
      notificar('El nombre de la carpeta no puede estar vacío.', 'error');
      return;
    }

    try {
      setProcesandoAccion(true);
      await renombrarCarpeta(carpetaARenombrar.id, nombre);
      setCarpetas((prev) =>
        prev.map((c) => (c.id === carpetaARenombrar.id ? { ...c, nombre } : c))
      );
      if (carpetaSeleccionada?.id === carpetaARenombrar.id) {
        setCarpetaSeleccionada((prev) => (prev ? { ...prev, nombre } : null));
      }
      notificar('Carpeta renombrada con éxito.');
      setCarpetaARenombrar(null);
      setNuevoNombre('');
    } catch (err: unknown) {
      notificar(err instanceof Error ? err.message : 'Error al renombrar', 'error');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Eliminar carpeta
  const handleEliminarCarpeta = async () => {
    if (!carpetaAEliminar) return;

    try {
      setProcesandoAccion(true);
      await eliminarCarpeta(carpetaAEliminar.id);
      setCarpetas((prev) => prev.filter((c) => c.id !== carpetaAEliminar.id));
      if (carpetaSeleccionada?.id === carpetaAEliminar.id) {
        setCarpetaSeleccionada(null);
      }
      notificar(`Carpeta "${carpetaAEliminar.nombre}" eliminada. Ninguna partitura fue borrada.`);
      setCarpetaAEliminar(null);
    } catch (err: unknown) {
      notificar(err instanceof Error ? err.message : 'Error al eliminar carpeta', 'error');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Quitar partitura de la carpeta
  const handleQuitarDeCarpeta = async (partituraId: string, nombrePartitura: string) => {
    if (!carpetaSeleccionada) return;

    try {
      await quitarPartiturasDeCarpeta([partituraId], carpetaSeleccionada.id);
      setPartiturasEnCarpeta((prev) => prev.filter((p) => p.id !== partituraId));
      setCarpetas((prev) =>
        prev.map((c) =>
          c.id === carpetaSeleccionada.id
            ? { ...c, cantidad_partituras: Math.max(0, (c.cantidad_partituras || 1) - 1) }
            : c
        )
      );
      notificar(`"${nombrePartitura}" removida de la carpeta (sigue en el general).`);
    } catch (err: unknown) {
      notificar(err instanceof Error ? err.message : 'Error al quitar partitura', 'error');
    }
  };

  // Partituras disponibles para agregar a esta carpeta (que no estén ya añadidas)
  const partiturasDisponiblesParaAgregar = useMemo(() => {
    const idsEnCarpeta = new Set(partiturasEnCarpeta.map((p) => p.id));
    const disponibles = todasLasPartituras.filter((p) => !idsEnCarpeta.has(p.id));

    const bNorm = normalizarTexto(busquedaModalDebounced);
    if (!bNorm) return disponibles;

    return disponibles.filter(
      (p) =>
        normalizarTexto(p.nombre).includes(bNorm) ||
        p.etiquetas?.some((t) => normalizarTexto(t).includes(bNorm))
    );
  }, [partiturasEnCarpeta, todasLasPartituras, busquedaModalDebounced]);

  // Guardar partituras agregadas
  const handleGuardarPartiturasEnCarpeta = async () => {
    if (!carpetaSeleccionada || seleccionadosParaAgregar.size === 0) return;

    const ids = Array.from(seleccionadosParaAgregar);
    try {
      setProcesandoAccion(true);
      await asignarPartiturasACarpeta(ids, carpetaSeleccionada.id);
      const agregadas = todasLasPartituras.filter((p) => seleccionadosParaAgregar.has(p.id));
      setPartiturasEnCarpeta((prev) =>
        [...prev, ...agregadas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      );
      setCarpetas((prev) =>
        prev.map((c) =>
          c.id === carpetaSeleccionada.id
            ? { ...c, cantidad_partituras: (c.cantidad_partituras || 0) + ids.length }
            : c
        )
      );
      notificar(`${ids.length} partituras agregadas a "${carpetaSeleccionada.nombre}".`);
      setMostrarModalAgregar(false);
      setSeleccionadosParaAgregar(new Set());
      setBusquedaModal('');
    } catch (err: unknown) {
      notificar(err instanceof Error ? err.message : 'Error al asociar partituras', 'error');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // VISTA 1: DETALLE DE CONTENIDO DE UNA CARPETA
  if (carpetaSeleccionada) {
    return (
      <div className="space-y-6">
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium ${
              feedback.tipo === 'ok'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
            role={feedback.tipo === 'error' ? 'alert' : 'status'}
          >
            {feedback.tipo === 'ok' ? '✓' : '✕'} {feedback.mensaje}
          </div>
        )}

        <div className="bg-[#14141c] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCarpetaSeleccionada(null);
                cargarCarpetas(true);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>&larr;</span>
              <span>Volver a carpetas</span>
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                <span>📁</span>
                <span>{carpetaSeleccionada.nombre}</span>
              </h2>
              <span className="text-xs text-gray-400">
                {partiturasEnCarpeta.length}{' '}
                {partiturasEnCarpeta.length === 1 ? 'partitura en esta carpeta' : 'partituras en esta carpeta'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMostrarModalAgregar(true)}
            className="px-4 py-2 rounded-xl bg-[#f5b942] text-[#0a0a0f] font-semibold text-xs tracking-wide hover:opacity-90 transition-opacity flex items-center gap-1.5 self-start sm:self-auto shadow-md shadow-[#f5b942]/10"
          >
            <span>+</span>
            <span>Agregar partituras a esta carpeta</span>
          </button>
        </div>

        {/* Tabla de partituras en esta carpeta */}
        <div className="bg-[#14141c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#0a0a0f]/60 text-gray-400 font-medium">
                <th className="py-3 px-4">Nombre de la partitura</th>
                <th className="py-3 px-4">Etiquetas</th>
                <th className="py-3 px-4 w-24 text-right">PDF</th>
                <th className="py-3 px-4 w-32 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {cargandoContenido ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="py-4 px-4">
                      <div className="h-5 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : errorContenido ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-red-400">
                    No se pudo cargar el contenido: {errorContenido}
                  </td>
                </tr>
              ) : partiturasEnCarpeta.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    Esta carpeta está vacía. Haz clic en "Agregar partituras a esta carpeta" para asociar canciones.
                  </td>
                </tr>
              ) : (
                partiturasEnCarpeta.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-100 flex items-center gap-2">
                      <span className="text-gray-500">📄</span>
                      <span>{p.nombre}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.etiquetas && p.etiquetas.length > 0 ? (
                          p.etiquetas.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px]">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-[10px] italic">General</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={getPublicPdfUrl(p.archivo_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#f5b942] hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <span>Abrir</span>
                        <span className="text-[10px]">&nearr;</span>
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleQuitarDeCarpeta(p.id, p.nombre)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[11px] transition-colors"
                        title="Quitar solo de esta carpeta (no se borra del general)"
                      >
                        Quitar de carpeta
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* MODAL: Selector para agregar partituras a esta carpeta */}
        {mostrarModalAgregar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Agregar partituras a ${carpetaSeleccionada.nombre}`}
              className="bg-[#14141c] border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-base font-semibold text-gray-100 flex items-center gap-2">
                  <span>➕</span>
                  <span>Agregar partituras a "{carpetaSeleccionada.nombre}"</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarModalAgregar(false)}
                  className="text-gray-400 hover:text-white p-1"
                  aria-label="Cerrar selector de partituras"
                >
                  ✕
                </button>
              </div>

              {/* Buscador dentro del modal */}
              <input
                type="text"
                value={busquedaModal}
                onChange={(e) => setBusquedaModal(e.target.value)}
                aria-label="Buscar partituras para agregar a la carpeta"
                placeholder="Buscar por título o etiqueta en el repertorio..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0f] border border-white/10 text-white text-xs focus:outline-none focus:border-[#f5b942]"
              />

              {/* Lista seleccionable */}
              <div className="flex-1 overflow-y-auto divide-y divide-white/5 border border-white/5 rounded-xl bg-[#0a0a0f]/40 p-2 max-h-60">
                {partiturasDisponiblesParaAgregar.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-500">
                    No hay partituras disponibles para agregar con ese filtro.
                  </div>
                ) : (
                  partiturasDisponiblesParaAgregar.map((p) => {
                    const seleccionado = seleccionadosParaAgregar.has(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                          seleccionado ? 'bg-[#f5b942]/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() => {
                              setSeleccionadosParaAgregar((prev) => {
                                const n = new Set(prev);
                                if (n.has(p.id)) n.delete(p.id);
                                else n.add(p.id);
                                return n;
                              });
                            }}
                            className="rounded border-white/20 bg-[#14141c] text-[#f5b942] focus:ring-[#f5b942]"
                          />
                          <span className="text-xs text-gray-200 font-medium truncate">{p.nombre}</span>
                        </div>
                        {p.etiquetas && p.etiquetas.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {p.etiquetas.slice(0, 2).map((t) => (
                              <span key={t} className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Pie del modal */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xs text-gray-400">
                  {seleccionadosParaAgregar.size} seleccionadas
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarModalAgregar(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={procesandoAccion || seleccionadosParaAgregar.size === 0}
                    onClick={handleGuardarPartiturasEnCarpeta}
                    className="px-5 py-2 rounded-xl bg-[#f5b942] text-[#0a0a0f] font-semibold text-xs disabled:opacity-50"
                  >
                    {procesandoAccion ? 'Guardando...' : `Agregar ${seleccionadosParaAgregar.size} partituras`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VISTA 2: LISTA Y CRUD DE CARPETAS
  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium ${
            feedback.tipo === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
          role={feedback.tipo === 'error' ? 'alert' : 'status'}
        >
          {feedback.tipo === 'ok' ? '✓' : '✕'} {feedback.mensaje}
        </div>
      )}

      {errorCarga && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex flex-wrap items-center justify-between gap-2" role="alert">
          <span>No se pudieron cargar las carpetas: {errorCarga}</span>
          <button
            type="button"
            onClick={() => cargarCarpetas(true)}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-medium"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Formulario para Crear Carpeta */}
      <div className="bg-[#14141c] border border-white/5 rounded-2xl p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-100 mb-3 flex items-center gap-2">
          <span>📁</span>
          <span>Crear nueva carpeta</span>
        </h3>
        <form onSubmit={handleCrearCarpeta} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={nombreNuevaCarpeta}
            onChange={(e) => setNombreNuevaCarpeta(e.target.value)}
            maxLength={LIMITES.nombreCarpeta}
            aria-label="Nombre de la nueva carpeta"
            placeholder="Nombre de la carpeta (ej. Culto Domingo, Coral, Pascua)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/10 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-[#f5b942]"
          />
          <button
            type="submit"
            disabled={creando || !nombreNuevaCarpeta.trim()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f5b942] to-[#e0a331] text-[#0a0a0f] font-semibold text-xs tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {creando ? 'Creando...' : 'Crear carpeta'}
          </button>
        </form>
      </div>

      {/* Lista de Carpetas Existentes */}
      <div className="bg-[#14141c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-white/5 text-xs font-medium text-gray-400">
          Carpetas disponibles ({carpetas.length})
        </div>

        {cargando ? (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-xl" />
            ))}
          </div>
        ) : carpetas.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            Aún no has creado carpetas. Puedes crear una con el formulario de arriba.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {carpetas.map((c) => (
              <div
                key={c.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-xl shrink-0">
                    📁
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                      <span>{c.nombre}</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                        {c.cantidad_partituras || 0} partituras
                      </span>
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      Creada el {new Date(c.creado_en).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => abrirGestionContenido(c)}
                    className="px-3 py-1.5 rounded-xl bg-[#f5b942]/10 hover:bg-[#f5b942]/20 text-[#f5b942] border border-[#f5b942]/20 text-xs font-medium transition-colors"
                  >
                    Gestionar contenido &rarr;
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCarpetaARenombrar(c);
                      setNuevoNombre(c.nombre);
                    }}
                    title="Renombrar carpeta"
                    aria-label={`Renombrar carpeta ${c.nombre}`}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    onClick={() => setCarpetaAEliminar(c)}
                    title="Eliminar carpeta (no borra partituras)"
                    aria-label={`Eliminar carpeta ${c.nombre}`}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Renombrar carpeta */}
      {carpetaARenombrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Renombrar carpeta"
            className="bg-[#14141c] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-gray-100">Renombrar carpeta</h3>
            <form onSubmit={handleRenombrarCarpeta} className="space-y-4">
              <input
                type="text"
                required
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                maxLength={LIMITES.nombreCarpeta}
                aria-label="Nuevo nombre de la carpeta"
                placeholder="Nuevo nombre"
                className="w-full px-3.5 py-2 rounded-xl bg-[#0a0a0f] border border-white/10 text-white text-sm focus:outline-none focus:border-[#f5b942]"
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setCarpetaARenombrar(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAccion || !nuevoNombre.trim()}
                  className="px-5 py-2 rounded-xl bg-[#f5b942] text-[#0a0a0f] font-semibold text-xs disabled:opacity-50"
                >
                  {procesandoAccion ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación de carpeta */}
      {carpetaAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de carpeta"
            className="bg-[#14141c] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-xl mx-auto mb-3">
                📁
              </div>
              <h3 className="text-base font-semibold text-gray-100 mb-1">
                ¿Eliminar la carpeta "{carpetaAEliminar.nombre}"?
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Esta acción eliminará la carpeta organizadora. <strong className="text-gray-200">Ninguna partitura será borrada</strong> del repertorio general.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setCarpetaAEliminar(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={handleEliminarCarpeta}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs disabled:opacity-50"
              >
                {procesandoAccion ? 'Eliminando...' : 'Eliminar carpeta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
