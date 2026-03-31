import { supabase } from '../lib/supabaseClient';

// Obtener todas las empresas cliente a las que el usuario tiene acceso por ser miembro de la empresa principal
export async function getClientCompaniesByUserCompanies(userId) {
  // 1. Obtener las empresas principales a las que el usuario tiene acceso
  const { data: companyMemberships, error: companyError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId);
  if (companyError) throw companyError;
  const companyIds = companyMemberships.map(m => m.company_id);
  if (!companyIds.length) return [];
  // 2. Obtener todas las empresas cliente asociadas a esas empresas principales
  const { data: clientCompanies, error: clientError } = await supabase
    .from('client_company')
    .select('*')
    .in('company_id', companyIds);
  if (clientError) throw clientError;
  return clientCompanies;
}
