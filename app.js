(() => {
  'use strict';

  const canvas = document.getElementById('gl');
  const audio = document.getElementById('audio');
  const fileInput = document.getElementById('fileInput');
  const fileName = document.getElementById('fileName');
  const playBtn = document.getElementById('playBtn');
  const loopBtn = document.getElementById('loopBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const fullBtn = document.getElementById('fullBtn');
  const seek = document.getElementById('seek');
  const timeNow = document.getElementById('timeNow');
  const timeTotal = document.getElementById('timeTotal');
  const statusEl = document.getElementById('status');
  const sceneEl = document.getElementById('scene');
  const ui = document.getElementById('ui');
  const intensitySlider = document.getElementById('intensity');
  const speedSlider = document.getElementById('speed');
  const grainSlider = document.getElementById('grain');

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });

  if (!gl) {
    statusEl.textContent = 'WebGL 2 is required by this version';
    fileInput.disabled = true;
    return;
  }

  const vertexSource = `#version 300 es
  precision highp float;
  const vec2 V[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
  out vec2 vUV;
  void main(){ vec2 p=V[gl_VertexID]; vUV=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }
  `;

  const fragmentSource = `#version 300 es
  precision highp float;
  precision highp int;
  in vec2 vUV;
  out vec4 fragColor;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec3 uLook;
  uniform vec4 uAudio0;      // bass, mid, high, overall
  uniform vec4 uAudio1;      // brightness, flux, pulse, activity
  uniform vec4 uAudioSlow;   // slow bass, mid, high, slow overall
  uniform float uSceneWeights[8];
  uniform float uIntensity;
  uniform float uGrain;
  uniform vec2 uSeed;

  float hash21(vec2 p){
    p=fract(p*vec2(123.34,456.21));
    p+=dot(p,p+45.32);
    return fract(p.x*p.y);
  }
  float noise2(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float hash31(vec3 p){
    p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z);
  }
  float noise3(vec3 p){
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float n000=hash31(i+vec3(0,0,0)), n100=hash31(i+vec3(1,0,0));
    float n010=hash31(i+vec3(0,1,0)), n110=hash31(i+vec3(1,1,0));
    float n001=hash31(i+vec3(0,0,1)), n101=hash31(i+vec3(1,0,1));
    float n011=hash31(i+vec3(0,1,1)), n111=hash31(i+vec3(1,1,1));
    float nx00=mix(n000,n100,f.x), nx10=mix(n010,n110,f.x);
    float nx01=mix(n001,n101,f.x), nx11=mix(n011,n111,f.x);
    return mix(mix(nx00,nx10,f.y),mix(nx01,nx11,f.y),f.z);
  }

  float cloudDensity(vec3 p,float fog,float openness,float motion){
    vec3 advect=vec3(uTime*0.00016*motion,uTime*0.00005,-uTime*0.00012*motion);
    vec3 pp=p+advect;
    float large=noise3(pp*0.0104+vec3(uSeed.x*0.071,uSeed.y*0.053,2.1));
    float detail=noise3(pp*0.0320+vec3(13.0+uSeed.y*0.03,-7.0,5.0+uSeed.x*0.02));
    float field=large*0.94+detail*0.06;
    float threshold=0.525+openness*0.105-fog*0.090;
    // Audio breathes an existing body, not a full-screen fog layer.
    threshold -= (uAudioSlow.x-0.5)*0.020*uIntensity;
    float d=smoothstep(threshold,threshold+0.115,field);
    d=pow(d,1.16);
    float altitude=0.88+0.12*sin(p.y*0.008+uSeed.x);
    return clamp(d*altitude,0.0,1.0);
  }

  float W(int i){ return uSceneWeights[i]; }

  void main(){
    vec2 uv=vUV;
    vec2 q=uv*2.0-1.0;
    q.x*=uResolution.x/max(1.0,uResolution.y);

    float sunrise=W(0), blue=W(1), sunlight=W(2), mist=W(3);
    float darkP=W(4), storm=W(5), sunset=W(6), night=W(7);

    float bass=uAudio0.x, mids=uAudio0.y, highs=uAudio0.z, energy=uAudio0.w;
    float brightness=uAudio1.x, flux=uAudio1.y, pulse=uAudio1.z;

    float fogBase=sunrise*0.18+blue*0.15+sunlight*0.15+mist*0.58+darkP*0.54+storm*0.66+sunset*0.20+night*0.39;
    float openBase=sunrise*0.84+blue*0.93+sunlight*0.90+mist*0.24+darkP*0.25+storm*0.14+sunset*0.82+night*0.38;
    float grainBase=sunrise*0.026+blue*0.022+sunlight*0.030+mist*0.29+darkP*0.060+storm*0.125+sunset*0.030+night*0.062;
    float ambient=sunrise*0.73+blue*0.76+sunlight*0.76+mist*0.45+darkP*0.22+storm*0.085+sunset*0.70+night*0.045;

    float fog=clamp((fogBase/0.75)*(0.96+(bass-0.5)*0.10*uIntensity),0.0,1.0);
    float openness=clamp((openBase/0.75)+(brightness-0.5)*0.035*uIntensity,0.0,1.0);
    float motion=0.78 + mids*0.28 + flux*0.18;
    float grainState=clamp((grainBase/0.75)*(0.80+highs*0.38)*uGrain,0.0,1.7);

    vec3 forward=normalize(uLook);
    vec3 worldUp=vec3(0,1,0);
    vec3 right=normalize(cross(forward,worldUp));
    vec3 up=normalize(cross(right,forward));
    vec3 rd=normalize(forward+right*q.x*0.84+up*q.y*0.61);
    vec3 ro=uCamera;

    float skyY=clamp(0.48+rd.y*0.55,0.0,1.0);
    vec3 blueSky=mix(vec3(0.72,0.82,0.90),vec3(0.10,0.34,0.62),skyY);
    vec3 sunriseSky=mix(vec3(0.90,0.52,0.36),vec3(0.30,0.42,0.58),skyY);
    vec3 sunsetSky=mix(vec3(0.88,0.39,0.24),vec3(0.25,0.28,0.44),skyY);
    vec3 darkSky=mix(vec3(0.42,0.44,0.45),vec3(0.23,0.25,0.27),skyY);
    vec3 stormSky=mix(vec3(0.095,0.105,0.112),vec3(0.010,0.014,0.020),skyY);
    vec3 nightSky=mix(vec3(0.028,0.035,0.060),vec3(0.003,0.004,0.012),skyY);

    vec3 sky=blueSky;
    sky=mix(sky,sunriseSky,sunrise*0.94*uIntensity);
    sky=mix(sky,darkSky,darkP*0.86*uIntensity);
    sky=mix(sky,stormSky,storm*0.96*uIntensity);
    sky=mix(sky,sunsetSky,sunset*0.96*uIntensity);
    sky=mix(sky,nightSky,night*0.985*uIntensity);

    float sunAz=uTime*0.055+uSeed.x;
    float sunEl=0.16+0.30*sin(uTime*0.037+uSeed.y);
    vec3 sunDir=normalize(vec3(cos(sunAz)*cos(sunEl),sin(sunEl),sin(sunAz)*cos(sunEl)));
    float moonAz=uTime*0.024+uSeed.y+2.3;
    float moonEl=0.24+0.13*sin(uTime*0.021+uSeed.x);
    vec3 moonDir=normalize(vec3(cos(moonAz)*cos(moonEl),sin(moonEl),sin(moonAz)*cos(moonEl)));
    float sunDot=max(0.0,dot(rd,sunDir));
    float moonDot=max(0.0,dot(rd,moonDir));

    float sunPresence=clamp(sunrise+sunlight+sunset+darkP*0.18,0.0,1.0)*(1.0-night)*(1.0-storm*0.92);
    float moonPresence=night;
    vec3 sunColor=mix(vec3(1.00,0.72,0.28),vec3(0.98,0.61,0.39),sunrise*0.90);
    sunColor=mix(sunColor,vec3(0.96,0.49,0.30),sunset*0.95);
    vec3 moonColor=vec3(0.58,0.68,0.84);
    sky += moonColor*pow(moonDot,5.0)*moonPresence*0.018;

    vec3 accum=vec3(0.0);
    float trans=1.0;
    float previousDensity=0.0;
    const int STEPS=9;
    float maxDistance=178.0;
    float stepLength=maxDistance/float(STEPS);

    for(int i=0;i<STEPS;i++){
      float dist=(float(i)+0.44)*stepLength;
      vec3 p=ro+rd*dist;
      vec3 movingP=p+vec3(uTime*0.0026*motion,uTime*0.0007,-uTime*0.0019*motion);
      float dens=cloudDensity(movingP,fog,openness,motion);
      float farPresence=0.82+smoothstep(78.0,142.0,dist)*0.16;
      float nearSeparation=0.90+smoothstep(18.0,62.0,dist)*0.10;
      dens*=farPresence*nearSeparation;
      dens*=0.90+darkP*0.22+storm*0.42+mist*0.16;
      dens*=1.0-smoothstep(142.0,182.0,dist);
      dens=clamp(dens,0.0,1.0);

      float edge=max(0.0,dens-previousDensity);
      float exitEdge=max(0.0,previousDensity-dens);
      float interior=pow(dens,1.52);
      float distanceDepth=clamp(dist/178.0,0.0,1.0);

      vec3 dayShadow=vec3(0.16,0.21,0.28);
      vec3 dayLight=vec3(0.86,0.89,0.90);
      dayShadow=mix(dayShadow,vec3(0.30,0.20,0.24),sunrise*0.62);
      dayLight=mix(dayLight,vec3(0.90,0.66,0.50),sunrise*0.76);
      dayShadow=mix(dayShadow,vec3(0.22,0.20,0.17),sunlight*0.22);
      dayLight=mix(dayLight,vec3(0.90,0.70,0.34),sunlight*0.64);
      dayShadow=mix(dayShadow,vec3(0.30,0.18,0.23),sunset*0.66);
      dayLight=mix(dayLight,vec3(0.88,0.55,0.40),sunset*0.80);
      dayShadow=mix(dayShadow,vec3(0.075,0.080,0.086),darkP);
      dayLight=mix(dayLight,vec3(0.22,0.23,0.24),darkP*0.96);
      dayShadow=mix(dayShadow,vec3(0.016,0.019,0.023),storm);
      dayLight=mix(dayLight,vec3(0.090,0.098,0.108),storm);

      vec3 nightShadow=vec3(0.004,0.005,0.012);
      vec3 nightLight=vec3(0.075,0.090,0.130);
      vec3 shadow=mix(dayShadow,nightShadow,night);
      vec3 lit=mix(dayLight,nightLight,night);

      float bodyLight=clamp(0.60-interior*0.45-darkP*0.25-storm*0.45-night*0.34+ambient*0.07,0.018,0.80);
      // Music illumination is subtle and local to existing cloud surfaces.
      bodyLight=clamp(bodyLight+(brightness-0.5)*0.045*uIntensity,0.018,0.84);
      vec3 cloud=mix(shadow,lit,bodyLight);
      vec3 atmosphericCloud=mix(cloud,vec3(0.50,0.54,0.58),distanceDepth*0.12*(1.0-storm)*(1.0-night));
      cloud=mix(cloud,atmosphericCloud,distanceDepth*0.55);
      cloud+=lit*edge*(0.31+highs*0.08*uIntensity);
      cloud+=shadow*exitEdge*0.10;

      float flashA=pow(max(0.0,sin(uTime*0.73+2.1)),72.0);
      float flashB=pow(max(0.0,sin(uTime*0.41+5.4)),86.0)*0.72;
      // Flux only scales an already rare internal storm flash; it never produces a screen flash.
      float lightning=(flashA+flashB)*storm*(0.62+flux*0.55);
      vec3 flashCenter=ro+forward*82.0+right*(sin(uTime*0.17+uSeed.x)*34.0)+up*(cos(uTime*0.13+uSeed.y)*18.0);
      vec3 fd=(p-flashCenter)/vec3(42.0,30.0,48.0);
      float localFlash=exp(-dot(fd,fd)*2.6);
      cloud+=vec3(1.00,0.66,0.16)*lightning*localFlash*dens*(0.32+edge*1.20+(1.0-interior)*0.24);

      float sunFacing=sunDot*sunDot;
      float sunEdge=edge*(0.10+sunFacing*0.72)*sunPresence;
      float sunInteriorGlow=(1.0-interior)*pow(sunDot,4.0)*sunPresence*0.014;
      float sunlightBounce=sunlight*(0.20+sunFacing*0.55)*(1.0-interior)*(0.45+edge*1.65);
      // High-frequency brightness gives the warm bounce a little more life without becoming white.
      float musicSun=0.90+brightness*0.16+highs*0.10;
      cloud+=sunColor*(sunEdge*(0.34+sunlight*0.34)+sunInteriorGlow+sunlightBounce*0.20)*musicSun;

      float moonFacing=moonDot*moonDot;
      float moonEdge=edge*(0.12+moonFacing*1.30)*moonPresence;
      float moonInteriorGlow=(1.0-interior)*pow(moonDot,5.0)*moonPresence*0.004;
      cloud+=moonColor*(moonEdge*0.72+moonInteriorGlow);

      float alpha=1.0-exp(-dens*stepLength*0.050);
      accum+=trans*cloud*alpha;
      trans*=1.0-alpha;
      previousDensity=dens;
      if(trans<0.02) break;
    }

    vec3 base=accum+sky*trans;
    base+=moonColor*pow(moonDot,4.0)*moonPresence*0.018;

    float fineGrain=noise2(uv*360.0+vec2(uTime*0.095,-uTime*0.071)+uSeed)-0.5;
    float microGrain=hash21(floor(uv*vec2(760.0,1340.0))+floor(uTime*8.0)+uSeed*17.0)-0.5;
    float dotNoise=step(0.974,hash21(floor(uv*vec2(620.0,1100.0))+floor(uTime*10.0)+uSeed*31.0));
    float cloudImmersion=1.0-trans;
    float grainEnvelope=grainState*(0.28+cloudImmersion*0.72)*(0.84+highs*0.26);
    base+=fineGrain*grainEnvelope*0.030;
    base+=microGrain*grainEnvelope*0.011;
    base+=dotNoise*grainEnvelope*0.014;

    base=mix(base,vec3(0.61,0.64,0.66),mist*cloudImmersion*0.065);
    fragColor=vec4(clamp(base,0.0,1.0),1.0);
  }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile failed');
    }
    return sh;
  }

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    statusEl.textContent = 'Shader error: ' + err.message;
    console.error(err);
    return;
  }
  gl.useProgram(program);

  const loc = name => gl.getUniformLocation(program, name);
  const U = {
    resolution: loc('uResolution'), time: loc('uTime'), camera: loc('uCamera'), look: loc('uLook'),
    audio0: loc('uAudio0'), audio1: loc('uAudio1'), audioSlow: loc('uAudioSlow'),
    sceneWeights: loc('uSceneWeights[0]'), intensity: loc('uIntensity'), grain: loc('uGrain'), seed: loc('uSeed')
  };

  const SCENES = ['SUNRISE','BLUE SKY','SUNLIGHT','MIST','DARK CLOUD','THUNDERSTORM','SUNSET','NIGHT'];
  const sceneWeights = new Float32Array(8);
  sceneWeights[1] = 1;
  let currentScene = 1;
  let targetScene = 1;
  let transitionStart = 0;
  let transitionDuration = 24;
  let nextDecision = 28;
  let seed = [Math.random()*100, Math.random()*100];

  let objectURL = null;
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let freq = null;
  let prevFreq = null;
  let timeDomain = null;
  let audioReady = false;

  const A = {
    bass:.5, mid:.5, high:.5, overall:.5, brightness:.5, flux:.0, pulse:.0, activity:.0,
    slowBass:.5, slowMid:.5, slowHigh:.5, slowOverall:.5,
    baseBass:.1, baseMid:.1, baseHigh:.1, baseOverall:.1,
    devBass:.08, devMid:.08, devHigh:.08, devOverall:.08
  };

  function ensureAudioGraph() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.68;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    prevFreq = new Uint8Array(analyser.frequencyBinCount);
    timeDomain = new Uint8Array(analyser.fftSize);
    audioReady = true;
  }

  function bandEnergy(lowHz, highHz) {
    if (!freq || !audioCtx) return 0;
    const ny = audioCtx.sampleRate * 0.5;
    const a = Math.max(0, Math.floor(lowHz / ny * freq.length));
    const b = Math.min(freq.length-1, Math.ceil(highHz / ny * freq.length));
    let sum=0, n=0;
    for(let i=a;i<=b;i++){ const v=freq[i]/255; sum+=v*v; n++; }
    return n ? Math.sqrt(sum/n) : 0;
  }

  const clamp01 = x => Math.max(0,Math.min(1,x));
  const expSmooth = (a,b,k,dt) => a+(b-a)*(1-Math.exp(-k*dt));

  function adaptiveMetric(raw, keyBase, keyDev, dt) {
    const base=A[keyBase];
    const dev=A[keyDev];
    A[keyBase] = expSmooth(base, raw, 0.10, dt);
    A[keyDev] = expSmooth(dev, Math.abs(raw-A[keyBase]), 0.16, dt);
    const z=(raw-A[keyBase]) / Math.max(0.025, A[keyDev]*3.1);
    return clamp01(0.5+z*0.5);
  }

  function analyseAudio(dt) {
    if (!audioReady || audio.paused) {
      A.activity=expSmooth(A.activity,0,1.6,dt);
      A.flux=expSmooth(A.flux,0,1.4,dt);
      A.pulse=expSmooth(A.pulse,0,2.0,dt);
      return;
    }
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(timeDomain);

    const rb=bandEnergy(25,180), rm=bandEnergy(180,2600), rh=bandEnergy(2600,12000);
    let rms=0;
    for(let i=0;i<timeDomain.length;i++){ const v=(timeDomain[i]-128)/128; rms+=v*v; }
    rms=Math.sqrt(rms/timeDomain.length);

    let weighted=0, mag=0, flux=0;
    for(let i=1;i<freq.length;i++){
      const v=freq[i]/255;
      weighted+=i*v; mag+=v;
      flux+=Math.max(0,(freq[i]-prevFreq[i])/255);
      prevFreq[i]=freq[i];
    }
    const centroid=mag>0 ? weighted/mag/(freq.length-1) : 0;
    flux=clamp01(flux/freq.length*13.0);

    const bass=adaptiveMetric(rb,'baseBass','devBass',dt);
    const mid=adaptiveMetric(rm,'baseMid','devMid',dt);
    const high=adaptiveMetric(rh,'baseHigh','devHigh',dt);
    const overall=adaptiveMetric(rms,'baseOverall','devOverall',dt);

    A.pulse=expSmooth(A.pulse,clamp01(Math.max(0,overall-A.overall)*3.0),4.5,dt);
    A.bass=expSmooth(A.bass,bass,4.0,dt);
    A.mid=expSmooth(A.mid,mid,3.5,dt);
    A.high=expSmooth(A.high,high,3.8,dt);
    A.overall=expSmooth(A.overall,overall,3.0,dt);
    A.brightness=expSmooth(A.brightness,clamp01(centroid*2.2),1.4,dt);
    A.flux=expSmooth(A.flux,flux,2.1,dt);
    A.activity=expSmooth(A.activity,clamp01((overall+flux*0.8)*0.72),1.8,dt);

    A.slowBass=expSmooth(A.slowBass,A.bass,0.32,dt);
    A.slowMid=expSmooth(A.slowMid,A.mid,0.30,dt);
    A.slowHigh=expSmooth(A.slowHigh,A.high,0.34,dt);
    A.slowOverall=expSmooth(A.slowOverall,A.overall,0.26,dt);
  }

  function pickScene(now) {
    const e=A.slowOverall, b=A.slowBass, m=A.slowMid, h=A.slowHigh, br=A.brightness, f=A.flux;
    const s = new Float32Array(8);
    s[0] = .28 + (1-Math.abs(e-.52))*.30 + br*.18;                 // sunrise
    s[1] = .38 + br*.35 + (1-e)*.18;                              // blue
    s[2] = .24 + br*.48 + h*.20 + e*.10;                          // sunlight
    s[3] = .20 + (1-e)*.35 + m*.12 + (1-br)*.16;                  // mist
    s[4] = .17 + b*.35 + (1-br)*.34 + e*.08;                      // dark
    s[5] = .06 + e*.34 + b*.24 + f*.70;                           // storm
    s[6] = .23 + (1-Math.abs(e-.48))*.22 + (1-br)*.18 + h*.10;   // sunset
    s[7] = .11 + (1-e)*.50 + (1-br)*.35;                          // night

    // Keep the journey varied but not random-looking.
    for(let i=0;i<8;i++){
      s[i] *= 0.90 + Math.random()*0.25;
      if (i===currentScene) s[i]*=.42;
    }
    // Thunderstorm stays rare unless music supports it.
    if (e<.58 && f<.34) s[5]*=.35;

    let total=0; for(const v of s) total+=v;
    let r=Math.random()*total, chosen=1;
    for(let i=0;i<8;i++){ r-=s[i]; if(r<=0){ chosen=i; break; } }

    targetScene=chosen;
    transitionStart=now;
    transitionDuration=18 + Math.random()*14;
    // More evolving music invites a sooner next state; drone sections linger.
    nextDecision=now + 34 + Math.random()*42 - f*10;
  }

  function resetJourney() {
    seed=[Math.random()*100,Math.random()*100];
    currentScene=1; targetScene=1;
    sceneWeights.fill(0); sceneWeights[1]=1;
    transitionStart=performance.now()/1000;
    nextDecision=transitionStart+18;
    camera.x=0; camera.y=0; camera.z=0; travel=0; yaw=0; pitch=0;
    sceneEl.textContent=SCENES[1];
  }

  function updateScenes(now,dt) {
    if (now>=nextDecision && (audioReady ? !audio.paused : true)) pickScene(now);
    const mixDur=Math.max(1,transitionDuration);
    const t=clamp01((now-transitionStart)/mixDur);
    const eased=t*t*(3-2*t);
    const target = new Float32Array(8); target[targetScene]=1;
    const k=1-Math.exp(-dt*(0.20+eased*0.32));
    for(let i=0;i<8;i++) sceneWeights[i]+= (target[i]-sceneWeights[i])*k;
    let best=0; for(let i=1;i<8;i++) if(sceneWeights[i]>sceneWeights[best]) best=i;
    if(t>=1 && currentScene!==targetScene) currentScene=targetScene;
    sceneEl.textContent=SCENES[best];
  }

  const camera={x:0,y:0,z:0};
  let yaw=0,pitch=0,travel=0;

  function updateCamera(t,dt) {
    const desiredYaw=Math.sin(t*.033+seed[0])*.44+Math.sin(t*.011+seed[1])*.28;
    yaw=expSmooth(yaw,desiredYaw,.20,dt);
    const speedBase=(12.4 + A.slowMid*1.8 + A.slowHigh*.35 + A.slowOverall*.9)*1.15;
    const speed=speedBase*parseFloat(speedSlider.value)*(0.91+A.mid*.13);
    const direction=yaw+Math.sin(t*.047+seed[1])*.10;
    const lateral=Math.sin(t*.071+seed[0])*.70+Math.sin(t*.023+seed[1])*.30;
    camera.x+=(Math.sin(direction)*speed+Math.cos(direction)*lateral)*dt;
    camera.z+=(-Math.cos(direction)*speed+Math.sin(direction)*lateral)*dt;
    travel+=speed*dt;
    const desiredY=Math.sin(t*.037+seed[1])*12+Math.sin(t*.081+seed[0])*4.8+Math.sin(travel*.010)*7;
    camera.y=expSmooth(camera.y,desiredY,.12,dt);
    const fogMood=sceneWeights[3]*.58+sceneWeights[4]*.54+sceneWeights[5]*.66+sceneWeights[7]*.39;
    const desiredPitch=Math.sin(t*.043+seed[1])*.12+(.5-fogMood)*.06;
    pitch=expSmooth(pitch,desiredPitch,.12,dt);
    return speed;
  }

  let qualityScale=0.82;
  let fpsAccum=0, fpsFrames=0, fpsTimer=0;
  function resize() {
    const dpr=Math.min(window.devicePixelRatio||1,1.65);
    const w=Math.max(2,Math.floor(innerWidth*dpr*qualityScale));
    const h=Math.max(2,Math.floor(innerHeight*dpr*qualityScale));
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); }
  }
  window.addEventListener('resize',resize,{passive:true});

  let last=performance.now()/1000;
  function frame(ms) {
    const now=ms/1000;
    let dt=Math.min(.05,Math.max(.001,now-last)); last=now;
    resize();
    analyseAudio(dt);
    updateScenes(now,dt);
    const t=audioReady && isFinite(audio.currentTime) ? audio.currentTime : now;
    updateCamera(t,dt);

    const look=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    gl.useProgram(program);
    gl.uniform2f(U.resolution,canvas.width,canvas.height);
    gl.uniform1f(U.time,t);
    gl.uniform3f(U.camera,camera.x,camera.y,camera.z);
    gl.uniform3f(U.look,look[0],look[1],look[2]);
    gl.uniform4f(U.audio0,A.bass,A.mid,A.high,A.overall);
    gl.uniform4f(U.audio1,A.brightness,A.flux,A.pulse,A.activity);
    gl.uniform4f(U.audioSlow,A.slowBass,A.slowMid,A.slowHigh,A.slowOverall);
    gl.uniform1fv(U.sceneWeights,sceneWeights);
    gl.uniform1f(U.intensity,parseFloat(intensitySlider.value));
    gl.uniform1f(U.grain,parseFloat(grainSlider.value));
    gl.uniform2f(U.seed,seed[0],seed[1]);
    gl.drawArrays(gl.TRIANGLES,0,3);

    if(audioReady && isFinite(audio.duration) && audio.duration>0){
      if(!seek.matches(':active')) seek.value=audio.currentTime;
      seek.max=audio.duration;
      timeNow.textContent=formatTime(audio.currentTime);
      timeTotal.textContent=formatTime(audio.duration);
    }

    fpsAccum+=1/dt; fpsFrames++; fpsTimer+=dt;
    if(fpsTimer>6){
      const fps=fpsAccum/fpsFrames;
      if(fps<34 && qualityScale>.58) qualityScale=Math.max(.58,qualityScale-.08);
      else if(fps>54 && qualityScale<.90) qualityScale=Math.min(.90,qualityScale+.04);
      fpsAccum=0; fpsFrames=0; fpsTimer=0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function formatTime(sec){
    if(!isFinite(sec)) return '0:00';
    sec=Math.max(0,Math.floor(sec));
    return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
  }

  async function startPlayback(){
    ensureAudioGraph();
    if(audioCtx.state==='suspended') await audioCtx.resume();
    try { await audio.play(); } catch(e) { console.warn(e); }
  }

  fileInput.addEventListener('change', async e => {
    const f=e.target.files && e.target.files[0]; if(!f) return;
    if(objectURL) URL.revokeObjectURL(objectURL);
    objectURL=URL.createObjectURL(f);
    audio.src=objectURL;
    fileName.textContent=f.name;
    statusEl.textContent='Loaded — press play';
    playBtn.disabled=false;
    seek.disabled=false;
    resetJourney();
    ensureAudioGraph();
    if(audioCtx.state==='suspended') await audioCtx.resume();
  });

  playBtn.addEventListener('click', async () => {
    if(audio.paused){ await startPlayback(); } else audio.pause();
  });
  audio.addEventListener('play',()=>{ playBtn.textContent='Ⅱ'; statusEl.textContent='DRIFTING'; });
  audio.addEventListener('pause',()=>{ playBtn.textContent='▶'; statusEl.textContent=audio.currentTime>0?'Paused':'Ready'; });
  audio.addEventListener('ended',()=>{ playBtn.textContent='▶'; statusEl.textContent='Finished'; });
  loopBtn.addEventListener('click',()=>{
    audio.loop=!audio.loop; loopBtn.setAttribute('aria-pressed',audio.loop?'true':'false');
  });
  seek.addEventListener('input',()=>{ if(isFinite(audio.duration)) audio.currentTime=parseFloat(seek.value); });
  shuffleBtn.addEventListener('click',resetJourney);
  fullBtn.addEventListener('click',async()=>{
    try {
      if(!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch(e) { console.warn(e); }
  });

  let hideTimer=null;
  function showUI(){
    ui.classList.add('visible');
    clearTimeout(hideTimer);
    if(!audio.paused) hideTimer=setTimeout(()=>ui.classList.remove('visible'),5500);
  }
  document.addEventListener('pointermove',showUI,{passive:true});
  document.addEventListener('pointerdown',e=>{
    if(e.target===canvas || e.target.id==='vignette'){
      ui.classList.toggle('visible');
      if(ui.classList.contains('visible')) showUI();
    }
  },{passive:true});
  audio.addEventListener('play',showUI);
  resetJourney();
})();
