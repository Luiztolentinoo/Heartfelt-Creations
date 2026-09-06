import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const webhookUrl = Deno.env.get('DISCORD_KIT_WEBHOOK_URL')
    const authorization = req.headers.get('Authorization')

    if (!authorization) throw new Error('Sessão não informada.')
    if (!webhookUrl) throw new Error('Webhook de kits não configurado.')

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('Sessão inválida.')

    const body = await req.json()
    const purchaseId = body?.purchaseId as string | undefined
    if (!purchaseId) throw new Error('purchaseId é obrigatório.')

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id,name,clinical_function,permissions')
      .eq('id', authData.user.id)
      .single()
    if (profileError || !profile) throw new Error('Perfil não localizado.')

    const { data: purchase, error: purchaseError } = await adminClient
      .from('kit_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single()
    if (purchaseError || !purchase) throw new Error('Compra de kits não localizada.')

    const permissions: string[] = profile.permissions ?? []
    const authorized = purchase.doctor_id === authData.user.id || permissions.includes('manage_integrations') || permissions.includes('confirm_kit_returns')
    if (!authorized) return new Response(JSON.stringify({ error: 'Sem permissão.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (purchase.discord_notified_at) {
      return new Response(JSON.stringify({ ok: true, alreadySent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const registeredAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(purchase.registered_at))

    const payload = {
      username: 'UPA • Controle de Kits',
      embeds: [{
        title: '🩺 Compra de Kits Médicos',
        description: `Registro automático **${purchase.protocol}**`,
        color: 0x17684f,
        fields: [
          { name: 'Médico', value: purchase.doctor_name, inline: true },
          { name: 'Quantidade comprada', value: `${purchase.quantity} kits`, inline: true },
          { name: 'Data e hora', value: registeredAt, inline: true },
          { name: 'Custo da compra', value: money(purchase.total_purchase_cost), inline: true },
          { name: 'Venda potencial', value: money(purchase.total_sale_potential), inline: true },
          { name: 'Retorno obrigatório ao cofre', value: `**${money(purchase.hospital_return_due)}**`, inline: true },
          { name: 'Regra aplicada', value: `${money(purchase.unit_purchase_cost)} compra • ${money(purchase.unit_sale_price)} venda • ${money(purchase.unit_hospital_return)} retorno/kit`, inline: false },
          ...(purchase.notes ? [{ name: 'Observação', value: purchase.notes, inline: false }] : []),
        ],
        footer: { text: 'UPA • Sistema Integrado' },
        timestamp: purchase.registered_at,
      }],
    }

    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!discordResponse.ok) {
      const details = await discordResponse.text()
      throw new Error(`Discord recusou o webhook (${discordResponse.status}): ${details.slice(0, 200)}`)
    }

    await adminClient
      .from('kit_purchases')
      .update({ discord_notified_at: new Date().toISOString() })
      .eq('id', purchase.id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro inesperado.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
