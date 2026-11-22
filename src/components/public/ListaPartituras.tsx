import React, { useState, useEffect, useMemo } from 'react';
import type { Partitura } from '../../lib/tipos';
import { obtenerPartituras } from '../../lib/supabase';
import { normalizarTexto } from '../../lib/normalizar';
import { Buscador } from './Buscador';
import { Chips } from './Chips';
import { Tarjeta } from './Tarjeta';

interface ListaPartiturasProps {
  partiturasIniciales?: Partitura[];
  mostrarChips?: boolean;
}

type TipoOrden = 'az' | 'za' | 'recientes';

const POR_PAGINA = 36;

export const ListaPartituras: React.FC<ListaPartiturasProps> = ({
  partiturasIniciales,
  mostrarChips = true,
}) => {
  const [partituras, setPartituras] = useState<Partitura[]>(partiturasIniciales || []);
  const [cargando, setCargando] = useState(!partiturasIniciales);
  const [error, setError] = useState<string | null>(null);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [orden, setOrden] = useState<TipoOrden>('az');
  const [limiteVisible, setLimiteVisible] = useState(POR_PAGINA);

  // Carga inicial si no vienen precargadas
  useEffect(() => {
    if (partiturasIniciales) {
      setPartituras(partiturasIniciales);
      setCargando(false);
      return;
    }

    let cancelado = false;
    const cargar = async () => {
      try {
        setCargando(true);
        setError(null);
        const datos = await obtenerPartituras();
        if (!cancelado) {
          setPartituras(datos);
        }
      } catch (err: unknown) {
        if (!cancelado) {
          const mensaje = err instanceof Error ? err.message : 'Error al conectar con la base de datos';
          setError(mensaje);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [partiturasIniciales]);

  // Extraer todas las etiquetas únicas
  const todasLasEtiquetas = useMemo(() => {
    const setTags = new Set<string>();
    for (const p of partituras) {
      if (p.etiquetas && Array.isArray(p.etiquetas)) {
        for (const t of p.etiquetas) {
          const limpia = t.trim();
          if (limpia) setTags.add(limpia);
        }
      }
    }
    return Array.from(setTags).sort((a, b) => a.localeCompare(b, 'es'));
  }, [partituras]);

  // Alternar selección de etiquetas
  const alternarEtiqueta = (tag: string) => {
    setEtiquetasSeleccionadas((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setLimiteVisible(POR_PAGINA);
  };

  const limpiarEtiquetas = () => {
    setEtiquetasSeleccionadas([]);
    setLimiteVisible(POR_PAGINA);
  };

  // Filtrado y ordenación
  const partiturasFiltradas = useMemo(() => {
    const terminoNorm = normalizarTexto(terminoBusqueda);

    return partituras
      .filter((p) => {
        // Filtro por etiquetas (debe tener al menos una de las etiquetas seleccionadas)
        if (etiquetasSeleccionadas.length > 0) {
          const tieneAlguna = p.etiquetas?.some((tag) =>
            etiquetasSeleccionadas.includes(tag)
          );
          if (!tieneAlguna) return false;
        }

        // Filtro por texto de búsqueda (nombre y etiquetas)
        if (terminoNorm) {
          const nombreNorm = normalizarTexto(p.nombre);
          const coincideNombre = nombreNorm.includes(terminoNorm);
          const coincideEtiquetas = p.etiquetas?.some((t) =>
            normalizarTexto(t).includes(terminoNorm)
          );
          if (!coincideNombre && !coincideEtiquetas) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (orden === 'az') {
          return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        }
        if (orden === 'za') {
          return b.nombre.localeCompare(a.nombre, 'es', { sensitivity: 'base' });
        }
        if (orden === 'recientes') {
          const fechaA = new Date(a.creado_en).getTime() || 0;
          const fechaB = new Date(b.creado_en).getTime() || 0;
          return fechaB - fechaA;
        }
        return 0;
      });
  }, [partituras, terminoBusqueda, etiquetasSeleccionadas, orden]);

  // Resetear límite visible cuando cambia la búsqueda
  const handleCambioBusqueda = (val: string) => {
    setTerminoBusqueda(val);
    setLimiteVisible(POR_PAGINA);
  };

  const partiturasAMostrar = partiturasFiltradas.slice(0, limiteVisible);
  const hayMasParaCargar = limiteVisible < partiturasFiltradas.length;

  return (
    <div className="w-full">
      {/* Buscador y Controles */}
      <Buscador
        valor={terminoBusqueda}
        onCambio={handleCambioBusqueda}
        totalResultados={cargando ? undefined : partiturasFiltradas.length}
      />

      {/* Filtro por etiquetas */}
      {mostrarChips && (
        <Chips
          todasLasEtiquetas={todasLasEtiquetas}
          etiquetasSeleccionadas={etiquetasSeleccionadas}
          onAlternarEtiqueta={alternarEtiqueta}
          onLimpiarEtiquetas={limpiarEtiquetas}
        />
      )}

      {/* Barra de opciones de ordenación y conteo */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 my-6 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
        <div>
          {!cargando && (
            <span>
              Mostrando <strong className="text-gray-200">{partiturasAMostrar.length}</strong> de{' '}
              <strong className="text-gray-200">{partiturasFiltradas.length}</strong> partituras
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="orden-select" className="text-gray-500">
            Ordenar por:
          </label>
          <select
            id="orden-select"
            value={orden}
            onChange={(e) => setOrden(e.target.value as TipoOrden)}
            className="bg-[#14141c] border border-white/10 rounded-lg px-2.5 py-1 text-gray-200 focus:outline-none focus:border-[#f5b942]/50 text-xs"
          >
            <option value="az">Alfabético (A - Z)</option>
            <option value="za">Alfabético (Z - A)</option>
            <option value="recientes">Más recientes</option>
          </select>
        </div>
      </div>

      {/* Estados: Cargando / Error / Vacío / Lista */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-16">
        {cargando ? (
          /* Skeletons de carga */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-36 rounded-xl bg-[#14141c]/60 border border-white/5 p-5 flex flex-col justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/5 rounded w-3/4" />
                    <div className="h-3 bg-white/5 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-4 bg-white/5 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Estado de error */
          <div className="text-center py-16 bg-[#14141c] border border-red-500/20 rounded-2xl p-8 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-200 mb-2">No se pudo cargar el repertorio</h3>
            <p className="text-xs text-gray-400 mb-4">{error}</p>
            <p className="text-[11px] text-gray-500">
              Asegúrate de que las credenciales de Supabase en las variables de entorno sean correctas.
            </p>
          </div>
        ) : partiturasFiltradas.length === 0 ? (
          /* Estado vacío */
          <div className="text-center py-20 bg-[#14141c]/40 border border-dashed border-white/10 rounded-2xl p-8 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 mx-auto flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-gray-200 mb-1">No se encontraron partituras</h3>
            <p className="text-xs text-gray-400 mb-6">
              {terminoBusqueda || etiquetasSeleccionadas.length > 0
                ? 'Intenta con otros términos o limpia los filtros activos.'
                : 'Aún no hay partituras subidas al repertorio.'}
            </p>
            {(terminoBusqueda || etiquetasSeleccionadas.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setTerminoBusqueda('');
                  setEtiquetasSeleccionadas([]);
                }}
                className="px-4 py-2 rounded-lg bg-[#f5b942]/10 text-[#f5b942] border border-[#f5b942]/30 hover:bg-[#f5b942]/20 text-xs font-medium transition-all"
              >
                Limpiar búsqueda y filtros
              </button>
            )}
          </div>
        ) : (
          /* Cuadrícula de partituras */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {partiturasAMostrar.map((p) => (
                <Tarjeta key={p.id} partitura={p} />
              ))}
            </div>

            {/* Botón Cargar Más */}
            {hayMasParaCargar && (
              <div className="text-center mt-10">
                <button
                  type="button"
                  onClick={() => setLimiteVisible((prev) => prev + POR_PAGINA)}
                  className="px-6 py-2.5 rounded-xl bg-[#14141c] border border-white/10 hover:border-[#f5b942]/40 text-gray-200 hover:text-[#f5b942] text-sm font-medium transition-all duration-200 shadow-lg"
                >
                  Cargar más partituras ({partiturasFiltradas.length - limiteVisible} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
