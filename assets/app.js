import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const MANAGER_PASSWORD = 'skf2026';
const SCORER_PASSWORD = 'score2026';
const fallbackKey = 'skf_tt_season2_groups_fallback';
const defaultState = { groups: [{id:'A', name:'Group A'}, {id:'B', name:'Group B'}], stadiums: [{id:'S1', name:'Stadium 1', location:''}, {id:'S2', name:'Stadium 2', location:''}, {id:'S3', name:'Stadium 3', location:''}, {id:'S4', name:'Stadium 4', location:''}, {id:'S5', name:'Stadium 5', location:''}], players: [], matches: [], knockouts: [] };
let state = structuredClone(defaultState);
let docRef = null;
let role = localStorage.getItem('skf_tt_role') || (localStorage.getItem('skf_tt_manager') === 'yes' ? 'manager' : 'viewer');
let isManager = role === 'manager';
let isScorer = role === 'scorer';

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const getConfig = () => window.firebaseConfig || window.SKF_FIREBASE_CONFIG || {};
function hasFirebaseConfig() { const c = getConfig(); return c.apiKey && c.projectId; }

async function initData() {
  if (hasFirebaseConfig()) {
    try {
      const app = initializeApp(getConfig());
      const db = getFirestore(app);
      docRef = doc(db, 'tournaments', 'season2');
      const snap = await getDoc(docRef);
      if (!snap.exists()) await setDoc(docRef, defaultState);
      onSnapshot(docRef, s => {
        state = { ...structuredClone(defaultState), ...(s.exists() ? s.data() : {}) };
        state.groups ||= [];
        state.stadiums ||= structuredClone(defaultState.stadiums);
        state.players ||= [];
        state.matches ||= [];
        state.knockouts ||= [];
        render();
      }, err => { console.error(err); alert('Firebase connection error. Check Firestore rules.'); loadLocal(); });
    } catch(e) { console.error(e); loadLocal(); }
  } else loadLocal();
}
function loadLocal() { state = JSON.parse(localStorage.getItem(fallbackKey) || JSON.stringify(defaultState)); render(); }
async function save() { if (docRef) await setDoc(docRef, state); else localStorage.setItem(fallbackKey, JSON.stringify(state)); }
function requireManager(){ if(!isManager){ alert('Manager login required'); return false; } return true; }
function canScore(){ return isManager || isScorer; }
function requireScorer(){ if(!canScore()){ alert('Manager or scorer login required'); return false; } return true; }

function setRole(){
  isManager = role === 'manager';
  isScorer = role === 'scorer';
  document.body.classList.toggle('is-manager', isManager);
  document.body.classList.toggle('is-scorer', isScorer);
  document.body.classList.toggle('can-score', canScore());
  $('roleBadge').textContent = isManager ? 'Manager Mode' : isScorer ? 'Scorer Mode' : (hasFirebaseConfig() ? 'Live Viewer Mode' : 'Viewer Mode - Firebase not configured');
  $('loginBtn').classList.toggle('hide', canScore());
  $('logoutBtn').classList.toggle('hide', !canScore());
}
window.closeLogin = () => $('loginModal').classList.add('hide');
window.managerLogin = () => {
  const password = $('passwordInput').value;
  if (password === MANAGER_PASSWORD) { role = 'manager'; localStorage.setItem('skf_tt_role','manager'); localStorage.setItem('skf_tt_manager','yes'); closeLogin(); render(); }
  else if (password === SCORER_PASSWORD) { role = 'scorer'; localStorage.setItem('skf_tt_role','scorer'); localStorage.removeItem('skf_tt_manager'); closeLogin(); render(); }
  else alert('Wrong password');
};
$('loginBtn').onclick = () => $('loginModal').classList.remove('hide');
$('logoutBtn').onclick = () => { localStorage.removeItem('skf_tt_role'); localStorage.removeItem('skf_tt_manager'); role = 'viewer'; location.hash='dashboard'; render(); };

function showPage(){ let id=(location.hash||'#dashboard').slice(1); if(id==='manager'&&!isManager) id='dashboard'; if(id==='admin'&&!isManager) id='dashboard'; document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); ($(id)||$('dashboard')).classList.add('active'); render(); }
window.addEventListener('hashchange', showPage);

