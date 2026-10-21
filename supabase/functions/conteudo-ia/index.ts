// Criador de conteúdo (Marketing): legendas de Instagram a partir de uma descrição ou de fotos.
// A IA é chamada só aqui no servidor; a chave nunca vai para o navegador.
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@0.135.0/helpers/beta/zod'
import { z } from 'npm:zod@4.6.7'
import { cors, resposta, exigirEquipe, regraDoUsuario, clienteServidor } from '../_shared/comum.ts'
import { chaveAnthropic } from '../_shared/ia.ts'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const LIMITE = 5 * 1024 * 1024
const OBJETIVOS = { vender: 'vender (gerar contato de quem quer um projeto)', inspirar: 'inspirar', entregue: 'mostrar um projeto entregue', bastidores: 'mostrar os bastidores da marcenaria', depoimento: 'apresentar o depoimento de um cliente' }
const TONS = { sofisticado: 'sofisticado', proximo: 'próximo e acolhedor', tecnico: 'técnico (materiais, ferragens, acabamento)' }
const TAMANHOS = { curto: 'curta (até 3 linhas)', medio: 'média (4 a 7 linhas)', longo: 'longa (8 a 14 linhas, com parágrafos curtos)' }

const Variacao = z.object({ legenda: z.string(), hashtags: z.array(z.string()), cta: z.string() })
const Saida = z.object({ variacoes: z.array(Variacao) })

function instrucoes(m) {
  return `Você escreve legendas de Instagram para a Airam Arquitetura & Marcenaria, empresa de móveis planejados e marcenaria
de alto padrão (lojas na Mooca e em Guarulhos, São Paulo; 25 anos de experiência).
Escreva em português do Brasil, com linguagem elegante, persuasiva e sem exageros. Foque em exclusividade, acabamento,
projeto sob medida e no cuidado com cada detalhe. Não invente fatos (nomes de clientes, prazos, preços, prêmios, materiais)
que não estejam no pedido ou visíveis nas fotos.
Diretrizes da marca definidas pela empresa:
- Tom de voz: ${m.tom_de_voz}
- Palavras e expressões a evitar: ${m.palavras_evitar}
- Hashtags que sempre entram: ${m.hashtags_padrao}
Devolva exatamente 3 variações diferentes entre si (abordagem, abertura e ritmo). Em cada uma: a legenda (sem as hashtags),
de 5 a 12 hashtags (incluindo as que sempre entram, cada uma começando com #) e uma chamada para ação curta (CTA).`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const quem = await exigirEquipe(req)
  if (!quem) return resposta({ erro: 'Acesso negado.' }, 403)
  if (!(await regraDoUsuario(req, 'tem_permissao', { chave: 'marketing' }))) return resposta({ erro: 'Seu perfil não tem acesso ao Marketing.' }, 403)
  const sb = clienteServidor()
  const chave = await chaveAnthropic(sb)
  const corpo = await req.json().catch(() => ({}))
  if (!chave) return resposta({ erro: 'A IA ainda não está ativada: o master precisa cadastrar a chave da Anthropic em Configurações > Integrações.', configurar: true }, 503)
  const client = new Anthropic({ apiKey: chave })

  try {
    if (corpo.acao === 'teste') {
      if (quem.papel !== 'admin') return resposta({ erro: 'Somente o master testa a integração.' }, 403)
      const r = await client.messages.create({ model: 'claude-opus-5-5', max_tokens: 200, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Responda apenas: OK' }] })
      return resposta({ ok: r.stop_reason !== 'refusal' })
    }
    const modo = corpo.modo === 'imagem' ? 'imagem' : 'texto'
    const imagens = Array.isArray(corpo.imagens) ? corpo.imagens.slice(0, 4) : []
    if (modo === 'texto' && String(corpo.descricao ?? '').trim().length < 10) return resposta({ erro: 'Descreva o post em pelo menos uma frase.' }, 400)
    if (modo === 'imagem' && !imagens.length) return resposta({ erro: 'Envie pelo menos uma foto.' }, 400)
    for (const i of imagens) {
      if (!TIPOS.includes(i.tipo) || typeof i.data !== 'string') return resposta({ erro: 'Envie fotos JPG, PNG ou WEBP.' }, 400)
      if (i.data.length * 0.75 > LIMITE) return resposta({ erro: 'Cada foto pode ter até 5 MB.' }, 400)
    }
    const { data: marca } = await sb.from('diretrizes_marca').select('*').eq('id', 1).maybeSingle()
    const pedido = [
      `Objetivo: ${OBJETIVOS[corpo.objetivo] ?? OBJETIVOS.inspirar}.`,
      `Tom: ${TONS[corpo.tom] ?? TONS.sofisticado}.`,
      `Tamanho da legenda: ${TAMANHOS[corpo.tamanho] ?? TAMANHOS.medio}.`,
      modo === 'texto' ? `O post: ${String(corpo.descricao).slice(0, 3000)}` : `Analise as fotos (ambiente, materiais, acabamento, iluminação) e escreva sobre elas.${corpo.contexto ? ` Contexto: ${String(corpo.contexto).slice(0, 1500)}` : ''}`,
      corpo.anterior ? 'Faça variações diferentes das anteriores: ' + String(corpo.anterior).slice(0, 2000) : '',
    ].filter(Boolean).join('\n')
    const r = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Saida) },
      system: instrucoes(marca ?? { tom_de_voz: '', palavras_evitar: '', hashtags_padrao: '' }),
      messages: [{
        role: 'user',
        content: [
          ...imagens.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.tipo as 'image/jpeg', data: i.data } })),
          { type: 'text' as const, text: pedido },
        ],
      }],
    })
    if (r.stop_reason === 'refusal' || !r.parsed_output?.variacoes?.length) return resposta({ erro: 'A IA não conseguiu gerar este conteúdo. Mude a descrição e tente de novo.' }, 422)
    const variacoes = r.parsed_output.variacoes.slice(0, 3).map((v) => ({
      legenda: v.legenda.trim(), cta: v.cta.trim(),
      hashtags: [...new Set(v.hashtags.map((h) => '#' + h.replace(/^#+/, '').replace(/\s+/g, '')).filter((h) => h.length > 1))].slice(0, 15),
    }))
    return resposta({ variacoes })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return resposta({ erro: 'A chave da Anthropic é inválida. O master precisa conferir em Configurações > Integrações.', configurar: true }, 503)
    if (e instanceof Anthropic.RateLimitError) return resposta({ erro: 'Muitos pedidos ao mesmo tempo. Tente de novo em instantes.' }, 429)
    if (e instanceof Anthropic.APIError) return resposta({ erro: `A IA não respondeu (${e.status}). Tente de novo.` }, 502)
    return resposta({ erro: 'A IA não respondeu. Tente de novo.' }, 502)
  }
})
