import type { Appointment, KitPurchase, MedicalReport, Patient } from '../types'

const KITS_KEY = 'upa-kit-purchases-v1'
const REPORTS_KEY = 'upa-medical-reports-v1'
const PATIENTS_KEY = 'upa-patients-v1'
const APPOINTMENTS_KEY = 'upa-appointments-v1'

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

export function getKitPurchases(): KitPurchase[] {
  return read<KitPurchase[]>(KITS_KEY, [])
}

export function saveKitPurchase(item: KitPurchase): KitPurchase[] {
  const next = [item, ...getKitPurchases()]
  return write(KITS_KEY, next)
}

export function updateKitPurchase(item: KitPurchase): KitPurchase[] {
  return write(KITS_KEY, getKitPurchases().map((entry) => entry.id === item.id ? item : entry))
}

export function getReports(): MedicalReport[] {
  return read<MedicalReport[]>(REPORTS_KEY, [])
}

export function saveReport(item: MedicalReport): MedicalReport[] {
  return write(REPORTS_KEY, [item, ...getReports()])
}

export function getPatients(): Patient[] {
  return read<Patient[]>(PATIENTS_KEY, [
    { id: 'p1', name: 'Lucas Almeida', gameId: '5821', phone: '555-0101', status: 'Ativo' },
    { id: 'p2', name: 'Camila Rocha', gameId: '7744', phone: '555-0102', status: 'Ativo' },
  ])
}

export function getAppointments(): Appointment[] {
  return read<Appointment[]>(APPOINTMENTS_KEY, [
    {
      id: 'a1',
      patientName: 'Lucas Almeida',
      professionalName: 'Dra. Helena Costa',
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      type: 'Avaliação psicológica',
      status: 'Agendada',
    },
  ])
}
