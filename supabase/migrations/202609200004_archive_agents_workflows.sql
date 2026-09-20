begin;
alter table public.template_agents add column archived boolean not null default false;
alter table public.hosted_workflows add column archived boolean not null default false;
grant update (archived) on public.template_agents to authenticated;
grant update (archived) on public.hosted_workflows to authenticated;
alter policy agents_read_own on public.template_agents using (owner_id = (select auth.uid()) or (visibility = 'public' and not archived));
alter policy workflows_read_own on public.hosted_workflows using (owner_id = (select auth.uid()) or (visibility = 'public' and not archived));
-- Archived items cannot be published; restoring leaves them private.
alter table public.template_agents add constraint archived_agents_private check (not archived or visibility = 'private');
alter table public.hosted_workflows add constraint archived_workflows_private check (not archived or visibility = 'private');
create or replace function public.reserve_agent_test(target_agent uuid, source_text text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); reserved uuid; count_used integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.template_agents where id = target_agent and not archived and (owner_id = actor or visibility = 'public')) then
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
  if not exists(select 1 from public.hosted_workflows where id=target_workflow and not archived and (owner_id=actor or visibility='public')) then raise exception 'Workflow unavailable'; end if;
  if not public.reserve_workflow_budget('run') then return null; end if;
  insert into public.hosted_workflow_runs(id,owner_id,workflow_id,input) values(request_id,actor,target_workflow,source_input);
  return request_id;
end;
$$;


commit;
