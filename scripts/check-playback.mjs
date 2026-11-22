import assert from 'node:assert/strict';
import {createPopulationClock,playbackFrame} from '../src/population/playback.ts';
import {populationAt,populationPosition} from '../src/population/population.ts';

function setup(end=2025,initial=1960){
  let id=0,hidden=false,visibility;
  const callbacks=new Map(),years=[];
  const clock=createPopulationClock(1960,end,initial,year=>years.push(year),{
    request:callback=>{callbacks.set(++id,callback);return id;},cancel:key=>callbacks.delete(key),hidden:()=>hidden,
    visibility:callback=>{visibility=callback;return()=>{visibility=undefined;};},
  });
  return {clock,years,step(time){const batch=[...callbacks.values()];callbacks.clear();for(const callback of batch)callback(time);},hide(){hidden=true;visibility?.();},get pending(){return callbacks.size;}};
}
for(const hz of [60,120,144]){
  const run=setup(),positions=[];run.clock.subscribe(frame=>positions.push(frame.position));run.clock.play();
  for(let i=0;i<=hz*1.4;i++)run.step(i*1000/hz);
  const expected=1960+Math.floor(hz*1.4)*1000/hz/700;
  assert(Math.abs(run.clock.getFrame().position-expected)<1e-8,`speed mismatch at ${hz} Hz`);
  assert(positions.filter((value,i)=>i>0&&value!==positions[i-1]).length>hz);
  assert(run.years.every(Number.isInteger));
  const paused=run.clock.getFrame().position;run.clock.pause();run.step(50000);
  assert.equal(run.clock.getFrame().position,paused);assert.equal(run.pending,0);
  run.clock.play();run.step(60000);run.step(60010);
  assert(Math.abs(run.clock.getFrame().position-paused-10/700)<1e-8,'resume must preserve fraction');
  run.hide();assert.equal(run.clock.getFrame().playing,false);assert.equal(run.pending,0);
  run.clock.seek(1987.25);assert.equal(run.clock.getFrame().year,1987);assert.equal(run.clock.getFrame().mix,.25);
  run.clock.dispose();assert.equal(run.pending,0);
}
const end=setup(1961);end.clock.play();for(let i=0;i<60;i++)end.step(i*1000/60);
assert.equal(end.clock.getFrame().position,1961);assert.equal(end.clock.getFrame().playing,false);
end.clock.play();assert.equal(end.clock.getFrame().position,1960);end.clock.dispose();
const gap=setup();gap.clock.play();gap.step(0);gap.step(10000);
assert(gap.clock.getFrame().position<1960.1,'long frames must not jump years');gap.clock.dispose();
assert.deepEqual(playbackFrame(3000,1960,2025),{position:2025,year:2025,nextYear:2025,mix:0,playing:false});
const data={startYear:1960,mapYear:1962,series:{TST:[100,200,null,400,0]}};
assert.equal(populationPosition(data,'TST',1960.25),125);
assert.equal(populationAt(data,'TST',1960),100);
assert.equal(populationAt(data,'TST',1960.25),null,'fractional estimates must not become reported observations');
assert.equal(populationPosition(data,'TST',1961.5),null,'do not draw across missing years');
assert.equal(populationPosition(data,'TST',1962.5),null);
assert.equal(populationPosition(data,'TST',1963.5),200);
console.log('Playback checks passed: continuous 60/120/144 Hz motion, real annual labels, pause/resume, seek, end/replay, hidden tabs, long frames and missing years.');
