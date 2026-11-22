// Pre-project Natural Earth country polygons once; the client needs no mapping library.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const sandbox = vm.createContext({});
for (const file of ['d3.min.js', 'topojson-client.min.js']) vm.runInContext(await readFile(new URL(`public/vendor/${file}`, root), 'utf8'), sandbox);
const topology = JSON.parse(await readFile(new URL('public/data/countries-50m.json', root), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('public/data/population.json', root), 'utf8')).countries;
const rawFeatures = sandbox.topojson.feature(topology, topology.objects.countries).features;
const grouped = new Map();
for (const [index, feature] of rawFeatures.entries()) {
  const key = Number(feature.id) >= 0 ? String(feature.id) : `unassigned-${index}`;
  const existing = grouped.get(key);
  if (!existing) grouped.set(key, feature);
  else existing.geometry = { type: 'GeometryCollection', geometries: [existing.geometry, feature.geometry] };
}
const features = [...grouped.values()];
const projection = sandbox.d3.geoEquirectangular().translate([1024, 512]).scale(1024 / Math.PI);
const path = sandbox.d3.geoPath(projection).digits(2);
const thai = { '702':'สิงคโปร์','764':'ประเทศไทย','704':'เวียดนาม','392':'ญี่ปุ่น','840':'สหรัฐอเมริกา','156':'จีน','356':'อินเดีย','076':'บราซิล','250':'ฝรั่งเศส','276':'เยอรมนี','826':'สหราชอาณาจักร','036':'ออสเตรเลีย','410':'เกาหลีใต้','360':'อินโดนีเซีย','458':'มาเลเซีย','608':'ฟิลิปปินส์','104':'เมียนมา','116':'กัมพูชา','418':'ลาว','643':'รัสเซีย','124':'แคนาดา','554':'นิวซีแลนด์','818':'อียิปต์','710':'แอฟริกาใต้','404':'เคนยา','682':'ซาอุดีอาระเบีย','784':'สหรัฐอาหรับเอมิเรตส์','032':'อาร์เจนตินา','152':'ชิลี','484':'เม็กซิโก','724':'สเปน','380':'อิตาลี','620':'โปรตุเกส','792':'ตุรกี','578':'นอร์เวย์','752':'สวีเดน','246':'ฟินแลนด์','304':'กรีนแลนด์','010':'แอนตาร์กติกา' };
const rows = features.map((feature, index) => {
  const numericId = String(feature.id).padStart(3, '0'), info = metadata[numericId];
  const id = Number(feature.id) < 0 || feature.id === undefined ? `ne-${index}` : numericId;
  const centroid = sandbox.d3.geoCentroid(feature);
  return { index: index + 1, id, name: thai[id] || info?.name || feature.properties.name, englishName: info?.name || feature.properties.name, iso3: info?.iso3 || '', region: info?.region || '', lon: +centroid[0].toFixed(4), lat: +centroid[1].toFixed(4), bounds: path.bounds(feature).flat().map(n => +n.toFixed(2)), path: path(feature) };
});
const output = '// Generated from Natural Earth (public domain), world-atlas 2 / 50m.\n// Equirectangular paths at 2048 × 1024. Run npm run globe:countries to regenerate.\nexport const COUNTRY_GEOMETRY = ' + JSON.stringify(rows) + ';\n';
if (rows.length > 255 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Country IDs must be unique and fit the 8-bit atlas.');
await writeFile(new URL('components/ui/interactive-globe-utils/countries.ts', root), output);
console.log(`${rows.length} country/territory polygons prepared`);

