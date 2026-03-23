
/**
 * fields.js — 30种GLSL矢量场算法库
 * 包含: 4D Simplex Noise, Curl Noise, SDF形变, 极坐标流体等
 */

// ============ GLSL 公共函数库 ============
export const GLSL_COMMON = /* glsl */`
precision highp float;

// 4D Simplex Noise
vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
vec2 mod289(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }
float mod289(float x){ return x - floor(x*(1.0/289.0))*289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
float permute(float x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
float taylorInvSqrt(float r){ return 1.79284291400159 - 0.85373472095314*r; }

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0,1.0,1.0,-1.0);
  vec4 p,s;
  p.xyz = floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0-1.0)*s.www;
  return p;
}

float snoise4(vec4 v){
  const vec4 C = vec4(
    0.138196601125011,
    0.276393202250021,
    0.414589803375032,
    -0.447213595499958
  );
  vec4 i = floor(v + dot(v, vec4(0.309016994374947451)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1 = permute(permute(permute(permute(
    i.w + vec4(i1.w,i2.w,i3.w,1.0))
    + i.z + vec4(i1.z,i2.z,i3.z,1.0))
    + i.y + vec4(i1.y,i2.y,i3.y,1.0))
    + i.x + vec4(i1.x,i2.x,i3.x,1.0));
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(
    dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));
  vec3 m0 = max(0.6 - vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3),dot(x4,x4)), 0.0);
  m0 = m0*m0; m1 = m1*m1;
  return 49.0*(
    dot(m0*m0, vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2)))
    + dot(m1*m1, vec2(dot(p3,x3),dot(p4,x4)))
  );
}

// 3D Curl Noise via partial derivatives
vec3 curlNoise(vec3 p, float t){
  float e = 0.01;
  float n1,n2;
  vec3 curl;
  n1 = snoise4(vec4(p.x, p.y+e, p.z, t));
  n2 = snoise4(vec4(p.x, p.y-e, p.z, t));
  float a = (n1-n2)/(2.0*e);
  n1 = snoise4(vec4(p.x, p.y, p.z+e, t));
  n2 = snoise4(vec4(p.x, p.y, p.z-e, t));
  float b = (n1-n2)/(2.0*e);
  curl.x = a - b;
  n1 = snoise4(vec4(p.x, p.y, p.z+e, t));
  n2 = snoise4(vec4(p.x, p.y, p.z-e, t));
  a = (n1-n2)/(2.0*e);
  n1 = snoise4(vec4(p.x+e, p.y, p.z, t));
  n2 = snoise4(vec4(p.x-e, p.y, p.z, t));
  b = (n1-n2)/(2.0*e);
  curl.y = a - b;
  n1 = snoise4(vec4(p.x+e, p.y, p.z, t));
  n2 = snoise4(vec4(p.x-e, p.y, p.z, t));
  a = (n1-n2)/(2.0*e);
  n1 = snoise4(vec4(p.x, p.y+e, p.z, t));
  n2 = snoise4(vec4(p.x, p.y-e, p.z, t));
  b = (n1-n2)/(2.0*e);
  curl.z = a - b;
  return curl;
}

// SDF primitives
float sdSphere(vec3 p, float r){ return length(p)-r; }
float sdBox(vec3 p, vec3 b){
  vec3 q=abs(p)-b;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}
float sdTorus(vec3 p, vec2 t){
  vec2 q=vec2(length(p.xz)-t.x, p.y);
  return length(q)-t.y;
}

// Smooth min/max
float smin(float a, float b, float k){
  float h=clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b,a,h)-k*h*(1.0-h);
}
`;

