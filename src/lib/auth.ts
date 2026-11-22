import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
}

/**
 * Inicia sesión con correo, contraseña y token de Cloudflare Turnstile opcional.
 * Verifica estrictamente que el usuario posea el rol 'admin' en app_metadata.
 */
export async function iniciarSesionAdmin(
  email: string,
  password: string,
  captchaToken?: string
): Promise<Session> {
  const opcionesAuth = captchaToken ? { captchaToken } : undefined;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
    options: opcionesAuth,
  });

  if (error) {
    console.error('[Auth Error Detalle]:', error.message, error);
    throw new Error('Credenciales inválidas');
  }

  if (!data.session || !data.user) {
    throw new Error('Credenciales inválidas');
  }

  // Comprobar estrictamente rol 'admin' en app_metadata
  const rol = data.user.app_metadata?.role;
  if (rol !== 'admin') {
    console.warn('[Auth Warning]: Usuario autenticado pero sin rol admin en app_metadata:', data.user.app_metadata);
    await supabase.auth.signOut();
    throw new Error('Credenciales inválidas');
  }

  return data.session;
}

/**
 * Cierra la sesión activa.
 */
export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Obtiene el estado actual de autenticación y rol admin.
 */
export async function obtenerEstadoAuth(): Promise<AuthState> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const user = session?.user || null;
  const isAdmin = user?.app_metadata?.role === 'admin';

  return {
    user,
    session,
    isAdmin,
  };
}
