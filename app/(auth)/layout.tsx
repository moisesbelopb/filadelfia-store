import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[3fr_2fr]">
      {/* Painel editorial (desktop) */}
      <div className="relative hidden overflow-hidden bg-background lg:block">
        {/* Imagem + escurecimento dissolvem na direita (mask) revelando o off-white: transição sem emenda */}
        <div className="absolute inset-0 [-webkit-mask-image:linear-gradient(to_right,#000000ff_66%,#000000f0_76%,#00000099_87%,#00000038_94%,#00000000)] [mask-image:linear-gradient(to_right,#000000ff_66%,#000000f0_76%,#00000099_87%,#00000038_94%,#00000000)]">
          <Image
            src="/products/modelo_mulher_camisa_preta.webp"
            alt="Coleção Multiplicação — Casa de Filadélfia"
            fill
            priority
            sizes="60vw"
            className="object-cover object-[center_18%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/25" />
        </div>
        <div className="absolute inset-0 flex flex-col p-10 xl:p-14">
          <Link href="/" aria-label="Casa de Filadélfia — início" className="w-fit">
            <Image
              src="/logo.png"
              alt="Casa de Filadélfia"
              width={884}
              height={355}
              className="h-11 w-auto brightness-0 invert"
            />
          </Link>
          <div className="mb-[15vh] mt-auto flex flex-col gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/70">
              Ano da Multiplicação · 2026
            </p>
            <p className="font-display text-5xl font-bold uppercase leading-[0.92] tracking-[0.02em] text-white xl:text-6xl">
              Multiplicação
            </p>
            <p className="max-w-md text-base text-white/85">
              A camisa oficial do Ano da Multiplicação — oversized, em algodão, para toda a família.
            </p>
          </div>
        </div>
      </div>

      {/* Painel do formulário */}
      <div className="flex flex-col items-center justify-center gap-8 bg-background px-4 py-12 sm:px-8">
        <Link
          href="/"
          aria-label="Casa de Filadélfia — início"
          className="flex items-center lg:hidden"
        >
          <Image
            src="/logo.png"
            alt="Casa de Filadélfia"
            width={884}
            height={355}
            className="h-11 w-auto dark:brightness-0 dark:invert"
          />
        </Link>

        <div className="w-full max-w-sm">{children}</div>

        <Link
          href="/"
          className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Voltar à loja
        </Link>
      </div>
    </div>
  );
}
