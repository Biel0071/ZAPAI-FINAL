import { Button } from "@/components/ui/button";

interface NewMessagesBannerProps {
  unseenRealtimeCount: number;
  onScrollToLatest: () => void;
}

export function NewMessagesBanner({ unseenRealtimeCount, onScrollToLatest }: NewMessagesBannerProps) {
  if (unseenRealtimeCount <= 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="mx-auto flex max-w-3xl justify-center">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 rounded-full border border-border/70 px-4 text-xs"
          onClick={onScrollToLatest}
        >
          {unseenRealtimeCount === 1 ? "1 nova mensagem" : `${unseenRealtimeCount} novas mensagens`}
        </Button>
      </div>
    </div>
  );
}
