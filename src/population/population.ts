export type PopulationData = {
  indicator: string; source: string; sourceUrl: string; sourceUpdated: string; fetchedAt: string;
  startYear: number; endYear: number; mapYear: number; series: Record<string, (number | null)[]>;
};
export const POPULATION_BINS = [
  { below:1e6, color:'#2d4c68', label:'< 1 ล้าน', tick:'< 1' },
  { below:1e7, color:'#3e6a8b', label:'1–10 ล้าน', tick:'1' },
  { below:5e7, color:'#6593b0', label:'10–50 ล้าน', tick:'10' },
  { below:1e8, color:'#93b7cc', label:'50–100 ล้าน', tick:'50' },
  { below:5e8, color:'#c3dae7', label:'100–500 ล้าน', tick:'100' },
  { below:Infinity, color:'#f4f8fc', label:'≥ 500 ล้าน', tick:'≥ 500' },
] as const;
export const NO_DATA_COLOR = '#626262';
export const POPULATION_SOURCE = 'https://data.worldbank.org/indicator/SP.POP.TOTL';
const number = new Intl.NumberFormat('en-US');
export const formatPopulation = (value:number) => number.format(value);
export function compactPopulation(value:number) {
  return value >= 1e9 ? `${(value/1e9).toLocaleString('th-TH',{maximumFractionDigits:2})} พันล้าน` :
    value >= 1e6 ? `${(value/1e6).toLocaleString('th-TH',{maximumFractionDigits:1})} ล้าน` : number.format(value);
}
export function populationAt(data:PopulationData, iso3:string, year=data.mapYear): number|null {
  return data.series[iso3]?.[year-data.startYear] ?? null;
}
/** Visual position only. Never use the interpolated result as a displayed observation. */
export function populationPosition(data:PopulationData,iso3:string,position:number):number|null{
  const year=Math.floor(position),mix=position-year;
  const from=populationAt(data,iso3,year);
  if(from===null||mix===0)return from;
  const to=populationAt(data,iso3,year+1);
  return to===null?null:from+(to-from)*mix;
}
export function populationColor(value:number|null) {
  return value === null ? NO_DATA_COLOR : POPULATION_BINS.find(bin => value < bin.below)!.color;
}
/** Indexed by the same 8-bit country ID as the geographic atlas. Upload only when data changes. */
export function populationColors(data:PopulationData, countries:readonly {index:number;iso3:string}[], year=data.mapYear) {
  const colors = new Uint8Array(256*4);
  for (const country of countries) {
    const value=populationAt(data,country.iso3,year);
    const color = populationColor(value);
    const rgb = Number.parseInt(color.slice(1),16), i=country.index*4;
    colors[i]=rgb>>16;colors[i+1]=(rgb>>8)&255;colors[i+2]=rgb&255;colors[i+3]=value===null?0:255;
  }
  return colors;
}
