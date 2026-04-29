import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const geoipPkg = require.resolve("geoip-lite/package.json");
process.env.GEODATADIR = path.join(path.dirname(geoipPkg), "data");

const geoip = await import("geoip-lite");

export default geoip.default;
