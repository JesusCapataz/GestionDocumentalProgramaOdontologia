import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type AppRole = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'DOCENTE' | 'ESTUDIANTE';

export interface UsuarioResumen {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  rol: AppRole;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net';

  // ── GET /api/usuarios/todos ──────────────────────────────
  obtenerTodos(): Observable<UsuarioResumen[]> {
    return this.http.get<UsuarioResumen[]>(
      `${this.apiUrl}/api/usuarios/todos`,
      { headers: this.authHeaders() }
    );
  }

  // ── PUT /api/usuarios/{id}/rol ───────────────────────────
  cambiarRol(usuarioId: number, nuevoRol: AppRole): Observable<{ mensaje: string; nuevoRol: string }> {
    return this.http.put<{ mensaje: string; nuevoRol: string }>(
      `${this.apiUrl}/api/usuarios/${usuarioId}/rol`,
      { nuevoRol },
      { headers: this.authHeaders() }
    );
  }

  // ── Helper ───────────────────────────────────────────────
  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}