import { useState } from 'react'
import { TIPOS_PROJETO, FORNECEDORES, LINHAS, valorBR, num } from '../lib/contrato.js'
import { errosAmbiente } from '../lib/cadastro.js'
import { lerXmlPromob, COLUNAS_PADRAO, LIMITE_XML } from '../lib/promob.js'

// Lista de ambientes do contrato. Usada na criação (itens em memória) e no contrato salvo (itens do banco).
// xml: { [chave do ambiente]: { arquivo, pecas, erro } } para os XMLs ainda não enviados.
export function TabelaAmbientes({ itens, onEditar, onRemover, onPecas, onBaixarXml, podeEditar = true }) {
  const total = itens.reduce((t, a) => t + num(a.valor === '' || a.valor == null ? a.valor_bruto : a.valor) * (num(a.qtd) || 1), 0)
  const bruto = itens.reduce((t, a) => t + num(a.valor_bruto) * (num(a.qtd) || 1), 0)
  if (!itens.length) return <p className="vazio">Nenhum ambiente ainda.</p>
  return (
    <div className="tabela-wrap">
      <table className="tabela tabela-ambientes">
        <thead>
          <tr><th>#</th><th>Ambiente</th><th>Linha</th><th>Valor bruto</th><th>Valor no contrato</th><th>XML do Promob</th><th /></tr>
        </thead>
        <tbody>
          {itens.map((a, i) => {
            const pecas = a._xml?.pecas || a.pecas
            const erro = a._xml ? a._xml.erro : a.pecas_erro
            const temXml = a._xml || a.xml_path
            return (
              <tr key={a.id || a._chave}>
                <td className="num">{i + 1}</td>
                <td><strong>{a.nome}</strong><span className="celula-sub">{[a.tipo, a.fornecedor, a.prazo ? `${a.prazo} dias úteis` : null].filter(Boolean).join(' · ')}</span></td>
                <td>{a.linha || '—'}</td>
                <td className="num">R$ {valorBR(num(a.valor_bruto) * (num(a.qtd) || 1))}</td>
                <td className="num">R$ {valorBR(num(a.valor === '' || a.valor == null ? a.valor_bruto : a.valor) * (num(a.qtd) || 1))}</td>
                <td>
                  {!temXml ? <span className="celula-sub">Sem XML</span> : (
                    <span className="xml-estado">
                      <span className="celula-sub">{a._xml?.arquivo?.name || a.xml_nome}{a._xml ? ' · será enviado ao salvar' : ''}</span>
                      {pecas ? <button type="button" className="link" onClick={() => onPecas(a)}>{pecas.total} peças</button>
                        : erro ? <span className="texto-atraso" title={erro}>Peças não lidas</span> : null}
                      {a.xml_path && onBaixarXml && <button type="button" className="link" onClick={() => onBaixarXml(a)}>Baixar</button>}
                    </span>
                  )}
                </td>
                <td className="acoes-linha">
                  {podeEditar && <button type="button" className="btn btn-leve" onClick={() => onEditar(a, i)}>Editar</button>}
                  {podeEditar && <button type="button" className="btn btn-perigo-leve" onClick={() => onRemover(a, i)}>Remover</button>}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr><td colSpan={3}>Total</td><td className="num">R$ {valorBR(bruto)}</td><td className="num">R$ {valorBR(total)}</td><td colSpan={2} /></tr>
        </tfoot>
      </table>
    </div>
  )
}

// Formulário de um ambiente (mesmos campos da tela "Adicionar Projeto" da fábrica + valores e XML)
export function AmbienteModal({ inicial, novo, onFechar, onSalvar }) {
  const [a, setA] = useState(inicial)
  const [erros, setErros] = useState({})
  const [xml, setXml] = useState(inicial._xml || null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k) => (e) => setA((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))

  async function escolherXml(arquivo) {
    if (!arquivo) return
    if (!/\.xml$/i.test(arquivo.name)) return setXml({ arquivo: null, erro: 'Envie o arquivo .xml exportado do Promob.' })
    if (arquivo.size > LIMITE_XML) return setXml({ arquivo: null, erro: 'O XML passa de 20 MB.' })
    let pecas = null
    let erroLeitura = null
    try {
      pecas = lerXmlPromob(await arquivo.text())
    } catch (e) {
      erroLeitura = e.message
    }
    setXml({ arquivo, pecas, erro: erroLeitura })
  }

  async function salvar(e) {
    e.preventDefault()
    const er = errosAmbiente(a)
    setErros(er)
    if (Object.keys(er).length) return
    setErro('')
    setOcupado(true)
    try {
      await onSalvar({ ...a, nome: a.nome.trim() }, xml?.arquivo ? xml : null)
    } catch (err) {
      setErro(err.message)
      setOcupado(false)
    }
  }

  const campo = (id, rotulo, k, extra = {}) => (
    <div className={`campo ${erros[k] ? 'campo-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{extra.obrigatorio && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      <input id={id} value={a[k] ?? ''} onChange={set(k)} aria-invalid={!!erros[k]} {...extra.input} />
      {erros[k] && <span className="erro-campo">{erros[k]}</span>}
    </div>
  )
  const lista = (id, rotulo, k, opcoes, vazio) => (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <select id={id} value={a[k] ?? ''} onChange={set(k)}>
        {vazio && <option value="">{vazio}</option>}
        {opcoes.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
  return (
    <div className="modal" role="presentation">
      <form className="confirmar-exclusao ambiente-form" role="dialog" aria-modal="true" aria-labelledby="amb-t" onSubmit={salvar}>
        <h2 id="amb-t">{novo ? 'Adicionar ambiente' : 'Editar ambiente'}</h2>
        <div className="grade grade-2">
          {campo('amb-nome', 'Nome do ambiente', 'nome', { obrigatorio: true, input: { placeholder: 'Ex.: Cozinha, Dormitório casal', autoFocus: true } })}
          {lista('amb-linha', 'Linha de produção', 'linha', LINHAS, '--Selecione--')}
          {lista('amb-tipo', 'Tipo', 'tipo', TIPOS_PROJETO)}
          {lista('amb-forn', 'Fornecedor', 'fornecedor', FORNECEDORES)}
          {campo('amb-bruto', 'Valor bruto (R$)', 'valor_bruto', { obrigatorio: true, input: { type: 'number', step: '0.01', min: '0', inputMode: 'decimal' } })}
          {campo('amb-valor', 'Valor no contrato (R$)', 'valor', { input: { type: 'number', step: '0.01', min: '0', inputMode: 'decimal', placeholder: 'Igual ao bruto' } })}
          {campo('amb-corpo', 'Corpo', 'corpo', { input: { placeholder: 'MDF 15 MM BRANCO TX' } })}
          {campo('amb-porta', 'Porta', 'porta')}
          {campo('amb-comp', 'Complemento', 'complemento')}
          {campo('amb-pux', 'Puxador', 'puxador')}
          {campo('amb-mod', 'Modelo', 'modelo')}
          {campo('amb-qtd', 'Quantidade', 'qtd', { input: { type: 'number', step: '1', min: '1' } })}
          {campo('amb-prazo', 'Prazo (dias úteis)', 'prazo', { input: { type: 'number', step: '1', min: '0' } })}
        </div>
        <p className="ajuda">O valor bruto fica guardado para conferência de margem. No contrato sai o "valor no contrato" (se vazio, o bruto).</p>
        <div className="campo">
          <label htmlFor="amb-obs">Observações</label>
          <textarea id="amb-obs" rows={2} value={a.observacoes || ''} onChange={set('observacoes')} />
        </div>
        <div className="campo xml-campo">
          <span className="rotulo-campo">XML do Promob (uso interno)</span>
          <label className="btn btn-contorno">
            {xml?.arquivo || inicial.xml_path ? 'Trocar XML' : 'Anexar XML'}
            <input type="file" accept=".xml,application/xml,text/xml" hidden onChange={(e) => { escolherXml(e.target.files[0]); e.target.value = '' }} />
          </label>
          {xml?.arquivo && <span className="celula-sub">{xml.arquivo.name}</span>}
          {!xml && inicial.xml_nome && <span className="celula-sub">Atual: {inicial.xml_nome}</span>}
          {xml?.pecas && <span className="dica">Listagem lida: {xml.pecas.total} peças ({xml.pecas.formato}).</span>}
          {xml?.erro && <span className="texto-atraso">{xml.erro}</span>}
        </div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
          <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar ambiente'}</button>
        </div>
      </form>
    </div>
  )
}

// Listagem de peças do XML (informação técnica interna; nunca vai para o cliente)
export function ListaPecas({ ambiente, onFechar }) {
  const p = ambiente._xml?.pecas || ambiente.pecas
  const [busca, setBusca] = useState('')
  if (!p) return null
  const t = busca.trim().toLowerCase()
  const itens = t ? p.itens.filter((i) => JSON.stringify(i).toLowerCase().includes(t)) : p.itens
  return (
    <div className="modal" role="presentation" onClick={onFechar}>
      <div className="confirmar-exclusao lista-pecas" role="dialog" aria-modal="true" aria-labelledby="pc-t" onClick={(e) => e.stopPropagation()}>
        <div className="cab-linha">
          <div>
            <span className="rotulo">Uso interno · {ambiente.xml_nome || ambiente._xml?.arquivo?.name}</span>
            <h2 id="pc-t">Peças — {ambiente.nome}</h2>
          </div>
          <button type="button" className="btn btn-leve" onClick={onFechar}>Fechar</button>
        </div>
        <input type="search" placeholder="Buscar peça" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar peça" />
        <p className="celula-sub">{itens.length} de {p.total} peças{p.cortado ? ' (o arquivo tem mais; mostramos as primeiras 5.000)' : ''} · formato {p.formato}</p>
        <div className="tabela-wrap">
          <table className="tabela tabela-pecas">
            <thead><tr><th>#</th>{p.colunas.map((c) => <th key={c}>{COLUNAS_PADRAO[c]}</th>)}</tr></thead>
            <tbody>
              {itens.slice(0, 1000).map((i, n) => (
                <tr key={n} title={i.extras ? Object.entries(i.extras).map(([k, v]) => `${k}: ${v}`).join('\n') : undefined}>
                  <td className="num">{n + 1}</td>
                  {p.colunas.map((c) => <td key={c}>{i[c] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
