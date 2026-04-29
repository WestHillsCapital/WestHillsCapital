import { createRequire } from "node:module";
import path from "node:path";
import type { Lookup } from "geoip-lite";

const require = createRequire(import.meta.url);

interface GeoipModule {
  lookup: (ip: string) => Lookup | null;
}

let geoip: GeoipModule;

try {
  const geoipPkg = require.resolve("geoip-lite/package.json");
  process.env.GEODATADIR = path.join(path.dirname(geoipPkg), "data");

  const mod = await import("geoip-lite");
  geoip = ((mod.default ?? mod) as unknown) as GeoipModule;
} catch (err) {
  console.warn("[geoip] Failed to load geoip-lite data — location lookups will return null.", err);
  geoip = {
    lookup: (_ip: string) => null,
  };
}

export default geoip;
