export interface CampaignTemplate {
  id?: number;
  name: string;
  category?: string;
  defaultTitle?: string;
  defaultSubtitle?: string;
  defaultDescription?: string;
  defaultImageUrl?: string;
  defaultPromoType?: string;
  active?: boolean;
  inUse?: boolean;
}
