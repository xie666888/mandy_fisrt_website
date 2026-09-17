(() => {
  const KB = window.MAIBA_KB || [];
  const QUICK = window.MAIBA_QUICK_QUESTIONS || [];
  const $ = (s) => document.querySelector(s);
  const messages = $('#messages');
  const input = $('#questionInput');
  const form = $('#composer');
  const clearBtn = $('#clearBtn');
  const quickChips = $('#quickChips');
  let selectedAge = 'all';

  const state = {
    history: safeParse(localStorage.getItem('maiba_parenting_history')) || []
  };

  function safeParse(v){ try { return JSON.parse(v); } catch { return null; } }
  function escapeHtml(v=''){ return v.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function save(){ localStorage.setItem('maiba_parenting_history', JSON.stringify(state.history.slice(-20))); }

  function renderWelcome(){
    const tpl = $('#welcomeTemplate');
    messages.appendChild(tpl.content.cloneNode(true));
  }

  function addUser(text, persist=true){
    const el = document.createElement('article');
    el.className='message user';
    el.innerHTML=`<div class="bubble">${escapeHtml(text)}</div>`;
    messages.appendChild(el);
    if(persist){ state.history.push({role:'user',text}); save(); }
    scrollDown();
  }

  function addAssistant(answer, persist=true){
    const el = document.createElement('article');
    el.className='message assistant';
    const sourceHtml = answer.sources.map(s => `<a href="${s[1]}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(s[0])}</a>`).join('');
    const steps = answer.steps.map(x => `<li>${escapeHtml(x)}</li>`).join('');
    el.innerHTML=`
      <div class="message-avatar">麦</div>
      <div class="bubble">
        <p><strong>${escapeHtml(answer.lead)}</strong></p>
        <p>${escapeHtml(answer.insight)}</p>
        <div class="answer-block">
          <div class="answer-title">① 现在可以怎么做</div>
          <ol class="step-list">${steps}</ol>
        </div>
        <div class="answer-block">
          <div class="answer-title">② 可以这样开口</div>
          <div class="script">${escapeHtml(answer.script)}</div>
        </div>
        <div class="answer-block">
          <div class="answer-title">③ 参考依据</div>
          <div class="source-list">${sourceHtml}</div>
        </div>
        <div class="safety">如果出现持续的身体伤害、自伤/伤人风险、虐待，或问题长期明显影响孩子日常功能，请优先寻求当地专业医疗、心理或儿童发展服务的帮助。</div>
        <div class="meta-line">匹配主题：${escapeHtml(answer.matchedTitles.join(' · '))}</div>
      </div>`;
    messages.appendChild(el);
    if(persist){ state.history.push({role:'assistant',answer}); save(); }
    scrollDown();
  }

  function showTyping(){
    const el = document.createElement('article');
    el.className='message assistant'; el.id='typing';
    el.innerHTML='<div class="message-avatar">麦</div><div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>';
    messages.appendChild(el); scrollDown();
  }
  function hideTyping(){ $('#typing')?.remove(); }
  function scrollDown(){ setTimeout(()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}),40); }

  function scoreDoc(doc, question){
    let score=0;
    const q = question.toLowerCase().replace(/\s+/g,'');
    doc.tags.forEach(tag => { if(q.includes(tag.toLowerCase())) score += tag.length >= 3 ? 5 : 3; });
    if(selectedAge !== 'all' && doc.ages.includes(selectedAge)) score += 2;
    if(doc.id==='core-connection') score += .7;
    return score;
  }

  function localRagProvider(question){
    const ranked = KB.map(doc => ({doc,score:scoreDoc(doc,question)})).sort((a,b)=>b.score-a.score);
    let picks = ranked.filter(x=>x.score>0).slice(0,2).map(x=>x.doc);
    if(!picks.length){ picks = [KB.find(x=>x.id==='core-connection'), KB.find(x=>x.id==='rules')].filter(Boolean); }
    const primary=picks[0];
    const extra=picks[1];
    const steps=[...primary.steps, ...(extra ? extra.steps.slice(0,1) : [])].slice(0,4);
    const sources=[];
    [...primary.sources, ...(extra ? extra.sources.slice(0,1) : [])].forEach(s=>{ if(!sources.some(x=>x[1]===s[1])) sources.push(s); });
    return {
      lead: getLead(question,primary.id),
      insight: primary.insight + (extra && extra.id!==primary.id ? ` 另外也要留意：${extra.insight}` : ''),
      steps,
      script: primary.script,
      sources: sources.slice(0,3),
      matchedTitles:picks.map(x=>x.title)
    };
  }

  // 未来升级点：把这里替换为 fetch('/api/chat', ...)，其余 UI 与知识结构无需改。
  const answerProvider = async (question) => localRagProvider(question);

  function getLead(q,id){
    if(id==='homework') return '这件事先别只看成“孩子不自觉”，更重要的是找出他卡在启动、能力、疲惫还是自主感。';
    if(id==='screens') return '手机问题通常不是一次“收掉”就解决，而是要把家庭规则和替代生活一起搭起来。';
    if(id==='teen') return '青春期沟通的第一目标，不一定是马上让孩子听你的，而是先保住他愿意继续和你说。';
    if(id==='young-emotion') return '孩子情绪冲上来的那几分钟，先做调节，比讲道理更重要。';
    if(id==='siblings') return '手足冲突里，大人第一职责是安全和边界，不必每一次都当裁判。';
    return '先把“纠正孩子”稍微往后放一点，先弄清楚行为背后的情境，再处理规则与行动。';
  }

  async function ask(question){
    const q=question.trim(); if(!q) return;
    addUser(q); input.value=''; autoGrow();
    showTyping();
    await new Promise(r=>setTimeout(r,360));
    try{ addAssistant(await answerProvider(q)); }
    catch(e){
      const fallback={lead:'这次回答没有生成成功。',insight:'你可以换一种更具体的描述再试一次，例如告诉我孩子年龄、发生了什么、你做了什么。',steps:['描述一个具体场景','补充孩子年龄','告诉我你最想解决的一个问题'],script:'“我把事情再说具体一点……”',sources:[],matchedTitles:['系统提示']};
      addAssistant(fallback);
    } finally { hideTyping(); }
  }

  function restore(){
    if(!state.history.length){ renderWelcome(); return; }
    state.history.forEach(item=> item.role==='user' ? addUser(item.text,false) : addAssistant(item.answer,false));
  }

  QUICK.forEach(q=>{
    const b=document.createElement('button'); b.type='button'; b.className='topic-chip'; b.textContent=q; b.addEventListener('click',()=>ask(q)); quickChips.appendChild(b);
  });

  document.querySelectorAll('.age-chip').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.age-chip').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active'); selectedAge=btn.dataset.age;
  }));

  form.addEventListener('submit',e=>{e.preventDefault();ask(input.value)});
  input.addEventListener('input',autoGrow);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();} });
  clearBtn.addEventListener('click',()=>{ localStorage.removeItem('maiba_parenting_history'); state.history=[]; messages.innerHTML=''; renderWelcome(); });
  function autoGrow(){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,120)+'px'; }
  restore();
})();
