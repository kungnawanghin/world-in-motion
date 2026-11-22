// Deterministic CSS/SVG scenery: no extra canvas, network request or frame loop.
const stars = Array.from({ length: 196 }, (_, i) => {
  const random = (seed: number) => { const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n); };
  return { x:random(i+1)*1600,y:random(i+207)*1000,r:i%19===0?1.45:.45+random(i+492)*.65,opacity:.24+random(i+833)*.62 };
});
const rocks = [
  {left:'6%',top:'76%',size:57,angle:'-16deg',delay:'-11s',duration:'56s'},
  {left:'16%',top:'19%',size:22,angle:'27deg',delay:'-29s',duration:'63s'},
  {left:'93%',top:'38%',size:36,angle:'13deg',delay:'-8s',duration:'49s'},
  {left:'84%',top:'84%',size:19,angle:'-37deg',delay:'-18s',duration:'58s'},
  {left:'3%',top:'40%',size:11,angle:'54deg',delay:'-34s',duration:'67s'},
  {left:'72%',top:'9%',size:13,angle:'-22deg',delay:'-24s',duration:'72s'},
  {left:'28%',top:'91%',size:9,angle:'19deg',delay:'-17s',duration:'62s'},
];
export function SpaceBackdrop() {
  return <div className="space-backdrop" aria-hidden="true">
    <div className="space-nebula"/>
    <svg className="space-stars" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      {stars.map((star,i)=><circle key={i} cx={star.x} cy={star.y} r={star.r} fill={i%4===0?'#97bedc':'#e3eff8'} opacity={star.opacity} className={i%19===0?'space-star-bright':undefined} style={{animationDelay:`-${i%8}s`,animationDuration:`${5+i%5}s`}}/>)}
    </svg>
    <div className="space-planet space-planet--moon"/>
    <div className="space-planet space-planet--rings"/>
    {rocks.map((rock,i)=><i key={i} className={`space-rock space-rock--${i}`} style={{left:rock.left,top:rock.top,width:rock.size,height:rock.size,rotate:rock.angle,animationDelay:rock.delay,animationDuration:rock.duration}}/>)}
    <div className="space-edge-vignette"/>
  </div>;
}
