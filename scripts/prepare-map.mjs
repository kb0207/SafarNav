import { copyFile, mkdir } from "node:fs/promises";
// MapLibre 6 ships an external ESM worker. Serve the installed, version-matched assets.
await mkdir("public/maplibre", { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  await copyFile(
    `node_modules/maplibre-gl/dist/${file}`,
    `public/maplibre/${file}`,
  );
