import { createPresentationState } from './presentation-state.js';
import { tracePlan } from './chart-trace.js';

export function createPanelPresentation(root) {
  const gsap=window.gsap, events=new AbortController(), options={signal:events.signal};
  const toggle=document.getElementById('analysis-toggle');
  let entrance,contentMotion,layoutMotion,origin,side='right',placed=false,disposed=false;
  const seriesMotions=new Map();
  const mobile=matchMedia('(max-width: 760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function clearContent() {
    contentMotion?.kill();
    for(const motion of seriesMotions.values())motion.kill();seriesMotions.clear();
    const nodes=root.querySelectorAll('.science-plot, .science-chart *');
    if(gsap&&nodes.length)gsap.set(nodes,{clearProps:'opacity,visibility'});
    const lines=root.querySelectorAll('.chart-connection');
    if(gsap&&lines.length)gsap.set(lines,{clearProps:'strokeDasharray,strokeDashoffset'});
  }
  function finish(){entrance?.kill();layoutMotion?.kill();clearContent();if(state.value.open)position();root.style.willChange='';if(gsap)gsap.set(root,{clearProps:'transform,opacity,visibility'});root.hidden=!state.value.open;}
  function position(source,animateSize=false) {
    const map=document.getElementById('aladin').getBoundingClientRect();
    if(!placed){side=source&&source[0]>map.width*.55?'left':'right';placed=true;}
    const compactWidth=Math.max(280,Math.min(560,map.width*.46));
    const compactX=Math.max(8,side==='left'?map.left+18:map.right-compactWidth-18);
    const right=compactX+compactWidth;
    const expandedWidth=Math.max(compactWidth,Math.min(860,compactWidth*1.4,right-8,innerWidth-24));
    const width=state.value.expanded?expandedWidth:compactWidth;
    const x=right-width;
    layoutMotion?.kill();
    const dimensions={'--panel-x':`${Math.max(8,x)}px`,'--panel-width':`${width}px`};
    root.style.setProperty('--panel-y',`${Math.max(8,map.top+18)}px`);
    // A largura precisa refluir o conteúdo; um scaleX esticaria textos e escalas.
    if(animateSize&&gsap&&!reduced.matches)layoutMotion=gsap.to(root,{...dimensions,duration:.28,ease:'power3.out',autoRound:false,overwrite:'auto'});
    else for(const [name,value] of Object.entries(dimensions))root.style.setProperty(name,value);
    const button=root.querySelector('#science-size');
    if(button){button.disabled=!state.value.expanded&&(mobile.matches||expandedWidth<=compactWidth+1);button.title=button.disabled?'O painel já ocupa a largura disponível':state.value.expanded?'Restaurar largura compacta':'Ampliar o painel para a esquerda';}
    root.dataset.side=side;document.body.dataset.panelSide=side;
  }
  function animate(open) {
    entrance?.kill();root.inert=!open;root.setAttribute('aria-hidden',String(!open));root.style.pointerEvents=open?'auto':'none';
    toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Fechar medições':'Abrir medições';
    if(!gsap || reduced.matches){finish();return;}
    const wasHidden=root.hidden;
    if(open){root.hidden=false;if(wasHidden)gsap.set(root,{opacity:0,x:mobile.matches?0:20,y:mobile.matches?28:0});}
    else{layoutMotion?.kill();clearContent();}
    root.style.willChange='transform, opacity';
    entrance=gsap.to(root,{opacity:open?1:0,x:open?0:mobile.matches?0:12,y:open?0:mobile.matches?20:0,duration:open?(mobile.matches ? .34 : .27):.18,ease:open?'power3.out':'power2.in',overwrite:true,onComplete:()=>{root.style.willChange='';if(!state.value.open)root.hidden=true;}});
    if(open)reveal(true);
  }
  const state=createPresentationState(next=>{
    const expanded=root.dataset.expanded==='true';root.dataset.expanded=String(next.expanded);
    const button=root.querySelector('#science-size');if(button){button.textContent=next.expanded?'Compactar':'Ampliar';button.setAttribute('aria-expanded',String(next.expanded));}
    if(expanded!==next.expanded && next.open){position(null,true);return;}
    animate(next.open);
  });
  function open(source,enter=false){
    if(disposed)return;
    if(!state.value.open){root.dispatchEvent(new Event('science-open'));origin=root.contains(document.activeElement)?origin:document.activeElement;if(root.hidden)placed=false;position(source);}
    state.open();if(enter)root.focus({preventScroll:true});
  }
  function close(restore=true){
    const inside=root.contains(document.activeElement);state.close();
    const target=origin?.isConnected && origin.matches('button,a,input,select,textarea,[tabindex]') && !origin.closest('[inert],#aladin') ? origin : toggle;
    if(restore&&inside)target.focus({preventScroll:true});
  }
  toggle.addEventListener('click',()=>state.value.open?close():open(null,true),options);
  document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();open(null,true);},options);
  root.addEventListener('click',e=>{if(e.target.closest('#science-close'))close();if(e.target.closest('#science-size'))state.expand();},options);
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.defaultPrevented||!state.value.open||document.querySelector('dialog[open]')||document.body.classList.contains('controls-open')||e.target.closest('select,input:not([type="radio"]),textarea,[role="combobox"]'))return;
    e.preventDefault();close();
  },options);
  document.addEventListener('focusin',e=>{
    if(!state.value.open||root.contains(e.target)||document.querySelector('dialog[open]')||document.body.classList.contains('controls-open'))return;
    const a=e.target.getBoundingClientRect(),b=root.getBoundingClientRect();
    if(a.width&&a.height&&a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom)close(false);
  },options);
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state.value.open)finish();},100);},options);
  const mm=gsap?.matchMedia();
  if(mm)mm.add({mobile:'(max-width: 760px)',desktop:'(min-width: 761px)',reduce:'(prefers-reduced-motion: reduce)'},()=>{finish();});
  else reduced.addEventListener('change',finish,options);
  root.hidden=true;root.inert=true;root.setAttribute('aria-hidden','true');toggle.setAttribute('aria-expanded','false');toggle.textContent='Abrir medições';
  function reveal(forceAll=false){
      const plot=root.querySelector('.science-plot');if(!plot)return;
      const all=forceAll||plot.dataset.reveal!=='series';
      if(all)clearContent();
      // Uma série removida não deixa sua timeline retendo nós desconectados.
      for(const [series,motion] of seriesMotions)if(!series.isConnected){motion.kill();seriesMotions.delete(series);}
      if(!state.value.open||!gsap||reduced.matches){if(reduced.matches)clearContent();for(const series of plot.querySelectorAll('[data-entering]'))delete series.dataset.entering;return;}
      if(all){
        const axes=plot.querySelectorAll('.chart-axis,.chart-grid,text');
        contentMotion=gsap.timeline({defaults:{ease:'power2.out'}}).fromTo(plot,{opacity:.35},{opacity:1,duration:.15},0);
        if(axes.length)contentMotion.fromTo(axes,{opacity:0},{opacity:1,duration:.16},.02);
      }
      for(const series of plot.querySelectorAll(all?'.chart-series':'.chart-series[data-entering]')){
        delete series.dataset.entering;
        const marks=series.querySelectorAll('.chart-point,.chart-error');
        const lines=[...series.querySelectorAll('.chart-connection')],timing=tracePlan(lines.map(line=>Number(line.dataset.traceLength)));
        const motion=gsap.timeline({defaults:{ease:'power2.out'},onComplete:()=>seriesMotions.delete(series)});seriesMotions.set(series,motion);
        if(marks.length)motion.fromTo(marks,{opacity:0},{opacity:1,duration:.19,stagger:{amount:.08}},.06);
        lines.forEach((line,i)=>motion.fromTo(line,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,autoRound:false,duration:timing[i].duration,ease:'power1.inOut',clearProps:'strokeDasharray,strokeDashoffset'},.04+timing[i].start));
      }
  }
  return {
    open,close,reveal,expand(){if(!state.value.expanded)state.expand();},
    dispose(){disposed=true;state.close();events.abort();clearTimeout(resizeTimer);finish();mm?.revert();root.hidden=true;root.inert=true;root.setAttribute('aria-hidden','true');},
  };
}
