import logoWhite from "@/assets/logo-livonius.svg";
import logoColor from "@/assets/logo-livonius-color.svg";

interface LivoniusLogoProps {
  variant?: "white" | "color";
  className?: string;
  alt?: string;
}

export function LivoniusLogo({ 
  variant = "color", 
  className = "h-8 w-auto",
  alt = "Livonius"
}: LivoniusLogoProps) {
  const src = variant === "white" ? logoWhite : logoColor;
  
  return (
    <img 
      src={src} 
      alt={alt} 
      className={className}
    />
  );
}
