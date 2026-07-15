-- ============================================================
-- 0010 — page_views: monitoramento de acessos dentro do admin
-- ============================================================
-- Registra visitas da LOJA (o /admin é excluído no app). A inserção vem do
-- backend (service_role, ignora RLS); só admin LÊ. Estatísticas agregadas são
-- calculadas no banco (função get_visit_stats), respeitando a RLS.

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  -- Hash diário e anônimo (IP+UA+dia) p/ contar visitantes únicos sem cookie.
  visitor_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_views_created on public.page_views (created_at);
create index if not exists idx_page_views_path on public.page_views (created_at, path);

alter table public.page_views enable row level security;

drop policy if exists "page_views: admin lê" on public.page_views;
create policy "page_views: admin lê"
  on public.page_views for select
  using (public.is_admin());

-- Estatísticas do período (views, únicos, páginas mais acessadas), agregadas no
-- banco para transferir pouco dado. SECURITY INVOKER (padrão): a RLS acima vale,
-- então apenas administradores obtêm números; qualquer outro recebe zeros.
create or replace function public.get_visit_stats(p_start timestamptz, p_end timestamptz)
returns json
language sql
stable
as $$
  select json_build_object(
    'views', (
      select count(*) from public.page_views v
      where v.created_at between p_start and p_end
    ),
    'uniques', (
      select count(distinct v.visitor_hash) from public.page_views v
      where v.created_at between p_start and p_end
    ),
    'topPages', coalesce((
      select json_agg(t) from (
        select v.path, count(*)::int as views
        from public.page_views v
        where v.created_at between p_start and p_end
        group by v.path
        order by count(*) desc
        limit 8
      ) t
    ), '[]'::json)
  );
$$;

grant execute on function public.get_visit_stats(timestamptz, timestamptz) to authenticated;
