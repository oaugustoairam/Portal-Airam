import { useState } from 'react'
import { api } from '../../lib/api.js'
import { errosLead, errosAgendamento } from '../../lib/apiComercial.js'
import { diaLocal } from '../../lib/comercial.js'
import { formatarTelefone } from '../../lib/constants.js'
import { Janela, Campo, EscolherArquivos, Escolha, useComercial } from './comum.jsx'

// Novo lead (com anexos e agendamento opcional) ou "Editar dados" de um lead
export default function LeadForm({ lead, onFechar, onSalvo }) {
  const { listas, vendedores, lojas, acoes, perfil } = useComercial()
  const novo = !lead
  const [f, setF] = useState(() => ({
    nome: lead?.nome || '', telefone: lead?.telefone ? formatarTelefone(lead.telefone) : '', email: lead?.email || '',
    origem_id: lead?.origem_id || '', vendedor_id: lead?.vendedor_id || (acoes.todos ? '' : perfil.id), conversa_texto: lead?.conversa_texto || '',
  }))
  const [anexos, setAnexos] = useState({ plantas: [], referencias: [], conversa: [] })
  const [conversaModo, setConversaModo] = useState('texto')
  const [agendar, setAgendar] = useState(false)
  const lojasFisicas = lojas.filter((l) => l.id !== 'online')
  const [ag, setAg] = useState({ data: diaLocal(new Date()), hora: '10:00', modalidade: 'loja', loja_id: lojasFisicas[0]?.id || '' })
  const [tentou, setTentou] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const origens = listas.origens_lead.filter((o) => o.ativa || o.id === lead?.origem_id)

  const erros = tentou ? { ...errosLead({ ...f, vendedor_id: novo ? f.vendedor_id : 'ok' }), ...(novo && !f.origem_id ? { origem_id: 'Escolha a origem.' } : {}) } : {}
  const errosAg = tentou && agendar ? errosAgendamento(ag) : {}
  const muda = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  async function salvar() {
    setTentou(true)
    setErro('')
    const e1 = { ...errosLead({ ...f, vendedor_id: novo ? f.vendedor_id : 'ok' }), ...(novo && !f.origem_id ? { origem_id: 'Escolha a origem.' } : {}) }
    const e2 = agendar ? errosAgendamento(ag) : {}
    if (Object.keys(e1).length || Object.keys(e2).length) return setErro('Confira os campos marcados.')
    setOcupado(true)
    try {
      const dados = { ...f, conversa_texto: conversaModo === 'texto' ? f.conversa_texto : novo ? null : f.conversa_texto }
      if (novo) {
        const r = await api.criarLead(dados, { ...anexos, conversa: conversaModo === 'arquivo' ? anexos.conversa : [] }, agendar ? ag : null)
        const v = vendedores.find((x) => x.id === f.vendedor_id)
        onSalvo(`Lead cadastrado e enviado para ${v?.nome || v?.email || 'o vendedor'}` + (r.problemas.length ? `. Atenção: ${r.problemas.join('; ')}` : ''), r.id)
      } else {
        await api.salvarLead(lead.id, dados)
        onSalvo('Dados do lead salvos')
      }
    } catch (e) {
      setErro(e.message)
      setOcupado(false)
    }
  }

  return (
    <Janela titulo={novo ? 'Novo lead' : `Editar dados · ${lead.nome}`} rotulo="Comercial" largura="grande" ocupado={ocupado} onFechar={onFechar} onSubmit={salvar}
      rodape={<>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="button" className="btn btn-leve" onClick={onFechar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-principal" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="grade grade-2">
        <Campo id="ld-nome" rotulo="Nome do cliente" obrigatorio erro={erros.nome}>
          <input id="ld-nome" value={f.nome} onChange={muda('nome')} maxLength={150} autoComplete="off" />
        </Campo>
        <Campo id="ld-tel" rotulo="Telefone / WhatsApp" obrigatorio erro={erros.telefone}>
          <input id="ld-tel" type="tel" inputMode="tel" placeholder="(11) 98888-7777" value={f.telefone}
            onChange={(e) => setF((x) => ({ ...x, telefone: formatarTelefone(e.target.value) }))} />
        </Campo>
        <Campo id="ld-email" rotulo="E-mail" erro={erros.email}>
          <input id="ld-email" type="email" value={f.email} onChange={muda('email')} autoComplete="off" />
        </Campo>
        <Campo id="ld-origem" rotulo="Origem" obrigatorio={novo} erro={erros.origem_id}>
          <select id="ld-origem" value={f.origem_id || ''} onChange={muda('origem_id')}>
            <option value="">Escolha…</option>
            {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </Campo>
        {novo && (
          <Campo id="ld-vend" rotulo="Vendedor responsável" obrigatorio erro={erros.vendedor_id}>
            <select id="ld-vend" value={f.vendedor_id} onChange={muda('vendedor_id')} disabled={!acoes.todos}>
              <option value="">Escolha…</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome || v.email}</option>)}
            </select>
          </Campo>
        )}
      </div>

      {novo && (
        <>
          <EscolherArquivos id="ld-plantas" rotulo="Planta do imóvel" aceitar="image/*,application/pdf,.dwg" arquivos={anexos.plantas} onChange={(x) => setAnexos((a) => ({ ...a, plantas: x }))} ajuda="PDF, imagem ou DWG; pode enviar vários." />
          <EscolherArquivos id="ld-refs" rotulo="Imagens de referência" aceitar="image/*" arquivos={anexos.referencias} onChange={(x) => setAnexos((a) => ({ ...a, referencias: x }))} />
        </>
      )}

      <div className="campo">
        <span className="rotulo-campo">Conversa com o cliente</span>
        {novo && (
          <div className="segmentado" role="radiogroup" aria-label="Como enviar a conversa">
            {[['texto', 'Colar texto'], ['arquivo', 'Enviar arquivo']].map(([k, t]) => (
              <button key={k} type="button" role="radio" aria-checked={conversaModo === k} className={conversaModo === k ? 'ativo' : ''} onClick={() => setConversaModo(k)}>{t}</button>
            ))}
          </div>
        )}
        {conversaModo === 'texto' ? (
          <textarea id="ld-conversa" aria-label="Texto da conversa" rows={novo ? 4 : 6} value={f.conversa_texto} onChange={muda('conversa_texto')} placeholder="Cole aqui a conversa do WhatsApp ou do Instagram" />
        ) : (
          <EscolherArquivos id="ld-conv-arq" rotulo="Arquivo da conversa" aceitar="image/*,application/pdf,text/plain,.txt,.zip" arquivos={anexos.conversa}
            onChange={(x) => setAnexos((a) => ({ ...a, conversa: x }))} ajuda="O .txt ou .zip exportado do WhatsApp, print ou PDF." />
        )}
      </div>

      {novo && (
        <fieldset className="grupo">
          <legend>Agendamento</legend>
          <label className="check"><input type="checkbox" checked={agendar} onChange={(e) => setAgendar(e.target.checked)} /> Já agendar atendimento</label>
          {agendar && <CamposAgendamento ag={ag} setAg={setAg} erros={errosAg} lojas={lojasFisicas} prefixo="ld" />}
        </fieldset>
      )}
    </Janela>
  )
}

