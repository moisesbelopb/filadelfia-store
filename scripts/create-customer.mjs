// Cria (ou atualiza) um CLIENTE fictício para testar a loja de ponta a ponta.
// Uso:  pnpm create-customer [email] [senha]
// Sem argumentos, usa os valores padrão abaixo.
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local ausente — segue com variáveis de ambiente do processo
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "✗ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local antes de rodar.",
  );
  process.exit(1);
}

const email = process.argv[2] || "cliente.teste@filadelfia.com";
const password = process.argv[3] || "Teste@123456";
const name = "Maria Teste";
const whatsapp = "(83) 99999-0000";
// Endereço de João Pessoa → cai na taxa de entrega de R$ 12.
const defaultAddress = {
  street: "R. das Trincheiras",
  number: "100",
  complement: "",
  neighborhood: "Centro",
  city: "João Pessoa",
  state: "PB",
  zip: "58011-000",
};

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findByEmail(target) {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === target.toLowerCase());
}

let userId;
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
});

if (error) {
  const existing = await findByEmail(email);
  if (!existing) {
    console.error("✗ Erro ao criar usuário:", error.message);
    process.exit(1);
  }
  userId = existing.id;
  await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  console.log("• Cliente já existia; senha redefinida.");
} else {
  userId = data.user.id;
  console.log("• Cliente criado.");
}

const { error: pErr } = await supabase.from("profiles").upsert(
  {
    id: userId,
    full_name: name,
    whatsapp,
    role: "cliente",
    default_address: defaultAddress,
  },
  { onConflict: "id" },
);

if (pErr) {
  console.error("✗ Erro ao salvar o perfil do cliente:", pErr.message);
  process.exit(1);
}

console.log("\n✓ Cliente de teste pronto! Faça login na loja com:");
console.log(`   E-mail: ${email}`);
console.log(`   Senha:  ${password}`);
console.log("\n  Endereço padrão: João Pessoa/PB (entrega R$ 12).");
