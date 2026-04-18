import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MetricsCards } from './metrics-cards';

describe('MetricsCards', () => {
  let component: MetricsCards;
  let fixture: ComponentFixture<MetricsCards>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetricsCards],
    }).compileComponents();

    fixture = TestBed.createComponent(MetricsCards);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
