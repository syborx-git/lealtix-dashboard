import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';

// PrimeNG Components
import { ToolbarModule } from 'primeng/toolbar';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { LazyLoadEvent, MessageService, ConfirmationService } from 'primeng/api';

// Services
import { ClienteService } from '../../services/cliente.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';
import { AuthService } from '@/auth/auth.service';

// Components
import { ClienteDialogComponent } from '../cliente-dialog/cliente-dialog.component';

// Models
import {
  Cliente,
  ClienteListResponse,
  CreateClienteRequest,
  UpdateClienteRequest,
  GENERO_OPTIONS,
  BulkUploadClienteResponse
} from '@/models/cliente.model';

@Component({
  selector: 'app-cliente-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ToolbarModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DatePickerModule,
    SelectModule,
    DialogModule,
    FileUploadModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    SkeletonModule,
    MessageModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    ProgressSpinnerModule,
    ClienteDialogComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './cliente-list.component.html',
  styleUrls: ['./cliente-list.component.scss']
})
export class ClienteListComponent implements OnInit {
  // Signals
  clientes = signal<Cliente[]>([]);
  cargando = signal<boolean>(false);
  cargandoFormulario = signal<boolean>(false);
  totalRecords = signal<number>(0);

  // Variables de Control
  mostrarDialogoNuevo = false;
  submitted = false;
  emailFilter = '';
  pageSize = 10;
  currentPage = 0;
  // PrimeNG table first index for lazy paging
  first = 0;
  tenantId = 0;
  sortField: string | null = null;
  sortOrder: 'asc' | 'desc' | null = null;
  clienteEnEdicion: Cliente | null = null;
  selectedClientes: Cliente[] = [];
  cols: any[] = [];

  // File Upload Modal
  mostrarModalCargaArchivo = false;
  archivoSeleccionado: File | null = null;

  // Formularios
  formNuevoCliente: FormGroup;

  // Opciones
  generoOptions = GENERO_OPTIONS;

  // File Upload
  uploadedFiles: any[] = [];

  constructor(
    private clienteService: ClienteService,
    private tenantService: TenantService,
    private authService: AuthService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private fb: FormBuilder
  ) {
    this.formNuevoCliente = this.initializeForm();
  }

  async ngOnInit(): Promise<void> {
    // Esperar a que se configure tenantId
    await this.readTenantId();

    // Solo cargar clientes si tenantId es válido
    if (this.tenantId > 0) {
      this.cargarClientes();
    } else {
      console.warn('ngOnInit: TenantId not set or invalid; skipping cargarClientes');
    }
  }

  // ================== Lifecycle ==================

  private async readTenantId(): Promise<number> {
    const currentUser = this.authService.getCurrentUser();
    this.tenantId = currentUser?.tenantId ?? 0;
    return this.tenantId;
  }

  // ================== Carga de Datos ==================

