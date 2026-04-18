import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfViewerModal } from './pdf-viewer-modal';

describe('PdfViewerModal', () => {
  let component: PdfViewerModal;
  let fixture: ComponentFixture<PdfViewerModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfViewerModal],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfViewerModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
