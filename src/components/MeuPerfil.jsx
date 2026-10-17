import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { formatarCpf } from '../lib/constants.js'
import CampoData from './CampoData.jsx'
import Avatar from './Avatar.jsx'

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')

function formatarTelefone(v) {
  const n = String(v || '').replace(/\D/g, '').slice(0, 11)
  if (n.length <= 2) return n
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}
const formatarCep = (v) => String(v || '').replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2')

// Corta a foto no centro (quadrado) e reduz para 512px em JPEG, para enviar leve
function prepararFoto(arquivo) {
  return new Promise((ok, erro) => {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(arquivo.type) && !/\.(jpe?g|png|webp|heic)$/i.test(arquivo.name))
      return erro(new Error('Escolha uma imagem (JPG, PNG ou WEBP).'))
    const img = new Image()
    const url = URL.createObjectURL(arquivo)
    img.onload = () => {
      const lado = Math.min(img.width, img.height)
      const c = document.createElement('canvas')
      c.width = c.height = 512
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 512, 512)
      URL.revokeObjectURL(url)
      c.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.85)
    }
    img.onerror = () => erro(new Error('Não foi possível abrir esta imagem. Tente uma foto em JPG ou PNG.'))
    img.src = url
  })
}

export default function MeuPerfil({ processo, onAtualizado }) {
  const [f, setF] = useState(null)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const arquivo = useRef(null)

  useEffect(() => {
    api.meuPerfil().then((p) =>
      setF({
        ...p,
        // começa com o que a loja já tem no cadastro
        telefone: p.telefone || processo?.cliente_telefone || '',
        nascimento: p.nascimento || processo?.cliente_nascimento || '',
        nome_preferido: p.nome_preferido || processo?.cliente_nome?.split(' ')[0] || '',
        cep: formatarCep(p.cep),
      })
    )
  }, [])

  if (!f) return <div className="carregando">Carregando seu perfil…</div>

  const set = (k, fmt) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setF((x) => ({ ...x, [k]: fmt ? fmt(v) : v }))
  }
  const avisar = (t) => {
    setMsg(t)
    setTimeout(() => setMsg(''), 3000)
  }

  async function buscarCep(cep) {
    const n = cep.replace(/\D/g, '')
    if (n.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${n}/json/`)
      const d = await r.json()
      if (d.erro) return
      setF((x) => ({ ...x, endereco: d.logradouro || x.endereco, bairro: d.bairro || x.bairro, cidade: d.localidade || x.cidade, uf: d.uf || x.uf }))
    } catch {}
  }

  async function trocarFoto(e) {
    const a = e.target.files?.[0]
    e.target.value = ''
    if (!a) return
    setErro('')
    setEnviandoFoto(true)
    try {
      const blob = await prepararFoto(a)
      const caminho = await api.enviarFotoPerfil(blob)
      setF((x) => ({ ...x, foto_path: caminho }))
      onAtualizado?.()
      avisar('Foto atualizada')
    } catch (err) {
      setErro(err.message)
    } finally {
      setEnviandoFoto(false)
    }
  }

  async function removerFoto() {
    await api.removerFotoPerfil()
    setF((x) => ({ ...x, foto_path: null }))
    onAtualizado?.()
  }

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const tel = f.telefone.replace(/\D/g, '')
    if (tel && tel.length < 10) return setErro('Informe o celular com DDD.')
    setSalvando(true)
    try {
      const { email, ...dados } = f
      await api.salvarMeuPerfil(dados)
      onAtualizado?.()
      avisar('Perfil salvo')
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="perfil">
      <header className="perfil-cab">
        <div className="perfil-foto">
          <Avatar caminho={f.foto_path} nome={processo?.cliente_nome || f.nome_preferido} tamanho={132} />
          {enviandoFoto && <span className="perfil-foto-carregando" aria-label="Enviando foto" />}
        </div>
        <div className="perfil-cab-texto">
          <span className="rotulo-mono">Meu perfil</span>
          <h1 className="titulo-grande">{processo?.cliente_nome || f.nome_preferido}</h1>
          <div className="acoes">
            <input ref={arquivo} id="perfil-foto" type="file" accept="image/*" hidden onChange={trocarFoto} />
            <button type="button" className="btn btn-principal" onClick={() => arquivo.current?.click()} disabled={enviandoFoto}>
              {f.foto_path ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {f.foto_path && <button type="button" className="btn btn-leve" onClick={removerFoto}>Remover foto</button>}
          </div>
        </div>
        {msg && <span className="toast" role="status">{msg}</span>}
      </header>

      <form className="form perfil-form" onSubmit={salvar}>
        <fieldset className="grupo">
          <legend>Seus dados</legend>
          <div className="grade">
            <div className="campo">
              <label htmlFor="pf-nome">Como prefere ser chamado(a)</label>
              <input id="pf-nome" maxLength={80} value={f.nome_preferido || ''} onChange={set('nome_preferido')} />
            </div>
            <CampoData id="pf-nasc" rotulo="Data de nascimento" valor={f.nascimento} onChange={set('nascimento')} />
            <div className="campo">
              <label htmlFor="pf-tel">Celular / WhatsApp</label>
              <input id="pf-tel" inputMode="tel" autoComplete="tel" value={f.telefone || ''} onChange={set('telefone', formatarTelefone)} placeholder="(11) 90000-0000" />
              <span className="ajuda">Usado para os avisos do seu processo</span>
            </div>
            <div className="campo">
              <label htmlFor="pf-tel2">Outro telefone (opcional)</label>
              <input id="pf-tel2" inputMode="tel" value={f.telefone_2 || ''} onChange={set('telefone_2', formatarTelefone)} />
            </div>
          </div>
          <div className="grade">
            <div className="campo">
              <label htmlFor="pf-email">E-mail de acesso</label>
              <input id="pf-email" value={f.email || ''} readOnly className="somente-leitura" />
              <span className="ajuda">Para trocar o e-mail, fale com a Airam pelo WhatsApp.</span>
            </div>
            <div className="campo">
              <label htmlFor="pf-cpf">CPF</label>
              <input id="pf-cpf" value={processo?.cliente_cpf ? formatarCpf(processo.cliente_cpf) : '—'} readOnly className="somente-leitura" />
            </div>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Endereço para correspondência</legend>
          <div className="grade grade-endereco">
            <div className="campo">
              <label htmlFor="pf-cep">CEP</label>
              <input id="pf-cep" inputMode="numeric" autoComplete="postal-code" value={f.cep || ''}
                onChange={(e) => { const v = formatarCep(e.target.value); setF((x) => ({ ...x, cep: v })); buscarCep(v) }} placeholder="00000-000" />
            </div>
            <div className="campo campo-largo">
              <label htmlFor="pf-end">Rua / avenida</label>
              <input id="pf-end" autoComplete="address-line1" value={f.endereco || ''} onChange={set('endereco')} />
            </div>
            <div className="campo">
              <label htmlFor="pf-num">Número</label>
              <input id="pf-num" value={f.numero || ''} onChange={set('numero')} />
            </div>
            <div className="campo">
              <label htmlFor="pf-comp">Complemento</label>
              <input id="pf-comp" value={f.complemento || ''} onChange={set('complemento')} placeholder="Apto, bloco" />
            </div>
            <div className="campo">
              <label htmlFor="pf-bairro">Bairro</label>
              <input id="pf-bairro" value={f.bairro || ''} onChange={set('bairro')} />
            </div>
            <div className="campo">
              <label htmlFor="pf-cidade">Cidade</label>
              <input id="pf-cidade" autoComplete="address-level2" value={f.cidade || ''} onChange={set('cidade')} />
            </div>
            <div className="campo">
              <label htmlFor="pf-uf">UF</label>
              <select id="pf-uf" value={f.uf || ''} onChange={set('uf')}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {processo?.endereco && <p className="dica">Endereço da obra (cadastrado pela Airam): {processo.endereco}</p>}
        </fieldset>

        <fieldset className="grupo">
          <legend>Para a medição e a montagem</legend>
          <div className="campo">
            <label htmlFor="pf-hora">Melhor dia e horário para falarmos com você</label>
            <input id="pf-hora" value={f.melhor_horario || ''} onChange={set('melhor_horario')} placeholder="Ex.: dias úteis, depois das 18h" />
          </div>
          <div className="campo">
            <label htmlFor="pf-obs">Informações sobre o imóvel</label>
            <textarea id="pf-obs" rows={4} maxLength={1000} value={f.observacoes || ''} onChange={set('observacoes')}
              placeholder="Portaria, elevador de serviço, vaga para descarga, horários do condomínio, animais de estimação…" />
            <span className="ajuda num">{(f.observacoes || '').length}/1000</span>
          </div>
        </fieldset>

        <fieldset className="grupo">
          <legend>Preferências</legend>
          <label className="check">
            <input type="checkbox" checked={f.receber_novidades !== false} onChange={set('receber_novidades')} />
            Quero receber novidades e lançamentos da Airam por e-mail
          </label>
          <p className="dica">Os avisos sobre o andamento do seu processo continuam chegando normalmente.</p>
        </fieldset>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes perfil-salvar">
          <button className="btn btn-principal" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar perfil'}</button>
        </div>
      </form>

      <TrocarSenhaPerfil />
    </section>
  )
}

function TrocarSenhaPerfil() {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')
  const regras = [
    [senha.length >= 8, 'Pelo menos 8 caracteres'],
    [/[A-Za-z]/.test(senha) && /\d/.test(senha), 'Letras e números'],
    [senha.length > 0 && senha === confirma, 'As duas senhas são iguais'],
  ]
  async function salvar(e) {
    e.preventDefault()
    if (!regras.every(([ok]) => ok)) return
    setErro('')
    try {
      await api.trocarSenha(senha)
      setMsg('Senha alterada.')
      setSenha('')
      setConfirma('')
      setAberto(false)
    } catch (err) {
      setErro(err.message)
    }
  }
  return (
    <fieldset className="grupo">
      <legend>Segurança</legend>
      {!aberto ? (
        <div className="acoes">
          <button type="button" className="btn btn-contorno" onClick={() => { setAberto(true); setMsg('') }}>Trocar minha senha</button>
          {msg && <span className="dica">{msg}</span>}
        </div>
      ) : (
        <form className="form" onSubmit={salvar}>
          <div className="grade">
            <div className="campo">
              <label htmlFor="ps-nova">Nova senha</label>
              <input id="ps-nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="ps-conf">Repita a nova senha</label>
              <input id="ps-conf" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
            </div>
          </div>
          <ul className="regras">
            {regras.map(([ok, t]) => <li key={t} className={ok ? 'regra-ok' : ''}>{ok ? '✓' : '·'} {t}</li>)}
          </ul>
          {erro && <p className="erro">{erro}</p>}
          <div className="acoes">
            <button className="btn btn-principal" disabled={!regras.every(([ok]) => ok)}>Salvar nova senha</button>
            <button type="button" className="btn btn-leve" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </fieldset>
  )
}
