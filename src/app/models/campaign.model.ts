import { CampaignTemplate } from './campaign-template.model';

export interface CreateCampaignRequest {
  templateId?: number | null;
  businessId: number;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  promoType?: string;
  promoValue?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  callToAction?: string;
  channels?: string[];
  segmentation?: string;
  isAutomatic?: boolean;
  isDraft?: boolean;
  status?: string;
}

/**
 * Configures reward settings for a campaign
 */
export interface ConfigureRewardRequest {
  rewardType: 'PERCENT_DISCOUNT' | 'FIXED_AMOUNT' | 'FREE_PRODUCT' | 'BUY_X_GET_Y' | 'CUSTOM' | 'NONE';
  numericValue?: number;
  productId?: number;
  buyQuantity?: number;
  freeQuantity?: number;
  customConfig?: string;
  description?: string;
  minPurchaseAmount?: number;
  usageLimit?: number;
}

export interface UpdateCampaignRequest {
  title?: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  promoType?: string;
  promoValue?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  status?: string;
  callToAction?: string;
  channels?: string[];
  segmentation?: string;
  isAutomatic?: boolean;
  isDraft?: boolean;
  reward?: ConfigureRewardRequest;
}

export interface CampaignResponse {
  id: number;
  template?: CampaignTemplate;
  businessId: number;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  promoType?: string;
  promoValue?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  callToAction?: string;
  channels?: string[];
  segmentation?: string;
  isAutomatic?: boolean;
  isDraft?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  promotionReward?: any; // PromotionRewardResponse embedded in campaign
}

export interface CampaignValidationResult {
  campaignId: number;
  configComplete: boolean;
  missingItems: string[];
  severity: 'OK' | 'ACTION_REQUIRED';
}

export interface CampaignWithValidation {
  campaign: CampaignResponse;
  validation: CampaignValidationResult;
}
