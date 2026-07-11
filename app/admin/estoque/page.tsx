import { redirect } from "next/navigation";

// O estoque agora vive como aba dentro de /admin/produtos.
export default function EstoquePage() {
  redirect("/admin/produtos?tab=estoque");
}