// ============ 30种矢量场定义 ============
export const FIELD_FUNCTIONS = /* glsl */`
// 统一入口: fieldForce(pos, vel, fieldId, time, params)
// params: vec4(strength, frequency, decay, custom)

vec3 fieldForce(vec3 pos, vec3 vel, int fieldId, float time, vec4 params){
  float str = params.x;
  float freq = params.y;
  float decay = params.z;
  float custom = params.w;
  vec3 f = vec3(0.0);

  // 0: Simplex Turbulence
  if(fieldId == 0){
    f = vec3(
      snoise4(vec4(pos*freq, time*0.3)),
      snoise4(vec4(pos*freq+100.0, time*0.3)),
      snoise4(vec4(pos*freq+200.0, time*0.3))
    ) * str;
  }
  // 1: Curl Flow
  else if(fieldId == 1){
    f = curlNoise(pos*freq, time*0.2) * str;
  }
  // 2: Radial Explosion
  else if(fieldId == 2){
    float r = length(pos) + 0.001;
    f = normalize(pos) * str / (r*r + 0.1);
  }
  // 3: Radial Implosion
  else if(fieldId == 3){
    float r = length(pos) + 0.001;
    f = -normalize(pos) * str / (r + 0.1);
  }
  // 4: Vortex (Y-axis)
  else if(fieldId == 4){
    f = vec3(-pos.z, 0.0, pos.x) * str * freq;
    f.y += snoise4(vec4(pos*0.5, time)) * str * 0.3;
  }
  // 5: Double Helix Vortex
  else if(fieldId == 5){
    float angle = atan(pos.z, pos.x);
    float r = length(pos.xz);
    f.x = -sin(angle + pos.y*freq) * str;
    f.z = cos(angle + pos.y*freq) * str;
    f.y = sin(r*freq + time) * str * 0.5;
  }
  // 6: Gravity Well
  else if(fieldId == 6){
    vec3 center = vec3(sin(time*0.3), cos(time*0.2), sin(time*0.17)) * custom;
    vec3 d = center - pos;
    float r2 = dot(d,d) + 0.01;
    f = d * str / r2;
  }
  // 7: SDF Sphere Attract
  else if(fieldId == 7){
    float d = sdSphere(pos, custom);
    f = -normalize(pos) * d * str;
  }
  // 8: SDF Torus Attract
  else if(fieldId == 8){
    float d = sdTorus(pos, vec2(custom, custom*0.3));
    vec3 grad;
    float e = 0.01;
    grad.x = sdTorus(pos+vec3(e,0,0),vec2(custom,custom*0.3))-d;
    grad.y = sdTorus(pos+vec3(0,e,0),vec2(custom,custom*0.3))-d;
    grad.z = sdTorus(pos+vec3(0,0,e),vec2(custom,custom*0.3))-d;
    f = -normalize(grad) * str;
  }
  // 9: Polar Fluid
  else if(fieldId == 9){
    float r = length(pos.xz) + 0.001;
    float th = atan(pos.z, pos.x);
    float spiral = sin(th*3.0 + r*freq - time*2.0);
    f.x = cos(th)*spiral*str;
    f.z = sin(th)*spiral*str;
    f.y = cos(r*freq - time)*str*0.4;
  }
  // 10: Inverse Growth (逆向质点生长)
  else if(fieldId == 10){
    vec3 origin = vec3(0.0);
    vec3 d = origin - pos;
    float r = length(d);
    float pulse = sin(time*freq)*0.5+0.5;
    f = d * str * pulse / (r + 0.1);
    f += curlNoise(pos*2.0, time*0.1) * str * 0.3;
  }
  // 11: Topological Fracture (拓扑碎裂)
  else if(fieldId == 11){
    float fracture = step(0.0, sin(pos.x*freq*10.0)*sin(pos.y*freq*10.0)*sin(pos.z*freq*10.0));
    vec3 dir = normalize(pos + 0.001);
    f = dir * str * (fracture*2.0-1.0);
    f += curlNoise(pos*freq, time*0.3) * str * 0.5;
  }
  // 12: Dimensional Fold (多维空间折叠)
  else if(fieldId == 12){
    float fold = sin(dot(pos, vec3(1.0,0.618,0.382))*freq + time);
    vec3 axis = normalize(vec3(cos(time*0.2), 1.0, sin(time*0.3)));
    float angle = fold * 3.14159 * custom;
    float c = cos(angle), s = sin(angle);
    mat3 rot = mat3(
      c+axis.x*axis.x*(1.0-c), axis.x*axis.y*(1.0-c)-axis.z*s, axis.x*axis.z*(1.0-c)+axis.y*s,
      axis.y*axis.x*(1.0-c)+axis.z*s, c+axis.y*axis.y*(1.0-c), axis.y*axis.z*(1.0-c)-axis.x*s,
      axis.z*axis.x*(1.0-c)-axis.y*s, axis.z*axis.y*(1.0-c)+axis.x*s, c+axis.z*axis.z*(1.0-c)
    );
    f = (rot * pos - pos) * str;
  }
  // 13: Lorenz Attractor
  else if(fieldId == 13){
    float sigma=10.0, rho=28.0, beta=8.0/3.0;
    f.x = sigma*(pos.y-pos.x);
    f.y = pos.x*(rho-pos.z)-pos.y;
    f.z = pos.x*pos.y - beta*pos.z;
    f *= str * 0.01;
  }
  // 14: Aizawa Attractor
  else if(fieldId == 14){
    float a=0.95,b=0.7,c=0.6,d=3.5,e=0.25,ff=0.1;
    f.x = (pos.z-b)*pos.x - d*pos.y;
    f.y = d*pos.x + (pos.z-b)*pos.y;
    f.z = c + a*pos.z - pos.z*pos.z*pos.z/3.0
          - (pos.x*pos.x+pos.y*pos.y)*(1.0+e*pos.z)
          + ff*pos.z*pos.x*pos.x*pos.x;
    f *= str * 0.1;
  }
  // 15: Thomas Attractor
  else if(fieldId == 15){
    float b = 0.208186;
    f.x = sin(pos.y) - b*pos.x;
    f.y = sin(pos.z) - b*pos.y;
    f.z = sin(pos.x) - b*pos.z;
    f *= str;
  }
  // 16: Magnetic Dipole
  else if(fieldId == 16){
    vec3 m = vec3(0,1,0);
    float r = length(pos)+0.01;
    float r3 = r*r*r;
    f = (3.0*dot(m,pos)*pos/r/r - m)/r3 * str;
  }
  // 17: Perlin Worms
  else if(fieldId == 17){
    float n = snoise4(vec4(pos*freq*0.5, time*0.15));
    float angle = n * 6.283;
    float pitch = snoise4(vec4(pos*freq*0.5+500.0, time*0.15)) * 3.14;
    f.x = cos(angle)*cos(pitch);
    f.y = sin(pitch);
    f.z = sin(angle)*cos(pitch);
    f *= str;
  }
  // 18: Elastic Return (to origin shape)
  else if(fieldId == 18){
    // vel stores original position for this field
    f = (vel - pos) * str * freq;
  }
  // 19: Repulsion Field
  else if(fieldId == 19){
    float r = length(pos);
    if(r < custom){
      f = normalize(pos) * str * (custom - r) / custom;
    }
  }
  // 20: Wave Propagation
  else if(fieldId == 20){
    float wave = sin(length(pos)*freq - time*3.0);
    f = normalize(pos+0.001) * wave * str;
    f.y += cos(length(pos.xz)*freq*0.5 - time*2.0) * str * 0.5;
  }
  // 21: Cellular Automata Flow
  else if(fieldId == 21){
    vec3 cell = floor(pos*freq);
    float hash = fract(sin(dot(cell, vec3(127.1,311.7,74.7)))*43758.5453);
    vec3 cellCenter = (cell + 0.5) / freq;
    f = (cellCenter - pos) * str * step(hash, custom);
    f += vec3(hash-0.5, fract(hash*13.0)-0.5, fract(hash*37.0)-0.5) * str * 0.3;
  }
  // 22: Blackhole Warp
  else if(fieldId == 22){
    float r = length(pos) + 0.001;
    float eventHorizon = custom * 0.3;
    vec3 tangent = normalize(cross(pos, vec3(0,1,0)));
    f = -normalize(pos) * str / (r*r) + tangent * str * 2.0 / (r+0.5);
    if(r < eventHorizon) f *= -3.0;
  }
  // 23: DNA Helix
  else if(fieldId == 23){
    float y = pos.y;
    float targetR = custom * 0.5;
    float angle = y * freq + time;
    vec3 target = vec3(cos(angle)*targetR, y, sin(angle)*targetR);
    f = (target - pos) * str;
  }
  // 24: Fireworks Burst
  else if(fieldId == 24){
    float phase = fract(time * 0.2);
    float burst = smoothstep(0.0,0.1,phase)*smoothstep(0.5,0.1,phase);
    f = normalize(pos+0.001) * str * burst * 5.0;
    f.y -= (1.0 - burst) * str * 0.5;
  }
  // 25: Ribbon Flow
  else if(fieldId == 25){
    float s = snoise4(vec4(pos.y*freq, 0.0, 0.0, time*0.2));
    f.x = s * str;
    f.z = snoise4(vec4(0.0, pos.y*freq, 0.0, time*0.2+100.0)) * str;
    f.y = str * 0.1;
  }
  // 26: Crystal Lattice
  else if(fieldId == 26){
    vec3 lattice = round(pos * freq) / freq;
    f = (lattice - pos) * str * 5.0;
    f += curlNoise(pos*0.5, time*0.1) * str * 0.2;
  }
  // 27: Breathing Sphere
  else if(fieldId == 27){
    float targetR = custom * (1.0 + sin(time*freq)*0.3);
    float r = length(pos);
    f = normalize(pos+0.001) * (targetR - r) * str;
  }
  // 28: Tornado
  else if(fieldId == 28){
    float r = length(pos.xz) + 0.001;
    float height = pos.y;
    float tangentStr = str * 3.0 / (r + 0.3);
    f.x = -pos.z / r * tangentStr;
    f.z = pos.x / r * tangentStr;
    f.y = str * 1.5;
    float inward = -str * 0.5 * max(0.0, 1.0 - r/(custom+0.01));
    f.x += pos.x / r * inward;
    f.z += pos.z / r * inward;
  }
  // 29: Noise Erosion
  else if(fieldId == 29){
    float n = snoise4(vec4(pos*freq*3.0, time*0.1));
    float erode = smoothstep(0.2, 0.8, n);
    f = curlNoise(pos*freq, time*0.15) * str * erode;
    f += normalize(pos+0.001) * str * (1.0-erode) * 0.5;
  }

  // 阻尼积分
  f -= vel * decay;
  return f;
}
`;

