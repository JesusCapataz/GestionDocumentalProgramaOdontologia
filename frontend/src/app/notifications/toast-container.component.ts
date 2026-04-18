import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from './notification.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(18px) scale(0.97)' }),
        animate('280ms cubic-bezier(0.34,1.56,0.64,1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in',
          style({ opacity: 0, transform: 'translateX(-18px) scale(0.97)' }))
      ])
    ])
  ],
  template: `<div class="toast-container">
<div *ngFor="let toast of svc.toasts(); trackBy: trackById" class="toast toast--{{ toast.type }}">        <div class="toast-stripe"></div>
        <div class="toast-body">
          <div class="toast-icon-wrap">
            <ng-container *ngIf="toast.type === 'success'">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </ng-container>
            <ng-container *ngIf="toast.type === 'download' && toast.downloadPhase === 'downloading'">
              <svg class="icon spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <circle cx="12" cy="12" r="9" stroke-opacity=".25"/>
                <path d="M21 12a9 9 0 0 1-9 9"/>
              </svg>
            </ng-container>
            <ng-container *ngIf="toast.type === 'download' && toast.downloadPhase === 'done'">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </ng-container>
            <ng-container *ngIf="toast.type === 'delete'">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </ng-container>
            <ng-container *ngIf="toast.type === 'warning'">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </ng-container>
          </div>
          <div class="toast-text">
            <span class="toast-message">{{ toast.message }}</span>
            <button *ngIf="toast.type === 'delete'" class="toast-undo" (click)="svc.undoDelete(toast.id)">
              Deshacer
            </button>
          </div>
          <button class="toast-close" (click)="svc.remove(toast.id)" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div *ngIf="toast.type === 'delete'" class="toast-progress-track">
          <div class="toast-progress-bar" [style.width.%]="toast.progressPct"></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./toast-container.component.css']
})
export class ToastContainerComponent {
  readonly svc = inject(NotificationService);
  trackById(index: number, toast: any) { return toast.id; }
}