window.addGroup = async () => { if(!requireManager()) return; const name=$('groupName').value.trim(); if(!name) return; state.groups.push({id:uid(), name}); $('groupName').value=''; await save(); render(); };
window.addStadium = async () => { if(!requireManager()) return; const name=($('stadiumName')?.value||'').trim(); const location=($('stadiumLocation')?.value||'').trim(); if(!name) return alert('Enter stadium name'); state.stadiums ||= []; state.stadiums.push({id:uid(), name, location}); $('stadiumName').value=''; if($('stadiumLocation')) $('stadiumLocation').value=''; await save(); render(); };
window.deleteStadium = async id => { if(!requireManager()) return; if(!confirm('Delete stadium? Existing matches will keep the stadium name as text.')) return; state.stadiums = (state.stadiums||[]).filter(s=>s.id!==id); await save(); render(); };
window.addPlayer = async () => { if(!requireManager()) return; const name=$('playerName').value.trim(); const groupId=$('playerGroup').value; if(!name || !groupId) return alert('Enter player name and select group'); state.players.push({id:uid(), name, groupId}); $('playerName').value=''; await save(); render(); };
window.deleteGroup = async id => { if(!requireManager()) return; if(!confirm('Delete group? Players in this group will become unassigned.')) return; state.groups=state.groups.filter(g=>g.id!==id); state.players.forEach(p=>{ if(p.groupId===id) p.groupId=''; }); state.matches=state.matches.filter(m=>m.groupId!==id); await save(); render(); };
window.deletePlayer = async id => { if(!requireManager()) return; if(!confirm('Delete player and related matches?')) return; state.players=state.players.filter(p=>p.id!==id); state.matches=state.matches.filter(m=>m.aId!==id && m.bId!==id); state.knockouts=state.knockouts.filter(m=>m.aId!==id && m.bId!==id); await save(); render(); };
window.changePlayerGroup = async (id, groupId) => { if(!requireManager()) return; const p=state.players.find(x=>x.id===id); if(p){ p.groupId=groupId; await save(); render(); } };

window.generateGroupMatches = async () => {
  if(!requireManager()) return;
  if(!confirm('Generate round-robin matches inside each group? Existing group matches will be kept.')) return;
  for (const g of state.groups) {
    const list = state.players.filter(p=>p.groupId===g.id);
    for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
      const exists = state.matches.some(m=>m.type==='group' && ((m.aId===list[i].id&&m.bId===list[j].id)||(m.aId===list[j].id&&m.bId===list[i].id)));
      if(!exists) state.matches.push({id:uid(), type:'group', groupId:g.id, groupName:g.name, aId:list[i].id, bId:list[j].id, a:list[i].name, b:list[j].name, score:'', winnerId:null, round:'Group Stage', matchDate:'', matchTime:'', stadiumId:'', stadiumName:'', tableName:''});
    }
  }
  await save(); render();
};
window.clearGroupMatches = async () => { if(!requireManager()) return; if(confirm('Clear all group matches?')) { state.matches=[]; await save(); render(); } };

window.addManualMatch = async () => {
  if(!requireManager()) return;
  const type = $('manualMatchType')?.value || 'group';
  const groupId = $('manualMatchGroup')?.value || '';
  const aId = $('manualMatchPlayerA')?.value || '';
  const bId = $('manualMatchPlayerB')?.value || '';
  if(!aId || !bId) return alert('Select both players.');
  if(aId === bId) return alert('Select two different players.');
  const a = state.players.find(p=>p.id===aId);
  const b = state.players.find(p=>p.id===bId);
  if(!a || !b) return alert('Player not found.');
  const group = state.groups.find(g=>g.id===groupId);
  const round = ($('manualMatchRound')?.value || (type === 'group' ? 'Group Stage' : 'Manual Match')).trim();
  const matchDate = $('manualMatchDate')?.value || '';
  const matchTime = $('manualMatchTime')?.value || '';
  const stadiumId = $('manualMatchStadium')?.value || '';
  const stadium = (state.stadiums||[]).find(s=>s.id===stadiumId);
  const tableName = ($('manualMatchTable')?.value || '').trim();
  const exists = state.matches.some(m => ((m.aId===aId && m.bId===bId) || (m.aId===bId && m.bId===aId)) && (m.type||'group')===type && (m.round||'')===round);
  if(exists && !confirm('A similar match already exists. Add another one anyway?')) return;
  state.matches.push({
    id: uid(), type, groupId, groupName: group?.name || 'Manual',
    aId:a.id, bId:b.id, a:a.name, b:b.name,
    round, matchDate, matchTime, stadiumId, stadiumName: stadium?.name || '', tableName,
    score:'', winnerId:null
  });
  ['manualMatchRound','manualMatchDate','manualMatchTime','manualMatchTable'].forEach(id=>{ if($(id)) $(id).value=''; });
  await save(); render();
};
window.deleteMatch = async id => { if(!requireManager()) return; if(confirm('Delete this scheduled match?')){ state.matches = state.matches.filter(m=>m.id!==id); await save(); render(); } };

