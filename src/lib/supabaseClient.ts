import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev if the .env file wasn't set up, instead of a confusing
  // "Invalid URL" error deep inside supabase-js.
  console.error(
    'Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY no arquivo .env. Veja .env.example.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
