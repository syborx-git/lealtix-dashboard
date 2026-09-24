import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { MesaService } from '../services/mesa.service';
import { UserService } from '@/pages/user-management/services/user.service';
import { AuthService } from '@/auth/auth.service';
import { MesaDTO, MesaEstado, MesaForma, EstadoTagSeverity, MESA_ESTADO_COLORS, MESA_FORMA_OPTIONS, mesaSize, mesaTamano, rotacionGrados } from '../models/mesa.model';

// Dimensiones lógicas del plano (px). Las coordenadas guardadas en BD usan esta misma escala.
const WORKSPACE_W = 1200;
const WORKSPACE_H = 720;

// Posición por defecto para mesas sin coordenadas (evita que queden cortadas en 0,0)
const DEFAULT_X = 100;
const DEFAULT_Y = 100;
const DEFAULT_STEP = 40;

// Margen del borde contenedor alrededor del grupo de mesas (escala lógica)
const GRUPO_PADDING = 7;

type ModoVista = 'edicion' | 'operacion';

interface DragState {
    id: number;
    x: number;
    y: number;
    moved: boolean;
}

interface MesaPopover {
    mesa: MesaDTO;
    left: number;
    top: number;
}

interface MesaGrupo {
    grupoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    mesas: MesaDTO[];
    capacidadTotal: number;
    etiqueta: string;
}

interface EstadoOption {
    label: string;
    value: MesaEstado;
}

@Component({
    selector: 'app-mapeo-mesas',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ToolbarModule,
        ButtonModule,
        DialogModule,
        InputTextModule,
        InputNumberModule,
        SelectModule,
        SelectButtonModule,
        TagModule,
        TooltipModule,
        ToastModule,
        ProgressSpinnerModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    templateUrl: './mapeo-mesas.component.html',
    styleUrls: ['./mapeo-mesas.component.scss']
})
export class MapeoMesasComponent implements OnInit {
    readonly workspaceW = WORKSPACE_W;
    readonly workspaceH = WORKSPACE_H;
    readonly formaOptions = MESA_FORMA_OPTIONS;

    mesas = signal<MesaDTO[]>([]);
    meseros = signal<{ id: number; nombre: string; email?: string }[]>([]);
    loading = signal(false);
    drag = signal<DragState | null>(null);

    tenantId = 0;

    modo: ModoVista = 'operacion';
    unirMode = false;
    selectedIds = new Set<number>();
    popover: MesaPopover | null = null;
    private lastDragMoved = false;

    readonly estadoOptions: EstadoOption[] = [
        { label: 'Libre', value: 'LIBRE' },
        { label: 'Ocupada', value: 'OCUPADA' },
        { label: 'Reservada', value: 'RESERVADA' }
    ];

    readonly rotacionOptions = [
        { label: 'Horizontal', value: 0, icon: 'pi pi-arrows-h' },
        { label: 'Vertical', value: 90, icon: 'pi pi-arrows-v' }
    ];

    readonly modoOptions = [
        { label: 'Edición', value: 'edicion', icon: 'pi pi-pencil' },
        { label: 'Operación', value: 'operacion', icon: 'pi pi-bolt' }
    ];

