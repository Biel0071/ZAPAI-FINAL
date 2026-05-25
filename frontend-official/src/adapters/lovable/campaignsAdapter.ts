import type { CampaignRecord } from "@/services/apiService";

export type CampaignsLovableViewModel = {
  totalCampaigns: number;
  totalQueuedContacts: number;
  sentMessages: number;
};

export function createCampaignsLovableViewModel(campaigns: CampaignRecord[]): CampaignsLovableViewModel {
  return campaigns.reduce(
    (accumulator, campaign) => {
      accumulator.totalCampaigns += 1;
      accumulator.totalQueuedContacts += Number(campaign.queue?.total ?? campaign.selectedContacts?.length ?? 0);
      accumulator.sentMessages += Number(campaign.queue?.sent ?? 0);
      return accumulator;
    },
    {
      totalCampaigns: 0,
      totalQueuedContacts: 0,
      sentMessages: 0,
    },
  );
}
