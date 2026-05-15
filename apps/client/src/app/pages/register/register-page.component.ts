import { TokenStorageService } from '@ghostfolio/client/services/token-storage.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { InfoItem, LineChartItem } from '@ghostfolio/common/interfaces';
import { hasPermission, permissions } from '@ghostfolio/common/permissions';
import { GfLogoComponent } from '@ghostfolio/ui/logo';
import { DataService } from '@ghostfolio/ui/services';

import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  OnInit
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DeviceDetectorService } from 'ngx-device-detector';

import { UserAccountRegistrationDialogParams } from './user-account-registration-dialog/interfaces/interfaces';
import { GfUserAccountRegistrationDialogComponent } from './user-account-registration-dialog/user-account-registration-dialog.component';

@Component({
  host: { class: 'page' },
  imports: [FormsModule, GfLogoComponent, MatButtonModule, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-register-page',
  styleUrls: ['./register-page.scss'],
  templateUrl: './register-page.html'
})
export class GfRegisterPageComponent implements OnInit {
  public deviceType: string;
  public hasPermissionForAuthGoogle: boolean;
  public hasPermissionForAuthToken: boolean;
  public hasPermissionForSubscription: boolean;
  public hasPermissionToCreateUser: boolean;
  public localPassword = "";
  public localUsername = "";
  public historicalDataItems: LineChartItem[];
  public info: InfoItem;

  public constructor(
    private dataService: DataService,
    private destroyRef: DestroyRef,
    private deviceDetectorService: DeviceDetectorService,
    private dialog: MatDialog,
    private router: Router,
    private tokenStorageService: TokenStorageService,
    private userService: UserService
  ) {
    this.info = this.dataService.fetchInfo();

    this.userService.signOut();
  }

  public ngOnInit() {
    const { globalPermissions } = this.dataService.fetchInfo();

    this.deviceType = this.deviceDetectorService.getDeviceInfo().deviceType;

    this.hasPermissionForAuthGoogle = hasPermission(
      globalPermissions,
      permissions.enableAuthGoogle
    );

    this.hasPermissionForAuthToken = hasPermission(
      globalPermissions,
      permissions.enableAuthToken
    );

    this.hasPermissionForSubscription = hasPermission(
      globalPermissions,
      permissions.enableSubscription
    );

    this.hasPermissionToCreateUser = hasPermission(
      globalPermissions,
      permissions.createUserAccount
    );
  }


  public loginLocal() {
    this.dataService
      .loginLocal({ password: this.localPassword, username: this.localUsername })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ authToken }) => {
        if (authToken) {
          this.tokenStorageService.saveToken(authToken, true);
          this.router.navigate(['/']);
        }
      });
  }

  public registerLocal() {
    this.dataService
      .registerLocal({ password: this.localPassword, username: this.localUsername })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ authToken }) => {
        if (authToken) {
          this.tokenStorageService.saveToken(authToken, true);
          this.router.navigate(['/']);
        }
      });
  }

  public openShowAccessTokenDialog() {
    const dialogRef = this.dialog.open<
      GfUserAccountRegistrationDialogComponent,
      UserAccountRegistrationDialogParams
    >(GfUserAccountRegistrationDialogComponent, {
      data: {
        deviceType: this.deviceType,
        needsToAcceptTermsOfService: this.hasPermissionForSubscription
      },
      disableClose: true,
      height: this.deviceType === 'mobile' ? '98vh' : undefined,
      width: this.deviceType === 'mobile' ? '100vw' : '30rem'
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((authToken) => {
        if (authToken) {
          this.tokenStorageService.saveToken(authToken, true);

          this.router.navigate(['/']);
        }
      });
  }
}
