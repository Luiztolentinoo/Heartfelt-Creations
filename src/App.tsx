import { useMemo, useState } from 'react'
import {
  Activity,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  History,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { can, demoUsers } from './lib/permissions'
import { getAppointments, getKitPurchases, getPatients, getReports, saveKitPurchase, saveReport, updateKitPurchase } from './lib/storage'
import type { KitPurchase, MedicalReport, Permission, StaffUser } from './types'

const MONEY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const UNIT_PURCHASE_COST = 250
const UNIT_SALE_PRICE = 1600
const UNIT_HOSPITAL_RETURN = 300

type Page = 'dashboard' | 'agenda' | 'pacientes' | 'laudos' | 'kits' | 'financeiro' | 'funcionarios' | 'auditoria' | 'integracoes'

type NavItem = {
  id: Page
  label: string
  icon: typeof Activity
  anyPermission?: Permission[]
}

const nav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, anyPermission: ['view_dashboard'] },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, anyPermission: ['view_appointments'] },
  { id: 'pacientes', label: 'Pacientes', icon: Users, anyPermission: ['view_patients'] },
  { id: 'laudos', label: 'Laudos', icon: FileCheck2, anyPermission: ['view_reports'] },
  { id: 'kits', label: 'Controle de Kits', icon: Boxes, anyPermission: ['manage_kits', 'confirm_kit_returns', 'view_finance'] },
  { id: 'financeiro', label: 'Financeiro', icon: BadgeDollarSign, anyPermission: ['view_finance'] },
  { id: 'funcionarios', label: 'Funcionários', icon: UserCog, anyPermission: ['manage_staff'] },
  { id: 'auditoria', label: 'Auditoria', icon: History, anyPermission: ['view_audit'] },
  { id: 'integracoes', label: 'Integrações', icon: Settings, anyPermission: ['manage_integrations', 'manage_system'] },
]

function hasAny(user: StaffUser, permissions?: Permission[]) {
  return !permissions || permissions.some((permission) => can(user, permission))
}

