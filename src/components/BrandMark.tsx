import Image from "next/image";

/** App mark used in nav / login. */
export function BrandMark({
  size = 36,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/veninspect-mark.png"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-lg object-contain ${className}`}
      priority={priority}
    />
  );
}

/** Ventia logo for printed report / scope headers. */
export function VentiaPrintLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- print-friendly plain img
    <img
      src="/brand/ventia-logo.png"
      alt="Ventia"
      className={`h-10 w-auto object-contain print:h-12 ${className}`}
    />
  );
}
