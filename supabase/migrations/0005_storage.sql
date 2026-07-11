-- ============================================================
-- FASE 4 — Storage: bucket de imagens de produto
-- Leitura pública; escrita apenas para admin (is_admin()).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Escrita restrita ao admin. (Leitura é liberada pelo bucket público.)
create policy "product-images: admin insere"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin atualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
