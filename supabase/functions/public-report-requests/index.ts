import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function protocol() {
  const year = new Date().getFullYear()
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  return `LAU-${year}-${suffix}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pepper = Deno.env.get('PORTAL_PIN_PEPPER')
    if (!pepper) throw new Error('PORTAL_PIN_PEPPER não configurado.')

    const rawToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!rawToken) return json({ error: 'Sessão pública não informada.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const tokenHash = await sha256(`${rawToken}:${pepper}`)
    const now = new Date().toISOString()
    const { data: session, error: sessionError } = await admin
      .from('public_portal_sessions')
      .select('id,account_id,expires_at')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle()
    if (sessionError) throw sessionError
    if (!session) return json({ error: 'Sessão expirada ou inválida.' }, 401)

    await admin.from('public_portal_sessions').update({ last_seen_at: now }).eq('id', session.id)

    const { data: account, error: accountError } = await admin
      .from('public_portal_accounts')
      .select('id,username,full_name,game_id,access_status')
      .eq('id', session.account_id)
      .single()
    if (accountError || !account) return json({ error: 'Conta não encontrada.' }, 401)
    if (account.access_status === 'blocked') return json({ error: 'Acesso bloqueado pela administração.' }, 403)

    const body = req.method === 'GET' ? {} : await req.json()
    const action = req.method === 'GET' ? 'list' : String(body?.action ?? '')

    if (action === 'list') {
      const { data, error } = await admin
        .from('report_requests')
        .select('id,protocol,requester_name,requester_game_id,purpose,preferred_period,status,notes,appointment_at,professional_name,result,result_at,created_at,updated_at')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return json({ requests: data ?? [] })
    }

    if (action === 'create') {
      const preferredPeriod = String(body?.preferredPeriod ?? 'Qualquer horário')
      const notes = String(body?.notes ?? '').trim()
      if (!['Manhã','Tarde','Noite','Qualquer horário'].includes(preferredPeriod)) return json({ error: 'Período inválido.' }, 400)

      const { data, error } = await admin.from('report_requests').insert({
        protocol: protocol(),
        account_id: account.id,
        requester_name: account.full_name,
        requester_game_id: account.game_id,
        purpose: 'Porte de arma',
        preferred_period: preferredPeriod,
        status: 'Solicitado',
        notes: notes || null,
      }).select('id,protocol,requester_name,requester_game_id,purpose,preferred_period,status,notes,appointment_at,professional_name,result,result_at,created_at,updated_at').single()
      if (error) throw error
      return json({ request: data }, 201)
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 400)
  }
})
