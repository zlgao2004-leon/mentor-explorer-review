'use strict';
const $=s=>document.querySelector(s);
let info,sessionId=null,jobId=null,state=null,selectedGroup=null,busy=false;
const workspaceId=localStorage.getItem('review-workspace')||crypto.randomUUID().replaceAll('-','').slice(0,16);localStorage.setItem('review-workspace',workspaceId);
let backgroundPollKey=null,resumeUsed=false;
const pendingSaves=new Set();
async function persist(body){const saving=api('/api/save',body);pendingSaves.add(saving);try{return await saving;}finally{pendingSaves.delete(saving);}}
function remember(){try{localStorage.setItem('review-explore-session',JSON.stringify({sessionId,jobId,account:$('#account').value}));}catch{}}
const showError=e=>{$('#error').hidden=false;$('#error').textContent=typeof e==='string'?e:e.message;};
async function api(path,body){return window.ReviewDemo.api(path,body);}
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function link(text,url){const a=node('a',text);try{const u=new URL(url);if(['https:','http:','mailto:'].includes(u.protocol)&&!/(researchgate\.net|aminer\.)/i.test(u.hostname)){a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}}catch{}return a;}
function setBusy(value,text=''){busy=value;$('#submit').disabled=value;$('#next').disabled=value||!state?.background_complete;$('#working').hidden=!value;if(text)$('#working-text').textContent=text;}
function selectedSchools(){return [...document.querySelectorAll('#school-options input:checked')].map(x=>x.value);}
function syncCaseButtons(){document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(info.cases[b.dataset.case]?.background===$('#background-text').value)));}
function fillCase(key,focus=true){const p=info.cases[key];$('#background-text').value=p.background;document.querySelectorAll('#school-options input').forEach(x=>x.checked=p.target_schools.includes(x.value));for(const id of ['college','direct-phd','mentor-preference','direction-preference'])$('#'+id).value='';resumeUsed=false;$('#resume-confirm-wrap').hidden=true;$('#resume-confirm').required=false;if(focus)$('#background-text').focus();$('#background-text').scrollTop=0;syncCaseButtons();}
async function poll(key){jobId=key;remember();for(;;){await new Promise(r=>setTimeout(r,1200));const p=await api('/api/job?id='+key);$('#working-text').textContent=p.stage+(p.total?`（${p.completed}/${p.total}位）`:'');if(p.status==='error'){jobId=null;if(p.first_ready){sessionId=p.session||key;await loadState();}remember();throw new Error(p.stage);}if(p.status==='done'||p.status==='partial'){sessionId=p.session||key;jobId=null;await loadState();if(p.status==='partial')watchBackground(key);return;}}}
async function watchBackground(key){if(backgroundPollKey===key)return;backgroundPollKey=key;try{while(sessionId===key){await new Promise(r=>setTimeout(r,3500));const p=await api('/api/job?id='+key);$('#background-progress').hidden=false;$('#background-progress-text').textContent=p.stage+(p.total?`（${p.completed}/${p.total}位）`:'');if(p.status==='error'){$('#resume-job').hidden=false;break;}if(p.status==='done'){await loadState();break;}if(p.status==='partial'){state.judged=p.completed;$('#background-progress-text').textContent=`首批已就绪，其余候选继续核对（${p.completed}/${p.total}位）。`;}}}catch(e){showError(e);}finally{backgroundPollKey=null;}}
async function loadState(){await Promise.allSettled([...pendingSaves]);state=await api('/api/session?id='+sessionId+'&tier='+encodeURIComponent($('#account').value));if(selectedGroup&&!state.map.some(g=>g.name===selectedGroup&&g.remaining))selectedGroup=null;render();$('#results').hidden=false;remember();window.refreshWorkbench?.();}
// ---------- 结果渲染：左侧名单可比较，右侧（窄屏为行内）看一位的完整依据 ----------
let selectedTeacher=null;
const wide=window.matchMedia('(min-width: 1100px)');
const FACET={object:'对象',mechanism:'机理',method:'方法'};
const POSITION={first:'第一作者',last:'末位作者',middle:'中间作者'};
function shortSchool(s){return (s||'').replace('\u4e2d\u56fd\u79d1\u5b66\u9662\u5927\u5b66','国科大');}
function tierMark(d){const t=node('span',d.tier,'tier '+(d.tier==='直接同题'?'direct':d.tier==='同机制邻近'?'adjacent':'method'));return t;}
function matchFacts(d){const wrap=node('span',undefined,'facts');const one=(label,v)=>{const s=node('span',label+(v===true?'一致':v===false?'不同':'未标注'),'fact '+(v===true?'yes':v===false?'no':'na'));return s;};wrap.append(one('对象',d.object_match),one('问题',d.problem_match));return wrap;}
function render(){
$('#explore-empty').hidden=true;
$('#result-mode').textContent=state.precomputed?'虚构背景，预先运行的示例结果。':'虚构背景，本次输入运行的结果。';
$('#preference-note').textContent=(state.preferences_note||[]).join(' ');
$('#background-progress').hidden=state.background_complete;
$('#background-progress-text').textContent=state.background_error||`首批已就绪，其余候选继续核对（${state.judged}/${state.pool_total}位）。`;
$('#resume-job').hidden=!state.background_error;
$('#result-count').textContent=`可浏览 ${state.qualified} 位经模型复核的导师；完整预跑初判 ${state.original_qualified} 位。模型复核不等于人工验收。`;
const navCount=$('#nav-explore-count');navCount.hidden=false;navCount.textContent=state.cards.length;
// 方向
const map=$('#direction-map');map.replaceChildren();
for(const group of state.map){const b=node('button',undefined,'direction-option');b.type='button';b.disabled=group.remaining===0;b.setAttribute('aria-pressed',String(selectedGroup===group.name));
  const top=node('span',undefined,'direction-top');top.append(node('strong',group.name),node('span',group.remaining?`还有 ${group.remaining} 位`:'已看完','direction-count'));
  const meter=node('span',undefined,'direction-meter');meter.setAttribute('aria-hidden','true');for(let i=0;i<group.count;i++)meter.append(node('i',undefined,i<group.count-group.remaining?'seen':''));
  b.append(top,meter,node('span',`共 ${group.count} 位，${group.tiers.join('、')}`,'direction-sub'));
  if(selectedGroup===group.name)b.append(node('span',group.description||'连接示例：'+group.transfer,'direction-desc'));
  b.dataset.direction=group.name;b.onclick=()=>{selectedGroup=selectedGroup===group.name?null:group.name;render();[...document.querySelectorAll('[data-direction]')].find(x=>x.dataset.direction===group.name)?.focus();};map.append(b);}
if(!state.map.length)map.append(node('p','本轮没有证据足够的导师。把研究问题写得更具体，再试一次。','empty-state'));
// 名单
$('#batch-title').textContent=state.batches>1?`已看 ${state.batches} 批，共 ${state.cards.length} 位`:`第一批，${state.cards.length} 位`;
$('#batch-note').textContent=`先读清单合并后共 ${state.reading_unique} 篇论文。`;
if(!state.cards.some(c=>c.id===selectedTeacher))selectedTeacher=wide.matches?(state.cards[0]?.id||null):null;
const list=$('#teacher-cards');list.replaceChildren();let lastBatch=0;
for(const c of state.cards){if(state.batches>1&&c.batch!==lastBatch){lastBatch=c.batch;list.append(node('p',`第 ${c.batch} 批`,'batch-label'));}list.append(row(c));}
placeDetail();
$('#next').hidden=state.background_complete&&!state.can_continue;$('#next').disabled=busy||!state.background_complete;
$('#next').textContent=selectedGroup?`下一批看「${selectedGroup}」`:'再看下一批5位';
$('#next-note').textContent=$('#account').value==='普通'?'普通档位只看第一批。切到会员演示档位可看到最多4批，不涉及支付。':state.can_continue?'看过的老师不会重复出现。':'已到本档位上限，或合格导师已全部看完。';}
function row(c){const d=c.decision,a=node('article',undefined,'match-row');a.id='teacher-'+c.id;a.dataset.selected=String(c.id===selectedTeacher);
  const b=node('button',undefined,'row-main');b.type='button';b.setAttribute('aria-expanded',String(c.id===selectedTeacher));
  const head=node('span',undefined,'row-head');head.append(node('span',c.name,'row-name'),tierMark(d));
  const sub=node('span',`${shortSchool(c.school)}　${c.college||''}`,'row-school');
  const line=node('span',d.bridge[0]?.text||d.reason,'row-line');
  const foot=node('span',undefined,'row-foot');foot.append(matchFacts(d));if(d.evidence==='单篇')foot.append(node('span','单篇依据','fact warn'));if(c.favorite)foot.append(node('span','已收藏','fact saved'));if(c.contact&&c.contact!=='未联系')foot.append(node('span',c.contact,'fact saved'));
  b.append(head,sub,line,foot);b.onclick=()=>{selectedTeacher=(!wide.matches&&selectedTeacher===c.id)?null:c.id;document.querySelectorAll('.match-row').forEach(r=>{const on=r.id==='teacher-'+selectedTeacher;r.dataset.selected=String(on);r.querySelector('.row-main').setAttribute('aria-expanded',String(on));});placeDetail(true);};
  a.append(b);return a;}
