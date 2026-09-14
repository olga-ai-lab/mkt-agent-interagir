import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { POST_COMPANY_CONFIG, type PostCompany } from "./CompanyBadge";

interface CompanySelectorProps {
  value: PostCompany;
  onChange: (value: PostCompany) => void;
  disabled?: boolean;
}

export function CompanySelector({ value, onChange, disabled }: CompanySelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Label>Empresa</Label>
      </div>
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as PostCompany)}
        disabled={disabled}
        className="space-y-2"
      >
        {(Object.keys(POST_COMPANY_CONFIG) as PostCompany[]).map((key) => (
          <div key={key} className="flex items-center space-x-2">
            <RadioGroupItem value={key} id={`company-${key}`} />
            <Label 
              htmlFor={`company-${key}`} 
              className="cursor-pointer font-normal"
            >
              {POST_COMPANY_CONFIG[key].label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
