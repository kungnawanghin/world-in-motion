import earthUrl from './earth.jpg?url';
import { COUNTRY_GEOMETRY } from './countries';

export type Country = {
  index: number; id: string; name: string; englishName: string;
  iso3: string; region: string; lon: number; lat: number;
};
export const COUNTRIES: readonly Country[] = COUNTRY_GEOMETRY.map(({ path: _path, bounds: _bounds, ...country }) => country);
const MAP_WIDTH = 2048, MAP_HEIGHT = 1024;
type Atlas = { pixels: Uint8ClampedArray; width: number; height: number; paths: Path2D[]; hitContext: CanvasRenderingContext2D };
let atlasCache: Atlas | null = null;

function getAtlas(): Atlas {
  if (atlasCache) return atlasCache;
  const ids = document.createElement('canvas'), edges = document.createElement('canvas');
  ids.width = edges.width = MAP_WIDTH; ids.height = edges.height = MAP_HEIGHT;
  const fill = ids.getContext('2d', { willReadFrequently: true })!;
  const stroke = edges.getContext('2d', { willReadFrequently: true })!;
  fill.fillStyle = '#000'; fill.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  stroke.lineWidth = 1.7; stroke.lineJoin = 'round'; stroke.strokeStyle = '#fff';
  const paths: Path2D[] = [];
  for (const country of COUNTRY_GEOMETRY) {
    const path = new Path2D(country.path);
    paths.push(path);
    fill.fillStyle = `rgb(${country.index},0,0)`; fill.fill(path);
    stroke.stroke(path);
  }
  const pixels = fill.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  const lines = stroke.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
  for (let i = 0; i < pixels.length; i += 4) pixels[i + 2] = lines[i + 3];
  atlasCache = { pixels, width: MAP_WIDTH, height: MAP_HEIGHT, paths, hitContext: fill };
  return atlasCache;
}

export function countryAt(lon: number, lat: number): Country | null {
  const atlas = getAtlas();
  const u = ((lon + 180) % 360 + 360) % 360 / 360;
  const v = Math.max(0, Math.min(.999999, (90 - lat) / 180));
  const x = Math.min(MAP_WIDTH - 1, Math.floor(u * MAP_WIDTH));
  const y = Math.floor(v * MAP_HEIGHT);
  const offset = (y * MAP_WIDTH + x) * 4;
  const index = atlas.pixels[offset], px = u * MAP_WIDTH, py = v * MAP_HEIGHT;
  if (index > 0 && atlas.pixels[offset + 2] < 24) return COUNTRIES[index - 1] ?? null;
  // Resolve coastlines and tiny islands against exact paths, not blended ID pixels.
  for (let i = COUNTRY_GEOMETRY.length - 1; i >= 0; i--) {
    const [left, top, right, bottom] = COUNTRY_GEOMETRY[i].bounds;
    if (px < left || px > right || py < top || py > bottom) continue;
    if (atlas.hitContext.isPointInPath(atlas.paths[i], px, py)) return COUNTRIES[i];
  }
  return null;
}

