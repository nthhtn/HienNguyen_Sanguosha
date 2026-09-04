import type { ContentRegistry } from 'engine';
import { shaCard } from './cards/sha';
import { shanCard } from './cards/shan';
import { peachCard } from './cards/peach';
import { duelCard } from './cards/duel';
import { wuxieCard } from './cards/wuxie';
import { silverLionCard, greenDragonBladeCard } from './cards/equipment';
import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './generals/setOne';
import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './generals/setTwo';

export function buildContentRegistry(): ContentRegistry {
  const cards = [shaCard, shanCard, peachCard, duelCard, wuxieCard, silverLionCard, greenDragonBladeCard];
  const generals = [
    xiahouDunGeneral,
    sunShangxiangGeneral,
    zhugeLiangGeneral,
    dongZhuoGeneral,
    zhaoYunGeneral,
    huangYueyingGeneral,
  ];
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}
