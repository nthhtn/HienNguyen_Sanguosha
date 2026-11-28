import { generalDisplayData, kingdomWarsGeneralId } from 'content';
import { I18n } from './i18n/i18n.service';
import { generalDisplayName } from './labels';

// A General's name on the art set screens, by its base id. Nine Generals exist only in Kingdom Wars and have no Identity
// data, so their own Kingdom Wars name (translated) is the fallback before the id in Title Case.
export function artGeneralName(baseId: string, i18n: I18n): string {
  return generalDisplayData(baseId, i18n.locale())?.name ?? generalDisplayName(kingdomWarsGeneralId(baseId), i18n.translator);
}
