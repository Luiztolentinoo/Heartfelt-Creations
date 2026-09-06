import type { ClinicalFunction, HierarchyRole, Permission, StaffUser } from '../types'

const hierarchyDefaults: Record<HierarchyRole, Permission[]> = {
  'Direção Geral': [
    'view_dashboard','view_patients','manage_patients','view_appointments','manage_appointments',
    'view_reports','confirm_kit_returns','view_finance','manage_staff','view_audit',
    'manage_integrations','manage_system',
  ],
  'Vice-Direção': [
    'view_dashboard','view_patients','manage_patients','view_appointments','manage_appointments',
    'view_reports','confirm_kit_returns','view_finance','manage_staff','view_audit','manage_integrations',
  ],
  'Gestão de Supervisores': [
    'view_dashboard','view_patients','view_appointments','manage_appointments','view_reports',
    'confirm_kit_returns','view_finance','manage_staff','view_audit',
  ],
  'Supervisão Geral': [
    'view_dashboard','view_patients','view_appointments','manage_appointments','view_reports',
    'confirm_kit_returns','view_finance','view_audit',
  ],
  'Coordenação de Pontos': [
    'view_dashboard','view_patients','view_appointments','manage_appointments','view_reports','view_audit',
  ],
  'Coordenação de Emergência': [
    'view_dashboard','view_patients','manage_patients','view_appointments','manage_appointments','view_reports',
  ],
  'Paramédico': ['view_dashboard','view_patients','manage_patients','view_appointments'],
  'Enfermeiro': ['view_dashboard','view_patients','manage_patients','view_appointments'],
  'Estagiário': ['view_dashboard','view_patients','view_appointments'],
}

const clinicalDefaults: Record<ClinicalFunction, Permission[]> = {
  'Médico': ['view_dashboard','view_patients','manage_patients','view_appointments','manage_appointments','view_reports','manage_kits'],
  'Psicólogo': ['view_dashboard','view_patients','view_appointments','manage_appointments','view_reports','issue_reports'],
  'Paramédico': ['view_dashboard','view_patients','manage_patients','view_appointments'],
  'Enfermeiro': ['view_dashboard','view_patients','manage_patients','view_appointments'],
  'Estagiário': ['view_dashboard','view_patients','view_appointments'],
  'Administrativo': ['view_dashboard'],
}

export function buildPermissions(role: HierarchyRole, clinicalFunction: ClinicalFunction): Permission[] {
  return [...new Set([...hierarchyDefaults[role], ...clinicalDefaults[clinicalFunction]])]
}

export function can(user: StaffUser, permission: Permission): boolean {
  return user.permissions.includes(permission)
}

export const demoUsers: StaffUser[] = [
  {
    id: 'demo-diretor',
    name: 'Diretor UPA',
    gameId: '1001',
    email: 'direcao@upa.local',
    hierarchyRole: 'Direção Geral',
    clinicalFunction: 'Administrativo',
    permissions: buildPermissions('Direção Geral', 'Administrativo'),
  },
  {
    id: 'demo-medico',
    name: 'Dr. Rafael Mendes',
    gameId: '2048',
    email: 'medico@upa.local',
    hierarchyRole: 'Coordenação de Emergência',
    clinicalFunction: 'Médico',
    permissions: buildPermissions('Coordenação de Emergência', 'Médico'),
  },
  {
    id: 'demo-psicologo',
    name: 'Dra. Helena Costa',
    gameId: '3150',
    email: 'psicologia@upa.local',
    hierarchyRole: 'Coordenação de Pontos',
    clinicalFunction: 'Psicólogo',
    permissions: buildPermissions('Coordenação de Pontos', 'Psicólogo'),
  },
  {
    id: 'demo-enfermeiro',
    name: 'Marcos Oliveira',
    gameId: '4412',
    email: 'enfermagem@upa.local',
    hierarchyRole: 'Enfermeiro',
    clinicalFunction: 'Enfermeiro',
    permissions: buildPermissions('Enfermeiro', 'Enfermeiro'),
  },
]
