import { getBrandBadgeStyle } from "@/lib/brandBadge";

type Props = {
  brand: string;
  className?: string;
  size?: "xs" | "sm";
};

export function BrandBadge({ brand, className = "", size = "sm" }: Props) {
  const style = getBrandBadgeStyle(brand);
  const sizeClass =
    size === "xs"
      ? "px-1.5 py-0.5 text-[8px] tracking-wide"
      : "px-2 py-0.5 text-[9px] tracking-wider sm:text-[10px]";

  return (
    <span
      className={`inline-block max-w-full truncate rounded-md font-bold uppercase shadow-sm ring-1 backdrop-blur-[2px] ${sizeClass} ${style.bg} ${style.text} ${style.ring} ${className}`}
      title={brand}
    >
      {brand}
    </span>
  );
}
