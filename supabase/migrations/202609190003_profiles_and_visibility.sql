begin;

-- Public profile, one row per account. The trigger guarantees every signed-up
-- user has one immediately, so read paths never need to handle a missing profile.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$' and username = lower(username)),
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2000),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now(),
  unique (username)
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url, bio) on public.profiles to authenticated;
-- Every profile is visible to any signed-in user; only email and other account
-- details (which this table never stores) stay private.
create policy profiles_read_all on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, username) values (new.id, 'user_' || substr(replace(new.id::text,'-',''),1,12));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Visibility: agents default to private and become discoverable once the owner publishes them.
alter table public.template_agents add column visibility text not null default 'private' check (visibility in ('public','private'));
alter table public.hosted_workflows add column visibility text not null default 'private' check (visibility in ('public','private'));
alter policy agents_read_own on public.template_agents using (owner_id = (select auth.uid()) or visibility = 'public');
alter policy workflows_read_own on public.hosted_workflows using (owner_id = (select auth.uid()) or visibility = 'public');
grant update (visibility) on public.template_agents to authenticated;
grant update (visibility) on public.hosted_workflows to authenticated;
create policy agents_update_visibility on public.template_agents for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy workflows_update_visibility on public.hosted_workflows for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- A test/run row is owned by whoever invoked it, which may now differ from the agent's
-- owner once an agent is public. The old composite FK required them to match; replace it
-- with a plain existence check so cross-owner invocation is possible while runs stay
-- attributed to the invoker for rate limiting and history.
alter table public.agent_test_runs drop constraint agent_test_runs_agent_id_owner_id_fkey;
alter table public.agent_test_runs add constraint agent_test_runs_agent_id_fkey foreign key (agent_id) references public.template_agents(id) on delete cascade;
alter table public.template_agents drop constraint template_agents_id_owner_id_key;

alter table public.hosted_workflow_runs drop constraint hosted_workflow_runs_workflow_id_owner_id_fkey;
alter table public.hosted_workflow_runs add constraint hosted_workflow_runs_workflow_id_fkey foreign key (workflow_id) references public.hosted_workflows(id) on delete cascade;
alter table public.hosted_workflows drop constraint hosted_workflows_id_owner_id_key;

-- Let a public agent's owner-only RPCs also accept its public reader/invoker.
create or replace function public.reserve_agent_test(target_agent uuid, source_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); reserved uuid; count_used integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.template_agents where id = target_agent and (owner_id = actor or visibility = 'public')) then
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

create or replace function public.start_hosted_workflow(request_id uuid, target_workflow uuid, source_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.hosted_workflow_runs;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
  select * into existing from public.hosted_workflow_runs where id=request_id;
  if found then
    if existing.owner_id <> actor or existing.workflow_id <> target_workflow or existing.input <> source_input then raise exception 'Request ID already used'; end if;
    return existing.id;
  end if;
  if not exists(select 1 from public.hosted_workflows where id=target_workflow and (owner_id=actor or visibility='public')) then raise exception 'Workflow unavailable'; end if;
  if not public.reserve_workflow_budget('run') then return null; end if;
  insert into public.hosted_workflow_runs(id,owner_id,workflow_id,input) values(request_id,actor,target_workflow,source_input);
  return request_id;
end;
$$;

-- Lightweight bookmarks. No FK to the agent tables: agent_kind picks which table
-- agent_id belongs to, and a stale bookmark to a deleted agent is handled by the app.
create table public.saved_agents (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agent_kind text not null check (agent_kind in ('template','workflow')),
  agent_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, agent_kind, agent_id)
);
alter table public.saved_agents enable row level security;
revoke all on public.saved_agents from anon, authenticated;
grant select, insert, delete on public.saved_agents to authenticated;
create policy saved_read_own on public.saved_agents for select to authenticated using (owner_id = (select auth.uid()));
create policy saved_create_own on public.saved_agents for insert to authenticated with check (owner_id = (select auth.uid()));
create policy saved_delete_own on public.saved_agents for delete to authenticated using (owner_id = (select auth.uid()));

commit;
