import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { CLIENTE_VAZIO, errosCliente, numeros, consultarCep } from '../lib/cadastro.js'
import { AMBIENTE_VAZIO, PAGAMENTO_VAZIO, FORMAS_PAGAMENTO, SEXOS, UFS, gerarParcelas, valorBR, num, montarContratoPdf } from '../lib/contrato.js'
import { FINANCEIRAS, financeira, MEIOS, CAPTACOES } from '../lib/vendas.js'
import { temPermissao } from '../lib/permissoes.js'
import { formatarCpf, formatarTelefone } from '../lib/constants.js'
import { baixarArquivo, nomeArquivo } from '../lib/relatorio.js'
import CampoData from './CampoData.jsx'
import { TabelaAmbientes, AmbienteModal, ListaPecas } from './Ambientes.jsx'

const novaChave = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
const formatarDoc = (v) => {
  const n = numeros(v).slice(0, 14)
  return n.length <= 11 ? formatarCpf(n) : n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, '$1.$2.$3/$4-$5')
}
const ROTULOS_OCR = [['nome', 'Nome completo'], ['cpf', 'CPF'], ['rg', 'RG'], ['nome_mae', 'Nome da mãe'], ['nascimento', 'Data de nascimento']]
const CAMPO_OCR = { nome: 'nome', cpf: 'cpf', rg: 'rg', nome_mae: 'mae', nascimento: 'nascimento' }

