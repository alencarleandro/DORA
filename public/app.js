const $=id=>document.getElementById(id);
let key=sessionStorage.getItem('dora-key') || '', mode='collect', current=null, jobs=[];
const statuses={pending:'PRONTO',running:'EM EXECUÇÃO',paused:'PAUSADO',partial:'COM ERROS',completed:'CONCLUÍDO',failed:'FALHOU'};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(message=''){ $('notice').textContent=message; $('notice').hidden=!message; }
async function api(route,options={}){
  const response=await fetch(`./api/${route}`,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers}});
  if(!response.ok){const error=await response.json();if(response.status===401){key='';sessionStorage.removeItem('dora-key');$('login').hidden=false;$('app').hidden=true;}throw new Error(error.error);}
  return response.json();
}
async function refresh(){
  try{ jobs=await api('jobs');$('login').hidden=true;$('app').hidden=false;renderHistory();if(current){const found=jobs.find(j=>j.id===current.id);if(found)render(found);} }
  catch(error){notice(error.message);}
}
function renderHistory(){
  $('history-list').innerHTML=jobs.length?jobs.map(j=>`<div class="history-row"><div><strong>${j.mode==='collect'?'Coleta GitHub':'Importação CSV'} · ${escapeHTML(j.start)} → ${escapeHTML(j.end)}</strong><small>${j.total} repositório(s) · ${new Date(j.created_at).toLocaleString('pt-BR')} · ${statuses[j.status]}</small></div><button class="secondary" data-open="${j.id}">Abrir resultados →</button></div>`).join(''):'<p>Nenhuma execução ainda. Sua primeira coleta aparecerá aqui.</p>';
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{render(jobs.find(j=>j.id===b.dataset.open));$('workspace').scrollIntoView({behavior:'smooth'});});
}
const number=v=>v==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(v);
const percent=v=>v==null?'—':`${number(v*100)}%`;
function render(job){
  current=job;$('empty').hidden=true;$('monitor-content').hidden=false;$('status').textContent=statuses[job.status];$('stage').textContent=job.stage;$('progress-text').textContent=`${job.progress} / ${job.total}`;$('progress').max=job.total;$('progress').value=job.progress;
  $('pause').hidden=job.status!=='running';$('resume').hidden=!['paused','partial','failed'].includes(job.status);$('submit').disabled=jobs.some(j=>j.status==='running');
  $('funnel').innerHTML=[['Candidatos',job.funnel.candidates],['Processados',job.funnel.processed],['≥ 50 runs',job.funnel.eligible_runs],['Erros',job.errors.length]].map(([name,value])=>`<div><strong>${value}</strong><span>${name}</span></div>`).join('');
  $('logs').innerHTML=job.logs.slice(-30).map(l=>`<div><time>${new Date(l.at).toLocaleTimeString('pt-BR')}</time>${escapeHTML(l.message)}</div>`).join('');$('logs').scrollTop=$('logs').scrollHeight;
  $('results').hidden=!job.results.length;
  $('stat-repos').textContent=number(job.results.length);$('stat-runs').textContent=number(job.results.reduce((n,r)=>n+(r.runs_valid||0),0));
  const values=job.results.map(r=>r.cfr_ci).filter(v=>v!=null).sort((a,b)=>a-b), mid=(values.length-1)/2;
  $('stat-cfr').textContent=values.length?percent((values[Math.floor(mid)]+values[Math.ceil(mid)])/2):'—';$('stat-censored').textContent=number(job.results.reduce((n,r)=>n+(r.episodes_censored||0),0));renderRows();
}
function renderRows(){if(!current)return;const query=$('search').value.toLowerCase();$('rows').innerHTML=current.results.filter(r=>r.repository.toLowerCase().includes(query)).map(r=>`<tr><td>${escapeHTML(r.repository)}<small>${escapeHTML(r.default_branch)}</small></td><td>${number(r.runs_valid)}</td><td>${percent(r.cfr_ci)}</td><td>${r.recovery_median_hours==null?'—':`${number(r.recovery_median_hours)} h`}<small>IQR: ${number(r.recovery_iqr_hours)} h</small></td><td>${number(r.episodes_censored)}<small>${percent(r.censored_fraction)}</small></td><td><span class="badge ${r.eligible_runs?'':'warn'}">${r.eligible_runs?'≥ 50 runs':r.excluded_reason==='sem_actions'?'Sem Actions':'< 50 runs'}</span></td></tr>`).join('')||'<tr><td colspan="6">Nenhum resultado para esta busca.</td></tr>';}
function setMode(value){mode=value;for(const v of ['collect','import']){$(`${v}-tab`).classList.toggle('selected',v===value);$(`${v}-tab`).setAttribute('aria-selected',v===value);}const collecting=value==='collect';$('token-label').hidden=!collecting;$('token-help').hidden=!collecting;$('csv-hint').textContent=collecting?'Lista da pessoa A: full_name, default_branch (opcional)':'Runs com repository, default_branch e campos de execução';$('sample').href=collecting?'./examples/repositories.csv':'./examples/runs.csv';$('submit').innerHTML=collecting?'Iniciar coleta <span>→</span>':'Calcular métricas <span>→</span>';$('csv').value='';$('file-name').textContent='Selecione um arquivo CSV';}
$('collect-tab').onclick=()=>setMode('collect');$('import-tab').onclick=()=>setMode('import');$('csv').onchange=()=>{$('file-name').textContent=$('csv').files[0]?.name || 'Selecione um arquivo CSV';};
$('login-form').onsubmit=async event=>{event.preventDefault();key=$('access-key').value.trim();try{jobs=await api('jobs');sessionStorage.setItem('dora-key',key);$('access-key').value='';notice();await refresh();if(jobs.length)render(jobs[0]);}catch(e){notice(e.message);}};
$('job-form').onsubmit=async event=>{event.preventDefault();notice();$('submit').disabled=true;try{const file=$('csv').files[0];if(!file)throw new Error('Selecione um CSV.');if(file.size>9*1024*1024)throw new Error('Use CSV de até 9 MB.');const job=await api('jobs',{method:'POST',body:JSON.stringify({csv:await file.text(),mode,start:$('start').value,end:$('end').value,token:$('token').value.trim()})});$('token').value='';render(job);await refresh();}catch(e){notice(e.message);$('submit').disabled=false;}};
$('pause').onclick=async()=>{try{await api(`jobs/${current.id}/pause`,{method:'POST',body:'{}'});await refresh();}catch(e){notice(e.message);}};
$('resume').onclick=async()=>{try{await api(`jobs/${current.id}/resume`,{method:'POST',body:JSON.stringify({token:$('token').value.trim()})});$('token').value='';await refresh();}catch(e){notice(e.message);}};
$('refresh').onclick=refresh;$('search').oninput=renderRows;
$('logout').onclick=()=>{sessionStorage.removeItem('dora-key');key='';current=null;$('app').hidden=true;$('login').hidden=false;notice();};
document.querySelectorAll('[data-export]').forEach(button=>button.onclick=async()=>{try{const response=await fetch(`./api/jobs/${current.id}/export?kind=${button.dataset.export}`,{headers:{Authorization:`Bearer ${key}`}});if(!response.ok)throw new Error('Falha ao exportar.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=`dora-${button.dataset.export}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message);}});
if(key)refresh().then(()=>{if(jobs.length)render(jobs[0]);});setInterval(()=>{if(key)refresh();},3000);
