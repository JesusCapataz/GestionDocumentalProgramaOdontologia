import { Injectable } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

export interface CanComponentDeactivate {
  canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthNavigationGuard {
  canDeactivate(
    component: CanComponentDeactivate
  ): Observable<boolean> | Promise<boolean> | boolean {
    if (component && component.canDeactivate) {
      return component.canDeactivate();
    }
    return true;
  }
}

export const authNavigationGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  if (component && component.canDeactivate) {
    return component.canDeactivate();
  }
  return true;
};