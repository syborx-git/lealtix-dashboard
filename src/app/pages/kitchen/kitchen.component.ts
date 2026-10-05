import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { ProductService } from '@/pages/products-menu/service/product.service';
import { InventoryService } from '@/pages/inventario/service/inventory.service';
import { IngredientOption } from '@/pages/comandix/models/menu.model';
import { KitchenOrder, KitchenOrderItem } from './models/kitchen-order.model';
import { KitchenOrderFacadeService } from './services/kitchen-order-facade.service';
import { buildBeverageProductIds, isBeverageProduct } from './services/order-beverage-utils';

@Component({
    selector: 'app-kitchen',
    standalone: true,
    imports: [CommonModule, CardModule, ButtonModule, TagModule, ProgressSpinnerModule, ToastModule, DialogModule, DividerModule],
    providers: [MessageService],
    templateUrl: './kitchen.component.html',
    styleUrl: './kitchen.component.scss'
})
export class KitchenComponent implements OnInit, OnDestroy {
    orders: KitchenOrder[] = [];
    loading = false;
    connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    currentTime = Date.now();



    // Signals para modal de detalle
    selectedOrderForDetail = signal<KitchenOrder | null>(null);
    showOrderDetailDialog = signal<boolean>(false);
    private readonly deliveredItemsByOrder = new Map<string, Set<string>>();
    pendingReviewOrderId = signal<string | null>(null);

    private readonly destroy$ = new Subject<void>();
    private timerRef: ReturnType<typeof setInterval> | null = null;
    private processingOrderIds = new Set<string>();

    // Catálogo de recetas/adicionales por producto (productId -> receta)
    private readonly recipeCatalog = new Map<number, { recipes: IngredientOption[]; additionals: IngredientOption[] }>();
    readonly recipeCatalogReady = signal<boolean>(false);

    constructor(
        private authService: AuthService,
        private tenantService: TenantService,
        private kitchenOrderFacadeService: KitchenOrderFacadeService,
        private messageService: MessageService,
        private productService: ProductService,
        private inventoryService: InventoryService
    ) {}

