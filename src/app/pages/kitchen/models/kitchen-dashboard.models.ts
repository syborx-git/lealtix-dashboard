export interface KitchenTopDishDTO {
    productId: number;
    productName: string;
    quantity: number;
    totalSales: number;
    rank: number;
}

export interface KitchenRepeatPurchaseRateDTO {
    totalCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    oneTimeBuyers: number;
    multiTimeBuyers: number;
}

export interface KitchenCustomizationAnalysisDTO {
    keyword: string;
    frequency: number;
    percentage: number;
}

export interface KitchenCompletedOrdersDTO {
    completedOrders: number;
    successfulDeliveries: number;
}

export interface KitchenVipAlertDTO {
    active: boolean;
    customerId: number;
    customerName: string;
    customerEmail: string;
    lifetimeValue: number;
    note: string;
}

export interface KitchenDashboardSummaryDTO {
    tenantName: string;
    topDishes: KitchenTopDishDTO[];
    repeatPurchaseRate: KitchenRepeatPurchaseRateDTO;
    completedOrders: KitchenCompletedOrdersDTO;
    customizationAnalysis: KitchenCustomizationAnalysisDTO[];
    vipAlert: KitchenVipAlertDTO | null;
}

export interface KitchenTopDishApiDTO {
    productId: number;
    productName: string;
    quantity: number | string;
    totalSales: number | string;
    rank: number;
}

export interface KitchenRepeatPurchaseRateApiDTO {
    totalCustomers: number | string;
    repeatCustomers: number | string;
    repeatRate: number | string;
    oneTimeBuyers: number | string;
    multiTimeBuyers: number | string;
}

export interface KitchenCompletedOrdersApiDTO {
    completedOrders: number | string;
    successfulDeliveries: number | string;
}

export interface KitchenCustomizationAnalysisApiDTO {
    keyword: string;
    frequency: number | string;
    percentage: number | string;
}

export interface KitchenVipAlertApiDTO {
    active: boolean;
    customerId: number | string;
    customerName: string;
    customerEmail: string;
    lifetimeValue: number | string;
    note: string;
}

export interface KitchenDashboardSummaryApiDTO {
    tenantName: string;
    topDishes: KitchenTopDishApiDTO[];
    repeatPurchaseRate: KitchenRepeatPurchaseRateApiDTO;
    completedOrders: KitchenCompletedOrdersApiDTO;
    customizationAnalysis: KitchenCustomizationAnalysisApiDTO[];
    vipAlert: KitchenVipAlertApiDTO | null;
}
