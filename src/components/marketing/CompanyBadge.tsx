import { cn } from "@/lib/utils";

export type PostCompany = "livonius" | "livo";

interface CompanyBadgeProps {
  company: PostCompany | string;
  className?: string;
  size?: "sm" | "md";
}

export const POST_COMPANY_CONFIG: Record<PostCompany, { label: string }> = {
  livonius: { label: "Livonius" },
  livo: { label: "Livo" },
};

export function CompanyBadge({ company, className, size = "sm" }: CompanyBadgeProps) {
  const isLivonius = company === "livonius";
  const config = POST_COMPANY_CONFIG[company as PostCompany] || POST_COMPANY_CONFIG.livonius;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        isLivonius
          ? "bg-primary text-primary-foreground"
          : "bg-sky-600 text-white",
        className
      )}
    >
      {config.label}
    </span>
  );
}
