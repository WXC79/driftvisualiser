(() => {
  'use strict';
  const DRIFT_BUILD = '13.19';

  const canvas = document.getElementById('gl');
  const audio = document.getElementById('audio');
  const fileInput = document.getElementById('fileInput');
  const fileName = document.getElementById('fileName');
  const playBtn = document.getElementById('playBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const queueCount = document.getElementById('queueCount');
  const loopBtn = document.getElementById('loopBtn');
  const freeDriftBtn = document.getElementById('freeDriftBtn');
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
  const sceneMode = document.getElementById('sceneMode');
  const closeUiBtn = document.getElementById('closeUiBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // Desktop pointer auto-hide: disappear after brief inactivity, reappear
  // immediately as soon as the mouse moves again. Touch devices are untouched.
  let cursorHideTimer=null;
  function showPointerTemporarily(){
    if(isTouchDevice) return;
    document.documentElement.classList.remove('cursorHidden');
    clearTimeout(cursorHideTimer);
    cursorHideTimer=setTimeout(()=>{
      document.documentElement.classList.add('cursorHidden');
    },1800);
  }
  if(!isTouchDevice){
    window.addEventListener('mousemove',showPointerTemporarily,{passive:true});
    window.addEventListener('mousedown',showPointerTemporarily,{passive:true});
    window.addEventListener('mouseenter',showPointerTemporarily,{passive:true});
    showPointerTemporarily();
  }
  if (isStandalone) {
    fullBtn.title = 'Running as a Home Screen web app';
    fullBtn.setAttribute('aria-label', 'Home Screen app mode');
  }


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

  float cloudDensity(vec3 p,float fog,float openness,float motion,float pulse,float activity){
    vec3 advect=vec3(uTime*(0.000099+motion*0.000057+activity*0.000041),uTime*0.000036,-uTime*(0.000072+motion*0.000050));
    vec3 pp=p+advect;
    pp.y += sin(pp.x*0.010+uTime*0.245)*0.5*activity;
    pp.z += sin(pp.y*0.013-uTime*0.218)*0.7*(pulse*0.55+activity*0.18);
    float large=noise3(pp*0.0102+vec3(uSeed.x*0.071,uSeed.y*0.053,2.1));
    float body=noise3(pp*0.0185+vec3(6.0+uSeed.x*0.02,-2.0,11.0+uSeed.y*0.03));
    float detail=noise3(pp*0.0375+vec3(13.0+uSeed.y*0.03,-7.0,5.0+uSeed.x*0.02));
    float field=large*0.68+body*0.24+detail*0.08;
    float threshold=0.534+openness*0.12-fog*0.11;
    threshold -= (uAudioSlow.x-0.5)*0.055*uIntensity;
    threshold -= (uAudioSlow.y-0.5)*0.015*uIntensity;
    threshold -= activity*0.006;
    float d=smoothstep(threshold,threshold+0.145,field);
    d=pow(d,1.14);
    d *= 0.92 + uAudioSlow.w*0.15 + activity*0.035;
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
    float brightness=uAudio1.x, flux=uAudio1.y, pulse=uAudio1.z, activity=uAudio1.w;

    float fogBase=sunrise*0.22+blue*0.15+sunlight*0.15+mist*0.58+darkP*0.76+storm*0.94+sunset*0.24+night*0.62;
    float openBase=sunrise*0.80+blue*0.93+sunlight*0.92+mist*0.24+darkP*0.05+storm*0.03+sunset*0.79+night*0.16;
    float grainBase=sunrise*0.030+blue*0.022+sunlight*0.030+mist*0.29+darkP*0.085+storm*0.160+sunset*0.042+night*0.108;
    float ambient=sunrise*0.73+blue*0.76+sunlight*0.84+mist*0.45+darkP*0.22+storm*0.085+sunset*0.70+night*0.082;

    float fog=clamp((fogBase/0.75)*(0.95+(uAudioSlow.x-0.5)*0.14*uIntensity + (uAudioSlow.w-0.5)*0.035*uIntensity),0.0,1.0);
    float openness=clamp((openBase/0.75)+(brightness-0.5)*0.040*uIntensity+(uAudioSlow.z-0.5)*0.015*uIntensity - storm*0.04 - night*0.04,0.0,1.0);
    float motion=0.72 + uAudioSlow.y*0.58 + flux*0.10 + activity*0.10 + pulse*0.035;
    float grainState=clamp((grainBase/0.75)*(0.72+uAudioSlow.z*0.68+activity*0.12)*uGrain,0.0,1.9);

    vec3 forward=normalize(uLook);
    vec3 worldUp=vec3(0,1,0);
    vec3 right=normalize(cross(forward,worldUp));
    vec3 up=normalize(cross(right,forward));
    vec3 rd=normalize(forward+right*q.x*0.84+up*q.y*0.61);
    vec3 ro=uCamera;

    float skyY=clamp(0.48+rd.y*0.55,0.0,1.0);
    vec3 blueSky=mix(vec3(0.72,0.82,0.90),vec3(0.10,0.34,0.62),skyY);
    vec3 sunlightSky=mix(vec3(0.98,0.98,0.94),vec3(0.56,0.76,0.92),skyY);
    float mistY=smoothstep(0.0,1.0,skyY);
    vec3 mistSky=mix(vec3(0.50,0.56,0.62),vec3(0.25,0.32,0.39),mistY);
    vec3 sunriseSky=mix(vec3(1.00,0.60,0.30),vec3(0.46,0.39,0.54),skyY);
    vec3 sunsetSky=mix(vec3(0.92,0.44,0.30),vec3(0.30,0.25,0.40),skyY);
    vec3 darkSky=mix(vec3(0.56,0.57,0.58),vec3(0.22,0.23,0.24),skyY);
    vec3 stormSky=mix(vec3(0.105,0.108,0.112),vec3(0.060,0.064,0.070),skyY);
    float nightY=smoothstep(0.12,0.88,skyY);
    vec3 nightSky=mix(vec3(0.007,0.010,0.017),vec3(0.013,0.017,0.027),nightY);

    vec3 sky=blueSky;
    sky=mix(sky,sunlightSky,sunlight*0.985);
    sky=mix(sky,sunriseSky,sunrise*0.98);
    sky=mix(sky,mistSky,mist*0.985);
    sky=mix(sky,darkSky,darkP*0.97);
    sky=mix(sky,stormSky,storm*1.00);
    sky=mix(sky,sunsetSky,sunset*0.96);
    sky=mix(sky,nightSky,night*1.00);

    float sunAz=uTime*0.043+uSeed.x;
    float sunEl=0.16+0.30*sin(uTime*0.029+uSeed.y);
    vec3 sunDir=normalize(vec3(cos(sunAz)*cos(sunEl),sin(sunEl),sin(sunAz)*cos(sunEl)));
    float moonAz=uTime*0.019+uSeed.y+2.3;
    float moonEl=0.24+0.13*sin(uTime*0.016+uSeed.x);
    vec3 moonDir=normalize(vec3(cos(moonAz)*cos(moonEl),sin(moonEl),sin(moonAz)*cos(moonEl)));
    float sunDot=max(0.0,dot(rd,sunDir));
    float moonDot=max(0.0,dot(rd,moonDir));

    float sunPresence=clamp(sunrise+sunlight+sunset+darkP*0.18,0.0,1.0)*(1.0-night)*(1.0-storm*0.92);
    float moonCycle=pow(max(0.0,sin(uTime*0.043+uSeed.x*1.71+uSeed.y*0.63)),7.0);
    float moonPresence=night*(0.72+moonCycle*0.58);
    vec3 sunColor=mix(vec3(1.00,0.78,0.38),vec3(1.00,0.66,0.36),sunrise*0.90);
    sunColor=mix(sunColor,vec3(0.96,0.49,0.30),sunset*0.95);
    vec3 moonColor=vec3(0.62,0.72,0.90);
    sky += moonColor*pow(moonDot,6.4)*moonPresence*(0.020+moonCycle*0.060);
    float sunlightSkyHaze=sunlight*(0.070 + pow(sunDot,1.55)*0.155);
    sky += vec3(1.00,0.92,0.66)*sunlightSkyHaze;
    sky += vec3(1.00,0.97,0.88) * sunlight * 0.020;
    float sunriseSkyGlow=pow(sunDot,3.0)*sunrise*(0.020+0.050*pow(max(0.0,sin(uTime*0.035+uSeed.x*1.41+uSeed.y*0.53)),6.0));
    sky += sunColor * sunriseSkyGlow;

    vec3 accum=vec3(0.0);
    float trans=1.0;
    float previousDensity=0.0;
    const int STEPS=14;
    float maxDistance=180.0;
    float stepLength=maxDistance/float(STEPS);

    for(int i=0;i<STEPS;i++){
      float dist=(float(i)+0.38)*stepLength;
      vec3 p=ro+rd*dist;
      vec3 movingP=p+vec3(uTime*0.00178*motion,uTime*0.00050,-uTime*0.00128*motion);
      float dens=cloudDensity(movingP,fog,openness,motion,pulse,activity);
      float farPresence=0.82+smoothstep(76.0,142.0,dist)*0.17;
      float nearSeparation=0.90+smoothstep(18.0,62.0,dist)*0.10;
      dens*=farPresence*nearSeparation;
      dens*=1.0 + night*clamp(q.x,-1.0,1.0)*0.085;
      dens*=0.90+darkP*0.22+storm*0.42+mist*0.16 + (uAudioSlow.x-0.5)*0.10*uIntensity + activity*0.018;
      dens*=1.0-smoothstep(142.0,182.0,dist);
      dens=clamp(dens,0.0,1.0);

      float edge=max(0.0,dens-previousDensity);
      float exitEdge=max(0.0,previousDensity-dens);
      float interior=pow(dens,1.50);
      float distanceDepth=clamp(dist/180.0,0.0,1.0);

      vec3 dayShadow=vec3(0.16,0.21,0.28);
      vec3 dayLight=vec3(0.90,0.92,0.94);
      dayShadow=mix(dayShadow,vec3(0.36,0.22,0.27),sunrise*0.68);
      dayLight=mix(dayLight,vec3(1.00,0.71,0.46),sunrise*0.94);
      dayShadow=mix(dayShadow,vec3(0.66,0.68,0.66),sunlight*0.88);
      dayLight=mix(dayLight,vec3(0.98,0.97,0.91),sunlight*0.92);
      dayShadow=mix(dayShadow,vec3(0.38,0.22,0.24),sunset*0.74);
      dayLight=mix(dayLight,vec3(0.90,0.56,0.52),sunset*0.90);
      dayShadow=mix(dayShadow,vec3(0.085,0.090,0.095),darkP);
      dayLight=mix(dayLight,vec3(0.36,0.37,0.39),darkP*0.98);
      dayShadow=mix(dayShadow,vec3(0.070,0.073,0.078),storm);
      dayLight=mix(dayLight,vec3(0.155,0.160,0.168),storm);

      vec3 nightShadow=vec3(0.009,0.012,0.022);
      vec3 nightLight=vec3(0.082,0.096,0.130);
      vec3 shadow=mix(dayShadow,nightShadow,night);
      vec3 lit=mix(dayLight,nightLight,night);

      float bodyLight=clamp(0.61-interior*0.45-darkP*0.20-storm*0.40-night*0.30-sunset*0.10+ambient*0.07+blue*0.045+sunlight*0.08,0.018,0.88);
      float lightCap = 0.88 + sunlight*0.03 - night*0.15 - sunset*0.12 - storm*0.13;
      bodyLight=clamp(bodyLight+(brightness-0.5)*0.030*uIntensity + (uAudioSlow.z-0.5)*0.018*uIntensity + pulse*0.003 + activity*0.008,0.018,lightCap);
      vec3 cloud=mix(shadow,lit,bodyLight);
      float sunTextureA=noise3(movingP*0.027 + vec3(4.0,11.0,19.0));
      float sunTextureB=noise3(movingP*0.061 + vec3(17.0,3.0,8.0));
      float sunTextureC=noise3(movingP*0.110 + vec3(2.0,21.0,5.0));
      float sunTexture=sunTextureA*0.50 + sunTextureB*0.28 + sunTextureC*0.22;
      vec3 sunlightBodyShadow=mix(vec3(0.60,0.62,0.62),vec3(0.75,0.76,0.74),sunTexture);
      vec3 sunlightBodyLight=mix(vec3(0.84,0.85,0.82),vec3(0.95,0.94,0.88),sunTexture);
      vec3 sunlightBody=mix(sunlightBodyShadow,sunlightBodyLight,clamp(bodyLight*0.78+edge*0.18,0.0,1.0));
      cloud=mix(cloud,sunlightBody,sunlight*(0.42+edge*0.06));
      float greyVar = noise3(movingP*0.020 + vec3(9.0, 3.0, 6.0));
      vec3 rainGrey = mix(vec3(0.17,0.18,0.19), vec3(0.53,0.53,0.54), greyVar);
      cloud = mix(cloud, rainGrey, (darkP*0.34 + storm*0.16) * (0.44 + 0.56*dens));
      float darkPocket = noise3(movingP*0.015 + vec3(17.0, 1.0, 4.0));
      vec3 darkPocketGrey = mix(vec3(0.10,0.11,0.12), vec3(0.26,0.27,0.28), darkPocket);
      cloud = mix(cloud, darkPocketGrey, darkP * (0.10 + 0.32*darkPocket) * (0.40 + 0.60*dens));
      vec3 moodTint = sunriseSky*(sunrise*0.42) + sunsetSky*(sunset*0.50) + darkSky*(darkP*0.44) + stormSky*(storm*0.30) + nightSky*(night*0.42);
      float tintAmt = clamp(sunrise*0.20 + sunset*0.32 + darkP*0.29 + storm*0.14 + night*0.24, 0.0, 0.44);
      cloud = mix(cloud, mix(cloud, moodTint, 0.64), tintAmt * (0.60 + 0.40*dens));
      vec3 atmosphericCloud=mix(cloud,vec3(0.50,0.53,0.57),distanceDepth*0.07*(1.0-storm*0.94)*(1.0-night));
      atmosphericCloud=mix(atmosphericCloud, vec3(0.83,0.83,0.79), sunlight*distanceDepth*0.040);
      cloud=mix(cloud,atmosphericCloud,distanceDepth*(0.42-darkP*0.14-storm*0.22-night*0.12));
      cloud+=lit*edge*(0.34+uAudioSlow.z*0.18*uIntensity + pulse*0.030);
      cloud+=shadow*exitEdge*(0.10+bass*0.08);

      float flashA=pow(max(0.0,sin(uTime*0.73+2.1)),72.0);
      float flashB=pow(max(0.0,sin(uTime*0.41+5.4)),86.0)*0.72;
      float lightning=(flashA+flashB)*storm*(0.64+flux*0.70+activity*0.25);
      vec3 flashCenter=ro+forward*82.0+right*(sin(uTime*0.17+uSeed.x)*34.0)+up*(cos(uTime*0.13+uSeed.y)*18.0);
      vec3 fd=(p-flashCenter)/vec3(42.0,30.0,48.0);
      float localFlash=exp(-dot(fd,fd)*2.6);
      cloud+=vec3(1.00,0.66,0.16)*lightning*localFlash*dens*(0.32+edge*1.20+(1.0-interior)*0.24);

      float sunFacing=sunDot*sunDot;
      float sunCycle=pow(max(0.0,sin(uTime*0.035+uSeed.x*1.41+uSeed.y*0.53)),6.0);
      float sunEdge=edge*(0.10+sunFacing*0.72)*sunPresence;
      float sunInteriorGlow=(1.0-interior)*pow(sunDot,4.0)*sunPresence*(0.013 + sunrise*0.008 + sunset*0.003);
      float sunlightBounce=sunlight*(0.34+sunFacing*0.82)*(1.0-interior)*(0.58+edge*1.92) + sunrise*(0.12+sunFacing*0.22)*(1.0-interior)*(0.48+edge*1.86);
      float sunlightRim=edge*sunFacing*sunlight*(0.36+0.70*sunCycle)*(0.82+0.18*(1.0-interior));
      float sunriseRim=edge*sunFacing*sunrise*(0.08+0.24*sunCycle)*(0.74+0.26*(1.0-interior));
      float musicSun=0.92+brightness*0.24+uAudioSlow.z*0.15+pulse*0.018;
      cloud+=sunColor*(sunEdge*(0.22+sunlight*0.30+sunrise*0.22)+sunInteriorGlow+sunlightBounce*0.22+sunlightRim+sunriseRim)*musicSun*(1.0 - sunset*0.08 - night*0.50);
      float shimmerNoise=noise3(movingP*0.052 + vec3(23.0,7.0,uTime*0.055));
      float shimmerPulse=0.55+0.45*sin(uTime*0.42 + sunTextureA*5.6 + movingP.x*0.012);
      float yellowShimmer=edge*sunlight*(0.30+0.54*sunFacing)*(0.45+0.55*shimmerNoise)*(0.70+0.30*shimmerPulse);
      float sparkleNoise=smoothstep(0.52,0.86,noise3(movingP*0.15 + vec3(31.0,9.0,uTime*0.11)));
      float yellowSparkle=edge*sunlight*(0.22+0.34*sunFacing)*sparkleNoise*(0.50+0.50*shimmerPulse)*(0.35+0.65*shimmerNoise);
      float thinGlow=sunlight*(1.0-interior)*dens*(0.028+0.058*sunFacing)*(0.40+0.60*sunTexture);
      cloud += vec3(1.00,0.78,0.24) * (yellowShimmer*2.20 + thinGlow*0.80);
      cloud += vec3(1.00,0.72,0.10) * yellowSparkle * 0.52;
      cloud += vec3(0.98,0.93,0.74) * edge * sunlight * (0.018 + 0.032*sunFacing);

      vec3 sunriseEdgeTint = vec3(1.00,0.62,0.34);
      vec3 sunsetEdgeTint = vec3(0.98,0.60,0.72);
      cloud += sunriseEdgeTint * edge * sunrise * 0.095 * (0.72 + 0.28*dens);
      cloud += sunsetEdgeTint * edge * sunset * 0.082 * (0.72 + 0.28*dens);

      float moonFacing=moonDot*moonDot;
      float moonEdge=edge*(0.18+moonFacing*1.72)*moonPresence;
      float moonInteriorGlow=(1.0-interior)*pow(moonDot,3.6)*moonPresence*(0.010+moonCycle*0.018);
      float moonRimBurst=edge*moonFacing*night*moonCycle*0.46*(0.65+0.35*(1.0-interior));
      float moonBounce=night*(1.0-interior)*(0.020+moonFacing*0.045)*(0.55+0.45*moonCycle);
      cloud+=moonColor*(moonEdge*(0.92+moonCycle*0.42)+moonInteriorGlow+moonRimBurst+moonBounce);

      float alpha=1.0-exp(-dens*stepLength*0.050);
      accum+=trans*cloud*alpha;
      trans*=1.0-alpha;
      previousDensity=dens;
      if(trans<0.02) break;
    }

    vec3 base=accum+sky*trans;
    float cloudImmersion=1.0-trans;
    float sunCycle=pow(max(0.0,sin(uTime*0.035+uSeed.x*1.41+uSeed.y*0.53)),6.0);
    float sunlightHaze=pow(sunDot,1.65)*(sunlight*(0.080+sunCycle*0.110) + sunrise*(0.018+sunCycle*0.062));
    float sunlightBurst=pow(max(0.0,sin(uTime*0.022+uSeed.x*1.17+uSeed.y*0.39)),8.0);
    float sunlightBeam=pow(sunDot,4.8) * sunlight * sunlightBurst * (0.30+0.90*cloudImmersion);
    float beamBand1=0.55+0.45*noise2(vec2(atan(rd.z,rd.x)*6.0 + uTime*0.013, rd.y*8.2 + uSeed.x*2.0));
    float beamBand2=0.55+0.45*noise2(vec2(atan(rd.z,rd.x)*9.0 - uTime*0.010, rd.y*10.5 + uSeed.y*2.4));
    float beamColumn=smoothstep(0.18,0.92,sunDot);
    float sunbeam = sunlightBeam * beamBand1 * beamBand2 * beamColumn;
    float moonHaze=pow(moonDot,4.3)*night*(0.014+moonCycle*0.070);
    base+=sunColor*(sunlightHaze*(0.38+0.62*trans));
    base += vec3(1.00,0.90,0.56) * sunbeam * 0.32;
    base += vec3(1.00,0.96,0.80) * sunlight * sunlightBurst * pow(sunDot,2.0) * 0.040;
    base = mix(base, base + vec3(0.038,0.030,0.010), sunlight*0.40);
    base+=moonColor*(pow(moonDot,4.0)*moonPresence*0.018 + moonHaze*(0.35+0.65*trans));

    vec2 grainUV1=vec2(uv.x*431.7+uv.y*163.1, uv.x*-247.3+uv.y*389.4);
    vec2 grainUV2=vec2(uv.x*911.2-uv.y*507.6, uv.x*281.5+uv.y*769.8);
    float fineGrain=noise2(grainUV1+vec2(uTime*0.13,-uTime*0.09)+uSeed*1.7)-0.5;
    float microGrain=noise2(grainUV2+vec2(-uTime*0.41,uTime*0.33)+uSeed*4.1)-0.5;
    float dotNoise=smoothstep(0.84,1.0,noise2(grainUV2*1.73+vec2(uTime*0.71,-uTime*0.57)+uSeed*7.3));
    float grainEnvelope=grainState*(0.24+cloudImmersion*0.76)*(0.82+uAudioSlow.z*0.30+activity*0.06);
    base+=fineGrain*grainEnvelope*0.028;
    base+=microGrain*grainEnvelope*0.017;
    base+=dotNoise*grainEnvelope*0.010;

    base=mix(base,vec3(0.61,0.64,0.66),mist*cloudImmersion*0.070);
    base=mix(base, vec3(min(base.r+0.010,1.0), min(base.g+0.008,1.0), min(base.b+0.002,1.0)), sunlight*0.14);
    base=mix(base,vec3(0.43,0.44,0.45),darkP*(1.0-cloudImmersion)*0.018);
    base=mix(base,vec3(0.20,0.21,0.22),storm*(1.0-cloudImmersion)*0.020);
    base=mix(base, vec3(0.13,0.14,0.17), night*cloudImmersion*0.040);
    float skyDither=(noise2(uv*vec2(503.0,337.0)+vec2(uTime*0.07,-uTime*0.05)+uSeed*2.3)-0.5);
    float mistDither=(noise2(vec2(uv.x*719.3+uv.y*211.7, uv.x*-317.9+uv.y*631.1)+uSeed*5.7)-0.5);
    base += vec3(skyDither) * (storm*0.008 + sunrise*0.003 + sunset*0.003) * (0.75 - cloudImmersion*0.30);
    base += vec3(mistDither) * mist * 0.004 * (0.85 - cloudImmersion*0.25);
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
  let manualScene = null; // null = AUTO; 0...7 = locked scene
  let transitionStart = 0;
  let transitionDuration = 46;
  let nextDecision = 78;
  let seed = [Math.random()*100, Math.random()*100];
  const transitionFrom = new Float32Array(8);

  const SHOWCASE_SRC = './the-cloud-chris-weeks.mp3';
  const SHOWCASE_LABEL = 'The Cloud — Chris Weeks';
  let usingShowcaseTrack = true;
  let freeDriftActive = false;
  let freeDriftClock = 0;
  let freeDriftNextMood = 0;
  let freeTargets = {
    bass:.46, mid:.48, high:.44, overall:.48, brightness:.50,
    flux:.12, pulse:.04, activity:.28, rhythm:.10
  };
  let objectURL = null; // retained for compatibility with older cleanup paths
  let playlist = [];
  let playlistIndex = -1;
  let audioCtx = null;
  let outputGain = null;
  let sourceNode = null;
  let analyser = null;
  let freq = null;
  let prevFreq = null;
  let timeDomain = null;
  let audioReady = false;

  const CALIBRATION_SECONDS = 14;
  let calibrated = false;

  const A = {
    bass:.5, mid:.5, high:.5, overall:.5, brightness:.5, flux:.0, pulse:.0, activity:.0, rhythm:.0,
    slowBass:.5, slowMid:.5, slowHigh:.5, slowOverall:.5,
    baseBass:.1, baseMid:.1, baseHigh:.1, baseOverall:.1, baseFlux:.06, baseBright:.2,
    devBass:.08, devMid:.08, devHigh:.08, devOverall:.08, devFlux:.04, devBright:.05
  };

  function ensureAudioGraph() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.52;
    outputGain = audioCtx.createGain();
    outputGain.gain.value = 1;
    sourceNode.connect(analyser);
    analyser.connect(outputGain);
    outputGain.connect(audioCtx.destination);
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

  function adaptiveMetric(raw, keyBase, keyDev, dt, baseRate, devRate, scale) {
    const base=A[keyBase];
    const dev=A[keyDev];
    A[keyBase] = expSmooth(base, raw, baseRate, dt);
    A[keyDev] = expSmooth(dev, Math.abs(raw-A[keyBase]), devRate, dt);
    const z=(raw-A[keyBase]) / Math.max(0.02, A[keyDev]*scale);
    return clamp01(0.5+z*0.5);
  }

  function chooseFreeDriftMood(now){
    // Independent, bounded targets: random enough to keep evolving, slow enough
    // to feel like weather rather than a parameter randomizer.
    freeTargets.bass = 0.24 + Math.random()*0.54;
    freeTargets.mid = 0.26 + Math.random()*0.50;
    freeTargets.high = 0.18 + Math.random()*0.58;
    freeTargets.overall = 0.28 + Math.random()*0.48;
    freeTargets.brightness = 0.20 + Math.random()*0.64;
    freeTargets.flux = 0.03 + Math.random()*0.34;
    freeTargets.pulse = Math.random()*0.10;
    freeTargets.activity = 0.12 + Math.random()*0.55;
    freeTargets.rhythm = Math.random()*0.24;
    freeDriftNextMood = now + 16 + Math.random()*34;
  }

  function updateFreeDrift(now,dt){
    if(now >= freeDriftNextMood) chooseFreeDriftMood(now);

    // Very slow autonomous movement between randomly chosen moods.
    A.bass = expSmooth(A.bass, freeTargets.bass, 0.055, dt);
    A.mid = expSmooth(A.mid, freeTargets.mid, 0.050, dt);
    A.high = expSmooth(A.high, freeTargets.high, 0.050, dt);
    A.overall = expSmooth(A.overall, freeTargets.overall, 0.045, dt);
    A.brightness = expSmooth(A.brightness, freeTargets.brightness, 0.040, dt);
    A.flux = expSmooth(A.flux, freeTargets.flux, 0.060, dt);
    A.pulse = expSmooth(A.pulse, freeTargets.pulse, 0.070, dt);
    A.activity = expSmooth(A.activity, freeTargets.activity, 0.045, dt);
    A.rhythm = expSmooth(A.rhythm, freeTargets.rhythm, 0.038, dt);

    A.slowBass=expSmooth(A.slowBass,A.bass,0.10,dt);
    A.slowMid=expSmooth(A.slowMid,A.mid,0.095,dt);
    A.slowHigh=expSmooth(A.slowHigh,A.high,0.10,dt);
    A.slowOverall=expSmooth(A.slowOverall,A.overall,0.085,dt);

    statusEl.textContent='FREE DRIFT · AUTO';
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
      flux += Math.abs(freq[i]-prevFreq[i])/255;
      prevFreq[i]=freq[i];
    }
    const centroid=mag>0 ? weighted/mag/(freq.length-1) : 0;
    flux=clamp01(flux/freq.length*9.5);

    const calib = clamp01(audio.currentTime / CALIBRATION_SECONDS);
    calibrated = calib >= 0.999;
    const baseRate = calibrated ? 0.10 : 0.65;
    const devRate = calibrated ? 0.18 : 0.90;
    const fluxBaseRate = calibrated ? 0.14 : 0.70;
    const fluxDevRate = calibrated ? 0.20 : 0.95;

    const bass=adaptiveMetric(rb,'baseBass','devBass',dt,baseRate,devRate,1.85);
    const mid=adaptiveMetric(rm,'baseMid','devMid',dt,baseRate,devRate,1.90);
    const high=adaptiveMetric(rh,'baseHigh','devHigh',dt,baseRate,devRate,1.90);
    const overall=adaptiveMetric(rms,'baseOverall','devOverall',dt,baseRate,devRate,2.05);
    const bright=adaptiveMetric(centroid,'baseBright','devBright',dt,baseRate*0.9,devRate*0.9,1.80);
    const fluxMetric=adaptiveMetric(flux,'baseFlux','devFlux',dt,fluxBaseRate,fluxDevRate,2.90);

    const lowPunch = clamp01((bass - A.slowBass) * 1.15 + fluxMetric*0.08);
    const transient = clamp01((overall - A.slowOverall) * 1.20 + fluxMetric*0.16 + lowPunch*0.12);
    const tonalMovement = clamp01(Math.abs(bass-A.slowBass)*0.95 + Math.abs(mid-A.slowMid)*1.10 + Math.abs(high-A.slowHigh)*1.05);

    // Sustained rhythmic energy: repeated transients/flux gradually raise the climate
    // over several seconds, rather than making individual beats punch the picture.
    const rhythmTarget = clamp01(fluxMetric*0.46 + transient*0.28 + lowPunch*0.16 + mid*0.10);
    const rhythmRate = rhythmTarget > A.rhythm ? 0.32 : 0.12;
    A.rhythm = expSmooth(A.rhythm, rhythmTarget, rhythmRate, dt);

    const activityTarget = clamp01(
      A.slowOverall*0.18 + mid*0.19 + high*0.11 + tonalMovement*0.34 +
      fluxMetric*0.07 + transient*0.03 + A.rhythm*0.08
    );

    A.pulse=expSmooth(A.pulse, transient, 3.0, dt);
    A.bass=expSmooth(A.bass,bass,5.2,dt);
    A.mid=expSmooth(A.mid,mid,4.7,dt);
    A.high=expSmooth(A.high,high,5.0,dt);
    A.overall=expSmooth(A.overall,overall,4.2,dt);
    A.brightness=expSmooth(A.brightness,bright,3.6,dt);
    A.flux=expSmooth(A.flux,fluxMetric,2.1,dt);
    A.activity=expSmooth(A.activity,activityTarget,1.7,dt);

    A.slowBass=expSmooth(A.slowBass,A.bass,0.22,dt);
    A.slowMid=expSmooth(A.slowMid,A.mid,0.20,dt);
    A.slowHigh=expSmooth(A.slowHigh,A.high,0.22,dt);
    A.slowOverall=expSmooth(A.slowOverall,A.overall,0.18,dt);

    if (!calibrated) {
      statusEl.textContent = `Calibrating ${Math.max(0, Math.ceil(CALIBRATION_SECONDS - audio.currentTime))}s`;
    } else if (!audio.paused) {
      statusEl.textContent = manualScene === null ? 'DRIFTING · AUTO' : `Scene locked · ${SCENES[manualScene]}`;
    }
  }

  function pickScene(now) {
    const e=A.slowOverall, b=A.slowBass, m=A.slowMid, h=A.slowHigh, br=A.brightness, f=A.flux, p=A.pulse, act=A.activity, rhy=A.rhythm;
    const s = new Float32Array(8);
    s[0] = 0.16 + br*0.24 + h*0.14 + (1-Math.abs(e-0.48))*0.16 + (1-f)*0.05;     // sunrise
    s[1] = 0.15 + br*0.26 + (1-b)*0.12 + (1-f)*0.04;                                // blue
    s[2] = 0.10 + br*0.34 + h*0.14 + act*0.14 + p*0.03 + rhy*0.06;                  // sunlight
    s[3] = 0.12 + (1-e)*0.24 + (1-br)*0.12 + m*0.06;                                // mist
    s[4] = 0.10 + b*0.24 + (1-br)*0.28 + (1-h)*0.08 + act*0.05;                     // dark
    s[5] = 0.04 + f*0.54 + act*0.28 + b*0.16 + p*0.06 + rhy*0.14;                  // storm
    s[6] = 0.11 + (1-Math.abs(e-0.48))*0.15 + (1-br)*0.16 + h*0.10 + act*0.06;      // sunset
    s[7] = 0.08 + (1-br)*0.32 + (1-e)*0.28 + b*0.10 + (1-h)*0.06;                   // night

    for(let i=0;i<8;i++){
      s[i] *= 0.92 + Math.random()*0.18;
      if (i===currentScene) s[i] *= 0.40;
    }

    if (act > 0.62 || f > 0.58) {
      s[5] *= 1.45;
      s[2] *= 1.10;
      s[1] *= 0.78;
      s[7] *= 0.86;
    }
    if (e < 0.42 && br < 0.44) {
      s[3] *= 1.12;
      s[4] *= 1.18;
      s[7] *= 1.26;
      s[2] *= 0.72;
    }
    if (br > 0.58 && f < 0.34) {
      s[0] *= 1.28;
      s[6] *= 1.10;
    }

    let total=0; for(const v of s) total+=v;
    let r=Math.random()*total, chosen=1;
    for(let i=0;i<8;i++){ r-=s[i]; if(r<=0){ chosen=i; break; } }

    for(let i=0;i<8;i++) transitionFrom[i]=sceneWeights[i];
    targetScene=chosen;
    transitionStart=now;
    // 12.9: intentionally slow, atmospheric scene changes.
    transitionDuration=calibrated ? (38 + (1-act)*12 + Math.random()*12) : 42;
    const dwellAfterTransition = 42 + (1-act)*22 + Math.random()*22;
    nextDecision=now + transitionDuration + dwellAfterTransition;
  }

  function resetJourney() {
    seed=[Math.random()*100,Math.random()*100];
    const startScene = manualScene === null ? 1 : manualScene;
    currentScene=startScene; targetScene=startScene;
    sceneWeights.fill(0); sceneWeights[startScene]=1;
    transitionStart=performance.now()/1000;
    for(let i=0;i<8;i++) transitionFrom[i]=sceneWeights[i];
    nextDecision=transitionStart+72;
    camera.x=0; camera.y=0; camera.z=0; travel=0; yaw=0; pitch=0;

    calibrated = false;
    previewInitialized = false;
    Object.assign(A, {
      bass:.5, mid:.5, high:.5, overall:.5, brightness:.5, flux:.0, pulse:.0, activity:.0, rhythm:.0,
      slowBass:.5, slowMid:.5, slowHigh:.5, slowOverall:.5,
      baseBass:.1, baseMid:.1, baseHigh:.1, baseOverall:.1, baseFlux:.06, baseBright:.2,
      devBass:.08, devMid:.08, devHigh:.08, devOverall:.08, devFlux:.04, devBright:.05
    });
    sceneEl.textContent=manualScene === null ? SCENES[1] : SCENES[manualScene];
    statusEl.textContent='Loaded — press play';
  }

  function updateScenes(now,dt) {
    if (manualScene === null) {
      if (calibrated && now>=nextDecision && (freeDriftActive || (audioReady ? !audio.paused : true))) pickScene(now);
    } else if (targetScene !== manualScene) {
      for(let i=0;i<8;i++) transitionFrom[i]=sceneWeights[i];
      targetScene = manualScene;
      transitionStart = now;
      transitionDuration = 18.0;
    }
    const mixDur=Math.max(1,transitionDuration);
    const t=clamp01((now-transitionStart)/mixDur);
    // Quintic smoothstep: slower departure and arrival than the previous crossfade.
    const eased=t*t*t*(t*(t*6.0-15.0)+10.0);
    for(let i=0;i<8;i++) {
      const targetWeight = i===targetScene ? 1.0 : 0.0;
      sceneWeights[i] = transitionFrom[i] + (targetWeight-transitionFrom[i])*eased;
    }
    let best=0; for(let i=1;i<8;i++) if(sceneWeights[i]>sceneWeights[best]) best=i;
    if(t>=1 && currentScene!==targetScene) currentScene=targetScene;
    sceneEl.textContent=SCENES[best];
  }

  const camera={x:0,y:0,z:0};
  let yaw=0,pitch=0,travel=0;

  function updateCamera(t,dt) {
    const desiredYaw=Math.sin(t*0.033+seed[0])*0.44+Math.sin(t*0.011+seed[1])*0.28 + (A.slowMid-0.5)*0.07;
    yaw=expSmooth(yaw,desiredYaw,0.26 + A.activity*0.15,dt);
    const speedBase=(11.8 + A.slowMid*3.0 + A.slowHigh*0.7 + A.slowOverall*1.4 + A.activity*0.75 + A.rhythm*0.48 + A.pulse*0.08) * 1.06;
    const speed=speedBase*parseFloat(speedSlider.value);
    const direction=yaw+Math.sin(t*0.047+seed[1])*0.10;
    const lateral=(Math.sin(t*0.071+seed[0])*0.70+Math.sin(t*0.023+seed[1])*0.30)*(0.78 + A.activity*0.28 + A.rhythm*0.10);
    camera.x+=(Math.sin(direction)*speed+Math.cos(direction)*lateral)*dt;
    camera.z+=(-Math.cos(direction)*speed+Math.sin(direction)*lateral)*dt;
    travel+=speed*dt;
    const desiredY=Math.sin(t*0.037+seed[1])*12+Math.sin(t*0.081+seed[0])*4.8+Math.sin(travel*0.010)*7 + (A.activity-0.5)*5;
    camera.y=expSmooth(camera.y,desiredY,0.13 + A.activity*0.05,dt);
    const fogMood=sceneWeights[3]*0.58+sceneWeights[4]*0.54+sceneWeights[5]*0.66+sceneWeights[7]*0.39;
    const desiredPitch=Math.sin(t*0.043+seed[1])*0.12+(.5-fogMood)*0.06 + (A.slowHigh-0.5)*0.025;
    pitch=expSmooth(pitch,desiredPitch,0.14 + A.activity*0.03,dt);
  }

  let qualityScale=0.82;
  let fpsAccum=0, fpsFrames=0, fpsTimer=0;
  function resize() {
    const dpr=Math.min(window.devicePixelRatio||1,1.65);
    const rect=canvas.getBoundingClientRect();
    const cssW=Math.max(2,rect.width||innerWidth);
    const cssH=Math.max(2,rect.height||innerHeight);
    let w=Math.max(2,Math.floor(cssW*dpr*qualityScale));
    let h=Math.max(2,Math.floor(cssH*dpr*qualityScale));

    // Large desktop/Retina browser windows can otherwise create a much heavier
    // render target than the phone build was designed around. Keep phone/touch
    // rendering untouched, but cap the long edge on desktop for smoother playback.
    if(!isTouchDevice){
      const maxDesktopEdge=1728;
      const edge=Math.max(w,h);
      if(edge>maxDesktopEdge){
        const scale=maxDesktopEdge/edge;
        w=Math.max(2,Math.floor(w*scale));
        h=Math.max(2,Math.floor(h*scale));
      }
    }

    if(canvas.width!==w||canvas.height!==h){
      canvas.width=w;
      canvas.height=h;
      gl.viewport(0,0,w,h);
    }
  }
  window.addEventListener('resize',resize,{passive:true});

  function logViewportDiagnostics(label){
    try {
      const r=canvas.getBoundingClientRect();
      const vv=window.visualViewport;
      console.info('[DRIFT viewport]', label, {
        standalone: !!(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone),
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: window.screen && window.screen.width,
        screenHeight: window.screen && window.screen.height,
        visualViewportHeight: vv && vv.height,
        safeCanvasHeight: r.height,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      });
    } catch(e) {}
  }
  window.addEventListener('pageshow',()=>setTimeout(()=>logViewportDiagnostics('pageshow'),120));
  window.addEventListener('orientationchange',()=>setTimeout(()=>logViewportDiagnostics('orientationchange'),360));

  let last=performance.now()/1000;
  let hasStarted = false;
  let frozenTime = 0;
  let previewInitialized = false;
  function ensurePreviewFrame() {
    if (previewInitialized) return;
    const startScene = manualScene === null ? 1 : manualScene;
    sceneWeights.fill(0);
    sceneWeights[startScene] = 1;
    currentScene = startScene;
    targetScene = startScene;
    camera.x = 0; camera.y = 0; camera.z = 0;
    yaw = 0.16;
    pitch = 0.02;
    previewInitialized = true;
  }
  function frame(ms) {
    const now=ms/1000;
    let dt=Math.min(.05,Math.max(.001,now-last)); last=now;
    resize();
    const playing = audioReady && !audio.paused && !audio.ended && hasStarted;
    if (freeDriftActive) {
      freeDriftClock += dt;
      updateFreeDrift(now,dt);
      updateScenes(now,dt);
      frozenTime += dt;
      updateCamera(frozenTime,dt);
    } else if (playing) {
      analyseAudio(dt);
      updateScenes(now,dt);
      frozenTime = isFinite(audio.currentTime) ? audio.currentTime : frozenTime + dt;
      updateCamera(frozenTime,dt);
    } else {
      ensurePreviewFrame();
    }
    const t = hasStarted ? frozenTime : 0.0;

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
      // Keep render scale fixed during playback. Changing canvas resolution while
      // running can make the entire image appear to jump, especially with dense grain.
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

  let screenWakeLock=null;
  let backgroundGuarded=false;

  async function requestScreenWakeLock(){
    if(!('wakeLock' in navigator) || document.visibilityState!=='visible' || (!freeDriftActive && audio.paused)) return;
    try {
      if(!screenWakeLock){
        screenWakeLock=await navigator.wakeLock.request('screen');
        screenWakeLock.addEventListener('release',()=>{ screenWakeLock=null; });
      }
    } catch(e) {
      console.warn('Wake Lock unavailable:', e);
    }
  }

  async function releaseScreenWakeLock(){
    if(!screenWakeLock) return;
    try { await screenWakeLock.release(); } catch(e) {}
    screenWakeLock=null;
  }

  function syncTransportState(){
    const actuallyPlaying = !audio.paused && !audio.ended;
    playBtn.dataset.state = actuallyPlaying ? 'pause' : 'play';
    playBtn.setAttribute('aria-label', actuallyPlaying ? 'Pause' : 'Play');
    playBtn.setAttribute('aria-pressed', actuallyPlaying ? 'true' : 'false');
    if(!actuallyPlaying){
      releaseScreenWakeLock();
      if(audio.currentTime>0 && !audio.ended) statusEl.textContent='Paused';
    }
    return actuallyPlaying;
  }

  function guardBackgroundAudio(){
    backgroundGuarded=true;
    try {
      audio.muted=true;
      audio.volume=0;
      if(outputGain) outputGain.gain.value=0;
      audio.pause();
    } catch(e) {}
    try {
      if(audioCtx && audioCtx.state==='running') audioCtx.suspend().catch(()=>{});
    } catch(e) {}
    releaseScreenWakeLock();
    syncTransportState();
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      guardBackgroundAudio();
    } else {
      syncTransportState();
    }
  });
  window.addEventListener('blur',()=>{
    setTimeout(()=>{
      if(document.visibilityState==='hidden') guardBackgroundAudio();
    },180);
  },{capture:true});
  window.addEventListener('pagehide',guardBackgroundAudio,{capture:true});
  window.addEventListener('freeze',guardBackgroundAudio,{capture:true});
  document.addEventListener('freeze',guardBackgroundAudio,{capture:true});
  window.addEventListener('pageshow',syncTransportState);
  window.addEventListener('focus',()=>{
    syncTransportState();
    if(freeDriftActive) requestScreenWakeLock();
  });

  function setFreeDriftSettingsLocked(locked){
    const settings = document.querySelector('.settings');
    if(settings) settings.classList.toggle('freeLocked', locked);
    sceneMode.disabled = locked;
    intensitySlider.disabled = locked;
    speedSlider.disabled = locked;
    grainSlider.disabled = locked;
  }

  function stopFreeDrift(showStatus=true){
    if(!freeDriftActive) return;
    freeDriftActive=false;
    freeDriftBtn.setAttribute('aria-pressed','false');
    setFreeDriftSettingsLocked(false);
    releaseScreenWakeLock();
    hasStarted=false;
    frozenTime=0;
    previewInitialized=false;
    if(showStatus) statusEl.textContent = 'Ready';
  }

  function startFreeDrift(){
    audio.pause();
    freeDriftActive=true;
    backgroundGuarded=false;
    manualScene=null;
    sceneMode.value='auto';
    sceneMode.open=false;
    setFreeDriftSettingsLocked(true);
    freeDriftBtn.setAttribute('aria-pressed','true');
    hasStarted=true;
    frozenTime=0;
    freeDriftClock=0;
    previewInitialized=false;
    calibrated=true;
    seed=[Math.random()*100,Math.random()*100];

    // Start in a randomly chosen scene, then allow the normal slow AUTO journey
    // logic to take over using the autonomous mood signal.
    const startScene=Math.floor(Math.random()*SCENES.length);
    currentScene=startScene;
    targetScene=startScene;
    sceneWeights.fill(0);
    sceneWeights[startScene]=1;
    for(let i=0;i<8;i++) transitionFrom[i]=sceneWeights[i];
    const now=performance.now()/1000;
    transitionStart=now;
    transitionDuration=42;
    nextDecision=now + 24 + Math.random()*28;
    chooseFreeDriftMood(now);
    camera.x=0; camera.y=0; camera.z=0; travel=0; yaw=0; pitch=0;
    sceneEl.textContent=SCENES[startScene];
    statusEl.textContent='FREE DRIFT · AUTO';
    requestScreenWakeLock();
    setTimeout(()=>hideUI(),420);
  }

  function revokePlaylistUrls(){
    for(const item of playlist){
      if(item && item.url){
        try { URL.revokeObjectURL(item.url); } catch(e) {}
      }
    }
    playlist=[];
    playlistIndex=-1;
  }

  function updateQueueDisplay(){
    if(usingShowcaseTrack){
      queueCount.textContent='SHOWCASE';
      prevBtn.disabled=true;
      nextBtn.disabled=true;
      return;
    }
    const total=playlist.length;
    const current=playlistIndex>=0 ? playlistIndex+1 : 0;
    queueCount.textContent=total ? `${current} / ${total}` : '';
    prevBtn.disabled=total<2 || playlistIndex<=0;
    nextBtn.disabled=total<2 || playlistIndex>=total-1;
  }

  function loadPlaylistTrack(index, autoplay=false){
    if(!playlist.length) return;
    index=Math.max(0,Math.min(index,playlist.length-1));
    playlistIndex=index;
    const item=playlist[index];

    audio.pause();
    audio.muted=false;
    audio.volume=1;
    if(outputGain) outputGain.gain.value=1;
    audio.loop=false;
    loopBtn.setAttribute('aria-pressed','false');
    audio.src=item.url;
    audio.load();

    usingShowcaseTrack=false;
    hasStarted=false;
    frozenTime=0;
    previewInitialized=false;
    calibrated=false;
    fileName.textContent=item.name;
    timeNow.textContent='0:00';
    timeTotal.textContent='0:00';
    resetJourney();
    updateQueueDisplay();
    syncTransportState();

    if(autoplay){
      // Native media playback remains user-initiated for the first track.
      // Subsequent tracks are allowed to continue from the existing session.
      startPlayback();
    } else {
      statusEl.textContent=playlist.length>1 ? `Track ${playlistIndex+1} of ${playlist.length} — press play` : 'Ready — press play';
    }
  }

  function stepPlaylist(direction, autoplay=false){
    if(!playlist.length) return;
    const next=playlistIndex+direction;
    if(next<0 || next>=playlist.length) return;
    loadPlaylistTrack(next,autoplay);
  }

  async function startPlayback(){
    stopFreeDrift(false);
    hasStarted=true;
    backgroundGuarded=false;
    audio.muted=false;
    audio.volume=1;
    if(outputGain) outputGain.gain.value=1;

    try {
      // Keep the showcase on a plain same-origin MP3 URL so iOS can use native
      // media loading/range requests. Never wait on Web Audio before starting it.
      if(usingShowcaseTrack && audio.getAttribute('src') !== SHOWCASE_SRC){
        audio.src=SHOWCASE_SRC;
        audio.load();
      }

      // Start/resume Web Audio without allowing it to block native media playback.
      try {
        ensureAudioGraph();
        if(outputGain) outputGain.gain.value=1;
        if(audioCtx && audioCtx.state==='suspended') audioCtx.resume().catch(()=>{});
      } catch(graphError) {
        console.warn('Audio analyser unavailable; continuing native playback',graphError);
      }

      await audio.play();
      syncTransportState();
      requestScreenWakeLock();
    } catch(e) {
      console.warn('Playback failed',e);
      syncTransportState();
      const code=audio.error ? audio.error.code : 0;
      statusEl.textContent=code ? `Showcase audio error (${code})` : 'Playback failed — tap Play again';
    }
  }

  fileInput.addEventListener('change', e => {
    const files=Array.from(e.target.files || []);
    if(!files.length) return;

    stopFreeDrift(false);

    // A user-selected playlist completely replaces the showcase for this session.
    revokePlaylistUrls();
    usingShowcaseTrack=false;
    if(objectURL){
      try { URL.revokeObjectURL(objectURL); } catch(err) {}
      objectURL=null;
    }

    playlist=files.map(f=>({name:f.name,url:URL.createObjectURL(f)}));
    playlistIndex=0;
    loadPlaylistTrack(0,false);

    // Allow selecting the same files again later if desired.
    fileInput.value='';
  });

  let transportBusy=false;
  playBtn.addEventListener('click', async () => {
    if(transportBusy) return;
    transportBusy=true;
    try {
      if(audio.paused || audio.ended){
        // Optimistically switch the control while iOS prepares the media pipeline.
        playBtn.dataset.state='pause';
        playBtn.setAttribute('aria-label','Pause');
        playBtn.setAttribute('aria-pressed','true');
        await startPlayback();
      } else {
        audio.pause();
        syncTransportState();
      }
    } finally {
      // Give iOS one event loop turn to settle, then reconcile with actual media state.
      setTimeout(()=>{ syncTransportState(); transportBusy=false; },80);
    }
  });
  prevBtn.addEventListener('click',()=>{
    if(freeDriftActive) stopFreeDrift(false);
    stepPlaylist(-1,!audio.paused && !audio.ended);
  });

  nextBtn.addEventListener('click',()=>{
    if(freeDriftActive) stopFreeDrift(false);
    stepPlaylist(1,!audio.paused && !audio.ended);
  });

  audio.addEventListener('error',()=>{
    const code=audio.error ? audio.error.code : 0;
    console.warn('Media error',code,audio.currentSrc);
    if(usingShowcaseTrack){
      statusEl.textContent=code ? `Showcase audio error (${code})` : 'Showcase audio unavailable';
    }
    syncTransportState();
  });

  audio.addEventListener('canplaythrough',()=>{
    if(usingShowcaseTrack && audio.paused && audio.currentTime===0){
      statusEl.textContent='Showcase ready — press play';
    }
  });

  audio.addEventListener('loadedmetadata',()=>{
    if(isFinite(audio.duration) && audio.duration>0){
      seek.max=audio.duration;
      seek.value=0;
      timeNow.textContent='0:00';
      timeTotal.textContent=formatTime(audio.duration);
    }
    playBtn.disabled=false;
    seek.disabled=false;
    if(usingShowcaseTrack && audio.currentTime===0){
      statusEl.textContent='Showcase ready — press play';
    }
  });

  audio.addEventListener('play',()=>{
    if(backgroundGuarded){
      audio.muted=true;
      audio.pause();
      syncTransportState();
      return;
    }
    syncTransportState();
    requestScreenWakeLock();
    if (!calibrated) statusEl.textContent='Calibrating';
    else statusEl.textContent=manualScene === null ? 'DRIFTING · AUTO' : `Scene locked · ${SCENES[manualScene]}`;
  });
  audio.addEventListener('playing',()=>{
    syncTransportState();
    statusEl.textContent = !calibrated ? 'Calibrating' : (manualScene === null ? 'DRIFTING · AUTO' : `Scene locked · ${SCENES[manualScene]}`);
  });
  audio.addEventListener('canplay',syncTransportState);
  audio.addEventListener('pause',()=>{ syncTransportState(); statusEl.textContent=audio.currentTime>0?'Paused':'Ready'; });
  audio.addEventListener('ended',()=>{
    calibrated=false;
    if(!usingShowcaseTrack && playlist.length && playlistIndex < playlist.length-1 && !audio.loop){
      stepPlaylist(1,true);
      return;
    }
    syncTransportState();
    statusEl.textContent='Finished';
  });
  audio.addEventListener('emptied',syncTransportState);
  loopBtn.addEventListener('click',()=>{
    audio.loop=!audio.loop; loopBtn.setAttribute('aria-pressed',audio.loop?'true':'false');
  });
  seek.addEventListener('input',()=>{ if(isFinite(audio.duration)){ audio.currentTime=parseFloat(seek.value); if(hasStarted) frozenTime=audio.currentTime; } });
  sceneMode.addEventListener('change',()=>{
    manualScene = sceneMode.value === 'auto' ? null : Number(sceneMode.value);
    const now = performance.now()/1000;
    if (manualScene === null) {
      nextDecision = now + 12.0;
      statusEl.textContent = audio.paused ? 'AUTO mode' : 'DRIFTING · AUTO';
    } else {
      for(let i=0;i<8;i++) transitionFrom[i]=sceneWeights[i];
      targetScene = manualScene;
      transitionStart = now;
      transitionDuration = 18.0;
      statusEl.textContent = `Scene locked · ${SCENES[manualScene]}`;
    }
  });
  freeDriftBtn.addEventListener('click',()=>{
    if(freeDriftActive) stopFreeDrift(true);
    else startFreeDrift();
  });
  fullBtn.addEventListener('click',async()=>{
    try {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if(!document.fullscreenElement && request){
        await request.call(root);
      } else if (document.fullscreenElement && exit) {
        await exit.call(document);
      }
      window.scrollTo(0,0);
    } catch(e) {
      window.scrollTo(0,0);
      console.warn(e);
    }
  });

  const reconcileFullscreenPlayback = () => {
    resize();
    // Fullscreen UI transitions must not be treated as leaving DRIFT.
    // If Web Audio was suspended by the browser while native media continued,
    // resume the analyser/output graph without restarting or seeking the track.
    if(!audio.paused && audioCtx && audioCtx.state==='suspended'){
      audioCtx.resume().catch(()=>{});
    }
    syncTransportState();
  };
  document.addEventListener('fullscreenchange',reconcileFullscreenPlayback);
  document.addEventListener('webkitfullscreenchange',reconcileFullscreenPlayback);

  let hideTimer=null;
  let initialMenuPinned=true;
  let suppressMouseRevealUntil=0;

  function scheduleUiHide(){
    clearTimeout(hideTimer);
    // On first launch the controls stay up indefinitely. The user dismisses them
    // with the X or by tapping outside the panel. After that, normal auto-hide resumes.
    if(initialMenuPinned) return;
    hideTimer=setTimeout(()=>ui.classList.remove('visible'),6000);
  }
  function showUI(){
    ui.classList.add('visible');
    scheduleUiHide();
  }
  function hideUI(){
    clearTimeout(hideTimer);
    initialMenuPinned=false;
    suppressMouseRevealUntil=performance.now()+650;
    ui.classList.remove('visible');
  }
  closeUiBtn.addEventListener('click',e=>{ e.stopPropagation(); hideUI(); });

  let lastRevealTap=0;
  if(!isTouchDevice){
    document.addEventListener('pointermove',()=>{
      if(performance.now() < suppressMouseRevealUntil) return;
      if(!ui.classList.contains('visible')) showUI();
    },{passive:true});
    document.addEventListener('pointerdown',e=>{
      if(e.target===canvas || e.target.id==='vignette'){
        if(performance.now() >= suppressMouseRevealUntil) showUI();
      }
    },{passive:true});
  } else {
    const isVisualTouchTarget = (e) => e.target===canvas || e.target===ui || e.target.id==='vignette';

    const preventIOSGesture = e => {
      if(isVisualTouchTarget(e)) e.preventDefault();
    };
    document.addEventListener('contextmenu',preventIOSGesture,{passive:false});
    document.addEventListener('selectstart',preventIOSGesture,{passive:false});
    document.addEventListener('dragstart',preventIOSGesture,{passive:false});

    document.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse' || !isVisualTouchTarget(e)) return;
      const now=performance.now();
      if(now-lastRevealTap<360){
        if(ui.classList.contains('visible')) hideUI(); else showUI();
        lastRevealTap=0;
      } else {
        lastRevealTap=now;
      }
    },{passive:true});
  }

  ui.addEventListener('pointerdown',e=>{
    // Tap anywhere outside the panel to dismiss it. Controls inside the panel remain interactive.
    if(e.target===ui){
      e.stopPropagation();
      hideUI();
      return;
    }
    scheduleUiHide();
  });
  ui.addEventListener('input',scheduleUiHide,{passive:true});
  audio.addEventListener('play',showUI);

  // Bundled showcase track: always present on a fresh opening, never autoplayed.
  // Choosing a local file replaces it for the current session.
  usingShowcaseTrack=true;
  fileName.innerHTML='The Cloud — Chris Weeks<br><span class="showcaseNote">Default showcase track</span>';
  playBtn.disabled=false;
  seek.disabled=false;
  updateQueueDisplay();
  if(!audio.getAttribute('src')) audio.src=SHOWCASE_SRC;
  audio.load();
  resetJourney();
  statusEl.textContent='Showcase ready — press play';
  showUI();
})();
