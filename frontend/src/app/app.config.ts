import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
// Importamos la herramienta para hacer peticiones al backend
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authErrorInterceptor } from './interceptors/auth-error.interceptor';
import { loadingInterceptor } from './interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authErrorInterceptor, loadingInterceptor])
    )
  ]
};