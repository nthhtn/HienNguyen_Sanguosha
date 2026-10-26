import aggregate from '../../data/decks/alternate/generals.json';
import differences from '../../data/decks/alternate/differences.json';

// The Alternate deck's Generals as the crawl saved them (generals.json, in the blog's order).
// HP and gender come from Default's General or from generals-manual.json (`hpFrom` says which).
export interface AlternateGeneralSkillRecord {
  name: string;
  nameZh?: string;
  text: string;
  tag?: string;
}

export interface AlternateGeneralRecord {
  id: string;
  name: string;
  nameZh?: string;
  force: 'wei' | 'shu' | 'wu' | 'qun';
  title?: string;
  maxHp: number;
  gender: 'male' | 'female';
  hpFrom: 'default' | 'manual';
  skills: AlternateGeneralSkillRecord[];
  synergisticPartners: string[];
  differenceFromNormal: string | null;
}

const RECORDS = aggregate.generals as AlternateGeneralRecord[];

// What differs from Dynasty Wars (Default), written by hand against the rules in the engine (differences.json).
// It is what the wiki shows; each record's crawled `differenceFromNormal` is kept but no longer used.
export const alternateDifferenceNote = (id: string): string | null => (differences as Record<string, string>)[id] ?? null;

export const alternateGeneralRecords = (): AlternateGeneralRecord[] => RECORDS;
export const alternateGeneralIds = (): string[] => RECORDS.map((g) => g.id);