// ============ Simulation Shader (position update) ============
export const SIM_FRAG_SHADER = /* glsl */`
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform sampler2D uOriginTex;
uniform float uTime;
uniform float uDelta;
uniform int uFieldId;
uniform vec4 uFieldParams;
uniform float uProgress;

varying vec2 vUv;

${GLSL_COMMON}
${FIELD_FUNCTIONS}

void main(){
  vec4 posData = texture2D(uPosTex, vUv);
  vec4 velData = texture2D(uVelTex, vUv);
  vec4 originData = texture2D(uOriginTex, vUv);
  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  vec3 origin = originData.xyz;
  float life = posData.w;

  // 矢量场力
  vec3 force = fieldForce(pos, vel, uFieldId, uTime, uFieldParams);

  // 阻尼积分 (Semi-implicit Euler)
  vel += force * uDelta;
  vec3 fieldPos = pos + vel * uDelta;

  // 形态回归: uProgress=0 纯矢量场, uProgress=1 完全回到原始形态
  // 使用弹性回弹力将粒子拉回原始位置
  float returnStrength = uProgress * uProgress * 8.0; // 二次曲线加速
  vec3 returnForce = (origin - fieldPos) * returnStrength;
  fieldPos += returnForce * uDelta;

  // 当 progress 接近1时，直接snap到原始位置
  float snap = smoothstep(0.85, 1.0, uProgress);
  pos = mix(fieldPos, origin, snap);

  // 生命周期
  life = mix(life - uDelta * 0.05, 1.0, uProgress);

  gl_FragColor = vec4(pos, life);
}
`;

