import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AuthService } from '../../services/auth';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class AuthComponent implements OnInit, OnDestroy {
  
  modoAuth: 'login' | 'registro' = 'login';
  
  nombreRegistro = '';
  apellidoRegistro = '';
  correoRegistro = '';
  passRegistro = '';
  rolRegistro = ''; // <-- Nueva variable segura para capturar el rol
  correoLogin = '';
  passLogin = ''; 
  tipoPassword: 'password' | 'text' = 'password';

  errorRegNombre = false;
  errorRegApellido = false;
  errorRegCorreo = false;
  errorRegPass = false;

  // Errores de login
  errorLoginCorreo = false;
  errorLoginPass = false;
  errorLoginMensaje = '';
  mostrarAyudaPassword = false;

  minusculaRegex = /[a-z]/;
  mayusculaRegex = /[A-Z]/;
  numeroRegex = /[0-9]/;
  especialRegex = /[!@#$&*.,\-_]/;

  passMinusculaValida = false;
  passMayusculaValida = false;
  passNumeroValida = false;
  passEspecialValida = false;
  passLongitudValida = false;
  errorRegPassMensaje = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router,
    private location: Location,
    public loadingService: LoadingService
  ) {
    if (this.authService.estaLogueado()) {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnInit(): void {
    // Si el usuario presiona atrás estando en registro, volvemos al login
    window.addEventListener('popstate', this.onPopState);
  }

  ngOnDestroy(): void {
    window.removeEventListener('popstate', this.onPopState);
  }

  private onPopState = () => {
    if (this.modoAuth === 'registro') {
      this.cambiarModoAuth('login');
      history.pushState(null, '', window.location.href);
    } else if (this.modoAuth === 'login') {
      history.pushState(null, '', window.location.href);
    }
  };

  validarContrasenaEnTiempoReal(pass: string) {
    this.passRegistro = pass;
    this.passMinusculaValida = this.minusculaRegex.test(pass);
    this.passMayusculaValida = this.mayusculaRegex.test(pass);
    this.passNumeroValida = this.numeroRegex.test(pass);
    this.passEspecialValida = this.especialRegex.test(pass);
    this.passLongitudValida = pass.length >= 8;
    this.cdr.detectChanges();
  }

  cambiarModoAuth(modo: 'login' | 'registro') {
    this.modoAuth = modo;
    this.rolRegistro = ''; // <-- Limpiamos el rol al cambiar de pantalla
    this.nombreRegistro = '';
    this.apellidoRegistro = '';
    this.correoRegistro = '';
    this.passRegistro = '';
    this.errorRegNombre = false;
    this.errorRegApellido = false;
    this.errorRegCorreo = false;
    this.errorRegPass = false;
    
    this.passMinusculaValida = false;
    this.passMayusculaValida = false;
    this.passNumeroValida = false;
    this.passEspecialValida = false;
    this.passLongitudValida = false;
  }

  // Ya no recibimos el token por parámetro, es mucho más seguro
  crearCuenta() {
    let formularioValido = true;

    this.errorRegNombre = !this.nombreRegistro.trim();
    this.errorRegApellido = !this.apellidoRegistro.trim();

    const prefijoRegex = /^[^\s@]+$/;
    this.errorRegCorreo = !this.correoRegistro.trim() || !prefijoRegex.test(this.correoRegistro);

    if (!this.passRegistro.trim()) {
      this.errorRegPass = true;
      this.errorRegPassMensaje = '*La contraseña es obligatoria.';
      formularioValido = false;
    } else if (!(this.passMinusculaValida && this.passMayusculaValida && this.passNumeroValida && this.passEspecialValida && this.passLongitudValida)) {
      this.errorRegPass = true;
      this.errorRegPassMensaje = '*La contraseña no cumple con los requisitos de seguridad establecidos.';
      formularioValido = false;
    } else {
      this.errorRegPass = false;
    }

    if (this.errorRegNombre || this.errorRegApellido || this.errorRegCorreo || this.errorRegPass) {
      formularioValido = false;
    }

    if (!formularioValido) {
      this.cdr.detectChanges();
      return;
    }
    
    const nuevoUsuario = {
      nombre:   this.toTitleCase(this.nombreRegistro),
      apellido: this.toTitleCase(this.apellidoRegistro),
      correo:   this.correoRegistro.toLowerCase() + '@unimagdalena.edu.co',
      password: this.passRegistro,
      rol:      'ESTUDIANTE'
    };

    this.authService.register(nuevoUsuario).subscribe({
      next: (respuesta) => {
        this.authService.guardarToken(respuesta.token, nuevoUsuario.rol);
        this.authService.inicializarSesion({
          nombre:   this.nombreRegistro,
          apellido: this.apellidoRegistro,
          correo:   respuesta.correo ?? (this.correoRegistro + '@unimagdalena.edu.co'),
          rol:      'ESTUDIANTE'
        });
        this.iniciarSesion(true);
      },
      error: (err) => {
        alert('Ocurrió un error al crear la cuenta. Verifica que los datos sean correctos.');
        console.error(err);
      }
    });
  }

  private toTitleCase(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  }

  alternarPassword() {
    this.tipoPassword = this.tipoPassword === 'password' ? 'text' : 'password';
  }

  iniciarSesion(desdeRegistro = false) {
    if (desdeRegistro) {
      this.router.navigate(['/dashboard']); 
    } else {
      // Validación previa antes de llamar al backend
      this.errorLoginCorreo = !this.correoLogin.trim();
      this.errorLoginPass = !this.passLogin.trim();
      if (this.errorLoginCorreo || this.errorLoginPass) {
        this.cdr.detectChanges();
        return;
      }

      const credenciales = {
        correo: this.correoLogin.toLowerCase() + '@unimagdalena.edu.co',
        password: this.passLogin
      };

      this.authService.login(credenciales).subscribe({
        next: (respuesta) => {
          this.authService.guardarToken(respuesta.token, respuesta.rol);
          // El servicio centralizado maneja todo el estado y el localStorage
          this.authService.inicializarSesion(respuesta);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorLoginMensaje = 'Correo o contraseña incorrectos. Verifica tus datos.';
          this.errorLoginCorreo = true;
          this.errorLoginPass = true;
          this.cdr.detectChanges();
          console.error(err);
        }
      });
    }
  }
}