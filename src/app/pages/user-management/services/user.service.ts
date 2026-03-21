import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { UserDTO, CreateUserRequest, UpdateUserRequest, UserRole, ROLE_PERMISSIONS, UserListResponse } from '@/models/user.model';
import { GenericResponse } from '@/models/generic-response.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/admin/users`;

  // Simulación de usuarios para demostración
  private mockUsers: UserDTO[] = [
    {
      id: 1,
      nombre: 'Administrator',
      email: 'admin@lealtix.com',
      rol: UserRole.ADMIN,
      permissions: ROLE_PERMISSIONS[UserRole.ADMIN],
      activo: true
    },
    {
      id: 2,
      nombre: 'Juan Pérez',
      email: 'juan@lealtix.com',
      rol: UserRole.MESERO,
      permissions: ROLE_PERMISSIONS[UserRole.MESERO],
      activo: true
    },
    {
      id: 3,
      nombre: 'María García',
      email: 'maria@lealtix.com',
      rol: UserRole.COCINA,
      permissions: ROLE_PERMISSIONS[UserRole.COCINA],
      activo: true
    }
  ];

  constructor(private http: HttpClient) {}

  /**
   * Obtiene lista de usuarios del tenant
   */
  getUsuarios(tenantId: number, params?: { page?: number; pageSize?: number; searchTerm?: string }): Observable<UserListResponse> {
    const page = params?.page ?? 0;
    const pageSize = params?.pageSize ?? 10;
    const searchTerm = params?.searchTerm ?? '';

    let httpParams = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) {
      httpParams = httpParams.set('search', searchTerm);
    }

    // Intenta obtener del backend, si falla usa mock
    return this.http.get<GenericResponse<UserListResponse>>(`${this.baseUrl}`, { params: httpParams })
      .pipe(
        map(response => response.object || response as any),
        catchError(error => {
          console.warn('Error al obtener usuarios del backend, usando datos mock:', error);
          // Retorna datos mock en caso de error
          const filteredUsers = this.mockUsers.filter(u =>
            !searchTerm ||
            u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return of({
            total: filteredUsers.length,
            usuarios: filteredUsers.slice(page * pageSize, (page + 1) * pageSize)
          });
        })
      );
  }

  /**
   * Obtiene un usuario específico por ID
   */
  getUsuarioById(id: number): Observable<UserDTO> {
    return this.http.get<GenericResponse<UserDTO>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => response.object || response as any),
        catchError(error => {
          console.warn('Error al obtener usuario del backend, usando datos mock:', error);
          const mockUser = this.mockUsers.find(u => u.id === id);
          return mockUser ? of(mockUser) : throwError(() => error);
        })
      );
  }

  /**
   * Crea un nuevo usuario
   */
  createUsuario(request: CreateUserRequest): Observable<UserDTO> {
    return this.http.post<GenericResponse<UserDTO>>(`${this.baseUrl}`, request)
      .pipe(
        map(response => response.object || response as any),
        tap(newUser => {
          // Agregar permisos basados en el rol
          if (!newUser.permissions && newUser.rol) {
            newUser.permissions = ROLE_PERMISSIONS[newUser.rol as UserRole];
          }
          // Agregar a la lista mock para continuidad en demo
          if (newUser.id) {
            this.mockUsers.push(newUser);
          }
        }),
        catchError(error => {
          console.error('Error al crear usuario:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Actualiza un usuario existente
   */
  updateUsuario(id: number, request: UpdateUserRequest): Observable<UserDTO> {
    return this.http.put<GenericResponse<UserDTO>>(`${this.baseUrl}/${id}`, request)
      .pipe(
        map(response => response.object || response as any),
        tap(updatedUser => {
          // Actualizar permisos si cambió el rol
          if (updatedUser.rol && !updatedUser.permissions) {
            updatedUser.permissions = ROLE_PERMISSIONS[updatedUser.rol as UserRole];
          }
          // Actualizar en lista mock
          const index = this.mockUsers.findIndex(u => u.id === id);
          if (index !== -1) {
            this.mockUsers[index] = updatedUser;
          }
        }),
        catchError(error => {
          console.error('Error al actualizar usuario:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Elimina un usuario
   */
  deleteUsuario(id: number): Observable<any> {
    return this.http.delete<GenericResponse<any>>(`${this.baseUrl}/${id}`)
      .pipe(
        tap(() => {
          // Eliminar de lista mock
          this.mockUsers = this.mockUsers.filter(u => u.id !== id);
        }),
        catchError(error => {
          console.error('Error al eliminar usuario:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Obtiene el listado de roles disponibles
   */
  getAvailableRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  /**
   * Obtiene los permisos para un rol específico
   */
  getPermissionsForRole(role: UserRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Crea ID único temporal para mock (útil para UI)
   */
  generateMockId(): number {
    return Math.max(...this.mockUsers.map(u => u.id || 0), 0) + 1;
  }
}
