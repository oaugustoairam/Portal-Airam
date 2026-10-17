import { FOTOS } from './fotos.js'
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

// Renders da demonstração: fotos de ambientes da Airam
const foto = (nome) => FOTOS.find((f) => f.nome === nome).src

// Comprovante fictício (imagem) para a pasta do cliente na demonstração
function comprovanteSvg(titulo, linhas) {
  const t = linhas.map((l, i) => `<text x="40" y="${150 + i * 34}" font-family="Arial" font-size="20" fill="#393939">${l}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${220 + linhas.length * 34}"><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="90" fill="#930000"/><text x="40" y="58" font-family="Arial" font-size="28" font-weight="bold" fill="#fff">${titulo}</text><text x="40" y="125" font-family="Arial" font-size="15" fill="#6e6e6c">Documento fictício da demonstração</text>${t}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export function criarDadosDemo() {
  const p1 = 'demo-0154'
  const p2 = 'demo-0161'
  const p3 = 'demo-0158'
  // processos só da equipe, para mostrar todas as pastas
  const p4 = 'demo-0171'
  const p5 = 'demo-0169'
  const p6 = 'demo-0152'
  const p7 = 'demo-0147'

  const doc = (id, processo_id, categoria, titulo, tipo, dias, extra = {}) => ({
    id,
    processo_id,
    categoria,
    titulo,
    arquivo_path: tipo === 'img' ? extra.img : docFicticio(titulo),
    tipo_mime: tipo === 'img' ? extra.mime || 'image/svg+xml' : extra.mime || 'application/pdf',
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
      { email: 'vendedor@airam.exemplo', nome: 'Augusto Moraes', papel: 'vendedor', senha: SENHA_DEMO, precisa_trocar_senha: false },
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
      {
        ...base, id: p4, codigo: '2571', numero_contrato: '100000571-1', cliente_nome: 'Bruno Lima', cliente_email: 'bruno@exemplo.com',
        cliente_telefone: '(11) 90000-0171', endereco: 'Rua Taquari, 300 — Mooca, São Paulo', ambientes: 'Cozinha e área gourmet',
        data_venda: dia(-9), data_disponivel_medicao: dia(10), solucao_financeira: 'pendente', data_entrega_prevista: dia(80), criado_em: quando(-9),
      },
      {
        ...base, id: p5, codigo: '2569', numero_contrato: '100000569-1', cliente_nome: 'Juliana Prado', cliente_email: 'juliana@exemplo.com',
        cliente_telefone: '(11) 90000-0169', endereco: 'Av. Tiradentes, 1500 — Centro, Guarulhos', ambientes: 'Dormitório casal e closet',
        data_venda: dia(-30), data_disponivel_medicao: dia(-20), solucao_financeira: 'ok', financeiro_ok_em: quando(-27),
        data_projeto_inicial: dia(-22), projeto_inicial_enviado: true, projeto_inicial_em: quando(-22),
        data_medicao: dia(-12), medicao_concluida: true, medicao_concluida_em: quando(-12), data_conferencia: dia(-2),
        data_entrega_prevista: dia(55), criado_em: quando(-30),
      },
      {
        ...base, id: p6, codigo: '2552', numero_contrato: '100000552-1', cliente_nome: 'Sofia Mendes', cliente_email: 'sofia@exemplo.com',
        cliente_telefone: '(11) 90000-0152', endereco: 'Rua Juventus, 75 — Mooca, São Paulo', ambientes: 'Living e home theater',
        data_venda: dia(-95), data_disponivel_medicao: dia(-85), solucao_financeira: 'ok', financeiro_ok_em: quando(-92),
        projeto_inicial_enviado: true, projeto_inicial_em: quando(-88), medicao_concluida: true, medicao_concluida_em: quando(-84),
        conferencia_concluida: true, conferencia_concluida_em: quando(-74), data_assinatura_projeto: dia(-70), projeto_assinado_manual: true,
        projeto_assinado_em: quando(-70), data_entrega_prevista: dia(-6), criado_em: quando(-95),
      },
      {
        ...base, id: p7, codigo: '2547', numero_contrato: '100000547-1', cliente_nome: 'Tatiane Rocha', cliente_email: 'tatiane@exemplo.com',
        cliente_telefone: '(11) 90000-0147', endereco: 'Rua Dom Pedro II, 210 — Vila Galvão, Guarulhos', ambientes: 'Cozinha e lavanderia',
        data_venda: dia(-120), data_disponivel_medicao: dia(-110), solucao_financeira: 'ok', financeiro_ok_em: quando(-117),
        projeto_inicial_enviado: true, projeto_inicial_em: quando(-113), medicao_concluida: true, medicao_concluida_em: quando(-108),
        conferencia_concluida: true, conferencia_concluida_em: quando(-98), data_assinatura_projeto: dia(-95), projeto_assinado_manual: true,
        projeto_assinado_em: quando(-95), data_entrega_prevista: dia(-30), entrega_concluida: true, montagem_concluida_em: quando(-25), criado_em: quando(-120),
      },
    ],
    documentos: [
      doc('d20', p1, 'promob', 'Cozinha integrada — versão vendida.promob', 'arq', -58, { mime: 'application/octet-stream' }),
      doc('d21', p1, 'promob', 'Suíte e home office — versão vendida.promob', 'arq', -58, { mime: 'application/octet-stream' }),
      doc('d22', p1, 'ficha_cadastral', 'Ficha cadastral — Marina Duarte', 'pdf', -58),
      doc('d23', p1, 'documento_cliente', 'RG e CPF', 'pdf', -58),
      doc('d24', p1, 'documento_cliente', 'Comprovante de residência', 'pdf', -58),
      doc('d2', p1, 'contrato', 'Contrato assinado — 2561', 'pdf', -58, { assinado: true }),
      doc('d3', p1, 'medicao', 'Croqui de medição — ambientes', 'pdf', -44),
      doc('d4', p1, 'projeto_inicial', 'Projeto inicial — planta e vistas', 'pdf', -50),
      doc('d5', p1, 'render', 'Cozinha integrada', 'img', -40, { img: foto('Cozinha'), mime: 'image/webp' }),
      doc('d6', p1, 'render', 'Suíte master', 'img', -40, { img: foto('Dormitório'), mime: 'image/webp' }),
      doc('d7', p1, 'render', 'Home office', 'img', -39, { img: foto('Home office'), mime: 'image/webp' }),
      doc('d8', p1, 'projeto_final', 'Projeto final — executivo', 'pdf', -30),
      doc('d9', p1, 'projeto_final', 'Projeto final assinado', 'pdf', -27, { assinado: true }),
      doc('d10', p2, 'contrato', 'Contrato assinado — 2568', 'pdf', -70, { assinado: true }),
      doc('d16', p2, 'projeto_inicial', 'Projeto inicial — cozinha e dormitórios', 'pdf', -60),
      doc('d12', p3, 'contrato', 'Contrato assinado — 2565', 'pdf', -34, { assinado: true }),
      doc('d13', p3, 'projeto_inicial', 'Projeto inicial — closet', 'pdf', -28),
      doc('d14', p3, 'render', 'Closet', 'img', -25, { img: foto('Closet'), mime: 'image/webp' }),
      doc('d15', p3, 'projeto_final', 'Projeto final — closet e banheiro', 'pdf', -2),
    ],
    avisos: [
      ['entrega_reagendada', 'Prazo máximo para entrega', `O prazo máximo para entrega dos seus móveis agora é ${dia(18).split('-').reverse().join('/')}.`, -20],
      ['producao_iniciada', 'Seus móveis entraram em fabricação', 'Projeto final assinado! Seus móveis entraram em fabricação.', -27],
      ['conferencia_realizada', 'Conferência concluída', 'A conferência do seu projeto final foi concluída. Em breve ele estará pronto para assinatura.', -30],
      ['medicao_realizada', 'Medição concluída', 'A medição dos seus ambientes foi concluída. Agora preparamos o seu projeto final.', -44],
      ['projeto_inicial', 'Seu projeto inicial chegou', 'Seu projeto inicial está disponível no Portal Airam, na aba Projeto inicial.', -50],
      ['financeiro_aprovado', 'Solução financeira aprovada', 'Sua solução financeira foi aprovada. Seguimos para a próxima etapa do seu processo.', -55],
    ].flatMap(([evento, titulo, mensagem, dias], i) => [
      { id: `av${i}w`, processo_id: p1, evento, titulo, mensagem, canal: 'whatsapp', destino: '5511900000154', status: 'enviado', criado_em: quando(dias), enviado_em: quando(dias) },
      { id: `av${i}e`, processo_id: p1, evento, titulo, mensagem, canal: 'email', destino: 'marina@exemplo.com', status: 'enviado', criado_em: quando(dias), enviado_em: quando(dias) },
    ]),
    // Controle interno da loja (Marina em fabricação, Carla aguardando assinatura)
    controles: {
      [p4]: { id: p4 },
      [p5]: { id: p5, pendencia_resolvida_em: dia(-27), email_enviado_em: dia(-27), inicial_assinado_em: dia(-22), medido_em: dia(-12), liberador: 'Juliana', liberador_recebeu_em: dia(-11) },
      [p6]: {
        id: p6, pendencia_resolvida_em: dia(-92), medido_em: dia(-84), liberador: 'Ricardo', liberador_recebeu_em: dia(-83), conferido_em: dia(-78),
        conferencia_enviada_em: dia(-77), pdf_recebido_em: dia(-72), projeto_final_assinado_em: dia(-70), entregue_em: dia(-8), montagem_inicio_em: dia(-4), montador: 'Sérgio',
      },
      [p7]: {
        id: p7, pendencia_resolvida_em: dia(-117), medido_em: dia(-108), liberador: 'Juliana', liberador_recebeu_em: dia(-107), conferido_em: dia(-101),
        conferencia_enviada_em: dia(-100), pdf_recebido_em: dia(-96), projeto_final_assinado_em: dia(-95), entregue_em: dia(-32), montagem_inicio_em: dia(-30),
        montador: 'Carlos', vistoria_em: dia(-20), tem_att: true, assistencia_retorno_max: dia(-2), observacoes: 'Ajustar porta do armário da lavanderia.',
      },
      [p1]: {
        id: p1, pendencia_resolvida_em: dia(-55), email_enviado_em: dia(-55), inicial_assinado_em: dia(-50), medido_em: dia(-45),
        liberador: 'Juliana', liberador_recebeu_em: dia(-44), conferido_em: dia(-38), conferencia_enviada_em: dia(-37),
        pdf_recebido_em: dia(-31), projeto_final_assinado_em: dia(-27),
      },
      [p3]: {
        id: p3, pendencia_resolvida_em: dia(-32), email_enviado_em: dia(-31), inicial_assinado_em: dia(-26), medido_em: dia(-12),
        liberador: 'Ricardo', liberador_recebeu_em: dia(-11), conferido_em: dia(-4), conferencia_enviada_em: dia(-3), pdf_recebido_em: dia(-2),
      },
    },
    // Gestão de clientes (vendedores): clientes fictícios
    vendas: [
      ['v1', '100003012', 'Helena Martins Costa', 'Augusto Moraes', 'Indicação', 'mooca', -2, 'santander', '1 + 12', 28500, 24310.5, 'resolvido', ['pix', 'boletos']],
      ['v2', '100003013', 'Paulo Henrique Lima', 'Agatha Moraes', 'Rubia', 'guarulhos', -4, 'airam', '18 s/ entrada', 15800, 12100, 'pendente', ['boletos']],
      ['v3', '100003014-1', 'Camila Ferraz', 'Moises Alves', 'Cliente loja', 'mooca', -6, 'avista', 'À vista', 9200, 9200, 'resolvido', ['pix']],
      ['v4', '100003015', 'Rodrigo Teixeira', 'Augusto Moraes', 'Arquitetura', 'guarulhos', -8, 'dubai', '1 + 10', 34000, 27890.4, 'pendente', ['pix', 'cartao']],
      ['v5', '100003016', 'Larissa Gomes', 'Felipe Foiadell', 'Porta de loja', 'guarulhos', -10, 'cartao', '10x', 12400, 11530.2, 'resolvido', ['cartao']],
      ['v6', '100003017', 'Eduardo Rezende', 'Ramon Arias', 'Rubia', 'mooca', -12, 'santander', '24 s/ entrada', 41000, 30220, 'cancelado', []],
      ['v7', '100003018', 'Beatriz Nunes', 'Agatha Moraes', 'Amigos pessoais', 'mooca', -3, null, null, 7600, null, 'pendente', []],
      ['v8', '100002990', 'Vinícius Prado', 'Moises Alves', 'Indicação', 'guarulhos', -40, 'airam', '1 + 24', 22000, 17400, 'resolvido', ['pix', 'boletos']],
    ].map(([id, codigo, cliente_nome, vendedor, captacao, loja, dias, fin, forma, valor, defl, situacao, meios]) => ({
      id, mes: dia(dias).slice(0, 7), codigo, cliente_nome, vendedor, captacao, loja, data_venda: dia(dias), financeira: fin,
      forma_pagamento: forma, valor_venda: valor, valor_deflacionado: defl, valor_entrada: forma?.startsWith('1 +') ? Math.round(valor * 0.1) : null,
      valor_parcela: null, vencimento_primeira: dia(dias + 30), meios, prazo_tipo: '45_dias', previsao_imovel: null,
      envio_email: dia(dias + 1), assinatura_inicial: situacao === 'resolvido' ? dia(dias + 3) : null, avaliacao_google: situacao === 'resolvido' ? true : null,
      bruto_promob: Math.round(valor * 1.18), pedido_fabrica: '', assinatura_projeto_final: null, prazo_limite_entrega: null,
      medicao_realizada: null, limite_projeto_final: null, situacao, pasta_fechada_em: null, criado_em: quando(dias),
      observacao: { v2: 'Gerar 18 boletos pela casa', v4: 'Aguardando aprovação da Dubai', v6: 'Desistiu do projeto', v7: 'Definir forma de pagamento' }[id] || '',
    })),
    vendaDocs: [
      ['vd1', 'v1', 'comprovante_pix', 'Comprovante PIX — entrada', comprovanteSvg('Comprovante de PIX', ['Valor: R$ 2.850,00', 'Pagador: Helena M. Costa', 'Recebedor: Airam Arquitetura'])],
      ['vd2', 'v1', 'financeira_aprovada', 'Santander aprovado', comprovanteSvg('Financeira aprovada', ['Santander · 1 + 12', 'Situação: APROVADO'])],
      ['vd3', 'v1', 'contrato_assinado', 'Contrato assinado', comprovanteSvg('Contrato assinado', ['Pedido 100003012', 'Assinado na loja Mooca'])],
      ['vd4', 'v3', 'comprovante_pix', 'Comprovante PIX', comprovanteSvg('Comprovante de PIX', ['Valor: R$ 9.200,00'])],
    ].map(([id, venda_id, categoria, titulo, img]) => ({ id, venda_id, categoria, titulo, arquivo_path: img, tipo_mime: 'image/svg+xml', criado_em: quando(-2) })),
    perfisCliente: {
      'marina@exemplo.com': {
        nome_preferido: 'Marina', sobrenome: 'Duarte', instagram: 'marina.duarte', telefone: '(11) 90000-0154', telefone_2: '', nascimento: null,
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
