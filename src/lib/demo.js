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

// data de nascimento fictícia que cai daqui a `desloc` dias (no ano informado)
function nascimento(desloc, ano) {
  const d = new Date()
  d.setDate(d.getDate() + desloc)
  return `${ano}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  const base = {
    projeto_assinado_manual: false, entrega_concluida: false, montagem_concluida_em: null,
    conferencia_concluida: false, conferencia_concluida_em: null, medicao_concluida: false, medicao_concluida_em: null,
    projeto_inicial_enviado: false, projeto_inicial_em: null, financeiro_ok_em: null, projeto_assinado_em: null,
    data_projeto_inicial: null, data_medicao: null, data_conferencia: null, data_assinatura_projeto: null, recado_cliente: '',
  }

  return {
    sessao: null,
    contas: [
      { email: 'equipe@airam.exemplo', nome: 'Equipe Airam', papel: 'admin', senha: SENHA_DEMO, precisa_trocar_senha: false },
      { email: 'marina@exemplo.com', cpf: '52998224725', nome: 'Marina Duarte', papel: 'cliente', senha: SENHA_DEMO, precisa_trocar_senha: false },
      { email: 'carla@exemplo.com', cpf: '27584319637', nome: 'Carla Nogueira', papel: 'cliente', senha: SENHA_DEMO, precisa_trocar_senha: false },
      { email: 'rafael@exemplo.com', cpf: '11144477735', nome: 'Rafael Moura', papel: 'cliente', senha: SENHA_DEMO, precisa_trocar_senha: true },
    ],
    processos: [
      {
        ...base,
        id: p1,
        codigo: '2561',
        numero_contrato: '100000561-1',
        cliente_nome: 'Marina Duarte',
        cliente_cpf: '52998224725',
        cliente_email: 'marina@exemplo.com',
        cliente_telefone: '(11) 90000-0154',
        cliente_nascimento: nascimento(0, 1988),
        endereco: 'Rua das Acácias, 120, ap. 82 — Mooca, São Paulo',
        ambientes: 'Cozinha integrada, suíte master, home office',
        data_venda: dia(-58),
        data_disponivel_medicao: dia(-45),
        solucao_financeira: 'ok', financeiro_ok_em: quando(-55),
        data_projeto_inicial: dia(-50), projeto_inicial_enviado: true, projeto_inicial_em: quando(-50),
        data_medicao: dia(-44), medicao_concluida: true, medicao_concluida_em: quando(-44),
        data_conferencia: dia(-30), conferencia_concluida: true, conferencia_concluida_em: quando(-30),
        data_assinatura_projeto: dia(-27), projeto_assinado_em: quando(-27),
        data_entrega_prevista: dia(18),
        recado_cliente: 'Seus móveis estão na fábrica. Vamos confirmar com você o horário da montagem.',
        criado_em: quando(-58),
      },
      {
        ...base,
        id: p3,
        codigo: '2565',
        numero_contrato: '100000565-1',
        cliente_nome: 'Carla Nogueira',
        cliente_cpf: '27584319637',
        cliente_email: 'carla@exemplo.com',
        cliente_telefone: '(11) 90000-0158',
        cliente_nascimento: nascimento(5, 1979),
        endereco: 'Av. Paes de Barros, 900 — Mooca, São Paulo',
        ambientes: 'Closet e banheiro',
        data_venda: dia(-34),
        data_disponivel_medicao: dia(-20),
        solucao_financeira: 'ok', financeiro_ok_em: quando(-32),
        data_projeto_inicial: dia(-28), projeto_inicial_enviado: true, projeto_inicial_em: quando(-28),
        data_medicao: dia(-18), medicao_concluida: true, medicao_concluida_em: quando(-18),
        data_conferencia: dia(-2), conferencia_concluida: true, conferencia_concluida_em: quando(-2),
        data_assinatura_projeto: dia(3),
        data_entrega_prevista: dia(48),
        recado_cliente: 'Seu projeto final está pronto. Assine pelo portal para seguirmos para a fábrica.',
        criado_em: quando(-34),
      },
      {
        ...base,
        id: p2,
        codigo: '2568',
        numero_contrato: '100000568-1',
        cliente_nome: 'Rafael Moura',
        cliente_cpf: '11144477735',
        cliente_email: 'rafael@exemplo.com',
        cliente_telefone: '(11) 90000-0161',
        cliente_nascimento: nascimento(23, 1992),
        endereco: 'Rua dos Ipês, 48 — Jardim São Paulo, Guarulhos',
        ambientes: 'Cozinha, lavanderia, dois dormitórios',
        data_venda: dia(-70),
        data_disponivel_medicao: dia(52),
        solucao_financeira: 'ok', financeiro_ok_em: quando(-66),
        data_projeto_inicial: dia(-60), projeto_inicial_enviado: true, projeto_inicial_em: quando(-60),
        data_medicao: dia(54),
        data_entrega_prevista: dia(140),
        criado_em: quando(-70),
      },
    ],
    documentos: [
      doc('d2', p1, 'contrato', 'Contrato assinado — 2561', 'pdf', -58, { assinado: true }),
      doc('d3', p1, 'medicao', 'Croqui de medição — ambientes', 'pdf', -44),
      doc('d4', p1, 'projeto_inicial', 'Projeto inicial — planta e vistas', 'pdf', -50),
      doc('d5', p1, 'render', 'Cozinha integrada', 'img', -40, { img: renderSvg('Cozinha integrada', '#7d8a90', '#d9d2c7', '#a0764f') }),
      doc('d6', p1, 'render', 'Suíte master', 'img', -40, { img: renderSvg('Suíte master', '#a39486', '#d8cdbf', '#8a5a3c') }),
      doc('d7', p1, 'render', 'Home office', 'img', -39, { img: renderSvg('Home office', '#9aa39b', '#cdbfa9', '#5b6b73') }),
      doc('d8', p1, 'projeto_final', 'Projeto final — executivo', 'pdf', -30),
      doc('d9', p1, 'projeto_final', 'Projeto final assinado', 'pdf', -27, { assinado: true }),
      doc('d10', p2, 'contrato', 'Contrato assinado — 2568', 'pdf', -70, { assinado: true }),
      doc('d16', p2, 'projeto_inicial', 'Projeto inicial — cozinha e dormitórios', 'pdf', -60),
      doc('d12', p3, 'contrato', 'Contrato assinado — 2565', 'pdf', -34, { assinado: true }),
      doc('d13', p3, 'projeto_inicial', 'Projeto inicial — closet', 'pdf', -28),
      doc('d14', p3, 'render', 'Closet', 'img', -25, { img: renderSvg('Closet', '#6f6660', '#cfc4b6', '#3b3330') }),
      doc('d15', p3, 'projeto_final', 'Projeto final — closet e banheiro', 'pdf', -2),
    ],
    avisos: [
      ['entrega_reagendada', 'Prazo máximo para entrega', `O prazo máximo para entrega dos seus móveis agora é ${dia(18).split('-').reverse().join('/')}.`, -20],
      ['producao_iniciada', 'Seus móveis entraram em fabricação', 'Projeto final assinado! Seus móveis entraram em fabricação.', -27],
      ['conferencia_realizada', 'Conferência concluída', 'A conferência do seu projeto final foi concluída. Em breve ele estará pronto para assinatura.', -30],
      ['medicao_realizada', 'Medição concluída', 'A medição dos seus ambientes foi concluída. Agora preparamos o seu projeto final.', -44],
      ['projeto_inicial', 'Seu projeto inicial chegou', 'Seu projeto inicial está disponível no Portal Airam, em Documentos.', -50],
      ['financeiro_aprovado', 'Solução financeira aprovada', 'Sua solução financeira foi aprovada. Seguimos para a próxima etapa do seu processo.', -55],
    ].flatMap(([evento, titulo, mensagem, dias], i) => [
      { id: `av${i}w`, processo_id: p1, evento, titulo, mensagem, canal: 'whatsapp', destino: '5511900000154', status: 'enviado', criado_em: quando(dias), enviado_em: quando(dias) },
      { id: `av${i}e`, processo_id: p1, evento, titulo, mensagem, canal: 'email', destino: 'marina@exemplo.com', status: 'enviado', criado_em: quando(dias), enviado_em: quando(dias) },
    ]),
    perfisCliente: {
      'marina@exemplo.com': {
        nome_preferido: 'Marina', telefone: '(11) 90000-0154', telefone_2: '', nascimento: null,
        cep: '03164000', endereco: 'Rua das Acácias', numero: '120', complemento: 'ap. 82', bairro: 'Mooca', cidade: 'São Paulo', uf: 'SP',
        observacoes: 'Portaria 24h. Elevador de serviço disponível das 8h às 17h. Tenho um gato.',
        receber_novidades: true, foto_path: null,
      },
    },
    campanhas: [
      {
        id: 'c1', status: 'enviada', total: 3, enviados: 3, falhas: 0, simulada: true,
        assunto: '{{nome}}, conheça a nova linha de cozinhas Airam',
        titulo: 'Nova linha de cozinhas',
        conteudo: 'Olá, {{nome}}!\n\nAcabamos de lançar acabamentos novos para cozinhas planejadas. Passe em uma das nossas lojas para conhecer.',
        botao_texto: 'Ver no Instagram', botao_link: 'https://www.instagram.com/airam_arquitetura.marcenaria/',
        criado_em: quando(-12), enviada_em: quando(-12),
      },
    ],
    assinaturas: [
      { id: 'a2', processo_id: p1, tipo: 'projeto_final', documento_id: 'd8', status: 'assinado', assinado_em: quando(-27), documento_assinado_id: 'd9', criado_em: quando(-29) },
      { id: 'a5', processo_id: p3, tipo: 'projeto_final', documento_id: 'd15', status: 'pendente', sign_url: null, criado_em: quando(-1) },
    ],
  }
}
