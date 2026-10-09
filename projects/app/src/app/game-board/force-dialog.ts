import { ComponentType } from '@angular/cdk/portal';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { Force } from '../labels';

// Opens a decision dialog themed in the deciding seat's force colour. The panel
// gets `force-dialog` plus `force-dialog-<force>`; styles.scss turns those into
// --force and the dialog accents. A hidden or force-less seat is yellow, like
// its tile.
export function openForceDialog<C, D = unknown, R = unknown>(
  dialog: MatDialog,
  component: ComponentType<C>,
  force: Force,
  config: MatDialogConfig<D>
): MatDialogRef<C, R> {
  return dialog.open<C, D, R>(component, { ...config, panelClass: ['force-dialog', `force-dialog-${force}`] });
}
