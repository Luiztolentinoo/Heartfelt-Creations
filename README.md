# Heartfelt Creations — Sistema UPA

Aplicação web da UPA para o servidor de GTA RP. O código-fonte oficial fica neste repositório. O Lovable deve ser usado apenas como visualizador de preview e para publicação.

## Módulos já estruturados

- Área administrativa por cargo e função clínica
- Matriz de permissões separando hierarquia de função profissional
- Dashboard administrativo
- Agenda e pacientes
- Laudos para porte de arma com emissão restrita
- Controle de kits médicos exclusivo para médicos
- Regra atual dos kits: compra R$ 250, venda R$ 1.600, retorno ao cofre R$ 300 por kit
- Conferência do retorno ao cofre por cargos autorizados
- Financeiro baseado nas movimentações de kits
- Auditoria de alterações
- Estrutura de webhook seguro para Discord via Supabase Edge Function
- Layout responsivo desktop/mobile

## Fluxo de kits

1. Somente um usuário com função `Médico` e permissão `manage_kits` registra a quantidade comprada durante o período de trabalho.
2. O sistema calcula automaticamente custo de compra, venda potencial e valor obrigatório a devolver ao cofre da UPA.
3. A operação recebe protocolo `KIT-AAAA-XXXXXX`.
4. Em produção, após salvar no Supabase, a Edge Function `discord-kit-log` envia o registro para o webhook configurado no Discord.
5. Direção/supervisão autorizada pode conferir a prestação e alterar o status para `Conferido`.

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

A migration inicial está em `supabase/migrations/20260906173000_initial_upa_schema.sql`.

Variáveis do frontend:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

O webhook do Discord deve ser salvo como segredo da Edge Function (`DISCORD_KIT_WEBHOOK_URL`) e nunca exposto no frontend.

## Estado atual

Enquanto as credenciais do Supabase não estiverem configuradas, o preview usa perfis de demonstração e armazenamento local para validar visual, permissões e fluxo dos módulos. A próxima etapa é ligar autenticação e persistência real ao Supabase e integrar a publicação/preview sem usar o agente de construção do Lovable.
