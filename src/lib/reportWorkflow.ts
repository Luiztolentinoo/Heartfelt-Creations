import { hasSupabase, supabase } from './supabase'
import {
  cancelReportRequestLocal,
  finalizeReportRequestLocal,
  getAllReportRequests,
  scheduleReportRequestLocal,
  takeReportRequestLocal,
  type ReportRequest,
} from './publicStorage'
import { saveReport } from './storage'
import type { MedicalReport, StaffUser } from '../types'

function fromRow(row: Record<string, unknown>): ReportRequest {
  return {
    id: String(row.id),
    protocol: String(row.protocol),
    accountId: String(row.account_id),
    requesterName: String(row.requester_name),
    requesterGameId: String(row.requester_game_id),
    purpose: 'Porte de arma',
    status: row.status as ReportRequest['status'],
    preferredPeriod: row.preferred_period as ReportRequest['preferredPeriod'],
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    appointmentAt: row.appointment_at ? String(row.appointment_at) : undefined,
    professionalName: row.professional_name ? String(row.professional_name) : undefined,
    result: row.result ? row.result as 'Apto' | 'Não Apto' : undefined,
    resultAt: row.result_at ? String(row.result_at) : undefined,
    resultObservations: row.result_observations ? String(row.result_observations) : undefined,
  }
}

export async function listStaffReportRequests(): Promise<ReportRequest[]> {
  if (!hasSupabase || !supabase) return getAllReportRequests()
  const { data, error } = await supabase
    .from('report_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
}

export async function scheduleStaffReportRequest(requestId: string, appointmentAt: string) {
  if (!hasSupabase || !supabase) return scheduleReportRequestLocal(requestId, appointmentAt)
  const { data, error } = await supabase.rpc('schedule_report_request', {
    request_id: requestId,
    appointment_at_value: appointmentAt,
  })
  if (error) throw error
  return data
}

export async function takeStaffReportRequest(requestId: string, user: StaffUser) {
  if (!hasSupabase || !supabase) return takeReportRequestLocal(requestId, user.name)
  const { data, error } = await supabase.rpc('take_report_request', { request_id: requestId })
  if (error) throw error
  return data
}

export async function cancelStaffReportRequest(requestId: string) {
  if (!hasSupabase || !supabase) return cancelReportRequestLocal(requestId)
  const { data, error } = await supabase.rpc('cancel_report_request', { request_id: requestId })
  if (error) throw error
  return data
}

export async function finalizeStaffReportRequest(
  request: ReportRequest,
  user: StaffUser,
  result: 'Apto' | 'Não Apto',
  observations?: string,
) {
  if (!hasSupabase || !supabase) {
    const updated = finalizeReportRequestLocal(request.id, user.name, result, observations)
    const report: MedicalReport = {
      id: crypto.randomUUID(),
      patientName: request.requesterName,
      patientGameId: request.requesterGameId,
      examinerName: user.name,
      result,
      issuedAt: updated.resultAt ?? new Date().toISOString(),
      purpose: 'Porte de arma',
    }
    saveReport(report)
    return updated
  }

  const { data, error } = await supabase.rpc('finalize_report_request', {
    request_id: request.id,
    result_value: result,
    observations_value: observations?.trim() || null,
  })
  if (error) throw error
  return data
}
