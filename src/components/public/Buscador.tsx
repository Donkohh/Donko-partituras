import React, { useEffect, useRef, useState } from 'react';
import { useDebouncedValor } from '../../lib/hooks';

interface BuscadorProps {
  valor: string;
  onCambio: (nuevoValor: string) => void;
  placeholder?: string;
  totalResultados?: number;
}

export const Buscador: React.FC<BuscadorProps> = ({
  valor,
  onCambio,
  placeholder = 'Buscar por título o etiqueta... (Presiona "/" para enfocar)',
  totalResultados,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [valorLocal, setValorLocal] = useState(valor);
  const valorDebounced = useDebouncedValor(valorLocal, 100);

  // Sincroniza cambios externos (por ejemplo, "Limpiar búsqueda y filtros").
  useEffect(() => {
    setValorLocal(valor);
  }, [valor]);

  // Notifica al padre con debounce de ~100 ms.
  useEffect(() => {
    if (valorDebounced !== valor) {
      onCambio(valorDebounced);
    }
  }, [valorDebounced]);

  // Atajo de teclado: presionar '/' para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto my-6">
      {/* Resplandor radial ámbar / violeta detrás del buscador */}
      <div
        aria-hidden="true"
        className="absolute -inset-1.5 bg-gradient-to-r from-[#f5b942]/20 via-[#8b5cf6]/20 to-[#f5b942]/20 rounded-2xl blur-lg opacity-70 transition duration-300 pointer-events-none group-focus-within:opacity-100"
      />

      <div className="relative flex items-center bg-[#14141c] border border-white/10 rounded-xl shadow-2xl focus-within:border-[#f5b942]/70 focus-within:ring-2 focus-within:ring-[#f5b942]/20 transition-all">
        {/* Ícono de lupa */}
        <div className="pl-4 pr-2 text-gray-400 flex items-center pointer-events-none">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={valorLocal}
          onChange={(e) => setValorLocal(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar partituras"
          className="w-full py-3.5 px-2 bg-transparent text-gray-100 placeholder-gray-500 text-sm sm:text-base focus:outline-none"
        />

        {/* Atajo visual o botón limpiar */}
        <div className="pr-3 flex items-center gap-2">
          {valorLocal ? (
            <button
              type="button"
              onClick={() => {
                setValorLocal('');
                onCambio('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Borrar búsqueda"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded-md shadow-inner">
              /
            </kbd>
          )}

          {typeof totalResultados === 'number' && (
            <span className="hidden md:inline-block text-xs text-gray-400 border-l border-white/10 pl-2">
              {totalResultados} {totalResultados === 1 ? 'partitura' : 'partituras'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
