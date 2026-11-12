'use strict';
// This adapter has no generation, email, or remote write endpoints.
window.ReviewDemo = (() => {
  const STORAGE='mentor-review-state-v1';
  const blank=()=>({sessions:{},planner:{teachers:{},events:{}},drafts:{}});
  let db;try{db=JSON.parse(localStorage.getItem(STORAGE)||'null')||blank();}catch{db=blank();}
  const ready=fetch(new URL('./data/review.json',document.currentScript.src)).then(r=>{if(!r.ok)throw Error('示例资料读取失败，请刷新页面。');return r.json();});
  const clone=x=>JSON.parse(JSON.stringify(x));
  const taipei=()=>new Date(Date.now()+8*3600e3).toISOString().slice(0,19)+'+08:00';
  const uid=()=>crypto.randomUUID().replaceAll('-','').slice(0,16);
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(db));}catch{throw Error('浏览器无法保存记录，请允许本站本地存储，或导出当前草稿后再试。');}}
  function date(value){if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('日期格式无效。');return value||'';}
  function session(data,id){if(!data.cases[id])throw Error('请先选择 NAND 或功放示例。');if(!db.sessions[id])db.sessions[id]={batches:[data.cases[id].first]};return db.sessions[id];}
  function teacher(data,id,tid){const c=data.cases[id]?.cards[tid];if(!c)throw Error('本分享版没有这位导师的已复核卡片。');return c;}
  function unique(c,ids){const picked=[],used=new Set();for(const tid of ids){const d=c.cards[tid].decision,keys=[...new Set(d.direct_evidence?.length?d.direct_evidence:d.bridge.map(b=>b.paper_key))];if(keys.length===1&&used.has(keys[0]))continue;if(keys.length===1)used.add(keys[0]);picked.push(tid);if(picked.length===5)break;}return picked;}
  const group=c=>c.decision.map_group||c.decision.group_name;
  function visible(data,id,tier='普通'){
    const c=data.cases[id],s=session(data,id),max=tier==='会员'?4:1,batches=s.batches.slice(0,max),seen=new Set(batches.flat());
    const allSeen=new Set(s.batches.flat()),cards=[],reading={};
    batches.forEach((b,i)=>b.forEach(tid=>{const t=clone(c.cards[tid]),p=db.planner.teachers[tid];t.batch=i+1;t.favorite=!!p?.favorite;t.contact=p?.status||'未联系';delete t.papers_detail;t.decision.read_first.forEach(k=>reading[k]??={id:tid,name:t.name});cards.push(t);}));
    const groups={};for(const tid of c.rank){const t=c.cards[tid],name=group(t),g=groups[name]??={name,count:0,remaining:0,transfer:t.decision.bridge[0]?.text||'',tiers:[]};g.count++;if(!seen.has(tid))g.remaining++;if(!g.tiers.includes(t.decision.tier))g.tiers.push(t.decision.tier);}
    for(const g of c.topic_groups)if(groups[g.name]&&g.description)groups[g.name].description=g.description;
    return {profile:clone(c.profile),cards,batches:batches.length,max_batches:max,map:Object.values(groups),qualified:c.rank.length,original_qualified:c.original_qualified,pending_evidence:c.pending_evidence,reading_unique:Object.keys(reading).length,reading_owners:reading,judged:c.rank.length,pool_total:c.rank.length,background_complete:true,precomputed:true,preferences_note:['仅使用已保存的模型复核结果；不代表团队人工签字放行。'],can_continue:batches.length<max&&c.rank.some(t=>!seen.has(t)),student_release:false};
  }
  async function api(path,body={}){
    const data=await ready,u=new URL(path,location.origin),p=u.pathname,q=u.searchParams,id=q.get('session')||q.get('id')||body.session;
    if(p==='/api/info')return {cases:Object.fromEntries(Object.entries(data.cases).map(([k,v])=>[k,v.profile])),schools:[...new Set(Object.values(data.cases).flatMap(c=>c.profile.target_schools))],ready_cases:['E01','E06'],status:{}};
    if(p==='/api/match'){
      const input=body.profile||{};if(!input.fictional)throw Error('此版仅供虚构背景审阅。');
      const key=Object.keys(data.cases).find(k=>data.cases[k].profile.background===input.background);
      if(!key)throw Error('在线审阅版不运行新背景匹配。请用上方按钮重新选择一个示例。');
      const schools=data.cases[key].profile.target_schools;
      if(schools.length!==input.target_schools.length||schools.some(x=>!input.target_schools.includes(x)))throw Error('示例学校已固定。请重新选择示例恢复学校范围。');
      db.sessions[key]={batches:[data.cases[key].first]};save();return {status:'done',session:key};
    }
    if(p==='/api/session')return visible(data,id,q.get('tier'));
    if(p==='/api/next'){
      const s=session(data,id),c=data.cases[id];if(body.tier!=='会员')throw Error('请切换到会员演示档位，体验后续批次。');
      if(s.batches.length>=4)throw Error('本轮已展示四批。可以重新打开示例。');
      const seen=new Set(s.batches.flat()),rank=c.rank.filter(t=>!seen.has(t)&&(!body.group||group(c.cards[t])===body.group));
      const batch=unique(c,rank);if(!batch.length)throw Error('该方向的已复核卡片已经看完，请选择其他方向。');s.batches.push(batch);save();return {status:'done',session:id};
    }
    if(p==='/api/save'){
      const c=teacher(data,id,body.teacher),t=db.planner.teachers[c.id]??={id:c.id,name:c.name,school:c.school,status:'未联系',favorite:false,sent_date:'',reply_date:'',reminder_date:'',notes:'',session:id};
      if('favorite' in body)t.favorite=body.favorite===true;if(body.contact)t.status=body.contact;t.session=id;save();return {ok:true};
    }
    if(p==='/api/planner')return clone(db.planner);
    if(p==='/api/planner/teacher'){
      const t=db.planner.teachers[body.teacher];if(!t)throw Error('请先收藏老师。');
      const sent=date(body.sent_date),reply=date(body.reply_date),reminder=date(body.reminder_date);
      if(sent&&reply&&reply<sent)throw Error('回复日期不能早于发信日期。');
      Object.assign(t,{status:body.status,sent_date:sent,reply_date:reply,reminder_date:reminder,notes:String(body.notes||'').slice(0,2000)});
      const eid='contact-'+t.id;if(reminder)db.planner.events[eid]={id:eid,title:'联系跟进 · '+t.name,date:reminder,reminder_time:'09:00',teacher:t.id,notes:t.notes};else delete db.planner.events[eid];save();return clone(db.planner);
    }
    if(p==='/api/planner/event'){
      const eid=body.id||uid(),old=db.planner.events[eid]||{};
      if(body.delete){delete db.planner.events[eid];if(old.teacher&&db.planner.teachers[old.teacher])db.planner.teachers[old.teacher].reminder_date='';}
      else {if(!body.title?.trim()||!date(body.date))throw Error('请填写事项和日期。');if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.reminder_time))throw Error('提醒时间格式无效。');db.planner.events[eid]={...old,id:eid,title:body.title.trim().slice(0,120),date:body.date,reminder_time:body.reminder_time,notes:String(body.notes||'').slice(0,2000)};if(old.teacher)db.planner.teachers[old.teacher].reminder_date=body.date;}
      save();return clone(db.planner);
    }
    if(p==='/api/paper')return clone(teacher(data,id,q.get('teacher')).papers_detail[q.get('key')]);
    if(p==='/api/why'){
      session(data,id);const name=q.get('name')?.trim(),matches=data.directory.filter(t=>t.name===name);
      return {answers:matches.length?matches.map(t=>({...t,reason:data.cases[id].reasons[t.id]})):[{name,reason:'当前目录没有此姓名的精确记录；不表示其研究不相关。'}]};
    }
    if(p==='/api/network'){const net=data.networks[q.get('teacher')];if(!net)throw Error('此分享版没有打包这位老师的下一层网络。请从已展示导师或上一位共同作者继续查看。');return clone(net);}
    if(p==='/api/group-links')return clone(data.cases[id].links);
    if(p==='/api/mail/status')return {config:{},outbox:[],boundary:'在线审阅版不连接邮箱、不收集密码、不发送邮件。可以编辑和导出草稿，回复状态请在“我的导师”手动记录。'};
    if(p.startsWith('/api/mail/'))throw Error('真实邮箱连接与发送没有在此公开审阅版开放。');
    if(p==='/api/outreach')return {drafts:clone(Object.values(db.drafts).sort((a,b)=>b.updated.localeCompare(a.updated)))};
    if(p==='/api/outreach/draft'){
      const c=teacher(data,id,body.teacher),name=body.student_name?.trim()||'[姓名]',school=body.school_major?.trim()||'[学校及专业]',papers=c.judgment_papers.filter(p=>c.decision.read_first.includes(p.key));
      const enriched=body.mode==='model',title=enriched&&papers.length?papers[0].title:'[请填写准备阅读的论文题名]',question=enriched?(c.decision.ask[0]||'[请填写具体问题]'):'[请填写希望请教的具体研究问题]';
      const d={id:uid(),updated:taipei(),teacher:c.id,teacher_name:c.name,session:id,recipient:'',subject:'[演示草稿] '+name+'—研究方向与培养机会咨询',body:`${c.name}老师您好：\n\n我是${school}的${name}。${body.experience?.trim()||'[请补充已有项目经历，区分已做的内容和研究目标]'}${body.application?'\n本次申请目标：'+body.application:''}\n\n我准备阅读您参与的《${title}》，希望进一步了解：${question}\n\n如果方向合适，想请教是否方便交流，以及有哪些需要提前准备的材料。\n\n感谢您的时间。\n${name}`,checklist:['这是虚构背景演示模板，不能直接发给导师。','请核对个人经历、申请目标和论文依据。','模板未调用模型；没有核实招生名额或邮箱。'],papers:enriched?papers.slice(0,1):[],reviewed:false,fictional:true};
      db.drafts[d.id]=d;save();return clone(d);
    }
    if(p==='/api/outreach/save'){
      const d=db.drafts[body.id];if(!d)throw Error('草稿不存在。');if(!body.subject?.trim()||!body.body?.trim())throw Error('请填写主题和正文。');if(/[\r\n]/.test(body.subject+body.recipient))throw Error('主题和邮箱不能换行。');Object.assign(d,{subject:body.subject.slice(0,200),body:body.body.slice(0,12000),recipient:body.recipient,reviewed:!!body.reviewed,updated:taipei()});save();return clone(d);
    }
    if(p==='/api/resume')return extractResume(body);
    throw Error('此操作需要完整后台，尚未在在线审阅版开放。');
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  const utf=s=>new TextEncoder().encode(s);
  const xml=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  // Minimal standards-based ZIP writer for the three OOXML parts; no external service.
  function zip(files){const pieces=[],central=[];let offset=0;const u16=n=>new Uint8Array([n&255,n>>8&255]),u32=n=>new Uint8Array([n&255,n>>>8&255,n>>>16&255,n>>>24&255]);const join=arr=>{const out=new Uint8Array(arr.reduce((n,x)=>n+x.length,0));let p=0;for(const a of arr){out.set(a,p);p+=a.length;}return out;};
    for(const [name,text] of Object.entries(files)){const n=utf(name),b=utf(text);let crc=-1;for(const x of b){crc^=x;for(let i=0;i<8;i++)crc=crc>>>1^((crc&1)?0xedb88320:0);}crc=(crc^-1)>>>0;const header=join([u32(0x04034b50),u16(20),u16(0x800),u16(0),u16(0),u16(33),u32(crc),u32(b.length),u32(b.length),u16(n.length),u16(0),n]);pieces.push(header,b);central.push(join([u32(0x02014b50),u16(20),u16(20),u16(0x800),u16(0),u16(0),u16(33),u32(crc),u32(b.length),u32(b.length),u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n]));offset+=header.length+b.length;}
    const c=join(central);return join([...pieces,c,u32(0x06054b50),u16(0),u16(0),u16(central.length),u16(central.length),u32(c.length),u32(offset),u16(0)]);
  }
  function downloadDraft(id,kind){const d=db.drafts[id];if(!d)return;const text=d.subject+'\n\n'+d.body;
    if(kind==='docx'){const paras=text.split('\n').map(s=>'<w:p><w:r><w:t xml:space="preserve">'+xml(s)+'</w:t></w:r></w:p>').join('');const files={'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paras+'<w:sectPr/></w:body></w:document>'};download('联系信_演示草稿.docx',zip(files),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');}
    else if(kind==='eml'){const b64=s=>btoa(Array.from(utf(s),b=>String.fromCharCode(b)).join(''));download('联系信_演示草稿.eml','X-Unsent: 1\r\nSubject: =?UTF-8?B?'+b64(d.subject)+'?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n'+b64(d.body).match(/.{1,76}/g).join('\r\n')+'\r\n','message/rfc822');}
    else download('联系信_演示草稿.txt',text,'text/plain;charset=utf-8');
  }
  function downloadCalendar(){const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'),stamp=d=>d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mentor Review//Taipei//','CALSCALE:GREGORIAN','X-WR-TIMEZONE:Asia/Taipei'];for(const e of Object.values(db.planner.events)){const end=new Date(e.date+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);rows.push('BEGIN:VEVENT','UID:'+e.id+'@mentor-review','DTSTAMP:'+stamp(new Date()),'DTSTART;VALUE=DATE:'+e.date.replaceAll('-',''),'DTEND;VALUE=DATE:'+end.toISOString().slice(0,10).replaceAll('-',''),'SUMMARY:'+esc(e.title),'DESCRIPTION:'+esc(e.notes),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+esc(e.title),'TRIGGER;VALUE=DATE-TIME:'+stamp(new Date(e.date+'T'+(e.reminder_time||'09:00')+':00+08:00')),'END:VALARM','END:VEVENT');}rows.push('END:VCALENDAR');const fold=line=>{let result='',part='',size=0;for(const ch of line){const n=utf(ch).length;if(size+n>73){result+=part+'\r\n ';part='';size=1;}part+=ch;size+=n;}return result+part;};download('导师探索提醒.ics',rows.map(fold).join('\r\n')+'\r\n','text/calendar;charset=utf-8');}
  async function extractResume(body){const bytes=Uint8Array.from(atob(body.data),c=>c.charCodeAt(0));let text='';if(/\.pdf$/i.test(body.name)){const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',location.href).href;const doc=await pdfjs.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:true,cMapUrl:new URL("./vendor/cmaps/",location.href).href,cMapPacked:true,standardFontDataUrl:new URL("./vendor/standard_fonts/",location.href).href}).promise;try{if(doc.numPages>30)throw Error('请使用30页以内的虚构简历。');for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();text+=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n';}}finally{await doc.destroy();}}
    else if(/\.docx$/i.test(body.name)){if(!window.mammoth)throw Error('文字提取组件尚未就绪，请稍后再试。');text=(await window.mammoth.extractRawText({arrayBuffer:bytes.buffer})).value;}
    else throw Error('请选择PDF或DOCX文件。');if(!text.trim())throw Error('没有可提取文字；扫描件暂不支持OCR。');return {text:text.trim().slice(0,20000),truncated:text.length>2400,notice:'文字仅在你的浏览器提取，没有上传。可预览和编辑；此分享版不会用它重新匹配。'};
  }
  function reset(){localStorage.removeItem(STORAGE);localStorage.removeItem('review-explore-session');location.reload();}
  return {api,ready,downloadDraft,downloadCalendar,reset};
})();
