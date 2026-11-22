import { useEffect, useState } from 'react';

/** Devuelve el valor retrasado para no filtrar en cada pulsación (debounce). */
export function useDebouncedValor<T>(valor: T, ms = 100): T {
  const [valorRetrasado, setValorRetrasado] = useState(valor);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setValorRetrasado(valor), ms);
    return () => window.clearTimeout(temporizador);
  }, [valor, ms]);

  return valorRetrasado;
}

/** Cierra un modal o diálogo al pulsar Escape. */
export function useEscape(activo: boolean, alCerrar: () => void) {
  useEffect(() => {
    if (!activo) return;

    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [activo, alCerrar]);
}
