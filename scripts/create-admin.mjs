// Cria (ou atualiza) um usuário administrador nativo no Supabase.
// Uso:  pnpm create-admin [email] [senha]
// Sem argumentos, usa ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD do .env.local.
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

const email =
  process.argv[2] || process.env.ADMIN_BOOTSTRAP_EMAIL || "casadefiladelfia@gmail.com";
const password = process.argv[3] || process.env.ADMIN_BOOTSTRAP_PASSWORD;
const name = process.env.ADMIN_BOOTSTRAP_NAME || "Casa de Filadélfia";

if (!password) {
  console.error(
    "✗ Informe a senha: pnpm create-admin <email> <senha>  (ou defina ADMIN_BOOTSTRAP_PASSWORD).",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findByEmail(target) {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return (data?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === target.toLowerCase(),
  );
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
  console.log("• Usuário já existia; senha redefinida.");
} else {
  userId = data.user.id;
  console.log("• Usuário criado.");
}

const { error: pErr } = await supabase
  .from("profiles")
  .upsert({ id: userId, full_name: name, role: "super_admin" }, { onConflict: "id" });

if (pErr) {
  console.error("✗ Erro ao definir o papel:", pErr.message);
  process.exit(1);
}

console.log(`✓ Administrador pronto: ${email} (super_admin)`);
console.log("  Acesse /login e depois /admin.");
