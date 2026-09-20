// Review evidence, not a replacement for a product test suite.
// Run from any directory: node docs/reviews/2026-09-19/numerical-checks.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
// Preserve reproduction of the reviewed revision after the implementation changes.
const {execFileSync}=require('node:child_process');
const read = name => execFileSync('git',['show','6e4df22:lessons/'+name],{cwd:root,encoding:'utf8'});
const between = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const seededMath = Object.create(Math);
seededMath.random = rng(20260919);
const one = read('01-one-step-estimator.html');
const kernel = vm.runInNewContext(between(one, 'function expit', '// ---------- ACT 1:') + ';({gen,ols,estimate})', {Math:seededMath});
const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const sd = a => Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1));
const n = 2000, reps = 1500;
// Analytic bound: E[0.64/(pi(1-pi))] + Var(0.4 X), X~Unif(-2,2).
const bound = Math.sqrt((.64*(2+2*Math.sinh(1.8)/1.8)+.16*4/3)/n);
const simulations=[];
for (const [lambda,kappa] of [[0,0],[.5,1],[1,1]]) {
  const plug=[],os=[],ses=[];
  for(let i=0;i<reps;i++){const e=kernel.estimate(kernel.gen(n),lambda,kappa);plug.push(e.plug);os.push(e.os);ses.push(e.se);}
  simulations.push({n,reps,lambda,kappa,pluginBias:mean(plug)-2,oneStepBias:mean(os)-2,pluginSD:sd(plug),oneStepSD:sd(os),meanReportedSE:mean(ses),efficientSE:bound,sdRatio:sd(os)/bound});
}
const scores=read('02-scores-from-scratch.html');
const grid=vm.runInNewContext(between(scores,'const N=481','// ---------- scene scaffold')+`;({mass:integ(P0),meanRaw:MU0,meanNormalized:meanOf(P0),directions:HN.map(kind=>{const h=hOf(kind);let inner=0,center=0;for(let i=0;i<N;i++){inner+=(Z[i]-MU0)*h[i]*P0[i]*dz;center+=h[i]*P0[i]*dz;}return {kind,scoreMean: center,innerProduct:inner,displayedFiniteDifference:(meanOf(pEps(h,.01))-MU0)/.01};})})`);
const z=[-1,0,2],p=[.2,.5,.3],mu=.4,D=z.map(x=>x-mu),h=[-1,0,2/3],restrictedD=[-1.8,0,1.2];
const ip=(a,b)=>a.reduce((s,x,i)=>s+p[i]*x*b[i],0);
const geometry={z,p,mean:mu,D,h,scoreMean:ip(h,[1,1,1]),pathSlope:ip(D,h),fullVariance:ip(D,D),restrictedD,restrictedVariance:ip(restrictedD,restrictedD),projectionResidualOrthogonality:ip(D.map((x,i)=>x-restrictedD[i]),h)};
// A valid TMLE update need not equal one-step in a finite sample with arbitrary pi.
const pi=[.8,.8,.25,.25],a=[1,0,1,0],r=[1,-1,.5,-1];
const H=a.map((v,i)=>v/pi[i]),H1=pi.map(x=>1/x);
const correction=mean(H.map((v,i)=>v*r[i])),epsilon=H.reduce((s,v,i)=>s+v*r[i],0)/H.reduce((s,v)=>s+v*v,0);
const finiteSample={H,correction,epsilon,tmleShift:epsilon*mean(H1),targetedResidualMean:mean(H.map((v,i)=>v*(r[i]-epsilon*v)))};
let inlineScripts=0;const syntaxErrors=[];
for(const filename of ['index.html','glossary.html',...execFileSync('git',['ls-tree','--name-only','6e4df22:lessons'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html')).map(f=>'lessons/'+f)]){
  const html=execFileSync('git',['show','6e4df22:'+filename],{cwd:root,encoding:'utf8'});
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){if(!match[1].trim())continue;inlineScripts++;try{new vm.Script(match[1],{filename});}catch(e){syntaxErrors.push(String(e));}}
}
console.log(JSON.stringify({seed:20260919,simulations,scoreGrid:grid,proposedGeometry:geometry,finiteSampleGaussianTMLE:finiteSample,syntax:{inlineScripts,syntaxErrors}},null,2));
