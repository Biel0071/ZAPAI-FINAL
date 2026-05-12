-- 1) Helper de tenant atual (fallback para single-tenant 'main')
create or replace function public.current_company_id()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.company_id', true), ''),
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'company_id'), ''),
    nullif((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id'), ''),
    'main'
  )
$$;

-- 2) Garantir coluna company_id nas tabelas sem escopo de tenant explícito
alter table public.messages add column if not exists company_id text;
alter table public.conversation_controls add column if not exists company_id text;
alter table public.conversation_insights add column if not exists company_id text;
alter table public.lead_intelligence add column if not exists company_id text;
alter table public.prompt_history add column if not exists company_id text;
alter table public.ai_learning_logs add column if not exists company_id text;
alter table public.ai_learning_runs add column if not exists company_id text;

-- 3) Backfill de company_id com base em relações conhecidas
update public.messages m
set company_id = c.company_id
from public.conversations c
where m.conversation_id = c.id
  and (m.company_id is null or m.company_id = '');

update public.conversation_controls cc
set company_id = c.company_id
from public.conversations c
where cc.conversation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = cc.conversation_id::uuid
  and (cc.company_id is null or cc.company_id = '');

update public.conversation_insights ci
set company_id = c.company_id
from public.conversations c
where ci.conversation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = ci.conversation_id::uuid
  and (ci.company_id is null or ci.company_id = '');

update public.lead_intelligence li
set company_id = c.company_id
from public.conversations c
where li.conversation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = li.conversation_id::uuid
  and (li.company_id is null or li.company_id = '');

update public.ai_learning_logs al
set company_id = c.company_id
from public.conversations c
where al.conversation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and c.id = al.conversation_id::uuid
  and (al.company_id is null or al.company_id = '');

update public.prompt_history set company_id = 'main' where company_id is null or company_id = '';
update public.ai_learning_runs set company_id = 'main' where company_id is null or company_id = '';
update public.conversation_controls set company_id = 'main' where company_id is null or company_id = '';
update public.conversation_insights set company_id = 'main' where company_id is null or company_id = '';
update public.lead_intelligence set company_id = 'main' where company_id is null or company_id = '';
update public.ai_learning_logs set company_id = 'main' where company_id is null or company_id = '';
update public.messages set company_id = 'main' where company_id is null or company_id = '';

-- 4) Default + NOT NULL para consistência futura
alter table public.messages alter column company_id set default public.current_company_id();
alter table public.conversation_controls alter column company_id set default public.current_company_id();
alter table public.conversation_insights alter column company_id set default public.current_company_id();
alter table public.lead_intelligence alter column company_id set default public.current_company_id();
alter table public.prompt_history alter column company_id set default public.current_company_id();
alter table public.ai_learning_logs alter column company_id set default public.current_company_id();
alter table public.ai_learning_runs alter column company_id set default public.current_company_id();

alter table public.messages alter column company_id set not null;
alter table public.conversation_controls alter column company_id set not null;
alter table public.conversation_insights alter column company_id set not null;
alter table public.lead_intelligence alter column company_id set not null;
alter table public.prompt_history alter column company_id set not null;
alter table public.ai_learning_logs alter column company_id set not null;
alter table public.ai_learning_runs alter column company_id set not null;

-- 5) Remover políticas antigas permissivas

drop policy if exists "Allow contacts for anon and authenticated" on public.contacts;

drop policy if exists "Allow conversations for anon and authenticated" on public.conversations;

drop policy if exists "Allow messages for anon and authenticated" on public.messages;

drop policy if exists "Allow sessions for anon and authenticated" on public.sessions;

drop policy if exists "Allow read conversation_controls" on public.conversation_controls;
drop policy if exists "Allow update conversation_controls" on public.conversation_controls;
drop policy if exists "Allow upsert conversation_controls" on public.conversation_controls;

drop policy if exists "Allow read conversation_insights" on public.conversation_insights;
drop policy if exists "Allow write conversation_insights" on public.conversation_insights;

drop policy if exists "Allow read lead_intelligence" on public.lead_intelligence;
drop policy if exists "Allow write lead_intelligence" on public.lead_intelligence;

drop policy if exists "Allow read prompt_history" on public.prompt_history;
drop policy if exists "Allow insert prompt_history" on public.prompt_history;

drop policy if exists "Allow read ai_learning_logs" on public.ai_learning_logs;
drop policy if exists "Allow insert ai_learning_logs" on public.ai_learning_logs;
drop policy if exists "Allow update ai_learning_logs" on public.ai_learning_logs;

drop policy if exists "Allow read ai_learning_runs" on public.ai_learning_runs;
drop policy if exists "Allow insert ai_learning_runs" on public.ai_learning_runs;
drop policy if exists "Allow update ai_learning_runs" on public.ai_learning_runs;

-- 6) Políticas novas: somente autenticado + escopo por company_id
create policy "contacts_tenant_access"
on public.contacts
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "conversations_tenant_access"
on public.conversations
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "messages_tenant_access"
on public.messages
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "sessions_tenant_access"
on public.sessions
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "conversation_controls_tenant_access"
on public.conversation_controls
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "conversation_insights_tenant_access"
on public.conversation_insights
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "lead_intelligence_tenant_access"
on public.lead_intelligence
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "prompt_history_tenant_access"
on public.prompt_history
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "ai_learning_logs_tenant_access"
on public.ai_learning_logs
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

create policy "ai_learning_runs_tenant_access"
on public.ai_learning_runs
for all
to authenticated
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

-- 7) Índices para desempenho com tenant
create index if not exists idx_messages_company_id on public.messages(company_id);
create index if not exists idx_conversation_controls_company_id on public.conversation_controls(company_id);
create index if not exists idx_conversation_insights_company_id on public.conversation_insights(company_id);
create index if not exists idx_lead_intelligence_company_id on public.lead_intelligence(company_id);
create index if not exists idx_prompt_history_company_id on public.prompt_history(company_id);
create index if not exists idx_ai_learning_logs_company_id on public.ai_learning_logs(company_id);
create index if not exists idx_ai_learning_runs_company_id on public.ai_learning_runs(company_id);