import Image from "next/image";

type CourseThumbnailProps = {
  src?: string | null;
  title: string;
  eyebrow?: string;
  className?: string;
  imageClassName?: string;
  muted?: boolean;
};

export function CourseThumbnail({
  src,
  title,
  eyebrow,
  className = "",
  imageClassName = "",
  muted = false,
}: CourseThumbnailProps) {
  const initial = title.trim().charAt(0).toUpperCase() || "C";

  return (
    <div
      className={`relative isolate min-w-0 max-w-full overflow-hidden bg-[color-mix(in_oklab,var(--card)_82%,var(--border)_18%)] ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className={`object-cover transition duration-500 ${muted ? "grayscale" : ""} ${imageClassName}`}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      ) : (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--card)_86%,var(--background)_14%)]" />
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(90deg,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px),linear-gradient(180deg,color-mix(in_oklab,var(--foreground)_7%,transparent)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-xl font-black text-[var(--foreground)]">
            {initial}
          </div>
        </div>
      )}

      {src ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-950/34 via-transparent to-transparent opacity-80" />
      ) : null}

      {eyebrow ? (
        <div className="absolute left-3 top-3 rounded-md border border-white/20 bg-stone-950/54 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
          {eyebrow}
        </div>
      ) : null}
    </div>
  );
}
