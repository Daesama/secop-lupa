// Clientes de Supabase.
// - getServiceClient(): server-side con service_role, para el cron (upserts). NUNCA exponer al navegador.
// - getPublicClient(): con anon key, para lectura desde la UI (Hitos futuros).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (revisa .env.local)`);
  }
  return value;
}

/** Cliente con privilegios de servicio. Solo usar en código server-side. */
export function getServiceClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente público (solo lectura vía RLS). Seguro para el frontend. */
export function getPublicClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
