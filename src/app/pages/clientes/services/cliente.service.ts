import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import {
  Cliente,
  CreateClienteRequest,
  UpdateClienteRequest,
  ClienteListResponse,
  BulkUploadClienteRequest,
  BulkUploadClienteResponse,
  ClienteSearchParams,
  CSV_HEADERS
} from '@/models/cliente.model';
import { GenericResponse } from '@/models/generic-response.model';
import { environment } from '@/pages/commons/environment';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  // Backend actual expone endpoints bajo `tenant-customers`
  private readonly baseUrl = `${environment.apiUrl}/tenant-customers`;

  constructor(private http: HttpClient) {}

  /**
   * Obtiene lista paginada de clientes por tenantId
   */
  getClientes(params: ClienteSearchParams): Observable<ClienteListResponse> {
    // El backend expone: GET /tenant-customers/tenant/{tenantId}?page=..&size=..
    let httpParams = new HttpParams()
      .set('page', (params.page ?? 0).toString())
      .set('size', (params.pageSize ?? 10).toString());

    if (params.email) {
      httpParams = httpParams.set('email', params.email);
    }

    // If frontend passed sort info (PrimeNG lazy), translate to backend sort param
    // Backend expects sort as 'field,asc' or 'field,desc' (Spring Data style)
    if (params.sortField) {
      const dir = params.sortOrder ?? 'asc';
      httpParams = httpParams.set('sort', `${params.sortField},${dir}`);
    }

    const url = `${this.baseUrl}/tenant/${params.tenantId}`;
    console.log(`[ClienteService] Solicitando clientes: page=${params.page}, size=${params.pageSize}, url=${url}`);
    return this.http.get<GenericResponse<any>>(url, { params: httpParams })
      .pipe(
        map(response => {
          const obj = this.mapGenericResponse<any>(response);

          // El backend ahora devuelve estructura paginada completa:
          // { size, last, totalPages, page, content[], totalElements }
          const content = obj.content && Array.isArray(obj.content) ? obj.content : [];
          console.log(`[ClienteService] Respuesta: ${content.length} registros, totalElements=${obj.totalElements}, totalPages=${obj.totalPages}`);

          // Map backend shape to ClienteListResponse
          const mappedContent = content.map((it: any) => this.mapBackendCustomerToCliente(it));

          const result: ClienteListResponse = {
            content: mappedContent,
            totalElements: obj.totalElements ?? 0,
            totalPages: obj.totalPages ?? 1,
            currentPage: obj.page ?? (params.page ?? 0),
            pageSize: obj.size ?? (params.pageSize ?? 10)
          };
          return result;
        }),
        catchError(error => {
          console.error('Error al obtener clientes:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Obtiene un cliente específico por ID
   */
  getClienteById(id: number): Observable<Cliente> {
    return this.http.get<GenericResponse<any>>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => this.mapGenericResponse<any>(response)),
        map(obj => this.mapBackendCustomerToCliente(obj)),
        catchError(error => {
          console.error('Error al obtener cliente:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Crea un nuevo cliente
   */
  /**
   * Crea un nuevo cliente. El backend espera campos en formato `tenant-customers`.
   * Se requiere pasar `tenantId` (ej. desde el componente).
   */
  createCliente(tenantId: number, req: CreateClienteRequest): Observable<Cliente> {
    const payload = this.mapCreateRequestToBackend(tenantId, req);
    return this.http.post<GenericResponse<any>>(`${this.baseUrl}`, payload)
      .pipe(
        map(response => this.mapGenericResponse<any>(response)),
        map(obj => this.mapBackendCustomerToCliente(obj)),
        tap(() => {
          console.log('Cliente creado exitosamente');
        }),
        catchError(error => {
          console.error('Error al crear cliente:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Actualiza un cliente existente
   */
  updateCliente(id: number, req: UpdateClienteRequest): Observable<Cliente> {
    // Map partial update to backend naming if necessary
    const payload: any = {};
    if ((req as any).nombreCompleto || (req as any).nombreCompleto === '') payload.name = (req as any).nombreCompleto ?? req.nombreCompleto;
    if (req.email) payload.email = req.email;
    if (req.fechaNacimiento) payload.birthDate = typeof req.fechaNacimiento === 'string' ? req.fechaNacimiento : (req.fechaNacimiento as Date).toISOString().split('T')[0];
    if ((req as any).genero) payload.gender = this.mapGeneroToBackend((req as any).genero ?? req.genero);
    if (req.telefono) payload.phone = req.telefono;
    if (typeof req.activo !== 'undefined') payload.active = (req as any).activo ?? req.activo;

    return this.http.put<GenericResponse<any>>(`${this.baseUrl}/${id}`, payload)
      .pipe(
        map(response => this.mapGenericResponse<any>(response)),
        map(obj => this.mapBackendCustomerToCliente(obj)),
        tap(() => {
          console.log('Cliente actualizado exitosamente');
        }),
        catchError(error => {
          console.error('Error al actualizar cliente:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Elimina un cliente (soft delete)
   */
  /**
   * Soft-delete usando el endpoint PUT /tenant-customers/{id}/deactivate
   */
  deleteCliente(id: number): Observable<void> {
    return this.http.delete(`${this.baseUrl}/${id}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          console.log('Cliente eliminado exitosamente');
        }),
        catchError(error => {
          console.error('Error al eliminar cliente:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Carga clientes en lote desde CSV/XLSX
   */
  /**
   * Bulk upload: backend espera un array de objects y query param tenantId
   */
  bulkUploadClientes(tenantId: number, clientes: CreateClienteRequest[]): Observable<BulkUploadClienteResponse> {
    const payload = clientes.map(c => ({
      tenantId,
      name: c.nombreCompleto,
      email: c.email,
      gender: this.mapGeneroToBackend(c.genero),
      birthDate: typeof c.fechaNacimiento === 'string' ? c.fechaNacimiento : (c.fechaNacimiento as Date).toISOString().split('T')[0],
      phone: c.telefono ?? ''
    }));

    return this.http.post<GenericResponse<any>>(`${this.baseUrl}/bulk-upload?tenantId=${tenantId}`, payload)
      .pipe(
        map(response => this.mapGenericResponse<any>(response)),
        map(obj => ({
          exitosos: obj.exitosos ?? 0,
          fallidos: obj.fallidos ?? 0,
          errores: obj.errores ?? []
        } as BulkUploadClienteResponse)),
        tap(() => {
          console.log('Carga en lote completada');
        }),
        catchError(error => {
          console.error('Error al cargar clientes en lote:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Descarga plantilla CSV de clientes
   */
  downloadCsvTemplate(): void {
    const csvContent = this.generateCsvTemplate();
    this.downloadFile(csvContent, 'plantilla-clientes.csv', 'text/csv');
  }

  /**
   * Genera archivo CSV desde datos de clientes
   */
  exportClientes(clientes: Cliente[]): void {
    const csvContent = this.generateCsvFromClientes(clientes);
    this.downloadFile(csvContent, 'clientes-exportados.csv', 'text/csv');
  }

  /**
   * Parsea archivo CSV y retorna los clientes parseados
   */
  parseClientesFromFile(file: File): Promise<CreateClienteRequest[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const csv = event.target?.result as string;
          const clientes = this.parseCSV(csv);
          resolve(clientes);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Parsea archivo XLSX (simplificado - requiere librería adicional en producción)
   * Por ahora, validamos que el archivo tenga extensión .xlsx
   */
  async parseClientesFromExcel(file: File): Promise<CreateClienteRequest[]> {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      throw new Error('El archivo debe ser .xlsx o .xls');
    }

    // En producción, usaría una librería como xlsx
    // Por ahora, retornamos un placeholder
    console.warn('Para XLSX se recomienda usar librería xlsx en el backend');
    return [];
  }

  /**
   * Valida archivo antes de procesarlo
   */
  validateFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'El archivo no puede estar vacío' };
    }

    const allowedExtensions = ['csv', 'xlsx', 'xls'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `Formato no permitido. Use: ${allowedExtensions.join(', ')}`
      };
    }

    if (file.size === 0) {
      return { isValid: false, error: 'El archivo está vacío' };
    }

    const maxSizeInMB = 5;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      return { isValid: false, error: `El archivo no puede superar ${maxSizeInMB}MB` };
    }

    return { isValid: true };
  }

  // ================== Métodos Privados ==================

  /**
   * Parsea contenido CSV
   */
  private parseCSV(csv: string): CreateClienteRequest[] {
    const lines = csv.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('El archivo CSV debe contener al menos encabezados y una fila de datos');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const clientes: CreateClienteRequest[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Salta líneas vacías

      const values = this.parseCSVLine(line);

      if (values.length < CSV_HEADERS.length - 1) {
        throw new Error(`Fila ${i + 1}: Número de campos insuficiente`);
      }

      const cliente: CreateClienteRequest = {
        nombreCompleto: values[0]?.trim() || '',
        email: values[1]?.trim() || '',
        fechaNacimiento: values[2]?.trim() || '',
        genero: (values[3]?.trim() || 'Otro') as 'Hombre' | 'Mujer' | 'Otro',
        telefono: values[4]?.trim() || undefined
      };

      // Validaciones básicas
      if (!cliente.nombreCompleto) {
        throw new Error(`Fila ${i + 1}: Nombre Completo es requerido`);
      }
      if (!cliente.email) {
        throw new Error(`Fila ${i + 1}: Email es requerido`);
      }
      if (!this.isValidEmail(cliente.email)) {
        throw new Error(`Fila ${i + 1}: Email inválido`);
      }
      if (!cliente.fechaNacimiento) {
        throw new Error(`Fila ${i + 1}: Fecha de Nacimiento es requerida`);
      }
      // Normalize several common input formats (YYYY-MM-DD or DD/MM/YYYY) to ISO YYYY-MM-DD
      const rawFecha = typeof cliente.fechaNacimiento === 'string' ? cliente.fechaNacimiento.trim() : '';
      const normalized = this.normalizeDateToIso(rawFecha);
      if (!normalized) {
        throw new Error(`Fila ${i + 1}: Fecha de Nacimiento inválida (use YYYY-MM-DD or DD/MM/YYYY)`);
      }
      cliente.fechaNacimiento = normalized;

      clientes.push(cliente);
    }

    if (clientes.length === 0) {
      throw new Error('No se encontraron registros válidos en el archivo');
    }

    return clientes;
  }

  // ====== Helpers para mapear entre shapes BE <-> FE ======
  private mapBackendCustomerToCliente(item: any): Cliente {
    const tenantId = item.tenantId ?? item.tenant?.id ?? (item.tenant?.tenantId ?? 0);
    const nombre = item.nombreCompleto ?? item.name ?? item.fullName ?? '';
    const email = item.email ?? '';
    const fechaNacimiento = item.fechaNacimiento ?? item.birthDate ?? '';
    const generoRaw = item.genero ?? item.gender ?? '';
    const genero: any = this.mapGeneroFromBackend(generoRaw);
    const telefono = item.telefono ?? item.phone ?? undefined;
    const activo = typeof item.activo !== 'undefined' ? item.activo : (typeof item.active !== 'undefined' ? item.active : true);
    const fechaCreacion = item.fechaCreacion ?? item.createdAt ?? '';
    const fechaActualizacion = item.fechaActualizacion ?? item.updatedAt ?? undefined;

    return {
      id: item.id,
      tenantId,
      nombreCompleto: nombre,
      email,
      fechaNacimiento,
      genero,
      telefono,
      activo,
      fechaCreacion,
      fechaActualizacion
    } as Cliente;
  }

  private mapGeneroToBackend(g: any): string {
    if (!g) return 'other';
    const val = (g as string).toLowerCase();
    if (val === 'hombre' || val === 'male') return 'male';
    if (val === 'mujer' || val === 'female') return 'female';
    return 'other';
  }

  private mapGeneroFromBackend(g: any): 'Hombre' | 'Mujer' | 'Otro' {
    if (!g) return 'Otro';
    const val = (g as string).toLowerCase();
    if (val === 'male' || val === 'hombre') return 'Hombre';
    if (val === 'female' || val === 'mujer') return 'Mujer';
    return 'Otro';
  }

  private mapCreateRequestToBackend(tenantId: number, req: CreateClienteRequest): any {
    return {
      tenantId,
      name: req.nombreCompleto,
      email: req.email,
      gender: this.mapGeneroToBackend(req.genero),
      birthDate: typeof req.fechaNacimiento === 'string' ? req.fechaNacimiento : (req.fechaNacimiento as Date).toISOString().split('T')[0],
      phone: req.telefono ?? '',
      acceptedPromotions: true,
      acceptedAt: new Date().toISOString().split('T')[0],
      active: true
    };
  }

  /**
   * Parsea una línea CSV manejo comillas
   */
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Genera plantilla CSV
   */
  private generateCsvTemplate(): string {
    const headers = CSV_HEADERS.join(',');
    const example = ['Juan Pérez', 'juan@example.com', '1990-05-15', 'Hombre', '555-123-456'].join(',');
    return `${headers}\n${example}`;
  }

  /**
   * Genera CSV desde clientes
   */
  private generateCsvFromClientes(clientes: Cliente[]): string {
    const headers = CSV_HEADERS.join(',');
    const rows = clientes.map(c => {
      const fechaNacimiento = typeof c.fechaNacimiento === 'string'
        ? c.fechaNacimiento
        : new Date(c.fechaNacimiento).toISOString().split('T')[0];
      return [
        c.nombreCompleto,
        c.email,
        fechaNacimiento,
        c.genero,
        c.telefono || ''
      ].map(v => `"${v}"`).join(',');
    });
    return `${headers}\n${rows.join('\n')}`;
  }

  /**
   * Descarga archivo
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /**
   * Valida email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida fecha en formato YYYY-MM-DD
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Normaliza varias entradas comunes de fecha a ISO YYYY-MM-DD.
   * Acepta:
   * - YYYY-MM-DD (se devuelve igual)
   * - DD/MM/YYYY (se convierte a YYYY-MM-DD)
   * - Intentará parsear con Date como fallback y si es válido devolverá YYYY-MM-DD
   * Retorna `null` si no se pudo normalizar.
   */
  private normalizeDateToIso(dateStr: string): string | null {
    if (!dateStr) return null;
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    const dmyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // DD/MM/YYYY

    const s = dateStr.trim();
    if (isoRegex.test(s)) return s;

    const m = s.match(dmyRegex);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3];
      const candidate = `${year}-${month}-${day}`;
      return this.isValidDate(candidate) ? candidate : null;
    }

    // Fallback: try Date parse and format
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = String(parsed.getFullYear());
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      const candidate = `${y}-${mm}-${dd}`;
      return this.isValidDate(candidate) ? candidate : null;
    }

    return null;
  }

  /**
   * Mapea respuesta genérica
   */
  private mapGenericResponse<T>(response: GenericResponse<T>): T {
    if (!response || !response.object) {
      throw new Error('Respuesta inválida del servidor');
    }
    return response.object;
  }
}
