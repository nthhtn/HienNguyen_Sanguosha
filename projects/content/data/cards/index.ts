import ancientScimitarEquipmentWeapon from './equipment/weapon/ancient-scimitar.json';
import axeEquipmentWeapon from './equipment/weapon/axe.json';
import barbariansTool from './tool/barbarians.json';
import blackPommelEquipmentWeapon from './equipment/weapon/black-pommel.json';
import blackShieldEquipmentArmor from './equipment/armor/black-shield.json';
import blazeTool from './tool/blaze.json';
import breakTool from './tool/break.json';
import captureTool from './tool/capture.json';
import chainsTool from './tool/chains.json';
import coerceTool from './tool/coerce.json';
import crossbowEquipmentWeapon from './equipment/weapon/crossbow.json';
import daYuanEquipmentHorse from './equipment/horse/da-yuan.json';
import diLuEquipmentHorse from './equipment/horse/di-lu.json';
import drawTwoTool from './tool/draw-two.json';
import duelTool from './tool/duel.json';
import eightTrigramsEquipmentArmor from './equipment/armor/eight-trigrams.json';
import fireAttackBasic from './basic/fire-attack.json';
import fireFanEquipmentWeapon from './equipment/weapon/fire-fan.json';
import genderSwordsEquipmentWeapon from './equipment/weapon/gender-swords.json';
import greenDragonBladeEquipmentWeapon from './equipment/weapon/green-dragon-blade.json';
import hailOfArrowsTool from './tool/hail-of-arrows.json';
import harvestTool from './tool/harvest.json';
import huaLiuEquipmentHorse from './equipment/horse/hua-liu.json';
import iceSwordEquipmentWeapon from './equipment/weapon/ice-sword.json';
import lightningAttackBasic from './basic/lightning-attack.json';
import lightningTool from './tool/lightning.json';
import longbowEquipmentWeapon from './equipment/weapon/longbow.json';
import peachBasic from './basic/peach.json';
import peachGardenTool from './tool/peach-garden.json';
import redHareEquipmentHorse from './equipment/horse/red-hare.json';
import serpentSpearEquipmentWeapon from './equipment/weapon/serpent-spear.json';
import shaBasic from './basic/sha.json';
import shadowRunnerEquipmentHorse from './equipment/horse/shadow-runner.json';
import shanBasic from './basic/shan.json';
import silverLionEquipmentArmor from './equipment/armor/silver-lion.json';
import skyScorcherEquipmentWeapon from './equipment/weapon/sky-scorcher.json';
import starvationTool from './tool/starvation.json';
import stealTool from './tool/steal.json';
import stormRunnerEquipmentHorse from './equipment/horse/storm-runner.json';
import wineBasic from './basic/wine.json';
import woodArmorEquipmentArmor from './equipment/armor/wood-armor.json';
import wuxieTool from './tool/wuxie.json';
import ziXingEquipmentHorse from './equipment/horse/zi-xing.json';

export interface CardPrinting {
  suit: 'spade' | 'heart' | 'club' | 'diamond';
  rank: number;
  // Set on an extra copy that another expansion adds (e.g. 'Army', 'EX');
  // absent on the card's own printings.
  expansion?: string;
}

export interface CardFileData {
  name: string;
  nameZh?: string;
  text?: string;
  range?: number;
  printings?: CardPrinting[];
  count?: number;
  mount?: 'defensive' | 'offensive'; // horses only: defensive (+1) or offensive (−1), from the printed sign on the card art
  delayed?: true; // tools only: a delayed ("Delay Tool") card
  source: { url: string; site: string; crawledAt: string; expansion?: string; mountFrom?: string; printingsFrom?: string; nameOnSite?: string; expansionPrintingsFrom?: string };
}

export interface CardData extends CardFileData {
  category: 'basic' | 'tool' | 'equipment';
  subtype?: 'weapon' | 'armor' | 'horse' | 'treasure';
}

export const cardsData: Record<string, CardData> = {
  'ancient-scimitar': { ...(ancientScimitarEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'axe': { ...(axeEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'barbarians': { ...(barbariansTool as CardFileData), category: 'tool' },
  'black-pommel': { ...(blackPommelEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'black-shield': { ...(blackShieldEquipmentArmor as CardFileData), category: 'equipment', subtype: 'armor' },
  'blaze': { ...(blazeTool as CardFileData), category: 'tool' },
  'break': { ...(breakTool as CardFileData), category: 'tool' },
  'capture': { ...(captureTool as CardFileData), category: 'tool' },
  'chains': { ...(chainsTool as CardFileData), category: 'tool' },
  'coerce': { ...(coerceTool as CardFileData), category: 'tool' },
  'crossbow': { ...(crossbowEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'da-yuan': { ...(daYuanEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'di-lu': { ...(diLuEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'draw-two': { ...(drawTwoTool as CardFileData), category: 'tool' },
  'duel': { ...(duelTool as CardFileData), category: 'tool' },
  'eight-trigrams': { ...(eightTrigramsEquipmentArmor as CardFileData), category: 'equipment', subtype: 'armor' },
  'fire-attack': { ...(fireAttackBasic as CardFileData), category: 'basic' },
  'fire-fan': { ...(fireFanEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'gender-swords': { ...(genderSwordsEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'green-dragon-blade': { ...(greenDragonBladeEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'hail-of-arrows': { ...(hailOfArrowsTool as CardFileData), category: 'tool' },
  'harvest': { ...(harvestTool as CardFileData), category: 'tool' },
  'hua-liu': { ...(huaLiuEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'ice-sword': { ...(iceSwordEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'lightning': { ...(lightningTool as CardFileData), category: 'tool' },
  'lightning-attack': { ...(lightningAttackBasic as CardFileData), category: 'basic' },
  'longbow': { ...(longbowEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'peach': { ...(peachBasic as CardFileData), category: 'basic' },
  'peach-garden': { ...(peachGardenTool as CardFileData), category: 'tool' },
  'red-hare': { ...(redHareEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'serpent-spear': { ...(serpentSpearEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'sha': { ...(shaBasic as CardFileData), category: 'basic' },
  'shadow-runner': { ...(shadowRunnerEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'shan': { ...(shanBasic as CardFileData), category: 'basic' },
  'silver-lion': { ...(silverLionEquipmentArmor as CardFileData), category: 'equipment', subtype: 'armor' },
  'sky-scorcher': { ...(skyScorcherEquipmentWeapon as CardFileData), category: 'equipment', subtype: 'weapon' },
  'starvation': { ...(starvationTool as CardFileData), category: 'tool' },
  'steal': { ...(stealTool as CardFileData), category: 'tool' },
  'storm-runner': { ...(stormRunnerEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
  'wine': { ...(wineBasic as CardFileData), category: 'basic' },
  'wood-armor': { ...(woodArmorEquipmentArmor as CardFileData), category: 'equipment', subtype: 'armor' },
  'wuxie': { ...(wuxieTool as CardFileData), category: 'tool' },
  'zi-xing': { ...(ziXingEquipmentHorse as CardFileData), category: 'equipment', subtype: 'horse' },
};
