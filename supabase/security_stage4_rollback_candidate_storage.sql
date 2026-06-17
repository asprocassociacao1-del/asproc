-- ASPROC Supabase Security - Stage 4 Rollback: Candidate Storage
-- Use only if private candidate storage breaks uploads or admin access.

begin;

update storage.buckets
set public = true
where id = 'candidaturas';

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%candidaturas%'
        or coalesce(with_check, '') ilike '%candidaturas%'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
  end loop;
end $$;

create policy "rollback_public_read_candidate_cvs"
on storage.objects
for select
to anon
using (bucket_id = 'candidaturas');

create policy "rollback_anon_upload_candidate_cvs"
on storage.objects
for insert
to anon
with check (bucket_id = 'candidaturas');

create policy "rollback_authenticated_all_candidate_cvs"
on storage.objects
for all
to authenticated
using (bucket_id = 'candidaturas')
with check (bucket_id = 'candidaturas');

commit;
