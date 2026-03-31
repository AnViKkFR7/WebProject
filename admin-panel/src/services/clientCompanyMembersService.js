import { supabase } from '../lib/supabaseClient';

// Obtener todas las empresas cliente donde el usuario es miembro
export async function getClientCompaniesForUser(userId) {
  const { data, error } = await supabase
    .from('client_company_members')
    .select('role, client_company:client_company_id(*)')
    .eq('user_id', userId);
  if (error) throw error;
  // Devuelve solo los datos de la empresa cliente
  return data.map(m => ({ ...m.client_company, userRole: m.role }));
}
