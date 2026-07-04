type BrandMarkProps = {
  className?: string;
  width?: number;
  height?: number;
};

const SOURCES = [
  { srcSet: "https://i.imgur.com/13VMp4Q.webp", type: "image/webp" },
];

const FALLBACK_CHAIN = [
  "https://i.imgur.com/13VMp4Q.png",
  "https://i.imgur.com/13VMp4Q.jpg",
  "https://i.imgur.com/13VMp4Q.jpeg",
];

/**
 * OfficePulse brand mark. Uses a <picture> with a WebP source and an <img> with
 * a multi-step onError fallback chain so missing formats still resolve.
 */
export function BrandMark({ className, width = 480, height = 330 }: BrandMarkProps) {
  return (
    <picture>
      {SOURCES.map((s) => (
        <source
          key={s.srcSet}
          srcSet={s.srcSet}
          type={s.type}
          onError={(e) => {
            const img = e.currentTarget.parentElement?.querySelector(
              "img",
            ) as HTMLImageElement | null;
            img?.setAttribute("src", FALLBACK_CHAIN[1]);
          }}
        />
      ))}
      <img
        src={FALLBACK_CHAIN[0]}
        alt="OfficePulse"
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={(e) => {
          const img = e.currentTarget;
          const idx = FALLBACK_CHAIN.findIndex((u) => img.src.endsWith(u.split("/").pop() ?? ""));
          if (idx >= 0 && idx < FALLBACK_CHAIN.length - 1) {
            img.src = FALLBACK_CHAIN[idx + 1];
          }
        }}
        className={className ?? "h-8 w-auto select-none"}
      />
    </picture>
  );
}

export default BrandMark;
