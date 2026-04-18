import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { IaFormatPipe } from '../../../../shared/pipes/ia-format.pipe';

interface Resultado {
  id: number;
  nombre: string;
  razon: string;
}

interface Mensaje {
  tipo: 'ia' | 'usuario';
  texto: string;
  hora: string;
  resultados?: Resultado[];
  esError?: boolean;
}

@Component({
  selector: 'app-ai-chat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IaFormatPipe],
  templateUrl: './ai-chat-modal.html',
  styleUrl: './ai-chat-modal.css'
})
export class AiChatModalComponent implements OnInit {
  chatAbierto = false;
  chatExpandido = false;
  mensajes: Mensaje[] = [];
  inputUsuario = '';
  cargando = false;
  nombreUsuario = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const nombre = localStorage.getItem('nombreUsuarioActivo') || 'Usuario';
    this.nombreUsuario = nombre.split(' ')[0];
    this.mensajes = [{
      tipo: 'ia',
      texto: `Hola ${this.nombreUsuario}, ¿en qué te puedo ayudar con los anexos del Programa de Odontología hoy?`,
      hora: this.horaActual()
    }];
  }

  toggleChat(): void {
    this.chatAbierto = !this.chatAbierto;
    if (this.chatAbierto) {
      setTimeout(() => this.scrollAlFinal(), 100);
    }
  }

  toggleExpandir(): void {
    this.chatExpandido = !this.chatExpandido;
    setTimeout(() => this.scrollAlFinal(), 150);
  }

  enviarMensaje(): void {
    const texto = this.inputUsuario.trim();
    if (!texto || this.cargando) return;

    this.mensajes.push({ tipo: 'usuario', texto, hora: this.horaActual() });
    this.inputUsuario = '';
    this.cargando = true;
    setTimeout(() => this.scrollAlFinal(), 50);

    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.post<{ respuesta?: string; error?: string }>(
      'https://backend-odontologia-unimag-eaafcdazebfjc0fm.centralus-01.azurewebsites.net/api/ia/consultar',
      { pregunta: texto },
      { headers }
    ).subscribe({
      next: (res) => {
        this.cargando = false;
        const texto = res.respuesta ?? 'No obtuve respuesta. Intenta de nuevo.';
        const resultados = this.parsearResultados(texto);
        const lineas = texto.split('\n');
        const textoLimpio = lineas
          .filter(l => !l.trim().startsWith('RESULTADO:'))
          .join('\n')
          .trim();
        this.mensajes.push({
          tipo: 'ia',
          texto: textoLimpio,
          hora: this.horaActual(),
          resultados: resultados.length > 0 ? resultados : undefined
        });
        this.cdr.detectChanges();
        setTimeout(() => this.scrollAlFinal(), 50);
      },
      error: (err) => {
        this.cargando = false;
        const status = err?.status as number;
        const mensajeBackend: string | undefined = err?.error?.error;
        const waitMinutes: string | undefined = err?.error?.waitMinutes;

        let textoError: string;
        let esError = false;

        if (status === 429) {
          esError = true;
          textoError = mensajeBackend
            ? `⏳ ${mensajeBackend}`
            : '⏳ Has alcanzado el límite de consultas. Espera unos minutos e intenta de nuevo.';
        } else if (status === 503) {
          esError = true;
          textoError = mensajeBackend ?? '🔧 Los servidores de IA están saturados en este momento. Por favor intenta de nuevo en unos minutos.';
        } else if (status >= 500) {
          esError = true;
          textoError = mensajeBackend ?? '⚠️ Ocurrió un error interno. Por favor intenta de nuevo.';
        } else {
          textoError = mensajeBackend ?? 'Ocurrió un error al consultar la IA. Verifica tu conexión.';
        }

        this.mensajes.push({
          tipo: 'ia',
          texto: textoError,
          hora: this.horaActual(),
          esError
        });
        this.cdr.detectChanges();
        setTimeout(() => this.scrollAlFinal(), 50);
      }
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviarMensaje();
    }
  }

  parsearResultados(texto: string): Resultado[] {
    const regex = /RESULTADO:(\d+)\|([^|]+)\|([^\n]+)/g;
    const resultados: Resultado[] = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
      resultados.push({
        id: parseInt(match[1]),
        nombre: match[2].trim(),
        razon: match[3].trim()
      });
    }
    return resultados;
  }

  abrirPreview(id: number): void {
    // Emitimos evento al dashboard para abrir el preview
    const event = new CustomEvent('ia-preview', { detail: { id } });
    window.dispatchEvent(event);
  }

  descargarDesdeChat(id: number, mouseEvent: MouseEvent): void {
    mouseEvent.stopPropagation();
    const event = new CustomEvent('ia-descargar', { detail: { id } });
    window.dispatchEvent(event);
  }

  private horaActual(): string {
    return new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollAlFinal(): void {
    const el = document.getElementById('chatMessages');
    if (el) el.scrollTop = el.scrollHeight;
  }
}