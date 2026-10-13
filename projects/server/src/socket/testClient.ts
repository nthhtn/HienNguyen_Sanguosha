import { WebSocket } from 'ws';
import { ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';
import type { ContentRegistry, EngineEvent, GameState } from 'engine';
import type { GameUpdate } from 'protocol';
import type { ServerMessage } from 'protocol';

type MessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

// A socket client for end-to-end tests. It keeps every message, and `next`
// waits for the next one of a type that this client hasn't handed out yet.
export class TestClient {
  readonly received: ServerMessage[] = [];
  private readonly handedOut = new Set<number>();
  private listeners: (() => void)[] = [];
  private readonly messageListeners: ((message: ServerMessage) => void)[] = [];
  private closeCode: number | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.received.push(message);
      for (const listener of this.messageListeners) listener(message);
      this.notify();
    });
    ws.on('close', (code) => {
      this.closeCode = code;
      this.notify();
    });
  }

  static open(url: string, options: { origin: string; token?: string; autoPong?: boolean }): Promise<TestClient> {
    const ws = new WebSocket(url, {
      headers: { origin: options.origin, ...(options.token ? { cookie: `sgs_session=${options.token}` } : {}) },
      autoPong: options.autoPong ?? true,
    });
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve(new TestClient(ws)));
      ws.once('error', reject);
    });
  }

  // Called with every message as it arrives, before any `next` sees it.
  onMessage(listener: (message: ServerMessage) => void): void {
    this.messageListeners.push(listener);
  }

  send(message: object | string): void {
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  sendBinary(bytes: Uint8Array): void {
    this.ws.send(bytes, { binary: true });
  }

  // The next message of `type` (that also passes `match`, when given).
  next<T extends ServerMessage['type']>(type: T, match: (message: MessageOf<T>) => boolean = () => true, timeoutMs = 2000): Promise<MessageOf<T>> {
    return this.waitFor(() => {
      const index = this.received.findIndex((m, i) => m.type === type && !this.handedOut.has(i) && match(m as MessageOf<T>));
      if (index === -1) return undefined;
      this.handedOut.add(index);
      return this.received[index] as MessageOf<T>;
    }, `a ${type} message`, timeoutMs);
  }

  closed(timeoutMs = 2000): Promise<number> {
    return this.waitFor(() => this.closeCode ?? undefined, 'the socket to close', timeoutMs);
  }

  close(): void {
    this.ws.close();
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  private waitFor<T>(find: () => T | undefined, what: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = find();
        if (found === undefined) return false;
        clearTimeout(timer);
        this.listeners = this.listeners.filter((l) => l !== listener);
        resolve(found);
        return true;
      };
      const listener = () => void check();
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        reject(new Error(`Timed out waiting for ${what}; received ${JSON.stringify(this.received.map((m) => m.type))}`));
      }, timeoutMs);
      if (!check()) this.listeners.push(listener);
    });
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

// The HTTP status of a refused upgrade.
export function refusedStatus(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once('unexpected-response', (_request, response) => {
      resolve(response.statusCode ?? 0);
      ws.terminate();
    });
    ws.once('open', () => reject(new Error('The upgrade was accepted')));
    ws.once('error', () => undefined);
  });
}

// Plays a seat over the socket the way a person's client would (spec
// "Testing": bots acting as humans). It keeps the log from each update's
// events, asks for game.resync when one is missing, and answers each update
// that offers it moves with the rule-based bot's pick.
export class BotSeat {
  resyncs = 0;
  lastUpdate: GameUpdate | null = null;
  private log: EngineEvent[] = [];
  private memory: BotTurnMemory | null = null;
  private answered: string | null = null;
  private nextReqId = 1;

  constructor(
    private readonly client: TestClient,
    private readonly registry: ContentRegistry
  ) {
    client.onMessage((message) => this.receive(message));
  }

  private receive(message: ServerMessage): void {
    const game = message.type === 'welcome' || message.type === 'game.update' ? message.game : null;
    if (!game) return;
    if (game.logFrom === 0) this.log = [];
    if (game.logFrom !== this.log.length) {
      this.resyncs += 1;
      this.client.send({ type: 'game.resync' });
      return;
    }
    this.log = [...this.log, ...game.events];
    this.lastUpdate = game;
    // One answer per state: a repeated update (a clock change) gets none.
    const key = `${game.gameId}:${game.seq}`;
    if (game.legalActions.length === 0 || this.answered === key) return;
    this.answered = key;
    const view = { ...game.view, log: this.log, rng: { seed: 0, counter: 0 } } as GameState;
    const seatId = game.legalActions[0].seatId;
    const decision = ruleBasedPolicy.decide(view, seatId, game.legalActions, this.registry, this.memory);
    this.memory = decision.memory;
    this.client.send({ type: 'game.submit', reqId: `bot-${this.nextReqId++}`, gameId: game.gameId, baseSeq: game.seq, actions: [decision.action] });
  }
}