function placeDetail(scroll){const c=state?.cards.find(x=>x.id===selectedTeacher),pane=$('#teacher-detail');document.querySelectorAll('.row-detail').forEach(x=>x.remove());pane.replaceChildren();if(!c)return;const body=detailFor(c);
  if(wide.matches){pane.append(body);if(scroll)pane.scrollTop=0;}
  else{const holder=node('div',undefined,'row-detail');holder.append(body);document.getElementById('teacher-'+c.id)?.append(holder);if(scroll)document.getElementById('teacher-'+c.id)?.scrollIntoView({block:'start'});}}
wide.addEventListener('change',()=>{if(!state)return;if(wide.matches&&!selectedTeacher)selectedTeacher=state.cards[0]?.id||null;render();});
function detailFor(c){const d=c.decision,a=node('div',undefined,'detail');
  const head=node('header',undefined,'detail-head'),id=node('div');id.append(node('h3',c.name),node('p',`${c.school}　${c.college||''}`,'detail-school'));head.append(id,tierMark(d));a.append(head);
  if(c.official_direction){const od=node('p',undefined,'official');od.append(node('span','官网方向　','official-label'),document.createTextNode(c.official_direction));a.append(od);}
  // 动作
  const actions=node('div',undefined,'detail-actions'),save=node('button',c.favorite?'已收藏':'收藏','button '+(c.favorite?'saved':'secondary'));save.type='button';
  const contact=node('select',undefined,'contact-select');contact.setAttribute('aria-label',c.name+'的联系进展');for(const text of ['未联系','已发邮件','已回复','面谈','放弃']){const option=node('option',text);option.value=text;option.selected=c.contact===text;contact.append(option);}
  contact.onchange=async()=>{contact.disabled=true;try{await persist({session:sessionId,teacher:c.id,contact:contact.value});c.contact=contact.value;updateRowStatus(c);window.refreshPlanner?.();}catch(e){contact.value=c.contact;showError(e);}finally{contact.disabled=false;}};
  save.onclick=async()=>{save.disabled=true;try{const favorite=!c.favorite;await persist({session:sessionId,teacher:c.id,favorite});c.favorite=favorite;save.textContent=c.favorite?'已收藏':'收藏';save.className='button '+(c.favorite?'saved':'secondary');updateRowStatus(c);window.refreshPlanner?.();}catch(e){showError(e);}finally{save.disabled=false;}};
  const outreach=node('button','写联系信','button secondary'),network=node('button','合作论文','text-button');outreach.type=network.type='button';outreach.onclick=()=>window.openOutreach?.(c);network.onclick=()=>window.openNetwork?.(c);
  const official=link('官网主页',c.official_profile);official.className='text-button';
  actions.append(save,contact,outreach,network,official);a.append(actions);
  a.append(node('p',d.reason,'match-reason'));
  if(d.selection_note)a.append(node('p',d.selection_note,'caption'));
  if(c.related_teachers?.length){const related=node('div',undefined,'related-teachers');related.append(node('h4','共同论文相关导师'));
    related.append(node('p','依据论文有重叠，本批只占一席；共同署名不代表同一课题组。','caption'));
    for(const t of c.related_teachers){const b=node('button',`${t.name} · ${t.shared_papers}篇共同论文`,'text-button');b.type='button';b.onclick=()=>window.openNetwork?.(c,t.id);related.append(b);}a.append(related);}

  // 接得上 / 要转换
  const bridge=node('div',undefined,'bridge'),left=node('section',undefined,'bridge-fit'),right=node('section',undefined,'bridge-gap');
  left.append(node('h4','接得上的地方'));const ul=node('ul');
  for(const b of d.bridge){const li=node('li');li.append(node('span',FACET[b.facet]||'连接','facet'),document.createTextNode(b.text));const p=c.judgment_papers.find(x=>x.key===b.paper_key);if(p){const ev=node('button','依据：'+p.title,'cite');ev.type='button';ev.title=p.title;ev.onclick=()=>{const t=document.getElementById('paper-'+c.id+'-'+b.paper_key);t?.scrollIntoView({block:'center'});t?.classList.add('flash');setTimeout(()=>t?.classList.remove('flash'),1600);};li.append(ev);}ul.append(li);}
  left.append(ul);right.append(node('h4','需要转换的地方'),node('p',d.gap));
  if(d.evidence==='单篇')right.append(node('p','目前只有一篇论文支持这条连接。','gap-note'));
  bridge.append(left,right);a.append(bridge);
  // 论文
  a.append(node('h4','先读这些论文','section-title'));
  const ordered=[...c.judgment_papers].sort((x,y)=>Number(d.read_first.includes(y.key))-Number(d.read_first.includes(x.key)));
  for(const p of ordered){const item=node('div',undefined,'paper-item');item.id='paper-'+c.id+'-'+p.key;const first=d.read_first.includes(p.key),elsewhere=first&&state.reading_owners?.[p.key]?.id!==c.id;
    const h=node('h5');h.append(link(p.title,p.url));item.append(h);
    const meta=node('p',undefined,'paper-meta');meta.append(node('span',p.venue||'来源未提供'),node('span',p.date||'日期待补'));if(p.position)meta.append(node('span',c.name+'为'+(POSITION[p.position]||'作者')));if(first)meta.append(node('span',elsewhere?'已在'+state.reading_owners[p.key].name+'处列入先读':'建议先读','read-first'));item.append(meta);
    if(p.numeric_pending)item.append(node('p','原题录有数值待核，连接说明只采用定性内容。','caption'));
    const disclosure=node('details'),label=node('summary','介绍、作者与原摘要'),content=node('div');disclosure.append(label,content);
    disclosure.addEventListener('toggle',async()=>{if(!disclosure.open||content.dataset.loaded)return;content.dataset.loaded='loading';content.textContent='正在读取原始题录…';try{const res=await api('/api/paper?session='+sessionId+'&teacher='+encodeURIComponent(c.id)+'&key='+encodeURIComponent(p.key));content.replaceChildren();const q=res.paper;const authors=(q.authors||[]).map(x=>x.name).join('；');content.append(node('p',authors?'作者（原署名顺序）：'+authors:'作者名单：来源待补。','caption'),node('p',q.corresponding_boundary||'通讯作者为数据库标注、未经出版社核对。','caption'));const summary=node('p',res.summary.summary||'可按需整理为150–250字的文章介绍。','paper-summary');content.append(summary);if(res.summary.model)content.append(node('p','介绍来源：'+res.summary.model+'；依据题名和摘要。','caption'));if(res.summary.can_generate){const gen=node('button','整理这篇的摘要','button secondary');gen.type='button';gen.onclick=async()=>{gen.disabled=true;summary.textContent='正在依原摘要整理…';try{const x=await api('/api/summary',{session:sessionId,teacher:c.id,key:p.key});summary.textContent=x.summary;gen.remove();content.append(node('p','介绍来源：'+x.model,'caption'));}catch(e){summary.textContent=e.message;gen.disabled=false;}};content.append(gen);}const raw=node('details');raw.append(node('summary','来源原摘要'),node('p',q.abstract||'来源未提供摘要','raw-abstract'));content.append(raw);content.dataset.loaded='yes';}catch(e){content.textContent=e.message;delete content.dataset.loaded;}});
    item.append(disclosure);a.append(item);}
  // 问题
  a.append(node('h4','联系前可以问','section-title'));const asks=node('ol',undefined,'ask-list');for(const question of d.ask)asks.append(node('li',question));a.append(asks);
  // 研究线
  if((c.lines||[]).length){const lines=node('details',undefined,'lines');lines.append(node('summary','本轮命中的研究线'));for(const line of c.lines){const r=node('p',undefined,'line-overview');r.append(node('strong',line.title));const span=line.year_start?`${line.year_start}–${line.year_end}年`:'年份待补';r.append(document.createTextNode(line.kind==='card'?'　官网方向线索，待补论文证据':`　${line.count}篇已确认论文，${span}${line.single_paper?'，单篇证据':''}`));lines.append(r);}lines.append(node('p','研究线由论文题名和摘要自动聚类，不是导师本人确认的分类。','caption'));a.append(lines);}
  const foot=node('p',undefined,'detail-foot');if(c.email){foot.append(link(c.email,'mailto:'+c.email),document.createTextNode('　'));}foot.append(document.createTextNode('公开邮箱不代表当前招生或名额信息。'));a.append(foot);
  return a;}