  private async cargarClientes(): Promise<void> {
    // Si no hay tenantId válido, intentar obtenerlo primero
    if (!this.tenantId || this.tenantId <= 0) {
      await this.readTenantId();
    }

    // Validar nuevamente después de intentar obtener el tenantId
    if (!this.tenantId || this.tenantId <= 0) {
      console.warn('cargarClientes: tenantId not set, skipping request');
      return;
    }

    this.cargando.set(true);
    this.clienteService
      .getClientes({
        tenantId: this.tenantId,
        email: this.emailFilter,
        page: this.currentPage,
        pageSize: this.pageSize,
        sortField: this.sortField ?? undefined,
        sortOrder: this.sortOrder ?? undefined
      })
      .subscribe({
        next: (response: ClienteListResponse) => {
          this.clientes.set(response.content);
          this.totalRecords.set(response.totalElements);
          this.cargando.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar clientes',
            life: 5000
          });
          this.cargando.set(false);
        }
      });
  }

  onPageChange(event: any): void {
    console.log('onPageChange event:', event);

    // Si cambió el tamaño de página, volver a la primera página
    const oldPageSize = this.pageSize;
    const newPageSize = event.rows ?? this.pageSize;

    if (newPageSize !== oldPageSize) {
      console.log(`Tamaño de página cambió de ${oldPageSize} a ${newPageSize}, reseteando a página 0`);
      this.currentPage = 0;
      this.first = 0;
    } else {
      // Si no cambió el tamaño, solo actualizar la página
      this.currentPage = event.page ?? 0;
    }

    this.pageSize = newPageSize;
    console.log(`Paginación: page=${this.currentPage}, pageSize=${this.pageSize}`);
    this.cargarClientes();
  }

  onLazyLoad(event: any): void {
    console.log('onLazyLoad event:', event);

    // PrimeNG lazy event may contain page, first and rows. Compute safely.
    const rows = event.rows ?? this.pageSize;
    const firstIndex = event.first ?? (event.page != null ? event.page * rows : 0);

    this.first = firstIndex;
    this.pageSize = rows;
    this.currentPage = event.page != null ? event.page : Math.floor(firstIndex / rows);

    // Capture sort info from PrimeNG LazyLoad event
    if (event.sortField) {
      this.sortField = event.sortField;
      // PrimeNG sortOrder is numeric: 1 = asc, -1 = desc
      this.sortOrder = event.sortOrder === -1 ? 'desc' : 'asc';
    } else {
      this.sortField = null;
      this.sortOrder = null;
    }

    console.log(`Lazy load -> first=${this.first}, page=${this.currentPage}, pageSize=${this.pageSize}`);
    this.cargarClientes();
  }

  aplicarFiltros(): void {
    this.currentPage = 0;
    this.first = 0;
    this.cargarClientes();
  }

  // ================== Diálogo - Nuevo Cliente ==================

  openDialogNuevoCliente(): void {
    this.clienteEnEdicion = null;
    this.formNuevoCliente = this.initializeForm();
    this.submitted = false;
    this.mostrarDialogoNuevo = true;
  }

  hideDialogoNuevo(): void {
    this.mostrarDialogoNuevo = false;
    this.submitted = false;
    this.formNuevoCliente = this.initializeForm();
  }

  guardarNuevoCliente(): void {
    this.submitted = true;

    if (!this.formNuevoCliente.valid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'Por favor completa todos los campos requeridos',
        life: 3000
      });
      return;
    }

    this.cargandoFormulario.set(true);
    const formValue = this.formNuevoCliente.value;

    const fecha = formValue.fechaNacimiento ? new Date(formValue.fechaNacimiento) : undefined;

    if (this.clienteEnEdicion && this.clienteEnEdicion.id) {
      // Update existing cliente
      const updateReq: any = {
        nombreCompleto: formValue.nombreCompleto,
        email: formValue.email,
        fechaNacimiento: this.formatDateIso(fecha),
        genero: formValue.genero,
        telefono: formValue.telefono || undefined
      };

      this.clienteService.updateCliente(this.clienteEnEdicion.id, updateReq).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Cliente actualizado correctamente',
            life: 3000
          });
          this.hideDialogoNuevo();
          this.cargandoFormulario.set(false);
          this.currentPage = 0;
          this.first = 0;
          this.emailFilter = '';
          this.cargarClientes();
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error?.error?.message || 'Error al actualizar cliente',
            life: 5000
          });
          this.cargandoFormulario.set(false);
        }
      });
    } else {
      // Create new cliente - include both birthDate (ISO) and fechaNacimiento (Date)
      const createReq: any = {
        nombreCompleto: formValue.nombreCompleto,
        email: formValue.email,
        birthDate: this.formatDateIso(fecha),
        fechaNacimiento: this.formatDateIso(fecha),
        genero: formValue.genero,
        telefono: formValue.telefono || undefined
      };

      this.clienteService.createCliente(this.tenantId, createReq).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Cliente creado correctamente',
            life: 3000
          });
          this.hideDialogoNuevo();
          this.cargandoFormulario.set(false);
          this.currentPage = 0;
          this.first = 0;
          this.emailFilter = '';
          this.cargarClientes();
        },
        error: (error: any) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error?.error?.message || 'Error al crear cliente',
            life: 5000
          });
          this.cargandoFormulario.set(false);
        }
      });
    }
  }

  // ================== Diálogo - Editar Cliente ==================

  openDialogEditarCliente(cliente: Cliente): void {
    this.clienteEnEdicion = cliente;
    this.submitted = false;
    const fechaObj = typeof cliente.fechaNacimiento === 'string'
      ? new Date(cliente.fechaNacimiento)
      : cliente.fechaNacimiento;

    this.formNuevoCliente = this.fb.group({
      nombreCompleto: [cliente.nombreCompleto, Validators.required],
      email: [cliente.email, [Validators.required, Validators.email]],
      fechaNacimiento: [fechaObj, Validators.required],
      genero: [cliente.genero, Validators.required],
      telefono: [cliente.telefono || '']
    });

    this.mostrarDialogoNuevo = true;
  }

  // ================== Eliminación ==================

  confirmarEliminar(cliente: Cliente): void {
    this.confirmationService.confirm({
      message: `¿Eliminar a ${cliente.nombreCompleto}?`,
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eliminarCliente(cliente.id);
      }
    });
  }

  private eliminarCliente(id: number): void {
    this.cargando.set(true);
    this.clienteService.deleteCliente(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Cliente eliminado correctamente',
          life: 3000
        });
        this.cargarClientes();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Error al eliminar cliente',
          life: 5000
        });
        this.cargando.set(false);
      }
    });
  }

  // ================== CSV/XLSX Import-Export ==================

  descargarPlantilla(): void {
    // Descargar los clientes actuales como Excel
    if (this.clientes().length === 0) {
      this.messageService.add({
        severity: 'warning',
        summary: 'Advertencia',
        detail: 'No hay clientes para descargar',
        life: 3000
      });
      return;
    }

    this.clienteService.downloadExcelWithClienteData(this.clientes());
    this.messageService.add({
      severity: 'success',
      summary: 'Descargando',
      detail: 'Archivo de clientes descargado',
      life: 2000
    });
  }

  onFileSelected(event: any): void {
    const files = event.target?.files || event.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validar archivo
    const validation = this.clienteService.validateFile(file);
    if (!validation.isValid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: validation.error,
        life: 5000
      });
      return;
    }

    // Guardar archivo y mostrar modal de confirmación
    this.archivoSeleccionado = file;
    this.mostrarModalCargaArchivo = true;
  }

  cancelarCargaArchivo(): void {
    this.archivoSeleccionado = null;
    this.mostrarModalCargaArchivo = false;
  }

  confirmarCargaArchivo(): void {
    if (!this.archivoSeleccionado) return;

    const file = this.archivoSeleccionado;
    this.mostrarModalCargaArchivo = false;
    this.uploadedFiles = [file];

    // Parsear el archivo
    this.cargando.set(true);
    this.clienteService.parseClientesFromFile(file)
      .then((clientesParsed: CreateClienteRequest[]) => {
        // Cargar clientes en lote
        this.clienteService.bulkUploadClientes(this.tenantId, clientesParsed)
          .subscribe({
            next: (response: BulkUploadClienteResponse) => {
              let detail = `${response.exitosos} cliente(s) cargado(s) correctamente.`;
              if (response.fallidos > 0) {
                detail += ` ${response.fallidos} fallido(s).`;
              }

              this.messageService.add({
                severity: response.fallidos > 0 ? 'warn' : 'success',
                summary: 'Carga Completada',
                detail: detail,
                life: 5000
              });

              this.uploadedFiles = [];
              this.cargando.set(false);
              this.first = 0;
              this.currentPage = 0;
              this.cargarClientes();
            },
            error: (error: any) => {
              this.messageService.add({
                severity: 'error',
                summary: 'Error en Carga',
                detail: error?.error?.message || 'Error al cargar clientes',
                life: 5000
              });
              this.cargando.set(false);
            }
          });
      })
      .catch((error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error al Parsear',
          detail: error.message,
          life: 5000
        });
        this.uploadedFiles = [];
        this.cargando.set(false);
      });
  }

  // ================== Métodos Privados ==================

  private initializeForm(): FormGroup {
    return this.fb.group({
      nombreCompleto: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      fechaNacimiento: ['', [Validators.required, this.ageValidator(12)]],
      genero: ['', Validators.required],
      telefono: ['', [Validators.pattern('^[0-9]{10}$')]]
    });
  }

  private ageValidator(minAge: number) {
    return (control: any) => {
      const value = control?.value;
      if (!value) return null;
      const d = new Date(value);
      if (isNaN(d.getTime())) return { invalidDate: true };
      const today = new Date();
      const age = today.getFullYear() - d.getFullYear() - (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate()) ? 1 : 0);
      return age >= minAge ? null : { tooYoung: { requiredAge: minAge, actualAge: age } };
    };
  }

  private formatDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') return date;
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  // Formatea fecha en ISO (YYYY-MM-DD) para payloads backend
  private formatDateIso(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  getGeneroBadgeSeverity(genero: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severityMap: { [key: string]: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' } = {
      'Hombre': 'info',
      'Mujer': 'success',
      'Otro': 'warn'
    };
    return severityMap[genero] || 'info';
  }

  onGlobalFilter(table: any, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    // Use server-side filtering (lazy) instead of client-side filter
    this.emailFilter = value;
    this.currentPage = 0;
    this.first = 0;
    this.cargarClientes();
  }
}
