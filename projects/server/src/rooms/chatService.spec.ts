import { CHAT_BODY_MAX, CHAT_HISTORY, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS } from 'protocol';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { ChatService } from './chatService';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const GRINNING = String.fromCodePoint(0x1f600);
const code = (value: string) => expect.objectContaining({ code: value });

async function setup() {
  const repos = createMemoryRepositories();
  let now = T0;
  const chat = new ChatService(repos, () => now);
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: new Date(now) });
  const member = (name: string) => repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'human', displayName: name, now: new Date(now) });
  const ann = await member('Ann');
  const bo = await member('Bo');
  const as = (player: { id: string }, gameId: string | null = null, afterSeq: number | null = null) => ({ roomId: room.id, playerId: player.id, gameId, afterSeq });
  const advance = (ms: number) => {
    now += ms;
  };
  return { repos, chat, room, ann, bo, as, advance };
}

describe('ChatService', () => {
  it('stores a message and returns it as the wire shape, with the sender name and the time', async () => {
    const { chat, ann, as } = await setup();
    const message = await chat.send(as(ann), 'hello');
    expect(message).toEqual({ id: expect.any(Number), from: { playerId: ann.id, name: 'Ann' }, body: 'hello', at: T0 });
  });

  it('normalizes the body: trims, and turns newlines and runs of spaces into one space (Review Focus 1)', async () => {
    const { chat, ann, as } = await setup();
    expect((await chat.send(as(ann), '  hello \n\n  there  ')).body).toBe('hello there');
  });

  it('refuses a message with nothing in it (Review Focus 1)', async () => {
    const { chat, ann, as, repos, room } = await setup();
    await expect(chat.send(as(ann), '')).rejects.toEqual(code('chat_empty'));
    await expect(chat.send(as(ann), ' \n\t ')).rejects.toEqual(code('chat_empty'));
    expect(await repos.chat.listRecent(room.id, 10)).toEqual([]);
  });

  it('accepts exactly 300 characters and refuses 301, counting an emoji once (Review Focus 1)', async () => {
    const { chat, ann, bo, as, advance } = await setup();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX))).resolves.toBeDefined();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX + 1))).rejects.toEqual(code('chat_too_long'));
    advance(CHAT_RATE_WINDOW_MS);
    await expect(chat.send(as(bo), GRINNING.repeat(CHAT_BODY_MAX))).resolves.toBeDefined();
    await expect(chat.send(as(bo), GRINNING.repeat(CHAT_BODY_MAX + 1))).rejects.toEqual(code('chat_too_long'));
  });

  it('refuses the sixth message inside the window, and the window frees after it (Review Focus 2)', async () => {
    const { chat, ann, as, advance } = await setup();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    await expect(chat.send(as(ann), 'too many')).rejects.toEqual(code('chat_rate_limited'));
    advance(CHAT_RATE_WINDOW_MS - 1);
    await expect(chat.send(as(ann), 'still too many')).rejects.toEqual(code('chat_rate_limited'));
    advance(1);
    await expect(chat.send(as(ann), 'now fine')).resolves.toBeDefined();
  });

  it("limits each member on their own, and doesn't count or store refused messages (Review Focus 2)", async () => {
    const { chat, ann, bo, as, repos, room } = await setup();
    await expect(chat.send(as(ann), '')).rejects.toBeDefined();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX + 1))).rejects.toBeDefined();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    await expect(chat.send(as(ann), 'one too many')).rejects.toEqual(code('chat_rate_limited'));
    await expect(chat.send(as(bo), 'my turn')).resolves.toBeDefined();
    expect((await repos.chat.listRecent(room.id, 100)).map((m) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'my turn']);
  });

  it('stores the game a message followed and how many actions it had', async () => {
    const { chat, ann, as, repos, room } = await setup();
    const game = await repos.games.create({ roomId: room.id, seed: 1, seats: [], rules: {}, buildId: 'b', now: new Date(T0) });
    await chat.send(as(ann), 'lobby');
    await chat.send(as(ann, game.id, 7), 'in game');
    const [lobby, inGame] = await repos.chat.listRecent(room.id, 10);
    expect([lobby.gameId, lobby.afterSeq]).toEqual([null, null]);
    expect([inGame.gameId, inGame.afterSeq]).toEqual([game.id, 7]);
  });

  it('returns the last 100 messages, oldest first', async () => {
    const { chat, ann, as, advance, room } = await setup();
    for (let i = 1; i <= CHAT_HISTORY + 5; i += 1) {
      await chat.send(as(ann), `m${i}`);
      advance(CHAT_RATE_WINDOW_MS + 1);
    }
    const recent = await chat.recent(room.id);
    expect(recent).toHaveLength(CHAT_HISTORY);
    expect(recent[0].body).toBe('m6');
    expect(recent.at(-1)!.body).toBe(`m${CHAT_HISTORY + 5}`);
  });

  it('forgets the rate window of members who left', async () => {
    const { chat, ann, as } = await setup();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    chat.forget([ann.id]);
    await expect(chat.send(as(ann), 'fresh start')).resolves.toBeDefined();
  });
});
