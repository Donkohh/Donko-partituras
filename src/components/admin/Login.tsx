import React, { useState } from 'react';
import { iniciarSesionAdmin } from '../../lib/auth';
import { Turnstile } from './Turnstile';

interface LoginProps {
  onLoginExitoso: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginExitoso }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteKeyConfigurada = Boolean(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (siteKeyConfigurada && !captchaToken) {
      setError('Por favor, completa la verificación de seguridad.');
      return;
    }

    try {
      setCargando(true);
      setError(null);
      await iniciarSesionAdmin(email, password, captchaToken);
      onLoginExitoso();
    } catch (err: unknown) {
      console.error('Login error:', err);
      // Mensaje estrictamente genérico según sección 5 y 7 de AGENTS.md
      setError('Credenciales inválidas');
      setCaptchaToken(undefined);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 staff-lines">
      <div className="w-full max-w-md bg-[#14141c] border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Cabecera del formulario */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#0a0a0f] border border-white/10 flex items-center justify-center text-xl text-[#f5b942] mx-auto mb-3">
            🔐
          </div>
          <h1 className="text-2xl font-['Instrument_Serif'] italic text-white">
            Acceso Administrativo
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Solo el administrador puede subir, editar o gestionar el repertorio.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!siteKeyConfigurada && (
          <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] leading-relaxed" role="status">
            El captcha Turnstile no está configurado. Define <code>PUBLIC_TURNSTILE_SITE_KEY</code> antes de desplegar a producción.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-medium text-gray-300 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/10 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-[#f5b942]/60 focus:ring-1 focus:ring-[#f5b942]/40 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-gray-300 mb-1.5">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/10 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-[#f5b942]/60 focus:ring-1 focus:ring-[#f5b942]/40 transition-colors"
            />
          </div>

          {/* Widget Turnstile */}
          {siteKeyConfigurada && (
            <Turnstile
              onVerify={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(undefined)}
            />
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#f5b942] to-[#e0a331] text-[#0a0a0f] font-semibold text-sm tracking-wide hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b942] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#f5b942]/10"
          >
            {cargando ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};
