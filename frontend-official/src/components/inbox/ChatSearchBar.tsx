import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function ChatSearchBar({ value, onChange, placeholder = "Buscar...", className, inputClassName }: ChatSearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("pl-9", inputClassName)}
      />
    </div>
  );
}
