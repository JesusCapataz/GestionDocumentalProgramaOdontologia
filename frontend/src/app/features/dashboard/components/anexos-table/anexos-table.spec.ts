import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnexosTable } from './anexos-table';

describe('AnexosTable', () => {
  let component: AnexosTable;
  let fixture: ComponentFixture<AnexosTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnexosTable],
    }).compileComponents();

    fixture = TestBed.createComponent(AnexosTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
