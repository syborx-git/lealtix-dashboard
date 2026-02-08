import { RewardType } from '@/models/enums';

/**
 * Reward type options for campaign reward configuration
 * Used in campaign-form and create-campaign components
 * Centralized to ensure consistency across the application
 */
export const REWARD_TYPE_OPTIONS = [
  { label: 'Descuento porcentual', value: RewardType.PERCENT_DISCOUNT },
  { label: 'Monto fijo', value: RewardType.FIXED_AMOUNT },
  { label: 'Producto gratis', value: RewardType.FREE_PRODUCT },
  { label: '2x1 (Compra 1 lleva 1)', value: RewardType.BUY_X_GET_Y },
  { label: 'Ninguno (Solo Promoción)', value: RewardType.NONE }
];
