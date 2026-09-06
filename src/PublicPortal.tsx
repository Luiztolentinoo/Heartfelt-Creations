import { useMemo, useState } from 'react'
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileHeart,
  HeartPulse,
  Home,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  X,
} from 'lucide-react'
import {
  createReportRequest,
  getPublicSession,
  getRequestsForAccount,
  loginPublicAccount,
  logoutPublicSession,
  registerPublicAccount,
  type PublicAccount,
  type ReportRequest,
  type RequestedAccessRole,
} from './lib/publicStorage'

type PublicPage = 'inicio' | 'solicitar' | 'acompanhar' | 'sobre'
type AuthMode = 'login' | 'register'

const PUBLIC_NAV: Array<{ id: PublicPage; label: string; icon: typeof Home }> = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'solicitar', label: 'Solicitar laudo', icon: FileHeart },
  { id: 'acompanhar', label: 'Acompanhar processo', icon: ClipboardCheck },
  { id: 'sobre', label: 'Sobre a UPA', icon: HeartPulse },
]

const ACCESS_OPTIONS: RequestedAccessRole[] = ['Cidadão', 'Enfermeiro', 'Paramédico', 'Médico', 'Psicólogo', 'Direção']

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function statusTone(status: ReportRequest['status']) {
  if (status === 'Aprovado') return 'public-status success'
  if (status === 'Negado' || status === 'Cancelado') return 'public-status danger'
  if (status === 'Agendado' || status === 'Em avaliação') return 'public-status active'
  return 'public-status pending'
}

