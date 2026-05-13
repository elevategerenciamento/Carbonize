console.log("Carbonize: app.js carregando...");

// Supabase Configuration
const SUPABASE_URL = "https://bdzppelpteaxkmcrmcoc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkenBwZWxwdGVheGttY3JtY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDYxNjksImV4cCI6MjA5NDIyMjE2OX0.KFbnzEIGBfvHtnKK0pQp8_YurYwBttl5dTMOXfQq-OQ";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let kilns = [];
let loads = [];
let history = [];
let maintenance = [];
let expenses = [];
let settings = { enterprise_name: 'FAZENDAPETKOV', access_email: '' };

// Charts Instances
let prodChart = null;
let loadsChart = null;

// Constants
const TOAST_DURATION = 2000;
const PRIMARY_COLOR = '#e6002e'; // Vibrant Red

// Expose functions to window
window.switchTab = switchTab;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleMobileMenu = toggleMobileMenu;
window.generateReport = generateReport;
window.resolveMaint = resolveMaint;
window.deleteKiln = deleteKiln;
window.editKiln = editKiln;
window.renderKilnAssets = renderKilnAssets;
window.deleteExpense = deleteExpense;
window.exportToExcel = exportToExcel;
window.handleLogin = handleLogin;
window.logout = logout;
window.toggleUserDropdown = toggleUserDropdown;
window.togglePassword = togglePassword;

// Initialize
async function init() {
    console.log("Carbonize: Inicializando sistema...");
    
    // Configurar listener de Auth
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            document.getElementById('login-screen').style.display = 'none';
            document.querySelector('.app-container').style.display = 'flex';
            loadAllFromSupabase();
        } else if (event === 'SIGNED_OUT') {
            document.getElementById('login-screen').style.display = 'flex';
            document.querySelector('.app-container').style.display = 'none';
        }
    });

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
        await loadAllFromSupabase();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }

    updateDateTime();
    setupForms();
    setupFilters();
    setInterval(updateDateTime, 60000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const farmNameRaw = fd.get('farm_name');
    const password = fd.get('password');
    const action = e.target.dataset.action || 'login';
    const btn = e.submitter;

    if (!farmNameRaw || !password) return alert("Preencha todos os campos.");

    const farmName = farmNameRaw.trim().toLowerCase().replace(/\s+/g, '_');
    const email = `${farmName}@carbonize.com`;

    try {
        if (btn) btn.innerText = "...";
        if (action === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: farmNameRaw } } });
            if (error) throw error;
            alert("Conta criada! Agora você pode entrar.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) {
        alert("Erro: " + err.message);
    } finally {
        if (btn) btn.innerText = action === 'login' ? 'Entrar' : 'Cadastrar';
    }
}

async function logout() {
    await supabase.auth.signOut();
}

async function loadAllFromSupabase() {
    try {
        await updateUserDisplay();
        
        const { data: kData } = await supabase.from('kilns').select('*');
        const { data: lData } = await supabase.from('loads').select('*');
        const { data: hData } = await supabase.from('production_history').select('*');
        const { data: mData } = await supabase.from('maintenance').select('*');
        const { data: eData } = await supabase.from('expenses').select('*');

        if (kData) kilns = kData;
        if (lData) loads = lData.map(l => ({...l, id: l.identificador, data: l.data_carga, hora: l.hora_carga, tipo: l.tipo_carvao}));
        if (hData) history = hData.map(h => ({...h, data: h.data_lancamento}));
        if (mData) maintenance = mData.map(m => ({...m, data: m.data_registro, timestamp: Number(m.timestamp_maint)}));
        if (eData) expenses = eData.map(e => ({...e, data: e.data_expense, desc: e.description, timestamp: Number(e.timestamp_expense)}));

        renderAll();
    } catch (err) {
        console.error("Erro ao carregar dados:", err);
    }
}

function updateDateTime() {
    const elDate = document.getElementById('current-date');
    const elGreeting = document.getElementById('greeting');
    if (!elDate || !elGreeting) return;

    const now = new Date();
    elDate.innerText = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    
    const enterprise = settings.enterprise_name || 'Operador';
    elGreeting.innerText = `${greeting}, ${enterprise}`;
}

