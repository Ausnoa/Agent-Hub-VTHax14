begin;
-- Proposals are private, immutable snapshots. Publishing accepts only their ID.
create table public.capability_proposals (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body jsonb not null check (octet_length(body::text) <= 64000),
  created_at timestamptz not null default now(),
  published_id uuid references public.hosted_workflows(id)
);
alter table public.capability_proposals enable row level security;
revoke all on public.capability_proposals from anon, authenticated;
grant select, insert on public.capability_proposals to authenticated;
create policy capability_proposals_read on public.capability_proposals for select to authenticated using (owner_id = (select auth.uid()));
create policy capability_proposals_create on public.capability_proposals for insert to authenticated with check (owner_id = (select auth.uid()));

create table public.capability_heads (
  root_id uuid primary key references public.hosted_workflows(id),
  owner_id uuid not null references auth.users(id),
  workflow_id uuid not null references public.hosted_workflows(id)
);
alter table public.capability_heads enable row level security;
revoke all on public.capability_heads from anon, authenticated;
grant select on public.capability_heads to authenticated;
create policy capability_heads_read on public.capability_heads for select to authenticated using (owner_id = (select auth.uid()));

-- Short audio clips remain private run inputs. Outputs retain the existing text/JSON size limit.
alter table public.hosted_workflow_runs drop constraint hosted_workflow_runs_input_check;
alter table public.hosted_workflow_runs add constraint hosted_workflow_runs_input_check check (octet_length(input::text) <= case when input->>'type' = 'audio' then 1340000 else 26000 end);

create function public.publish_capability_proposal(proposal_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); proposal public.capability_proposals; parent public.hosted_workflows; saved public.hosted_workflows;
  root uuid; new_id uuid := gen_random_uuid(); current_id uuid; rev integer := 1; definition jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into proposal from public.capability_proposals where id=proposal_id and owner_id=actor for update;
  if not found then raise exception 'Proposal unavailable'; end if;
  if proposal.published_id is not null then
    select * into saved from public.hosted_workflows where id=proposal.published_id;
    return to_jsonb(saved);
  end if;
  definition := proposal.body->'definition';
  if proposal.created_at < now()-interval '1 hour' or definition->'capability' is null
    or jsonb_array_length(definition->'capability'->'unresolved') <> 0 then raise exception 'Proposal incomplete or expired'; end if;
  if proposal.body->>'parentId' is not null then
    select * into parent from public.hosted_workflows where id=(proposal.body->>'parentId')::uuid and owner_id=actor and not archived;
    if not found then raise exception 'Parent unavailable'; end if;
    root := coalesce((parent.definition->'revision'->>'rootId')::uuid,parent.id);
    perform pg_advisory_xact_lock(hashtextextended(root::text,0));
    select workflow_id into current_id from public.capability_heads where root_id=root;
    if current_id is not null and current_id <> parent.id then raise exception 'Revision conflict'; end if;
    rev := coalesce((parent.definition->'revision'->>'number')::integer,1)+1;
    definition := jsonb_set(definition,'{revision}',jsonb_build_object('rootId',root,'parentId',parent.id,'number',rev));
  else
    root := new_id;
    definition := jsonb_set(definition,'{revision}',jsonb_build_object('rootId',root,'number',1));
  end if;
  insert into public.hosted_workflows(id,owner_id,definition) values(new_id,actor,definition) returning * into saved;
  insert into public.capability_heads(root_id,owner_id,workflow_id) values(root,actor,new_id)
    on conflict(root_id) do update set workflow_id=excluded.workflow_id;
  update public.capability_proposals set published_id=new_id where id=proposal_id;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.publish_capability_proposal(uuid) from public, anon;
grant execute on function public.publish_capability_proposal(uuid) to authenticated;
commit;
