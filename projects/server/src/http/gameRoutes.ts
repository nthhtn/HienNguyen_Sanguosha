import { GameParamsSchema } from 'protocol/schemas';
import { GameHistory } from '../game/history';
import { RoomError } from '../rooms/errors';
import { registeredOnly } from './guard';
import { TypedApp } from './types';

// What a registered user may read about games that are over (spec "HTTP API").
export function registerGameRoutes(app: TypedApp, deps: { history: GameHistory }): void {
  const { history } = deps;

  app.get('/api/me/games', { onRequest: registeredOnly }, async (request) => history.myGames(request.auth!.user));

  app.get('/api/games/:id/replay', { onRequest: registeredOnly, schema: { params: GameParamsSchema } }, async (request) => {
    const replay = await history.replay(request.auth!.user, request.params.id);
    if (!replay) throw new RoomError('not_found');
    return replay;
  });
}
