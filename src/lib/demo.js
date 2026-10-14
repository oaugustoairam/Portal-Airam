// Dados de exemplo para o modo demonstração. Todos os nomes são fictícios.

function hoje(deslocDias) {
  const d = new Date()
  d.setDate(d.getDate() + deslocDias)
  return d.toISOString().slice(0, 10)
}

// Gera uma "imagem de render" ilustrativa em SVG (um ambiente em perspectiva simples).
function renderSvg(titulo, parede, piso, destaque) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="${parede}"/>
  <polygon points="0,500 160,360 640,360 800,500" fill="${piso}"/>
  <polygon points="0,0 160,90 160,360 0,500" fill="#000" opacity=".08"/>
  <polygon points="800,0 640,90 640,360 800,500" fill="#000" opacity=".14"/>
  <rect x="160" y="90" width="480" height="270" fill="#fff" opacity=".18"/>
  <rect x="420" y="130" width="160" height="150" fill="#dfe9ee" stroke="#fff" stroke-width="6"/>
  <rect x="200" y="270" width="190" height="70" rx="6" fill="${destaque}"/>
  <rect x="200" y="250" width="190" height="26" rx="6" fill="${destaque}" opacity=".75"/>
  <rect x="440" y="300" width="120" height="44" fill="#6b4f3a"/>
  <circle cx="250" cy="170" r="34" fill="#fff" opacity=".5"/>
  <text x="24" y="476" font-family="sans-serif" font-size="20" fill="#fff" opacity=".9">${titulo}</text>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function pdfFicticio(titulo) {
  const html = `<!doctype html><meta charset="utf-8"><title>${titulo}</title>
<body style="font-family:sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#222">
<h1 style="font-size:22px">${titulo}</h1>
<p>Este é um documento de exemplo do modo demonstração. No portal real, aqui abre o PDF enviado pelo escritório.</p></body>`
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

export function criarDadosDemo() {
  const p1 = 'demo-apto-jardins'
  const p2 = 'demo-casa-lago'

  const fases1 = [
    ['Briefing e medição', 'concluida', -62, -56, -57],
    ['Projeto inicial e renders', 'concluida', -56, -42, -41],
    ['Aprovação e contrato', 'concluida', -41, -35, -36],
    ['Projeto final (executivo)', 'concluida', -36, -24, -24],
    ['Produção na fábrica', 'em_andamento', -24, 9, null],
    ['Entrega e montagem', 'pendente', 9, 19, null],
    ['Vistoria final', 'pendente', 19, 22, null],
  ]
  const fases2 = [
    ['Briefing e medição', 'concluida', -9, -4, -5],
    ['Projeto inicial e renders', 'em_andamento', -4, 8, null],
    ['Aprovação e contrato', 'pendente', 8, 14, null],
    ['Projeto final (executivo)', 'pendente', 14, 24, null],
    ['Produção na fábrica', 'pendente', 24, 54, null],
    ['Entrega e montagem', 'pendente', 54, 62, null],
    ['Vistoria final', 'pendente', 62, 65, null],
  ]

  const montarFases = (projeto_id, linhas, obs) =>
    linhas.map(([nome, status, ini, prev, concl], i) => ({
      id: `${projeto_id}-f${i}`,
      projeto_id,
      ordem: i,
      nome,
      status,
      data_inicio: hoje(ini),
      data_prevista: hoje(prev),
      data_conclusao: concl === null ? null : hoje(concl),
      observacao: obs[i] || '',
    }))

  const doc = (projeto_id, i, categoria, titulo, arquivo, tipo, dias) => ({
    id: `${projeto_id}-d${i}`,
    projeto_id,
    fase_id: null,
    categoria,
    titulo,
    arquivo_path: arquivo,
    tipo_mime: tipo,
    criado_em: new Date(Date.now() + dias * 86400000).toISOString(),
  })

  return {
    emailEscritorio: 'escritorio@exemplo.com',
    sessao: null,
    projetos: [
      {
        id: p1,
        nome: 'Apartamento Mooca',
        cliente_nome: 'Marina Duarte (exemplo)',
        cliente_email: 'marina@exemplo.com',
        endereco: 'Rua das Acácias, 120 — ap. 82',
        descricao: 'Móveis planejados para cozinha integrada, suíte master e home office. Garantia de 10 anos.',
        data_inicio: hoje(-62),
        prazo_final: hoje(22),
        criado_em: new Date(Date.now() - 62 * 86400000).toISOString(),
      },
      {
        id: p2,
        nome: 'Casa Jardim São Paulo',
        cliente_nome: 'Rafael Moura (exemplo)',
        cliente_email: 'rafael@exemplo.com',
        endereco: 'Rua dos Ipês, 48 — Guarulhos',
        descricao: 'Cozinha planejada, lavanderia e dois dormitórios.',
        data_inicio: hoje(-9),
        prazo_final: hoje(65),
        criado_em: new Date(Date.now() - 9 * 86400000).toISOString(),
      },
    ],
    fases: [
      ...montarFases(p1, fases1, {
        4: 'Chapas cortadas e em acabamento. Vamos agendar a montagem com você.',
      }),
      ...montarFases(p2, fases2, { 1: 'Duas opções de layout para a cozinha em preparação.' }),
    ],
    documentos: [
      doc(p1, 1, 'contrato', 'Contrato de prestação de serviços', pdfFicticio('Contrato de prestação de serviços'), 'text/html', -78),
      doc(p1, 2, 'projeto_inicial', 'Projeto inicial — planta e vistas', pdfFicticio('Projeto inicial — planta e vistas'), 'text/html', -50),
      doc(p1, 3, 'render', 'Cozinha integrada', renderSvg('Cozinha integrada', '#7d8a90', '#d9d2c7', '#a0764f'), 'image/svg+xml', -44),
      doc(p1, 4, 'render', 'Suíte master', renderSvg('Suíte master', '#a39486', '#d8cdbf', '#8a5a3c'), 'image/svg+xml', -44),
      doc(p1, 5, 'render', 'Home office', renderSvg('Home office', '#9aa39b', '#cdbfa9', '#5b6b73'), 'image/svg+xml', -43),
      doc(p1, 7, 'projeto_final', 'Projeto executivo — rev. final', pdfFicticio('Projeto executivo — rev. final'), 'text/html', -24),
      doc(p2, 6, 'contrato', 'Contrato de prestação de serviços', pdfFicticio('Contrato — Casa Jardim São Paulo'), 'text/html', -9),
    ],
  }
}
