export type RequestedAccessRole = 'Cidadão' | 'Enfermeiro' | 'Paramédico' | 'Médico' | 'Psicólogo' | 'Direção'

export type PublicAccessStatus = 'public' | 'pending_staff' | 'staff'

export type ReportRequestStatus =
  | 'Solicitado'
  | 'Aguardando agendamento'
  | 'Agendado'
  | 'Em avaliação'
  | 'Aprovado'
  | 'Negado'
  | 'Cancelado'

export interface PublicAccount {
  id: string
  username: string
  fullName: string
  gameId: string
  requestedRole: RequestedAccessRole
  accessStatus: PublicAccessStatus
  createdAt: string
}

interface StoredPublicAccount extends PublicAccount {
  pinHash: string
}

export interface ReportRequest {
  id: string
  protocol: string
  accountId: string
  requesterName: string
  requesterGameId: string
  purpose: 'Porte de arma'
  status: ReportRequestStatus
  preferredPeriod: 'Manhã' | 'Tarde' | 'Noite' | 'Qualquer horário'
  notes?: string
  createdAt: string
  appointmentAt?: string
  professionalName?: string
  result?: 'Apto' | 'Não Apto'
  resultAt?: string
  resultObservations?: string
}

const ACCOUNTS_KEY = 'upa-public-accounts-v1'
const SESSION_KEY = 'upa-public-session-v1'
const REQUESTS_KEY = 'upa-public-report-requests-v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): T {
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

async function hashPin(pin: string) {
  const data = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, '')
}

export async function registerPublicAccount(input: {
  username: string
  fullName: string
  gameId: string
  pin: string
  requestedRole: RequestedAccessRole
}): Promise<PublicAccount> {
  const username = normalizeUsername(input.username)
  if (username.length < 3) throw new Error('O nome de usuário precisa ter pelo menos 3 caracteres.')
  if (input.fullName.trim().split(/\s+/).length < 2) throw new Error('Informe nome e sobrenome.')
  if (!/^\d{4,}$/.test(input.pin)) throw new Error('A senha deve ter no mínimo 4 dígitos numéricos.')
  if (!input.gameId.trim()) throw new Error('Informe o ID da cidade.')

  const accounts = read<StoredPublicAccount[]>(ACCOUNTS_KEY, [])
  if (accounts.some((account) => account.username === username)) throw new Error('Esse nome de usuário já está em uso.')

  const account: StoredPublicAccount = {
    id: crypto.randomUUID(),
    username,
    fullName: input.fullName.trim(),
    gameId: input.gameId.trim(),
    requestedRole: input.requestedRole,
    accessStatus: input.requestedRole === 'Cidadão' ? 'public' : 'pending_staff',
    pinHash: await hashPin(input.pin),
    createdAt: new Date().toISOString(),
  }
  write(ACCOUNTS_KEY, [account, ...accounts])
  write(SESSION_KEY, account.id)
  const { pinHash: _pinHash, ...publicAccount } = account
  return publicAccount
}

export async function loginPublicAccount(usernameInput: string, pin: string): Promise<PublicAccount> {
  const username = normalizeUsername(usernameInput)
  const accounts = read<StoredPublicAccount[]>(ACCOUNTS_KEY, [])
  const account = accounts.find((item) => item.username === username)
  if (!account || account.pinHash !== await hashPin(pin)) throw new Error('Usuário ou senha inválidos.')
  write(SESSION_KEY, account.id)
  const { pinHash: _pinHash, ...publicAccount } = account
  return publicAccount
}

export function getPublicSession(): PublicAccount | null {
  const accountId = read<string | null>(SESSION_KEY, null)
  if (!accountId) return null
  const account = read<StoredPublicAccount[]>(ACCOUNTS_KEY, []).find((item) => item.id === accountId)
  if (!account) return null
  const { pinHash: _pinHash, ...publicAccount } = account
  return publicAccount
}

export function logoutPublicSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getRequestsForAccount(accountId: string) {
  return read<ReportRequest[]>(REQUESTS_KEY, [])
    .filter((request) => request.accountId === accountId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export function getAllReportRequests() {
  return read<ReportRequest[]>(REQUESTS_KEY, [])
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export function updateReportRequestLocal(request: ReportRequest) {
  const next = read<ReportRequest[]>(REQUESTS_KEY, []).map((item) => item.id === request.id ? request : item)
  write(REQUESTS_KEY, next)
  return request
}

export function scheduleReportRequestLocal(requestId: string, appointmentAt: string) {
  const request = getAllReportRequests().find((item) => item.id === requestId)
  if (!request) throw new Error('Solicitação não localizada.')
  return updateReportRequestLocal({ ...request, status: 'Agendado', appointmentAt })
}

export function takeReportRequestLocal(requestId: string, professionalName: string) {
  const request = getAllReportRequests().find((item) => item.id === requestId)
  if (!request) throw new Error('Solicitação não localizada.')
  return updateReportRequestLocal({ ...request, status: 'Em avaliação', professionalName })
}

export function cancelReportRequestLocal(requestId: string) {
  const request = getAllReportRequests().find((item) => item.id === requestId)
  if (!request) throw new Error('Solicitação não localizada.')
  return updateReportRequestLocal({ ...request, status: 'Cancelado' })
}

export function finalizeReportRequestLocal(
  requestId: string,
  professionalName: string,
  result: 'Apto' | 'Não Apto',
  observations?: string,
) {
  const request = getAllReportRequests().find((item) => item.id === requestId)
  if (!request) throw new Error('Solicitação não localizada.')
  return updateReportRequestLocal({
    ...request,
    status: result === 'Apto' ? 'Aprovado' : 'Negado',
    professionalName,
    result,
    resultAt: new Date().toISOString(),
    resultObservations: observations?.trim() || undefined,
  })
}

function requestProtocol() {
  const year = new Date().getFullYear()
  const random = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')
  return `LAU-${year}-${random}`
}

export function createReportRequest(account: PublicAccount, preferredPeriod: ReportRequest['preferredPeriod'], notes?: string) {
  const requests = read<ReportRequest[]>(REQUESTS_KEY, [])
  const request: ReportRequest = {
    id: crypto.randomUUID(),
    protocol: requestProtocol(),
    accountId: account.id,
    requesterName: account.fullName,
    requesterGameId: account.gameId,
    purpose: 'Porte de arma',
    status: 'Solicitado',
    preferredPeriod,
    notes: notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  }
  write(REQUESTS_KEY, [request, ...requests])
  return request
}
