import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../commons/environment';

@Injectable({ providedIn: 'root' })
export class ImageService {
    private baseUrl = `${environment.apiUrl}/images`;

    constructor(private http: HttpClient) {}

    /**
     * Sube una imagen usando JSON, según el nuevo curl del backend.
     * @param file Archivo seleccionado por el usuario
     * @param type Tipo de imagen
     * @param email Email
     * @param nombreNegocio Nombre del negocio
     * @param slogan Slogan
     * @param tenantId ID del tenant (opcional)
     */
    uploadImage(file: File, type: string, email: string, nombreNegocio: string, slogan: string, tenantId?: number): Observable<any> {
        return new Observable((observer) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64File = (reader.result as string).split(',')[1];
                const body: any = {
                    email,
                    nombreNegocio,
                    slogan,
                    type,
                    base64File
                };
                if (tenantId) {
                    body.tenantId = tenantId;
                }
                this.http
                    .post(`${this.baseUrl}/upload`, body, {
                        headers: { 'Content-Type': 'application/json' },
                        responseType: 'text'
                    })
                    .subscribe({
                        next: (res) => {
                            observer.next(res);
                            observer.complete();
                        },
                        error: (err) => observer.error(err)
                    });
            };
            reader.onerror = (err) => observer.error(err);
            reader.readAsDataURL(file);
        });
    }

    uploadLogoBase64(base64Data: string, tenantId: number, email?: string, nombreNegocio?: string, slogan?: string): Observable<string> {
        const body: any = {
            tenantId,
            type: 'logo',
            base64File: base64Data,
            email: email || '',
            nombreNegocio: nombreNegocio || '',
            slogan: slogan || ''
        };
        return this.http.post(`${this.baseUrl}/upload`, body, {
            headers: { 'Content-Type': 'application/json' },
            responseType: 'text'
        });
    }

    uploadImageProd(file: File, type: string, tenantId: number, productName: string): Observable<any> {
        return new Observable((observer) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64File = (reader.result as string).split(',')[1];
                const body = {
                    tenantId,
                    productName,
                    type,
                    base64File
                };
                this.http
                    .post(`${this.baseUrl}/uploadImgProd`, body, {
                        headers: { 'Content-Type': 'application/json' },
                        responseType: 'text'
                    })
                    .subscribe({
                        next: (res) => {
                            observer.next(res);
                            observer.complete();
                        },
                        error: (err) => observer.error(err)
                    });
            };
            reader.onerror = (err) => observer.error(err);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Sube una imagen de promoción a la carpeta lealtix/promos
     * @param file Archivo seleccionado por el usuario
     * @param type Tipo de imagen
     * @param tenantId ID del tenant
     * @param promoName Nombre de la promoción
     */
    uploadImagePromotion(file: File, type: string, tenantId: number, promoName: string): Observable<any> {
        return new Observable((observer) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64File = (reader.result as string).split(',')[1];
                const body = {
                    tenantId,
                    promoName,
                    type,
                    base64File
                };
                this.http
                    .post(`${this.baseUrl}/uploadImgPromo`, body, {
                        headers: { 'Content-Type': 'application/json' },
                        responseType: 'text'
                    })
                    .subscribe({
                        next: (res) => {
                            observer.next(res);
                            observer.complete();
                        },
                        error: (err) => observer.error(err)
                    });
            };
            reader.onerror = (err) => observer.error(err);
            reader.readAsDataURL(file);
        });
    }
}
