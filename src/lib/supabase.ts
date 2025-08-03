import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getModels() {
  const { data, error } = await supabase
    .from('models')
    .select('*')
    .eq('family', 'llm')
    .not('price_1m_input_tokens', 'is', null)
    .not('price_1m_output_tokens', 'is', null)
    .not('price_1m_input_tokens', 'eq', 0)
    .not('price_1m_output_tokens', 'eq', 0)
    .not('price_1m_input_tokens', 'eq', '0')
    .not('price_1m_output_tokens', 'eq', '0');

  if (error) {
    console.error('Error fetching models:', error);
    return [];
  }

  return data || [];
}