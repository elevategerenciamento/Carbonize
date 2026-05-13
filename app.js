// Carbonize Intelligence & Industry - Premium JS Engine
console.log("Carbonize: Premium Engine Initializing...");

// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://bdzppelpteaxkmcrmcoc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkenBwZWxwdGVheGttY3JtY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDYxNjksImV4cCI6MjA5NDIyMjE2OX0.KFbnzEIGBfvHtnKK0pQp8_YurYwBttl5dTMOXfQq-OQ";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. STATE MANAGEMENT
let kilns = [];
let loads = [];
let history = [];
let maintenance = [];
let expenses = [];
let currentUser = null;

const PRIMARY_COLOR = '#e6002e';
const TOAST_DURATION = 2000;

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log("Carbonize: DOM Ready");
    
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
        await loadAllData();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.querySelector('.app-container').style.display = 'none';
    }

    if (window.lucide) window.lucide.createIcons();
    setupEventListeners();
    renderCharts();
    updateUI();
}

// 4. AUTHENTICATION
async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const farmName = fd.get('farm_name');
    const password = fd.get('password');
    const action = e.target.dataset.action;
    
    const email = `${farmName.toLowerCase().replace(/\s+/g, '')}@carbonize.com`;

    try {
        if (action === 'signup') {
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { farm_name: farmName } }
            });
            if (error) throw error;
            alert("Conta criada! Tente entrar agora.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            location.reload();
        }
    } catch (err) {
        alert("Erro: " + err.message);
    }
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// 5. DATA SYNC
async function loadAllData() {
    if (!currentUser) return;
    const uid = currentUser.id;

    try {
        const [k, l, h, m, e] = await Promise.all([
            supabase.from('kilns').select('*').eq('user_id', uid),
            supabase.from('loads').select('*').eq('user_id', uid),
            supabase.from('production_history').select('*').eq('user_id', uid),
            supabase.from('maintenance').select('*').eq('user_id', uid),
            supabase.from('expenses').select('*').eq('user_id', uid)
        ]);

        kilns = k.data || [];
        loads = l.data || [];
        history = h.data || [];
        maintenance = m.data || [];
        expenses = e.data || [];
        
        renderAll();
    } catch (err) {
        console.error("Sync Error:", err);
    }
}

async function saveItem(table, item) {
    if (!currentUser) return;
    const { error } = await supabase.from(table).insert([{ ...item, user_id: currentUser.id }]);
    if (error) console.error(`Error saving to ${table}:`, error);
    await loadAllData();
}

// 6. UI ENGINE
function updateUI() {
    if (currentUser) {
        const farm = currentUser.user_metadata.farm_name || "Fazenda";
        document.getElementById('display-enterprise-name').innerText = farm;
        document.getElementById('greeting').innerText = `Olá, ${farm}`;
        document.getElementById('user-avatar-initials').innerText = farm.substring(0, 1).toUpperCase();
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('pt-BR');
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(`section-${tabId}`).style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`button[onclick*="switchTab('${tabId}')"]`).forEach(l => l.classList.add('active'));
    if (tabId === 'analise' || tabId === 'dashboard') renderCharts();
}

function showModal(id) {
    document.getElementById(`modal-${id}`).style.display = 'flex';
    if (id === 'settings') {
        document.getElementById('settings-enterprise').value = currentUser.user_metadata.farm_name || "";
        document.getElementById('settings-email').value = currentUser.email || "";
    }
}

function hideModal(id) {
    document.getElementById(`modal-${id}`).style.display = 'none';
}

function toggleMobileMenu() {
    document.getElementById('mobile-nav').classList.toggle('show');
}

function toggleUserDropdown() {
    document.getElementById('user-dropdown').classList.toggle('show');
}

// 7. RENDERERS
function renderAll() {
    renderDashboard();
    renderKilns();
    renderLoads();
    renderMaintenance();
    renderStock();
    renderExpenses();
    if (window.lucide) window.lucide.createIcons();
}

function renderDashboard() {
    const activeKilns = history.filter(h => h.carbonizando > 0).length;
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today).length;
    const monthlyProd = history.reduce((acc, h) => acc + (Number(h.carbonizando || 0) * 1.5), 0);

    document.getElementById('kpi-fornos-ativos').innerText = activeKilns;
    document.getElementById('kpi-cargas-hoje').innerText = todayLoads;
    document.getElementById('kpi-prod-mes').innerText = `${monthlyProd.toFixed(1)} t`;
    document.getElementById('kpi-maint').innerText = maintenance.filter(m => !m.resolved).length;
}

function renderKilns() {
    const list = document.getElementById('kilns-list-assets');
    const select = document.getElementById('daily-praca-select');
    const maintSelect = document.getElementById('maint-kiln-select');
    const historyList = document.getElementById('kiln-history-list');
    
    if (list) {
        list.innerHTML = kilns.map(k => `
            <div class="kpi-card" style="padding: 12px; gap: 10px; border-radius: 12px;">
                <div class="kpi-icon" style="width: 32px; height: 32px; font-size: 14px;"><i data-lucide="container"></i></div>
                <div><h6 style="font-size: 12px;">${k.praca}</h6><span style="font-size: 10px; color:var(--text-dim);">${k.modelo}</span></div>
            </div>
        `).join('');
    }

    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>' + kilns.map(k => `<option value="${k.praca}">${k.praca}</option>`).join('');
    }
    
    if (maintSelect) maintSelect.innerHTML = select.innerHTML;

    if (historyList) {
        const sortedHistory = [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        historyList.innerHTML = sortedHistory.slice(0, 10).map(h => `
            <tr>
                <td>${h.data}</td>
                <td>${h.praca}</td>
                <td>${h.vazios}/${h.cheios}/${h.carbonizando}/${h.esfriando}</td>
                <td style="font-size:11px;">${h.obs || '-'}</td>
            </tr>
        `).join('');
    }
}

