const DOCS_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DocScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export function DocScreenshot({ src, alt, caption }: DocScreenshotProps) {
  const resolvedSrc = src.startsWith("/") ? `${DOCS_BASE}${src}` : src;
  return (
    <figure className="my-8">
      <img
        src={resolvedSrc}
        alt={alt}
        className="w-full rounded-xl border border-white/10 shadow-2xl shadow-black/60"
        style={{ display: "block" }}
      />
      {caption && (
        <figcaption className="mt-2.5 text-center text-xs text-white/35">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
