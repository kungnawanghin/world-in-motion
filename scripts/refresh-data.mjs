import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../public/data/',import.meta.url);
const old=JSON.parse(await readFile(new URL('internet.json',root),'utf8'));
const isoToNumeric=Object.fromEntries(Object.entries(old.countries).map(([id,c])=>[c.iso3,id]));
const indicators=[['internet','IT.NET.USER.ZS'],['population','SP.POP.TOTL'],['electricity','EG.ELC.ACCS.ZS']];
for(const [slug,indicator] of indicators){
  const url=`https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=1990:2024&per_page=20000`;
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error(`World Bank returned ${response.status}`);
  const payload=await response.json();
  if(!Array.isArray(payload[1])||payload[0].pages!==1)throw Error('Incomplete World Bank response');
  const countries=Object.fromEntries(Object.entries(old.countries).map(([id,c])=>[id,{...c,values:{}}]));
  const global={};
  for(const row of payload[1]){if(row.value===null)continue;if(row.countryiso3code==='WLD')global[row.date]=row.value;const c=countries[isoToNumeric[row.countryiso3code]];if(c)c.values[row.date]=row.value}
  const data={indicator,source:'World Bank — World Development Indicators',sourceUrl:`https://data.worldbank.org/indicator/${indicator}`,fetchedAt:new Date().toISOString(),lastUpdated:payload[0].lastupdated,years:[1990,2024],global,countries};
  await writeFile(new URL(`${slug}.json`,root),JSON.stringify(data));
  console.log(slug,Object.values(countries).reduce((n,c)=>n+Object.keys(c.values).length,0),'observations');
}
