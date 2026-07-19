/**
 * Renders one or more JSON-LD blobs as <script type="application/ld+json">.
 *
 * Invariants:
 *   - Server component (no 'use client'); safe to embed in RSC trees.
 *   - Strips `</script>` from values to prevent breakouts when content
 *     happens to embed that token (e.g. a description that quotes HTML).
 *   - Accepts a single object or an array; renders one tag per entry so
 *     each schema validates independently in Google's Rich Results Test.
 * Side effects: none.
 */
type Schema = Record<string, unknown>;

interface Props {
  data: Schema | Schema[];
}

function safeStringify(schema: Schema): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

export default function JsonLd({ data }: Props) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeStringify(schema) }}
        />
      ))}
    </>
  );
}
