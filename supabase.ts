import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// App can render a setup screen until the owner adds their Supabase keys.
export const isConfigured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = isConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;