import {THB_CONVERSION} from './thb-rate.ts';
import {compactPopulation,formatPopulation,POPULATION_BINS,NO_DATA_COLOR,populationAt,type PopulationData} from '../population/population.ts';
export type IndicatorId='population'|'gdp';
export type GDPCurrency='THB'|'USD';
export type IndicatorData=PopulationData&{unit?:string;baseYear?:number;indicatorName?:string};
export type IndicatorDefinition={
  id:IndicatorId;code:string;label:string;title:string;statistic:string;chartTitle:string;unit:string;tableUnit:string;
  legendTitle:string;sourceUrl:string;note:string;accent:string;
  bins:readonly {below:number;color:string;label:string;tick:string}[];
  format:(value:number)=>string;meter:(value:number)=>string;axis:(value:number)=>string;
};
const money=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
export const GDP_BINS=[
  {below:1000,color:'#51402c',label:'ต่ำกว่า 1,000 US$',tick:'< 1'},
  {below:5000,color:'#7a6140',label:'1,000–5,000 US$',tick:'1'},
  {below:10000,color:'#a28452',label:'5,000–10,000 US$',tick:'5'},
  {below:25000,color:'#c3aa73',label:'10,000–25,000 US$',tick:'10'},
  {below:50000,color:'#dfcca1',label:'25,000–50,000 US$',tick:'25'},
  {below:Infinity,color:'#f5e9cf',label:'ตั้งแต่ 50,000 US$',tick:'≥ 50'},
] as const;
export const INDICATORS:Record<IndicatorId,IndicatorDefinition>={
  population:{id:'population',code:'SP.POP.TOTL',label:'ประชากร',title:'ประชากรโลก',statistic:'ประชากรทั้งหมด',chartTitle:'ประชากรย้อนหลัง',unit:'คน',tableUnit:'คน',legendTitle:'ประชากร · ล้านคน',sourceUrl:'https://data.worldbank.org/indicator/SP.POP.TOTL',note:'ค่าประมาณประชากรกลางปี',accent:'#e5e5e5',bins:POPULATION_BINS,format:formatPopulation,axis:compactPopulation,
    meter:value=>value>=1e9?`${(value/1e9).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} พันล้าน`:value>=1e6?`${(value/1e6).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})} ล้าน`:formatPopulation(value)},
  gdp:{id:'gdp',code:'NY.GDP.PCAP.KD',label:'GDP ต่อหัว',title:'GDP ต่อหัว',statistic:'GDP ต่อหัว',chartTitle:'GDP ต่อหัวย้อนหลัง',unit:'US$',tableUnit:'US$ ต่อคน',legendTitle:'GDP ต่อหัว · พัน US$',sourceUrl:'https://data.worldbank.org/indicator/NY.GDP.PCAP.KD',note:'ต่อคนต่อปี · ราคาคงที่ปี 2015',accent:'#dfcca1',bins:GDP_BINS,format:value=>money.format(value),meter:value=>money.format(value),axis:value=>value>=1000?`${(value/1000).toLocaleString('en-US',{maximumFractionDigits:1})}k US$`:`${value.toLocaleString('en-US',{maximumFractionDigits:0})} US$`},
};

/** Display conversion only: source data, rank ordering, and raw USD color thresholds do not change. */
export function getGDPDefinition(currency:GDPCurrency):IndicatorDefinition{
  if(currency==='USD')return INDICATORS.gdp;
  const rate=THB_CONVERSION.thbPerUsd;
  const short=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:1});
  return {...INDICATORS.gdp,unit:'บาท',tableUnit:'บาทต่อคน',legendTitle:'GDP ต่อหัว · พันบาท',
    format:value=>money.format(value*rate),meter:value=>money.format(value*rate),
    axis:value=>value*rate>=1e6?short(value*rate/1e6)+' ล้านบาท':value*rate>=1000?short(value*rate/1000)+' พันบาท':short(value*rate)+' บาท',
    bins:GDP_BINS.map((bin,i)=>{
      const lower=i?GDP_BINS[i-1].below:0;
      return {...bin,label:i===0?'ต่ำกว่า '+money.format(bin.below*rate)+' บาท':i===GDP_BINS.length-1?'ตั้งแต่ '+money.format(lower*rate)+' บาท':money.format(lower*rate)+'–'+money.format(bin.below*rate)+' บาท',
        tick:(i===0?'< ':i===GDP_BINS.length-1?'≥ ':'')+short((i===0?bin.below:lower)*rate/1000)};
    })};
}

export function indicatorColor(value:number|null,definition:IndicatorDefinition){
  return value===null?NO_DATA_COLOR:definition.bins.find(bin=>value<bin.below)!.color;
}
export function indicatorColors(data:IndicatorData,countries:readonly {index:number;iso3:string}[],definition:IndicatorDefinition,year:number){
  const colors=new Uint8Array(256*4);
  for(const country of countries){
    const value=populationAt(data,country.iso3,year),rgb=Number.parseInt(indicatorColor(value,definition).slice(1),16),i=country.index*4;
    colors[i]=rgb>>16;colors[i+1]=(rgb>>8)&255;colors[i+2]=rgb&255;colors[i+3]=value===null?0:255;
  }
  return colors;
}
