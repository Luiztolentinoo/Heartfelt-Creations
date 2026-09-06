export type HierarchyRole =
  | 'Direção Geral'
  | 'Vice-Direção'
  | 'Gestão de Supervisores'
  | 'Supervisão Geral'
  | 'Coordenação de Pontos'
  | 'Coordenação de Emergência'
  | 'Paramédico'
  | 'Enfermeiro'
  | 'Estagiário'

export type ClinicalFunction =
  | 'Médico'
  | 'Psicólogo'
  | 'Paramédico'
  | 'Enfermeiro'
  | 'Estagiário'
  | 'Administrativo'

export type Permission =
  | 'view_dashboard'
  | 'view_patients'
  | 'manage_patients'
  | 'view_appointments'
  | 'manage_appointments'
  | 'view_reports'
  | 'issue_reports'
  | 'manage_kits'
  | 'confirm_kit_returns'
  | 'view_finance'
  | 'manage_staff'
  | 'view_audit'
  | 'manage_integrations'
  | 'manage_system'

export interface StaffUser {
  id: string
  name: string
  gameId: string
  email: string
  hierarchyRole: HierarchyRole
  clinicalFunction: ClinicalFunction
  permissions: Permission[]
}

export interface KitPurchase {
  id: string
  protocol: string
  doctorId: string
  doctorName: string
  quantity: number
  unitPurchaseCost: number
  unitSalePrice: number
  unitHospitalReturn: number
  totalPurchaseCost: number
  totalSalePotential: number
  hospitalReturnDue: number
  status: 'Pendente' | 'Conferido'
  registeredAt: string
  confirmedAt?: string
  confirmedBy?: string
  notes?: string
}

export interface MedicalReport {
  id: string
  patientName: string
  patientGameId: string
  examinerName: string
  result: 'Apto' | 'Não Apto'
  issuedAt: string
  purpose: 'Porte de arma'
}

export interface Patient {
  id: string
  name: string
  gameId: string
  phone?: string
  status: 'Ativo' | 'Inativo'
}

export interface Appointment {
  id: string
  patientName: string
  professionalName: string
  scheduledAt: string
  type: string
  status: 'Agendada' | 'Concluída' | 'Cancelada'
}