const vertexShader = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;
const fragmentShader = `
precision highp float;
uniform vec2 resolution;
uniform vec2 center;
uniform float radius;
uniform vec4 rotation;
uniform sampler2D earth;
uniform sampler2D countries;
uniform sampler2D countryColors;
uniform sampler2D previousCountryColors;
uniform sampler2D metricColors;
uniform float metricMix;
uniform float colorMix;
uniform float thematic;
uniform float photoReady;
uniform float hovered;
uniform float selected;
uniform float borderOpacity;
uniform vec3 ground;
uniform vec3 land;
uniform vec3 accent;
uniform vec3 glow;
const float PI = 3.141592653589793;
void main() {
  vec2 p = (gl_FragCoord.xy - center) / radius;
  float d2 = dot(p, p);
  if (d2 > 1.0) {
    float halo = exp(-(sqrt(d2) - 1.0) * 49.0) * 0.16;
    // Premultiplied output keeps transparent pixels black on mobile compositors.
    gl_FragColor = vec4(glow * halo, halo);
    return;
  }
  vec3 normal = vec3(p, sqrt(max(0.0, 1.0 - d2)));
  // Inverse of yaw, then tilt used by the pointer controller.
  float y = normal.y * rotation.z + normal.z * rotation.w;
  float rz = normal.z * rotation.z - normal.y * rotation.w;
  vec3 world = vec3(normal.x * rotation.x - rz * rotation.y, y, rz * rotation.x + normal.x * rotation.y);
  vec2 uv = vec2(atan(world.x, world.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(world.y, -1.0, 1.0)) / PI);
  vec4 region = texture2D(countries, uv);
  float id = floor(region.r * 255.0 + 0.5);
  float isLand = step(0.5, id);
  vec3 fallback = mix(mix(glow, land, 0.75), land, isLand);
  vec3 surface = mix(fallback, texture2D(earth, uv).rgb, photoReady);
  // Country-indexed lookup: changing a dataset never rebuilds the geographic atlas.
  vec2 colorUV = vec2((id + 0.5) / 256.0, 0.5);
  vec4 previousData=texture2D(previousCountryColors,colorUV),nextData=texture2D(countryColors,colorUV);
  // Missing observations stay missing until a real annual value is reached.
  float validBlend = max(previousData.a*nextData.a,step(1.0,colorMix));
  vec3 dataColor = mix(previousData.rgb,nextData.rgb,colorMix*validBlend);
  dataColor = mix(texture2D(metricColors,colorUV).rgb,dataColor,metricMix);
  float dataAmount = thematic * borderOpacity * isLand;
  surface = mix(surface, dataColor, dataAmount * 0.88);
  // Use a restrained tint, retaining real deserts, forests and ice underneath.
  float isSelected = step(0.5, selected) * (1.0 - step(0.25, abs(id - selected)));
  float isHovered = step(0.5, hovered) * (1.0 - step(0.25, abs(id - hovered)));
  surface = mix(surface, accent, isSelected * 0.22 * (1.0-dataAmount));
  surface = mix(surface, mix(accent, vec3(1.0), 0.38), isHovered * mix(0.3,0.07,dataAmount));
  float luminance = dot(surface, vec3(0.2126, 0.7152, 0.0722));
  vec3 border = mix(vec3(0.88,0.94,0.91), vec3(0.10,0.18,0.17), smoothstep(0.30,0.55,luminance));
  border = mix(border, mix(accent, vec3(1.0), 0.68), max(isSelected, isHovered));
  float borderStrength = max(isSelected,isHovered) > 0.0 ? 0.98 : mix(0.78,0.48,dataAmount);
  surface = mix(surface, border, region.b * borderStrength * borderOpacity);
  float light = max(0.0, dot(normal, normalize(vec3(-0.48,0.58,1.0))));
  surface *= 0.56 + 0.63 * light;
  surface = mix(surface, glow, pow(1.0-normal.z, 4.0) * 0.26);
  float edge = smoothstep(0.995,1.0,sqrt(d2));
  gl_FragColor = vec4(mix(surface, mix(glow,ground,0.3),edge),1.0);
}
`;

type SurfaceTheme = { ground: string; land: string; arc: string; glow: string };
export type Surface = {
  draw: (width: number, height: number, radius: number, yaw: number, pitch: number, hovered: number, selected: number, centerX?: number, centerY?: number, borderOpacity?: number) => void;
  setTheme: (theme: SurfaceTheme) => void;
  setCountryColors: (colors?: Uint8Array) => void;
  setColorFrame: (from:Uint8Array,to:Uint8Array,mix:number) => void;
  advanceColors: (dt:number, immediate:boolean) => boolean;
  dispose: () => void;
};

