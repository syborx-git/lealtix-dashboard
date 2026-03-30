/**
 * Mock data service for local testing
 * Simulaes backend responses for development
 */

import {
  WaiterDashboardSummaryDTO,
  VipClientDTO,
  CrossSellProductDTO,
  WaiterDashboardResponse
} from './waiter-dashboard.models';

export class WaiterDashboardMockData {
  static getMetrics(): WaiterDashboardSummaryDTO {
    return {
      salesIdentifiedPercentage: 78.5,
      newClientsToday: 3,
      ordersToday: 12,
      repurchaseRate: 72.0,
      totalSalesIdentified: 2500.00,
      totalSalesGeneral: 680.00
    };
  }

  static getVipClients(): VipClientDTO[] {
    return [
      {
        id: 1,
        name: 'Juan García Rodríguez',
        ltv: 3450.75,
        lastVisitDate: '2025-03-25',
        phone: '+34 612 345 678',
        email: 'juan.garcia@example.com',
        visitCount: 24,
        averageTicket: 143.78
      },
      {
        id: 2,
        name: 'María López Martínez',
        ltv: 2890.50,
        lastVisitDate: '2025-03-23',
        phone: '+34 623 456 789',
        email: 'maria.lopez@example.com',
        visitCount: 18,
        averageTicket: 160.58
      },
      {
        id: 3,
        name: 'Carlos Fernández Díaz',
        ltv: 2345.00,
        lastVisitDate: '2025-03-20',
        phone: '+34 634 567 890',
        email: 'carlos.fernandez@example.com',
        visitCount: 15,
        averageTicket: 156.33
      },
      {
        id: 4,
        name: 'Ana Martínez González',
        ltv: 1890.25,
        lastVisitDate: '2025-03-18',
        phone: '+34 645 678 901',
        email: 'ana.martinez@example.com',
        visitCount: 12,
        averageTicket: 157.52
      },
      {
        id: 5,
        name: 'Pedro Ruiz Sánchez',
        ltv: 1650.00,
        lastVisitDate: '2025-03-15',
        phone: '+34 656 789 012',
        email: 'pedro.ruiz@example.com',
        visitCount: 11,
        averageTicket: 150.00
      }
    ];
  }

  static getCrossSellProducts(): CrossSellProductDTO[] {
    return [
      {
        id: 101,
        name: 'Agua Premium Mineral',
        price: 3.99,
        imageUrl: 'https://via.placeholder.com/150?text=Agua',
        category: 'Bebidas',
        suggestedFor: 'Clientes que compraron comida'
      },
      {
        id: 102,
        name: 'Jugo Natural Naranja',
        price: 5.99,
        imageUrl: 'https://via.placeholder.com/150?text=Jugo',
        category: 'Bebidas',
        suggestedFor: 'Clientes que compraron postres'
      },
      {
        id: 103,
        name: 'Café Premium',
        price: 3.50,
        imageUrl: 'https://via.placeholder.com/150?text=Cafe',
        category: 'Bebidas',
        suggestedFor: 'Todos los clientes'
      },
      {
        id: 104,
        name: 'Sopa del Día',
        price: 7.99,
        imageUrl: 'https://via.placeholder.com/150?text=Sopa',
        category: 'Comida',
        suggestedFor: 'Clientes que compraron entrada'
      },
      {
        id: 105,
        name: 'Postre Especial',
        price: 6.50,
        imageUrl: 'https://via.placeholder.com/150?text=Postre',
        category: 'Postres',
        suggestedFor: 'Clientes después de plato principal'
      },
      {
        id: 106,
        name: 'Tabla de Quesos',
        price: 12.99,
        imageUrl: 'https://via.placeholder.com/150?text=Quesos',
        category: 'Compartido',
        suggestedFor: 'Clientes en grupos'
      },
      {
        id: 107,
        name: 'Vino Tinto Reserva',
        price: 18.50,
        imageUrl: 'https://via.placeholder.com/150?text=Vino',
        category: 'Bebidas Premium',
        suggestedFor: 'Clientes VIP'
      },
      {
        id: 108,
        name: 'Ensalada Premium',
        price: 9.99,
        imageUrl: 'https://via.placeholder.com/150?text=Ensalada',
        category: 'Comida',
        suggestedFor: 'Clientes salud-conscientes'
      },
      {
        id: 109,
        name: 'Postre Chocolate',
        price: 5.99,
        imageUrl: 'https://via.placeholder.com/150?text=Chocolate',
        category: 'Postres',
        suggestedFor: 'Todos los clientes'
      },
      {
        id: 110,
        name: 'Café con Licor',
        price: 6.99,
        imageUrl: 'https://via.placeholder.com/150?text=CafeConLicor',
        category: 'Bebidas Premium',
        suggestedFor: 'Clientes nocturnos'
      }
    ];
  }

  static getCompleteResponse(): WaiterDashboardResponse {
    return {
      summary: this.getMetrics(),
      vipClients: this.getVipClients(),
      crossSellProducts: this.getCrossSellProducts(),
      messages: [
        '¡Increíble! Tus clientes vuelven un 72% más',
        'Top mesero: 78.5% de ventas identificadas',
        'Meta diaria casi cumplida: 12/15 órdenes'
      ]
    };
  }
}
