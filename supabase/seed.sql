-- ============================================================
-- Seed de desenvolvimento — Casa de Filadélfia
-- Coleção "Multiplicação": Off-White e Preta, para Feminino, Masculino e
-- Infantil, com estoque por tamanho (product_variants).
-- Rode após as migrations (inclui 0006_product_variants.sql).
-- Espelha lib/demo-data.ts.
-- ============================================================

-- Categorias
insert into public.categories (name, slug, position) values
  ('Feminino', 'feminino', 1),
  ('Masculino', 'masculino', 2),
  ('Infantil', 'infantil', 3)
on conflict (slug) do nothing;

-- Produtos (2 cores × 3 públicos)
insert into public.products
  (category_id, name, slug, description_short, description_long, price,
   color_name, color_hex, is_active, is_featured)
select c.id, v.name, v.slug, v.ds, v.dl, v.price, v.color, v.hex, true, v.feat
from (values
  ('feminino',  'Camiseta Multiplicação Off-White · Feminino',
     'camiseta-multiplicacao-off-white-feminino',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Off-White', '#E7E0D0', true),
  ('feminino',  'Camiseta Multiplicação Preta · Feminino',
     'camiseta-multiplicacao-preta-feminino',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Preta', '#161616', true),
  ('masculino', 'Camiseta Multiplicação Off-White · Masculino',
     'camiseta-multiplicacao-off-white-masculino',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Off-White', '#E7E0D0', true),
  ('masculino', 'Camiseta Multiplicação Preta · Masculino',
     'camiseta-multiplicacao-preta-masculino',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Preta', '#161616', false),
  ('infantil',  'Camiseta Multiplicação Off-White · Infantil',
     'camiseta-multiplicacao-off-white-infantil',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     39.90, 'Off-White', '#E7E0D0', false),
  ('infantil',  'Camiseta Multiplicação Preta · Infantil',
     'camiseta-multiplicacao-preta-infantil',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     39.90, 'Preta', '#161616', true)
) as v(cat, name, slug, ds, dl, price, color, hex, feat)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- Imagens (as fotos vivem em /public/products e são servidas pelo app)
insert into public.product_images (product_id, storage_path, alt_text, position, is_primary)
select p.id, i.path, i.alt, i.pos, i.pos = 0
from public.products p
join lateral (values
  -- Feminino Off-White
  ('camiseta-multiplicacao-off-white-feminino', '/products/frente_mulher_inicial_bege_larga.png', 'Camiseta Off-White feminina, frente', 0),
  ('camiseta-multiplicacao-off-white-feminino', '/products/costas_mulher_inicial_bege.png', 'Camiseta Off-White feminina, costas', 1),
  ('camiseta-multiplicacao-off-white-feminino', '/products/modelo_mulher_camisa_bege.png', 'Modelo feminina com camiseta Off-White', 2),
  ('camiseta-multiplicacao-off-white-feminino', '/products/costas_mulher_negra_bege.png', 'Camiseta Off-White feminina, costas (estampa)', 3),
  -- Feminino Preta
  ('camiseta-multiplicacao-preta-feminino', '/products/frente_mulher_inicial_preto_larga.png', 'Camiseta Preta feminina, frente', 0),
  ('camiseta-multiplicacao-preta-feminino', '/products/costas_mulher_inicial_preto.png', 'Camiseta Preta feminina, costas', 1),
  ('camiseta-multiplicacao-preta-feminino', '/products/modelo_mulher_camisa_preta.png', 'Modelo feminina com camiseta Preta', 2),
  ('camiseta-multiplicacao-preta-feminino', '/products/frente_mulher_negra_preta.png', 'Camiseta Preta feminina, detalhe', 3),
  -- Masculino Off-White
  ('camiseta-multiplicacao-off-white-masculino', '/products/frente_homem_inicial_bege_larga.png', 'Camiseta Off-White masculina, frente', 0),
  ('camiseta-multiplicacao-off-white-masculino', '/products/costas_homem_inicial_bege.png', 'Camiseta Off-White masculina, costas', 1),
  ('camiseta-multiplicacao-off-white-masculino', '/products/modelo_homem_camisa_bege.png', 'Modelo masculino com camiseta Off-White', 2),
  ('camiseta-multiplicacao-off-white-masculino', '/products/modelo_homem_bege_sentado.png', 'Modelo masculino sentado, lifestyle', 3),
  -- Masculino Preta
  ('camiseta-multiplicacao-preta-masculino', '/products/frente_homem_inicial_preto_larga.png', 'Camiseta Preta masculina, frente', 0),
  ('camiseta-multiplicacao-preta-masculino', '/products/costas_homem_inicial_preto.png', 'Camiseta Preta masculina, costas', 1),
  ('camiseta-multiplicacao-preta-masculino', '/products/modelo_homem_camisa_preta.png', 'Modelo masculino com camiseta Preta', 2),
  ('camiseta-multiplicacao-preta-masculino', '/products/frente_homem_inicial_preto_final.png', 'Camiseta Preta masculina, detalhe', 3),
  -- Infantil Off-White
  ('camiseta-multiplicacao-off-white-infantil', '/products/frente_menino_bege_v2.png', 'Criança com camiseta Off-White, frente', 0),
  ('camiseta-multiplicacao-off-white-infantil', '/products/costas_menino_bege_v2.png', 'Camiseta Off-White infantil, costas', 1),
  -- Infantil Preta
  ('camiseta-multiplicacao-preta-infantil', '/products/frente_menina_preta_v2.png', 'Criança com camiseta Preta, frente', 0),
  ('camiseta-multiplicacao-preta-infantil', '/products/costas_menina_preta_v2.png', 'Camiseta Preta infantil, costas', 1)
) as i(slug, path, alt, pos) on i.slug = p.slug;

-- Variantes por tamanho (estoque próprio). Adulto: PP..EXGG · Infantil: 2..10
insert into public.product_variants (product_id, size, stock, position)
select p.id, s.size, s.stock, s.position
from public.products p
join lateral (values
  ('camiseta-multiplicacao-off-white-feminino','PP',4,0),('camiseta-multiplicacao-off-white-feminino','P',8,1),('camiseta-multiplicacao-off-white-feminino','M',10,2),('camiseta-multiplicacao-off-white-feminino','G',7,3),('camiseta-multiplicacao-off-white-feminino','GG',5,4),('camiseta-multiplicacao-off-white-feminino','XGG',2,5),('camiseta-multiplicacao-off-white-feminino','EXGG',0,6),
  ('camiseta-multiplicacao-preta-feminino','PP',6,0),('camiseta-multiplicacao-preta-feminino','P',9,1),('camiseta-multiplicacao-preta-feminino','M',12,2),('camiseta-multiplicacao-preta-feminino','G',8,3),('camiseta-multiplicacao-preta-feminino','GG',4,4),('camiseta-multiplicacao-preta-feminino','XGG',3,5),('camiseta-multiplicacao-preta-feminino','EXGG',1,6),
  ('camiseta-multiplicacao-off-white-masculino','PP',3,0),('camiseta-multiplicacao-off-white-masculino','P',7,1),('camiseta-multiplicacao-off-white-masculino','M',11,2),('camiseta-multiplicacao-off-white-masculino','G',9,3),('camiseta-multiplicacao-off-white-masculino','GG',6,4),('camiseta-multiplicacao-off-white-masculino','XGG',4,5),('camiseta-multiplicacao-off-white-masculino','EXGG',2,6),
  ('camiseta-multiplicacao-preta-masculino','PP',0,0),('camiseta-multiplicacao-preta-masculino','P',6,1),('camiseta-multiplicacao-preta-masculino','M',10,2),('camiseta-multiplicacao-preta-masculino','G',12,3),('camiseta-multiplicacao-preta-masculino','GG',7,4),('camiseta-multiplicacao-preta-masculino','XGG',5,5),('camiseta-multiplicacao-preta-masculino','EXGG',3,6),
  ('camiseta-multiplicacao-off-white-infantil','2',5,0),('camiseta-multiplicacao-off-white-infantil','4',6,1),('camiseta-multiplicacao-off-white-infantil','6',4,2),('camiseta-multiplicacao-off-white-infantil','8',3,3),('camiseta-multiplicacao-off-white-infantil','10',2,4),
  ('camiseta-multiplicacao-preta-infantil','2',6,0),('camiseta-multiplicacao-preta-infantil','4',5,1),('camiseta-multiplicacao-preta-infantil','6',5,2),('camiseta-multiplicacao-preta-infantil','8',4,3),('camiseta-multiplicacao-preta-infantil','10',3,4)
) as s(slug, size, stock, position) on s.slug = p.slug
on conflict (product_id, size) do nothing;

-- Template da mensagem Pix
insert into public.message_templates (key, name, body) values
  ('pix', 'Mensagem Pix',
   E'Olá {{cliente}}! Seu pedido #{{pedido}} foi aceito 🎉\nTotal: {{valor}}\nPix ({{recebedor}}): {{chave_pix}}\nAssim que confirmarmos o pagamento, seguimos com a separação. Obrigado!')
on conflict (key) do nothing;

-- Configurações
insert into public.settings (key, value, is_public) values
  ('pix',   '{"chave":"pixdaconquista@gmail.com","recebedor":"Casa de Filadélfia","banco":"","observacao":"","whatsapp_loja":"(83) 2178-8064"}'::jsonb, false),
  ('visual','{"primaryColor":"#161616","logoUrl":"/logo.png","bannerUrl":""}'::jsonb, true),
  ('store', '{"name":"Casa de Filadélfia","whatsapp":""}'::jsonb, true),
  ('pwa',   '{"name":"Casa de Filadélfia","shortName":"Filadélfia"}'::jsonb, true)
on conflict (key) do nothing;

-- ============================================================
-- Para promover um usuário a admin (após ele se cadastrar):
--   update public.profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'voce@exemplo.com');
-- ============================================================
