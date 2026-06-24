import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const MANAGER_PASSWORD = 'skf2026';
const fallbackKey = 'skf_tt_season2_fallback';
const defaultState = { players: [], teams: [], matches: [] };
let state = defaultState;
let db = null;
let docRef = null;
let firebaseReady = false;
let isManager = localStorage.getItem('skf_tt_manager') === 'yes';

function hasFirebaseConfig() {
  const c = window.SKF_FIREBASE_CONFIG || {};
  return c.apiKey && !String(c.apiKey).includes('PASTE_') && c.projectId && !String(c.projectId).includes('PASTE_');
}

async function initData() {
  if (hasFirebaseConfig()) {
    const app = initializeApp(window.SKF_FIREBASE_CONFIG);
    db = getFirestore(app);
    docRef = doc(db, 'tournaments', window.SKF_TOURNAMENT_ID || 'season2');
    const snap = await getDoc(docRef);
    if (!snap.exists()) await setDoc(docRef, defaultState);
    onSnapshot(docRef, snap => {
      state = snap.exists() ? { ...defaultState, ...snap.data() } : defaultState;
      firebaseReady = true;
      render();
    }, err => {
      alert('Firebase connection error. Check Firebase config and Firestore rules.');
      console.error(err);
      state = JSON.parse(localStorage.getItem(fallbackKey) || JSON.stringify(defaultState));
      render();
    });
  } else {
    state = JSON.parse(localStorage.getItem(fallbackKey) || JSON.stringify(defaultState));
    render();
  }
}

