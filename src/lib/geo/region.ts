import type { Coord } from "@/types";
// Delhi metropolitan search area, including the adjoining NCR cities.
export const DELHI_BOUNDS: [Coord, Coord] = [
  [76.8, 28.25],
  [77.65, 28.95],
];
export const DELHI_CENTER: Coord = [77.209, 28.614];
export const DELHI_FILTER = `rect:${DELHI_BOUNDS.flat().join(",")}`;
export const inDelhiRegion = ([lon, lat]: Coord) =>
  lon >= DELHI_BOUNDS[0][0] &&
  lon <= DELHI_BOUNDS[1][0] &&
  lat >= DELHI_BOUNDS[0][1] &&
  lat <= DELHI_BOUNDS[1][1];
const aliases: Record<string, string> = {
  dtu: "Delhi Technological University",
  nsut: "Netaji Subhas University of Technology",
  cp: "Connaught Place",
  igi: "Indira Gandhi International Airport",
  "igi airport": "Indira Gandhi International Airport",
  aiims: "AIIMS New Delhi",
  ggn: "Gurugram",
  gurgaon: "Gurugram",
};
export function regionalQuery(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  return aliases[normalized.toLowerCase()] ?? normalized;
}
