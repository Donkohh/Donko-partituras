import React from 'react';
import type { Partitura } from '../../lib/tipos';
import { getPublicPdfUrl } from '../../lib/supabase';

interface TarjetaProps {
  partitura: Partitura;
}

export const Tarjeta: React.FC<TarjetaProps> = ({ partitura }) => {
  const urlPdf = getPublicPdfUrl(partitura.archivo_path);
  const tieneEtiquetas = partitura.etiquetas && partitura.etiquetas.length > 0;

  // Formatear tamaño de archivo en KB o MB si está disponible
  const formatoTamano = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <a
      href={urlPdf}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col justify-between p-5 rounded-xl bg-[#14141c] border border-white/5 hover:border-[#f5b942]/30 hover:shadow-xl hover:shadow-[#f5b942]/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b942] overflow-hidden"
    >
      {/* Fondo pentagrama tenue en hover */}
      <div
        aria-hidden="true"
        className="absolute inset-0 staff-lines-card opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Ícono de partitura / PDF */}
          <div className="w-10 h-10 rounded-lg bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-[#f5b942] group-hover:scale-105 group-hover:border-[#f5b942]/40 transition-all duration-200 shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          {/* Indicador de abrir en nueva pestaña */}
          <span className="text-gray-500 group-hover:text-[#f5b942] transition-colors p-1" title="Abrir PDF en pestaña nueva">
            <svg className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </span>
        </div>

        {/* Título de la partitura */}
        <h3 className="text-base font-semibold text-gray-100 group-hover:text-[#f5b942] transition-colors line-clamp-2 leading-snug">
          {partitura.nombre}
        </h3>
      </div>

      {/* Pie de tarjeta: etiquetas y metadatos */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tieneEtiquetas ? (
            partitura.etiquetas.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-md bg-white/5 text-gray-300 border border-white/5"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="inline-block px-2 py-0.5 text-[11px] font-medium rounded-md bg-[#f5b942]/10 text-[#f5b942] border border-[#f5b942]/20">
              General
            </span>
          )}
        </div>

        {partitura.tamano_bytes && (
          <span className="text-[11px] text-gray-500 font-mono">
            {formatoTamano(partitura.tamano_bytes)}
          </span>
        )}
      </div>
    </a>
  );
};
