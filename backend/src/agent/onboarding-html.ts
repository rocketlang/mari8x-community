/**
 * Mari8X Agent Onboarding — HTML generator
 * Returns self-contained single-page onboarding wizard HTML
 */

export function buildOnboardingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mari8X — Agent Onboarding</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#040D14;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
.card{background:#0A1628;border:1px solid #1e3a5f;border-radius:20px;width:100%;max-width:520px;overflow:hidden}
.header{background:linear-gradient(135deg,#0F2642,#1a3a6e);padding:32px;text-align:center}
.logo{font-size:40px;margin-bottom:12px}
.header h1{font-size:24px;font-weight:700;color:#fff;margin-bottom:4px}
.header p{font-size:14px;color:#93b4d4}
.steps-bar{display:flex;padding:20px 32px 0;gap:8px}
.step-dot{flex:1;height:3px;border-radius:2px;background:#1e3a5f;transition:background .3s}
.step-dot.active{background:#0ea5e9}
.step-dot.done{background:#10b981}
.form-body{padding:32px}
.step{display:none}
.step.active{display:block}
.step h2{font-size:18px;font-weight:600;color:#fff;margin-bottom:6px}
.step .sub{font-size:13px;color:#64748b;margin-bottom:24px}
.field{margin-bottom:16px}
label{display:block;font-size:12px;font-weight:500;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
input,select{width:100%;background:#040D14;border:1px solid #1e3a5f;border-radius:10px;padding:11px 14px;color:#e2e8f0;font-size:14px;transition:border .2s}
input:focus,select:focus{outline:none;border-color:#0ea5e9}
input::placeholder{color:#334155}
.btn{width:100%;padding:13px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;margin-top:8px}
.btn-primary{background:linear-gradient(135deg,#0ea5e9,#3b82f6);color:#fff}
.btn-primary:hover{opacity:.9;transform:translateY(-1px)}
.btn-primary:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-ghost{background:transparent;border:1px solid #1e3a5f;color:#94a3b8;margin-top:10px}
.btn-ghost:hover{border-color:#0ea5e9;color:#e2e8f0}
.btn-sm{padding:8px 16px;font-size:13px;width:auto;border-radius:8px}
.port-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.port-tag{background:#0F2642;border:1px solid #1e3a5f;border-radius:20px;padding:5px 12px;font-size:12px;font-mono;display:flex;align-items:center;gap:6px}
.port-tag button{background:none;border:none;color:#64748b;cursor:pointer;font-size:14px;line-height:1}
.port-tag button:hover{color:#ef4444}
.port-row{display:flex;gap:8px}
.port-row input{flex:1}
.alert{padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:16px;display:none}
.alert.error{background:#1f0a0a;border:1px solid #7f1d1d;color:#fca5a5}
.alert.success{background:#0a1f0f;border:1px solid #14532d;color:#86efac}
.key-box{background:#040D14;border:1px solid #10b981;border-radius:10px;padding:14px;display:flex;align-items:center;justify-content:space-between;margin:16px 0}
.key-val{font-family:monospace;font-size:13px;color:#10b981;word-break:break-all}
.copy-btn{background:none;border:1px solid #1e3a5f;border-radius:6px;padding:4px 10px;color:#64748b;font-size:11px;cursor:pointer;white-space:nowrap;margin-left:8px}
.copy-btn:hover{border-color:#10b981;color:#10b981}
.tg-test-row{display:flex;gap:8px;margin-top:8px}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid #1e3a5f;margin-top:4px}
.toggle{width:42px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background .2s}
.toggle.on{background:#0ea5e9}
.toggle.off{background:#1e3a5f}
.toggle::after{content:'';position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.toggle.on::after{left:21px}
.toggle.off::after{left:3px}
.summary-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #0F2642;font-size:14px}
.summary-row span:first-child{color:#64748b}
.summary-row span:last-child{color:#e2e8f0;font-weight:500}
.success-icon{font-size:56px;text-align:center;margin-bottom:16px}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid #fff4;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;margin-right:8px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">🚢</div>
    <h1>Mari8X Agent Portal</h1>
    <p>Set up your shipping agent account in 4 steps</p>
  </div>

  <div class="steps-bar">
    <div class="step-dot active" id="dot-0"></div>
    <div class="step-dot" id="dot-1"></div>
    <div class="step-dot" id="dot-2"></div>
    <div class="step-dot" id="dot-3"></div>
  </div>

  <div class="form-body">
    <div id="alertBox" class="alert"></div>

    <!-- Step 0: Account -->
    <div class="step active" id="step-0">
      <h2>Create your account</h2>
      <p class="sub">Enter your details to get started with Mari8X Agent Portal</p>
      <div class="field"><label>Full name</label><input id="name" placeholder="Capt. Rajan Sharma" autocomplete="name"></div>
      <div class="field"><label>Email</label><input id="email" type="email" placeholder="rajan@portlogistics.com" autocomplete="email"></div>
      <div class="field"><label>Company / Agency</label><input id="company" placeholder="Port Logistics Pvt Ltd"></div>
      <div class="field"><label>Password</label><input id="password" type="password" placeholder="Min 8 characters"></div>
      <button class="btn btn-primary" onclick="register()">
        <span id="reg-label">Create Account →</span>
      </button>
      <button class="btn btn-ghost" onclick="showLogin()">Already have an account? Sign in</button>
    </div>

    <!-- Step 0b: Login -->
    <div class="step" id="step-login">
      <h2>Sign in</h2>
      <p class="sub">Access your existing Mari8X agent account</p>
      <div class="field"><label>Email</label><input id="login-email" type="email" placeholder="your@email.com"></div>
      <div class="field"><label>Password</label><input id="login-password" type="password" placeholder="Your password"></div>
      <button class="btn btn-primary" onclick="login()">Sign In →</button>
      <button class="btn btn-ghost" onclick="showRegister()">New here? Create account</button>
    </div>

    <!-- Step 1: Port access -->
    <div class="step" id="step-1">
      <h2>Select your ports</h2>
      <p class="sub">Add the ports you manage. Use UN/LOCODE format (e.g. SGSIN, INNSA, USNYC)</p>
      <div class="port-row">
        <input id="portInput" placeholder="e.g. SGSIN" maxlength="5" style="text-transform:uppercase"
          onkeydown="if(event.key==='Enter')addPort()">
        <button class="btn btn-primary btn-sm" onclick="addPort()">Add</button>
      </div>
      <div class="port-tags" id="portTags"></div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #1e3a5f">
        <p style="font-size:12px;color:#64748b;margin-bottom:12px">Common ports:</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${['SGSIN','INNSA','INPAV','INMUN','USNYC','USHOU','GBFXT','NLRTM','DEHAM','CNSHA']
            .map(p => `<button onclick="quickAddPort('${p}')" style="background:#0F2642;border:1px solid #1e3a5f;border-radius:20px;padding:5px 12px;font-size:12px;color:#94a3b8;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor='#0ea5e9';this.style.color='#e2e8f0'" onmouseout="this.style.borderColor='#1e3a5f';this.style.color='#94a3b8'">${p}</button>`)
            .join('')}
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top:24px" onclick="savePorts()">Save Ports →</button>
      <button class="btn btn-ghost" onclick="skipPorts()">Skip for now</button>
    </div>

    <!-- Step 2: Telegram alerts -->
    <div class="step" id="step-2">
      <h2>Telegram alerts</h2>
      <p class="sub">Get real-time port congestion and arrival alerts via Telegram</p>
      <div class="field">
        <label>Bot Token <span style="color:#334155;font-weight:400;text-transform:none">(from @BotFather)</span></label>
        <input id="tg-token" placeholder="123456:ABCdef..." type="password">
      </div>
      <div class="field">
        <label>Chat ID <span style="color:#334155;font-weight:400;text-transform:none">(your Telegram user/group ID)</span></label>
        <input id="tg-chatid" placeholder="-1001234567890">
      </div>
      <div class="tg-test-row">
        <button class="btn btn-primary btn-sm" onclick="saveTelegram()">Save</button>
        <button class="btn btn-ghost btn-sm" onclick="testTelegram()">Test connection</button>
      </div>
      <div class="toggle-row">
        <span style="font-size:14px;color:#94a3b8">Enable alerts</span>
        <button class="toggle off" id="tg-toggle" onclick="toggleTelegram()"></button>
      </div>
      <button class="btn btn-primary" style="margin-top:24px" onclick="goToSummary()">Continue →</button>
      <button class="btn btn-ghost" onclick="skipTelegram()">Skip for now</button>
    </div>

    <!-- Step 3: Summary / API Key -->
    <div class="step" id="step-3">
      <h2>You're all set!</h2>
      <p class="sub">Your agent account is ready. Save your API key.</p>
      <div class="summary-row"><span>Name</span><span id="sum-name">—</span></div>
      <div class="summary-row"><span>Email</span><span id="sum-email">—</span></div>
      <div class="summary-row"><span>Company</span><span id="sum-company">—</span></div>
      <div class="summary-row"><span>Ports</span><span id="sum-ports">—</span></div>
      <div class="summary-row"><span>Telegram</span><span id="sum-telegram">—</span></div>
      <p style="font-size:12px;color:#64748b;margin-top:20px;margin-bottom:6px">YOUR API KEY — keep this safe</p>
      <div class="key-box">
        <span class="key-val" id="apiKeyDisplay">—</span>
        <button class="copy-btn" onclick="copyKey()">Copy</button>
      </div>
      <p style="font-size:12px;color:#64748b;margin-bottom:20px">Use this key as <code style="color:#0ea5e9">X-Mari8x-Agent-Key</code> header in all API calls</p>
      <button class="btn btn-primary" onclick="gotoDashboard()">Go to Dashboard →</button>
    </div>
  </div>
</div>

<script>
let state = { apiKey: '', agent: null, step: 'register', tgEnabled: false };

function showAlert(msg, type='error') {
  const b = document.getElementById('alertBox');
  b.textContent = msg;
  b.className = 'alert ' + type;
  b.style.display = 'block';
  setTimeout(() => b.style.display = 'none', 5000);
}

function setStepDot(n, active) {
  for (let i=0; i<4; i++) {
    const d = document.getElementById('dot-'+i);
    d.className = 'step-dot' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

function showStep(id, dotN) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  setStepDot(dotN ?? 0);
}

function showLogin() { showStep('step-login', 0); state.step='login'; }
function showRegister() { showStep('step-0', 0); state.step='register'; }

async function register() {
  const name=document.getElementById('name').value.trim();
  const email=document.getElementById('email').value.trim();
  const company=document.getElementById('company').value.trim();
  const password=document.getElementById('password').value;
  if (!name||!email||!company||!password) return showAlert('All fields are required');
  if (password.length<8) return showAlert('Password must be at least 8 characters');
  const lbl=document.getElementById('reg-label');
  lbl.innerHTML='<span class="spinner"></span>Creating account…';
  try {
    const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,company,password})});
    const d=await r.json();
    if (!d.ok) { lbl.textContent='Create Account →'; return showAlert(d.error||'Registration failed'); }
    state.apiKey=d.agent.apiKey; state.agent=d.agent;
    lbl.textContent='Create Account →';
    showStep('step-1', 1);
  } catch(e) { lbl.textContent='Create Account →'; showAlert('Network error. Is the server running?'); }
}

async function login() {
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  if (!email||!password) return showAlert('Email and password required');
  const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const d=await r.json();
  if (!d.ok) return showAlert(d.error||'Login failed');
  state.apiKey=d.apiKey; state.agent=d.agent;
  showStep('step-1', 1);
}

// Port management
let ports=[];
function addPort() {
  const v=document.getElementById('portInput').value.toUpperCase().trim().slice(0,5);
  if (!v||ports.includes(v)) return;
  ports.push(v); renderPorts();
  document.getElementById('portInput').value='';
}
function quickAddPort(p) { if (!ports.includes(p)) { ports.push(p); renderPorts(); } }
function removePort(p) { ports=ports.filter(x=>x!==p); renderPorts(); }
function renderPorts() {
  document.getElementById('portTags').innerHTML=ports.map(p=>
    \`<div class="port-tag"><span style="font-family:monospace">\${p}</span><button onclick="removePort('\${p}')">×</button></div>\`
  ).join('');
}

async function savePorts() {
  if (ports.length===0) return skipPorts();
  const r=await fetch('/api/agents/me/ports',{method:'PUT',headers:{'Content-Type':'application/json','X-Mari8x-Agent-Key':state.apiKey},body:JSON.stringify({ports})});
  const d=await r.json();
  if (d.ok) { if(state.agent) state.agent.ports=d.ports; }
  showStep('step-2', 2);
}
function skipPorts() { showStep('step-2', 2); }

// Telegram
function toggleTelegram() {
  state.tgEnabled=!state.tgEnabled;
  const t=document.getElementById('tg-toggle');
  t.className='toggle '+(state.tgEnabled?'on':'off');
}
async function saveTelegram() {
  const botToken=document.getElementById('tg-token').value.trim();
  const chatId=document.getElementById('tg-chatid').value.trim();
  const r=await fetch('/api/agents/me/telegram',{method:'PUT',headers:{'Content-Type':'application/json','X-Mari8x-Agent-Key':state.apiKey},body:JSON.stringify({botToken,chatId,enabled:state.tgEnabled})});
  const d=await r.json();
  if (d.ok) showAlert('Telegram config saved!','success');
  else showAlert(d.error||'Save failed');
}
async function testTelegram() {
  const r=await fetch('/api/agents/me/telegram/test',{method:'POST',headers:{'X-Mari8x-Agent-Key':state.apiKey}});
  const d=await r.json();
  if (d.ok) showAlert('Test message sent! Check your Telegram.','success');
  else showAlert(d.error||'Test failed. Check your bot token and chat ID.');
}
function skipTelegram() { goToSummary(); }

function goToSummary() {
  const a=state.agent||{};
  document.getElementById('sum-name').textContent=a.name||'—';
  document.getElementById('sum-email').textContent=a.email||'—';
  document.getElementById('sum-company').textContent=a.company||'—';
  document.getElementById('sum-ports').textContent=(a.ports||ports).join(', ')||'None';
  document.getElementById('sum-telegram').textContent=state.tgEnabled?'Enabled':'Disabled';
  document.getElementById('apiKeyDisplay').textContent=state.apiKey||'—';
  showStep('step-3', 3);
}

function copyKey() {
  navigator.clipboard.writeText(state.apiKey);
  document.querySelector('.copy-btn').textContent='Copied!';
  setTimeout(()=>document.querySelector('.copy-btn').textContent='Copy',2000);
}

function gotoDashboard() {
  window.location.href='/?key='+encodeURIComponent(state.apiKey);
}
</script>
</body>
</html>`;
}