function parseScore(score){ let aw=0,bw=0,pfa=0,pfb=0; (score||'').split(',').forEach(g=>{ const [a,b]=g.trim().split('-').map(Number); if(!isNaN(a)&&!isNaN(b)){ pfa+=a; pfb+=b; if(a>b) aw++; else if(b>a) bw++; } }); return {aw,bw,pfa,pfb,winner: aw>bw?'A':bw>aw?'B':null}; }
window.loadScoreForm = () => { const m=[...state.matches,...state.knockouts].find(x=>x.id===$('matchSelect').value); if(!m){ $('scoreForm').innerHTML=''; return; } $('scoreForm').innerHTML=`<p><b>${m.a}</b> vs <b>${m.b}</b></p><input id="scoreInput" placeholder="Example: 11-8, 9-11, 11-6" value="${m.score||''}"><button class="btn" onclick="saveScore('${m.id}')">Save Score</button>`; };
window.saveScore = async id => { if(!requireScorer()) return; const m=[...state.matches,...state.knockouts].find(x=>x.id===id); if(!m) return; m.score=$('scoreInput').value.trim(); const r=parseScore(m.score); m.winnerId = r.winner==='A'?m.aId:r.winner==='B'?m.bId:null; await save(); render(); loadScoreForm(); };

function standingsForGroup(groupId){
  const rows=state.players.filter(p=>p.groupId===groupId).map(p=>({id:p.id,name:p.name,p:0,w:0,l:0,pf:0,pa:0}));
  state.matches.filter(m=>m.groupId===groupId && m.score).forEach(m=>{ const A=rows.find(r=>r.id===m.aId), B=rows.find(r=>r.id===m.bId); if(!A||!B) return; const s=parseScore(m.score); A.p++; B.p++; A.pf+=s.pfa; A.pa+=s.pfb; B.pf+=s.pfb; B.pa+=s.pfa; if(m.winnerId===m.aId){A.w++;B.l++;} else if(m.winnerId===m.bId){B.w++;A.l++;} });
  return rows.sort((a,b)=> b.w-a.w || (b.pf-b.pa)-(a.pf-a.pa) || b.pf-a.pf || a.name.localeCompare(b.name));
}
function allGroupStandings(){ return state.groups.map(g=>({group:g, rows:standingsForGroup(g.id)})); }
function table(rows, cols){ if(!rows.length) return '<p class="muted">No data yet.</p>'; return '<table><thead><tr>'+cols.map(c=>`<th>${c[0]}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>`<td>${typeof c[1]==='function'?c[1](r):r[c[1]]}</td>`).join('')+'</tr>').join('')+'</tbody></table>'; }
function groupName(id){ return state.groups.find(g=>g.id===id)?.name || 'Unassigned'; }

window.generateKnockouts = async () => {
  if(!requireManager()) return;
  const q = Math.max(1, Number($('qualifiersPerGroup').value || 2));
  const groups = allGroupStandings().filter(g => g.rows.length);
  if(groups.length < 1) return alert('Create groups and standings before generating knockouts.');
  if(!confirm(`Generate knockouts using Top ${q} from each group? Existing knockout matches will be replaced.`)) return;
  state.knockouts = [];

  // Standard 2-group semifinal format: A1 vs B2 and B1 vs A2
  if(groups.length === 2 && q === 2){
    const A = groups[0], B = groups[1];
    if(A.rows.length < 2 || B.rows.length < 2) return alert('Each group needs at least 2 qualified players.');
    state.knockouts.push({id:uid(), round:'Semifinal 1', aId:A.rows[0].id, a:`${A.group.name} #1 ${A.rows[0].name}`, bId:B.rows[1].id, b:`${B.group.name} #2 ${B.rows[1].name}`, score:'', winnerId:null});
    state.knockouts.push({id:uid(), round:'Semifinal 2', aId:B.rows[0].id, a:`${B.group.name} #1 ${B.rows[0].name}`, bId:A.rows[1].id, b:`${A.group.name} #2 ${A.rows[1].name}`, score:'', winnerId:null});
  } else {
    // Dynamic format for any number of groups/qualifiers. Pair qualifiers in order.
    let qualifiers = [];
    groups.forEach(g => g.rows.slice(0,q).forEach((r,i) => qualifiers.push({...r, seed:`${g.group.name} #${i+1}`})));
    for(let i=0; i<qualifiers.length; i+=2){
      const a = qualifiers[i], b = qualifiers[i+1];
      if(b) state.knockouts.push({id:uid(), round:'Knockout', aId:a.id, a:`${a.seed} ${a.name}`, bId:b.id, b:`${b.seed} ${b.name}`, score:'', winnerId:null});
      else state.knockouts.push({id:uid(), round:'Bye', aId:a.id, a:`${a.seed} ${a.name}`, bId:'', b:'BYE', score:'', winnerId:a.id});
    }
  }
  await save(); render();
};

