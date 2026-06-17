-- ASPROC Supabase Security - Stage 4 Private Candidate Storage
-- Purpose: make candidate CV files private while preserving public uploads.
--
-- Requires Stage 2 because it uses app_private.current_admin_level().

begin;

-- CVs must not be publicly readable by direct URL.
update storage.buckets
set public = false
where id = 'candidaturas';

-- Remove previous policies that explicitly mention the candidaturas bucket.
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

create policy "anon_upload_candidate_cvs"
on storage.objects
for insert
to anon
with check (bucket_id = 'candidaturas');

create policy "active_admin_read_candidate_cvs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'candidaturas'
  and app_private.current_admin_level() in ('super_admin', 'admin')
);

create policy "active_admin_update_candidate_cvs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'candidaturas'
  and app_private.current_admin_level() in ('super_admin', 'admin')
)
with check (
  bucket_id = 'candidaturas'
  and app_private.current_admin_level() in ('super_admin', 'admin')
);

create policy "active_admin_delete_candidate_cvs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'candidaturas'
  and app_private.current_admin_level() in ('super_admin', 'admin')
);

commit;