// Velocity update shader
export const VEL_FRAG_SHADER = /* glsl */`
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform sampler2D uOriginTex;
uniform float uTime;
uniform float uDelta;
uniform int uFieldId;
uniform vec4 uFieldParams;
uniform float uProgress;

varying vec2 vUv;

${GLSL_COMMON}
${FIELD_FUNCTIONS}

void main(){
  vec4 posData = texture2D(uPosTex, vUv);
  vec4 velData = texture2D(uVelTex, vUv);
  vec4 originData = texture2D(uOriginTex, vUv);
  vec3 pos = posData.xyz;
  vec3 vel = velData.xyz;
  vec3 origin = originData.xyz;

  vec3 force = fieldForce(pos, vel, uFieldId, uTime, uFieldParams);

  // 形态回归时，减弱矢量场力，增加回归阻尼
  float fieldMix = 1.0 - uProgress * uProgress;
  vel += force * uDelta * fieldMix;

  // 回归力：指向原始位置的弹性力
  vec3 toOrigin = origin - pos;
  float returnStr = uProgress * uProgress * 6.0;
  vel += toOrigin * returnStr * uDelta;

  // 回归时增加阻尼，让粒子平稳停靠
  float dampBoost = 1.0 + uProgress * 3.0;
  vel *= max(0.0, 1.0 - uDelta * dampBoost);

  // 速度限制
  float maxSpeed = mix(5.0, 2.0, uProgress);
  float speed = length(vel);
  if(speed > maxSpeed) vel *= maxSpeed / speed;

  gl_FragColor = vec4(vel, velData.w);
}
`;

