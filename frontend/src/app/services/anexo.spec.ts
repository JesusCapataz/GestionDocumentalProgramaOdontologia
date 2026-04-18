import { TestBed } from '@angular/core/testing';

import { Anexo } from './anexo';

describe('Anexo', () => {
  let service: Anexo;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Anexo);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
