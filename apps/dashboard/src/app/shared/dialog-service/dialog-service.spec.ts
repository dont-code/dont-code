import { TestBed } from '@angular/core/testing';

import { UserDialogService } from './user-dialog.service';

describe('DialogService', () => {
  let service: UserDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserDialogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