function switchTab(tab) {
    const sections = document.querySelectorAll('.content-section');
    const navLinks = document.querySelectorAll('.nav-link');
    sections.forEach(s => s.style.display = 'none');
    navLinks.forEach(n => n.classList.remove('active'));
    const activeSection = document.getElementById(`section-${tab}`);
    if (activeSection) activeSection.style.display = 'block';
    navLinks.forEach(n => {
        const attr = n.getAttribute('onclick') || "";
        if (attr.includes(`'${tab}'`)) n.classList.add('active');
    });
    if (tab === 'analise') setTimeout(renderCharts, 100);
    renderAll();
}

function toggleMobileMenu() {
    document.getElementById('mobile-nav')?.classList.toggle('show');
    document.getElementById('menu-overlay')?.classList.toggle('show');
}

function showModal(type, data = null) {
    const modal = document.getElementById(`modal-${type}`);
    if (!modal) return;
    modal.style.display = 'flex';

    if (type === 'kiln') {
        const editIdx = document.getElementById('kiln-edit-index');
        if (data) {
            editIdx.value = data.index;
            document.getElementById('kiln-modal-praca').value = data.praca;
            document.getElementById('kiln-modal-modelo').value = data.modelo;
            document.getElementById('kiln-modal-resp').value = data.responsavel;
        } else {
            editIdx.value = "";
            document.getElementById('form-kiln').reset();
        }
    }

    if (type === 'load') {
        document.getElementById('load-id-auto').value = 10000 + Math.floor(Math.random() * 90000);
        document.getElementById('load-date-manual').value = new Date().toISOString().split('T')[0];
        document.getElementById('load-time-manual').value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

function hideModal(type) {
    document.getElementById(`modal-${type}`).style.display = 'none';
}

function renderAll() {
    try {
        updateKPIs();
        updateSelectors();
        renderDashboard();
        renderKilnHistory();
        renderKilnAssets();
        renderLoadsTable();
        renderMaintenance();
        renderStock();
        renderExpenses();
        updateSettingsUI();
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error("Carbonize Render Error:", e);
    }
}

function updateKPIs() {
    const elFornosAtivos = document.getElementById('kpi-fornos-ativos');
    const elCargasHoje = document.getElementById('kpi-cargas-hoje');
    const elProdMes = document.getElementById('kpi-prod-mes');
    const elMaint = document.getElementById('kpi-maint');
    const elProgress = document.getElementById('prod-progress');

    if (elFornosAtivos) elFornosAtivos.innerText = kilns.length;
    const today = new Date().toLocaleDateString('pt-BR');
    if (elCargasHoje) elCargasHoje.innerText = loads.filter(l => l.data === today).length;

    const currentMonth = new Date().getMonth();
    const monthLoads = loads.filter(l => {
        try { return new Date(l.data.split('/').reverse().join('-')).getMonth() === currentMonth; }
        catch (e) { return false; }
    });
    const totalTons = (monthLoads.reduce((sum, l) => sum + Number(l.peso), 0) / 1000).toFixed(1);
    if (elProdMes) elProdMes.innerText = `${totalTons} t`;
    if (elProgress) elProgress.style.width = `${Math.min(100, (totalTons / 160) * 100)}%`;

    if (elMaint) elMaint.innerText = maintenance.filter(m => !m.resolved).length;

    // Custos KPIs
    const elCustoMes = document.getElementById('kpi-custo-mes');
    const monthExpenses = expenses.filter(e => {
        try { return new Date(e.data.split('/').reverse().join('-')).getMonth() === currentMonth; }
        catch (err) { return false; }
    });
    const totalValue = monthExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
    if (elCustoMes) elCustoMes.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function renderDashboard() {
    const pracasList = document.getElementById('dashboard-pracas-list');
    if (pracasList) {
        pracasList.innerHTML = '';
        const pracaGroups = {};
        kilns.forEach(k => {
            if (!pracaGroups[k.praca]) pracaGroups[k.praca] = { v: 0, c: 0, ca: 0, e: 0 };
            const latest = history.filter(h => h.praca === k.praca).sort((a, b) => b.timestamp - a.timestamp)[0];
            if (latest) {
                pracaGroups[k.praca].v += Number(latest.vazios || 0);
                pracaGroups[k.praca].c += Number(latest.cheios || 0);
                pracaGroups[k.praca].ca += Number(latest.carbonizando || 0);
                pracaGroups[k.praca].e += Number(latest.esfriando || 0);
            }
        });
        Object.keys(pracaGroups).forEach(name => {
            const g = pracaGroups[name];
            const div = document.createElement('div');
            div.className = 'praca-mini-box';
            div.innerHTML = `<h5>${name}</h5><div class="mini-indicators"><span class="ind-item">V <b>${g.v}</b></span><span class="ind-item">C <b>${g.c}</b></span><span class="ind-item">C <b>${g.ca}</b></span><span class="ind-item">E <b>${g.e}</b></span></div>`;
            pracasList.appendChild(div);
        });
    }

    const dashLoads = document.getElementById('dashboard-loads-list');
    if (dashLoads) {
        dashLoads.innerHTML = loads.slice(-5).reverse().map(l => `<tr><td>${l.hora}</td><td>${l.placa}</td><td>${Number(l.peso).toLocaleString()} kg</td><td><span class="status-badge success">Expedido</span></td></tr>`).join('');
    }
}

function updateSelectors() {
    const dailyPraca = document.getElementById('daily-praca-select');
    const maintKiln = document.getElementById('maint-kiln-select');
    if (dailyPraca) dailyPraca.innerHTML = '<option value="">Selecionar Forno...</option>' + kilns.map(k => `<option value="${k.praca}">${k.praca} (${k.modelo})</option>`).join('');
    if (maintKiln) maintKiln.innerHTML = '<option value="">Selecionar Ativo...</option>' + kilns.map(k => `<option value="${k.praca} - ${k.modelo}">${k.praca} — ${k.modelo}</option>`).join('');
}

function renderKilnHistory() {
    const list = document.getElementById('kiln-history-list');
    if (!list) return;
    list.innerHTML = history.slice(-10).reverse().map(h => `<tr><td>${h.data}</td><td>${h.praca}</td><td>${h.responsavel || 'Operador'}</td><td>${h.modelo}</td><td><strong>${h.vazios}/${h.cheios}/${h.carbonizando}/${h.esfriando}</strong></td><td><small>${h.obs || '-'}</small></td></tr>`).join('');
}

function renderKilnAssets() {
    const list = document.getElementById('kilns-list-assets');
    const search = document.getElementById('asset-search')?.value.toLowerCase() || "";
    if (!list) return;
    const filtered = kilns.filter(k => k.praca.toLowerCase().includes(search) || k.modelo.toLowerCase().includes(search));
    list.innerHTML = filtered.map((k, idx) => `
        <div class="asset-card">
            <div class="icon"><i data-lucide="container"></i></div>
            <div class="details"><h6>${k.praca}</h6><span>${k.modelo} • ${k.responsavel}</span></div>
            <div class="actions">
                <button onclick="editKiln(${kilns.indexOf(k)})"><i data-lucide="edit-2"></i></button>
                <button class="delete" onclick="deleteKiln(${kilns.indexOf(k)})"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

function editKiln(idx) { showModal('kiln', { ...kilns[idx], index: idx }); }
function deleteKiln(idx) { if (confirm("Excluir ativo?")) { kilns.splice(idx, 1); saveAll(); } }

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    if (!list) return;
    const today = new Date().toLocaleDateString('pt-BR');
    list.innerHTML = loads.filter(l => l.data === today).reverse().map(l => `
        <tr>
            <td><strong>#${l.id}</strong></td>
            <td>${l.data} <br> <small>${l.hora}</small></td>
            <td><span class="status-badge success">${l.tipo}</span></td>
            <td><strong>${l.placa}</strong></td>
            <td>${l.motorista}</td>
            <td>${l.metragem} m³ <br> ${Number(l.peso).toLocaleString()} kg</td>
            <td>${l.destino}</td>
        </tr>
    `).join('');
}

function renderMaintenance() {
    const openList = document.getElementById('open-issues-list');
    if (openList) openList.innerHTML = maintenance.filter(m => !m.resolved).map(m => `<tr><td>${m.forno}</td><td>${m.problema}</td><td>${new Date(m.timestamp).toLocaleDateString('pt-BR')}</td><td><button class="btn-icon" onclick="resolveMaint('${m.timestamp}')">Concluir</button></td></tr>`).join('');
}

function renderExpenses() {
    const list = document.getElementById('expense-history-list');
    if (!list) return;
    list.innerHTML = expenses.slice(-15).reverse().map((e, idx) => `
        <tr>
            <td>${e.data}</td>
            <td><span class="status-badge warning">${e.categoria}</span></td>
            <td>${e.desc}</td>
            <td><strong>R$ ${Number(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            <td><button class="btn-icon text-primary" onclick="deleteExpense(${expenses.indexOf(e)})"><i data-lucide="trash-2"></i></button></td>
        </tr>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

function deleteExpense(idx) { if (confirm("Excluir despesa?")) { expenses.splice(idx, 1); saveAll(); } }

function renderStock() {
    const totalIn = history.reduce((acc, h) => acc + (Number(h.carbonizando || 0) * 1.5), 0);
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso || 0) / 1000), 0);
    const balance = Math.max(0, totalIn - totalOut).toFixed(1);
    if (document.getElementById('stock-balance')) document.getElementById('stock-balance').innerText = `${balance} t`;
}

function setupFilters() { document.getElementById('stock-filter-type').onchange = renderStock; }

function setupForms() {
    const loginForm = document.getElementById('form-login');
    if (loginForm) loginForm.onsubmit = handleLogin;

    const forms = ['kiln', 'kiln-daily', 'load', 'maintenance', 'expense', 'settings'];
    forms.forEach(id => {
        const f = document.getElementById(`form-${id}`);
        if (f) {
            f.onsubmit = async (e) => {
                e.preventDefault();
                processForm(id, new FormData(e.target));
                await saveAll();
                if (id !== 'kiln-daily' && id !== 'expense') hideModal(id);
                e.target.reset();
                showToast("Dados sincronizados!");
            };
        }
    });
}

function processForm(id, fd) {
    if (id === 'kiln') {
        const idx = fd.get('kiln_index');
        const data = { praca: fd.get('praca'), responsavel: fd.get('responsavel'), modelo: fd.get('modelo') };
        if (idx !== "") kilns[idx] = data; else kilns.push(data);
    }
    if (id === 'kiln-daily') {
        const praca = fd.get('praca_select');
        const kData = kilns.find(k => k.praca === praca) || { modelo: 'N/A' };
        history.push({ timestamp: Date.now(), data: fd.get('data_lancamento') ? new Date(fd.get('data_lancamento')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'), responsavel: fd.get('responsavel'), praca, modelo: kData.modelo, vazios: fd.get('vazios'), cheios: fd.get('cheios'), carbonizando: fd.get('carbonizando'), esfriando: fd.get('esfriando'), obs: fd.get('obs') });
    }
    if (id === 'load') {
        loads.push({ id: fd.get('identificador'), data: fd.get('data_carga') ? new Date(fd.get('data_carga')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'), hora: fd.get('hora_carga'), placa: fd.get('placa').toUpperCase(), motorista: fd.get('motorista'), tipo: fd.get('tipo_carvao'), metragem: fd.get('metragem'), peso: fd.get('peso'), destino: fd.get('destino') });
    }
    if (id === 'maintenance') {
        const target = fd.get('kiln_target').split(' — ');
        maintenance.push({ data: fd.get('repair_date'), forno: target[0], problema: fd.get('issue_type'), resolved: true, timestamp: Date.now() });
    }
    if (id === 'expense') {
        expenses.push({ timestamp: Date.now(), data: fd.get('expense_date') ? new Date(fd.get('expense_date')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'), categoria: fd.get('expense_category'), desc: fd.get('expense_desc'), valor: fd.get('expense_value') });
    }
    if (id === 'settings') {
        settings.enterprise_name = fd.get('enterprise_name');
        settings.access_email = fd.get('access_email');
    }
}

function updateSettingsUI() {
    const elEnterprise = document.getElementById('settings-enterprise');
    const elEmail = document.getElementById('settings-email');
    const elUnit = document.querySelector('.nav-brand .unit');
    if (elEnterprise) elEnterprise.value = settings.enterprise_name;
    if (elEmail) elEmail.value = settings.access_email;
    if (elUnit && settings.enterprise_name) elUnit.innerText = settings.enterprise_name;
}

function resolveMaint(ts) { maintenance = maintenance.map(m => m.timestamp.toString() === ts ? { ...m, resolved: true } : m); saveAll(); }

async function saveAll() {
    try {
        const kilnsPayload = kilns.map(k => ({ praca: k.praca, responsavel: k.responsavel, modelo: k.modelo }));
        const loadsPayload = loads.map(l => ({ identificador: l.id, data_carga: l.data, hora_carga: l.hora, placa: l.placa, motorista: l.motorista, tipo_carvao: l.tipo, metragem: Number(l.metragem), peso: Number(l.peso), destino: l.destino }));
        const historyPayload = history.map(h => ({ timestamp: h.timestamp, data_lancamento: h.data, responsavel: h.responsavel, praca: h.praca, modelo: h.modelo, vazios: Number(h.vazios), cheios: Number(h.cheios), carbonizando: Number(h.carbonizando), esfriando: Number(h.esfriando), obs: h.obs }));
        const maintPayload = maintenance.map(m => ({ data_registro: m.data, forno: m.forno, problema: m.problema, resolved: m.resolved, timestamp_maint: m.timestamp }));
        const expensesPayload = expenses.map(e => ({ timestamp_expense: e.timestamp, data_expense: e.data, categoria: e.categoria, description: e.desc, valor: Number(e.valor) }));

        await supabase.from('kilns').delete().neq('praca', 'NULL_VAL');
        await supabase.from('kilns').insert(kilnsPayload);
        await supabase.from('loads').delete().neq('identificador', '0');
        await supabase.from('loads').insert(loadsPayload);
        await supabase.from('production_history').delete().neq('timestamp', 0);
        await supabase.from('production_history').insert(historyPayload);
        await supabase.from('maintenance').delete().neq('timestamp_maint', 0);
        await supabase.from('maintenance').insert(maintPayload);
        await supabase.from('expenses').delete().neq('timestamp_expense', 0);
        await supabase.from('expenses').insert(expensesPayload);
        
        localStorage.setItem('carboniza_settings', JSON.stringify(settings));
        console.log("Sincronizado!");
    } catch (err) { console.error("Sync Error:", err); }
    renderAll();
}

function showToast(msg = "Sucesso!") {
    const toast = document.getElementById('toast');
    if (toast) { toast.innerText = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
}

function generateReport(type, print = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório Carbonize - " + type, 14, 20);
    doc.autoTable({ head: [['Data', 'Detalhe']], body: [[new Date().toLocaleDateString(), "Relatório gerado pelo sistema"]] });
    if (print) window.open(doc.output('bloburl'), '_blank'); else doc.save(`relatorio_${type}.pdf`);
}

function exportToExcel(type) {
    const data = type === 'expenses' ? expenses : loads;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `export_${type}.xlsx`);
}

function toggleUserDropdown() { document.getElementById('user-dropdown')?.classList.toggle('show'); }
function togglePassword(id) { const el = document.getElementById(id); el.type = el.type === 'password' ? 'text' : 'password'; }

async function updateUserDisplay() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const farmName = user.user_metadata?.display_name || user.email.split('@')[0].toUpperCase();
    settings.enterprise_name = farmName;
    settings.access_email = user.email;
    document.getElementById('dropdown-farm-name').innerText = farmName;
    document.getElementById('dropdown-email').innerText = user.email;
}
