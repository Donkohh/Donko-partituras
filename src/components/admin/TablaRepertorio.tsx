import React, { useState, useEffect, useMemo } from 'react';
import type { Partitura, Carpeta } from '../../lib/tipos';
import {
  obtenerPartituras,
  obtenerCarpetas,
  obtenerMapaRelacionesCarpetas,
  actualizarPartitura,
  eliminarPartitura,
  eliminarPartiturasMasivo,
  asignarPartiturasACarpeta,
  quitarPartiturasDeCarpeta,
  agregarEtiquetasMasivo,
  quitarEtiquetaMasivo,
  getPublicPdfUrl,
} from '../../lib/supabase';
import { normalizarTexto } from '../../lib/normalizar';
import { SelectorCarpeta } from './SelectorCarpeta';

export const TablaRepertorio: React.FC = () => {
  const [partituras, setPartituras] = useState<Partitura[]>([]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [mapaCarpetas, setMapaCarpetas] = useState<Record<string, string[]>>({});
  const [cargando, setCargando] = useState(true);
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string>('todas');

  // Selección múltiple
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // Edición inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdicion, setNombreEdicion] = useState('');
  const [etiquetasEdicion, setEtiquetasEdicion] = useState('');

  // Modales y diálogos
  const [mostrarSelectorCarpeta, setMostrarSelectorCarpeta] = useState(false);
  const [mostrarQuitarDeCarpeta, setMostrarQuitarDeCarpeta] = useState(false);
  const [mostrarModalEtiquetas, setMostrarModalEtiquetas] = useState(false);
  const [nuevasEtiquetasMasivo, setNuevasEtiquetasMasivo] = useState('');
  const [partituraAEliminar, setPartituraAEliminar] = useState<Partitura | null>(null);
  const [confirmarEliminarMasivo, setConfirmarEliminarMasivo] = useState(false);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Cargar datos
  const cargarTodo = async (forzar = false) => {
    try {
      setCargando(true);
      const [pts, crps, mapa] = await Promise.all([
        obtenerPartituras(forzar),
        obtenerCarpetas(forzar),
        obtenerMapaRelacionesCarpetas(),
      ]);
      setPartituras(pts);
      setCarpetas(crps);
      setMapaCarpetas(mapa);
    } catch (err) {
      console.error('Error al cargar datos del repertorio:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const notificar = (msg: string) => {
    setMensajeFeedback(msg);
    setTimeout(() => setMensajeFeedback(null), 4000);
  };

  // Extraer todas las etiquetas para el filtro
  const todasLasEtiquetas = useMemo(() => {
    const setTags = new Set<string>();
    for (const p of partituras) {
      for (const t of p.etiquetas || []) {
        if (t.trim()) setTags.add(t.trim());
      }
    }
    return Array.from(setTags).sort((a, b) => a.localeCompare(b, 'es'));
  }, [partituras]);

  // Filtrado
  const partiturasFiltradas = useMemo(() => {
    const bNorm = normalizarTexto(busqueda);
    return partituras.filter((p) => {
      if (etiquetaFiltro !== 'todas') {
        if (!p.etiquetas?.includes(etiquetaFiltro)) return false;
      }
      if (bNorm) {
        const nombreNorm = normalizarTexto(p.nombre);
        const matchTags = p.etiquetas?.some((t) => normalizarTexto(t).includes(bNorm));
        if (!nombreNorm.includes(bNorm) && !matchTags) return false;
      }
      return true;
    });
  }, [partituras, busqueda, etiquetaFiltro]);

  // Selección
  const todosSeleccionados =
    partiturasFiltradas.length > 0 &&
    partiturasFiltradas.every((p) => seleccionados.has(p.id));

  const alternarSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(new Set());
    } else {
      const nuevoSet = new Set(seleccionados);
      for (const p of partiturasFiltradas) {
        nuevoSet.add(p.id);
      }
      setSeleccionados(nuevoSet);
    }
  };

  const alternarSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  // Iniciar edición inline
  const comenzarEdicion = (p: Partitura) => {
    setEditandoId(p.id);
    setNombreEdicion(p.nombre);
    setEtiquetasEdicion((p.etiquetas || []).join(', '));
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setNombreEdicion('');
    setEtiquetasEdicion('');
  };

  const guardarEdicion = async (id: string) => {
    const tags = etiquetasEdicion
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => t.slice(0, 40))
      .slice(0, 10);

    try {
      setProcesandoAccion(true);
      await actualizarPartitura(id, nombreEdicion, tags);
      setPartituras((prev) =>
        prev.map((p) => (p.id === id ? { ...p, nombre: nombreEdicion.trim(), etiquetas: tags } : p))
      );
      cancelarEdicion();
      notificar('Partitura actualizada correctamente.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Eliminar individual
  const ejecutarEliminacionIndividual = async () => {
    if (!partituraAEliminar) return;
    try {
      setProcesandoAccion(true);
      await eliminarPartitura(partituraAEliminar.id, partituraAEliminar.archivo_path);
      setPartituras((prev) => prev.filter((p) => p.id !== partituraAEliminar.id));
      setSeleccionados((prev) => {
        const n = new Set(prev);
        n.delete(partituraAEliminar.id);
        return n;
      });
      notificar(`"${partituraAEliminar.nombre}" eliminada del repertorio y del storage.`);
      setPartituraAEliminar(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Eliminar masivo
  const ejecutarEliminacionMasiva = async () => {
    const itemsAEliminar = partituras.filter((p) => seleccionados.has(p.id));
    if (itemsAEliminar.length === 0) return;

    try {
      setProcesandoAccion(true);
      await eliminarPartiturasMasivo(itemsAEliminar);
      setPartituras((prev) => prev.filter((p) => !seleccionados.has(p.id)));
      notificar(`${itemsAEliminar.length} partituras eliminadas del repertorio y del storage.`);
      setSeleccionados(new Set());
      setConfirmarEliminarMasivo(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error en eliminación masiva');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Asignar masivo a carpeta
  const handleAsignarACarpeta = async (carpetaId: string) => {
    const ids = Array.from(seleccionados);
    await asignarPartiturasACarpeta(ids, carpetaId);
    notificar(`${ids.length} partituras asignadas a la carpeta.`);
    setSeleccionados(new Set());
    cargarTodo(true);
  };

  // Quitar masivo de carpeta
  const handleQuitarDeCarpeta = async (carpetaId: string) => {
    const ids = Array.from(seleccionados);
    await quitarPartiturasDeCarpeta(ids, carpetaId);
    notificar(`${ids.length} partituras removidas de la carpeta.`);
    setSeleccionados(new Set());
    setMostrarQuitarDeCarpeta(false);
    cargarTodo(true);
  };

  // Agregar etiquetas masivo
  const handleAgregarEtiquetasMasivo = async () => {
    const tags = nuevasEtiquetasMasivo
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;

    const items = partituras.filter((p) => seleccionados.has(p.id));
    try {
      setProcesandoAccion(true);
      await agregarEtiquetasMasivo(items, tags);
      notificar(`Etiquetas agregadas a ${items.length} partituras.`);
      setMostrarModalEtiquetas(false);
      setNuevasEtiquetasMasivo('');
      setSeleccionados(new Set());
      cargarTodo(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al agregar etiquetas');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Obtener nombres de carpetas a las que pertenece una partitura
  const carpetasDePartitura = (pId: string) => {
    const ids = mapaCarpetas[pId] || [];
    return carpetas.filter((c) => ids.includes(c.id));
  };

  return (
    <div className="space-y-6">
      {/* Mensaje de feedback flotante */}
      {mensajeFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between">
          <span>✓ {mensajeFeedback}</span>
          <button type="button" onClick={() => setMensajeFeedback(null)} className="text-emerald-400">
            ✕
          </button>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros */}
      <div className="bg-[#14141c] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-96 relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título o etiqueta..."
            className="w-full pl-9 pr-4 py-2 bg-[#0a0a0f] border border-white/10 rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#f5b942]/60"
          />
          <span className="absolute left-3 top-2.5 text-gray-500 text-xs">🔍</span>
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-2 text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Etiqueta:</span>
            <select
              value={etiquetaFiltro}
              onChange={(e) => setEtiquetaFiltro(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#0a0a0f] border border-white/10 text-xs text-gray-200 focus:outline-none focus:border-[#f5b942]/60"
            >
              <option value="todas">Todas las etiquetas</option>
              {todasLasEtiquetas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => cargarTodo(true)}
            title="Recargar datos"
            className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors text-xs"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Barra de Acciones Masivas (visible cuando hay selección) */}
      {seleccionados.size > 0 && (
        <div className="bg-[#1a1a24] border border-[#f5b942]/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#f5b942]">
            <span>{seleccionados.size}</span>
            <span>{seleccionados.size === 1 ? 'partitura seleccionada' : 'partituras seleccionadas'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarSelectorCarpeta(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>📁</span>
              <span>Asignar a carpeta</span>
            </button>

            <button
              type="button"
              onClick={() => setMostrarQuitarDeCarpeta(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>📂</span>
              <span>Quitar de carpeta</span>
            </button>

            <button
              type="button"
              onClick={() => setMostrarModalEtiquetas(true)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>🏷️</span>
              <span>Agregar etiquetas</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmarEliminarMasivo(true)}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>🗑️</span>
              <span>Eliminar seleccionadas</span>
            </button>

            <button
              type="button"
              onClick={() => setSeleccionados(new Set())}
              className="px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white text-xs"
            >
              Deseleccionar
            </button>
          </div>
        </div>
      )}

      {/* Tabla del Repertorio */}
      <div className="bg-[#14141c] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#0a0a0f]/60 text-gray-400 font-medium">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={todosSeleccionados}
                    onChange={alternarSeleccionarTodos}
                    aria-label="Seleccionar todo lo filtrado"
                    className="rounded border-white/20 bg-[#14141c] text-[#f5b942] focus:ring-[#f5b942] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Nombre de la partitura</th>
                <th className="py-3 px-4">Etiquetas</th>
                <th className="py-3 px-4">Carpetas</th>
                <th className="py-3 px-4 w-24 text-right">PDF</th>
                <th className="py-3 px-4 w-32 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {cargando ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-5 bg-white/5 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : partiturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No se encontraron partituras en el repertorio.
                  </td>
                </tr>
              ) : (
                partiturasFiltradas.map((p) => {
                  const estaSeleccionado = seleccionados.has(p.id);
                  const estaEditando = editandoId === p.id;
                  const carpetasAsoc = carpetasDePartitura(p.id);

                  if (estaEditando) {
                    return (
                      <tr key={p.id} className="bg-[#1a1a24] border-l-2 border-[#f5b942]">
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={nombreEdicion}
                            onChange={(e) => setNombreEdicion(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0a0f] border border-white/20 text-white text-xs focus:outline-none focus:border-[#f5b942]"
                            placeholder="Nombre de la partitura"
                          />
                        </td>
                        <td className="py-3 px-4" colSpan={2}>
                          <input
                            type="text"
                            value={etiquetasEdicion}
                            onChange={(e) => setEtiquetasEdicion(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0a0f] border border-white/20 text-white text-xs focus:outline-none focus:border-[#f5b942]"
                            placeholder="Etiquetas separadas por coma..."
                          />
                        </td>
                        <td className="py-3 px-4 text-right" colSpan={2}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={procesandoAccion}
                              onClick={() => guardarEdicion(p.id)}
                              className="px-3 py-1 rounded-lg bg-[#f5b942] text-[#0a0a0f] font-semibold hover:opacity-90 text-xs"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={cancelarEdicion}
                              className="px-3 py-1 rounded-lg bg-white/10 text-gray-300 hover:text-white text-xs"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        estaSeleccionado ? 'bg-[#f5b942]/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={estaSeleccionado}
                          onChange={() => alternarSeleccion(p.id)}
                          className="rounded border-white/20 bg-[#14141c] text-[#f5b942] focus:ring-[#f5b942] cursor-pointer"
                        />
                      </td>

                      {/* Nombre */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-100 flex items-center gap-2">
                          <span className="text-gray-500">📄</span>
                          <span className="truncate max-w-xs md:max-w-md">{p.nombre}</span>
                        </div>
                      </td>

                      {/* Etiquetas */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.etiquetas && p.etiquetas.length > 0 ? (
                            p.etiquetas.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 text-[10px]"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 text-[10px] italic">General</span>
                          )}
                        </div>
                      </td>

                      {/* Carpetas asociadas */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {carpetasAsoc.length > 0 ? (
                            carpetasAsoc.map((c) => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded-md bg-[#8b5cf6]/15 text-[#c4b5fd] text-[10px] border border-[#8b5cf6]/20"
                              >
                                📁 {c.nombre}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-600 text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Enlace PDF en pestaña nueva */}
                      <td className="py-3 px-4 text-right">
                        <a
                          href={getPublicPdfUrl(p.archivo_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#f5b942] hover:underline inline-flex items-center gap-1 font-medium"
                          title="Abrir en pestaña nueva con visor nativo"
                        >
                          <span>Abrir</span>
                          <span className="text-[10px]">&nearr;</span>
                        </a>
                      </td>

                      {/* Acciones individuales */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => comenzarEdicion(p)}
                            title="Editar nombre y etiquetas"
                            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-[#f5b942] transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => setPartituraAEliminar(p)}
                            title="Eliminar del general y de todas las carpetas"
                            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de tabla con total */}
        <div className="px-4 py-3 bg-[#0a0a0f]/40 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
          <span>
            Total: <strong>{partiturasFiltradas.length}</strong> partituras filtradas (de {partituras.length} en total)
          </span>
          {seleccionados.size > 0 && (
            <span className="text-[#f5b942]">
              {seleccionados.size} seleccionadas
            </span>
          )}
        </div>
      </div>

      {/* MODAL: Asignar a carpeta */}
      {mostrarSelectorCarpeta && (
        <SelectorCarpeta
          carpetas={carpetas}
          titulo="Asignar seleccionadas a carpeta"
          accionTexto="Asignar"
          onCerrar={() => setMostrarSelectorCarpeta(false)}
          onSeleccionar={handleAsignarACarpeta}
        />
      )}

      {/* MODAL: Quitar de carpeta */}
      {mostrarQuitarDeCarpeta && (
        <SelectorCarpeta
          carpetas={carpetas}
          titulo="Quitar seleccionadas de carpeta"
          accionTexto="Quitar de carpeta"
          onCerrar={() => setMostrarQuitarDeCarpeta(false)}
          onSeleccionar={handleQuitarDeCarpeta}
        />
      )}

      {/* MODAL: Agregar etiquetas masivo */}
      {mostrarModalEtiquetas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14141c] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-100 flex items-center gap-2">
              <span>🏷️</span>
              <span>Agregar etiquetas a {seleccionados.size} partituras</span>
            </h3>
            <p className="text-xs text-gray-400">
              Ingresa las etiquetas separadas por comas. Se agregarán a las etiquetas ya existentes de cada partitura.
            </p>
            <input
              type="text"
              value={nuevasEtiquetasMasivo}
              onChange={(e) => setNuevasEtiquetasMasivo(e.target.value)}
              placeholder="Adoración, Coral, Navidad..."
              className="w-full px-3 py-2 rounded-xl bg-[#0a0a0f] border border-white/10 text-white text-xs focus:outline-none focus:border-[#f5b942]"
            />
            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setMostrarModalEtiquetas(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAgregarEtiquetasMasivo}
                disabled={procesandoAccion || !nuevasEtiquetasMasivo.trim()}
                className="px-5 py-2 rounded-xl bg-[#f5b942] text-[#0a0a0f] font-semibold text-xs disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación individual */}
      {partituraAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14141c] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-gray-100 mb-1">
                ¿Eliminar partitura del general?
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Esta acción borrará permanentemente <strong className="text-gray-200">"{partituraAEliminar.nombre}"</strong> del almacenamiento en Storage, de la base de datos y de todas las carpetas donde esté agregada.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setPartituraAEliminar(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:text-white text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={ejecutarEliminacionIndividual}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs tracking-wide disabled:opacity-50"
              >
                {procesandoAccion ? 'Eliminando...' : 'Sí, eliminar permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar eliminación masiva */}
      {confirmarEliminarMasivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14141c] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-gray-100 mb-1">
                ¿Eliminar {seleccionados.size} partituras del general?
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Esta acción es irreversible: se borrarán los archivos físicos de Storage y sus filas en la base de datos.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setConfirmarEliminarMasivo(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:text-white text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={ejecutarEliminacionMasiva}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs tracking-wide disabled:opacity-50"
              >
                {procesandoAccion ? 'Eliminando...' : `Eliminar ${seleccionados.size} partituras`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
