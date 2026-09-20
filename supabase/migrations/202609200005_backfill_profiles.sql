begin;

-- 202609190003 creates a profile from an `after insert on auth.users` trigger, so
-- only accounts created after that migration ran have one. Every older account has
-- no profile row, and read paths that assumed the trigger's guarantee -- the agent
-- detail page's owner lookup and profile settings -- fail with "Profile not found".
-- Backfill those accounts and make profile creation self-healing, so a trigger that
-- did not fire can no longer break reads.

-- Shared username generator: the same 12-hex-character default the trigger used,
-- stepping to a suffixed form if a member has already claimed that exact name.
create or replace function public.default_username(account uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare base text := substr(replace(account::text,'-',''),1,12); candidate text;
begin
  for suffix in 0..99 loop
    candidate := case when suffix = 0 then 'user_' || base else 'user_' || substr(base,1,10) || lpad(suffix::text,2,'0') end;
    if not exists (select 1 from public.profiles where username = candidate) then return candidate; end if;
  end loop;
  return 'user_' || substr(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,12);
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, username) values (new.id, public.default_username(new.id))
    on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Creates the caller's own profile if the trigger never did. Owning no row is the
-- only case it changes; an existing profile is returned untouched.
create or replace function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.profiles;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into result from public.profiles where user_id = actor;
  if found then return result; end if;
  if not exists (select 1 from auth.users where id = actor) then raise exception 'Account not found'; end if;
  insert into public.profiles (user_id, username) values (actor, public.default_username(actor))
    on conflict (user_id) do nothing;
  select * into result from public.profiles where user_id = actor;
  return result;
end;
$$;
grant execute on function public.ensure_profile() to authenticated;

-- Re-runnable: accounts that already have a profile are skipped and keep their name.
insert into public.profiles (user_id, username)
select account.id, public.default_username(account.id)
from auth.users account
where not exists (select 1 from public.profiles existing where existing.user_id = account.id);

commit;
