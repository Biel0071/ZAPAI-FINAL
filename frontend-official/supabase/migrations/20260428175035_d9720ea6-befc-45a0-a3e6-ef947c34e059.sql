create or replace function public.current_company_id()
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_company_id text;
begin
  v_company_id := coalesce(
    nullif(current_setting('request.jwt.claim.company_id', true), ''),
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'company_id'), ''),
    nullif((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'company_id'), '')
  );

  if v_company_id is null then
    raise exception 'company_id claim is required' using errcode = '42501';
  end if;

  return v_company_id;
end;
$$;