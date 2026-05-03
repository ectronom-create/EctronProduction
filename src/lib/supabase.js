import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function hasRealEnvValue(value) {
  if (!value) return false
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return false
  return !normalized.includes('your_supabase_anon_key') && !normalized.includes('your_supabase_url')
}

export const isSupabaseConfigured = hasRealEnvValue(supabaseUrl) && hasRealEnvValue(supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