// Fullscreen quad vertex shader
export const QUAD_VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

// Particle render vertex shader
export const PARTICLE_VERT = /* glsl */`
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uPointSize;
uniform float uTime;

varying vec3 vColor;
varying float vLife;
varying float vSpeed;

void main(){
  vec2 ref = vec2(
    mod(float(gl_VertexID), {WIDTH}.0) / {WIDTH}.0,
    floor(float(gl_VertexID) / {WIDTH}.0) / {HEIGHT}.0
  );
  vec4 posData = texture2D(uPosTex, ref);
  vec4 velData = texture2D(uVelTex, ref);

  vec3 pos = posData.xyz;
  float life = posData.w;
  float speed = length(velData.xyz);

  // 速度→颜色映射
  float t = clamp(speed * 0.3, 0.0, 1.0);
  vColor = mix(
    vec3(0.1, 0.4, 0.8),
    vec3(1.0, 0.3, 0.1),
    t
  );
  vColor = mix(vColor, vec3(1.0, 1.0, 0.9), t*t);
  vLife = life;
  vSpeed = speed;

  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = uPointSize * (1.0 + speed*0.5) / -mvPos.z;
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
}
`;

// Particle render fragment shader
export const PARTICLE_FRAG = /* glsl */`
varying vec3 vColor;
varying float vLife;
varying float vSpeed;

void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if(r > 0.5) discard;

  float alpha = smoothstep(0.5, 0.1, r);
  alpha *= clamp(vLife, 0.0, 1.0);

  // 速度越快越亮
  float glow = 1.0 + vSpeed * 0.3;
  vec3 col = vColor * glow;

  gl_FragColor = vec4(col, alpha * 0.85);
}
`;

// 矢量场元数据
export const FIELD_META = [
  { id:0,  name:'Simplex Turbulence', cat:'noise' },
  { id:1,  name:'Curl Flow', cat:'noise' },
  { id:2,  name:'Radial Explosion', cat:'radial' },
  { id:3,  name:'Radial Implosion', cat:'radial' },
  { id:4,  name:'Vortex', cat:'vortex' },
  { id:5,  name:'Double Helix', cat:'vortex' },
  { id:6,  name:'Gravity Well', cat:'attractor' },
  { id:7,  name:'SDF Sphere', cat:'sdf' },
  { id:8,  name:'SDF Torus', cat:'sdf' },
  { id:9,  name:'Polar Fluid', cat:'fluid' },
  { id:10, name:'Inverse Growth', cat:'organic' },
  { id:11, name:'Topological Fracture', cat:'organic' },
  { id:12, name:'Dimensional Fold', cat:'abstract' },
  { id:13, name:'Lorenz', cat:'attractor' },
  { id:14, name:'Aizawa', cat:'attractor' },
  { id:15, name:'Thomas', cat:'attractor' },
  { id:16, name:'Magnetic Dipole', cat:'physics' },
  { id:17, name:'Perlin Worms', cat:'organic' },
  { id:18, name:'Elastic Return', cat:'physics' },
  { id:19, name:'Repulsion', cat:'physics' },
  { id:20, name:'Wave Propagation', cat:'fluid' },
  { id:21, name:'Cellular Flow', cat:'abstract' },
  { id:22, name:'Blackhole Warp', cat:'abstract' },
  { id:23, name:'DNA Helix', cat:'organic' },
  { id:24, name:'Fireworks', cat:'radial' },
  { id:25, name:'Ribbon Flow', cat:'fluid' },
  { id:26, name:'Crystal Lattice', cat:'abstract' },
  { id:27, name:'Breathing Sphere', cat:'organic' },
  { id:28, name:'Tornado', cat:'vortex' },
  { id:29, name:'Noise Erosion', cat:'noise' },
];