    // Mesas agrupadas temporalmente, con su caja delimitadora para el borde contenedor
    grupoTemporal = computed<MesaGrupo[]>(() => {
        const byGroup = new Map<string, MesaDTO[]>();
        this.mesas().forEach(m => {
            if (m.idGrupoTemporal) {
                const list = byGroup.get(m.idGrupoTemporal) || [];
                list.push(m);
                byGroup.set(m.idGrupoTemporal, list);
            }
        });

        const grupos: MesaGrupo[] = [];
        byGroup.forEach((mesas, grupoId) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            mesas.forEach(m => {
                const size = mesaTamano(m);
                const cx = m.posicionX ?? 0;
                const cy = m.posicionY ?? 0;
                minX = Math.min(minX, cx - size.width / 2);
                minY = Math.min(minY, cy - size.height / 2);
                maxX = Math.max(maxX, cx + size.width / 2);
                maxY = Math.max(maxY, cy + size.height / 2);
            });
            const ordenadas = [...mesas].sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
            grupos.push({
                grupoId,
                x: minX - GRUPO_PADDING,
                y: minY - GRUPO_PADDING,
                width: (maxX - minX) + GRUPO_PADDING * 2,
                height: (maxY - minY) + GRUPO_PADDING * 2,
                mesas: ordenadas,
                capacidadTotal: mesas.reduce((acc, m) => acc + (m.capacidad || 0), 0),
                etiqueta: ordenadas.map(m => m.numero ? `M${m.numero}` : m.nombre).join(' + ')
            });
        });
        return grupos;
    });

    mesaDialogVisible = false;
    editingMesa: MesaDTO | null = null;
    saving = false;
    formNombre = '';
    formNumero: number | null = null;
    formCapacidad: number = 2;
    formEstado: MesaEstado = 'LIBRE';
    formForma: MesaForma = 'cuadrada';
    formRotacion = 0;

    constructor(
        private mesaService: MesaService,
        private userService: UserService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        const user = this.authService.getCurrentUser();
        this.tenantId = user?.tenantId || 0;
        if (this.tenantId) {
            this.loadMesas();
            this.loadMeseros();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo determinar el tenant del usuario' });
        }
    }

    // ==========================================================================
    // CARGA DE DATOS
    // ==========================================================================

    loadMesas() {
        this.loading.set(true);
        this.mesaService.getMesas(this.tenantId).subscribe({
            next: (res) => {
                this.mesas.set(this.applyDefaultPositions(res || []));
                this.loading.set(false);
            },
            error: () => {
                this.mesas.set([]);
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las mesas' });
            }
        });
    }

    loadMeseros() {
        this.userService.getUsuarios(this.tenantId, { page: 0, pageSize: 100 }).subscribe({
            next: (res) => {
                const usuarios = res?.usuarios || [];
                const meseros = usuarios
                    .filter(u => (u.rol === 'MESERO'))
                    .map(u => ({ id: u.id as number, nombre: u.nombre, email: u.email }));
                this.meseros.set(meseros);
            },
            error: () => this.meseros.set([])
        });
    }

    // ==========================================================================
    // MODO DE VISTA (Edición / Operación)
    // ==========================================================================

    setModo(modo: ModoVista) {
        this.modo = modo;
        this.cancelarUnion();
        this.closePopover();
        if (modo === 'edicion') {
            this.messageService.add({ severity: 'info', summary: 'Modo Edición', detail: 'Arrastra las mesas para dibujar el layout del local' });
        }
    }

    isInModo(modo: ModoVista): boolean {
        return this.modo === modo;
    }

    // ==========================================================================
    // DRAG-AND-DROP (Modo Edición)
    // ==========================================================================

    onMesaPointerDown(event: PointerEvent, mesa: MesaDTO) {
        if (this.modo !== 'edicion' || mesa.id == null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.closePopover();
        this.lastDragMoved = false;

        const workspace = document.querySelector('.workspace') as HTMLElement | null;
        if (!workspace) {
            return;
        }
        workspace.setPointerCapture(event.pointerId);

        const rect = workspace.getBoundingClientRect();
        const scaleX = WORKSPACE_W / rect.width;
        const scaleY = WORKSPACE_H / rect.height;
        const localX = (event.clientX - rect.left) * scaleX;
        const localY = (event.clientY - rect.top) * scaleY;

        this.drag.set({
            id: mesa.id,
            x: mesa.posicionX ?? localX,
            y: mesa.posicionY ?? localY,
            moved: false
        });
    }

    onWorkspacePointerMove(event: PointerEvent) {
        const drag = this.drag();
        if (!drag) {
            return;
        }
        event.preventDefault();

        const workspace = document.querySelector('.workspace') as HTMLElement | null;
        if (!workspace) {
            return;
        }
        const rect = workspace.getBoundingClientRect();
        const scaleX = WORKSPACE_W / rect.width;
        const scaleY = WORKSPACE_H / rect.height;
        const localX = (event.clientX - rect.left) * scaleX;
        const localY = (event.clientY - rect.top) * scaleY;

        const current = this.mesas().find(m => m.id === drag.id);
        const size = mesaTamano(current as MesaDTO);

        const x = Math.min(Math.max(localX, size.width / 2), WORKSPACE_W - size.width / 2);
        const y = Math.min(Math.max(localY, size.height / 2), WORKSPACE_H - size.height / 2);

        if (Math.hypot(x - drag.x, y - drag.y) > 4) {
            drag.moved = true;
        }
        this.drag.set({ ...drag, x, y });
    }

    onDragEnd() {
        const drag = this.drag();
        if (!drag) {
            return;
        }
        this.drag.set(null);
        this.lastDragMoved = drag.moved;

        if (!drag.moved) {
            return;
        }
        const mesa = this.mesas().find(m => m.id === drag.id);
        if (!mesa) {
            return;
        }

        const previous = { x: mesa.posicionX, y: mesa.posicionY };
        this.patchMesaLocal(mesa.id as number, { posicionX: drag.x, posicionY: drag.y });

        this.mesaService.updatePosicion(mesa.id as number, this.tenantId, { posicionX: drag.x, posicionY: drag.y }).subscribe({
            next: (res) => this.patchMesaLocal(res.id as number, { posicionX: res.posicionX, posicionY: res.posicionY }),
            error: () => {
                this.patchMesaLocal(mesa.id as number, { posicionX: previous.x, posicionY: previous.y });
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la posición de la mesa' });
            }
        });
    }

    // ==========================================================================
    // CLICK EN MESA (Modo Operación)
    // ==========================================================================

    onMesaClick(event: MouseEvent, mesa: MesaDTO) {
        if (this.modo !== 'operacion' || mesa.id == null) {
            return;
        }
        // Si se acaba de arrastrar en modo edición, no abrir el menú
        if (this.lastDragMoved) {
            this.lastDragMoved = false;
            return;
        }

        if (this.unirMode) {
            event.preventDefault();
            if (mesa.estado !== 'LIBRE') {
                this.messageService.add({ severity: 'warn', summary: 'Unión de mesas', detail: `Solo puedes unir mesas libres. '${mesa.nombre}' está ${mesa.estado}` });
                return;
            }
            this.toggleSelection(mesa);
            return;
        }

        this.openPopover(event, mesa);
    }

    onWorkspaceClick(event: MouseEvent) {
        if (event.target === event.currentTarget) {
            this.closePopover();
        }
    }

    // ==========================================================================
    // UNIÓN / SEPARACIÓN DE MESAS
    // ==========================================================================

    activarUnionMode() {
        this.unirMode = true;
        this.selectedIds.clear();
        this.closePopover();
        this.messageService.add({ severity: 'info', summary: 'Unir Mesas', detail: 'Selecciona dos o más mesas libres y presiona "Unir Mesas"' });
    }

    cancelarUnion() {
        this.unirMode = false;
        this.selectedIds.clear();
    }

    toggleSelection(mesa: MesaDTO) {
        if (mesa.id == null) {
            return;
        }
        if (this.selectedIds.has(mesa.id)) {
            this.selectedIds.delete(mesa.id);
        } else {
            this.selectedIds.add(mesa.id);
        }
        // Nueva referencia para forzar detección de cambios en *ngFor
        this.selectedIds = new Set(this.selectedIds);
    }

    isSelected(mesaId?: number): boolean {
        return mesaId != null && this.selectedIds.has(mesaId);
    }

    seleccionActiva(): boolean {
        return this.unirMode && this.selectedIds.size >= 2;
    }

    unirMesas() {
        const ids = [...this.selectedIds];
        if (ids.length < 2) {
            this.messageService.add({ severity: 'warn', summary: 'Unión de mesas', detail: 'Selecciona al menos dos mesas libres' });
            return;
        }
        this.mesaService.unirMesas(this.tenantId, { mesaIds: ids }).subscribe({
            next: (res) => {
                // Merge de las mesas actualizadas sobre el estado local
                const byId = new Map(res.map(m => [m.id as number, m]));
                this.mesas.set(this.mesas().map(m => byId.get(m.id as number) || m));
                this.cancelarUnion();
                this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Mesas unidas exitosamente' });
            },
            error: (err) => {
                this.cancelarUnion();
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudieron unir las mesas' });
            }
        });
    }

    separarGrupo(grupoId: string) {
        this.mesaService.separarGrupo(this.tenantId, grupoId).subscribe({
            next: (res) => {
                const byId = new Map(res.map(m => [m.id as number, m]));
                this.mesas.set(this.mesas().map(m => byId.get(m.id as number) || m));
                this.closePopover();
                this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Mesas separadas' });
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudieron separar las mesas' })
        });
    }

    // ==========================================================================
    // MENÚ RÁPIDO (popover por mesa)
    // ==========================================================================

    openPopover(event: MouseEvent, mesa: MesaDTO) {
        const left = Math.min(Math.max(event.clientX, 180), window.innerWidth - 240);
        const top = Math.min(Math.max(event.clientY - 120, 140), window.innerHeight - 380);
        this.popover = { mesa, left, top };
    }

    closePopover() {
        this.popover = null;
    }

    popoverMesa(): MesaDTO | null {
        const pop = this.popover;
        if (!pop) {
            return null;
        }
        return this.mesas().find(m => m.id === pop.mesa.id) ?? pop.mesa;
    }

    popoverStyle(): { [k: string]: string } {
        if (!this.popover) {
            return {};
        }
        return { left: `${this.popover.left}px`, top: `${this.popover.top}px` };
    }

    changeEstadoFromPopover(mesa: MesaDTO, estado: MesaEstado) {
        this.mesaService.changeEstado(mesa.id as number, this.tenantId, estado).subscribe({
            next: (res) => {
                this.patchMesaLocal(res.id as number, { estado: res.estado, meseroUserId: res.meseroUserId, meseroNombre: res.meseroNombre });
                this.closePopover();
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo cambiar el estado' })
        });
    }

    onAssignMesero(mesa: MesaDTO, meseroId: number | null) {
        const request = typeof meseroId === 'number' && meseroId > 0 ? { meseroUserId: meseroId } : { meseroUserId: null };
        this.mesaService.assignMesero(mesa.id as number, this.tenantId, request).subscribe({
            next: (res) => this.patchMesaLocal(res.id as number, { meseroUserId: res.meseroUserId, meseroNombre: res.meseroNombre }),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo asignar el mesero' })
        });
    }

    rotarMesa(mesa: MesaDTO) {
        const nueva = (rotacionGrados(mesa.rotacion) + 90) % 360;
        this.mesaService.updateMesa(mesa.id as number, this.tenantId, { rotacion: nueva }).subscribe({
            next: (res) => this.patchMesaLocal(res.id as number, { rotacion: res.rotacion }),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo rotar la mesa' })
        });
    }

    openEditFromPopover(mesa: MesaDTO) {
        this.closePopover();
        this.openEditMesa(mesa);
    }

    // ==========================================================================
    // CRUD (diálogo crear/editar)
    // ==========================================================================

    crearNuevaMesa() {
        this.editingMesa = null;
        this.formNombre = '';
        this.formNumero = null;
        this.formCapacidad = 2;
        this.formEstado = 'LIBRE';
        this.formForma = 'cuadrada';
        this.formRotacion = 0;
        this.mesaDialogVisible = true;
    }

    openEditMesa(mesa: MesaDTO) {
        this.editingMesa = mesa;
        this.formNombre = mesa.nombre;
        this.formNumero = mesa.numero ?? null;
        this.formCapacidad = mesa.capacidad;
        this.formEstado = mesa.estado;
        this.formForma = mesa.forma ?? 'cuadrada';
        this.formRotacion = rotacionGrados(mesa.rotacion) % 180 === 90 ? 90 : 0;
        this.mesaDialogVisible = true;
    }

    saveMesa() {
        if (!this.formNombre?.trim() || !this.formCapacidad || this.formCapacidad <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Nombre y capacidad son obligatorios' });
            return;
        }

        this.saving = true;
        const payload = {
            nombre: this.formNombre.trim(),
            numero: this.formNumero ?? undefined,
            capacidad: this.formCapacidad,
            estado: this.formEstado,
            forma: this.formForma,
            rotacion: this.formRotacion,
            // Mesa nueva aparece centrada en el plano para que el gerente la arrastre
            posicionX: this.editingMesa ? undefined : WORKSPACE_W / 2,
            posicionY: this.editingMesa ? undefined : WORKSPACE_H / 2
        };

        const request = this.editingMesa
            ? this.mesaService.updateMesa(this.editingMesa.id as number, this.tenantId, payload)
            : this.mesaService.createMesa(this.tenantId, payload);

        request.subscribe({
            next: (res) => {
                this.saving = false;
                this.mesaDialogVisible = false;
                this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: this.editingMesa ? 'Mesa actualizada' : 'Mesa creada' });
                this.loadMesas();
            },
            error: (err) => {
                this.saving = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo guardar la mesa' });
            }
        });
    }

    onDeleteMesa(mesa: MesaDTO) {
        this.closePopover();
        this.confirmationService.confirm({
            message: `¿Estás seguro de que deseas eliminar la mesa "${mesa.nombre}"?`,
            header: 'Confirmar eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, eliminar',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.mesaService.deleteMesa(mesa.id as number, this.tenantId).subscribe({
                    next: () => {
                        this.mesas.set(this.mesas().filter(m => m.id !== mesa.id));
                        this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Mesa eliminada' });
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo eliminar la mesa' })
                });
            }
        });
    }

    // ==========================================================================
    // AUXILIARES DE RENDER
    // ==========================================================================

    getEstadoSeverity(estado: MesaEstado): EstadoTagSeverity {
        return MESA_ESTADO_COLORS[estado] || 'secondary';
    }

    estadoSeverityFor(estado: MesaEstado): EstadoTagSeverity {
        return MESA_ESTADO_COLORS[estado] || 'secondary';
    }

    conteoEstado(estado: MesaEstado): number {
        return this.mesas().filter(m => m.estado === estado).length;
    }

    tooltipMesa(mesa: MesaDTO): string {
        const numero = mesa.numero != null ? `Mesa ${mesa.numero} · ` : '';
        const mesero = mesa.meseroNombre ? ` · Mesero: ${mesa.meseroNombre}` : ' · Sin mesero';
        return `${numero}${mesa.nombre} (${mesa.capacidad} pax)${mesero}`;
    }

    labelMesa(mesa: MesaDTO): string {
        return mesa.numero != null ? `M${mesa.numero}` : mesa.nombre;
    }

    mesaLeft(mesa: MesaDTO): number {
        const d = this.drag();
        if (d && d.id === mesa.id) {
            return this.clampX(d.x, mesa);
        }
        return this.clampX(mesa.posicionX ?? DEFAULT_X, mesa);
    }

    mesaTop(mesa: MesaDTO): number {
        const d = this.drag();
        if (d && d.id === mesa.id) {
            return this.clampY(d.y, mesa);
        }
        return this.clampY(mesa.posicionY ?? DEFAULT_Y, mesa);
    }

    mesaWidth(mesa: MesaDTO): number {
        return mesaTamano(mesa).width;
    }

    mesaHeight(mesa: MesaDTO): number {
        return mesaTamano(mesa).height;
    }

    // Mesa rectangular en orientación vertical (rotación 90/270): se logra
    // intercambiando ancho/alto reales (mesaTamano), nunca con rotate().
    esVertical(mesa: MesaDTO): boolean {
        return (mesa.forma ?? 'cuadrada') === 'rectangular' && rotacionGrados(mesa.rotacion) % 180 === 90;
    }

    // transform inline: solo centrado del punto de ancla + ligera escala al arrastrar.
    // No se usa rotate(): la orientación vertical se resuelve con el shape swap.
    mesaTransform(mesa: MesaDTO): string {
        return this.isDragging(mesa.id) ? 'translate(-50%, -50%) scale(1.06)' : 'translate(-50%, -50%)';
    }

    // Mesas sin coordenadas se colocan escalonadas dentro del grid para que sean visibles
    private applyDefaultPositions(mesas: MesaDTO[]): MesaDTO[] {
        return mesas.map((m, i) => {
            if (m.posicionX != null && m.posicionY != null) {
                return m;
            }
            const col = i % 4;
            const row = Math.floor(i / 4);
            return {
                ...m,
                posicionX: m.posicionX ?? DEFAULT_X + col * DEFAULT_STEP,
                posicionY: m.posicionY ?? DEFAULT_Y + row * DEFAULT_STEP
            };
        });
    }

    private clampX(x: number, mesa: MesaDTO): number {
        const size = mesaTamano(mesa);
        return Math.min(Math.max(x, size.width / 2), WORKSPACE_W - size.width / 2);
    }

    private clampY(y: number, mesa: MesaDTO): number {
        const size = mesaTamano(mesa);
        return Math.min(Math.max(y, size.height / 2), WORKSPACE_H - size.height / 2);
    }

    isDragging(mesaId?: number): boolean {
        return this.drag()?.id === mesaId;
    }

    numSeleccionadas(): number {
        return this.selectedIds.size;
    }

    private patchMesaLocal(id: number, patch: Partial<MesaDTO>) {
        this.mesas.set(this.mesas().map(m => (m.id === id ? { ...m, ...patch } : m)));
    }
}