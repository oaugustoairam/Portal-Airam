// Calculadora de dias úteis: feriados nacionais, do estado de SP e dos municípios de São Paulo e Guarulhos,
// com os feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) calculados para qualquer ano,
// mais os feriados e recessos cadastrados pela empresa.

export const MUNICIPIOS = [['sao_paulo', 'São Paulo'], ['guarulhos', 'Guarulhos'], ['nenhum', 'Só nacionais e estaduais']]

export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}
const dois = (n) => String(n).padStart(2, '0')
export const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
export const deIso = (s) => {
  const [a, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(a, m - 1, d)
}
const mais = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// feriados do ano: [{ data, nome, tipo: nacional | estadual | municipal | empresa }]
export function feriadosDoAno(ano, municipio = 'sao_paulo', daEmpresa = []) {
  const p = pascoa(ano)
  const lista = [
    [`${ano}-01-01`, 'Confraternização Universal', 'nacional'],
    [iso(mais(p, -48)), 'Carnaval (segunda-feira)', 'nacional'],
    [iso(mais(p, -47)), 'Carnaval (terça-feira)', 'nacional'],
    [iso(mais(p, -2)), 'Sexta-feira Santa', 'nacional'],
    [`${ano}-04-21`, 'Tiradentes', 'nacional'],
    [`${ano}-05-01`, 'Dia do Trabalho', 'nacional'],
    [`${ano}-09-07`, 'Independência do Brasil', 'nacional'],
    [`${ano}-10-12`, 'Nossa Senhora Aparecida', 'nacional'],
    [`${ano}-11-02`, 'Finados', 'nacional'],
    [`${ano}-11-15`, 'Proclamação da República', 'nacional'],
    [`${ano}-12-25`, 'Natal', 'nacional'],
    [`${ano}-07-09`, 'Revolução Constitucionalista', 'estadual'],
  ]
  // Consciência Negra: feriado nacional desde 2024 (antes, municipal em São Paulo)
  if (ano >= 2024) lista.push([`${ano}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'])
  if (municipio === 'sao_paulo') {
    lista.push([`${ano}-01-25`, 'Aniversário de São Paulo', 'municipal'], [iso(mais(p, 60)), 'Corpus Christi', 'municipal'])
    if (ano < 2024) lista.push([`${ano}-11-20`, 'Dia da Consciência Negra', 'municipal'])
  }
  if (municipio === 'guarulhos') {
    lista.push([iso(mais(p, 60)), 'Corpus Christi', 'municipal'], [`${ano}-12-08`, 'Nossa Senhora da Conceição (aniversário de Guarulhos)', 'municipal'])
  }
  for (const f of daEmpresa) {
    if (f.abrangencia !== 'todas' && f.abrangencia !== municipio) continue
    const fim = f.data_fim && f.data_fim > f.data ? f.data_fim : f.data
    for (let d = deIso(f.data); iso(d) <= fim; d = mais(d, 1)) {
      if (d.getFullYear() === ano) lista.push([iso(d), f.nome, 'empresa'])
    }
  }
  const vistos = new Map()
  for (const [data, nome, tipo] of lista) {
    if (vistos.has(data)) vistos.get(data).nome += ` / ${nome}`
    else vistos.set(data, { data, nome, tipo })
  }
  return [...vistos.values()].sort((a, b) => a.data.localeCompare(b.data))
}

function mapaFeriados(anos, municipio, daEmpresa) {
  const m = new Map()
  for (const a of anos) for (const f of feriadosDoAno(a, municipio, daEmpresa)) m.set(f.data, f)
  return m
}
const fimDeSemana = (d, sabadoUtil) => d.getDay() === 0 || (d.getDay() === 6 && !sabadoUtil)

// dias úteis entre duas datas (as duas contam)
export function contarDiasUteis(inicio, fim, { municipio = 'sao_paulo', sabadoUtil = false, daEmpresa = [] } = {}) {
  let [a, b] = [inicio, fim].sort()
  const anos = []
  for (let y = Number(a.slice(0, 4)); y <= Number(b.slice(0, 4)); y++) anos.push(y)
  const fer = mapaFeriados(anos, municipio, daEmpresa)
  let uteis = 0, corridos = 0, finsDeSemana = 0
  const feriados = []
  for (let d = deIso(a); iso(d) <= b; d = mais(d, 1)) {
    corridos++
    const f = fer.get(iso(d))
    if (fimDeSemana(d, sabadoUtil)) {
      finsDeSemana++
      if (f && f.tipo !== 'empresa') feriados.push({ ...f, noFimDeSemana: true }) // recesso no fim de semana não muda nada
    } else if (f) feriados.push(f)
    else uteis++
  }
  return { inicio: a, fim: b, uteis, corridos, finsDeSemana, feriados, feriadosEmDiaUtil: feriados.filter((f) => !f.noFimDeSemana).length }
}

// somar (ou subtrair) dias úteis: a data inicial não conta
export function somarDiasUteisCalc(inicio, dias, { municipio = 'sao_paulo', sabadoUtil = false, daEmpresa = [], subtrair = false } = {}) {
  const passo = subtrair ? -1 : 1
  let d = deIso(inicio)
  const ano0 = d.getFullYear()
  const fer = mapaFeriados([ano0 - 2, ano0 - 1, ano0, ano0 + 1, ano0 + 2, ano0 + 3], municipio, daEmpresa)
  const pulados = []
  let n = 0
  let guarda = 0
  while (n < dias && guarda++ < 5000) {
    d = mais(d, passo)
    const f = fer.get(iso(d))
    if (fimDeSemana(d, sabadoUtil)) continue
    if (f) {
      pulados.push(f)
      continue
    }
    n++
  }
  return { inicio, dias, resultado: iso(d), feriadosPulados: pulados, corridos: Math.round(Math.abs(d - deIso(inicio)) / 86400000) }
}

// dias de um mês para o calendário visual (começa na segunda)
export function diasDoMes(ano, mes, { municipio = 'sao_paulo', sabadoUtil = false, daEmpresa = [] } = {}) {
  const fer = mapaFeriados([ano], municipio, daEmpresa)
  const primeiro = new Date(ano, mes, 1)
  const ini = mais(primeiro, -((primeiro.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = mais(ini, i)
    return { data: iso(d), dia: d.getDate(), doMes: d.getMonth() === mes, fimDeSemana: fimDeSemana(d, sabadoUtil), feriado: d.getMonth() === mes ? fer.get(iso(d)) : null }
  })
}
