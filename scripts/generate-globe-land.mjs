// Offline authoring tool only. The React component imports no mapping library.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const sandbox = vm.createContext({});
for (const file of ['d3.min.js', 'topojson-client.min.js']) {
  vm.runInContext(await readFile(new URL(`public/vendor/${file}`, root), 'utf8'), sandbox);
}
const topology = JSON.parse(await readFile(new URL('public/data/countries-110m.json', root), 'utf8'));
const land = sandbox.topojson.feature(topology, topology.objects.countries);
const total = 26000;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const coordinates = [];
for (let i = 0; i < total; i++) {
  const y = 1 - 2 * (i + 0.5) / total;
  const ring = Math.sqrt(1 - y * y);
  const theta = i * goldenAngle;
  const x = Math.cos(theta) * ring;
  const z = Math.sin(theta) * ring;
  const lon = Math.atan2(x, z) * 180 / Math.PI;
  const lat = Math.asin(y) * 180 / Math.PI;
  if (sandbox.d3.geoContains(land, [lon, lat])) {
    coordinates.push(x, y, z);
  }
}
const text = `// Generated from Natural Earth (public domain), world-atlas 2, 110m.\n// ${coordinates.length / 3} land-only Fibonacci points. Regenerate: npm run globe:land\nexport const LAND_POINTS = new Float32Array([\n${Array.from({ length: Math.ceil(coordinates.length / 12) }, (_, i) => coordinates.slice(i * 12, i * 12 + 12).map(n => n.toFixed(6)).join(',')).join(',\n')}\n]);\n`;
await writeFile(new URL('components/ui/interactive-globe-utils/land-points.ts', root), text);
console.log(`${coordinates.length / 3} cached land points from ${total} Fibonacci samples`);
