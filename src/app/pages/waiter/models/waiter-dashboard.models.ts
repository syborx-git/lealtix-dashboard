/**
 * Waiter Dashboard Data Models & DTOs
 * Defines all data structures used in the waiter dashboard feature
 */

/**
 * Main KPI metrics for waiter dashboard
 * Consolidated summary of important metrics for shift
 */
export interface WaiterDashboardSummaryDTO {
  salesIdentifiedPercentage: number;      // % of identified vs general sales
  newClientsToday: number;                 // Clients created by this user today
  ordersToday: number;                     // Total orders processed today
  repurchaseRate: number;                  // Repurchase rate % for user's customers
  totalSalesIdentified: number;            // Total sales from identified customers
  totalSalesGeneral: number;               // Total sales from general/guest orders
}

/**
 * VIP Client - Top customers by LTV not visited recently
 * Used in VIP clients table section
 */
export interface VipClientDTO {
  id: number;
  name: string;
  ltv: number;                            // Life Time Value
  lastVisitDate: string;                  // ISO date string (e.g., "2025-03-28")
  phone: string;
  email?: string;
  visitCount?: number;
  averageTicket?: number;
}

/**
 * Cross-sell suggestion product
 * Product recommended based on customer purchase history
 */
export interface CrossSellProductDTO {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
  category?: string;
  suggestedFor?: string;                  // e.g., "Clientes que compraron bebidas"
  stock?: number;
}

/**
 * KPI Card metric structure
 * Reusable for displaying individual KPI cards
 */
export interface KpiMetricDTO {
  label: string;
  value: string | number;
  icon: string;                           // PrimeNG icon class (e.g., 'pi-trending-up')
  trend?: number;                         // % change, positive or negative
  color: 'indigo' | 'green' | 'blue' | 'orange';
  suffix?: string;                        // e.g., '%' or '$'
}

/**
 * Facade response - Complete waiter dashboard data
 * Contains all data needed to render dashboard
 */
export interface WaiterDashboardResponse {
  summary: WaiterDashboardSummaryDTO;
  vipClients: VipClientDTO[];
  crossSellProducts: CrossSellProductDTO[];
  messages?: string[];                    // Motivational messages
}
