import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
export async function updateIndicatorRange(){
  const datasets=[];
  for(const path of ['src/population/population.json','src/indicators/gdp.json','src/indicators/life.json','src/indicators/internet.json']){
    try{datasets.push(JSON.parse(await readFile(new URL(path,root),'utf8')));}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(!datasets.length)throw new Error('No indicator datasets found');
  const range={startYear:Math.min(...datasets.map(d=>d.startYear)),endYear:Math.max(...datasets.map(d=>d.endYear)),defaultYear:Math.max(...datasets.map(d=>d.mapYear))};
  await mkdir(new URL('src/indicators/',root),{recursive:true});
  await writeFile(new URL('src/indicators/range.json',root),JSON.stringify(range));
}
