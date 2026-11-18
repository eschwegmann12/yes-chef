-- Yes, Chef: recipe photos
-- Paste into Supabase > SQL Editor and click Run. Safe to run more than once.

alter table public.recipes add column if not exists photo_url text;

-- A storage bucket for the photos. "public" means a photo can be viewed by its link,
-- but only signed-in people can add, change or remove photos.
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "signed-in people add recipe photos" on storage.objects;
drop policy if exists "signed-in people change recipe photos" on storage.objects;
drop policy if exists "signed-in people remove recipe photos" on storage.objects;
drop policy if exists "signed-in people see recipe photos" on storage.objects;
create policy "signed-in people see recipe photos" on storage.objects for select to authenticated using (bucket_id = 'recipe-photos');
create policy "signed-in people add recipe photos" on storage.objects for insert to authenticated with check (bucket_id = 'recipe-photos');
create policy "signed-in people change recipe photos" on storage.objects for update to authenticated using (bucket_id = 'recipe-photos') with check (bucket_id = 'recipe-photos');
create policy "signed-in people remove recipe photos" on storage.objects for delete to authenticated using (bucket_id = 'recipe-photos');
