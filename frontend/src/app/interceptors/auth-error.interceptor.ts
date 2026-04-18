import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../notifications/notification.service';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const notifService = inject(NotificationService);

  const token = localStorage.getItem('token');

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  // URLs que manejan su propio 401 — NO deben cerrar sesión
  const BYPASS_401 = [
    '/api/usuarios/verificar-password',
    '/api/usuarios/password'
  ];
  const esBypass = BYPASS_401.some(url => req.url.includes(url));

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 403) && !esBypass) {
        localStorage.clear();
        router.navigate(['/login']);
        notifService.showWarning('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
      } else if (error.status >= 500) {
        notifService.showWarning('El sistema está experimentando intermitencias. Por favor, intenta de nuevo.');
      } else if (error.status === 404) {
        notifService.showWarning('El recurso solicitado no fue encontrado.');
      } else if (error.status === 0) {
        notifService.showWarning('Sin conexión al servidor. Verifica tu red e intenta de nuevo.');
      }
      // Relanzamos el error para que los componentes puedan reaccionar si es necesario
      return throwError(() => error);
    })
  );
};