export function CamposAgendamento({ ag, setAg, erros = {}, lojas, prefixo }) {
  return (
    <div className="grade grade-3">
      <Campo id={`${prefixo}-ag-data`} rotulo="Data" obrigatorio erro={erros.data}>
        <input id={`${prefixo}-ag-data`} type="date" value={ag.data} onChange={(e) => setAg((x) => ({ ...x, data: e.target.value }))} />
      </Campo>
      <Campo id={`${prefixo}-ag-hora`} rotulo="Horário" obrigatorio erro={erros.hora}>
        <input id={`${prefixo}-ag-hora`} type="time" step={900} value={ag.hora} onChange={(e) => setAg((x) => ({ ...x, hora: e.target.value }))} />
      </Campo>
      <Escolha id={`${prefixo}-ag-mod`} rotulo="Onde" valor={ag.modalidade} onChange={(v) => setAg((x) => ({ ...x, modalidade: v, loja_id: v === 'online' ? '' : x.loja_id || lojas[0]?.id || '' }))}
        opcoes={[['loja', 'Na loja'], ['online', 'Online']]} />
      {ag.modalidade === 'loja' && (
        <Campo id={`${prefixo}-ag-loja`} rotulo="Qual loja" obrigatorio erro={erros.loja_id}>
          <select id={`${prefixo}-ag-loja`} value={ag.loja_id} onChange={(e) => setAg((x) => ({ ...x, loja_id: e.target.value }))}>
            <option value="">Escolha…</option>
            {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        </Campo>
      )}
    </div>
  )
}