function protocol() {
  const year = new Date().getFullYear()
  return `KIT-${year}-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function Login({ onLogin }: { onLogin: (user: StaffUser) => void }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark"><HeartPulse size={34} /></div>
        <p className="eyebrow">SISTEMA INTEGRADO</p>
        <h1>UPA Saúde</h1>
        <p className="muted login-copy">Gestão clínica, administrativa e financeira da unidade.</p>
        <div className="login-note">
          <ShieldCheck size={18} />
          <span>Preview inicial. Escolha um perfil para validar cargos e permissões.</span>
        </div>
        <div className="profile-grid">
          {demoUsers.map((user) => (
            <button className="profile-button" key={user.id} onClick={() => onLogin(user)}>
              <span className="profile-avatar">{user.name.slice(0, 1)}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.clinicalFunction} • {user.hierarchyRole}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function Stat({ label, value, helper, icon: Icon }: { label: string; value: string; helper?: string; icon: typeof Activity }) {
  return (
    <article className="stat-card">
      <div className="stat-icon"><Icon size={21} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </div>
    </article>
  )
}

function Dashboard({ kits }: { kits: KitPurchase[] }) {
  const appointments = getAppointments()
  const patients = getPatients()
  const reports = getReports()
  const pending = kits.filter((kit) => kit.status === 'Pendente')
  const returnDue = pending.reduce((sum, item) => sum + item.hospitalReturnDue, 0)

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">VISÃO GERAL</p><h2>Painel da UPA</h2><p className="muted">Acompanhe os principais indicadores da unidade.</p></div>
      </header>
      <section className="stats-grid">
        <Stat icon={CalendarDays} label="Consultas agendadas" value={String(appointments.filter((a) => a.status === 'Agendada').length)} helper="agenda atual" />
        <Stat icon={Users} label="Pacientes" value={String(patients.length)} helper="cadastrados" />
        <Stat icon={FileCheck2} label="Laudos emitidos" value={String(reports.length)} helper="histórico" />
        <Stat icon={Boxes} label="Kits registrados" value={String(kits.reduce((sum, item) => sum + item.quantity, 0))} helper={`${pending.length} prestação(ões) pendente(s)`} />
        <Stat icon={BadgeDollarSign} label="Retorno pendente ao cofre" value={MONEY.format(returnDue)} helper="R$ 300 por kit" />
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h3>Movimentações recentes de kits</h3><p className="muted">Últimos registros feitos pela equipe médica.</p></div></div>
        {kits.length === 0 ? <Empty text="Nenhuma compra de kit registrada ainda." /> : (
          <div className="table-wrap"><table><thead><tr><th>Operação</th><th>Médico</th><th>Kits</th><th>Retorno UPA</th><th>Status</th></tr></thead><tbody>
            {kits.slice(0, 5).map((kit) => <tr key={kit.id}><td>{kit.protocol}</td><td>{kit.doctorName}</td><td>{kit.quantity}</td><td>{MONEY.format(kit.hospitalReturnDue)}</td><td><Status value={kit.status} /></td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><ClipboardList size={30} /><strong>{text}</strong></div>
}

function Status({ value }: { value: string }) {
  const ok = value === 'Conferido' || value === 'Apto' || value === 'Concluída'
  return <span className={`status ${ok ? 'status-ok' : 'status-warn'}`}>{value}</span>
}

function KitsPage({ user, kits, setKits }: { user: StaffUser; kits: KitPurchase[]; setKits: (items: KitPurchase[]) => void }) {
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const qty = Math.max(0, Number(quantity) || 0)
  const canRegister = can(user, 'manage_kits') && user.clinicalFunction === 'Médico'
  const canConfirm = can(user, 'confirm_kit_returns')

  function register() {
    if (!canRegister || qty <= 0 || !Number.isInteger(qty)) return
    const now = new Date().toISOString()
    const item: KitPurchase = {
      id: crypto.randomUUID(),
      protocol: protocol(),
      doctorId: user.id,
      doctorName: user.name,
      quantity: qty,
      unitPurchaseCost: UNIT_PURCHASE_COST,
      unitSalePrice: UNIT_SALE_PRICE,
      unitHospitalReturn: UNIT_HOSPITAL_RETURN,
      totalPurchaseCost: qty * UNIT_PURCHASE_COST,
      totalSalePotential: qty * UNIT_SALE_PRICE,
      hospitalReturnDue: qty * UNIT_HOSPITAL_RETURN,
      status: 'Pendente',
      registeredAt: now,
      notes: notes.trim() || undefined,
    }
    setKits(saveKitPurchase(item))
    setQuantity('')
    setNotes('')
  }

  function confirm(item: KitPurchase) {
    if (!canConfirm) return
    const updated: KitPurchase = { ...item, status: 'Conferido', confirmedAt: new Date().toISOString(), confirmedBy: user.name }
    setKits(updateKitPurchase(updated))
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">CONTROLE MÉDICO</p><h2>Kits médicos</h2><p className="muted">Registro simples de compras e retorno obrigatório ao cofre da UPA.</p></div>
        {canRegister && <span className="permission-pill"><Stethoscope size={16}/> Exclusivo para médicos</span>}
      </header>

      <section className="rule-banner">
        <div><span>Custo por kit</span><strong>{MONEY.format(UNIT_PURCHASE_COST)}</strong></div>
        <div><span>Venda por kit</span><strong>{MONEY.format(UNIT_SALE_PRICE)}</strong></div>
        <div><span>Retorno ao cofre</span><strong>{MONEY.format(UNIT_HOSPITAL_RETURN)}</strong></div>
      </section>

      {canRegister && (
        <section className="panel form-panel">
          <div className="panel-heading"><div><h3>Registrar compra de kits</h3><p className="muted">Informe o total comprado durante o período de trabalho.</p></div></div>
          <div className="form-grid">
            <label><span>Quantidade comprada</span><input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Ex.: 50" /></label>
            <label className="wide"><span>Observação do período (opcional)</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Plantão noturno / 18h às 00h" /></label>
          </div>
          <div className="calculation-box">
            <div><span>Quantidade</span><strong>{qty} kits</strong></div>
            <div><span>Custo da compra</span><strong>{MONEY.format(qty * UNIT_PURCHASE_COST)}</strong></div>
            <div><span>Venda potencial</span><strong>{MONEY.format(qty * UNIT_SALE_PRICE)}</strong></div>
            <div className="highlight"><span>Devolver ao cofre</span><strong>{MONEY.format(qty * UNIT_HOSPITAL_RETURN)}</strong></div>
          </div>
          <button className="primary" disabled={qty <= 0 || !Number.isInteger(qty)} onClick={register}><Plus size={18}/> Registrar compra</button>
          <p className="microcopy">Ao integrar o webhook, este mesmo registro será enviado automaticamente ao canal configurado no Discord.</p>
        </section>
      )}

      {!canRegister && user.clinicalFunction !== 'Médico' && !canConfirm && (
        <div className="restricted"><ShieldCheck size={26}/><div><strong>Registro restrito a médicos</strong><p>Seu cargo não possui autorização para registrar compras de kits.</p></div></div>
      )}

      <section className="panel">
        <div className="panel-heading"><div><h3>Histórico de compras</h3><p className="muted">Registro por médico, quantidade, valores e conferência.</p></div></div>
        {kits.length === 0 ? <Empty text="Ainda não há compras registradas." /> : (
          <div className="table-wrap"><table><thead><tr><th>Operação</th><th>Data</th><th>Médico</th><th>Qtd.</th><th>Custo</th><th>Venda potencial</th><th>Retorno UPA</th><th>Status</th><th></th></tr></thead><tbody>
            {kits.map((kit) => (
              <tr key={kit.id}>
                <td><strong>{kit.protocol}</strong></td><td>{formatDate(kit.registeredAt)}</td><td>{kit.doctorName}</td><td>{kit.quantity}</td><td>{MONEY.format(kit.totalPurchaseCost)}</td><td>{MONEY.format(kit.totalSalePotential)}</td><td><strong>{MONEY.format(kit.hospitalReturnDue)}</strong></td><td><Status value={kit.status}/></td>
                <td>{canConfirm && kit.status === 'Pendente' ? <button className="table-action" onClick={() => confirm(kit)}><CheckCircle2 size={15}/> Conferir</button> : null}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  )
}

function LaudosPage({ user }: { user: StaffUser }) {
  const [reports, setReports] = useState(getReports())
  const [patientName, setPatientName] = useState('')
  const [patientId, setPatientId] = useState('')
  const [result, setResult] = useState<'Apto' | 'Não Apto'>('Apto')
  const allowed = can(user, 'issue_reports')

  function issue() {
    if (!allowed || !patientName.trim() || !patientId.trim()) return
    const report: MedicalReport = {
      id: crypto.randomUUID(), patientName: patientName.trim(), patientGameId: patientId.trim(), examinerName: user.name,
      result, issuedAt: new Date().toISOString(), purpose: 'Porte de arma',
    }
    setReports(saveReport(report)); setPatientName(''); setPatientId('')
  }

  return <div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">AVALIAÇÃO CLÍNICA</p><h2>Laudos médicos</h2><p className="muted">Emissão para porte de arma com acesso controlado por função.</p></div>{allowed && <span className="permission-pill"><FileCheck2 size={16}/> Autorizado a emitir</span>}</header>
    {allowed ? <section className="panel form-panel"><div className="panel-heading"><div><h3>Emitir novo laudo</h3><p className="muted">A emissão fica registrada com o profissional responsável.</p></div></div><div className="form-grid"><label><span>Nome do paciente</span><input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nome completo" /></label><label><span>ID do paciente</span><input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="ID da cidade" /></label><label><span>Resultado</span><select value={result} onChange={(e) => setResult(e.target.value as 'Apto' | 'Não Apto')}><option>Apto</option><option>Não Apto</option></select></label></div><button className="primary" onClick={issue}><FileCheck2 size={18}/> Emitir laudo</button></section> : <div className="restricted"><ShieldCheck size={26}/><div><strong>Emissão protegida</strong><p>Você pode consultar laudos, mas somente a função responsável — como Psicólogo autorizado — pode emitir um novo documento.</p></div></div>}
    <section className="panel"><div className="panel-heading"><div><h3>Laudos emitidos</h3><p className="muted">Histórico de avaliações para porte de arma.</p></div></div>{reports.length === 0 ? <Empty text="Nenhum laudo emitido."/> : <div className="table-wrap"><table><thead><tr><th>Paciente</th><th>ID</th><th>Responsável</th><th>Data</th><th>Resultado</th></tr></thead><tbody>{reports.map((r) => <tr key={r.id}><td>{r.patientName}</td><td>{r.patientGameId}</td><td>{r.examinerName}</td><td>{formatDate(r.issuedAt)}</td><td><Status value={r.result}/></td></tr>)}</tbody></table></div>}</section>
  </div>
}

function GenericPage({ page }: { page: Page }) {
  if (page === 'agenda') {
    const rows = getAppointments()
    return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">ATENDIMENTOS</p><h2>Agenda</h2><p className="muted">Consultas e avaliações agendadas.</p></div></header><section className="panel">{rows.length === 0 ? <Empty text="Nenhuma consulta agendada."/> : <div className="table-wrap"><table><thead><tr><th>Paciente</th><th>Profissional</th><th>Data</th><th>Tipo</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.patientName}</td><td>{row.professionalName}</td><td>{formatDate(row.scheduledAt)}</td><td>{row.type}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div>}</section></div>
  }
  if (page === 'pacientes') {
    const rows = getPatients()
    return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">CADASTROS</p><h2>Pacientes</h2><p className="muted">Consulta rápida aos pacientes cadastrados.</p></div><button className="secondary"><Search size={17}/> Buscar paciente</button></header><section className="panel"><div className="table-wrap"><table><thead><tr><th>Nome</th><th>ID</th><th>Telefone</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.gameId}</td><td>{row.phone || '—'}</td><td><Status value={row.status}/></td></tr>)}</tbody></table></div></section></div>
  }
  const titles: Record<Page, [string,string,string]> = {
    dashboard: ['', '', ''], agenda: ['', '', ''], pacientes: ['', '', ''], laudos: ['', '', ''], kits: ['', '', ''],
    financeiro: ['GESTÃO', 'Financeiro', 'Resumo de retornos ao cofre e conferências de kits.'],
    funcionarios: ['ADMINISTRAÇÃO', 'Funcionários', 'Hierarquia, funções e permissões da equipe da UPA.'],
    auditoria: ['SEGURANÇA', 'Auditoria', 'Histórico protegido de ações administrativas e financeiras.'],
    integracoes: ['CONFIGURAÇÃO', 'Integrações', 'Webhooks do Discord e parâmetros internos do sistema.'],
  }
  const [eyebrow, title, text] = titles[page]
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted">{text}</p></div></header><section className="panel"><Empty text="Módulo estruturado e pronto para a próxima etapa de implementação."/></section></div>
}

function FinancePage({ kits }: { kits: KitPurchase[] }) {
  const totalKits = kits.reduce((sum, item) => sum + item.quantity, 0)
  const purchaseCost = kits.reduce((sum, item) => sum + item.totalPurchaseCost, 0)
  const due = kits.reduce((sum, item) => sum + item.hospitalReturnDue, 0)
  const confirmed = kits.filter((k) => k.status === 'Conferido').reduce((sum, item) => sum + item.hospitalReturnDue, 0)
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">GESTÃO FINANCEIRA</p><h2>Financeiro</h2><p className="muted">Valores calculados automaticamente a partir das compras registradas.</p></div></header><section className="stats-grid"><Stat icon={Boxes} label="Kits comprados" value={String(totalKits)} helper="histórico total"/><Stat icon={BadgeDollarSign} label="Custo acumulado" value={MONEY.format(purchaseCost)} helper="R$ 250 por kit"/><Stat icon={ClipboardList} label="Retorno obrigatório" value={MONEY.format(due)} helper="R$ 300 por kit"/><Stat icon={CheckCircle2} label="Retorno conferido" value={MONEY.format(confirmed)} helper={`${MONEY.format(due - confirmed)} ainda pendente`}/></section></div>
}

function StaffPage() {
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h2>Funcionários e permissões</h2><p className="muted">Cargo hierárquico e função clínica são tratados separadamente.</p></div></header><section className="panel"><div className="table-wrap"><table><thead><tr><th>Funcionário</th><th>ID</th><th>Hierarquia</th><th>Função</th><th>Permissões</th></tr></thead><tbody>{demoUsers.map((u) => <tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.gameId}</td><td>{u.hierarchyRole}</td><td>{u.clinicalFunction}</td><td>{u.permissions.length}</td></tr>)}</tbody></table></div></section></div>
}

export default function App() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [kits, setKits] = useState<KitPurchase[]>(getKitPurchases())
  const allowedNav = useMemo(() => user ? nav.filter((item) => hasAny(user, item.anyPermission)) : [], [user])

  if (!user) return <Login onLogin={(selected) => { setUser(selected); setPage('dashboard') }} />

  function selectPage(id: Page) { setPage(id); setMenuOpen(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark small"><HeartPulse size={24}/></div><div><strong>UPA Saúde</strong><span>Sistema Integrado</span></div><button className="close-menu" onClick={() => setMenuOpen(false)}><X/></button></div>
      <nav>{allowedNav.map((item) => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => selectPage(item.id)}><Icon size={19}/><span>{item.label}</span></button> })}</nav>
      <div className="sidebar-footer"><div className="user-mini"><span className="profile-avatar small-avatar">{user.name.slice(0,1)}</span><div><strong>{user.name}</strong><span>{user.clinicalFunction}</span></div></div><button className="logout" onClick={() => setUser(null)}><LogOut size={18}/></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu/></button><div className="topbar-title"><span>UPA</span><strong>Área Administrativa</strong></div><div className="topbar-actions"><span className="role-badge">{user.hierarchyRole}</span><MessageSquare size={19}/></div></header>
      <main className="content">
        {page === 'dashboard' && <Dashboard kits={kits}/>} 
        {page === 'kits' && <KitsPage user={user} kits={kits} setKits={setKits}/>} 
        {page === 'laudos' && <LaudosPage user={user}/>} 
        {page === 'financeiro' && <FinancePage kits={kits}/>} 
        {page === 'funcionarios' && <StaffPage/>}
        {!['dashboard','kits','laudos','financeiro','funcionarios'].includes(page) && <GenericPage page={page}/>} 
      </main>
    </div>
    {menuOpen && <button className="scrim" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}/>} 
  </div>
}
