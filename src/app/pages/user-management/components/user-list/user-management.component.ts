import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// PrimeNG Modules
import { ToolbarModule } from 'primeng/toolbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { PaginatorModule } from 'primeng/paginator';

// Services
import { UserService } from '../../services/user.service';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService } from '@/auth/auth.service';
import { TenantService } from '@/pages/admin-page/service/tenant.service';

// Components
import { UserDialogComponent } from '../user-dialog/user-dialog.component';

// Models
import { UserDTO, UserRole, UserListResponse, ROLE_COLORS, ROLE_PERMISSIONS } from '@/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToolbarModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    PasswordModule,
    ToastModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    RippleModule,
    PaginatorModule,
    UserDialogComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  // Signals
  usuarios = signal<UserDTO[]>([]);
  dialogVisible = signal<boolean>(false);
  loading = signal<boolean>(false);
  totalRecords = signal<number>(0);

  // Form
  usuarioForm!: FormGroup;
  isEditMode = signal<boolean>(false);

  // Data
  availableRoles = signal<UserRole[]>([]);
  selectedUsuario: UserDTO | null = null;
  selectedUsuarios: UserDTO[] = [];

  // Pagination
  rows = 10;
  currentPage = 0;
  first = 0;

  // Search
  searchTerm: string = '';

  // Internal
  private destroy$ = new Subject<void>();
  private tenantId: number = 1; // Por defecto, se deberá obtener del contexto del usuario actual

  readonly ROLE_COLORS = ROLE_COLORS;

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private tenantService: TenantService
  ) {
    this.inicializarFormulario();
  }

  ngOnInit() {
    this.obtenerTenantId();
    this.availableRoles.set(this.userService.getAvailableRoles());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario reactivo
   */
  private inicializarFormulario() {
    this.usuarioForm = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(6)]],
      rol: [null as UserRole | null, Validators.required]
    });
  }

  /**
   * Obtiene el tenant ID del storage o desde el authService + tenantService
   */
  private obtenerTenantId() {
    // Estrategia 1: Intentar obtener del usuario autenticado (storage)
    const user = this.authService.getCurrentUser();
    if (user && user.tenantId) {
      this.tenantId = user.tenantId;
      this.cargarUsuarios();
      return;
    }

    // Estrategia 2: Si no está en storage, obtener del tenantService usando el email
    if (!user || !user.email) {
      console.error('No se encontró usuario autenticado');
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se encontró usuario autenticado',
        life: 3000
      });
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.tenantService
      .getTenantByEmail(user.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          // Manejar diferentes posibles estructuras de respuesta
          const tenant = resp?.object || resp?.data || resp;
          const tenantId = tenant?.id;

          if (!tenantId) {
            console.error('No se encontró información del tenant. Respuesta:', resp);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se encontró información del tenant',
              life: 3000
            });
            this.loading.set(false);
            return;
          }

          this.tenantId = tenantId;
          this.cargarUsuarios();
        },
        error: (error) => {
          console.error('Error al obtener tenant por email:', error);
          // Si todo falla, usar tenantId por defecto (1)
          this.tenantId = 1;
          this.cargarUsuarios();
        }
      });
  }

  /**
   * Carga la lista de usuarios
   */
  cargarUsuarios() {
    this.loading.set(true);
    this.userService
      .getUsuarios(this.tenantId, {
        page: this.currentPage,
        pageSize: this.rows,
        searchTerm: this.searchTerm
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: UserListResponse) => {
          this.usuarios.set(response.usuarios);
          this.totalRecords.set(response.total);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error al cargar usuarios:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al cargar los usuarios',
            life: 3000
          });
          this.loading.set(false);
        }
      });
  }

  /**
   * Handle lazy load events de PrimeNG
   */
  onLazyLoad(event: any): void {
    const rows = event.rows ?? this.rows;
    const firstIndex = event.first ?? (event.page != null ? event.page * rows : 0);

    this.first = firstIndex;
    this.rows = rows;
    this.currentPage = event.page != null ? event.page : Math.floor(firstIndex / rows);

    this.cargarUsuarios();
  }

  /**
   * Abre el dialog para crear un nuevo usuario
   */
  abrirDialogoNuevo() {
    this.isEditMode.set(false);
    this.selectedUsuario = null;
    this.usuarioForm.reset();
    this.usuarioForm.get('rol')?.setValue(UserRole.MESERO);
    this.dialogVisible.set(true);
  }

  /**
   * Abre el dialog para editar un usuario
   */
  abrirDialogoEditar(usuario: UserDTO) {
    this.isEditMode.set(true);
    this.selectedUsuario = usuario;

    // Preparar el formulario sin la contraseña para edición
    const formGroup = this.formBuilder.group({
      nombre: [usuario.nombre, [Validators.required, Validators.minLength(2)]],
      email: [usuario.email, [Validators.required, Validators.email]],
      contrasena: [''], // Opcional en edición
      rol: [usuario.rol, Validators.required]
    });

    this.usuarioForm = formGroup;
    this.dialogVisible.set(true);
  }

  /**
   * Cierra el dialog y limpia el formulario
   */
  cerrarDialogo() {
    this.dialogVisible.set(false);
    this.selectedUsuario = null;
    this.usuarioForm.reset();
    this.inicializarFormulario();
    this.isEditMode.set(false);
  }

  /**
   * Guarda un usuario (crear o actualizar)
   */
  guardarUsuario() {
    if (this.usuarioForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Validación',
        detail: 'Por favor completa todos los campos requeridos',
        life: 3000
      });
      return;
    }

    this.loading.set(true);

    if (this.isEditMode() && this.selectedUsuario?.id) {
      // Actualizar
      const updateRequest = {
        nombre: this.usuarioForm.get('nombre')?.value,
        email: this.usuarioForm.get('email')?.value,
        rol: this.usuarioForm.get('rol')?.value,
        ...(this.usuarioForm.get('contrasena')?.value && {
          contrasena: this.usuarioForm.get('contrasena')?.value
        })
      };

      this.userService
        .updateUsuario(this.selectedUsuario.id, this.tenantId, updateRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Usuario actualizado correctamente',
              life: 3000
            });
            this.cerrarDialogo();
            this.cargarUsuarios();
            this.loading.set(false);
          },
          error: (error) => {
            console.error('Error al actualizar usuario:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al actualizar el usuario',
              life: 3000
            });
            this.loading.set(false);
          }
        });
    } else {
      // Crear
      const createRequest = {
        nombre: this.usuarioForm.get('nombre')?.value,
        email: this.usuarioForm.get('email')?.value,
        contrasena: this.usuarioForm.get('contrasena')?.value,
        rol: this.usuarioForm.get('rol')?.value,
        tenantId: this.tenantId
      };

      this.userService
        .createUsuario(createRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Éxito',
              detail: 'Usuario creado correctamente',
              life: 3000
            });
            this.cerrarDialogo();
            this.cargarUsuarios();
            this.loading.set(false);
          },
          error: (error) => {
            console.error('Error al crear usuario:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error al crear el usuario',
              life: 3000
            });
            this.loading.set(false);
          }
        });
    }
  }

  /**
   * Elimina un usuario previa confirmación
   */
  eliminarUsuario(usuario: UserDTO) {
    if (!usuario.id) return;

    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar al usuario ${usuario.nombre}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.loading.set(true);
        this.userService
          .deleteUsuario(usuario.id!, this.tenantId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Éxito',
                detail: 'Usuario eliminado correctamente',
                life: 3000
              });
              this.cargarUsuarios();
              this.loading.set(false);
            },
            error: (error) => {
              console.error('Error al eliminar usuario:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Error al eliminar el usuario',
                life: 3000
              });
              this.loading.set(false);
            }
          });
      }
    });
  }

  /**
   * Obtiene el color para un rol específico
   */
  getColorForRole(rol: UserRole): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const colors: { [key in UserRole]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' } = {
      [UserRole.ADMIN]: 'danger',
      [UserRole.MESERO]: 'info',
      [UserRole.COCINA]: 'success',
      [UserRole.CAJA]: 'warn',
      [UserRole.MARKETING]: 'secondary'
    };
    return colors[rol] || 'secondary';
  }

  /**
   * Formatea el nombre del rol para mostrar
   */
  formatRoleName(rol: UserRole): string {
    const roleNames: { [key in UserRole]: string } = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.MESERO]: 'Mesero',
      [UserRole.COCINA]: 'Cocina',
      [UserRole.CAJA]: 'Caja',
      [UserRole.MARKETING]: 'Marketing'
    };
    return roleNames[rol] || rol;
  }

  /**
   * Obtiene los permisos para un rol específico
   */
  getPermissionsForRole(rol: UserRole): string[] {
    return ROLE_PERMISSIONS[rol] || [];
  }

  /**
   * Controla si el formulario es válido
   */
  isFormValid(): boolean {
    return this.usuarioForm.valid;
  }

  /**
   * Filtra la tabla con búsqueda global contra el backend
   */
  onGlobalFilter(table: any, event: Event) {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.currentPage = 0; // Reiniciar a la primera página
    this.first = 0;
    this.cargarUsuarios();
  }

  /**
   * Obtiene los roles disponibles para el diálogo en formato { label, value }
   */
  getRolesForDialog(): Array<{ label: string; value: UserRole }> {
    return this.availableRoles().map(role => ({
      label: this.formatRoleName(role),
      value: role
    }));
  }

  /**
   * Alias para formatRolName utilizad  en el template
   */
  formatRolName(rol: UserRole): string {
    return this.formatRoleName(rol);
  }
}