function AuthModal({ mode, onClose, onAuth }: { mode: AuthMode; onClose: () => void; onAuth: (account: PublicAccount) => void }) {
  const [authMode, setAuthMode] = useState(mode)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [gameId, setGameId] = useState('')
  const [pin, setPin] = useState('')
  const [requestedRole, setRequestedRole] = useState<RequestedAccessRole>('Cidadão')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    setError('')
    setLoading(true)
    try {
      const account = authMode === 'login'
        ? await loginPublicAccount(username, pin)
        : await registerPublicAccount({ username, fullName, gameId, pin, requestedRole })
      onAuth(account)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o acesso.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="public-modal-backdrop" role="presentation">
    <section className="public-modal" role="dialog" aria-modal="true" aria-label="Acesso ao portal da UPA">
      <button className="public-modal-close" onClick={onClose} aria-label="Fechar"><X size={20}/></button>
      <div className="public-auth-brand"><span><HeartPulse size={25}/></span><div><strong>Portal UPA</strong><small>Acesso do cidadão</small></div></div>
      <h2>{authMode === 'login' ? 'Entrar na sua conta' : 'Criar conta simples'}</h2>
      <p className="public-muted">Use seu usuário e uma senha numérica de no mínimo 4 dígitos. Não é necessário e-mail.</p>

      <div className="public-auth-tabs">
        <button className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setError('') }}>Entrar</button>
        <button className={authMode === 'register' ? 'selected' : ''} onClick={() => { setAuthMode('register'); setError('') }}>Criar conta</button>
      </div>

      <div className="public-form-grid single">
        {authMode === 'register' && <>
          <label><span>Nome e sobrenome</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Lucas Almeida" /></label>
          <label><span>ID da cidade</span><input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="Ex.: 5821" /></label>
        </>}
        <label><span>Nome de usuário</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" placeholder="Ex.: lucasalmeida" /></label>
        <label><span>Senha numérica</span><input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Mínimo 4 dígitos" /></label>
        {authMode === 'register' && <label><span>Como você acessará o sistema?</span><select value={requestedRole} onChange={(e) => setRequestedRole(e.target.value as RequestedAccessRole)}>{ACCESS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label>}
      </div>

      {authMode === 'register' && requestedRole !== 'Cidadão' && <div className="public-access-note"><ShieldCheck size={18}/><span>Você poderá usar a área pública normalmente. O acesso profissional só será liberado após aprovação da administração da UPA.</span></div>}
      {error && <p className="public-error">{error}</p>}
      <button className="public-primary wide" disabled={loading} onClick={submit}>{authMode === 'login' ? <LogIn size={18}/> : <UserPlus size={18}/>} {loading ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Criar minha conta'}</button>
    </section>
  </div>
}

function HomePage({ account, go }: { account: PublicAccount | null; go: (page: PublicPage) => void }) {
  return <>
    <section className="public-hero">
      <div className="public-hero-content">
        <span className="public-kicker"><HeartPulse size={16}/> UPA • Atendimento e Saúde</span>
        <h1>Cuidado, organização e acesso simples aos serviços da UPA.</h1>
        <p>Solicite sua avaliação para porte de arma, acompanhe o andamento do processo e consulte suas informações em um único lugar.</p>
        <div className="public-hero-actions">
          <button className="public-primary" onClick={() => go('solicitar')}><FileHeart size={19}/> Solicitar laudo</button>
          <button className="public-secondary" onClick={() => go('acompanhar')}><ClipboardCheck size={19}/> Acompanhar processo</button>
        </div>
        {account && <div className="public-welcome"><CheckCircle2 size={17}/><span>Olá, <strong>{account.fullName}</strong>. Seu acesso público está ativo.</span></div>}
      </div>
      <div className="public-hero-card">
        <div className="public-hero-symbol"><Stethoscope size={46}/></div>
        <strong>Atendimento organizado</strong>
        <p>Seu processo fica registrado desde a solicitação até a conclusão da avaliação.</p>
        <div className="public-mini-stats"><div><span>1</span><small>Solicitação</small></div><div><span>2</span><small>Agendamento</small></div><div><span>3</span><small>Avaliação</small></div></div>
      </div>
    </section>

    <section className="public-section">
      <div className="public-section-heading"><span>COMO FUNCIONA</span><h2>Um processo simples para o cidadão</h2><p>Você não precisa acessar nenhuma área administrativa para acompanhar seu laudo.</p></div>
      <div className="public-service-grid">
        <article><span className="public-card-icon"><UserPlus size={22}/></span><h3>1. Crie sua conta</h3><p>Cadastre nome, sobrenome, ID da cidade, usuário e uma senha numérica simples.</p></article>
        <article><span className="public-card-icon"><CalendarCheck2 size={22}/></span><h3>2. Solicite a avaliação</h3><p>Abra a solicitação para porte de arma e informe o período em que prefere ser atendido.</p></article>
        <article><span className="public-card-icon"><ClipboardCheck size={22}/></span><h3>3. Acompanhe o status</h3><p>Veja quando foi solicitado, quando estiver agendado e o resultado final da avaliação.</p></article>
      </div>
    </section>

    <section className="public-info-strip">
      <div><Clock3 size={24}/><span><strong>Organização do atendimento</strong><small>Agendamentos e avaliações centralizados</small></span></div>
      <div><ShieldCheck size={24}/><span><strong>Privacidade por perfil</strong><small>Cidadãos veem apenas seus próprios processos</small></span></div>
      <div><FileHeart size={24}/><span><strong>Laudo para porte</strong><small>Resultado emitido por profissional autorizado</small></span></div>
    </section>
  </>
}

function RequestPage({ account, requestLogin, onCreated }: { account: PublicAccount | null; requestLogin: () => void; onCreated: () => void }) {
  const [period, setPeriod] = useState<ReportRequest['preferredPeriod']>('Qualquer horário')
  const [notes, setNotes] = useState('')
  const [created, setCreated] = useState<ReportRequest | null>(null)

  function submit() {
    if (!account) return requestLogin()
    const request = createReportRequest(account, period, notes)
    setCreated(request)
    setNotes('')
    onCreated()
  }

  return <section className="public-section public-page-section">
    <div className="public-section-heading align-left"><span>PORTE DE ARMA</span><h2>Solicitar avaliação para laudo</h2><p>Abra sua solicitação e acompanhe o processo pelo próprio portal.</p></div>
    {created ? <div className="public-success-card"><CheckCircle2 size={34}/><div><h3>Solicitação registrada</h3><p>Seu protocolo é <strong>{created.protocol}</strong>. O pedido está aguardando análise para agendamento.</p></div></div> : <div className="public-request-layout">
      <section className="public-panel">
        <div className="public-form-grid">
          <label><span>Nome completo</span><input value={account?.fullName ?? ''} readOnly placeholder="Faça login para preencher" /></label>
          <label><span>ID da cidade</span><input value={account?.gameId ?? ''} readOnly placeholder="Faça login para preencher" /></label>
          <label><span>Finalidade</span><input value="Laudo para porte de arma" readOnly /></label>
          <label><span>Preferência de horário</span><select value={period} onChange={(e) => setPeriod(e.target.value as ReportRequest['preferredPeriod'])}><option>Manhã</option><option>Tarde</option><option>Noite</option><option>Qualquer horário</option></select></label>
          <label className="full"><span>Observações para o agendamento (opcional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Informe alguma observação que ajude no agendamento." /></label>
        </div>
        <button className="public-primary" onClick={submit}>{account ? <FileHeart size={18}/> : <LogIn size={18}/>} {account ? 'Enviar solicitação' : 'Entrar para solicitar'}</button>
      </section>
      <aside className="public-help-card"><ShieldCheck size={25}/><h3>O que acontece depois?</h3><p>A equipe responsável recebe a solicitação, define o agendamento e atualiza o status do processo.</p><ul><li>Solicitado</li><li>Agendado</li><li>Em avaliação</li><li>Aprovado ou negado</li></ul></aside>
    </div>}
  </section>
}

function TrackingPage({ account, requestLogin, refreshKey }: { account: PublicAccount | null; requestLogin: () => void; refreshKey: number }) {
  const requests = useMemo(() => account ? getRequestsForAccount(account.id) : [], [account, refreshKey])

  if (!account) return <section className="public-section public-page-section"><div className="public-empty-state"><ClipboardCheck size={38}/><h2>Acompanhe seus processos</h2><p>Entre na sua conta para visualizar apenas as solicitações vinculadas ao seu usuário.</p><button className="public-primary" onClick={requestLogin}><LogIn size={18}/> Entrar para acompanhar</button></div></section>

  return <section className="public-section public-page-section">
    <div className="public-section-heading align-left"><span>MEUS PROCESSOS</span><h2>Acompanhamento do laudo</h2><p>Consulte o andamento das suas solicitações para porte de arma.</p></div>
    {requests.length === 0 ? <div className="public-empty-state"><FileHeart size={38}/><h3>Nenhuma solicitação encontrada</h3><p>Quando você solicitar uma avaliação, o processo aparecerá aqui.</p></div> : <div className="public-process-list">{requests.map((request) => <article className="public-process-card" key={request.id}>
      <div className="public-process-top"><div><span className="public-protocol">{request.protocol}</span><h3>Laudo para porte de arma</h3><p>Solicitado em {formatDate(request.createdAt)}</p></div><span className={statusTone(request.status)}>{request.status}</span></div>
      <div className="public-process-details"><div><span>Solicitante</span><strong>{request.requesterName}</strong></div><div><span>ID</span><strong>{request.requesterGameId}</strong></div><div><span>Preferência</span><strong>{request.preferredPeriod}</strong></div>{request.appointmentAt && <div><span>Agendamento</span><strong>{formatDate(request.appointmentAt)}</strong></div>}</div>
      <div className="public-timeline"><span className="done"><i/><small>Solicitado</small></span><span className={['Agendado','Em avaliação','Aprovado','Negado'].includes(request.status) ? 'done' : ''}><i/><small>Agendado</small></span><span className={['Em avaliação','Aprovado','Negado'].includes(request.status) ? 'done' : ''}><i/><small>Avaliação</small></span><span className={['Aprovado','Negado'].includes(request.status) ? 'done' : ''}><i/><small>Resultado</small></span></div>
    </article>)}</div>}
  </section>
}

function AboutPage() {
  return <section className="public-section public-page-section"><div className="public-section-heading align-left"><span>UPA SAÚDE</span><h2>Sobre a unidade</h2><p>Portal institucional e de atendimento da UPA dentro da cidade.</p></div><div className="public-about-grid"><article><HeartPulse size={26}/><h3>Atendimento</h3><p>Organização de consultas, avaliações e acompanhamento de processos de saúde.</p></article><article><Stethoscope size={26}/><h3>Equipe profissional</h3><p>Os atendimentos são registrados e direcionados aos profissionais autorizados para cada função.</p></article><article><ShieldCheck size={26}/><h3>Acesso separado</h3><p>A área pública não exibe dados internos, financeiros, administrativos ou informações de integrações.</p></article></div></section>
}

export default function PublicPortal({ onOpenStaff }: { onOpenStaff: () => void }) {
  const [page, setPage] = useState<PublicPage>('inicio')
  const [account, setAccount] = useState<PublicAccount | null>(() => getPublicSession())
  const [auth, setAuth] = useState<AuthMode | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  function go(next: PublicPage) { setPage(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function logout() { logoutPublicSession(); setAccount(null); setPage('inicio') }

  return <div className="public-root">
    <header className="public-header">
      <button className="public-brand" onClick={() => go('inicio')}><span><HeartPulse size={25}/></span><div><strong>UPA Saúde</strong><small>Portal do Cidadão</small></div></button>
      <nav className={mobileOpen ? 'public-nav open' : 'public-nav'}>{PUBLIC_NAV.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon size={16}/>{item.label}</button> })}</nav>
      <div className="public-header-actions">
        {account ? <><span className="public-account-chip"><span>{account.fullName.charAt(0)}</span><small>{account.fullName}</small></span><button className="public-icon-btn" onClick={logout} aria-label="Sair"><LogOut size={18}/></button></> : <><button className="public-text-btn" onClick={() => setAuth('login')}>Entrar</button><button className="public-primary compact" onClick={() => setAuth('register')}>Criar conta</button></>}
        <button className="public-staff-link" onClick={onOpenStaff}>Área da equipe <ChevronRight size={15}/></button>
        <button className="public-mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu"><Menu size={21}/></button>
      </div>
    </header>

    <main>
      {page === 'inicio' && <HomePage account={account} go={go}/>} 
      {page === 'solicitar' && <RequestPage account={account} requestLogin={() => setAuth('login')} onCreated={() => setRefreshKey((value) => value + 1)}/>} 
      {page === 'acompanhar' && <TrackingPage account={account} requestLogin={() => setAuth('login')} refreshKey={refreshKey}/>} 
      {page === 'sobre' && <AboutPage/>}
    </main>

    <footer className="public-footer"><div className="public-brand footer"><span><HeartPulse size={21}/></span><div><strong>UPA Saúde</strong><small>Sistema Integrado</small></div></div><p>Portal público para serviços, solicitações e acompanhamento de atendimento.</p></footer>
    {auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onAuth={setAccount}/>} 
  </div>
}
