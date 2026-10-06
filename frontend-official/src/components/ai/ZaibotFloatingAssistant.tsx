import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Copilot = lazy(() => import('./ZaiPlatformAssistantView').then(module => ({ default: module.ZaiPlatformAssistantView })));

export function ZaibotFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return <>
    <Button type="button" aria-label="Abrir Assistente ZAI" onClick={() => setOpen(true)}
      className="fixed bottom-24 right-4 z-40 h-12 w-12 rounded-full bg-emerald-600 p-0 shadow-lg hover:bg-emerald-500 md:bottom-6 md:right-6">
      <Bot className="h-6 w-6" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl max-h-[90dvh] overflow-y-auto border-emerald-500/30 bg-card">
        <DialogHeader><DialogTitle>Assistente ZAI</DialogTitle></DialogHeader>
        <Suspense fallback={<p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando assistente…</p>}>
          <Copilot onOpenNewAgentWizard={() => { setOpen(false); navigate('/attendants?new=1'); }} />
        </Suspense>
      </DialogContent>
    </Dialog>
  </>;
}
