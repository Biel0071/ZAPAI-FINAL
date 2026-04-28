import { Button } from '../../ui/Button';

interface FlowPaletteProps {
  blockTypes: string[];
  onAddBlock: (type: string) => void;
}

export function FlowPalette({ blockTypes, onAddBlock }: FlowPaletteProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {blockTypes.map((type) => (
        <Button key={type} variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onAddBlock(type)}>
          {type}
        </Button>
      ))}
    </div>
  );
}
