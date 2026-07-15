import { redirect } from "next/navigation";

/** O relatório de entregas virou a aba "Relatórios" em Config. entregas. */
export default function EntregasRedirect() {
  redirect("/admin/configuracoes/entrega");
}
