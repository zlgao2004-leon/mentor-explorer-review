'use strict';
// 视图切换：五个工作区一次只显示一个，取代原来的单页长滚动。
window.Views=(()=>{
  const names=['start','explore','follow','letter','network'];
  function current(){const h=location.hash.replace(/^#\/?/,'');return names.includes(h)?h:'start';}
  function show(name,opts={}){
    if(!names.includes(name))name='start';
    document.querySelectorAll('main>.view').forEach(s=>s.hidden=s.dataset.view!==name);
    document.querySelectorAll('.rail [data-view]').forEach(a=>{if(a.dataset.view===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(location.hash!=='#/'+name)history.replaceState(null,'','#/'+name);
    if(!opts.keepScroll){window.scrollTo(0,0);const title=document.querySelector('main>.view:not([hidden]) h1,main>.view:not([hidden]) h2');if(title){title.tabIndex=-1;title.focus({preventScroll:true});}}
    document.dispatchEvent(new CustomEvent('viewchange',{detail:name}));
  }
  document.addEventListener('click',e=>{if(e.target.closest('.skip-link')){e.preventDefault();const main=document.querySelector('#main');main.tabIndex=-1;main.focus();return;}const a=e.target.closest('a[data-view]');if(!a)return;e.preventDefault();show(a.dataset.view);});
  window.addEventListener('hashchange',()=>show(current(),{keepScroll:true}));
  document.addEventListener('DOMContentLoaded',()=>show(current(),{keepScroll:true}));
  return {show,current};
})();