$('#profile-form').onsubmit=async e=>{e.preventDefault();if(busy)return;$('#error').hidden=true;$('#results').hidden=true;selectedGroup=null;setBusy(true,'正在打开已保存的示例…');try{const data=await api('/api/match',{profile:{background:$('#background-text').value.trim(),target_schools:selectedSchools(),fictional:$('#fictional').checked,college:$('#college').value.trim(),direct_phd:$('#direct-phd').value,mentor_preference:$('#mentor-preference').value,direction_preference:$('#direction-preference').value.trim(),resume_used:resumeUsed,resume_confirmed:$('#resume-confirm').checked}});if(data.status==='done'){sessionId=data.session;await loadState();}else await poll(data.job);window.Views.show('explore');$('#results-title').focus();}catch(error){showError(error);}finally{setBusy(false);}};
$('#next').onclick=async()=>{if(!sessionId||busy)return;$('#error').hidden=true;setBusy(true,'正在打开已保存的下一批…');try{const data=await api('/api/next',{session:sessionId,tier:$('#account').value,group:selectedGroup});await loadState();const latest=state.cards.find(c=>c.batch===state.batches);if(latest){selectedTeacher=latest.id;render();const entry=document.getElementById('teacher-'+latest.id);entry?.querySelector('.row-main')?.focus();entry?.scrollIntoView({block:'nearest'});}}catch(e){showError(e);}finally{setBusy(false);}};
$('#account').onchange=()=>sessionId&&loadState().catch(showError);
$('#why-form').onsubmit=async e=>{e.preventDefault();try{const d=await api('/api/why?id='+sessionId+'&name='+encodeURIComponent($('#teacher-name').value.trim()));$('#why-answer').replaceChildren(...d.answers.map(x=>node('p',`${x.name}${x.school?' · '+x.school:''}：${x.reason}`)));}catch(err){showError(err);}};
async function init(){try{info=await api('/api/info');for(const school of info.schools){const label=node('label'),box=node('input');box.type='checkbox';box.value=school;label.append(box,document.createTextNode(school.replace('\u4e2d\u56fd\u79d1\u5b66\u9662\u5927\u5b66','国科大（UCAS）')));$('#school-options').append(label);}document.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>fillCase(b.dataset.case));fillCase('E01',false);renderBuildStatus();const timer=setInterval(async()=>{try{info=await api('/api/info');renderBuildStatus();if(info.ready_cases.length===2)clearInterval(timer);}catch{}},10000);}catch(e){showError(e);$('#submit').disabled=true;}}
function renderBuildStatus(){$('#build-state').textContent='此版仅打开两个预跑示例，不对新背景重新匹配。收藏、草稿和日程仅存于当前浏览器。';}
async function restore(){try{const active=JSON.parse(localStorage.getItem('review-explore-session')||'null');if(!info||!active)return;if(['普通','会员'].includes(active.account))$('#account').value=active.account;sessionId=active.sessionId;if(active.jobId){setBusy(true,'正在恢复上次的处理进度…');await poll(active.jobId);}else if(sessionId)await loadState();if(state){if(!state.background_complete)watchBackground(sessionId);$('#background-text').value=state.profile.background;syncCaseButtons();document.querySelectorAll('#school-options input').forEach(x=>x.checked=state.profile.target_schools.includes(x.value));for(const [id,key] of [['college','college'],['direct-phd','direct_phd'],['mentor-preference','mentor_preference'],['direction-preference','direction_preference']])$('#'+id).value=state.profile[key]||'';}}catch(e){showError(e);}finally{if(info)setBusy(false);}}
init().then(restore);



$('#resume-job').onclick=async()=>{try{$('#resume-job').disabled=true;await api('/api/resume-job',{session:sessionId});$('#resume-job').hidden=true;watchBackground(sessionId);}catch(e){showError(e);}finally{$('#resume-job').disabled=false;}};

function updateRowStatus(c){
 const foot=document.getElementById('teacher-'+c.id)?.querySelector('.row-foot');if(!foot)return;
 foot.querySelectorAll('.saved').forEach(x=>x.remove());if(c.favorite)foot.append(node('span','已收藏','fact saved'));if(c.contact&&c.contact!=='未联系')foot.append(node('span',c.contact,'fact saved'));
}
window.syncTrackedCards=teachers=>{if(!state)return;for(const c of state.cards){const t=teachers[c.id];if(!t)continue;c.favorite=t.favorite;c.contact=t.status;updateRowStatus(c);}if(window.Views.current()==='explore')placeDetail();};

document.addEventListener('viewchange',e=>{if(e.detail==='explore'&&state)placeDetail();});
