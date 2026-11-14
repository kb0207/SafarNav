import type { LineString } from "geojson";
export type Coord = [number, number];
export type Mode = "walking" | "driving";
export type Category =
  | "business"
  | "emergency"
  | "transport"
  | "lamp"
  | "surveillance"
  | "road"
  | "parking";
export interface Place {
  name: string;
  coord: Coord;
}
export interface Infrastructure {
  id: string;
  name: string;
  coord: Coord;
  category: Category;
  tags: Record<string, string>;
  geometry?: LineString;
  source: "demo" | "osm" | "geoapify";
  fetchedAt: string;
}
export interface Route {
  id: string;
  name: string;
  geometry: LineString;
  distance: number;
  duration: number;
}
export type FactorName =
  | "activity"
  | "lighting"
  | "road"
  | "isolation"
  | "emergency"
  | "transport"
  | "surveillance"
  | "suitability";
export interface Factor {
  score: number;
  weight: number;
  evidence: string;
  known: boolean;
}
export interface Segment {
  id: string;
  geometry: LineString;
  start: number;
  length: number;
  score: number;
  confidence: number;
  factors: Record<FactorName, Factor>;
}
export interface EvaluatedPOI extends Infrastructure {
  status: "open" | "closed" | "unknown";
  passingTime: string;
  distanceToRoute: number;
  along: number;
}
export interface ScoredRoute extends Route {
  hasInfrastructure: boolean;
  cameras: {
    count: number;
    nearbyPercent: number;
    largestGap: number;
    radiusMetres: number;
  };
  score: number;
  confidence: number;
  lowest: number;
  weakCount: number;
  weakLength: number;
  longestWeak: number;
  segments: Segment[];
  pois: EvaluatedPOI[];
  factors: Record<FactorName, Factor>;
}
export interface Snapshot {
  routes: Route[];
  infrastructure: Infrastructure[];
  origin: Place;
  destination: Place;
  mode: Mode;
  demo: boolean;
  fetchedAt: string;
  warnings: string[];
}
export interface RouteResponse {
  routes: ScoredRoute[];
  token: string;
  demo: boolean;
  departure: string;
  fetchedAt: string;
  warnings: string[];
}
