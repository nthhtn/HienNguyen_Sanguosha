import { generalsData } from '../../data/generals';

export interface GeneralDisplayData {
  name: string;
  title: string | null;
  skills: { name: string; text: string }[];
}

// Presentation-facing view of a general's data file, so UI code never imports
// raw content JSON.
export function generalDisplayData(id: string): GeneralDisplayData | null {
  if (!Object.prototype.hasOwnProperty.call(generalsData, id)) return null;
  const data = generalsData[id];
  return {
    name: data.name,
    title: data.title ?? null,
    skills: data.skills.map(({ name, text }) => ({ name, text })),
  };
}