async function save() {
  if (docRef) await setDoc(docRef, state);
  else localStorage.setItem(fallbackKey, JSON.stringify(state));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = id => document.getElementById(id);

function setRole() {
  document.body.classList.toggle('is-manager', isManager);
  $('roleBadge').textContent = isManager ? 'Manager Admin Mode' : (hasFirebaseConfig() ? 'Live Viewer Mode' : 'Viewer Mode - Firebase not configured');
  $('loginBtn').classList.toggle('hide', isManager);
  $('logoutBtn').classList.toggle('hide', !isManager);
}

window.closeLogin = () => $('loginModal').classList.add('hide');
window.managerLogin = () => {
  if ($('passwordInput').value === MANAGER_PASSWORD) {
    localStorage.setItem('skf_tt_manager', 'yes');
    isManager = true;
    window.closeLogin();
    setRole();
    render();
  } else alert('Wrong password');
};

$('loginBtn').onclick = () => $('loginModal').classList.remove('hide');
$('logoutBtn').onclick = () => { localStorage.removeItem('skf_tt_manager'); isManager = false; setRole(); location.hash = 'dashboard'; };

function requireManager() { if (!isManager) { alert('Manager login required'); return false; } return true; }

function showPage() {
  let id = (location.hash || '#dashboard').slice(1);
  if (id === 'admin' && !isManager) id = 'dashboard';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  (document.getElementById(id) || $('dashboard')).classList.add('active');
  render();
}
window.addEventListener('hashchange', showPage);

window.addPlayer = async () => { if (!requireManager()) return; let name = $('playerName').value.trim(); if (!name) return; state.players.push({ id: uid(), name }); $('playerName').value = ''; await save(); render(); };
window.addTeam = async () => { if (!requireManager()) return; let name = $('teamName').value.trim(); if (!name) return; state.teams.push({ id: uid(), name }); $('teamName').value = ''; await save(); render(); };
window.del = async (type, id) => { if (!requireManager()) return; if (!confirm('Delete this item?')) return; state[type] = state[type].filter(x => x.id !== id); state.matches = state.matches.filter(m => m.aId !== id && m.bId !== id); await save(); render(); };
window.generateSchedule = async type => { if (!requireManager()) return; let list = type === 'singles' ? state.players : state.teams; if (list.length < 2) { alert('Add at least 2 ' + (type === 'singles' ? 'players' : 'teams')); return; } for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) state.matches.push({ id: uid(), type, aId: list[i].id, bId: list[j].id, a: list[i].name, b: list[j].name, score: '', winnerId: null }); await save(); render(); };
window.clearMatches = async () => { if (!requireManager()) return; if (confirm('Clear all matches and scores?')) { state.matches = []; await save(); render(); } };
function scoreWinner(score, aId, bId) { let aw = 0, bw = 0; score.split(',').forEach(g => { let [a,b] = g.trim().split('-').map(Number); if (!isNaN(a) && !isNaN(b)) { if (a > b) aw++; else if (b > a) bw++; } }); return aw > bw ? aId : bw > aw ? bId : null; }
window.loadScoreForm = () => { let m = state.matches.find(x => x.id === $('matchSelect').value); if (!m) { $('scoreForm').innerHTML = ''; return; } $('scoreForm').innerHTML = `<p><b>${m.a}</b> vs <b>${m.b}</b></p><input id="scoreInput" placeholder="Example: 11-8, 9-11, 11-6" value="${m.score || ''}"><button class="btn" onclick="saveScore('${m.id}')">Save Score</button>`; };
window.saveScore = async id => { if (!requireManager()) return; let m = state.matches.find(x => x.id === id); m.score = $('scoreInput').value.trim(); m.winnerId = scoreWinner(m.score, m.aId, m.bId); await save(); render(); window.loadScoreForm(); };
function standings(type) { let list = type === 'singles' ? state.players : state.teams; let rows = list.map(x => ({ id: x.id, name: x.name, p: 0, w: 0, l: 0, pf: 0, pa: 0 })); state.matches.filter(m => m.type === type && m.score).forEach(m => { let A = rows.find(r => r.id === m.aId), B = rows.find(r => r.id === m.bId); if (!A || !B) return; A.p++; B.p++; m.score.split(',').forEach(g => { let [a,b] = g.trim().split('-').map(Number); if (!isNaN(a) && !isNaN(b)) { A.pf += a; A.pa += b; B.pf += b; B.pa += a; } }); if (m.winnerId === m.aId) { A.w++; B.l++; } else if (m.winnerId === m.bId) { B.w++; A.l++; } }); return rows.sort((a,b) => b.w-a.w || (b.pf-b.pa)-(a.pf-a.pa) || b.pf-a.pf); }
function table(rows, cols) { if (!rows.length) return '<p class="muted">No data yet.</p>'; return '<table><thead><tr>' + cols.map(c => `<th>${c[0]}</th>`).join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + cols.map(c => `<td>${typeof c[1] === 'function' ? c[1](r) : r[c[1]]}</td>`).join('') + '</tr>').join('') + '</tbody></table>'; }
function render() { setRole(); $('dashPlayers').textContent = state.players.length; $('dashTeams').textContent = state.teams.length; $('dashMatches').textContent = state.matches.length; $('dashDone').textContent = state.matches.filter(m => m.score).length; $('playersList').innerHTML = table(state.players, [['Player','name'], ['Action', r => isManager ? `<button class="btn danger" onclick="del('players','${r.id}')">Delete</button>` : '']]); $('teamsList').innerHTML = table(state.teams, [['Team','name'], ['Action', r => isManager ? `<button class="btn danger" onclick="del('teams','${r.id}')">Delete</button>` : '']]); $('scheduleList').innerHTML = table(state.matches, [['Type','type'], ['Match', r => `${r.a} vs ${r.b}`], ['Score', r => r.score || 'Pending'], ['Winner', r => r.winnerId ? (r.winnerId === r.aId ? r.a : r.b) : '-']]); let pending = state.matches.filter(m => !m.score).slice(0,10); $('dashUpcoming').innerHTML = table(pending, [['Type','type'], ['Match', r => `${r.a} vs ${r.b}`]]); let s = standings('singles'); $('dashLeaderboard').innerHTML = table(s.slice(0,5), [['Player','name'], ['P','p'], ['W','w'], ['L','l'], ['PF','pf'], ['PA','pa']]); $('singlesStandings').innerHTML = table(s, [['Player','name'], ['P','p'], ['W','w'], ['L','l'], ['PF','pf'], ['PA','pa'], ['Diff', r => r.pf-r.pa]]); $('doublesStandings').innerHTML = table(standings('doubles'), [['Team','name'], ['P','p'], ['W','w'], ['L','l'], ['PF','pf'], ['PA','pa'], ['Diff', r => r.pf-r.pa]]); $('matchSelect').innerHTML = state.matches.map(m => `<option value="${m.id}">${m.type}: ${m.a} vs ${m.b}</option>`).join(''); if (state.matches.length) window.loadScoreForm(); }
window.exportCSV = () => { let rows = [['Category','Name','Played','Won','Lost','Points For','Points Against','Diff'], ...standings('singles').map(r => ['Singles',r.name,r.p,r.w,r.l,r.pf,r.pa,r.pf-r.pa]), ...standings('doubles').map(r => ['Doubles',r.name,r.p,r.w,r.l,r.pf,r.pa,r.pf-r.pa])]; download('skf-standings.csv', rows.map(r => r.join(',')).join('\n')); };
window.downloadBackup = () => download('skf-tt-backup.json', JSON.stringify(state,null,2));
function download(name, text) { let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type:'text/plain' })); a.download = name; a.click(); }
window.resetAll = async () => { if (!requireManager()) return; if (confirm('Reset all tournament data?')) { state = { players: [], teams: [], matches: [] }; await save(); render(); } };

initData();
showPage();
