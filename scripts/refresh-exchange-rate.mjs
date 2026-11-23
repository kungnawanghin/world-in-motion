import {readFile,writeFile} from 'node:fs/promises';
const sourceUrl='https://api.worldbank.org/v2/country/THA/indicator/PA.NUS.FCRF?format=json&source=2&date=2015&per_page=10';
const input=process.argv.indexOf('--input');
let raw;
if(input>=0)raw=JSON.parse(await readFile(process.argv[input+1],'utf8'));
else{const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error('World Bank exchange-rate request failed');raw=await response.json();}
const [meta,rows]=raw;
if(Number(meta.pages)!==1||!Array.isArray(rows)||rows.length!==1||Number(meta.total)!==1)throw new Error('Incomplete exchange-rate response; keeping existing rate.');
const row=rows[0];
if(row.indicator.id!=='PA.NUS.FCRF'||row.countryiso3code!=='THA'||row.date!=='2015'||!Number.isFinite(row.value)||row.value<=0)throw new Error('Unexpected exchange rate or base year');
const snapshot={indicator:row.indicator.id,country:'THA',baseYear:2015,thbPerUsd:row.value,sourceUpdated:meta.lastupdated,fetchedAt:new Date().toISOString(),sourceUrl};
await writeFile(new URL('../src/indicators/thb-rate.ts',import.meta.url),'// Official annual average exchange rate. Refresh with npm run data:exchange.\nexport const THB_CONVERSION = '+JSON.stringify(snapshot)+' as const;\n');
console.log('Stored official 2015 THB/USD average: '+row.value);
