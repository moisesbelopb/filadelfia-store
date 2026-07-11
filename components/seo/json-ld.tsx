/** Injeta dados estruturados schema.org (JSON-LD) para SEO. */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data);
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD serializado (schema.org)
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
