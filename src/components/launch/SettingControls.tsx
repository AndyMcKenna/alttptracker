import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";

interface SettingSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SettingSelect({ label, value, onChange, options }: SettingSelectProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Select value={value} onValueChange={(v) => { if (v !== null) onChange(v); }}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface SettingSwitchProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Longer explanation, shown when hovering a "?" next to the label */
  description?: string;
}

export function SettingSwitch({ label, checked, onChange, disabled = false, description }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <Label
          className={`text-xs ${disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}
          onClick={() => {
            if (!disabled) onChange(!checked);
          }}
        >
          {label}
        </Label>
        {description && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`}>
              <CircleHelp className="size-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{description}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}
