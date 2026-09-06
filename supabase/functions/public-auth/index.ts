import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedRoles = new Set(['Cidadão', 'Enfermeiro', 'Paramédico', 'Médico', 'Psicólogo', 'Direção'])

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const pepper = Deno.env.get('PORTAL_PIN_PEPPER')
    if (!pepper) throw new Error('PORTAL_PIN_PEPPER não configurado.')

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json()
    const action = String(body?.action ?? '')

    if (action === 'register') {
      const username = String(body?.username ?? '').trim().toLowerCase().replace(/\s+/g, '')
      const fullName = String(body?.fullName ?? '').trim()
      const gameId = String(body?.gameId ?? '').trim()
      const pin = String(body?.pin ?? '')
      const requestedRole = String(body?.requestedRole ?? 'Cidadão')

      if (!/^[a-z0-9._-]{3,24}$/.test(username)) return json({ error: 'Usuário inválido. Use 3 a 24 letras, números, ponto, traço ou underline.' }, 400)
      if (fullName.split(/\s+/).length < 2) return json({ error: 'Informe nome e sobrenome.' }, 400)
      if (!gameId) return json({ error: 'Informe o ID da cidade.' }, 400)
      if (!/^\d{4,12}$/.test(pin)) return json({ error: 'A senha deve ter de 4 a 12 dígitos numéricos.' }, 400)
      if (!allowedRoles.has(requestedRole)) return json({ error: 'Tipo de acesso inválido.' }, 400)

      const pinHash = await sha256(`${username}:${pin}:${pepper}`)
      const accessStatus = requestedRole === 'Cidadão' ? 'public' : 'pending_staff'
      const { data: account, error } = await admin.from('public_portal_accounts').insert({
        username,
        full_name: fullName,
        game_id: gameId,
        pin_hash: pinHash,
        requested_role: requestedRole,
        access_status: accessStatus,
      }).select('id,username,full_name,game_id,requested_role,access_status,created_at').single()

      if (error) {
        if (error.code === '23505') return json({ error: 'Esse nome de usuário já está em uso.' }, 409)
        throw error
      }

      const rawToken = token()
      const tokenHash = await sha256(`${rawToken}:${pepper}`)
      await admin.from('public_portal_sessions').insert({ account_id: account.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      return json({ account, token: rawToken })
    }

    if (action === 'login') {
      const username = String(body?.username ?? '').trim().toLowerCase().replace(/\s+/g, '')
      const pin = String(body?.pin ?? '')
      const { data: account, error } = await admin.from('public_portal_accounts').select('*').eq('username', username).maybeSingle()
      if (error) throw error
      if (!account) return json({ error: 'Usuário ou senha inválidos.' }, 401)
      if (account.access_status === 'blocked') return json({ error: 'Acesso bloqueado pela administração.' }, 403)

      const pinHash = await sha256(`${username}:${pin}:${pepper}`)
      if (pinHash !== account.pin_hash) return json({ error: 'Usuário ou senha inválidos.' }, 401)

      const rawToken = token()
      const tokenHash = await sha256(`${rawToken}:${pepper}`)
      await admin.from('public_portal_sessions').insert({ account_id: account.id, token_hash: tokenHash, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
      return json({
        account: {
          id: account.id,
          username: account.username,
          full_name: account.full_name,
          game_id: account.game_id,
          requested_role: account.requested_role,
          access_status: account.access_status,
          created_at: account.created_at,
        },
        token: rawToken,
      })
    }

    if (action === 'logout') {
      const rawToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
      if (rawToken) {
        const tokenHash = await sha256(`${rawToken}:${pepper}`)
        await admin.from('public_portal_sessions').delete().eq('token_hash', tokenHash)
      }
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 400)
  }
})
