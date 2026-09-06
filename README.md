# Heartfelt Creations — Sistema UPA

Aplicação web da UPA para o servidor de GTA RP. O código-fonte oficial fica neste repositório. O Lovable deve ser usado apenas como visualizador de preview e para publicação.

## Áreas do sistema

### Portal público do cidadão

- Página inicial institucional da UPA sem informações administrativas
- Conta simples sem e-mail: nome e sobrenome, ID da cidade, usuário e senha numérica de no mínimo 4 dígitos
- Solicitação de avaliação/laudo para porte de arma
- Protocolo próprio `LAU-AAAA-...`
- Acompanhamento privado do processo por usuário
- Status previstos: Solicitado, Aguardando agendamento, Agendado, Em avaliação, Aprovado, Negado e Cancelado
- Exibição de data de agendamento e resultado quando liberados
- Usuário pode indicar que pertence à equipe, mas isso cria apenas uma solicitação de acesso; nunca concede cargo automaticamente

### Área restrita da equipe UPA

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

## Regra de acesso profissional

No cadastro público o usuário pode selecionar `Cidadão`, `Enfermeiro`, `Paramédico`, `Médico`, `Psicólogo` ou `Direção`.

Essa seleção representa somente o tipo de acesso solicitado. Qualquer opção diferente de `Cidadão` recebe `access_status = pending_staff`. O usuário continua com acesso apenas ao portal público até a administração aprovar e vincular as permissões reais. Assim, ninguém consegue selecionar "Médico" no cadastro e entrar automaticamente na área interna.

## Fluxo público do laudo

1. O cidadão cria uma conta simples.
2. Solicita a avaliação para porte de arma e recebe um protocolo.
3. A equipe da UPA visualiza a solicitação na área restrita e agenda o atendimento.
4. O cidadão acompanha o status sem visualizar informações internas da UPA.
5. O profissional autorizado realiza a avaliação e emite o laudo.
6. O resultado atualiza o processo público para `Aprovado` ou `Negado`.
7. O webhook de laudos envia o resultado ao canal específico do Discord, sem expor a configuração do webhook ao cidadão.

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
5. A falha do Discord nunca impede o laudo de ser salvo; o envio fica registrado para auditoria.

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
- `supabase/migrations/20260906190000_public_portal.sql`

Edge Functions públicas:

- `public-auth`: cadastro/login por usuário + PIN sem e-mail
- `public-report-requests`: criar e listar apenas os processos da própria sessão pública

Variáveis do frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Segredos do backend devem ficar no Supabase e nunca no frontend, incluindo `PORTAL_PIN_PEPPER` e `DISCORD_KIT_WEBHOOK_URL`.

## Estado atual

O portal público já possui preview funcional com armazenamento local para validar cadastro, login, solicitação e acompanhamento. A estrutura de produção para contas públicas e solicitações já está modelada em Supabase com sessões isoladas. A área restrita continua separada do portal público. O próximo passo é ligar a interface pública às Edge Functions e concluir o fluxo administrativo de aprovação de cargos e agendamento.
