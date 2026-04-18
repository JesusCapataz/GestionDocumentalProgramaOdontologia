import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnexoService {
  // 📍 Ajusta esta URL según tu entorno de Spring Boot
  private apiUrl = 'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/anexos';

  constructor(private http: HttpClient) { }

  /**
   * 🛡️ Genera los headers con el Token JWT para cada petición.
   * Cumple con la seguridad requerida por tu backend.
   */
  // Headers eliminados: el authErrorInterceptor los inyecta globalmente

  /**
   * 📂 Obtiene la lista completa de anexos.
   */
 getAnexos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  /**
   * 🔍 Obtiene un único anexo por su ID.
   */
 getAnexoById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }
  /**
   * ✨ Crea un nuevo registro de anexo (Sin archivo).
   */
  guardarAnexo(anexo: any): Observable<any> {
    return this.http.post(this.apiUrl, anexo);
  }
  /**
   * 📝 Actualiza los metadatos de un anexo existente.
   */
  actualizarAnexo(id: number, datos: any, eliminarArchivo = false): Observable<any> {
    const url = eliminarArchivo
      ? `${this.apiUrl}/${id}?eliminarArchivo=true`
      : `${this.apiUrl}/${id}`;
    return this.http.put(url, datos);
  }

  /**
   * 🗑️ Elimina el registro completo de la base de datos y su archivo asociado.
   */
  eliminarAnexo(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * 📤 Sube un archivo físico (PDF, DOCX, etc.) y lo asocia a un registro.
   * Se encarga de manejar el FormData correctamente.
   */
  subirArchivoFisico(id: number, archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo);
    // Sin Content-Type: el navegador asigna el boundary del multipart automáticamente
    return this.http.post(`${this.apiUrl}/${id}/archivo`, formData, { responseType: 'text' });
  }

  /**
   * 👁️ Obtiene el archivo físico como un Blob para previsualización o descarga.
   */
   getAnexosActualizados(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/actualizados`);
  }

  verArchivoFisico(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/archivo`, { responseType: 'blob' });
  }

  /**
   * 🧹 Borra SOLO el archivo físico del servidor, pero mantiene los datos vivos.
   * Útil para el "Blindaje Anti-Zombi" que tienes en la lógica de edición.
   */
   eliminarArchivoFisico(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/archivo`, { responseType: 'text' });
  }
}