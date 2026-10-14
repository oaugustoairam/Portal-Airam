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
    ['Briefing e levantamento', 'concluida', -78, -70, -71],
    ['Estudo preliminar', 'concluida', -70, -52, -50],
    ['Anteprojeto e renders', 'concluida', -50, -28, -26],
    ['Projeto executivo', 'em_andamento', -26, 6, null],
    ['Detalhamento e marcenaria', 'pendente', 6, 30, null],
    ['Acompanhamento de obra', 'pendente', 30, 110, null],
  ]
  const fases2 = [
    ['Briefing e levantamento', 'concluida', -12, -4, -5],
    ['Estudo preliminar', 'em_andamento', -4, 14, null],
    ['Anteprojeto e renders', 'pendente', 14, 40, null],
    ['Projeto executivo', 'pendente', 40, 75, null],
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
        nome: 'Apartamento Jardins',
        cliente_nome: 'Marina Duarte (exemplo)',
        cliente_email: 'marina@exemplo.com',
        endereco: 'Rua das Acácias, 120 — ap. 82',
        descricao: 'Reforma completa de interiores, 142 m²: sala integrada, cozinha, 3 suítes.',
        data_inicio: hoje(-78),
        prazo_final: hoje(110),
        criado_em: new Date(Date.now() - 78 * 86400000).toISOString(),
      },
      {
        id: p2,
        nome: 'Casa do Lago',
        cliente_nome: 'Rafael Moura (exemplo)',
        cliente_email: 'rafael@exemplo.com',
        endereco: 'Condomínio Vale Verde, lote 14',
        descricao: 'Projeto arquitetônico residencial, 280 m² de área construída.',
        data_inicio: hoje(-12),
        prazo_final: hoje(75),
        criado_em: new Date(Date.now() - 12 * 86400000).toISOString(),
      },
    ],
    fases: [
      ...montarFases(p1, fases1, {
        3: 'Pranchas de elétrica e hidráulica em revisão. Entrega prevista para a próxima semana.',
      }),
      ...montarFases(p2, fases2, { 1: 'Duas opções de implantação em estudo.' }),
    ],
    documentos: [
      doc(p1, 1, 'contrato', 'Contrato de prestação de serviços', pdfFicticio('Contrato de prestação de serviços'), 'text/html', -78),
      doc(p1, 2, 'projeto_inicial', 'Estudo preliminar — planta de layout', pdfFicticio('Estudo preliminar — planta de layout'), 'text/html', -50),
      doc(p1, 3, 'render', 'Sala de estar', renderSvg('Sala de estar', '#8a9a8f', '#c9b79c', '#3f5a63'), 'image/svg+xml', -27),
      doc(p1, 4, 'render', 'Suíte master', renderSvg('Suíte master', '#a39486', '#d8cdbf', '#7b8f99'), 'image/svg+xml', -27),
      doc(p1, 5, 'render', 'Cozinha integrada', renderSvg('Cozinha integrada', '#6f7f86', '#bfb3a3', '#c8a46a'), 'image/svg+xml', -26),
      doc(p2, 6, 'contrato', 'Contrato de prestação de serviços', pdfFicticio('Contrato — Casa do Lago'), 'text/html', -12),
    ],
  }
}
