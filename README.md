# Heartfelt Creations — Sistema UPA

Aplicação web da UPA para o servidor de GTA RP. O código-fonte oficial fica neste repositório. O Lovable deve ser usado apenas como visualizador de preview e para publicação.

## Módulos já estruturados

- Área administrativa por cargo e função clínica
- Matriz de permissões separando hierarquia de função profissional
- Dashboard administrativo
- Agenda e pacientes
- Laudos para porte de arma com emissão restrita
- Webhook automático de laudos aprovados/negados para um canal específico do Discord
- Controle de kits médicos exclusivo para médicos
- Regra atual dos kits: compra R$ 250, venda R$ 1.600, retorno ao cofre R$ 300 por kit
- Conferência do retorno ao cofre por cargos autorizados
- Financeiro baseado nas movimentações de kits
- Auditoria de alterações
- Estrutura de webhook seguro para Discord
- Layout responsivo desktop/mobile

## Fluxo de kits

1. Somente um usuário com função `Médico` e permissão `manage_kits` registra a quantidade comprada durante o período de trabalho.
2. O sistema calcula automaticamente custo de compra, venda potencial e valor obrigatório a devolver ao cofre da UPA.
3. A operação recebe protocolo `KIT-AAAA-XXXXXX`.
4. Em produção, após salvar no Supabase, a Edge Function `discord-kit-log` envia o registro para o webhook configurado no Discord.
5. Direção/supervisão autorizada pode conferir a prestação e alterar o status para `Conferido`.

## Fluxo do webhook de laudos

1. Somente um usuário autorizado a emitir laudos registra o resultado para porte de arma.
2. O laudo é salvo em `medical_reports`.
3. A migration `20260906181000_discord_report_webhook.sql` dispara automaticamente o webhook configurado para laudos.
4. A mensagem do Discord informa paciente, ID da cidade, finalidade, resultado APROVADO/NEGADO, profissional responsável, data/hora e observações quando existirem.
5. A falha do Discord nunca impede o laudo de ser salvo; o envio fica registrado com `discord_request_id` e `discord_queued_at` para auditoria.

O webhook de laudos é configurado separadamente do webhook de kits. O endereço não é devolvido ao frontend. Usuários com `manage_integrations` ou `manage_system` podem configurá-lo usando a função segura `set_discord_webhook` com `integration_name = 'reports'`.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Para build:

```bash
npm run build
```

## Supabase

Migrations:

- `supabase/migrations/20260906173000_initial_upa_schema.sql`
- `supabase/migrations/20260906181000_discord_report_webhook.sql`

Variáveis do frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

O webhook de kits continua suportando o segredo da Edge Function `DISCORD_KIT_WEBHOOK_URL`. O webhook de laudos é mantido em `system_settings` e configurado por função administrativa segura, sem exposição pública da URL.

## Estado atual

Enquanto as credenciais do Supabase não estiverem configuradas, o preview usa perfis de demonstração e armazenamento local para validar visual, permissões e fluxo dos módulos. Com sessão Supabase ativa, os laudos gerados também são persistidos no banco, acionando automaticamente o webhook de laudos. A próxima etapa é concluir autenticação e persistência real dos demais módulos e integrar a publicação/preview sem usar o agente de construção do Lovable.
