import { VisualForm } from "@/components/admin/visual-form";
import { getSetting } from "@/lib/queries/admin";
import type { VisualSettings } from "@/lib/theme";

export default async function VisualConfigPage() {
  const settings = await getSetting<VisualSettings>("visual");

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">Visual da loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize cores, cantos e o efeito de vidro do topo. O preview à direita atualiza em
          tempo real e as mudanças valem para a loja ao salvar.
        </p>
      </div>

      <VisualForm settings={settings} />
    </div>
  );
}
