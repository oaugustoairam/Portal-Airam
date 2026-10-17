import { useState } from 'react'
import { api } from '../lib/api.js'
import {
  TIPOS_PROJETO, FORNECEDORES, LINHAS, FORMAS_PAGAMENTO, SEXOS, UFS, AMBIENTE_VAZIO, contratoInicial, descricaoAmbiente,
  totalContrato, gerarParcelas, faltaNoContrato, valorBR, num, enderecoLinha,
} from '../lib/contrato.js'
import { financeira } from '../lib/vendas.js'
import { cpfValido, formatarCpf, formatarTelefone } from '../lib/constants.js'
import { baixarArquivo, nomeArquivo } from '../lib/relatorio.js'
import CampoData from './CampoData.jsx'

const formatarCep = (v) => String(v || '').replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')
const formatarDoc = (v) => {
  const n = String(v || '').replace(/\D/g, '').slice(0, 14)
  if (n.length <= 11) return formatarCpf(n)
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, '$1.$2.$3/$4-$5')
}

const ABAS = [['principal', 'Dados principais'], ['entrega', 'Endereço de entrega'], ['ambientes', 'Ambientes'], ['pagamento', 'Pagamento']]

// Contrato feito pelo portal: o vendedor preenche e o PDF sai no modelo do contrato da Airam.
export default function ContratoEditor({ g, perfil, onFechar }) {
  const [k, setK] = useState(() => ({ ...contratoInicial(g, perfil), ...(g.comercial?.contrato || {}), codigo: g.codigo }))
  const [aba, setAba] = useState('principal')
  const [ambiente, setAmbiente] = useState(null) // { i, a } em edição
  const [estado, setEstado] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  const total = totalContrato(k)
  const falta = faltaNoContrato(k)
  const setC = (campo) => (v) => setK((x) => ({ ...x, cliente: { ...x.cliente, [campo]: v?.target ? v.target.value : v } }))
  const setEnd = (qual) => (campo) => (v) => setK((x) => qual === 'cliente'
    ? { ...x, cliente: { ...x.cliente, endereco: { ...x.cliente.endereco, [campo]: v?.target ? v.target.value : v } } }
    : { ...x, entrega: { ...x.entrega, [campo]: v?.target ? v.target.value : v } })
  const setP = (campo) => (v) => setK((x) => ({ ...x, pagamento: { ...x.pagamento, [campo]: v?.target ? v.target.value : v } }))

  async function buscarCep(qual, cep) {
    const n = cep.replace(/\D/g, '')
    if (n.length !== 8) return
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${n}/json/`)).json()
      if (d.erro) return
      const dados = { endereco: d.logradouro, bairro: d.bairro, cidade: d.localidade, uf: d.uf }
      setK((x) => qual === 'cliente'
        ? { ...x, cliente: { ...x.cliente, endereco: { ...x.cliente.endereco, ...limparVazios(dados) } } }
        : { ...x, entrega: { ...x.entrega, ...limparVazios(dados) } })
    } catch {}
  }

  function recalcularParcelas() {
    setK((x) => ({ ...x, pagamento: { ...x.pagamento, parcelas: gerarParcelas(totalContrato(x), x.pagamento.condicao, x.pagamento.primeiroVencimento, x.pagamento.entrada) } }))
  }

  async function salvar() {
    const doc = k.cliente.cpf.replace(/\D/g, '')
    if (doc.length === 11 && !cpfValido(doc)) throw new Error('O CPF informado não é válido.')
    const e = k.entregaIgual ? k.cliente.endereco : k.entrega
    // o mesmo cadastro do portal: os dados do contrato atualizam o cliente
    const processo = {
      ...semRelacoes(g), cliente_nome: k.cliente.nome, cliente_email: k.cliente.email || g.cliente_email,
      cliente_telefone: k.cliente.telefone1 || g.cliente_telefone, cliente_nascimento: k.cliente.nascimento || g.cliente_nascimento,
      cliente_cpf: doc.length === 11 ? doc : g.cliente_cpf, numero_contrato: k.numero,
      endereco: [enderecoLinha(e), e.bairro, e.cidade].filter(Boolean).join(' — '), cidade: e.cidade, bairro: e.bairro, cep: e.cep,
    }
    const { codigo, ...dados } = k
    return api.salvarClienteGestao({ processo, comercial: { ...g.comercial, valor_venda: total || g.comercial?.valor_venda, contrato: dados } })
  }

  async function acao(tipo) {
    setErro('')
    setMsg('')
    if (tipo === 'criar' && falta.length) return setErro('Antes de criar o contrato, preencha: ' + falta.join(', ') + '.')
    setEstado(tipo)
    try {
      await salvar()
      if (tipo === 'criar') {
        const { gerarPdfContrato } = await import('./relatorio/PdfContrato.jsx')
        baixarArquivo(await gerarPdfContrato(k), `contrato-${nomeArquivo(`${k.numero}-${k.cliente.nome}`)}.pdf`)
        setMsg('Contrato criado')
      } else setMsg('Rascunho salvo')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      console.error(err)
      setErro(err.message)
    } finally {
      setEstado('')
    }
  }

  const c = k.cliente
  return (
    <section className="gestao contrato-editor">
      <button className="btn btn-leve voltar" onClick={onFechar}>← Voltar à ficha</button>
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Contrato {k.numero ? `nº ${k.numero}` : 'novo'} · {g.codigo}</span>
          <h1 className="titulo-grande">{c.nome || g.cliente_nome}</h1>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </div>

      <div className="contrato-resumo">
        <div><span className="rotulo">Ambientes</span><strong className="num">{k.ambientes.length}</strong></div>
        <div><span className="rotulo">Total do pedido</span><strong className="num">R$ {valorBR(total)}</strong></div>
        <div><span className="rotulo">Parcelas</span><strong className="num">{k.pagamento.parcelas.length || '—'}</strong></div>
        <div className={falta.length ? 'alerta' : 'ok'}><span className="rotulo">Situação</span><strong>{falta.length ? `Faltam ${falta.length} itens` : 'Pronto para criar'}</strong></div>
      </div>

      <nav className="abas contrato-abas" role="tablist">
        {ABAS.map(([id, t]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={`aba ${aba === id ? 'ativa' : ''}`} onClick={() => setAba(id)}>{t}</button>
        ))}
      </nav>

      {aba === 'principal' && (
        <div className="form">
          <fieldset className="grupo">
            <legend>Contrato</legend>
            <div className="grade grade-3">
              <Texto id="k-num" rotulo="Nº do contrato" valor={k.numero} onChange={(v) => setK((x) => ({ ...x, numero: v }))} obrigatorio placeholder="100000503-1" />
              <CampoData id="k-data" rotulo="Data do contrato" valor={k.data} onChange={(v) => setK((x) => ({ ...x, data: v }))} />
              <Texto id="k-resp" rotulo="Responsável pela venda" valor={k.responsavel} onChange={(v) => setK((x) => ({ ...x, responsavel: v }))} />
              <Selecao id="k-loja" rotulo="Loja" valor={k.loja} opcoes={['Guarulhos', 'Mooca']} onChange={(v) => setK((x) => ({ ...x, loja: v }))} />
              <Selecao id="k-tipo" rotulo="Tipo de contrato" valor={k.tipo} opcoes={['Normal', 'Futura']} onChange={(v) => setK((x) => ({ ...x, tipo: v }))} />
              <Texto id="k-subs" rotulo="Substitui o contrato nº (opcional)" valor={k.substitui} onChange={(v) => setK((x) => ({ ...x, substitui: v }))} />
              {k.substitui && <CampoData id="k-subsd" rotulo="Data do contrato substituído" valor={k.substituiData} onChange={(v) => setK((x) => ({ ...x, substituiData: v }))} />}
            </div>
          </fieldset>
          <fieldset className="grupo">
            <legend>Dados principais do cliente</legend>
            <div className="grade grade-3">
              <Texto id="k-nome" rotulo="Nome" valor={c.nome} onChange={setC('nome')} obrigatorio largo />
              <Texto id="k-cpf" rotulo="CPF/CNPJ" valor={formatarDoc(c.cpf)} onChange={(v) => setC('cpf')(formatarDoc(v))} inputMode="numeric" obrigatorio />
              <Texto id="k-rg" rotulo="R.G / Insc. Est." valor={c.rg} onChange={setC('rg')} />
              <Selecao id="k-sexo" rotulo="Sexo" valor={c.sexo} opcoes={SEXOS} onChange={setC('sexo')} vazio="--Selecione--" />
              <CampoData id="k-nasc" rotulo="Data nasc." valor={c.nascimento} onChange={setC('nascimento')} />
              <Texto id="k-mae" rotulo="Nome da mãe" valor={c.mae} onChange={setC('mae')} />
              <Texto id="k-tel1" rotulo="Telefone 1" type="tel" valor={c.telefone1} onChange={(v) => setC('telefone1')(formatarTelefone(v))} />
              <Texto id="k-tel2" rotulo="Telefone 2" type="tel" valor={c.telefone2} onChange={(v) => setC('telefone2')(formatarTelefone(v))} />
              <Texto id="k-prof" rotulo="Profissão" valor={c.profissao} onChange={setC('profissao')} />
              <Texto id="k-email" rotulo="E-mail" type="email" valor={c.email} onChange={setC('email')} />
            </div>
          </fieldset>
          <Endereco titulo="Endereço do cliente" id="kc" e={c.endereco} set={setEnd('cliente')} onCep={(v) => buscarCep('cliente', v)} />
        </div>
      )}

      {aba === 'entrega' && (
        <div className="form">
          <label className="check">
            <input type="checkbox" checked={k.entregaIgual} onChange={(e) => setK((x) => ({ ...x, entregaIgual: e.target.checked }))} />
            A entrega é no mesmo endereço do cliente
          </label>
          {k.entregaIgual
            ? <p className="dica">Endereço de entrega: {enderecoLinha(c.endereco) || '—'}{c.endereco.bairro ? `, ${c.endereco.bairro}` : ''}{c.endereco.cidade ? ` — ${c.endereco.cidade}` : ''}</p>
            : (
              <Endereco titulo="Endereço de entrega" id="ke" e={k.entrega} set={setEnd('entrega')} onCep={(v) => buscarCep('entrega', v)} extra />
            )}
        </div>
      )}

      {aba === 'ambientes' && (
        <div className="form">
          <div className="cab-linha">
            <p className="dica">Cada ambiente vira uma linha no contrato (AA, AB, AC…), com corpo, porta, puxador, complemento e modelo.</p>
            <button type="button" className="btn btn-principal" onClick={() => setAmbiente({ i: -1, a: { ...AMBIENTE_VAZIO } })}>Adicionar ambiente</button>
          </div>
          {!k.ambientes.length ? <p className="vazio">Nenhum ambiente ainda.</p> : (
            <div className="tabela-wrap">
              <table className="tabela tabela-ambientes">
                <thead><tr><th>Item</th><th>Ambiente</th><th>Linha</th><th>Corpo</th><th>Porta</th><th>Puxador</th><th>Prazo</th><th>Valor</th><th></th></tr></thead>
                <tbody>
                  {k.ambientes.map((a, i) => (
                    <tr key={i} onClick={() => setAmbiente({ i, a: { ...a } })}>
                      <td className="num">{i + 1}</td>
                      <td><strong>{descricaoAmbiente(a, i)}</strong><span className="celula-sub">{a.tipo} · {a.fornecedor}</span></td>
                      <td>{a.linha}</td><td>{a.corpo}</td><td>{a.porta}</td><td>{a.puxador}</td>
                      <td className="num">{a.prazo}</td>
                      <td className="num">{valorBR(num(a.valor) * (num(a.qtd) || 1))}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn btn-perigo-leve" onClick={() => setK((x) => ({ ...x, ambientes: x.ambientes.filter((_, j) => j !== i) }))}>Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={7}>Total do pedido</td><td className="num">{valorBR(total)}</td><td /></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {aba === 'pagamento' && (
        <div className="form">
          <fieldset className="grupo">
            <legend>Condição de pagamento</legend>
            <div className="grade grade-3">
              <div className="campo">
                <label htmlFor="k-cond">Condição</label>
                <input id="k-cond" list="k-condicoes" value={k.pagamento.condicao} onChange={setP('condicao')} placeholder="15 s/ entrada" />
                <datalist id="k-condicoes">{(financeira(g.comercial?.financeira)?.formas || ['À vista', '1 + 10', '10 s/ entrada', '15 s/ entrada']).map((f) => <option key={f} value={f} />)}</datalist>
              </div>
              <Selecao id="k-forma" rotulo="Forma de pagamento" valor={k.pagamento.forma} opcoes={FORMAS_PAGAMENTO} onChange={setP('forma')} />
              <CampoData id="k-venc" rotulo="1º vencimento" valor={k.pagamento.primeiroVencimento} onChange={setP('primeiroVencimento')} />
              {/\+/.test(k.pagamento.condicao) && <Texto id="k-ent" rotulo="Entrada (R$)" valor={k.pagamento.entrada} onChange={setP('entrada')} inputMode="decimal" />}
            </div>
            <div className="acoes">
              <button type="button" className="btn btn-contorno" onClick={recalcularParcelas} disabled={!total || !k.pagamento.condicao}>Gerar parcelas</button>
              <span className="celula-sub">Total a prazo: R$ {valorBR(total)}. Você pode ajustar cada parcela (como a de reforço).</span>
            </div>
          </fieldset>
          {k.pagamento.parcelas.length > 0 && (
            <div className="tabela-wrap">
              <table className="tabela tabela-parcelas">
                <thead><tr><th>PC</th><th>Vencimento</th><th>Valor (R$)</th><th></th></tr></thead>
                <tbody>
                  {k.pagamento.parcelas.map((p, i) => (
                    <tr key={i}>
                      <td className="num">{i + 1}</td>
                      <td><input type="date" value={p.venc} onChange={(e) => mudarParcela(setK, i, { venc: e.target.value })} /></td>
                      <td><input type="number" step="0.01" inputMode="decimal" value={p.valor} onChange={(e) => mudarParcela(setK, i, { valor: e.target.value })} /></td>
                      <td><button type="button" className="btn btn-leve" onClick={() => setK((x) => ({ ...x, pagamento: { ...x.pagamento, parcelas: x.pagamento.parcelas.filter((_, j) => j !== i) } }))}>Tirar</button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={2}>Soma das parcelas</td><td className="num">{valorBR(k.pagamento.parcelas.reduce((t, p) => t + num(p.valor), 0))}</td><td /></tr></tfoot>
              </table>
            </div>
          )}
          <div className="campo">
            <label htmlFor="k-obs">Observação geral do contrato</label>
            <textarea id="k-obs" rows={3} value={k.observacao} onChange={(e) => setK((x) => ({ ...x, observacao: e.target.value }))} />
          </div>
        </div>
      )}

      {erro && <p className="erro" role="alert">{erro}</p>}
      {falta.length > 0 && (
        <details className="falta-caixa">
          <summary><strong>Falta preencher ({falta.length})</strong></summary>
          <ul>{falta.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      )}
      <div className="acoes acoes-venda">
        <button type="button" className="btn btn-principal" disabled={!!estado} onClick={() => acao('criar')}>{estado === 'criar' ? 'Criando o contrato…' : 'Criar contrato'}</button>
        <button type="button" className="btn btn-contorno" disabled={!!estado} onClick={() => acao('salvar')}>{estado === 'salvar' ? 'Salvando…' : 'Salvar rascunho'}</button>
      </div>
      <p className="dica">"Criar contrato" salva os dados no cadastro do cliente e baixa o PDF no modelo do contrato da Airam.</p>

      {ambiente && (
        <AmbienteModal inicial={ambiente.a} novo={ambiente.i < 0}
          onFechar={() => setAmbiente(null)}
          onSalvar={(a) => {
            setK((x) => ({ ...x, ambientes: ambiente.i < 0 ? [...x.ambientes, a] : x.ambientes.map((y, j) => (j === ambiente.i ? a : y)) }))
            setAmbiente(null)
          }} />
      )}
    </section>
  )
}

const limparVazios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v))
const semRelacoes = ({ comercial, controle, pasta, assinaturas, documentos, ...p }) => p
const mudarParcela = (setK, i, d) => setK((x) => ({ ...x, pagamento: { ...x.pagamento, parcelas: x.pagamento.parcelas.map((p, j) => (j === i ? { ...p, ...d } : p)) } }))

function Texto({ id, rotulo, valor, onChange, obrigatorio, largo, ...resto }) {
  return (
    <div className={`campo ${largo ? 'campo-largo' : ''}`}>
      <label htmlFor={id}>{rotulo}{obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      <input id={id} value={valor ?? ''} onChange={(e) => onChange(e.target.value)} {...resto} />
    </div>
  )
}

function Selecao({ id, rotulo, valor, opcoes, onChange, vazio }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={valor ?? ''} onChange={(e) => onChange(e.target.value)}>
        {vazio && <option value="">{vazio}</option>}
        {opcoes.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
      </select>
    </div>
  )
}

function Endereco({ titulo, id, e, set, onCep, extra }) {
  return (
    <fieldset className="grupo">
      <legend>{titulo}</legend>
      <div className="grade grade-3">
        <Texto id={`${id}-cep`} rotulo="CEP" valor={e.cep} inputMode="numeric" onChange={(v) => { const c = formatarCep(v); set('cep')(c); onCep(c) }} placeholder="00000-000" />
        <Selecao id={`${id}-uf`} rotulo="Estado" valor={e.uf} opcoes={UFS} onChange={set('uf')} vazio="--Selecione--" />
        <Texto id={`${id}-cid`} rotulo="Cidade" valor={e.cidade} onChange={set('cidade')} />
        <Texto id={`${id}-end`} rotulo="Endereço" valor={e.endereco} onChange={set('endereco')} largo />
        <Texto id={`${id}-num`} rotulo="Número" valor={e.numero} onChange={set('numero')} />
        <Texto id={`${id}-comp`} rotulo="Complemento" valor={e.complemento} onChange={set('complemento')} />
        <Texto id={`${id}-bai`} rotulo="Bairro" valor={e.bairro} onChange={set('bairro')} />
        {extra && <Texto id={`${id}-edi`} rotulo="Edifício" valor={e.edificio} onChange={set('edificio')} />}
        {extra && <Texto id={`${id}-ref`} rotulo="Referência" valor={e.referencia} onChange={set('referencia')} />}
      </div>
    </fieldset>
  )
}

// Mesmos campos da tela "Adicionar Projeto" do sistema da fábrica
function AmbienteModal({ inicial, novo, onFechar, onSalvar }) {
  const [a, setA] = useState(inicial)
  const [erro, setErro] = useState('')
  const set = (k) => (v) => setA((x) => ({ ...x, [k]: v?.target ? v.target.value : v }))
  function salvar(e) {
    e.preventDefault()
    if (!a.linha) return setErro('Escolha a linha de produção.')
    if (!num(a.valor)) return setErro('Informe o valor do ambiente.')
    onSalvar({ ...a, descricao: a.descricao.trim() || a.linha })
  }
  return (
    <div className="modal" role="presentation">
      <form className="confirmar-exclusao ambiente-form" role="dialog" aria-modal="true" aria-labelledby="amb-t" onSubmit={salvar}>
        <h2 id="amb-t">{novo ? 'Adicionar projeto' : 'Editar projeto'}</h2>
        <div className="grade grade-2">
          <Selecao id="amb-tipo" rotulo="Tipo" valor={a.tipo} opcoes={TIPOS_PROJETO} onChange={set('tipo')} />
          <Selecao id="amb-forn" rotulo="Fornecedor" valor={a.fornecedor} opcoes={FORNECEDORES} onChange={set('fornecedor')} />
          <Selecao id="amb-linha" rotulo="Linha de prod." valor={a.linha} opcoes={LINHAS} onChange={set('linha')} vazio="--Selecione--" />
          <Texto id="amb-desc" rotulo="Descrição amb." valor={a.descricao} onChange={set('descricao')} placeholder="Ex.: Cozinha e área de serviço" />
          <Texto id="amb-corpo" rotulo="Corpo" valor={a.corpo} onChange={set('corpo')} placeholder="MDF 15 MM BRANCO TX" />
          <Texto id="amb-porta" rotulo="Porta" valor={a.porta} onChange={set('porta')} />
          <Texto id="amb-comp" rotulo="Complemento" valor={a.complemento} onChange={set('complemento')} />
          <Texto id="amb-pux" rotulo="Puxador" valor={a.puxador} onChange={set('puxador')} />
          <Texto id="amb-mod" rotulo="Modelo" valor={a.modelo} onChange={set('modelo')} />
          <Texto id="amb-valor" rotulo="Valor (R$)" valor={a.valor} onChange={set('valor')} type="number" step="0.01" inputMode="decimal" obrigatorio />
          <Texto id="amb-qtd" rotulo="Quantidade" valor={a.qtd} onChange={set('qtd')} type="number" step="1" min="1" />
          <Texto id="amb-prazo" rotulo="Prazo (dias úteis)" valor={a.prazo} onChange={set('prazo')} type="number" step="1" />
        </div>
        <div className="campo">
          <label htmlFor="amb-obs">Observações</label>
          <textarea id="amb-obs" rows={3} value={a.observacoes} onChange={set('observacoes')} />
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="button" className="btn btn-leve" onClick={onFechar}>Fechar</button>
          <button className="btn btn-principal">Salvar</button>
        </div>
      </form>
    </div>
  )
}