function renderLoads() {
    const tbody = document.getElementById('loads-table-body');
    if (tbody) {
        tbody.innerHTML = loads.map(l => `
            <tr>
                <td>#${l.identificador}</td>
                <td>${l.data} ${l.hora}</td>
                <td>${l.placa}</td>
                <td>${l.peso} kg</td>
                <td>${l.destino}</td>
            </tr>
        `).join('');
    }
}

function renderMaintenance() {
    const list = document.getElementById('open-issues-list');
    if (list) {
        list.innerHTML = maintenance.filter(m => !m.resolved).map(m => `
            <tr>
                <td>${m.forno}</td>
                <td>${m.problema}</td>
                <td><button class="btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="resolveMaint('${m.id}')">OK</button></td>
            </tr>
        `).join('');
    }
    const badge = document.getElementById('maint-alert-badge');
    const count = maintenance.filter(m => !m.resolved).length;
    if (badge) {
        badge.innerText = count > 0 ? `${count} PENDENTES` : "SISTEMA OK";
        badge.className = count > 0 ? "status-badge danger" : "status-badge success";
    }
}

async function resolveMaint(id) {
    await supabase.from('maintenance').update({ resolved: true }).eq('id', id);
    await loadAllData();
}

function renderStock() {
    const bal = history.reduce((acc, h) => acc + (Number(h.carbonizando || 0) * 1.5), 0) - (loads.reduce((acc, l) => acc + Number(l.peso || 0), 0) / 1000);
    const balanceEl = document.getElementById('stock-balance');
    if (balanceEl) balanceEl.innerText = `${bal.toFixed(1)} t`;
}

function renderExpenses() {
    const list = document.getElementById('expense-history-list');
    const totalEl = document.getElementById('kpi-custo-mes');
    const total = expenses.reduce((acc, e) => acc + Number(e.expense_value || 0), 0);
    if (totalEl) totalEl.innerText = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (list) {
        list.innerHTML = expenses.map(e => `
            <tr>
                <td>${e.expense_date}</td>
                <td>${e.expense_category}</td>
                <td>R$ ${Number(e.expense_value).toFixed(2)}</td>
                <td><button onclick="deleteExpense('${e.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button></td>
            </tr>
        `).join('');
    }
}

async function deleteExpense(id) {
    if (confirm("Deseja excluir?")) {
        await supabase.from('expenses').delete().eq('id', id);
        await loadAllData();
    }
}

// 8. FORMS & CHARTS
function setupEventListeners() {
    const loginForm = document.getElementById('form-login');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const forms = ['kiln', 'kiln-daily', 'load', 'maintenance', 'expense', 'settings'];
    forms.forEach(id => {
        const f = document.getElementById(`form-${id}`);
        if (f) {
            f.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                await processForm(id, fd);
                if (['kiln', 'load', 'settings'].includes(id)) hideModal(id);
                e.target.reset();
                showToast();
            });
        }
    });
}

async function processForm(id, fd) {
    if (id === 'kiln') await saveItem('kilns', { praca: fd.get('praca'), modelo: fd.get('modelo') });
    if (id === 'kiln-daily') {
        const item = { data: fd.get('data_lancamento'), responsavel: fd.get('responsavel'), praca: fd.get('praca_select'), vazios: fd.get('vazios'), cheios: fd.get('cheios'), carbonizando: fd.get('carbonizando'), esfriando: fd.get('esfriando'), obs: fd.get('obs') };
        await saveItem('production_history', item);
        if (item.obs) await saveItem('maintenance', { forno: item.praca, problema: item.obs, data: item.data, resolved: false });
    }
    if (id === 'load') await saveItem('loads', { identificador: fd.get('identificador'), data: fd.get('data_carga'), hora: fd.get('hora_carga'), placa: fd.get('placa'), motorista: fd.get('motorista'), peso: fd.get('peso'), destino: fd.get('destino') });
    if (id === 'expense') await saveItem('expenses', { expense_date: fd.get('expense_date'), expense_category: fd.get('expense_category'), expense_desc: fd.get('expense_desc'), expense_value: fd.get('expense_value') });
    if (id === 'settings') {
        await supabase.auth.updateUser({ data: { farm_name: fd.get('enterprise_name') } });
        location.reload();
    }
}

let prodChartInstance = null;
let loadsChartInstance = null;

function renderCharts() {
    const ctx1 = document.getElementById('prodChart');
    const ctx2 = document.getElementById('loadsChart');
    if (!ctx1 || !ctx2) return;
    if (prodChartInstance) prodChartInstance.destroy();
    if (loadsChartInstance) loadsChartInstance.destroy();

    prodChartInstance = new Chart(ctx1, { type: 'line', data: { labels: ['S1', 'S2', 'S3', 'S4'], datasets: [{ label: 'Produção', data: [15, 22, 18, 25], borderColor: PRIMARY_COLOR, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    loadsChartInstance = new Chart(ctx2, { type: 'bar', data: { labels: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], datasets: [{ label: 'Cargas', data: [2, 5, 3, 6, 8, 4, 2], backgroundColor: PRIMARY_COLOR }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}

function showToast() {
    const t = document.getElementById('toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), TOAST_DURATION);
}

// Global functions for HTML
window.switchTab = switchTab;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleMobileMenu = toggleMobileMenu;
window.toggleUserDropdown = toggleUserDropdown;
window.logout = logout;
window.resolveMaint = resolveMaint;
window.deleteExpense = deleteExpense;
window.generateReport = (type) => alert(`Gerando relatório de ${type}...`);
