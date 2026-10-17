// Lê uma foto de RG ou CNH e devolve os dados encontrados para o vendedor conferir.
// Nada é salvo aqui: a imagem só passa pela IA e volta como sugestão de preenchimento.
// Precisa do segredo ANTHROPIC_API_KEY (Supabase > Edge Functions > Secrets).
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod'
import { z } from 'npm:zod@4.6.7'
import { cors, resposta, exigirEquipe, regraDoUsuario } from '../_shared/comum.ts'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const LIMITE = 5 * 1024 * 1024 // 5 MB de imagem

// cada campo vem com o valor lido (ou null) e se a leitura foi segura
const Campo = z.object({ valor: z.string().nullable(), seguro: z.boolean() })
const Leitura = z.object({
  documento: z.enum(['RG', 'CNH', 'outro', 'ilegivel']),
  nome: Campo,
  cpf: Campo,
  rg: Campo,
  nome_mae: Campo,
  nascimento: Campo,
  observacao: z.string().nullable(),
})

const INSTRUCOES = `Você lê documentos brasileiros de identificação (RG ou CNH) para preencher um cadastro.
Extraia somente o que está escrito e legível na imagem: nome completo, CPF, número do RG (identidade/registro geral),
nome da mãe (filiação) e data de nascimento. Regras:
- Nunca invente nem complete dados. Se um campo não aparece, está cortado ou ilegível, devolva valor null e seguro false.
- seguro = true só quando você leu o valor inteiro com clareza.
- CPF: só os 11 dígitos. Data de nascimento no formato AAAA-MM-DD.
- Na filiação, o nome da mãe costuma ser o segundo nome; se não der para saber qual é a mãe, devolva null.
- Se a imagem não for um RG ou CNH, use documento "outro"; se não der para ler, "ilegivel".
- Em observacao, explique em uma frase curta o que não foi possível ler (ou null).`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem) return resposta({ erro: 'Acesso negado.' }, 403)
  if (!(await regraDoUsuario(req, 'tem_permissao', { chave: 'gestao' }))) return resposta({ erro: 'Sem permissão para cadastrar clientes.' }, 403)

  const chave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!chave) {
    return resposta({ erro: 'A leitura automática ainda não está ativada. Cadastre o segredo ANTHROPIC_API_KEY no Supabase (Edge Functions > Secrets). Enquanto isso, preencha os dados à mão.', configurar: true }, 503)
  }

  const { imagem, tipo } = await req.json().catch(() => ({}))
  if (!TIPOS.includes(tipo) || typeof imagem !== 'string') return resposta({ erro: 'Envie uma foto do documento (JPG, PNG ou WEBP).' }, 400)
  if (imagem.length * 0.75 > LIMITE) return resposta({ erro: 'A foto passa de 5 MB. Tire outra foto com menos resolução.' }, 400)

  const client = new Anthropic({ apiKey: chave })
  try {
    const r = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Leitura) },
      system: INSTRUCOES,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: tipo as 'image/jpeg', data: imagem } },
          { type: 'text', text: 'Leia este documento e preencha os campos.' },
        ],
      }],
    })
    if (r.stop_reason === 'refusal' || !r.parsed_output) {
      return resposta({ erro: 'Não foi possível ler este documento. Preencha os dados à mão.' }, 422)
    }
    return resposta(r.parsed_output)
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return resposta({ erro: 'A chave da Anthropic é inválida. Confira o segredo ANTHROPIC_API_KEY.', configurar: true }, 503)
    if (e instanceof Anthropic.RateLimitError) return resposta({ erro: 'Muitas leituras ao mesmo tempo. Tente de novo em instantes.' }, 429)
    if (e instanceof Anthropic.APIError) return resposta({ erro: `Falha na leitura (${e.status}). Preencha à mão.` }, 502)
    return resposta({ erro: 'Falha na leitura. Preencha os dados à mão.' }, 502)
  }
})
