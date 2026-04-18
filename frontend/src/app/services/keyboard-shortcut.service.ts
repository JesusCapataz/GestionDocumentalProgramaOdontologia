import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutService {
  
  private undoSubject = new Subject<void>();
  undoAction$ = this.undoSubject.asObservable();

  private shortcutsSubject = new Subject<void>();
  shortcutsHelp$ = this.shortcutsSubject.asObservable();

  constructor(private ngZone: NgZone) {
    this.iniciarEscuchaGlobal();
  }

  private iniciarEscuchaGlobal() {
    // Lo ejecutamos fuera de Angular para optimizar memoria
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('keydown', (event: KeyboardEvent) => {
        
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          this.ngZone.run(() => { this.undoSubject.next(); });
        }
        if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const tag = (document.activeElement?.tagName || '').toLowerCase();
          if (!['input', 'textarea', 'select'].includes(tag)) {
            event.preventDefault();
            this.ngZone.run(() => { this.shortcutsSubject.next(); });
          }
        }
      });
    });
  }
}