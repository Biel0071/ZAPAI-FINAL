import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIIconProps extends React.ComponentPropsWithoutRef<typeof Bot> {
  weight?: string;
}

export function AIIcon({ className, weight, ...props }: AIIconProps) {
  // Padronizar stroke a 1.8 e peso visual, ignorando prop "weight" do Phosphor
  return (
    <Bot
      className={cn("flex-shrink-0 transition-all", className)}
      strokeWidth={1.8}
      {...props}
    />
  );
}

export default AIIcon;
