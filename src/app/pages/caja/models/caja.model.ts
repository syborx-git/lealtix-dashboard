export interface TurnoDTO {
  idTurno: number;
  tenantId: number;
  idCajero: number;
  nombreCajero: string;
  fechaApertura: string;
  fechaCierre?: string;
  fondoInicial: number;
  totalIngresos: number;
  totalPropinas: number;
  totalEfectivoDeclarado?: number;
  diferenciaCaja?: number;
  estado: 'ABIERTO' | 'CERRADO';
  observaciones?: string;
}

export interface AbrirTurnoRequest {
  tenantId: number;
  cajeroId: number;
  fondoInicial: number;
  observaciones?: string;
}

export interface CerrarTurnoRequest {
  tenantId: number;
  idTurno: number;
  totalEfectivoDeclarado: number;
  observaciones?: string;
}

export interface CobrarComandaRequest {
  tenantId: number;
  cajeroId: number;
  metodoPago: string;
  montoCuenta: number;
  montoPropina: number;
  referencia?: string;
}

export interface LiquidarPropinasRequest {
  tenantId: number;
  idTurno: number;
  idMesero: number;
  idCajero: number;
  porcentajeRetencion: number;
}

export interface ComandaCajaRow {
  id: string;
  folioComanda: string;
  estado: string;
  idMesa?: number;
  mesaNombre: string;
  idMesero?: number;
  meseroNombre: string;
  clienteNombre: string;
  subtotal: number;
  descuento: number;
  total: number;
  totalItems: number;
  horaApertura: string;
  fechaImpresionTicket?: string;
  propinasLiquidadas?: boolean;
}

export interface TableroCaja {
  cuentasAbiertas: ComandaCajaRow[];
  cuentasPorCobrar: ComandaCajaRow[];
}

export interface ItemPrecuenta {
  nombreProducto: string;
  cantidad: number;
  precioUnitario: number;
  totalLinea: number;
  asientoAlias?: string;
}

export interface TicketPrecuenta {
  idComanda: string;
  folioComanda: string;
  mesaNombre: string;
  meseroNombre: string;
  clienteNombre: string;
  fechaApertura: string;
  fechaImpresion: string;
  subtotal: number;
  descuento: number;
  total: number;
  propinaSugerida10: number;
  propinaSugerida15: number;
  propinaSugerida20: number;
  items: ItemPrecuenta[];
}

export interface DesgloseMetodoPago {
  metodoPago: string;
  transacciones: number;
  totalCuenta: number;
  totalPropina: number;
  totalRecaudado: number;
}

export interface ResumenTurnoCorte {
  turno: TurnoDTO;
  totalArticulosVendidos: number;
  totalComandasCobradas: number;
  totalVentas: number;
  totalCuenta?: number;
  totalPropinas: number;
  totalRecaudado?: number;
  fondoInicial: number;
  efectivoEsperadoEnCaja: number;
  desgloseMetodos: DesgloseMetodoPago[];
  fechaCorte?: string;
}

export interface PagoDTO {
  idPago: number;
  tenantId: number;
  idComanda: string;
  idTurno: number;
  idCajero: number;
  nombreCajero?: string;
  metodoPago: string;
  montoCuenta: number;
  montoPropina: number;
  montoTotal: number;
  referencia?: string;
  fecha: string;
  estado: string;
}

export interface CorteMesero {
  idMesero: number;
  nombreMesero: string;
  totalComandasAtendidas: number;
  totalVentas: number;
  totalPropinas: number;
  propinasPendientesLiquidar: number;
  pagosRealizados: PagoDTO[];
  desgloseMetodos: DesgloseMetodoPago[];
}

export interface MeseroSimple {
  id: number;
  nombre: string;
  email: string;
}
