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
          <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--card)_72%,#d6f4df_28%)] dark:bg-[color-mix(in_oklab,var(--card)_74%,#064e3b_26%)]" />
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(135deg,transparent_0%,transparent_42%,color-mix(in_oklab,var(--foreground)_10%,transparent)_42%,color-mix(in_oklab,var(--foreground)_10%,transparent)_43%,transparent_43%,transparent_100%),linear-gradient(90deg,color-mix(in_oklab,#34d399_18%,transparent),transparent_38%,color-mix(in_oklab,#f59e0b_12%,transparent)_100%)]" />
          <div className="absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-xl border border-white/35 bg-white/26 text-2xl font-black text-[var(--foreground)] shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/8">
            {initial}
          </div>
        </div>
      )}

      {src ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-950/34 via-transparent to-transparent opacity-80" />
      ) : null}

      {eyebrow ? (
        <div className="absolute left-3 top-3 rounded-full border border-white/35 bg-stone-950/38 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white shadow-sm backdrop-blur-md">
          {eyebrow}
        </div>
      ) : null}
    </div>
  );
}
