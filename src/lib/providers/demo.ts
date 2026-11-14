import type {
  Coord,
  Infrastructure,
  Mode,
  Place,
  Route,
  Snapshot,
} from "@/types";
import { routeLength } from "@/lib/geo";
export const demoPlaces: Place[] = [
  { name: "Connaught Place · demo origin", coord: [77.2195, 28.6328] },
  { name: "India Gate · demo destination", coord: [77.2295, 28.6129] },
];
export function demoSnapshot(mode: Mode): Snapshot {
  const paths: Coord[][] = [
    [
      [77.2195, 28.6328],
      [77.2176, 28.6301],
      [77.2186, 28.6257],
      [77.2207, 28.6218],
      [77.2243, 28.6179],
      [77.2295, 28.6129],
    ],
    [
      [77.2195, 28.6328],
      [77.2247, 28.6321],
      [77.2292, 28.6268],
      [77.2331, 28.6209],
      [77.2295, 28.6129],
    ],
    [
      [77.2195, 28.6328],
      [77.2221, 28.6277],
      [77.2247, 28.6225],
      [77.227, 28.6179],
      [77.2295, 28.6129],
    ],
  ];
  const fetchedAt = new Date().toISOString();
  const infrastructure: Infrastructure[] = [];
  const routes: Route[] = paths.map((coordinates, i) => {
    const geometry = { type: "LineString" as const, coordinates };
    const distance = routeLength(geometry);
    return {
      id: `demo-${i}`,
      name: ["Garden avenue", "Civic loop", "Direct connection"][i],
      geometry,
      distance,
      duration: distance / (mode === "walking" ? 1.3 : 7),
    };
  });
  paths.forEach((path, r) => {
    path.slice(0, -1).forEach((p, i) => {
      const next = path[i + 1];
      infrastructure.push({
        id: `demo-road-${r}-${i}`,
        name: "Synthetic road evidence",
        coord: p,
        category: "road",
        geometry: { type: "LineString", coordinates: [p, next] },
        tags: {
          highway: r === 2 ? "secondary" : "residential",
          sidewalk: r === 2 ? "no" : "both",
          lit: r === 2 ? "no" : "yes",
        },
        source: "demo",
        fetchedAt,
      });
      for (let j = 1; j <= 3; j++) {
        const coord: Coord = [
          p[0] + ((next[0] - p[0]) * j) / 4,
          p[1] + ((next[1] - p[1]) * j) / 4,
        ];
        infrastructure.push({
          id: `demo-shop-${r}-${i}-${j}`,
          name: `Sample ${r === 0 ? "café" : "shop"} ${i * 3 + j}`,
          coord,
          category: "business",
          tags: {
            opening_hours:
              r === 0
                ? "Mo-Su 07:00-23:00"
                : r === 1
                  ? "24/7"
                  : "Mo-Su 09:00-17:00",
          },
          source: "demo",
          fetchedAt,
        });
      }
    });
  });
  infrastructure.push(
    {
      id: "demo-support",
      name: "Sample clinic (fictional)",
      coord: [77.2207, 28.6218],
      category: "emergency",
      tags: { opening_hours: "24/7" },
      source: "demo",
      fetchedAt,
    },
    {
      id: "demo-parking",
      name: "Sample parking stop (fictional)",
      coord: [77.2186, 28.6257],
      category: "parking",
      tags: { amenity: "parking", access: "yes" },
      source: "demo",
      fetchedAt,
    },
  );
  return {
    routes,
    infrastructure,
    origin: demoPlaces[0],
    destination: demoPlaces[1],
    mode,
    demo: true,
    fetchedAt,
    warnings: [
      "Synthetic route and infrastructure fixtures around New Delhi. Not real routing or verified facilities.",
    ],
  };
}
