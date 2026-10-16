import type { RoomListItem } from 'protocol';
import { englishTranslator, type Translator } from '../i18n/translator';

// The status column of the Rooms list.
export function roomStatusLabel(room: RoomListItem, tr: Translator = englishTranslator): string {
  if (room.status === 'playing') return tr('rooms.status.playing');
  return room.memberCount >= room.capacity ? tr('rooms.status.full') : tr('rooms.status.waiting');
}

// Whether to enable Join. The server decides for real when asked.
export function canJoin(room: RoomListItem): boolean {
  return room.status === 'lobby' && room.memberCount < room.capacity;
}

// The name column of the Rooms list: the host, or Play vs Bots for your solo room.
export function roomTitle(room: RoomListItem, tr: Translator = englishTranslator): string {
  return room.visibility === 'solo' ? tr('setup.mode.bots') : (room.hostName ?? tr('rooms.defaultTitle'));
}