window.addManualKnockout = async () => {
  if(!requireManager()) return;
  const round = ($('manualRound').value || 'Knockout').trim();
  const aId = $('manualPlayerA').value;
  const bId = $('manualPlayerB').value;
  if(!aId || !bId) return alert('Select both players.');
  if(aId === bId) return alert('Select two different players.');
  const a = state.players.find(p => p.id === aId);
  const b = state.players.find(p => p.id === bId);
  if(!a || !b) return alert('Player not found.');
  state.knockouts.push({id:uid(), round, aId:a.id, a:a.name, bId:b.id, b:b.name, score:'', winnerId:null});
  $('manualRound').value = '';
  await save(); render();
};
window.clearKnockouts = async () => { if(!requireManager()) return; if(confirm('Clear knockouts?')){ state.knockouts=[]; await save(); render(); } };
window.deleteKnockout = async id => { if(!requireManager()) return; if(confirm('Delete this knockout match?')){ state.knockouts = state.knockouts.filter(m=>m.id!==id); await save(); render(); } };

function render(){
  setRole();
  state.stadiums ||= structuredClone(defaultState.stadiums);
  $('dashPlayers').textContent=state.players.length; $('dashGroups').textContent=state.groups.length; $('dashMatches').textContent=state.matches.length; $('dashDone').textContent=state.matches.filter(m=>m.score).length;
  $('playerGroup').innerHTML=state.groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  if($('manualMatchGroup')) $('manualMatchGroup').innerHTML=state.groups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  if($('manualMatchStadium')) $('manualMatchStadium').innerHTML = '<option value="">Select stadium</option>' + (state.stadiums||[]).map(s=>`<option value="${s.id}">${s.name}${s.location ? ' - ' + s.location : ''}</option>`).join('');
  if($('manualMatchPlayerA')) {
    const playerOpts = state.players.map(p=>`<option value="${p.id}">${p.name} (${groupName(p.groupId)})</option>`).join('');
    $('manualMatchPlayerA').innerHTML = playerOpts;
    $('manualMatchPlayerB').innerHTML = playerOpts;
  }
  $('playersList').innerHTML=table(state.players, [['Player','name'], ['Group', r=> isManager ? `<select onchange="changePlayerGroup('${r.id}', this.value)">${state.groups.map(g=>`<option value="${g.id}" ${g.id===r.groupId?'selected':''}>${g.name}</option>`).join('')}</select>` : groupName(r.groupId)], ['Action', r=>isManager?`<button class="btn danger" onclick="deletePlayer('${r.id}')">Delete</button>`:'']]);
  $('groupsList').innerHTML=state.groups.map(g=>`<h3>${g.name} ${isManager?`<button class="btn danger small" onclick="deleteGroup('${g.id}')">Delete</button>`:''}</h3>`+table(state.players.filter(p=>p.groupId===g.id), [['Player','name']])).join('') || '<p class="muted">No groups yet.</p>';
  if($('stadiumsList')) $('stadiumsList').innerHTML=table(state.stadiums||[], [['Stadium','name'], ['Location', r=>r.location||'-'], ['Action', r=>isManager?`<button class="btn danger small" onclick="deleteStadium('${r.id}')">Delete</button>`:'']]);
  $('scheduleList').innerHTML=table(state.matches, [['Group','groupName'], ['Round', r=>r.round||'Group Stage'], ['Match', r=>`${r.a} vs ${r.b}`], ['Date/Time', r=>`${r.matchDate||'-'} ${r.matchTime||''}`.trim()], ['Stadium', r=>r.stadiumName||'-'], ['Notes', r=>r.tableName||'-'], ['Score', r=>r.score||'Pending'], ['Winner', r=>r.winnerId?(r.winnerId===r.aId?r.a:r.b):'-'], ['Action', r=>isManager?`<button class="btn danger small" onclick="deleteMatch('${r.id}')">Delete</button>`:'']]);
  $('dashUpcoming').innerHTML=table(state.matches.filter(m=>!m.score).slice(0,10), [['When', r=>`${r.matchDate||'-'} ${r.matchTime||''}`.trim()], ['Stadium', r=>r.stadiumName||'-'], ['Group','groupName'], ['Match', r=>`${r.a} vs ${r.b}`]]);
  $('dashLeaderboard').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows.slice(0,4), [['Rank', (r)=>g.rows.indexOf(r)+1], ['Player','name'], ['P','p'], ['W','w'], ['L','l'], ['Diff', r=>r.pf-r.pa]])).join('');
  $('groupStandings').innerHTML=allGroupStandings().map(g=>`<h3>${g.group.name}</h3>`+table(g.rows, [['Rank', r=>g.rows.indexOf(r)+1], ['Player','name'], ['P','p'], ['W','w'], ['L','l'], ['PF','pf'], ['PA','pa'], ['Diff', r=>r.pf-r.pa]])).join('');
  $('knockoutList').innerHTML=table(state.knockouts, [['Round','round'], ['Match', r=>`${r.a} vs ${r.b}`], ['Score', r=>r.score||'Pending'], ['Winner', r=>r.winnerId?(r.winnerId===r.aId?r.a:r.b):'-'], ['Action', r=>isManager?`<button class="btn danger small" onclick="deleteKnockout('${r.id}')">Delete</button>`:'']]);
  if($('manualPlayerA')) {
    const opts = state.players.map(p=>`<option value="${p.id}">${p.name} (${groupName(p.groupId)})</option>`).join('');
    $('manualPlayerA').innerHTML = opts;
    $('manualPlayerB').innerHTML = opts;
  }
  const all=[...state.matches, ...state.knockouts]; $('matchSelect').innerHTML=all.map(m=>`<option value="${m.id}">${m.round||m.groupName}: ${m.a} vs ${m.b}</option>`).join(''); if(all.length) loadScoreForm();
}
window.exportCSV = () => { let lines=[['Group','Rank','Player','Played','Won','Lost','PF','PA','Diff']]; allGroupStandings().forEach(g=>g.rows.forEach((r,i)=>lines.push([g.group.name,i+1,r.name,r.p,r.w,r.l,r.pf,r.pa,r.pf-r.pa]))); download('skf-tt-group-standings.csv', lines.map(r=>r.join(',')).join('\n')); };
window.downloadBackup = () => download('skf-tt-season2-backup.json', JSON.stringify(state,null,2));
function download(name,text){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=name; a.click(); }
window.resetAll = async () => { if(!requireManager()) return; if(confirm('Reset all data?')){ state=structuredClone(defaultState); await save(); render(); } };

initData(); showPage();