export function createSurface(canvas: HTMLCanvasElement, theme: SurfaceTheme, onReady: () => void): Surface {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) throw new Error('ไม่สามารถเปิดภาพสามมิติได้ กรุณาตรวจการตั้งค่า WebGL ของเบราว์เซอร์');
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind)!; gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(error || 'Shader error'); }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexShader), fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Globe program error');
  gl.useProgram(program);
  const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['resolution','center','radius','rotation','earth','countries','countryColors','previousCountryColors','metricColors','metricMix','colorMix','thematic','photoReady','hovered','selected','borderOpacity','ground','land','accent','glow'].map(name => [name, gl.getUniformLocation(program,name)]));
  const makeTexture = (unit: number, linear: boolean) => {
    const texture = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return texture;
  };
  const earthTexture = makeTexture(0,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([34,80,105,255]));
  const countryTexture = makeTexture(1,false), atlas = getAtlas();
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,atlas.width,atlas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,atlas.pixels);
  const colorTexture = makeTexture(2,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256*4));
  gl.uniform1i(uniforms.countryColors,2);gl.uniform1f(uniforms.thematic,0);
  const previousColorTexture=makeTexture(3,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256*4));
  gl.uniform1i(uniforms.previousCountryColors,3);gl.uniform1f(uniforms.colorMix,1);
  const metricTexture=makeTexture(4,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256*4));
  gl.uniform1i(uniforms.metricColors,4);gl.uniform1f(uniforms.metricMix,1);
  let metricSnapshot:Uint8Array|undefined,metricProgress=1;
  let previousColors:Uint8Array|undefined,targetColors:Uint8Array|undefined,colorProgress=1;
  function visiblePalette(){
    const pixels=new Uint8Array(256*4);
    const metricEase=metricProgress*metricProgress*(3-2*metricProgress);
    for(let i=0;i<pixels.length;i+=4){
      const blend=(previousColors?.[i+3]&&targetColors?.[i+3]||colorProgress>=1)?colorProgress:0;
      for(let c=0;c<3;c++){
        const from=previousColors?.[i+c]??0,to=targetColors?.[i+c]??from;
        let value=from+(to-from)*blend;
        if(metricSnapshot&&metricProgress<1)value=metricSnapshot[i+c]+(value-metricSnapshot[i+c])*metricEase;
        pixels[i+c]=Math.round(value);
      }
      pixels[i+3]=255;
    }
    return pixels;
  }
  let externalColors=false;
  let layerOpacity=0,layerTarget=0,layerFrom=0,layerElapsed=.7;
  function targetLayer(target:number){
    if(target===layerTarget)return;
    layerFrom=layerOpacity;layerTarget=target;layerElapsed=0;
  }
  gl.uniform1i(uniforms.earth,0); gl.uniform1i(uniforms.countries,1); gl.uniform1f(uniforms.photoReady,0);
  let disposed = false;
  const image = new Image();
  image.onload = () => {
    if (disposed) return;
    gl.useProgram(program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,earthTexture);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image); gl.uniform1f(uniforms.photoReady,1); onReady();
  };
  image.onerror = () => { if (!disposed) onReady(); };
  image.src = earthUrl;
  const swatch = document.createElement('canvas'); swatch.width = swatch.height = 1;
  const colorContext = swatch.getContext('2d',{willReadFrequently:true})!;
  const setColor = (key: string, color: string) => {
    colorContext.clearRect(0,0,1,1); colorContext.fillStyle = color; colorContext.fillRect(0,0,1,1);
    const rgb = colorContext.getImageData(0,0,1,1).data; gl.uniform3f(uniforms[key],rgb[0]/255,rgb[1]/255,rgb[2]/255);
  };
  const setTheme = (next: SurfaceTheme) => { gl.useProgram(program); setColor('ground',next.ground); setColor('land',next.land); setColor('accent',next.arc); setColor('glow',next.glow); };
  setTheme(theme);
  return {
    setTheme,
    setCountryColors(colors) {
      externalColors=false;
      if(colors&&colors.length!==256*4)throw new Error('Country colors must contain 256 RGBA entries.');
      gl.useProgram(program);targetLayer(colors?1:0);
      if(colors){
        if(previousColors&&targetColors){
          metricSnapshot=visiblePalette();metricProgress=0;
          gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,metricTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,metricSnapshot);gl.uniform1f(uniforms.metricMix,0);
        }
        // Start from the currently visible blend when the slider moves again mid-transition.
        const from=targetColors&&previousColors?Uint8Array.from(targetColors,(value,i)=>Math.round(previousColors![i]+(value-previousColors![i])*colorProgress)):colors;
        colorProgress=targetColors?0:1;previousColors=from;targetColors=colors;
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,previousColorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,from);
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,colorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,colors);
      }else{externalColors=true;}
      gl.uniform1f(uniforms.colorMix,colorProgress);
    },
    setColorFrame(from,to,mix){
      externalColors=true;gl.useProgram(program);
      if(previousColors!==from){gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,previousColorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,from);previousColors=from;}
      if(targetColors!==to){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,colorTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,to);targetColors=to;}
      colorProgress=Math.max(0,Math.min(1,mix));gl.uniform1f(uniforms.colorMix,colorProgress);targetLayer(1);
    },
    advanceColors(dt,immediate){
      gl.useProgram(program);
      if(layerElapsed<.7){
        layerElapsed=immediate ? .7 : Math.min(.7,layerElapsed+dt);
        const t=layerElapsed/.7,ease=t*t*(3-2*t);
        layerOpacity=layerFrom+(layerTarget-layerFrom)*ease;
        gl.uniform1f(uniforms.thematic,layerOpacity);
      }
      if(metricProgress<1){metricProgress=immediate?1:Math.min(1,metricProgress+dt/.7);gl.uniform1f(uniforms.metricMix,metricProgress*metricProgress*(3-2*metricProgress));}
      if(!externalColors&&colorProgress<1){colorProgress=immediate?1:Math.min(1,colorProgress+dt/.18);gl.uniform1f(uniforms.colorMix,colorProgress);}
      return layerElapsed<.7||metricProgress<1||!externalColors&&colorProgress<1;
    },
    draw(width,height,radius,yaw,pitch,hovered,selected,centerX=width/2,centerY=height/2,borderOpacity=1) {
      if(disposed||gl.isContextLost())return;
      gl.viewport(0,0,width,height);gl.useProgram(program);
      gl.uniform2f(uniforms.resolution,width,height);gl.uniform1f(uniforms.radius,radius);
      gl.uniform2f(uniforms.center,centerX,height-centerY);
      gl.uniform4f(uniforms.rotation,Math.cos(yaw),Math.sin(yaw),Math.cos(pitch),Math.sin(pitch));
      gl.uniform1f(uniforms.hovered,hovered);gl.uniform1f(uniforms.selected,selected);
      gl.uniform1f(uniforms.borderOpacity,borderOpacity);
      gl.drawArrays(gl.TRIANGLES,0,6);
    },
    dispose() { disposed=true;image.onload=null;image.onerror=null;gl.deleteTexture(earthTexture);gl.deleteTexture(countryTexture);gl.deleteTexture(colorTexture);gl.deleteTexture(previousColorTexture);gl.deleteTexture(metricTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment); },
  };
}