    async ngOnInit(): Promise<void> {
        const tenantId = await this.resolveTenantId();
        if (tenantId <= 0) {
            this.messageService.add({
                severity: 'error',
                summary: 'Cocina no disponible',
                detail: 'No se pudo resolver el tenant actual.',
                life: 3500
            });
            return;
        }

        await this.loadBeverageCatalog(tenantId);
        this.kitchenOrderFacadeService.init(tenantId);
        await this.loadRecipeCatalog(tenantId);

        this.kitchenOrderFacadeService.orders$.pipe(takeUntil(this.destroy$)).subscribe((orders) => {
            // La comanda llega completa desde Comandix; Cocina solo prepara platillos,
            // así que se descartan los items que son bebidas (van a Barra).
            this.orders = orders
                .map((order) => ({
                    ...order,
                    items: order.items.filter((item) => !this.isBeverageItem(item.productId))
                }))
                .filter((order) => order.items.length > 0);

            const selectedOrder = this.selectedOrderForDetail();
            if (!selectedOrder) {
                return;
            }

            const updatedSelectedOrder = orders.find((order) => order.id === selectedOrder.id);
            if (!updatedSelectedOrder) {
                this.closeOrderDetail();
                return;
            }

            this.selectedOrderForDetail.set(updatedSelectedOrder);
            this.reconcileDeliveredItems(updatedSelectedOrder);
        });

        this.kitchenOrderFacadeService.loading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
            this.loading = loading;
        });

        this.kitchenOrderFacadeService.connectionStatus$.pipe(takeUntil(this.destroy$)).subscribe((status) => {
            this.connectionStatus = status;
        });

        this.timerRef = setInterval(() => {
            this.currentTime = Date.now();
        }, 1000);
    }

    ngOnDestroy(): void {
        this.kitchenOrderFacadeService.teardown();
        this.destroy$.next();
        this.destroy$.complete();

        if (this.timerRef !== null) {
            clearInterval(this.timerRef);
            this.timerRef = null;
        }
    }

    getPendingOrders(): KitchenOrder[] {
        return this.orders
            .filter((order) => order.status === 'CONFIRMADA' || order.status === 'PENDIENTE')
            .sort((a, b) => this.kitchenOrderFacadeService.parseOrderTime(a.createdAt) - this.kitchenOrderFacadeService.parseOrderTime(b.createdAt));
    }

    getInProgressOrders(): KitchenOrder[] {
        return this.orders
            .filter((order) => order.status === 'EN_PREPARACION')
            .sort((a, b) => this.kitchenOrderFacadeService.parseOrderTime(a.createdAt) - this.kitchenOrderFacadeService.parseOrderTime(b.createdAt));
    }

    getReadyOrders(): KitchenOrder[] {
        return this.orders
            .filter((order) => {
                if (order.status === 'LISTO') {
                    return true;
                }
                if (order.status === 'PAGADA') {
                    return this.kitchenOrderFacadeService.isToday(order.createdAt);
                }
                return false;
            })
            .sort((a, b) => this.kitchenOrderFacadeService.parseOrderTime(b.createdAt) - this.kitchenOrderFacadeService.parseOrderTime(a.createdAt));
    }

    getReadyOrdersCount(): { total: number; shown: number } {
        const count = this.getReadyOrders().length;
        return {
            total: count,
            shown: count
        };
    }

    hasSegundoTiempo(order: KitchenOrder): boolean {
        return (order?.items || []).some((item) => item.tiempo === 2);
    }

    hasPendingSegundoTiempo(order: KitchenOrder): boolean {
        return (order?.recorrido !== 2) && this.hasSegundoTiempo(order);
    }

    isItemYaSalio(order: KitchenOrder, item: KitchenOrderItem): boolean {
        return item.yaSalio === true;
    }

    async startOrder(order: KitchenOrder): Promise<void> {
        if (this.isProcessing(order.id)) {
            return;
        }

        this.processingOrderIds.add(order.id);
        try {
            await this.kitchenOrderFacadeService.startOrder(order.id);
        } catch {
            this.messageService.add({
                severity: 'error',
                summary: 'No se pudo iniciar',
                detail: `El ticket ${this.shortId(order.id)} no pudo pasar a preparación.`,
                life: 3000
            });
        } finally {
            this.processingOrderIds.delete(order.id);
        }
    }

    async finishOrder(order: KitchenOrder): Promise<void> {
        if (this.isProcessing(order.id)) {
            return;
        }

        this.processingOrderIds.add(order.id);
        try {
            await this.kitchenOrderFacadeService.finishOrder(order.id);
            this.deliveredItemsByOrder.delete(order.id);

            const label = order.tiempoLabel || 'Ticket';
            this.messageService.add({
                severity: 'success',
                summary: `${label} Listo`,
                detail: `${label} de #${this.shortId(order.id)} marcado como listo para despacho.`,
                life: 3000
            });
        } catch {
            this.messageService.add({
                severity: 'error',
                summary: 'No se pudo terminar',
                detail: `El ticket ${this.shortId(order.id)} no pudo marcarse como listo.`,
                life: 3000
            });
        } finally {
            this.processingOrderIds.delete(order.id);
        }
    }

    async finishOrderFromDetail(order: KitchenOrder): Promise<void> {
        if (this.isProcessing(order.id)) {
            return;
        }

        const pendingItemsCount = this.getPendingItemsCount(order);
        if (pendingItemsCount > 0) {
            this.pendingReviewOrderId.set(order.id);
            return;
        }

        this.pendingReviewOrderId.set(null);
        await this.finishOrder(order);
        this.closeOrderDetail();
    }

    isProcessing(orderId: string): boolean {
        return this.processingOrderIds.has(orderId);
    }

    shortId(orderId: string): string {
        if (!orderId) return '';
        const parts = orderId.split('__');
        const base = parts[0].slice(0, 8).toUpperCase();
        if (parts.length > 1) {
            const tag = parts[1];
            const tiempoText = tag === 'T3' ? '3er T.' : (tag === 'T2' ? '2do T.' : '1er T.');
            return `${base} (${tiempoText})`;
        }
        return base;
    }

    elapsedMinutes(order: KitchenOrder): number {
        const timeRef = order.marchedAt || order.createdAt;
        const createdAt = new Date(timeRef).getTime();
        if (Number.isNaN(createdAt)) {
            return 0;
        }
        return Math.max(0, Math.floor((this.currentTime - createdAt) / 60000));
    }

    freshnessClass(order: KitchenOrder): string {
        const minutes = this.elapsedMinutes(order);
        if (minutes >= 10) {
            return 'freshness-critical';
        }
        if (minutes >= 5) {
            return 'freshness-warning';
        }
        return 'freshness-ok';
    }

    openOrderDetail(order: KitchenOrder): void {
        this.selectedOrderForDetail.set(order);
        this.reconcileDeliveredItems(order);
        this.showOrderDetailDialog.set(true);
    }

    closeOrderDetail(): void {
        this.showOrderDetailDialog.set(false);
        this.pendingReviewOrderId.set(null);
        const orderId = this.selectedOrderForDetail()?.id;
        if (orderId) {
            this.deliveredItemsByOrder.delete(orderId);
        }
        this.selectedOrderForDetail.set(null);
    }

    isItemDelivered(order: KitchenOrder, itemIndex: number): boolean {
        const deliveredItems = this.deliveredItemsByOrder.get(order.id);
        if (!deliveredItems) {
            return false;
        }

        return deliveredItems.has(this.getItemKey(itemIndex));
    }

    toggleItemDelivered(order: KitchenOrder, itemIndex: number, checked: boolean): void {
        let deliveredItems = this.deliveredItemsByOrder.get(order.id);
        if (!deliveredItems) {
            deliveredItems = new Set<string>();
            this.deliveredItemsByOrder.set(order.id, deliveredItems);
        }

        const itemKey = this.getItemKey(itemIndex);
        if (checked) {
            deliveredItems.add(itemKey);
            return;
        }

        deliveredItems.delete(itemKey);

        if (this.pendingReviewOrderId() === order.id && this.getPendingItemsCount(order) === 0) {
            this.pendingReviewOrderId.set(null);
        }
    }

    onItemRowTap(order: KitchenOrder, itemIndex: number): void {
        if (order.status !== 'EN_PREPARACION') {
            return;
        }

        const nextState = !this.isItemDelivered(order, itemIndex);
        this.toggleItemDelivered(order, itemIndex, nextState);
    }

    getDeliveredItemsCount(order: KitchenOrder): number {
        return this.deliveredItemsByOrder.get(order.id)?.size ?? 0;
    }

    getPendingItemsCount(order: KitchenOrder): number {
        const currentRoundItems = (order.items || []).filter(
            (item) => !this.isItemYaSalio(order, item)
        );
        return Math.max(0, currentRoundItems.length - this.getDeliveredItemsCount(order));
    }

    areAllItemsDelivered(order: KitchenOrder): boolean {
        return order.items.length > 0 && this.getPendingItemsCount(order) === 0;
    }

    shouldHighlightPendingItem(order: KitchenOrder, itemIndex: number): boolean {
        return this.pendingReviewOrderId() === order.id && !this.isItemDelivered(order, itemIndex);
    }

    private reconcileDeliveredItems(order: KitchenOrder): void {
        const deliveredItems = this.deliveredItemsByOrder.get(order.id) ?? new Set<string>();
        const validItemKeys = new Set(order.items.map((_, index) => this.getItemKey(index)));

        Array.from(deliveredItems)
            .filter((itemKey) => !validItemKeys.has(itemKey))
            .forEach((itemKey) => deliveredItems.delete(itemKey));

        this.deliveredItemsByOrder.set(order.id, deliveredItems);
    }

    private getItemKey(itemIndex: number): string {
        return `item-${itemIndex}`;
    }

    /** IDs de productos de menú que son bebidas (para ocultarlas del tablero de Cocina) */
    private beverageProductIds = new Set<number>();

    private isBeverageItem(productId: number | undefined): boolean {
        return isBeverageProduct(productId, this.beverageProductIds);
    }

    private async loadBeverageCatalog(tenantId: number): Promise<void> {
        this.beverageProductIds = new Set<number>();
        try {
            const response = await firstValueFrom(this.inventoryService.getBebidas(tenantId));
            this.beverageProductIds = buildBeverageProductIds(Array.isArray(response?.object) ? response.object : []);
        } catch (error) {
            console.warn('Cocina: no se pudo cargar el catálogo de bebidas:', error);
        }
    }

    private async loadRecipeCatalog(tenantId: number): Promise<void> {
        try {
            const response = await firstValueFrom(this.productService.getProductsByTenantId(tenantId));
            const products = Array.isArray(response?.object) ? response.object : [];
            this.recipeCatalog.clear();
            for (const product of products) {
                this.recipeCatalog.set(product.id, {
                    recipes: Array.isArray(product.recipes) ? product.recipes : [],
                    additionals: Array.isArray(product.additionals) ? product.additionals : []
                });
            }
        } catch (error) {
            console.error('Cocina: no se pudo cargar el catálogo de recetas:', error);
        } finally {
            this.recipeCatalogReady.set(true);
        }
    }

    private getRecipeEntry(item: KitchenOrderItem): { recipes: IngredientOption[]; additionals: IngredientOption[] } {
        if (item.productId == null) {
            return { recipes: [], additionals: [] };
        }
        return (
            this.recipeCatalog.get(item.productId) ?? { recipes: [], additionals: [] }
        );
    }

    getItemBaseIngredients(item: KitchenOrderItem): IngredientOption[] {
        return this.getRecipeEntry(item).recipes.filter((ing) => ing.tipoIngrediente === 'BASE');
    }

    getItemModifiableIngredients(item: KitchenOrderItem): IngredientOption[] {
        const excluded = new Set(item.excludedIngredientIds ?? []);
        return this.getRecipeEntry(item).recipes.filter(
            (ing) => ing.tipoIngrediente === 'MODIFICABLE' && !excluded.has(ing.insumoId)
        );
    }

    getItemRemovedIngredients(item: KitchenOrderItem): IngredientOption[] {
        const excluded = new Set(item.excludedIngredientIds ?? []);
        return this.getRecipeEntry(item).recipes.filter(
            (ing) => ing.tipoIngrediente === 'MODIFICABLE' && excluded.has(ing.insumoId)
        );
    }

    getItemAdditionalIngredients(item: KitchenOrderItem): IngredientOption[] {
        const entry = this.getRecipeEntry(item);
        const additionalIds = new Set(item.additionalIngredientIds ?? []);
        const fromAdditionals = entry.additionals.filter((add) => additionalIds.has(add.insumoId));
        if (fromAdditionals.length > 0) {
            return fromAdditionals;
        }
        return entry.recipes.filter(
            (ing) => ing.tipoIngrediente === 'ADICIONAL' && additionalIds.has(ing.insumoId)
        );
    }

    itemHasRecipeInfo(item: KitchenOrderItem): boolean {
        if (item.productId == null) {
            return false;
        }
        return (
            this.getItemBaseIngredients(item).length > 0 ||
            this.getItemModifiableIngredients(item).length > 0 ||
            this.getItemRemovedIngredients(item).length > 0 ||
            this.getItemAdditionalIngredients(item).length > 0
        );
    }

    ingredientLabel(ingredient: IngredientOption): string {
        const quantity = ingredient.cantidad != null ? String(ingredient.cantidad) : '';
        const unit = ingredient.unidad ?? '';
        const amount = [quantity, unit].filter(Boolean).join(' ');
        return amount ? `${ingredient.insumoName} (${amount})` : ingredient.insumoName;
    }

    private async resolveTenantId(): Promise<number> {
        const currentUser = this.authService.getCurrentUser();
        return currentUser?.tenantId ?? 0;
    }
}
