import React, { useState } from 'react';
import type { Carpeta } from '../../lib/tipos';

interface SelectorCarpetaProps {
  carpetas: Carpeta[];
  onSeleccionar: (carpetaId: string) => Promise<void> | void;
  onCerrar: () => void;
  titulo?: string;
  accionTexto?: string;
}

export const SelectorCarpeta: React.FC<SelectorCarpetaProps> = ({
  carpetas,
  onSeleccionar,
  onCerrar,
  titulo = 'Seleccionar Carpeta',
  accionTexto = 'Asignar',
}) => {
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<string>(
    carpetas[0]?.id || ''
  );
  const [procesando, setProcesando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carpetaSeleccionada) return;

    try {
      setProcesando(true);
      await onSeleccionar(carpetaSeleccionada);
      onCerrar();
    } catch (err) {
      console.error(err);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#14141c] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <span>📁</span>
            <span>{titulo}</span>
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {carpetas.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400">
            No tienes carpetas creadas. Crea una carpeta primero en la pestaña "Carpetas".
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="carpeta-select" className="block text-xs font-medium text-gray-300 mb-2">
                Elige la carpeta de destino:
              </label>
              <select
                id="carpeta-select"
                value={carpetaSeleccionada}
                onChange={(e) => setCarpetaSeleccionada(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/10 text-gray-100 text-sm focus:outline-none focus:border-[#f5b942]/60"
              >
                {carpetas.map((c) => (
                  <option key={c.id} value={c.id}>
                    📁 {c.nombre} ({c.cantidad_partituras || 0} partituras)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={onCerrar}
                disabled={procesando}
                className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:text-white text-xs font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesando || !carpetaSeleccionada}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#f5b942] to-[#e0a331] text-[#0a0a0f] font-semibold text-xs tracking-wide hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {procesando ? 'Guardando...' : accionTexto}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
