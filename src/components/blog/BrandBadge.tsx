import { cn } from "@/lib/utils";

interface BrandBadgeProps {
  brand: "livonius" | "livo" | string;
  className?: string;
  size?: "sm" | "md";
}

export function BrandBadge({ brand, className, size = "sm" }: BrandBadgeProps) {
  const isLivonius = brand === "livonius";
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        isLivonius
          ? "bg-primary text-primary-foreground"
          : "bg-green-500 text-white",
        className
      )}
    >
      {isLivonius ? "Livonius" : "Livo"}
    </span>
  );
}
