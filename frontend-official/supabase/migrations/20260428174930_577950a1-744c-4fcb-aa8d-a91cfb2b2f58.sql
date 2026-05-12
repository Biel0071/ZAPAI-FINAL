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
    '__missing_company__'
  )
$$;