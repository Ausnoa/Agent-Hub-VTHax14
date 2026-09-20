begin;
create table public.hosted_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 64000
    and jsonb_typeof(definition->'steps') = 'array' and jsonb_array_length(definition->'steps') between 1 and 8),
  created_at timestamptz not null default now(),
  unique(id, owner_id)
);
alter table public.hosted_workflows enable row level security;
revoke all on public.hosted_workflows from anon, authenticated;
grant select, insert on public.hosted_workflows to authenticated;
create policy workflows_read_own on public.hosted_workflows for select to authenticated using (owner_id = (select auth.uid()));
create policy workflows_create_own on public.hosted_workflows for insert to authenticated with check (owner_id = (select auth.uid()));
create index workflows_owner_created on public.hosted_workflows(owner_id, created_at desc);

create table public.hosted_workflow_runs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null,
  input jsonb not null check (octet_length(input::text) <= 26000),
  status text not null default 'ready' check (status in ('ready','running','completed','failed')),
  outputs jsonb not null default '[]' check (jsonb_typeof(outputs) = 'array' and octet_length(outputs::text) <= 210000),
  error text,
  claim_token uuid,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workflow_id, owner_id) references public.hosted_workflows(id, owner_id) on delete cascade
);
alter table public.hosted_workflow_runs enable row level security;
revoke all on public.hosted_workflow_runs from anon, authenticated;
grant select on public.hosted_workflow_runs to authenticated;
create policy workflow_runs_read_own on public.hosted_workflow_runs for select to authenticated using (owner_id = (select auth.uid()));
create index workflow_runs_owner_created on public.hosted_workflow_runs(owner_id, created_at desc);

create table public.hosted_workflow_budgets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('search','plan','run')),
  used integer not null,
  primary key(owner_id, day, kind)
);
alter table public.hosted_workflow_budgets enable row level security;
revoke all on public.hosted_workflow_budgets from anon, authenticated;
create function public.reserve_workflow_budget(action text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); count_used integer; maximum integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  maximum := case action when 'search' then 100 when 'plan' then 10 when 'run' then 10 else null end;
  if maximum is null then raise exception 'Invalid budget'; end if;
  insert into public.hosted_workflow_budgets values(actor,(now() at time zone 'utc')::date,action,1)
    on conflict(owner_id,day,kind) do update set used=public.hosted_workflow_budgets.used+1
    where public.hosted_workflow_budgets.used < maximum returning used into count_used;
  return count_used is not null;
end;
$$;

-- The caller supplies a stable request UUID: retries do not create a second run.
create function public.start_hosted_workflow(request_id uuid, target_workflow uuid, source_input jsonb) returns uuid
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
  if not exists(select 1 from public.hosted_workflows where id=target_workflow and owner_id=actor) then raise exception 'Workflow unavailable'; end if;
  if not public.reserve_workflow_budget('run') then return null; end if;
  insert into public.hosted_workflow_runs(id,owner_id,workflow_id,input) values(request_id,actor,target_workflow,source_input);
  return request_id;
end;
$$;

-- A step is never reclaimed. If execution is interrupted, its external effects are uncertain.
create function public.claim_hosted_step(target_run uuid, expected_step integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_run public.hosted_workflow_runs; token uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into current_run from public.hosted_workflow_runs where id=target_run and owner_id=actor for update;
  if not found then raise exception 'Run unavailable'; end if;
  if current_run.status='running' and current_run.started_at < now()-interval '5 minutes' then
    update public.hosted_workflow_runs set status='failed',error='Execution interrupted; external effects are uncertain. No automatic retry.' where id=target_run;
    return null;
  end if;
  if current_run.status <> 'ready' or jsonb_array_length(current_run.outputs) <> expected_step then return null; end if;
  token := gen_random_uuid();
  update public.hosted_workflow_runs set status='running',claim_token=token,started_at=now() where id=target_run;
  return token;
end;
$$;
create function public.finish_hosted_step(target_run uuid, token uuid, result_output jsonb, failure text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); current_run public.hosted_workflow_runs; step_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into current_run from public.hosted_workflow_runs where id=target_run and owner_id=actor for update;
  if not found or current_run.status <> 'running' or current_run.claim_token <> token or token is null then return false; end if;
  if failure is not null then
    update public.hosted_workflow_runs set status='failed',error=left(failure,300),claim_token=null where id=target_run;
  else
    if result_output is null or octet_length(result_output::text) > 26000 then raise exception 'Invalid output'; end if;
    select jsonb_array_length(definition->'steps') into step_count from public.hosted_workflows where id=current_run.workflow_id and owner_id=actor;
    update public.hosted_workflow_runs set outputs=outputs || jsonb_build_array(result_output),
      status=case when jsonb_array_length(outputs)+1 >= step_count then 'completed' else 'ready' end,claim_token=null where id=target_run;
  end if;
  return true;
end;
$$;
revoke all on function public.reserve_workflow_budget(text), public.start_hosted_workflow(uuid,uuid,jsonb), public.claim_hosted_step(uuid,integer), public.finish_hosted_step(uuid,uuid,jsonb,text) from public, anon;
grant execute on function public.reserve_workflow_budget(text), public.start_hosted_workflow(uuid,uuid,jsonb), public.claim_hosted_step(uuid,integer), public.finish_hosted_step(uuid,uuid,jsonb,text) to authenticated;
commit;
