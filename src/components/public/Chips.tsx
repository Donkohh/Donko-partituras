import React from 'react';

interface ChipsProps {
  todasLasEtiquetas: string[];
  etiquetasSeleccionadas: string[];
  onAlternarEtiqueta: (etiqueta: string) => void;
  onLimpiarEtiquetas: () => void;
}

export const Chips: React.FC<ChipsProps> = ({
  todasLasEtiquetas,
  etiquetasSeleccionadas,
  onAlternarEtiqueta,
  onLimpiarEtiquetas,
}) => {
  if (todasLasEtiquetas.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto my-4 flex flex-wrap items-center gap-2 justify-center px-4">
      <span className="text-xs font-medium text-gray-400 mr-1 uppercase tracking-wider">
        Filtrar por:
      </span>

      {/* Opción Todas */}
      <button
        type="button"
        onClick={onLimpiarEtiquetas}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border ${
          etiquetasSeleccionadas.length === 0
            ? 'bg-[#f5b942]/15 text-[#f5b942] border-[#f5b942]/40 shadow-sm'
            : 'bg-[#14141c] text-gray-400 border-white/5 hover:border-white/20 hover:text-gray-200'
        }`}
      >
        Todas
      </button>

      {todasLasEtiquetas.map((etiqueta) => {
        const estaActiva = etiquetasSeleccionadas.includes(etiqueta);
        return (
          <button
            key={etiqueta}
            type="button"
            onClick={() => onAlternarEtiqueta(etiqueta)}
            aria-pressed={estaActiva}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border flex items-center gap-1.5 ${
              estaActiva
                ? 'bg-[#8b5cf6]/20 text-[#c4b5fd] border-[#8b5cf6]/50 shadow-sm'
                : 'bg-[#14141c] text-gray-400 border-white/5 hover:border-white/20 hover:text-gray-200'
            }`}
          >
            <span>{etiqueta}</span>
            {estaActiva && (
              <span className="text-[10px] leading-none text-violet-300">✓</span>
            )}
          </button>
        );
      })}

      {etiquetasSeleccionadas.length > 0 && (
        <button
          type="button"
          onClick={onLimpiarEtiquetas}
          className="text-xs text-gray-500 hover:text-gray-300 ml-2 underline underline-offset-4 transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
};
