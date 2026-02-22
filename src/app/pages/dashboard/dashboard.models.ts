export interface TimeSeriesCountDTO {
  periodStart: string;
  count: number;
}

export interface CouponStatsDTO {
  campaignId: number;
  campaignName: string;
  couponsCreated: number;
  couponsRedeemed: number;
  redemptionRatePct: number;
}

export interface SalesSummaryDTO {
  totalSales: number;
  avgTicket: number;
  transactionCount: number;
}

export interface CampaignPerformanceDTO {
  campaignId: number;
  campaignName: string;
  couponsIssued: number;
  redemptions: number;
  totalSales: number;
  avgTicket: number;
  redemptionRatePct: number;
}

// Nueva Lealtix - Métricas de Lealtad

export interface RepeatPurchaseRateDTO {
  totalCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  oneTimeBuyers: number;
  multiTimeBuyers: number;
}

export interface IdentifiedVsGeneralDTO {
  identifiedOrdersCount: number;
  identifiedRevenue: number;
  identifiedAvgTicket: number;
  generalOrdersCount: number;
  generalRevenue: number;
  generalAvgTicket: number;
  identifiedPercentage: number;
  generalPercentage: number;
}

export interface CustomerLTVDTO {
  customerId: number;
  customerName: string;
  lifetimeValue: number;
  totalOrders: number;
  averageOrderValue: number;
}

export interface CouponConversionDTO {
  campaignId: number;
  campaignName: string;
  totalCouponsIssued: number;
  totalCouponsRedeemed: number;
  conversionRate: number;
  revenueFromCoupons: number;
}

export interface CustomizationAnalysisDTO {
  keyword: string;
  frequency: number;
  percentage: number;
}

export interface CampaignROIDTO {
  campaignId: number;
  roi: number;
  profit: number;
  revenueGenerated: number;
  campaignCost: number;
}
