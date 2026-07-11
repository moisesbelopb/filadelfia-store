import { redirect } from "next/navigation";

// O Pix agora vive junto do WhatsApp (é só a mensagem enviada por lá).
export default function PixConfigPage() {
  redirect("/admin/configuracoes/whatsapp");
}
