// Dados de exemplo para o modo demonstração. Pessoas, CPFs e endereços são fictícios.

export const SENHA_DEMO = 'airam123'

function dia(desloc) {
  const d = new Date()
  d.setDate(d.getDate() + desloc)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
const quando = (desloc) => new Date(Date.now() + desloc * 86400000).toISOString()

// "Render" ilustrativo em SVG (ambiente em perspectiva simples)
function renderSvg(titulo, parede, piso, movel) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="${parede}"/>
  <polygon points="0,500 160,360 640,360 800,500" fill="${piso}"/>
  <polygon points="0,0 160,90 160,360 0,500" fill="#000" opacity=".08"/>
  <polygon points="800,0 640,90 640,360 800,500" fill="#000" opacity=".14"/>
  <rect x="190" y="120" width="250" height="240" fill="${movel}"/>
  <rect x="200" y="130" width="110" height="220" fill="#fff" opacity=".12"/>
  <rect x="320" y="130" width="110" height="220" fill="#fff" opacity=".08"/>
  <rect x="470" y="150" width="140" height="120" fill="#e3ebee" stroke="#fff" stroke-width="6"/>
  <rect x="460" y="300" width="160" height="60" fill="${movel}" opacity=".85"/>
  <text x="24" y="476" font-family="sans-serif" font-size="20" fill="#fff">${titulo}</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function docFicticio(titulo) {
  const html = `<!doctype html><meta charset="utf-8"><title>${titulo}</title>
<body style="font-family:sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#222">
<h1 style="font-size:22px;color:#930000">${titulo}</h1>
<p>Documento de exemplo do modo demonstração. No portal real, aqui abre o PDF enviado pela Airam.</p></body>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

export function criarDadosDemo() {
  const p1 = 'demo-0154'
  const p2 = 'demo-0161'
  const p3 = 'demo-0158'

  const doc = (id, processo_id, categoria, titulo, tipo, dias, extra = {}) => ({
    id,
    processo_id,
    categoria,
    titulo,
    arquivo_path: tipo === 'img' ? extra.img : docFicticio(titulo),
    tipo_mime: tipo === 'img' ? 'image/svg+xml' : 'application/pdf',
    assinado: !!extra.assinado,
    criado_em: quando(dias),
  })

  return {
    sessao: null,
    contas: [
      { email: 'equipe@airam.exemplo', nome: 'Equipe Airam', papel: 'admin', senha: SENHA_DEMO, precisa_trocar_senha: false },
      { email: 'marina@exemplo.com', cpf: '52998224725', nome: 'Marina Duarte', papel: 'cliente', senha: SENHA_DEMO, precisa_trocar_senha: false },
      { email: 'rafael@exemplo.com', cpf: '11144477735', nome: 'Rafael Moura', papel: 'cliente', senha: SENHA_DEMO, precisa_trocar_senha: true },
    ],
    processos: [
      {
        id: p1,
        codigo: 'AIR-0154',
        cliente_nome: 'Marina Duarte',
        cliente_cpf: '52998224725',
        cliente_email: 'marina@exemplo.com',
        cliente_telefone: '(11) 90000-0154',
        endereco: 'Rua das Acácias, 120, ap. 82 — Mooca, São Paulo',
        ambientes: 'Cozinha integrada, suíte master, home office',
        data_venda: dia(-58),
        data_disponivel_medicao: dia(-50),
        solucao_financeira: 'ok',
        data_medicao: dia(-48),
        medicao_concluida: true,
        data_conferencia: dia(-30),
        conferencia_concluida: true,
        data_assinatura_projeto: dia(-27),
        projeto_assinado_manual: false,
        data_entrega_prevista: dia(18),
        entrega_concluida: false,
        recado_cliente: 'Seus móveis estão na fábrica. Vamos confirmar com você o horário da montagem.',
        criado_em: quando(-58),
      },
      {
        id: p2,
        codigo: 'AIR-0161',
        cliente_nome: 'Rafael Moura',
        cliente_cpf: '11144477735',
        cliente_email: 'rafael@exemplo.com',
        cliente_telefone: '(11) 90000-0161',
        endereco: 'Rua dos Ipês, 48 — Jardim São Paulo, Guarulhos',
        ambientes: 'Cozinha, lavanderia, dois dormitórios',
        data_venda: dia(-3),
        data_disponivel_medicao: dia(122),
        solucao_financeira: 'pendente',
        data_medicao: dia(124),
        medicao_concluida: false,
        data_conferencia: null,
        conferencia_concluida: false,
        data_assinatura_projeto: null,
        projeto_assinado_manual: false,
        data_entrega_prevista: dia(215),
        entrega_concluida: false,
        recado_cliente: '',
        criado_em: quando(-3),
      },
      {
        id: p3,
        codigo: 'AIR-0158',
        cliente_nome: 'Carla Nogueira',
        cliente_cpf: null,
        cliente_email: 'carla@exemplo.com',
        cliente_telefone: '(11) 90000-0158',
        endereco: 'Av. Paes de Barros, 900 — Mooca, São Paulo',
        ambientes: 'Closet e banheiro',
        data_venda: dia(-20),
        data_disponivel_medicao: dia(5),
        solucao_financeira: 'ok',
        data_medicao: dia(6),
        medicao_concluida: false,
        data_conferencia: null,
        conferencia_concluida: false,
        data_assinatura_projeto: null,
        projeto_assinado_manual: false,
        data_entrega_prevista: dia(70),
        entrega_concluida: false,
        recado_cliente: '',
        criado_em: quando(-20),
      },
    ],
    documentos: [
      doc('d1', p1, 'contrato', 'Contrato AIR-0154', 'pdf', -58),
      doc('d2', p1, 'contrato', 'Contrato assinado', 'pdf', -57, { assinado: true }),
      doc('d3', p1, 'medicao', 'Croqui de medição — ambientes', 'pdf', -48),
      doc('d4', p1, 'projeto_inicial', 'Projeto inicial — planta e vistas', 'pdf', -42),
      doc('d5', p1, 'render', 'Cozinha integrada', 'img', -40, { img: renderSvg('Cozinha integrada', '#7d8a90', '#d9d2c7', '#a0764f') }),
      doc('d6', p1, 'render', 'Suíte master', 'img', -40, { img: renderSvg('Suíte master', '#a39486', '#d8cdbf', '#8a5a3c') }),
      doc('d7', p1, 'render', 'Home office', 'img', -39, { img: renderSvg('Home office', '#9aa39b', '#cdbfa9', '#5b6b73') }),
      doc('d8', p1, 'projeto_final', 'Projeto final — executivo', 'pdf', -30),
      doc('d9', p1, 'projeto_final', 'Projeto final assinado', 'pdf', -27, { assinado: true }),
      doc('d10', p2, 'contrato', 'Contrato AIR-0161', 'pdf', -3),
      doc('d11', p3, 'contrato', 'Contrato AIR-0158', 'pdf', -20),
      doc('d12', p3, 'contrato', 'Contrato assinado', 'pdf', -19, { assinado: true }),
    ],
    avisos: [
      ['entrega_reagendada', 'Nova data de entrega', `A entrega prevista dos seus móveis agora é ${dia(18).split('-').reverse().join('/')}.`, -20],
      ['producao_iniciada', 'Seus móveis entraram em produção', 'Projeto final assinado! Seus móveis entraram em produção na fábrica.', -27],
      ['conferencia_realizada', 'Conferência concluída', 'A conferência do seu projeto final foi concluída. Em breve ele estará pronto para assinatura.', -30],
      ['medicao_realizada', 'Medição concluída', 'A medição dos seus ambientes foi concluída. Agora preparamos o seu projeto final.', -48],
    ].flatMap(([evento, titulo, mensagem, dias], i) => [
      { id: `av${i}w`, processo_id: p1, evento, titulo, mensagem, canal: 'whatsapp', destino: '5511900000154', status: 'enviado', criado_em: quando(dias) },
      { id: `av${i}e`, processo_id: p1, evento, titulo, mensagem, canal: 'email', destino: 'marina@exemplo.com', status: 'enviado', criado_em: quando(dias) },
    ]),
    assinaturas: [
      { id: 'a1', processo_id: p1, tipo: 'contrato', documento_id: 'd1', status: 'assinado', assinado_em: quando(-57), documento_assinado_id: 'd2', criado_em: quando(-58) },
      { id: 'a2', processo_id: p1, tipo: 'projeto_final', documento_id: 'd8', status: 'assinado', assinado_em: quando(-27), documento_assinado_id: 'd9', criado_em: quando(-29) },
      { id: 'a3', processo_id: p2, tipo: 'contrato', documento_id: 'd10', status: 'pendente', sign_url: null, criado_em: quando(-3) },
      { id: 'a4', processo_id: p3, tipo: 'contrato', documento_id: 'd11', status: 'assinado', assinado_em: quando(-19), documento_assinado_id: 'd12', criado_em: quando(-20) },
    ],
  }
}