// Cadastrar novo cliente / Criar contrato: um formulário só, em seções.
// Ao criar, o banco gera o número do contrato e registra (ou atualiza) o cliente sem duplicar.
export default function NovoContrato({ perfil, clienteInicial, onCriado, onAbrirFicha }) {
  const verTodos = temPermissao(perfil, 'ver_todos')
  const [chave, setChave] = useState(novaChave)
  const [c, setC] = useState(() => {
    const base = Object.fromEntries(Object.entries(clienteInicial || {}).filter(([kk, v]) => kk in CLIENTE_VAZIO && v != null))
    return { ...CLIENTE_VAZIO, ...base, cpf: formatarDoc(base.cpf || '') }
  })
  const [clienteId, setClienteId] = useState(clienteInicial?.id || null)
  const [tentou, setTentou] = useState(false) // depois da 1ª tentativa, a validação acompanha cada mudança
  const [existente, setExistente] = useState(null) // cadastro encontrado com o mesmo CPF/e-mail/telefone
  const [cep, setCep] = useState({ estado: '', msg: '' })
  const [lojas, setLojas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [k, setK] = useState({ data: new Date().toISOString().slice(0, 10), tipo: 'Normal', imovel_pronto: '', loja: '', vendedor_id: '', entregaIgual: true,
    entrega: { cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', edificio: '', referencia: '' }, observacao: '' })
  const [com, setCom] = useState({ captacao: '', financeira: '', meios: [] })
  const [pag, setPag] = useState(PAGAMENTO_VAZIO)
  const [ambientes, setAmbientes] = useState([])
  const [editando, setEditando] = useState(null) // { i, a }
  const [pecas, setPecas] = useState(null)
  const [doc, setDoc] = useState(null) // { arquivo, url, lendo, leitura, erro, guardar }
  const [estado, setEstado] = useState('') // '', 'criando', 'anexando'
  const [erro, setErro] = useState('')
  const [criado, setCriado] = useState(null)
  const enviando = useRef(false)

  useEffect(() => {
    api.lojas().then(setLojas).catch(() => {})
    if (verTodos) api.listarVendedores().then(setVendedores).catch(() => {})
  }, [])

  const setCampo = (campo, fmt) => (e) => {
    const v = e?.target ? e.target.value : e
    setC((x) => ({ ...x, [campo]: fmt ? fmt(v) : v }))
  }

  // procura cadastro existente quando CPF, e-mail ou telefone ficam completos
  async function verificarExistente(campo) {
    const cpf = numeros(c.cpf)
    const busca = { cpf: cpf.length === 11 || cpf.length === 14 ? cpf : null, email: /@.+\./.test(c.email) ? c.email.trim() : null, telefone: numeros(c.telefone).length >= 10 ? c.telefone : null }
    if (!busca[campo]) return
    try {
      const achados = await api.procurarCliente(busca)
      const outro = achados.find((x) => x.id !== clienteId)
      setExistente(outro || null)
    } catch {}
  }
  async function usarExistente() {
    const x = existente
    setClienteId(x.id)
    setExistente(null)
    if (x.posso_ver) {
      const dados = await api.cliente(x.id)
      if (dados) setC((atual) => ({ ...atual, ...Object.fromEntries(Object.entries(dados).filter(([kk, v]) => kk in CLIENTE_VAZIO && v != null)), cpf: formatarDoc(dados.cpf) }))
    }
  }

  async function buscarCep() {
    setCep({ estado: 'buscando', msg: '' })
    const r = await consultarCep(c.cep)
    if (!r.ok) return setCep({ estado: 'erro', msg: r.erro })
    setC((x) => ({ ...x, ...Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v)) }))
    setCep({ estado: 'ok', msg: r.incompleto ? 'Este CEP não traz rua ou bairro. Complete à mão.' : 'Endereço encontrado. Preencha o número e o complemento.' })
  }

  // documento com foto: a leitura só sugere; nada entra no formulário sem o usuário conferir
  async function lerDocumento(arquivo) {
    if (!arquivo) return
    if (doc?.url) URL.revokeObjectURL(doc.url)
    const novo = { arquivo, url: URL.createObjectURL(arquivo), lendo: true, leitura: null, erro: '', guardar: true }
    setDoc(novo)
    try {
      const leitura = await api.lerDocumento(arquivo)
      setDoc({ ...novo, lendo: false, leitura, marcados: Object.fromEntries(ROTULOS_OCR.map(([kk]) => [kk, !!leitura[kk]?.valor && leitura[kk].seguro])) })
    } catch (e) {
      setDoc({ ...novo, lendo: false, erro: e.message })
    }
  }
  function aplicarLeitura() {
    const l = doc.leitura
    const novos = {}
    for (const [kk] of ROTULOS_OCR) {
      if (!doc.marcados[kk] || !l[kk]?.valor) continue
      const campo = CAMPO_OCR[kk]
      novos[campo] = campo === 'cpf' ? formatarDoc(l[kk].valor) : l[kk].valor
    }
    setC((x) => ({ ...x, ...novos }))
    setDoc((d) => ({ ...d, aplicado: true }))
    if (novos.cpf) setTimeout(() => verificarExistente('cpf'), 0)
  }

  const totalContrato = ambientes.reduce((t, a) => t + num(a.valor === '' || a.valor == null ? a.valor_bruto : a.valor) * (num(a.qtd) || 1), 0)
  const fin = financeira(com.financeira)
  const somaParcelas = pag.parcelas.reduce((t, p) => t + num(p.valor), 0)

  const errosC = tentou ? errosCliente(c) : {}
  function validar() {
    const lista = Object.values(errosCliente(c))
    if (!k.loja) lista.push('Escolha a loja ou canal de origem.')
    if (k.tipo === 'Futura' && !k.imovel_pronto) lista.push('Na venda futura, informe quando o imóvel fica pronto.')
    if (!k.entregaIgual && (!k.entrega.endereco || !k.entrega.numero || !k.entrega.cidade)) lista.push('Preencha o endereço de entrega.')
    if (!ambientes.length) lista.push('Cadastre pelo menos um ambiente.')
    if (pag.parcelas.length && Math.abs(somaParcelas - totalContrato) > 0.05) lista.push(`As parcelas somam R$ ${valorBR(somaParcelas)}, mas o contrato é R$ ${valorBR(totalContrato)}.`)
    return lista
  }

  async function criar() {
    if (enviando.current) return // clique repetido
    setErro('')
    setTentou(true)
    if (validar().length) {
      setTimeout(() => document.querySelector('.campo-erro input, .campo-erro select')?.focus(), 0)
      return
    }
    enviando.current = true
    setEstado('criando')
    try {
      const r = await api.criarContrato({
        chave,
        cliente_id: clienteId,
        cliente: { ...c, cpf: numeros(c.cpf), email: c.email.trim() },
        contrato: { ...k, pagamento: pag },
        comercial: { ...com, forma_pagamento: pag.condicao, vencimento_primeira: pag.primeiroVencimento, valor_entrada: pag.entrada },
        ambientes: ambientes.map(({ _xml: x, _chave, ...a }) => a),
      })
      // XMLs e foto do documento seguem depois que o contrato existe
      setEstado('anexando')
      const avisos = []
      if (!r.repetido) {
        const salvos = await api.ambientes(r.id)
        for (const [i, a] of ambientes.entries()) {
          if (!a._xml?.arquivo) continue
          const alvo = salvos.find((s) => s.ordem === i + 1)
          try {
            await api.enviarXmlAmbiente(alvo, a._xml.arquivo)
          } catch (e) {
            avisos.push(`XML de ${a.nome}: ${e.message}`)
          }
        }
        if (doc?.arquivo && doc.guardar) {
          try {
            await api.enviarDocumentoPasta(r.id, 'documento_foto', doc.arquivo)
          } catch (e) {
            avisos.push(`Foto do documento: ${e.message}`)
          }
        }
      }
      setCriado({ ...r, avisos })
      onCriado?.(r)
      window.scrollTo(0, 0)
    } catch (e) {
      setErro(e.message)
    } finally {
      enviando.current = false
      setEstado('')
    }
  }

  async function baixarPdf() {
    try {
      const g = await api.clienteGestao(criado.id)
      const [cliente, ambs] = await Promise.all([api.cliente(g.cliente_id || criado.cliente_id), api.ambientes(criado.id)])
      const k2 = montarContratoPdf({ g, cliente, ambientes: ambs, lojaNome: lojas.find((l) => l.id === g.comercial?.loja)?.nome?.replace('Loja ', '') })
      const { gerarPdfContrato } = await import('./relatorio/PdfContrato.jsx')
      baixarArquivo(await gerarPdfContrato(k2), `contrato-${nomeArquivo(`${g.codigo}-${g.cliente_nome}`)}.pdf`)
    } catch (e) {
      setErro('Não foi possível gerar o PDF: ' + e.message)
    }
  }

  function recomecar() {
    setChave(novaChave())
    setC({ ...CLIENTE_VAZIO })
    setClienteId(null)
    setAmbientes([])
    setPag(PAGAMENTO_VAZIO)
    setCom({ captacao: '', financeira: '', meios: [] })
    setK((x) => ({ ...x, loja: '', imovel_pronto: '', entregaIgual: true, observacao: '' }))
    setDoc(null)
    setTentou(false)
    setCriado(null)
    setErro('')
  }

  if (criado)
    return (
      <section className="gestao novo-contrato">
        <div className="contrato-criado" role="status">
          <span className="rotulo">{criado.repetido ? 'Este contrato já tinha sido criado' : 'Contrato criado'}</span>
          <h1 className="titulo-grande">Contrato nº {criado.codigo}</h1>
          <p>{c.nome} já está na aba Clientes{clienteId ? ' (cadastro existente atualizado)' : ''}. O número foi gerado pelo sistema e não muda.</p>
          {criado.avisos?.length > 0 && <ul className="texto-atraso">{criado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
          <div className="acoes">
            <button className="btn btn-principal" onClick={baixarPdf}>Baixar contrato (PDF)</button>
            <button className="btn btn-contorno" onClick={() => onAbrirFicha?.(criado.id)}>Abrir cadastro do cliente</button>
            <button className="btn btn-leve" onClick={recomecar}>Criar outro contrato</button>
          </div>
          {erro && <p className="erro" role="alert">{erro}</p>}
        </div>
      </section>
    )

  const Campo = ({ id, rotulo, campo, obrig, fmt, ...resto }) => (
    <div className={`campo ${errosC[campo] ? 'campo-erro' : ''}`}>
      <label htmlFor={id}>{rotulo}{obrig && <span className="obrigatorio" aria-hidden="true"> *</span>}</label>
      <input id={id} value={c[campo] ?? ''} onChange={setCampo(campo, fmt)} aria-invalid={!!errosC[campo]} {...resto} />
      {errosC[campo] && <span className="erro-campo">{errosC[campo]}</span>}
    </div>
  )

  return (
    <section className="gestao novo-contrato">
      <div className="cab-linha">
        <div className="titulo-processo">
          <span className="rotulo">Gestão de clientes</span>
          <h1 className="titulo-grande">Novo cliente e contrato</h1>
          <p className="dica">O número do contrato é gerado automaticamente ao criar. Se o cliente já existir, o cadastro é atualizado e o contrato entra nele.</p>
        </div>
      </div>

      {/* 1. Documento */}
      <fieldset className="grupo">
        <legend>Documento do cliente (opcional)</legend>
        <p className="dica">Anexe uma foto do RG ou da CNH para preencher nome, CPF, RG, nome da mãe e nascimento. Você confere tudo antes de usar.</p>
        <div className="acoes">
          <label className="btn btn-contorno">
            {doc ? 'Trocar foto' : 'Anexar RG ou CNH'}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => { lerDocumento(e.target.files[0]); e.target.value = '' }} />
          </label>
          {doc && <label className="check"><input type="checkbox" checked={doc.guardar} onChange={(e) => setDoc((d) => ({ ...d, guardar: e.target.checked }))} /> Guardar a foto na pasta do cliente (Documento com foto)</label>}
        </div>
        {doc && (
          <div className="ocr">
            <img src={doc.url} alt="Documento anexado" className="ocr-foto" />
            <div className="ocr-dados">
              {doc.lendo && <p className="carregando-linha">Lendo o documento…</p>}
              {doc.erro && <p className="aviso-config">{doc.erro}</p>}
              {doc.leitura && (
                <>
                  <p className="dica">{doc.leitura.documento === 'ilegivel' ? 'Não deu para ler este documento.' : doc.leitura.documento === 'outro' ? 'A imagem não parece um RG ou CNH.' : `Encontramos estes dados no ${doc.leitura.documento}. Marque o que deseja usar:`}</p>
                  <ul className="ocr-lista">
                    {ROTULOS_OCR.map(([kk, t]) => {
                      const v = doc.leitura[kk]
                      return (
                        <li key={kk}>
                          <label className="check">
                            <input type="checkbox" disabled={!v?.valor} checked={!!doc.marcados?.[kk]} onChange={(e) => setDoc((d) => ({ ...d, marcados: { ...d.marcados, [kk]: e.target.checked } }))} />
                            <span><strong>{t}:</strong> {v?.valor ? (kk === 'nascimento' ? v.valor.split('-').reverse().join('/') : v.valor) : <em>não identificado</em>}
                              {v?.valor && !v.seguro && <span className="texto-atraso"> · leitura incerta, confira</span>}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  {doc.leitura.observacao && <p className="celula-sub">{doc.leitura.observacao}</p>}
                  <button type="button" className="btn btn-principal" onClick={aplicarLeitura} disabled={!Object.values(doc.marcados || {}).some(Boolean)}>
                    {doc.aplicado ? 'Aplicar de novo' : 'Usar os dados marcados'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {/* 2. Cliente */}
      <fieldset className="grupo">
        <legend>Dados do cliente</legend>
        {clienteId && <p className="aviso-ok">Usando um cadastro existente. Ao criar, os dados abaixo atualizam o cadastro deste cliente. <button type="button" className="link" onClick={() => setClienteId(null)}>Não usar</button></p>}
        {existente && (
          <div className="aviso-existente" role="alert">
            <span>Já existe um cliente com este {existente.motivo === 'cpf' ? 'CPF' : existente.motivo === 'email' ? 'e-mail' : 'telefone'}: <strong>{existente.nome}</strong> ({existente.contratos} {existente.contratos === 1 ? 'contrato' : 'contratos'}).</span>
            <span className="acoes">
              <button type="button" className="btn btn-principal" onClick={usarExistente}>Usar este cadastro</button>
              {existente.motivo !== 'cpf' && <button type="button" className="btn btn-leve" onClick={() => setExistente(null)}>É outra pessoa</button>}
            </span>
          </div>
        )}
        <div className="grade grade-3">
          {Campo({ id: 'nc-nome', rotulo: 'Nome completo', campo: 'nome', obrig: true, autoComplete: 'off' })}
          {Campo({ id: 'nc-cpf', rotulo: 'CPF', campo: 'cpf', obrig: true, fmt: formatarDoc, inputMode: 'numeric', onBlur: () => verificarExistente('cpf') })}
          {Campo({ id: 'nc-rg', rotulo: 'RG', campo: 'rg' })}
          {Campo({ id: 'nc-email', rotulo: 'E-mail', campo: 'email', obrig: true, type: 'email', onBlur: () => verificarExistente('email') })}
          {Campo({ id: 'nc-tel', rotulo: 'Telefone (WhatsApp)', campo: 'telefone', obrig: true, fmt: formatarTelefone, type: 'tel', onBlur: () => verificarExistente('telefone') })}
          {Campo({ id: 'nc-tel2', rotulo: 'Telefone 2', campo: 'telefone2', fmt: formatarTelefone, type: 'tel' })}
          {Campo({ id: 'nc-mae', rotulo: 'Nome da mãe', campo: 'mae' })}
          <CampoData id="nc-nasc" rotulo="Data de nascimento" valor={c.nascimento} onChange={setCampo('nascimento')} />
          <div className="campo">
            <label htmlFor="nc-sexo">Sexo</label>
            <select id="nc-sexo" value={c.sexo} onChange={setCampo('sexo')}>
              <option value="">—</option>
              {SEXOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {Campo({ id: 'nc-prof', rotulo: 'Profissão', campo: 'profissao' })}
        </div>
      </fieldset>

      {/* 3. Endereço */}
      <fieldset className="grupo">
        <legend>Endereço</legend>
        <div className="grade grade-3">
          <div className={`campo ${errosC.cep ? 'campo-erro' : ''}`}>
            <label htmlFor="nc-cep">CEP</label>
            <div className="campo-busca">
              <input id="nc-cep" inputMode="numeric" value={c.cep} placeholder="00000-000"
                onChange={(e) => setC((x) => ({ ...x, cep: numeros(e.target.value).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2') }))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), buscarCep())} />
              <button type="button" className="btn btn-contorno btn-lupa" onClick={buscarCep} disabled={cep.estado === 'buscando'} aria-label="Buscar endereço pelo CEP" title="Buscar endereço pelo CEP">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
              </button>
            </div>
            {cep.msg && <span className={cep.estado === 'erro' ? 'erro-campo' : 'ajuda'}>{cep.msg}</span>}
          </div>
          {Campo({ id: 'nc-rua', rotulo: 'Rua / avenida', campo: 'logradouro', obrig: true })}
          {Campo({ id: 'nc-num', rotulo: 'Número', campo: 'numero', obrig: true })}
          {Campo({ id: 'nc-comp', rotulo: 'Complemento', campo: 'complemento', placeholder: 'Apto, bloco' })}
          {Campo({ id: 'nc-bairro', rotulo: 'Bairro', campo: 'bairro' })}
          {Campo({ id: 'nc-cidade', rotulo: 'Cidade', campo: 'cidade', obrig: true })}
          <div className={`campo ${errosC.uf ? 'campo-erro' : ''}`}>
            <label htmlFor="nc-uf">Estado<span className="obrigatorio" aria-hidden="true"> *</span></label>
            <select id="nc-uf" value={c.uf} onChange={setCampo('uf')} aria-invalid={!!errosC.uf}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
            {errosC.uf && <span className="erro-campo">{errosC.uf}</span>}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={k.entregaIgual} onChange={(e) => setK((x) => ({ ...x, entregaIgual: e.target.checked }))} />
          Os móveis serão entregues neste endereço
        </label>
        {!k.entregaIgual && (
          <div className="grade grade-3">
            {[['endereco', 'Rua (entrega)'], ['numero', 'Número'], ['complemento', 'Complemento'], ['edificio', 'Edifício'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['uf', 'UF'], ['cep', 'CEP'], ['referencia', 'Referência']].map(([kk, t]) => (
              <div className="campo" key={kk}>
                <label htmlFor={`nc-ent-${kk}`}>{t}</label>
                <input id={`nc-ent-${kk}`} value={k.entrega[kk] || ''} onChange={(e) => setK((x) => ({ ...x, entrega: { ...x.entrega, [kk]: e.target.value } }))} />
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* 4. Venda */}
      <fieldset className="grupo">
        <legend>Venda</legend>
        <div className="campo">
          <span className="rotulo-campo" id="nc-loja-r">Loja ou canal de origem<span className="obrigatorio" aria-hidden="true"> *</span></span>
          <div className="cartoes-escolha" role="radiogroup" aria-labelledby="nc-loja-r">
            {lojas.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={k.loja === l.id} className={`cartao-escolha ${k.loja === l.id ? 'ativo' : ''}`}
                onClick={() => setK((x) => ({ ...x, loja: l.id }))}>
                <span className="cartao-escolha-marca" aria-hidden="true" />{l.nome}
              </button>
            ))}
          </div>
        </div>
        <div className="grade grade-3">
          <div className="campo">
            <span className="rotulo-campo">Vendedor responsável</span>
            {verTodos ? (
              <select value={k.vendedor_id} onChange={(e) => setK((x) => ({ ...x, vendedor_id: e.target.value }))} aria-label="Vendedor responsável">
                <option value="">{perfil.nome || perfil.email} (você)</option>
                {vendedores.filter((v) => v.id !== perfil.id).map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
              </select>
            ) : <strong className="valor-fixo">{perfil.nome || perfil.email}</strong>}
          </div>
          <CampoData id="nc-data" rotulo="Data do contrato" valor={k.data} onChange={(v) => setK((x) => ({ ...x, data: v }))} />
          <div className="campo">
            <label htmlFor="nc-capt">Captação</label>
            <input id="nc-capt" list="nc-captacoes" value={com.captacao} onChange={(e) => setCom((x) => ({ ...x, captacao: e.target.value.toUpperCase() }))} />
            <datalist id="nc-captacoes">{CAPTACOES.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="campo">
            <span className="rotulo-campo">Tipo de contrato</span>
            <div className="segmentado" role="radiogroup" aria-label="Tipo de contrato">
              {['Normal', 'Futura'].map((t) => <button key={t} type="button" role="radio" aria-checked={k.tipo === t} className={k.tipo === t ? 'ativo' : ''} onClick={() => setK((x) => ({ ...x, tipo: t }))}>{t}</button>)}
            </div>
          </div>
          {k.tipo === 'Futura' && <CampoData id="nc-pronto" rotulo="Imóvel pronto em" valor={k.imovel_pronto} onChange={(v) => setK((x) => ({ ...x, imovel_pronto: v }))} />}
        </div>
      </fieldset>

      {/* 5. Ambientes */}
      <fieldset className="grupo">
        <legend>Ambientes</legend>
        <div className="cab-linha">
          <p className="dica">Cada ambiente com nome, valor bruto e, se tiver, o XML do Promob (listagem de peças, uso interno).</p>
          <button type="button" className="btn btn-principal" onClick={() => setEditando({ i: -1, a: { ...AMBIENTE_VAZIO, _chave: novaChave() } })}>Adicionar ambiente</button>
        </div>
        <TabelaAmbientes itens={ambientes} onEditar={(a, i) => setEditando({ i, a })} onPecas={setPecas}
          onRemover={(a, i) => setAmbientes((x) => x.filter((_, j) => j !== i))} />
      </fieldset>

      {/* 6. Pagamento */}
      <fieldset className="grupo">
        <legend>Pagamento</legend>
        <div className="grade grade-3">
          <div className="campo">
            <label htmlFor="nc-fin">Financeira</label>
            <select id="nc-fin" value={com.financeira} onChange={(e) => setCom((x) => ({ ...x, financeira: e.target.value }))}>
              <option value="">—</option>
              {FINANCEIRAS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="nc-cond">Condição</label>
            <input id="nc-cond" list="nc-condicoes" value={pag.condicao} onChange={(e) => setPag((x) => ({ ...x, condicao: e.target.value }))} placeholder="15 s/ entrada" />
            <datalist id="nc-condicoes">{(fin?.formas || ['À vista', '1 + 10', '10 s/ entrada', '15 s/ entrada']).map((f) => <option key={f} value={f} />)}</datalist>
          </div>
          <div className="campo">
            <label htmlFor="nc-forma">Forma de pagamento</label>
            <select id="nc-forma" value={pag.forma} onChange={(e) => setPag((x) => ({ ...x, forma: e.target.value }))}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <CampoData id="nc-venc" rotulo="1º vencimento" valor={pag.primeiroVencimento} onChange={(v) => setPag((x) => ({ ...x, primeiroVencimento: v }))} />
          {/\+/.test(pag.condicao) && (
            <div className="campo">
              <label htmlFor="nc-ent">Entrada (R$)</label>
              <input id="nc-ent" type="number" step="0.01" inputMode="decimal" value={pag.entrada} onChange={(e) => setPag((x) => ({ ...x, entrada: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="campo">
          <span className="rotulo-campo">Meios de pagamento</span>
          <div className="chips-escolha">
            {MEIOS.map(([kk, t]) => {
              const ativo = com.meios.includes(kk)
              return <button key={kk} type="button" aria-pressed={ativo} className={`chip-escolha ${ativo ? 'ativo' : ''}`}
                onClick={() => setCom((x) => ({ ...x, meios: ativo ? x.meios.filter((m) => m !== kk) : [...x.meios, kk] }))}>{t}</button>
            })}
          </div>
        </div>
        <div className="acoes">
          <button type="button" className="btn btn-contorno" disabled={!totalContrato || !pag.condicao}
            onClick={() => setPag((x) => ({ ...x, parcelas: gerarParcelas(totalContrato, x.condicao, x.primeiroVencimento, x.entrada) }))}>Gerar parcelas</button>
          <span className="celula-sub">Total do contrato: R$ {valorBR(totalContrato)}</span>
        </div>
        {pag.parcelas.length > 0 && (
          <div className="tabela-wrap">
            <table className="tabela tabela-parcelas">
              <thead><tr><th>PC</th><th>Vencimento</th><th>Valor (R$)</th><th /></tr></thead>
              <tbody>
                {pag.parcelas.map((p, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td><input type="date" value={p.venc} aria-label={`Vencimento da parcela ${i + 1}`} onChange={(e) => setPag((x) => ({ ...x, parcelas: x.parcelas.map((y, j) => (j === i ? { ...y, venc: e.target.value } : y)) }))} /></td>
                    <td><input type="number" step="0.01" value={p.valor} aria-label={`Valor da parcela ${i + 1}`} onChange={(e) => setPag((x) => ({ ...x, parcelas: x.parcelas.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)) }))} /></td>
                    <td><button type="button" className="btn btn-leve" onClick={() => setPag((x) => ({ ...x, parcelas: x.parcelas.filter((_, j) => j !== i) }))}>Tirar</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>Soma</td><td className={`num ${Math.abs(somaParcelas - totalContrato) > 0.05 ? 'texto-atraso' : ''}`}>{valorBR(somaParcelas)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
        <div className="campo">
          <label htmlFor="nc-obs">Observação</label>
          <textarea id="nc-obs" rows={2} value={k.observacao} onChange={(e) => setK((x) => ({ ...x, observacao: e.target.value }))} />
        </div>
      </fieldset>

      {tentou && validar().length > 0 && (
        <div className="falta-caixa" role="alert">
          <strong>Antes de criar, falta:</strong>
          <ul>{validar().map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="acoes acoes-venda">
        <button type="button" className="btn btn-principal" onClick={criar} disabled={!!estado}>
          {estado === 'criando' ? 'Criando o contrato…' : estado === 'anexando' ? 'Enviando arquivos…' : 'Criar contrato'}
        </button>
      </div>

      {editando && (
        <AmbienteModal inicial={editando.a} novo={editando.i < 0} onFechar={() => setEditando(null)}
          onSalvar={async (a, xml) => {
            const item = { ...a, _xml: xml || editando.a._xml }
            setAmbientes((x) => (editando.i < 0 ? [...x, item] : x.map((y, j) => (j === editando.i ? item : y))))
            setEditando(null)
          }} />
      )}
      {pecas && <ListaPecas ambiente={pecas} onFechar={() => setPecas(null)} />}
    </section>
  )
}
