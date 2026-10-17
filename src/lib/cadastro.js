// Regras do cadastro de cliente e da criação de contrato (as mesmas do servidor em criar_contrato).
import { cpfValido } from './constants.js'

export const CLIENTE_VAZIO = {
  nome: '', cpf: '', email: '', telefone: '', telefone2: '', rg: '', mae: '', nascimento: '', sexo: '', profissao: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
}

export const numeros = (v) => String(v || '').replace(/\D/g, '')
export const emailValido = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim())

// erros por campo: { campo: 'mensagem' }
export function errosCliente(c) {
  const e = {}
  const nome = String(c.nome || '').trim()
  if (nome.length < 5 || !nome.includes(' ')) e.nome = 'Informe o nome completo.'
  const doc = numeros(c.cpf)
  if (!(cpfValido(doc) || doc.length === 14)) e.cpf = doc ? 'CPF inválido.' : 'Informe o CPF.'
  if (!emailValido(c.email)) e.email = c.email ? 'E-mail inválido.' : 'Informe o e-mail.'
  if (numeros(c.telefone).length < 10) e.telefone = 'Informe o telefone com DDD.'
  if (!String(c.logradouro || '').trim()) e.logradouro = 'Informe a rua.'
  if (!String(c.numero || '').trim()) e.numero = 'Informe o número.'
  if (!String(c.cidade || '').trim()) e.cidade = 'Informe a cidade.'
  if (!String(c.uf || '').trim()) e.uf = 'Informe o estado.'
  if (c.nascimento && (c.nascimento > new Date().toISOString().slice(0, 10) || c.nascimento < '1900-01-01')) e.nascimento = 'Data de nascimento inválida.'
  return e
}

export function errosAmbiente(a) {
  const e = {}
  if (String(a.nome || '').trim().length < 2) e.nome = 'Informe o nome do ambiente.'
  const v = Number(a.valor_bruto)
  if (a.valor_bruto === '' || a.valor_bruto === null || a.valor_bruto === undefined || !Number.isFinite(v) || v < 0) e.valor_bruto = 'Informe o valor bruto.'
  if (a.valor !== '' && a.valor !== null && a.valor !== undefined && (!Number.isFinite(Number(a.valor)) || Number(a.valor) < 0)) e.valor = 'Valor inválido.'
  return e
}

// Consulta de CEP (ViaCEP). Devolve { ok, dados } ou { ok: false, erro }
export async function consultarCep(cep) {
  const n = numeros(cep)
  if (n.length !== 8) return { ok: false, erro: 'O CEP precisa ter 8 números.' }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(`https://viacep.com.br/ws/${n}/json/`, { signal: ctrl.signal })
    if (!r.ok) return { ok: false, erro: 'Não foi possível consultar o CEP agora. Preencha o endereço à mão.' }
    const d = await r.json()
    if (d.erro) return { ok: false, erro: 'CEP não encontrado. Confira os números ou preencha o endereço à mão.' }
    const incompleto = !d.logradouro || !d.bairro
    return {
      ok: true,
      incompleto,
      dados: { cep: `${n.slice(0, 5)}-${n.slice(5)}`, logradouro: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', uf: d.uf || '' },
    }
  } catch {
    return { ok: false, erro: 'Sem conexão com a consulta de CEP. Preencha o endereço à mão.' }
  } finally {
    clearTimeout(t)
  }
}
