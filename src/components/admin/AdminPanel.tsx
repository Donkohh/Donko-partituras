import React, { useState, useEffect } from 'react';
import { obtenerEstadoAuth, cerrarSesion, type AuthState } from '../../lib/auth';
import { Login } from './Login';
import { Subida } from './Subida';

export const AdminPanel: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ user: null, session: null, isAdmin: false });
  const [cargandoAuth, setCargandoAuth] = useState(true);

  const verificarSesion = async () => {
    try {
      setCargandoAuth(true);
      const estado = await obtenerEstadoAuth();
      setAuth(estado);
    } catch (err) {
      console.error('Error al verificar sesión:', err);
      setAuth({ user: null, session: null, isAdmin: false });
    } finally {
      setCargandoAuth(false);
    }
  };

  useEffect(() => {
    verificarSesion();
  }, []);

  const handleCerrarSesion = async () => {
    await cerrarSesion();
    setAuth({ user: null, session: null, isAdmin: false });
  };

  if (cargandoAuth) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#f5b942]/30 border-t-[#f5b942] animate-spin" />
          <span className="text-xs text-gray-500">Comprobando credenciales...</span>
        </div>
      </div>
    );
  }

  // Si no está autenticado o no es admin, mostrar formulario de login
  if (!auth.session || !auth.isAdmin) {
    return <Login onLoginExitoso={verificarSesion} />;
  }

  // Panel Admin Autenticado
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">
      {/* Barra superior de administración */}
      <div className="bg-[#14141c] border border-white/10 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-lg text-[#f5b942]">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-100">Panel de Administración</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#f5b942]/15 text-[#f5b942] border border-[#f5b942]/30">
                Admin
              </span>
            </div>
            <p className="text-xs text-gray-400">{auth.user?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <a
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
          >
            Ver sitio público &rarr;
          </a>
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-medium transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Sección principal: Subida masiva */}
      <div className="space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-2xl font-['Instrument_Serif'] italic text-white flex items-center gap-2">
            <span>Subida Masiva de Partituras</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Los archivos PDF se validan, se desduplican y se transfieren directamente a Supabase Storage con concurrencia controlada.
          </p>
        </div>

        <Subida />
      </div>
    </div>
  );
};
