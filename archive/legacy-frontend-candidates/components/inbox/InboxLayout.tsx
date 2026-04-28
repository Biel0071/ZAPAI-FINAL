import { ReactNode } from 'react';

interface InboxLayoutProps {
  conversationList: ReactNode;
  chatWindow: ReactNode;
  sidePanel: ReactNode;
}

export function InboxLayout({ conversationList, chatWindow, sidePanel }: InboxLayoutProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[340px,1fr,320px]">
      {conversationList}
      {chatWindow}
      {sidePanel}
    </div>
  );
}
