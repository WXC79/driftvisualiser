(() => {
  'use strict';
  const DRIFT_BUILD = '12.12.0';

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
  const touchCloudsToggle = document.getElementById('touchClouds');
  const grainSlider = document.getElementById('grain');
  const sceneMode = document.getElementById('sceneMode');
  const closeUiBtn = document.getElementById('closeUiBtn');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
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
  uniform vec4 uTouchClouds[16];     // xyz center, w radius
  uniform vec4 uTouchCloudMeta[16];  // x strength, y seedA, z seedB, w reserved;

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

    float touchField=0.0;
    for(int i=0;i<16;i++){
      vec4 tc=uTouchClouds[i];
      vec4 tm=uTouchCloudMeta[i];
      float strength=tm.x;
      if(strength<=0.001 || tc.w<=0.001) continue;
      vec3 rel=p-tc.xyz;
      float radius=max(tc.w,0.001);
      vec3 local=rel/vec3(radius*1.24,radius*0.82,radius*1.08);
      float dist=length(local);
      float envelope=smoothstep(1.34,0.18,dist);
      if(envelope>0.0){
        float nA=noise3(rel*0.060 + vec3(tm.y*0.17,tm.z*0.13,5.0));
        float nB=noise3(rel*0.104 + vec3(12.0+tm.z*0.07,3.0,8.0+tm.y*0.05));
        float nC=noise3(rel*0.028 + vec3(3.0,16.0,4.0));
        float shape=smoothstep(0.18,0.90,nA*0.54+nB*0.24+nC*0.22);
        float puff=envelope*shape*strength;
        touchField += puff*(1.0-touchField);
      }
    }

    field=clamp(field + touchField*0.44,0.0,1.45);
    float threshold=0.534+openness*0.12-fog*0.11;
    threshold -= (uAudioSlow.x-0.5)*0.055*uIntensity;
    threshold -= (uAudioSlow.y-0.5)*0.015*uIntensity;
    threshold -= activity*0.006;
    float d=smoothstep(threshold,threshold+0.145,field);
    d=max(d,touchField*0.92);
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
    float openBase=sunrise*0.80+blue*0.93+sunlight*0.90+mist*0.24+darkP*0.05+storm*0.03+sunset*0.79+night*0.16;
    float grainBase=sunrise*0.030+blue*0.022+sunlight*0.030+mist*0.29+darkP*0.085+storm*0.160+sunset*0.042+night*0.108;
    float ambient=sunrise*0.73+blue*0.76+sunlight*0.76+mist*0.45+darkP*0.22+storm*0.085+sunset*0.70+night*0.045;

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
    float mistY=smoothstep(0.0,1.0,skyY);
    vec3 mistSky=mix(vec3(0.50,0.56,0.62),vec3(0.25,0.32,0.39),mistY);
    vec3 sunriseSky=mix(vec3(1.00,0.60,0.30),vec3(0.46,0.39,0.54),skyY);
    vec3 sunsetSky=mix(vec3(0.92,0.44,0.30),vec3(0.30,0.25,0.40),skyY);
    vec3 darkSky=mix(vec3(0.56,0.57,0.58),vec3(0.22,0.23,0.24),skyY);
    vec3 stormSky=mix(vec3(0.105,0.108,0.112),vec3(0.060,0.064,0.070),skyY);
    vec3 nightSky=mix(vec3(0.012,0.015,0.024),vec3(0.0008,0.0012,0.0035),skyY);

    vec3 sky=blueSky;
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
    sky += moonColor*pow(moonDot,4.2)*moonPresence*(0.022+moonCycle*0.030);
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
      dayShadow=mix(dayShadow,vec3(0.20,0.19,0.17),sunlight*0.16);
      dayLight=mix(dayLight,vec3(0.96,0.84,0.60),sunlight*0.44);
      dayShadow=mix(dayShadow,vec3(0.38,0.22,0.24),sunset*0.74);
      dayLight=mix(dayLight,vec3(0.90,0.56,0.52),sunset*0.90);
      dayShadow=mix(dayShadow,vec3(0.085,0.090,0.095),darkP);
      dayLight=mix(dayLight,vec3(0.36,0.37,0.39),darkP*0.98);
      dayShadow=mix(dayShadow,vec3(0.070,0.073,0.078),storm);
      dayLight=mix(dayLight,vec3(0.155,0.160,0.168),storm);

      vec3 nightShadow=vec3(0.004,0.005,0.012);
      vec3 nightLight=vec3(0.048,0.056,0.076);
      vec3 shadow=mix(dayShadow,nightShadow,night);
      vec3 lit=mix(dayLight,nightLight,night);

      float bodyLight=clamp(0.61-interior*0.45-darkP*0.20-storm*0.40-night*0.40-sunset*0.10+ambient*0.07+blue*0.045,0.018,0.84);
      float lightCap = 0.90 - night*0.24 - sunset*0.12 - storm*0.13;
      bodyLight=clamp(bodyLight+(brightness-0.5)*0.030*uIntensity + (uAudioSlow.z-0.5)*0.018*uIntensity + pulse*0.003 + activity*0.008,0.018,lightCap);
      vec3 cloud=mix(shadow,lit,bodyLight);
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
      float sunlightBounce=sunlight*(0.20+sunFacing*0.56)*(1.0-interior)*(0.42+edge*1.55) + sunrise*(0.12+sunFacing*0.22)*(1.0-interior)*(0.48+edge*1.86);
      float sunlightRim=edge*sunFacing*sunlight*(0.06+0.20*sunCycle)*(0.75+0.25*(1.0-interior));
      float sunriseRim=edge*sunFacing*sunrise*(0.08+0.24*sunCycle)*(0.74+0.26*(1.0-interior));
      float musicSun=0.92+brightness*0.24+uAudioSlow.z*0.15+pulse*0.018;
      cloud+=sunColor*(sunEdge*(0.22+sunlight*0.20+sunrise*0.22)+sunInteriorGlow+sunlightBounce*0.16+sunlightRim+sunriseRim)*musicSun*(1.0 - sunset*0.08 - night*0.50);

      vec3 sunriseEdgeTint = vec3(1.00,0.62,0.34);
      vec3 sunsetEdgeTint = vec3(0.98,0.60,0.72);
      cloud += sunriseEdgeTint * edge * sunrise * 0.095 * (0.72 + 0.28*dens);
      cloud += sunsetEdgeTint * edge * sunset * 0.082 * (0.72 + 0.28*dens);

      float moonFacing=moonDot*moonDot;
      float moonEdge=edge*(0.13+moonFacing*1.42)*moonPresence;
      float moonInteriorGlow=(1.0-interior)*pow(moonDot,4.6)*moonPresence*(0.0045+moonCycle*0.009);
      float moonRimBurst=edge*moonFacing*night*moonCycle*0.34*(0.65+0.35*(1.0-interior));
      cloud+=moonColor*(moonEdge*(0.72+moonCycle*0.34)+moonInteriorGlow+moonRimBurst);

      float alpha=1.0-exp(-dens*stepLength*0.050);
      accum+=trans*cloud*alpha;
      trans*=1.0-alpha;
      previousDensity=dens;
      if(trans<0.02) break;
    }

    vec3 base=accum+sky*trans;
    float sunCycle=pow(max(0.0,sin(uTime*0.035+uSeed.x*1.41+uSeed.y*0.53)),6.0);
    float sunlightHaze=pow(sunDot,2.3)*(sunlight*(0.012+sunCycle*0.040) + sunrise*(0.018+sunCycle*0.062));
    float moonHaze=pow(moonDot,2.6)*night*(0.012+moonCycle*0.050);
    base+=sunColor*(sunlightHaze*(0.34+0.66*trans));
    base+=moonColor*(pow(moonDot,4.0)*moonPresence*0.018 + moonHaze*(0.35+0.65*trans));

    vec2 grainUV1=vec2(uv.x*431.7+uv.y*163.1, uv.x*-247.3+uv.y*389.4);
    vec2 grainUV2=vec2(uv.x*911.2-uv.y*507.6, uv.x*281.5+uv.y*769.8);
    float fineGrain=noise2(grainUV1+vec2(uTime*0.13,-uTime*0.09)+uSeed*1.7)-0.5;
    float microGrain=noise2(grainUV2+vec2(-uTime*0.41,uTime*0.33)+uSeed*4.1)-0.5;
    float dotNoise=smoothstep(0.84,1.0,noise2(grainUV2*1.73+vec2(uTime*0.71,-uTime*0.57)+uSeed*7.3));
    float cloudImmersion=1.0-trans;
    float grainEnvelope=grainState*(0.24+cloudImmersion*0.76)*(0.82+uAudioSlow.z*0.30+activity*0.06);
    base+=fineGrain*grainEnvelope*0.028;
    base+=microGrain*grainEnvelope*0.017;
    base+=dotNoise*grainEnvelope*0.010;

    base=mix(base,vec3(0.61,0.64,0.66),mist*cloudImmersion*0.070);
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
    sceneWeights: loc('uSceneWeights[0]'), intensity: loc('uIntensity'), grain: loc('uGrain'), seed: loc('uSeed'),
    touchClouds: loc('uTouchClouds[0]'), touchCloudMeta: loc('uTouchCloudMeta[0]')
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

  const MAX_TOUCH_CLOUDS = 16;
  const touchClouds = new Float32Array(MAX_TOUCH_CLOUDS * 4);
  const touchCloudMeta = new Float32Array(MAX_TOUCH_CLOUDS * 4);
  let touchCloudHead = 0;
  let touchCloudMode = isTouchDevice;
  const touchStroke = {
    active:false,
    pointerId:null,
    clientX:0,
    clientY:0,
    holdTime:0,
    emitTimer:0,
    prevWorld:null,
    lastMoveTime:0,
    speed:0,
    seedA:0,
    seedB:0
  };
  if(touchCloudsToggle){
    touchCloudsToggle.checked = touchCloudMode;
  }

  function clearTouchClouds(){
    touchClouds.fill(0);
    touchCloudMeta.fill(0);
    touchCloudHead = 0;
    touchStroke.active = false;
    touchStroke.pointerId = null;
    touchStroke.prevWorld = null;
  }

  function cross(a,b){
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }
  function norm(v){
    const len=Math.hypot(v[0],v[1],v[2]) || 1;
    return [v[0]/len,v[1]/len,v[2]/len];
  }
  function getBasis(){
    const forward = norm([Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]);
    const right = norm(cross(forward,[0,1,0]));
    const up = norm(cross(right,forward));
    return {forward,right,up};
  }
  function mapTouchToWorld(clientX, clientY){
    const rect=canvas.getBoundingClientRect();
    const nx=((clientX-rect.left)/Math.max(1,rect.width))*2-1;
    const ny=((clientY-rect.top)/Math.max(1,rect.height))*2-1;
    const {forward,right,up}=getBasis();
    const depth = 52 + (1-Math.min(1,Math.abs(nx)))*8 + (1-Math.min(1,Math.abs(ny)))*6;
    const side = nx * depth * 0.54;
    const lift = -ny * depth * 0.34;
    return [
      camera.x + forward[0]*depth + right[0]*side + up[0]*lift,
      camera.y + forward[1]*depth + right[1]*side + up[1]*lift,
      camera.z + forward[2]*depth + right[2]*side + up[2]*lift
    ];
  }
  function spawnTouchCloud(worldPos, radius, strength, seedA, seedB){
    const slot = touchCloudHead % MAX_TOUCH_CLOUDS;
    touchCloudHead++;
    const i = slot * 4;
    touchClouds[i] = worldPos[0];
    touchClouds[i+1] = worldPos[1];
    touchClouds[i+2] = worldPos[2];
    touchClouds[i+3] = radius;
    touchCloudMeta[i] = strength;
    touchCloudMeta[i+1] = seedA;
    touchCloudMeta[i+2] = seedB;
    touchCloudMeta[i+3] = 1.0;
  }
  function stampTouchCloud(dt){
    if(!touchStroke.active || !touchCloudMode) return;
    touchStroke.holdTime += dt;
    touchStroke.emitTimer += dt;
    if(touchStroke.emitTimer < 0.075) return;
    touchStroke.emitTimer = 0;

    const world = mapTouchToWorld(touchStroke.clientX, touchStroke.clientY);
    let dragDistance = 0;
    if(touchStroke.prevWorld){
      dragDistance = Math.hypot(
        world[0]-touchStroke.prevWorld[0],
        world[1]-touchStroke.prevWorld[1],
        world[2]-touchStroke.prevWorld[2]
      );
    }
    const dragSpeed = dragDistance / Math.max(dt, 0.016);
    touchStroke.speed = dragSpeed;

    const holdGrow = Math.min(1, touchStroke.holdTime / 1.05);
    const dragPenalty = Math.min(1, dragSpeed / 40);
    const radius = 7.0 + holdGrow * 8.0 + (1.0-dragPenalty) * 3.0;
    const strength = Math.max(0.34, Math.min(0.96, 0.40 + holdGrow * 0.34 + (1.0-dragPenalty)*0.18));

    if(touchStroke.prevWorld){
      const segment = Math.hypot(
        world[0]-touchStroke.prevWorld[0],
        world[1]-touchStroke.prevWorld[1],
        world[2]-touchStroke.prevWorld[2]
      );
      const steps = Math.min(4, Math.max(1, Math.ceil(segment / Math.max(4.0, radius*0.42))));
      for(let s=1;s<=steps;s++){
        const k = s/steps;
        const pos = [
          touchStroke.prevWorld[0] + (world[0]-touchStroke.prevWorld[0]) * k,
          touchStroke.prevWorld[1] + (world[1]-touchStroke.prevWorld[1]) * k,
          touchStroke.prevWorld[2] + (world[2]-touchStroke.prevWorld[2]) * k
        ];
        spawnTouchCloud(pos, radius * (0.96 + 0.06*Math.sin((touchStroke.holdTime+k)*3.1)), strength, touchStroke.seedA + s*0.31, touchStroke.seedB + s*0.47);
      }
    } else {
      spawnTouchCloud(world, radius, strength, touchStroke.seedA, touchStroke.seedB);
    }
    touchStroke.prevWorld = world;
  }
  function endTouchStroke(){
    touchStroke.active = false;
    touchStroke.pointerId = null;
    touchStroke.prevWorld = null;
  }

  let objectURL = null;
  let audioCtx = null;
  let sourceNode = null;
  let analyser = null;
  let freq = null;
  let prevFreq = null;
  let timeDomain = null;
  let audioReady = false;

  const CALIBRATION_SECONDS = 14;
  let calibrated = false;

  const A = {
    bass:.5, mid:.5, high:.5, overall:.5, brightness:.5, flux:.0, pulse:.0, activity:.0,
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

  function adaptiveMetric(raw, keyBase, keyDev, dt, baseRate, devRate, scale) {
    const base=A[keyBase];
    const dev=A[keyDev];
    A[keyBase] = expSmooth(base, raw, baseRate, dt);
    A[keyDev] = expSmooth(dev, Math.abs(raw-A[keyBase]), devRate, dt);
    const z=(raw-A[keyBase]) / Math.max(0.02, A[keyDev]*scale);
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
    const activityTarget = clamp01(A.slowOverall*0.20 + mid*0.20 + high*0.12 + tonalMovement*0.36 + fluxMetric*0.08 + transient*0.04);

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
    const e=A.slowOverall, b=A.slowBass, m=A.slowMid, h=A.slowHigh, br=A.brightness, f=A.flux, p=A.pulse, act=A.activity;
    const s = new Float32Array(8);
    s[0] = 0.16 + br*0.24 + h*0.14 + (1-Math.abs(e-0.48))*0.16 + (1-f)*0.05;     // sunrise
    s[1] = 0.15 + br*0.26 + (1-b)*0.12 + (1-f)*0.04;                                // blue
    s[2] = 0.10 + br*0.34 + h*0.14 + act*0.14 + p*0.05;                             // sunlight
    s[3] = 0.12 + (1-e)*0.24 + (1-br)*0.12 + m*0.06;                                // mist
    s[4] = 0.10 + b*0.24 + (1-br)*0.28 + (1-h)*0.08 + act*0.05;                     // dark
    s[5] = 0.04 + f*0.58 + act*0.30 + b*0.16 + p*0.10;                              // storm
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
    clearTouchClouds();
    Object.assign(A, {
      bass:.5, mid:.5, high:.5, overall:.5, brightness:.5, flux:.0, pulse:.0, activity:.0,
      slowBass:.5, slowMid:.5, slowHigh:.5, slowOverall:.5,
      baseBass:.1, baseMid:.1, baseHigh:.1, baseOverall:.1, baseFlux:.06, baseBright:.2,
      devBass:.08, devMid:.08, devHigh:.08, devOverall:.08, devFlux:.04, devBright:.05
    });
    sceneEl.textContent=manualScene === null ? SCENES[1] : SCENES[manualScene];
    statusEl.textContent='Loaded — press play';
  }

  function updateScenes(now,dt) {
    if (manualScene === null) {
      if (calibrated && now>=nextDecision && (audioReady ? !audio.paused : true)) pickScene(now);
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
    const speedBase=(11.8 + A.slowMid*3.0 + A.slowHigh*0.7 + A.slowOverall*1.4 + A.activity*0.75 + A.pulse*0.12) * 1.06;
    const speed=speedBase*parseFloat(speedSlider.value);
    const direction=yaw+Math.sin(t*0.047+seed[1])*0.10;
    const lateral=(Math.sin(t*0.071+seed[0])*0.70+Math.sin(t*0.023+seed[1])*0.30)*(0.78 + A.activity*0.28);
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
    const w=Math.max(2,Math.floor(innerWidth*dpr*qualityScale));
    const h=Math.max(2,Math.floor(innerHeight*dpr*qualityScale));
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); }
  }
  window.addEventListener('resize',resize,{passive:true});

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
    if (playing) {
      analyseAudio(dt);
      updateScenes(now,dt);
      frozenTime = isFinite(audio.currentTime) ? audio.currentTime : frozenTime + dt;
      updateCamera(frozenTime,dt);
    } else {
      ensurePreviewFrame();
    }
    const t = hasStarted ? frozenTime : 0.0;

    stampTouchCloud(dt);

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
    gl.uniform4fv(U.touchClouds, touchClouds);
    gl.uniform4fv(U.touchCloudMeta, touchCloudMeta);
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

  async function requestScreenWakeLock(){
    if(!('wakeLock' in navigator) || document.visibilityState!=='visible' || audio.paused) return;
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
    const actuallyPlaying = !audio.paused && !audio.ended && audio.readyState >= 2;
    playBtn.textContent = actuallyPlaying ? 'Ⅱ' : '▶';
    if(!actuallyPlaying){
      releaseScreenWakeLock();
      if(audio.currentTime>0 && !audio.ended) statusEl.textContent='Paused';
    }
    return actuallyPlaying;
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      // iOS/Home Screen can suspend media without reliably updating the transport UI.
      // Explicitly pause when leaving so the visual state and button never disagree.
      if(!audio.paused) audio.pause();
      syncTransportState();
    } else {
      const playing=syncTransportState();
      if(playing) requestScreenWakeLock();
    }
  });

  window.addEventListener('pageshow',syncTransportState);
  window.addEventListener('focus',syncTransportState);

  async function startPlayback(){
    ensureAudioGraph();
    hasStarted = true;
    if(audioCtx.state==='suspended') await audioCtx.resume();
    try {
      await audio.play();
      await requestScreenWakeLock();
    } catch(e) { console.warn(e); }
  }

  fileInput.addEventListener('change', async e => {
    const f=e.target.files && e.target.files[0]; if(!f) return;
    if(objectURL) URL.revokeObjectURL(objectURL);
    objectURL=URL.createObjectURL(f);
    audio.src=objectURL;
    hasStarted = false;
    frozenTime = 0;
    previewInitialized = false;
    fileName.textContent=f.name;
    playBtn.disabled=false;
    seek.disabled=false;
    resetJourney();
    ensureAudioGraph();
    if(audioCtx.state==='suspended') await audioCtx.resume();
  });

  playBtn.addEventListener('click', async () => {
    if(audio.paused){ await startPlayback(); } else audio.pause();
  });
  audio.addEventListener('play',()=>{ syncTransportState(); requestScreenWakeLock(); if (!calibrated) statusEl.textContent='Calibrating'; else statusEl.textContent=manualScene === null ? 'DRIFTING · AUTO' : `Scene locked · ${SCENES[manualScene]}`; });
  audio.addEventListener('pause',()=>{ endTouchStroke(); syncTransportState(); statusEl.textContent=audio.currentTime>0?'Paused':'Ready'; });
  audio.addEventListener('ended',()=>{ endTouchStroke(); syncTransportState(); statusEl.textContent='Finished'; calibrated=false; });
  audio.addEventListener('emptied',syncTransportState);
  loopBtn.addEventListener('click',()=>{
    audio.loop=!audio.loop; loopBtn.setAttribute('aria-pressed',audio.loop?'true':'false');
  });
  seek.addEventListener('input',()=>{ if(isFinite(audio.duration)){ audio.currentTime=parseFloat(seek.value); if(hasStarted) frozenTime=audio.currentTime; } });
  if(touchCloudsToggle){
    touchCloudsToggle.addEventListener('change',()=>{
      touchCloudMode = !!touchCloudsToggle.checked;
      canvas.style.touchAction = touchCloudMode ? 'none' : 'manipulation';
      if(!touchCloudMode) endTouchStroke();
      statusEl.textContent = touchCloudMode ? 'Touch clouds enabled' : 'Touch clouds disabled';
      scheduleUiHide();
    });
    canvas.style.touchAction = touchCloudMode ? 'none' : 'manipulation';
  }

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
  shuffleBtn.addEventListener('click',resetJourney);
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

  let hideTimer=null;
  function scheduleUiHide(){
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>ui.classList.remove('visible'),6000);
  }
  function showUI(){
    ui.classList.add('visible');
    scheduleUiHide();
  }
  function hideUI(){
    clearTimeout(hideTimer);
    ui.classList.remove('visible');
  }
  closeUiBtn.addEventListener('click',e=>{ e.stopPropagation(); hideUI(); });

  let lastRevealTap=0;
  if(!isTouchDevice){
    document.addEventListener('pointermove',showUI,{passive:true});
    document.addEventListener('pointerdown',e=>{
      if(e.target===canvas || e.target.id==='vignette') showUI();
    },{passive:true});
  } else {
    document.addEventListener('pointerdown',e=>{
      const bg = (e.target===canvas || e.target.id==='vignette');
      if(!bg) return;

      if(touchCloudMode && ui.classList.contains('visible')===false){
        touchStroke.active = true;
        touchStroke.pointerId = e.pointerId;
        touchStroke.clientX = e.clientX;
        touchStroke.clientY = e.clientY;
        touchStroke.holdTime = 0;
        touchStroke.emitTimer = 0.076; // stamp immediately
        touchStroke.prevWorld = null;
        touchStroke.seedA = Math.random()*100.0;
        touchStroke.seedB = Math.random()*100.0;
        if(canvas.setPointerCapture){
          try { canvas.setPointerCapture(e.pointerId); } catch(err) {}
        }
        return;
      }

      const now = performance.now();
      if(now-lastRevealTap < 360){
        showUI();
        lastRevealTap = 0;
      } else {
        lastRevealTap = now;
      }
    },{passive:true});

    document.addEventListener('pointermove',e=>{
      if(!touchStroke.active || e.pointerId!==touchStroke.pointerId) return;
      touchStroke.clientX = e.clientX;
      touchStroke.clientY = e.clientY;
    },{passive:true});

    const finishTouchStroke = e => {
      if(touchStroke.active && e.pointerId===touchStroke.pointerId){
        endTouchStroke();
      }
    };
    document.addEventListener('pointerup',finishTouchStroke,{passive:true});
    document.addEventListener('pointercancel',finishTouchStroke,{passive:true});

    document.addEventListener('touchstart',e=>{
      const target=e.target;
      const bg = (target===canvas || target.id==='vignette');
      if(!bg) return;
      if(touchCloudMode && e.touches.length===2){
        endTouchStroke();
        showUI();
        e.preventDefault();
      }
    },{passive:false});
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
  resetJourney();
  statusEl.textContent='Waiting for music';
  showUI();
})();
