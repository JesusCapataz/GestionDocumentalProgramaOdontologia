import { Injectable, signal, computed, inject } from '@angular/core';
import { KeyboardShortcutService } from '../services/keyboard-shortcut.service'; // Ajusta la ruta si es necesario

export type ToastType = 'success' | 'download' | 'delete' | 'warning';
export type DownloadPhase = 'downloading' | 'done';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  downloadPhase?: DownloadPhase;
  deleteTimer?: ReturnType<typeof setTimeout>;
  deleteInterval?: ReturnType<typeof setInterval>;
  progressPct: number; 
  onCancel?: () => void; // Función para restaurar la tabla
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  
  // ¡Inyectamos el cerebro de atajos!
  private shortcutService = inject(KeyboardShortcutService);

  private _toasts = signal<Toast[]>([]);
  readonly toasts = computed(() => this._toasts());

 constructor() {
    // 🎧 Nos suscribimos al altavoz del Ctrl+Z
    this.shortcutService.undoAction$.subscribe(() => {
      console.log('🔊 2. El servicio de notificaciones escuchó el Ctrl+Z');
      
      const deleteToast = this._toasts().find(t => t.type === 'delete');
      if (deleteToast) {
        console.log('✅ 3. Notificación encontrada. Restaurando anexo...');
        this.undoDelete(deleteToast.id); 
      } else {
        console.log('❌ 3. Se presionó Ctrl+Z, pero no hay nada eliminándose ahora mismo.');
      }
    });
  }
  // ── helpers ──────────────────────────────────────────────
  private uid(): string {
    return Math.random().toString(36).slice(2, 9);
  }

  private add(toast: Toast): void {
    this._toasts.update(list => [...list, toast]);
  }

  remove(id: string): void {
    const t = this._toasts().find(x => x.id === id);
    if (t?.deleteTimer) clearTimeout(t.deleteTimer);
    if (t?.deleteInterval) clearInterval(t.deleteInterval);
    this._toasts.update(list => list.filter(x => x.id !== id));
  }

  // ── tipos públicos ────────────────────────────────────────
  showSuccess(message = 'Anexo guardado correctamente'): void {
    const id = this.uid();
    this.add({ id, type: 'success', message, progressPct: 100 });
    setTimeout(() => this.remove(id), 3000);
  }

  showDownload(message = 'Descargando anexo...'): string {
    const id = this.uid();
    this.add({ id, type: 'download', message, downloadPhase: 'downloading', progressPct: 100 });
    return id; 
  }

  completeDownload(id: string): void {
    this._toasts.update(list =>
      list.map(t => t.id === id
        ? { ...t, message: 'Anexo descargado', downloadPhase: 'done' as DownloadPhase }
        : t
      )
    );
    setTimeout(() => this.remove(id), 2500);
  }

  // El showDelete ahora recibe el onCancel para saber cómo restaurar
  showDelete(message = 'Anexo eliminado. Deshacer (Ctrl+Z)', onConfirm?: () => void, onCancel?: () => void): string {
    const id = this.uid();
    const DURATION = 10_000;
    const TICK = 100;

    const interval = setInterval(() => {
      this._toasts.update(list =>
        list.map(t => {
          if (t.id !== id) return t;
          const next = t.progressPct - (100 / (DURATION / TICK));
          return { ...t, progressPct: Math.max(0, next) };
        })
      );
    }, TICK);

    const timer = setTimeout(() => {
      clearInterval(interval);
      this.remove(id);
      onConfirm?.(); // dispara el borrado real en la BD
    }, DURATION);

    this.add({
      id, type: 'delete',
      message,
      progressPct: 100,
      deleteTimer: timer,
      deleteInterval: interval,
      onCancel // Guardamos la orden de restaurar
    });
    return id;
  }

  undoDelete(id: string): void {
    const t = this._toasts().find(x => x.id === id);
    if (t?.onCancel) {
      t.onCancel(); // 👈 Ejecuta la función que le devuelve el anexo a la tabla
    }
    this.remove(id); // cancela timers + quita la tarjeta
  }

showWarning(message: string): void {
    console.log('🔴 ALERTA ÁMBAR DISPARADA. Mensaje:', message); // 👈 AGREGA ESTA LÍNEA
    const id = this.uid();
    this.add({ id, type: 'warning', message, progressPct: 100 });
    setTimeout(() => this.remove(id), 4000);
  }

}