import { createClient } from "@supabase/supabase-js";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isDemoMode = demoMode;
export const isSupabaseConfigured = !demoMode && Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
