import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortName',
  standalone: true
})
export class ShortNamePipe implements PipeTransform {
  transform(value: string): string {
    if (!value?.trim()) return '';
    return value.trim().split(' ').filter(w => w.length > 0)[0];
  }
}