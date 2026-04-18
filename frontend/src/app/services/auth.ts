import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { HttpHeaders } from '@angular/common/http';

export interface UsuarioActivo {
  nombres:   string;
  apellidos: string;
  correo:    string;
  rol:       string;   // 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'DOCENTE' | 'ESTUDIANTE'
  rolBonito: string;   // 'Super Admin' | 'Administrador' | 'Docente' | 'Estudiante'
}

export interface PerfilUpdatePayload   { nombres: string; apellidos: string; }
export interface PasswordUpdatePayload { actual: string;  nueva: string;    }
export interface PerfilResponse {
  mensaje:  string;
  nombre:   string;
  apellido: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService { // Aunque el archivo se llame auth.ts, la clase se llama AuthService
  // ¡Esta es la URL de tu backend en IntelliJ!
  private apiUrl = 'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/auth';

  // ── Fuente Única de Verdad del usuario activo ─────────────
  private readonly _ROL_MAP: Record<string, string> = {
    'SUPER_ADMIN':   'Super Admin',
    'ADMINISTRADOR': 'Administrador',
    'DOCENTE':       'Docente',
    'ESTUDIANTE':    'Estudiante'
  };

  readonly usuarioActivo = signal<UsuarioActivo | null>(null);

  /** Primer nombre del usuario (para el Navbar) */
  readonly primerNombre = computed(() =>
    this.usuarioActivo()?.nombres.split(' ')[0] ?? ''
  );

  /** Primer apellido del usuario (para el Navbar) */
  readonly primerApellido = computed(() =>
    this.usuarioActivo()?.apellidos.split(' ')[0] ?? ''
  );

  constructor(private http: HttpClient, private router: Router) {
    this._rehidratarDesdeStorage(); // Rehydrate on app start
    // Escucha cambios en localStorage desde OTRAS pestañas
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === 'token') {
        if (!event.newValue) {
          // Token eliminado en otra pestaña → cerrar sesión aquí también
          console.log('[Auth] Sesión cerrada en otra pestaña. Redirigiendo al login.');
          this.router.navigate(['/login']);
        } else if (event.oldValue && event.newValue !== event.oldValue) {
          // Token cambiado (nuevo login en otra pestaña) → recargar
          console.log('[Auth] Sesión cambiada en otra pestaña. Recargando.');
          window.location.reload();
        }
      }
    });
  }

  // ── Rehidratación desde localStorage (para F5) ─────────────
  private _rehidratarDesdeStorage(): void {
    const nombres   = localStorage.getItem('nombres')   ?? '';
    const apellidos = localStorage.getItem('apellidos') ?? '';
    const correo    = localStorage.getItem('correoActivo') ?? '';
    const rol       = localStorage.getItem('rol') ?? '';
    if (nombres && rol) {
      this.usuarioActivo.set({
        nombres,
        apellidos,
        correo,
        rol,
        rolBonito: this._ROL_MAP[rol] ?? rol
      });
    }
  }

  /** Actualiza la fuente de verdad local sin tocar el backend */
  actualizarUsuarioLocal(datos: Partial<Pick<UsuarioActivo, 'nombres' | 'apellidos'>>): void {
    const actual = this.usuarioActivo();
    if (!actual) return;

    const actualizado: UsuarioActivo = {
      ...actual,
      nombres:   datos.nombres   ?? actual.nombres,
      apellidos: datos.apellidos ?? actual.apellidos
    };
    this.usuarioActivo.set(actualizado);

    // Mantenemos localStorage sincronizado como respaldo ante F5
    localStorage.setItem('nombres',   actualizado.nombres);
    localStorage.setItem('apellidos', actualizado.apellidos);
    localStorage.setItem('nombreUsuarioActivo',
      `${actualizado.nombres} ${actualizado.apellidos}`.trim());
  }

  /** Inicializa el estado global tras login o registro exitoso */
  inicializarSesion(respuesta: any): void {
    const nombres   = this._toTitleCase(respuesta.nombre   ?? '');
    const apellidos = this._toTitleCase(respuesta.apellido ?? '');
    const correo    = respuesta.correo ?? '';
    const rol       = respuesta.rol   ?? 'ESTUDIANTE';

    localStorage.setItem('nombres',              nombres);
    localStorage.setItem('apellidos',            apellidos);
    localStorage.setItem('nombreUsuarioActivo',  `${nombres} ${apellidos}`.trim());
    localStorage.setItem('rolActual',            this._ROL_MAP[rol] ?? rol);
    localStorage.setItem('correoActivo',         correo);

    this.usuarioActivo.set({
      nombres,
      apellidos,
      correo,
      rol,
      rolBonito: this._ROL_MAP[rol] ?? rol
    });
  }

  /** Title Case interno — igual al que ya usabas, pero centralizado aquí */
  private _toTitleCase(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Método para iniciar sesión
  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credenciales);
  }
  // Método para crear cuenta
  register(usuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, usuario);
  }

  // Método para guardar el Token en el almacenamiento del navegador
  guardarToken(token: string, rol: string): void {
    localStorage.setItem('token', token);
    localStorage.setItem('rol',   rol);
  }

  // Método para saber si alguien está logueado
  estaLogueado(): boolean {
    return localStorage.getItem('token') !== null;
  }

  // Método para cerrar sesión (borra el pase VIP)
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
  }
  // ── Métodos nuevos dentro de AuthService ────────────────────

actualizarPerfil(payload: PerfilUpdatePayload): Observable<PerfilResponse> {
    const headers = this.getAuthHeaders();
    const body = { nombre: payload.nombres, apellido: payload.apellidos };

    return this.http.put<PerfilResponse>(
      'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/usuarios/perfil', 
      body,
      { headers }
    );
  }

  actualizarPassword(payload: PasswordUpdatePayload): Observable<{ mensaje: string }> {
    const headers = this.getAuthHeaders();
    const body = { actual: payload.actual, nueva: payload.nueva };

    return this.http.put<{ mensaje: string }>(
      'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/usuarios/password',
      body,
      { headers }
    );
  }


private getAuthHeaders(): HttpHeaders {
  const token = localStorage.getItem('token') ?? '';
  return new HttpHeaders({ Authorization: `Bearer ${token}` });
}
verificarPasswordActual(password: string): Observable<{ mensaje: string }> {
  return this.http.post<{ mensaje: string }>(
    'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/usuarios/verificar-password',
    { password },
    { headers: this.getAuthHeaders() }
  );
}
}