import React, { useState, useEffect } from 'react';
import type { Carpeta, Partitura } from '../../lib/tipos';
import { obtenerCarpetas, obtenerPartiturasDeCarpeta } from '../../lib/supabase';
import { ListaPartituras } from './ListaPartituras';

export const ListaCarpetas: React.FC = () => {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [cargandoCarpetas, setCargandoCarpetas] = useState(true);
  const [errorCarpetas, setErrorCarpetas] = useState<string | null>(null);

  // Carpeta activa seleccionada (vía query param ?c=<uuid>)
  const [idCarpetaActiva, setIdCarpetaActiva] = useState<string | null>(null);
  const [partiturasDeCarpeta, setPartiturasDeCarpeta] = useState<Partitura[]>([]);
  const [cargandoContenido, setCargandoContenido] = useState(false);
  const [errorContenido, setErrorContenido] = useState<string | null>(null);

  // Leer parámetro ?c=<uuid> de la URL al montar o cambiar historial
  useEffect(() => {
    const parseUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('c');
      setIdCarpetaActiva(c);
    };

    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, []);

  // Cargar lista de carpetas
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        setCargandoCarpetas(true);
        setErrorCarpetas(null);
        const datos = await obtenerCarpetas();
        if (!cancelado) {
          setCarpetas(datos);
        }
      } catch (err: unknown) {
        if (!cancelado) {
          setErrorCarpetas(err instanceof Error ? err.message : 'Error al cargar carpetas');
        }
      } finally {
        if (!cancelado) {
          setCargandoCarpetas(false);
        }
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  // Cargar partituras de la carpeta activa
  useEffect(() => {
    if (!idCarpetaActiva) {
      setPartiturasDeCarpeta([]);
      return;
    }

    let cancelado = false;
    const cargarContenido = async () => {
      try {
        setCargandoContenido(true);
        setErrorContenido(null);
        const items = await obtenerPartiturasDeCarpeta(idCarpetaActiva);
        if (!cancelado) {
          setPartiturasDeCarpeta(items);
        }
      } catch (err: unknown) {
        if (!cancelado) {
          setErrorContenido(err instanceof Error ? err.message : 'Error al cargar contenido de la carpeta');
        }
      } finally {
        if (!cancelado) {
          setCargandoContenido(false);
        }
      }
    };

    cargarContenido();
    return () => {
      cancelado = true;
    };
  }, [idCarpetaActiva]);

  const carpetaActual = carpetas.find((c) => c.id === idCarpetaActiva);

  const irACarpeta = (id: string) => {
    const nuevaUrl = `/carpetas?c=${id}`;
    window.history.pushState({}, '', nuevaUrl);
    setIdCarpetaActiva(id);
  };

  const volverACarpetas = () => {
    window.history.pushState({}, '', '/carpetas');
    setIdCarpetaActiva(null);
  };

  // VISTA 1: CONTENIDO DE UNA CARPETA ESPECÍFICA
  if (idCarpetaActiva) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2">
          {/* Navegación y encabezado de la carpeta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <button
              type="button"
              onClick={volverACarpetas}
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#f5b942] transition-colors group self-start"
            >
              <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Volver a todas las carpetas</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-[#f5b942]" />
              <span>Carpeta pública</span>
            </div>
          </div>

          <div className="border-b border-white/5 pb-6">
            <h1 className="text-3xl sm:text-4xl font-['Instrument_Serif'] italic text-white flex items-center gap-3">
              <span className="text-[#f5b942]">📁</span>
              {carpetaActual ? carpetaActual.nombre : 'Cargando carpeta...'}
            </h1>
          </div>
        </div>

        {cargandoContenido ? (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-[#14141c]/60 border border-white/5 p-5" />
              ))}
            </div>
          </div>
        ) : errorContenido ? (
          <div className="text-center py-16 text-red-400 text-sm max-w-md mx-auto">
            {errorContenido}
          </div>
        ) : (
          <ListaPartituras partiturasIniciales={partiturasDeCarpeta} mostrarChips={true} />
        )}
      </div>
    );
  }

  // VISTA 2: LISTA DE TODAS LAS CARPETAS
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
      <div className="border-b border-white/5 pb-6 mb-8">
        <h1 className="text-3xl sm:text-4xl font-['Instrument_Serif'] italic text-white mb-2">
          Carpetas de Partituras
        </h1>
        <p className="text-sm text-gray-400">
          Navega el repertorio organizado por servicios, ocasiones o grupos.
        </p>
      </div>

      {cargandoCarpetas ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[#14141c]/60 border border-white/5 p-5" />
          ))}
        </div>
      ) : errorCarpetas ? (
        <div className="text-center py-16 bg-[#14141c] border border-red-500/20 rounded-2xl p-8 max-w-md mx-auto">
          <p className="text-sm text-red-400">{errorCarpetas}</p>
        </div>
      ) : carpetas.length === 0 ? (
        <div className="text-center py-20 bg-[#14141c]/40 border border-dashed border-white/10 rounded-2xl p-8 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 mx-auto flex items-center justify-center mb-3">
            📁
          </div>
          <h3 className="text-base font-medium text-gray-200 mb-1">No hay carpetas creadas</h3>
          <p className="text-xs text-gray-400">
            Las carpetas organizadas aparecerán aquí cuando el administrador las configure.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {carpetas.map((carpeta) => (
            <button
              key={carpeta.id}
              type="button"
              onClick={() => irACarpeta(carpeta.id)}
              className="group text-left p-6 rounded-xl bg-[#14141c] border border-white/5 hover:border-[#f5b942]/40 hover:shadow-xl hover:shadow-[#f5b942]/5 transition-all duration-200 flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b942]"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform duration-200">
                  📁
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-gray-400 group-hover:text-[#f5b942] group-hover:bg-[#f5b942]/10 transition-colors">
                  {carpeta.cantidad_partituras || 0} {(carpeta.cantidad_partituras === 1) ? 'partitura' : 'partituras'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-100 group-hover:text-[#f5b942] transition-colors mb-1">
                  {carpeta.nombre}
                </h3>
                <span className="text-xs text-gray-500 flex items-center gap-1 group-hover:text-gray-400 transition-colors">
                  Ver partituras de esta carpeta &rarr;
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
