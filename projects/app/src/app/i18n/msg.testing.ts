import { resolveMsg, type Msg } from './msg';
import { englishTranslator } from './translator';

// What a screen would show for a service's message, in English, for specs.
export const english = (message: Msg | null): string | null => (message ? resolveMsg(message, englishTranslator) : null);
