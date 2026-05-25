import type { ContactGridItem } from "@/components/contacts/ContactGrid";
import type { ContactSegment } from "@/components/contacts/ContactSidebar";

export type ContactsSummaryCard = {
  label: string;
  value: string;
  tone: "primary" | "default" | "success";
};

export type ContactListItem = ContactGridItem & {
  unread?: number;
  lastMessage?: string;
};

export type ContactsLovableViewModel = {
  summaryCards: ContactsSummaryCard[];
  segment: ContactSegment;
  totalFiltered: number;
  groupCount: number;
  individualCount: number;
  contacts: ContactListItem[];
};

export function createContactsLovableViewModel(params: {
  activeSegment: ContactSegment;
  filteredContacts: ContactListItem[];
  totalContacts: number;
  groupCount: number;
  individualCount: number;
}): ContactsLovableViewModel {
  const { activeSegment, filteredContacts, totalContacts, groupCount, individualCount } = params;

  return {
    segment: activeSegment,
    totalFiltered: filteredContacts.length,
    groupCount,
    individualCount,
    contacts: filteredContacts,
    summaryCards: [
      { label: "Base total", value: totalContacts.toLocaleString("pt-BR"), tone: "primary" },
      { label: "Contatos individuais", value: individualCount.toLocaleString("pt-BR"), tone: "default" },
      { label: "Grupos", value: groupCount.toLocaleString("pt-BR"), tone: "success" },
    ],
  };
}
