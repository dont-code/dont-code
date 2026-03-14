import { TestBed } from '@angular/core/testing';

import { GenerateAppService } from './generate-app-service';

describe('GenerateAppService', () => {
  let service: GenerateAppService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GenerateAppService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
