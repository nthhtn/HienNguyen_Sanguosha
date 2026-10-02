import axeEquipmentWeapon from './equipment/weapon/axe.json';
import barbariansTrick from './trick/barbarians.json';
import blackPommelEquipmentWeapon from './equipment/weapon/black-pommel.json';
import breakTrick from './trick/break.json';
import captureTrick from './trick/capture.json';
import coerceTrick from './trick/coerce.json';
import crossbowEquipmentWeapon from './equipment/weapon/crossbow.json';
import daYuanEquipmentHorse from './equipment/horse/da-yuan.json';
import diLuEquipmentHorse from './equipment/horse/di-lu.json';
import drawTwoTrick from './trick/draw-two.json';
import duelTrick from './trick/duel.json';
import eightTrigramsEquipmentArmor from './equipment/armor/eight-trigrams.json';
import genderSwordsEquipmentWeapon from './equipment/weapon/gender-swords.json';
import greenDragonBladeEquipmentWeapon from './equipment/weapon/green-dragon-blade.json';
import hailOfArrowsTrick from './trick/hail-of-arrows.json';
import harvestTrick from './trick/harvest.json';
import lightningTrick from './trick/lightning.json';
import longbowEquipmentWeapon from './equipment/weapon/longbow.json';
import peachBasic from './basic/peach.json';
import peachGardenTrick from './trick/peach-garden.json';
import redHareEquipmentHorse from './equipment/horse/red-hare.json';
import serpentSpearEquipmentWeapon from './equipment/weapon/serpent-spear.json';
import shaBasic from './basic/sha.json';
import shadowRunnerEquipmentHorse from './equipment/horse/shadow-runner.json';
import shanBasic from './basic/shan.json';
import skyScorcherEquipmentWeapon from './equipment/weapon/sky-scorcher.json';
import stealTrick from './trick/steal.json';
import stormRunnerEquipmentHorse from './equipment/horse/storm-runner.json';
import wineBasic from './basic/wine.json';
import wuxieTrick from './trick/wuxie.json';
import ziXingEquipmentHorse from './equipment/horse/zi-xing.json';

export interface CardPrinting {
  suit: 'spade' | 'heart' | 'club' | 'diamond';
  rank: number;
}

export interface CardFileData {
  name: string;
  nameZh?: string;
  text?: string;
  range?: number;
  printings?: CardPrinting[];
  count?: number;
  mount?: 'plus' | 'minus'; // horses only: the printed +1 / -1 on the card art
  delayed?: true; // tools only: a delayed ("Delay Tool") card
  source: { url: string; site: string; crawledAt: string; expansion?: string; mountFrom?: string };
}

export interface CardData extends CardFileData {
  category: 'basic' | 'trick' | 'equipment';
  subtype?: 'weapon' | 'armor' | 'horse' | 'treasure';
}

export const cardsData: Record<string, CardData> = {
  'axe': { ...(axeEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'barbarians': { ...(barbariansTrick as CardFileData), category: 'trick' },
  'black-pommel': { ...(blackPommelEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'break': { ...(breakTrick as CardFileData), category: 'trick' },
  'capture': { ...(captureTrick as CardFileData), category: 'trick' },
  'coerce': { ...(coerceTrick as CardFileData), category: 'trick' },
  'crossbow': { ...(crossbowEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'da-yuan': { ...(daYuanEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'di-lu': { ...(diLuEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'draw-two': { ...(drawTwoTrick as CardFileData), category: 'trick' },
  'duel': { ...(duelTrick as CardFileData), category: 'trick' },
  'eight-trigrams': { ...(eightTrigramsEquipmentArmor as CardFileData), category: 'equipment', subtype: 'armor' },
  'gender-swords': { ...(genderSwordsEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'green-dragon-blade': { ...(greenDragonBladeEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'hail-of-arrows': { ...(hailOfArrowsTrick as CardFileData), category: 'trick' },
  'harvest': { ...(harvestTrick as CardFileData), category: 'trick' },
  'lightning': { ...(lightningTrick as CardFileData), category: 'trick' },
  'longbow': { ...(longbowEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'peach': { ...(peachBasic as CardFileData), category: 'basic' },
  'peach-garden': { ...(peachGardenTrick as CardFileData), category: 'trick' },
  'red-hare': { ...(redHareEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'serpent-spear': { ...(serpentSpearEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'sha': { ...(shaBasic as CardFileData), category: 'basic' },
  'shadow-runner': { ...(shadowRunnerEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'shan': { ...(shanBasic as CardFileData), category: 'basic' },
  'sky-scorcher': { ...(skyScorcherEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'steal': { ...(stealTrick as CardFileData), category: 'trick' },
  'storm-runner': { ...(stormRunnerEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'wine': { ...(wineBasic as CardFileData), category: 'basic' },
  'wuxie': { ...(wuxieTrick as CardFileData), category: 'trick' },
  'zi-xing': { ...(ziXingEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
};
