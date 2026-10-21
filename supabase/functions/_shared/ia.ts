// Chave da Anthropic: a cadastrada pelo master em Configurações > Integrações (tabela integracoes)
// ou o segredo ANTHROPIC_API_KEY do Supabase.
export async function chaveAnthropic(sb) {
  const { data } = await sb.from('integracoes').select('valor').eq('chave', 'anthropic_api_key').maybeSingle()
  return data?.valor || Deno.env.get('ANTHROPIC_API_KEY') || null
}
