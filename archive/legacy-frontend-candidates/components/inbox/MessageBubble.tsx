import clsx from 'clsx';
import { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

function getMessageTime(createdAt?: string): string {
  if (!createdAt) {
    return '';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const content = message.content || message.text || '';
  const time = getMessageTime(message.createdAt);

  return (
    <div className={clsx('flex', message.fromMe ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          message.fromMe ? 'bg-accent/20 text-slate-100' : 'bg-panelSoft text-slate-100',
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {time ? <p className="mt-1 text-[10px] text-slate-400">{time}</p> : null}
      </div>
    </div>
  );
}
