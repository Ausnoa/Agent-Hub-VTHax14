begin;
create table public.template_agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 64000),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index template_agents_owner_created on public.template_agents(owner_id, created_at desc);
alter table public.template_agents enable row level security;
revoke all on public.template_agents from anon, authenticated;
grant select, insert on public.template_agents to authenticated;
create policy agents_read_own on public.template_agents for select to authenticated using (owner_id = (select auth.uid()));
create policy agents_create_own on public.template_agents for insert to authenticated with check (owner_id = (select auth.uid()));

create table public.agent_test_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid not null,
  input text not null check (char_length(input) between 1 and 12000),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  output text check (char_length(output) <= 24000),
  created_at timestamptz not null default now(),
  foreign key (agent_id, owner_id) references public.template_agents(id, owner_id) on delete cascade
);
create index agent_tests_owner_created on public.agent_test_runs(owner_id, created_at desc);
alter table public.agent_test_runs enable row level security;
revoke all on public.agent_test_runs from anon, authenticated;
grant select on public.agent_test_runs to authenticated;
grant update (status, output) on public.agent_test_runs to authenticated;
create policy tests_read_own on public.agent_test_runs for select to authenticated using (owner_id = (select auth.uid()));
create policy tests_update_own on public.agent_test_runs for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- An atomic daily budget shared by all serverless instances. No direct user writes.
create table public.agent_test_budgets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  used integer not null check (used between 1 and 20),
  primary key (owner_id, day)
);
alter table public.agent_test_budgets enable row level security;
revoke all on public.agent_test_budgets from anon, authenticated;
create function public.reserve_agent_test(target_agent uuid, source_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); reserved uuid; count_used integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.template_agents where id = target_agent and owner_id = actor) then
    raise exception 'Agent unavailable';
  end if;
  if source_text is null or char_length(trim(source_text)) not between 1 and 12000 then
    raise exception 'Invalid input';
  end if;
  insert into public.agent_test_budgets(owner_id, day, used)
    values (actor, (now() at time zone 'utc')::date, 1)
    on conflict (owner_id, day) do update set used = public.agent_test_budgets.used + 1
    where public.agent_test_budgets.used < 20
    returning used into count_used;
  if count_used is null then return null; end if;
  insert into public.agent_test_runs(owner_id, agent_id, input) values (actor, target_agent, source_text) returning id into reserved;
  return reserved;
end;
$$;
revoke all on function public.reserve_agent_test(uuid, text) from public, anon;
grant execute on function public.reserve_agent_test(uuid, text) to authenticated;
commit;
