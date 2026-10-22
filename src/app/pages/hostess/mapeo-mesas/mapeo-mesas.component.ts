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
import { ReservaService } from '../services/reserva.service';
import { UserService } from '@/pages/user-management/services/user.service';
import { AuthService } from '@/auth/auth.service';
import { MesaDTO, MesaRequest, MesaEstado, MesaForma, MesaGrupo, EstadoTagSeverity, MESA_ESTADO_COLORS, MESA_FORMA_OPTIONS, mesaSize, mesaTamano, rotacionGrados } from '../models/mesa.model';
import { ReservaDTO, ReservaEstado, RESERVA_ESTADO_COLORS } from '../models/reserva.model';

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

type ResizeEdge = 'e' | 'w' | 's' | 'n' | 'se';

interface ResizeState {
    id: number;
    edge: ResizeEdge;
    fixedL: number;
    fixedR: number;
    fixedT: number;
    fixedB: number;
    grabOffsetX: number;
    grabOffsetY: number;
    initialWidth: number;
    initialHeight: number;
    initialPosX: number;
    initialPosY: number;
    currentWidth: number;
    currentHeight: number;
    currentPosX: number;
    currentPosY: number;
}

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
    readonly Math = Math;
    readonly formaOptions = MESA_FORMA_OPTIONS;

    mesas = signal<MesaDTO[]>([]);
    meseros = signal<{ id: number; nombre: string; email?: string }[]>([]);
    reservas = signal<ReservaDTO[]>([]);
    reservasLoading = signal(false);
    loading = signal(false);
    drag = signal<DragState | null>(null);
    resize = signal<ResizeState | null>(null);

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

    // ==========================================================================
    // ÁREAS DEL LOCAL (Pizarrón por Área)
    // ==========================================================================
    areas = signal<string[]>(['Principal']);
    areaSeleccionada = signal<string>('Principal');
    nuevaAreaDialogVisible = false;
    formNuevaAreaNombre = '';
    formArea = 'Principal';

    /** Mesas del área activa actualmente seleccionada */
    mesasDelArea = computed<MesaDTO[]>(() => {
        const areaActual = this.areaSeleccionada() || 'Principal';
        return this.mesas().filter(m => (m.area || 'Principal') === areaActual);
    });

    /** Opciones de áreas para el selector del formulario */
    areaOptions = computed(() => {
        return this.areas().map(a => ({ label: a, value: a }));
    });

    // Mesas agrupadas temporalmente en el área activa
    grupoTemporal = computed<MesaGrupo[]>(() => {
        const byGroup = new Map<string, MesaDTO[]>();
        this.mesasDelArea().forEach(m => {
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
    formIdentificador = '';
    formNumero: number | null = null;
    formCapacidad: number = 4;
    formEstado: MesaEstado = 'LIBRE';
    formForma: MesaForma = 'cuadrada';
    formRotacion = 0;

    constructor(
        private mesaService: MesaService,
        private reservaService: ReservaService,
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
            this.loadReservas();
        } else {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo determinar el tenant del usuario' });
        }
    }

    // ==========================================================================
    // CARGA DE DATOS
    // ==========================================================================

    private normalizeMesas(mesas: MesaDTO[]): MesaDTO[] {
        return mesas.map(m => {
            const rot = rotacionGrados(m.rotacion);
            if (rot % 180 !== 0 && m.ancho && m.alto) {
                // Mesas con rotación legacy de 90° o 270°: se normalizan a dimensiones visuales de pantalla directas
                return {
                    ...m,
                    ancho: m.alto,
                    alto: m.ancho,
                    rotacion: 0
                };
            }
            return m;
        });
    }

    loadMesas() {
        this.loading.set(true);
        this.mesaService.getMesas(this.tenantId).subscribe({
            next: (res) => {
                const normalized = this.applyDefaultPositions(this.normalizeMesas(res || []));
                this.mesas.set(normalized);

                // Sincronizar lista de áreas con las presentes en las mesas
                const uniqueAreas = new Set<string>(['Principal', ...this.areas()]);
                normalized.forEach(m => {
                    if (m.area && m.area.trim()) {
                        uniqueAreas.add(m.area.trim());
                    }
                });
                this.areas.set(Array.from(uniqueAreas));
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

    loadReservas() {
        this.reservasLoading.set(true);
        this.reservaService.getReservas(this.tenantId).subscribe({
            next: (res) => {
                this.reservas.set(res || []);
                this.reservasLoading.set(false);
            },
            error: () => {
                this.reservas.set([]);
                this.reservasLoading.set(false);
            }
        });
    }

    /** Reservaciones vigentes (no canceladas) ordenadas por fecha/hora ascendente */
    reservasVigentes(): ReservaDTO[] {
        return this.reservas()
            .filter(r => r.estado !== 'CANCELADA')
            .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    }

    getReservaSeverity(estado: ReservaEstado): EstadoTagSeverity {
        return RESERVA_ESTADO_COLORS[estado] || 'secondary';
    }

    /** Hora corta de la reservación, ej. "18:30" */
    reservaHora(reserva: ReservaDTO): string {
        const d = new Date(reserva.fecha);
        if (isNaN(d.getTime())) {
            return '';
        }
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    }

    /** Fecha corta de la reservación, ej. "22 sep" */
    reservaFecha(reserva: ReservaDTO): string {
        const d = new Date(reserva.fecha);
        if (isNaN(d.getTime())) {
            return '';
        }
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
    }

    esReservaHoy(reserva: ReservaDTO): boolean {
        const d = new Date(reserva.fecha);
        if (isNaN(d.getTime())) {
            return false;
        }
        const hoy = new Date();
        return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
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
    // DRAG-AND-DROP Y REDIMENSIÓN DE ARISTAS (Modo Edición)
    // ==========================================================================

    onMesaPointerDown(event: PointerEvent, mesa: MesaDTO) {
        if (this.modo !== 'edicion' || mesa.id == null || this.resize() != null) {
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

    onResizePointerDown(event: PointerEvent, mesa: MesaDTO, edge: ResizeEdge) {
        if (this.modo !== 'edicion' || mesa.id == null) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.closePopover();
        this.drag.set(null);

        const workspace = document.querySelector('.workspace') as HTMLElement | null;
        if (!workspace) return;
        workspace.setPointerCapture(event.pointerId);

        const rect = workspace.getBoundingClientRect();
        const scaleX = WORKSPACE_W / rect.width;
        const scaleY = WORKSPACE_H / rect.height;
        const localX = (event.clientX - rect.left) * scaleX;
        const localY = (event.clientY - rect.top) * scaleY;

        const currentSize = mesaTamano(mesa);
        const initialWidth = mesa.ancho ?? currentSize.width;
        const initialHeight = mesa.alto ?? currentSize.height;
        const initialPosX = mesa.posicionX ?? DEFAULT_X;
        const initialPosY = mesa.posicionY ?? DEFAULT_Y;

        const fixedL = initialPosX - initialWidth / 2;
        const fixedR = initialPosX + initialWidth / 2;
        const fixedT = initialPosY - initialHeight / 2;
        const fixedB = initialPosY + initialHeight / 2;

        const grabTargetX = (edge === 'e' || edge === 'se') ? fixedR : (edge === 'w' ? fixedL : initialPosX);
        const grabTargetY = (edge === 's' || edge === 'se') ? fixedB : (edge === 'n' ? fixedT : initialPosY);

        this.resize.set({
            id: mesa.id,
            edge,
            fixedL,
            fixedR,
            fixedT,
            fixedB,
            grabOffsetX: localX - grabTargetX,
            grabOffsetY: localY - grabTargetY,
            initialWidth,
            initialHeight,
            initialPosX,
            initialPosY,
            currentWidth: initialWidth,
            currentHeight: initialHeight,
            currentPosX: initialPosX,
            currentPosY: initialPosY
        });
    }

    onWorkspacePointerMove(event: PointerEvent) {
        const res = this.resize();
        const drag = this.drag();

        if (!res && !drag) {
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

        if (res) {
            const curX = localX - res.grabOffsetX;
            const curY = localY - res.grabOffsetY;

            // Medida mínima equivalente a una mesa cuadrada estándar (80px).
            // Impide que el usuario pueda hacer una mesa super delgada o casi imperceptible.
            const MIN_DIM = 80;
            const MAX_DIM = 600;

            let w = res.initialWidth;
            let h = res.initialHeight;
            let x = res.initialPosX;
            let y = res.initialPosY;

            switch (res.edge) {
                case 'e': {
                    // El lado izquierdo queda fijo. Solo se mueve el lado derecho. Altura no cambia.
                    const targetR = Math.max(res.fixedL + MIN_DIM, Math.min(curX, res.fixedL + MAX_DIM, WORKSPACE_W));
                    w = targetR - res.fixedL;
                    x = res.fixedL + w / 2;
                    h = res.initialHeight;
                    y = res.initialPosY;
                    break;
                }
                case 'w': {
                    // El lado derecho queda fijo. Solo se mueve el lado izquierdo. Altura no cambia.
                    const targetL = Math.min(res.fixedR - MIN_DIM, Math.max(curX, res.fixedR - MAX_DIM, 0));
                    w = res.fixedR - targetL;
                    x = targetL + w / 2;
                    h = res.initialHeight;
                    y = res.initialPosY;
                    break;
                }
                case 's': {
                    // El lado superior queda fijo. Solo se mueve el lado inferior. Ancho no cambia.
                    const targetB = Math.max(res.fixedT + MIN_DIM, Math.min(curY, res.fixedT + MAX_DIM, WORKSPACE_H));
                    h = targetB - res.fixedT;
                    y = res.fixedT + h / 2;
                    w = res.initialWidth;
                    x = res.initialPosX;
                    break;
                }
                case 'n': {
                    // El lado inferior queda fijo. Solo se mueve el lado superior. Ancho no cambia.
                    const targetT = Math.min(res.fixedB - MIN_DIM, Math.max(curY, res.fixedB - MAX_DIM, 0));
                    h = res.fixedB - targetT;
                    y = targetT + h / 2;
                    w = res.initialWidth;
                    x = res.initialPosX;
                    break;
                }
                case 'se': {
                    // Lado izquierdo y superior quedan fijos. Mueven lado derecho e inferior.
                    const targetR = Math.max(res.fixedL + MIN_DIM, Math.min(curX, res.fixedL + MAX_DIM, WORKSPACE_W));
                    const targetB = Math.max(res.fixedT + MIN_DIM, Math.min(curY, res.fixedT + MAX_DIM, WORKSPACE_H));
                    w = targetR - res.fixedL;
                    h = targetB - res.fixedT;
                    x = res.fixedL + w / 2;
                    y = res.fixedT + h / 2;
                    break;
                }
            }

            w = Math.round(w);
            h = Math.round(h);
            x = Math.round(x);
            y = Math.round(y);

            this.patchMesaLocal(res.id, { ancho: w, alto: h, posicionX: x, posicionY: y });
            this.resize.set({
                ...res,
                currentWidth: w,
                currentHeight: h,
                currentPosX: x,
                currentPosY: y
            });
            return;
        }

        if (drag) {
            const current = this.mesas().find(m => m.id === drag.id);
            const size = mesaTamano(current as MesaDTO);

            const x = Math.min(Math.max(localX, size.width / 2), WORKSPACE_W - size.width / 2);
            const y = Math.min(Math.max(localY, size.height / 2), WORKSPACE_H - size.height / 2);

            if (Math.hypot(x - drag.x, y - drag.y) > 4) {
                drag.moved = true;
            }
            this.drag.set({ ...drag, x, y });
        }
    }

    onDragOrResizeEnd(event?: PointerEvent) {
        if (event) {
            try {
                const workspace = document.querySelector('.workspace') as HTMLElement | null;
                if (workspace && workspace.hasPointerCapture(event.pointerId)) {
                    workspace.releasePointerCapture(event.pointerId);
                }
            } catch {
                // ignore
            }
        }
        const res = this.resize();
        if (res) {
            this.resize.set(null);
            this.mesaService.updateMesa(res.id, this.tenantId, {
                ancho: res.currentWidth,
                alto: res.currentHeight,
                posicionX: res.currentPosX,
                posicionY: res.currentPosY
            }).subscribe({
                next: (saved) => {
                    this.patchMesaLocal(res.id, {
                        ancho: saved.ancho,
                        alto: saved.alto,
                        posicionX: saved.posicionX,
                        posicionY: saved.posicionY
                    });
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Dimensiones actualizadas',
                        detail: `Mesa ajustada a ${Math.round(res.currentWidth)} × ${Math.round(res.currentHeight)} px`
                    });
                },
                error: () => {
                    this.patchMesaLocal(res.id, {
                        ancho: res.initialWidth,
                        alto: res.initialHeight,
                        posicionX: res.initialPosX,
                        posicionY: res.initialPosY
                    });
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron guardar las dimensiones de la mesa'
                    });
                }
            });
            return;
        }

        this.onDragEnd();
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

    isResizing(mesaId?: number): boolean {
        return this.resize()?.id === mesaId;
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

    /** Cantidad de mesas seleccionadas para unión */
    numSeleccionadas(): number {
        return this.selectedIds.size;
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
                this.mesas.set(this.mesas().map(m => {
                    const fromServer = byId.get(m.id as number);
                    if (fromServer) {
                        return { ...fromServer, estado: 'LIBRE' };
                    }
                    if (m.idGrupoTemporal === grupoId) {
                        return { ...m, idGrupoTemporal: null, estado: 'LIBRE' };
                    }
                    return m;
                }));
                this.closePopover();
                this.messageService.add({ severity: 'success', summary: 'Exitoso', detail: 'Mesas separadas y liberadas' });
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
                this.applyEstadoLocal(res, estado);
                this.closePopover();
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo cambiar el estado' })
        });
    }

    /** Aplica el estado a la mesa y, si está en un grupo temporal, a todo el grupo. */
    private applyEstadoLocal(res: MesaDTO, estado: MesaEstado) {
        const grupoId = res.idGrupoTemporal;
        this.mesas.set(this.mesas().map(m => {
            const enGrupo = grupoId != null && m.idGrupoTemporal === grupoId;
            const mismaMesa = m.id === res.id;
            if (!enGrupo && !mismaMesa) {
                return m;
            }
            return {
                ...m,
                estado,
                meseroUserId: estado === 'LIBRE' ? null : (mismaMesa ? res.meseroUserId : m.meseroUserId),
                meseroNombre: estado === 'LIBRE' ? null : (mismaMesa ? res.meseroNombre : m.meseroNombre)
            };
        }));
    }

    onAssignMesero(mesa: MesaDTO, meseroId: number | null) {
        const request = typeof meseroId === 'number' && meseroId > 0 ? { meseroUserId: meseroId } : { meseroUserId: null };
        this.mesaService.assignMesero(mesa.id as number, this.tenantId, request).subscribe({
            next: (res) => this.patchMesaLocal(res.id as number, { meseroUserId: res.meseroUserId, meseroNombre: res.meseroNombre }),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo asignar el mesero' })
        });
    }

    rotarMesa(mesa: MesaDTO) {
        // Rotar 90° intercambia directamente su ancho horizontal y alto vertical en pantalla
        const currentSize = mesaTamano(mesa);
        const nuevoAncho = currentSize.height;
        const nuevoAlto = currentSize.width;
        this.mesaService.updateMesa(mesa.id as number, this.tenantId, {
            ancho: nuevoAncho,
            alto: nuevoAlto,
            rotacion: 0
        }).subscribe({
            next: (res) => this.patchMesaLocal(res.id as number, { ancho: nuevoAncho, alto: nuevoAlto, rotacion: 0 }),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.error?.message || 'No se pudo rotar la mesa' })
        });
    }

    openEditFromPopover(mesa: MesaDTO) {
        this.closePopover();
        this.openEditMesa(mesa);
    }

    // ==========================================================================
    // GESTIÓN DE ÁREAS (Pizarrón Múltiple)
    // ==========================================================================

    seleccionarArea(area: string): void {
        this.areaSeleccionada.set(area);
        this.cancelarUnion();
        this.closePopover();
    }

    abrirNuevaAreaDialog(): void {
        this.formNuevaAreaNombre = '';
        this.nuevaAreaDialogVisible = true;
    }

    guardarNuevaArea(): void {
        const nombre = (this.formNuevaAreaNombre || '').trim();
        if (!nombre) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Debes ingresar un nombre o identificador para la nueva área'
            });
            return;
        }

        const actuales = this.areas();
        const existe = actuales.some(a => a.toLowerCase() === nombre.toLowerCase());
        if (existe) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Área existente',
                detail: `El área "${nombre}" ya existe en el plano`
            });
            const existingName = actuales.find(a => a.toLowerCase() === nombre.toLowerCase()) || nombre;
            this.areaSeleccionada.set(existingName);
            this.nuevaAreaDialogVisible = false;
            return;
        }

        // Agregar la nueva área y seleccionarla de inmediato con pizarrón en blanco
        this.areas.set([...actuales, nombre]);
        this.areaSeleccionada.set(nombre);
        this.nuevaAreaDialogVisible = false;

        this.messageService.add({
            severity: 'success',
            summary: 'Nueva Área Creada',
            detail: `Pizarrón en blanco establecido para "${nombre}". Puedes comenzar a agregar sus mesas.`
        });
    }

    conteoMesasPorArea(area: string): number {
        return this.mesas().filter(m => (m.area || 'Principal') === area).length;
    }

    // ==========================================================================
    // CRUD (diálogo crear/editar)
    // ==========================================================================

    crearNuevaMesa() {
        this.editingMesa = null;
        this.formNombre = '';
        this.formArea = this.areaSeleccionada() || 'Principal';
        this.formIdentificador = '';
        this.formNumero = null;
        this.formCapacidad = 4;
        this.formEstado = 'LIBRE';
        this.formForma = 'cuadrada';
        this.formRotacion = 0;
        this.mesaDialogVisible = true;
    }

    openEditMesa(mesa: MesaDTO) {
        this.editingMesa = mesa;
        this.formNombre = mesa.nombre;
        this.formArea = mesa.area || this.areaSeleccionada() || 'Principal';
        this.formIdentificador = mesa.identificador || (mesa.numero != null ? String(mesa.numero) : (mesa.id != null ? String(mesa.id) : ''));
        this.formNumero = mesa.numero ?? null;
        this.formCapacidad = mesa.capacidad || 4;
        this.formEstado = mesa.estado || 'LIBRE';
        this.formForma = mesa.forma === 'redonda' ? 'redonda' : 'cuadrada';
        this.formRotacion = rotacionGrados(mesa.rotacion) % 180 === 90 ? 90 : 0;
        this.mesaDialogVisible = true;
    }

    saveMesa() {
        if (!this.formNombre?.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El nombre a mostrar en el mapa es obligatorio' });
            return;
        }
        if (!this.formIdentificador?.trim()) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El identificador único de la mesa es obligatorio' });
            return;
        }
        if (!this.formCapacidad || this.formCapacidad <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'La cantidad de personas debe ser mayor a 0' });
            return;
        }

        this.saving = true;
        const isRedonda = this.formForma === 'redonda';
        const finalAncho = isRedonda ? 80 : (this.editingMesa?.ancho ?? 80);
        const finalAlto = isRedonda ? 80 : (this.editingMesa?.alto ?? 80);

        const numParsed = Number(this.formIdentificador.trim());
        const numeroVal = !isNaN(numParsed) && Number.isInteger(numParsed) && numParsed > 0
            ? numParsed
            : (this.editingMesa?.numero ?? undefined);

        const finalArea = (this.formArea || this.areaSeleccionada() || 'Principal').trim();

        const payload: MesaRequest = {
            nombre: this.formNombre.trim(),
            area: finalArea,
            identificador: this.formIdentificador.trim(),
            numero: numeroVal,
            capacidad: this.formCapacidad,
            estado: this.formEstado,
            forma: this.formForma,
            ancho: finalAncho,
            alto: finalAlto,
            rotacion: this.formRotacion,
            // Mesa nueva aparece centrada en el plano para que el usuario la acomode
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
                if (!this.areas().includes(finalArea)) {
                    this.areas.set([...this.areas(), finalArea]);
                }
                this.areaSeleccionada.set(finalArea);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exitoso',
                    detail: this.editingMesa ? 'Mesa actualizada exitosamente' : 'Mesa registrada exitosamente'
                });
                this.loadMesas();
            },
            error: (err) => {
                this.saving = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo guardar la mesa'
                });
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
        return this.mesasDelArea().filter(m => m.estado === estado).length;
    }

    tooltipMesa(mesa: MesaDTO): string {
        const idPart = mesa.identificador ? `[ID: ${mesa.identificador}] ` : (mesa.id != null ? `#${mesa.id} · ` : '');
        const mesero = mesa.meseroNombre ? ` · Mesero: ${mesa.meseroNombre}` : ' · Sin mesero';
        const dim = (mesa.forma ?? 'cuadrada') === 'cuadrada' && mesa.ancho && mesa.alto ? ` · ${Math.round(mesa.ancho)}×${Math.round(mesa.alto)}px` : '';
        return `${idPart}${mesa.nombre} (${mesa.capacidad} personas)${dim}${mesero}`;
    }

    labelMesa(mesa: MesaDTO): string {
        if (mesa.nombre && mesa.nombre.trim().length > 0) {
            return mesa.nombre.trim();
        }
        if (mesa.identificador) {
            return mesa.identificador;
        }
        if (mesa.numero != null) {
            return `M${mesa.numero}`;
        }
        return mesa.id != null ? `#${mesa.id}` : 'Mesa';
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

    // Mesa en orientación vertical (altura > ancho): ajusta layout vertical de los textos internos
    esVertical(mesa: MesaDTO): boolean {
        const size = mesaTamano(mesa);
        return size.height > size.width;
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

    private patchMesaLocal(id: number, patch: Partial<MesaDTO>) {
        this.mesas.set(this.mesas().map(m => (m.id === id ? { ...m, ...patch } : m)));
    }
}