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
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FloatLabelModule } from 'primeng/floatlabel';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { PaginatorModule } from 'primeng/paginator';

// Services
import { UserService } from './services/user.service';
import { MessageService, ConfirmationService } from 'primeng/api';

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
    DialogModule,
    SelectModule,
    PasswordModule,
    ToastModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
    FloatLabelModule,
    TooltipModule,
    RippleModule,
    PaginatorModule
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

  // Pagination
  rows = 10;
  currentPage = 0;

  // Internal
  private destroy$ = new Subject<void>();
  private tenantId: number = 1; // Por defecto, se deberá obtener del contexto del usuario actual

  readonly ROLE_COLORS = ROLE_COLORS;

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private formBuilder: FormBuilder
  ) {
    this.inicializarFormulario();
  }

  ngOnInit() {
    this.cargarUsuarios();
    this.availableRoles.set(this.userService.getAvailableRoles());
    this.obtenerTenantId();
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
      rol: ['', Validators.required]
    });
  }

  /**
   * Obtiene el tenant ID del storage
   */
  private obtenerTenantId() {
    const usuarioStr = sessionStorage.getItem('usuario') || localStorage.getItem('usuario');
    if (usuarioStr) {
      try {
        const usuario = JSON.parse(usuarioStr);
        this.tenantId = usuario.tenantId || 1;
      } catch (error) {
        console.error('Error al obtener tenant ID:', error);
      }
    }
  }

  /**
   * Carga la lista de usuarios
   */
  cargarUsuarios() {
    this.loading.set(true);
    this.userService
      .getUsuarios(this.tenantId, {
        page: this.currentPage,
        pageSize: this.rows
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
   * Cierra el dialog
   */
  cerrarDialogo() {
    this.dialogVisible.set(false);
    this.usuarioForm.reset();
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
        .updateUsuario(this.selectedUsuario.id, updateRequest)
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
          .deleteUsuario(usuario.id!)
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

  /**   * Obtiene los permisos para un rol específico
   */
  getPermissionsForRole(rol: UserRole): string[] {
    return ROLE_PERMISSIONS[rol] || [];
  }

  /**   * Controla si el formulario es válido
   */
  isFormValid(): boolean {
    return this.usuarioForm.valid;
  }
}
