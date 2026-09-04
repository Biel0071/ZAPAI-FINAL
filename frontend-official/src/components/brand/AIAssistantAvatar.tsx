import { cn } from "@/lib/utils"
import { Sparkle, Brain } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"

interface AIAssistantAvatarProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showStatus?: boolean
  label?: string
}

export function AIAssistantAvatar({ 
  className, 
  size = "md", 
  showStatus = true,
  label = "ZAI Assistant"
}: AIAssistantAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-[12px]",
    md: "h-12 w-12 text-[20px]",
    lg: "h-16 w-16 text-[24px]"
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative">
        <div className={cn(
          "flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-glow",
          sizeClasses[size]
        )}>
          <Brain weight="fill" className="h-[50%] w-[50%]" />
        </div>
        {showStatus && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-emerald-500 shadow-sm">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          </span>
        )}
      </div>
      {label && (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">{label}</span>
          <div className="flex items-center gap-1.5">
            <Sparkle className="h-3 w-3 text-purple-400" weight="fill" />
            <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">AI Powered</span>
          </div>
        </div>
      )}
    </div>
  )
}
