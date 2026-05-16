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
let fiscalDocs = [];
let currentUser = null;
let expensesPage = 1;
let fiscalPage = 1;
let fiscalCategoryFilter = 'todos';
const ITEMS_PER_PAGE = 9;
const FISCAL_ITEMS_PER_PAGE = 12;

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
    
    // Initialize Flatpickr
    if (window.flatpickr) {
        flatpickr(".date-picker", {
            locale: "pt",
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            allowInput: true,
            disableMobile: "true",
            theme: "dark"
        });
    }

    setupEventListeners();
    renderCharts();
    updateUI();

    // Sync offline data if connection returns
    window.addEventListener('online', syncOfflineData);
    if (navigator.onLine) syncOfflineData();
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
    console.log("Carbonize: Fetching data for UID:", uid);

    try {
        const [k, l, h, m, e, f] = await Promise.all([
            supabase.from('kilns').select('*').eq('user_id', uid),
            supabase.from('loads').select('*').eq('user_id', uid),
            supabase.from('production_history').select('*').eq('user_id', uid),
            supabase.from('maintenance').select('*').eq('user_id', uid),
            supabase.from('expenses').select('*').eq('user_id', uid),
            supabase.from('fiscal_documents').select('*').eq('user_id', uid).order('created_at', { ascending: false })
        ]);

        if (k.error) console.warn("Erro Kilns:", k.error);
        if (l.error) console.warn("Erro Loads:", l.error);
        if (h.error) console.warn("Erro History:", h.error);
        if (m.error) console.warn("Erro Maintenance:", m.error);
        if (e.error) console.warn("Erro Expenses:", e.error);
        if (f.error) console.warn("Erro Fiscal Docs:", f.error);

        kilns = k.data || [];
        loads = l.data || [];
        history = h.data || [];
        maintenance = m.data || [];
        expenses = e.data || [];
        fiscalDocs = f.data || [];
        
        console.log("Data loaded:", { kilns, loads, history, maintenance, expenses, fiscalDocs });
        renderAll();
    } catch (err) {
        console.error("Sync Error:", err);
        alert("Erro de sincronização. Verifique sua conexão ou as tabelas do banco.");
    }
}

async function saveItem(table, item) {
    if (!currentUser) return;
    const payload = { ...item, user_id: currentUser.id };
    
    try {
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
        await loadAllData();
    } catch (err) {
        console.warn("Modo Offline: Salvando localmente...", err);
        saveOffline(table, payload);
        showToast("Salvo localmente (Modo Offline)");
        
        // Atualiza estado local para feedback imediato
        if (table === 'production_history') history.unshift({ ...payload, id: 'temp-' + Date.now() });
        if (table === 'loads') loads.unshift({ ...payload, id: 'temp-' + Date.now() });
        if (table === 'expenses') expenses.unshift({ ...payload, id: 'temp-' + Date.now() });
        if (table === 'maintenance') maintenance.unshift({ ...payload, id: 'temp-' + Date.now() });
        updateUI();
    }
}

function saveOffline(table, data) {
    const queue = JSON.parse(localStorage.getItem('carbonize_offline_queue') || '[]');
    queue.push({ table, data, timestamp: Date.now() });
    localStorage.setItem('carbonize_offline_queue', JSON.stringify(queue));
}

async function syncOfflineData() {
    const queue = JSON.parse(localStorage.getItem('carbonize_offline_queue') || '[]');
    if (queue.length === 0) return;
    
    console.log(`Carbonize: Sincronizando ${queue.length} itens offline...`);
    for (const item of queue) {
        try {
            await supabase.from(item.table).insert([item.data]);
        } catch (err) {
            console.error("Erro na sincronização:", err);
        }
    }
    localStorage.removeItem('carbonize_offline_queue');
    showToast("Dados sincronizados com o servidor!");
    await loadAllData();
}

// 6. UI ENGINE
function updateUI() {
    if (currentUser) {
        const farm = currentUser.user_metadata.farm_name || "Fazenda";
        const operator = currentUser.user_metadata.operator_name || farm;
        document.getElementById('display-enterprise-name').innerText = farm;
        document.getElementById('greeting').innerText = `Olá, ${operator}`;
        document.getElementById('user-avatar-initials').innerText = operator.substring(0, 1).toUpperCase();
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
        document.getElementById('settings-operator').value = currentUser.user_metadata.operator_name || "";
        document.getElementById('settings-email').value = currentUser.email || "";
    }
}

function hideModal(id) {
    document.getElementById(`modal-${id}`).style.display = 'none';
}

function toggleMobileMenu() {
    document.getElementById('mobile-nav').classList.toggle('show');
    document.querySelector('.mobile-menu-btn').classList.toggle('open');
}

function toggleUserDropdown() {
    document.getElementById('user-dropdown').classList.toggle('show');
}

// 7. RENDERERS
function renderAll() {
    console.log("Carbonize: Rendering UI...", { kilns, loads, history, maintenance, expenses, fiscalDocs });
    renderDashboard();
    renderKilns();
    renderLoads();
    renderMaintenance();
    renderStock();
    renderExpenses();
    renderFiscalDocs();
    if (window.lucide) window.lucide.createIcons();
}

function renderDashboard() {
    if (!Array.isArray(history)) history = [];
    if (!Array.isArray(loads)) loads = [];
    if (!Array.isArray(maintenance)) maintenance = [];

    const activeKilns = history.filter(h => h && h.carbonizando > 0).length;
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l && l.data === today).length;
    const monthlyProd = history.reduce((acc, h) => acc + (Number(h ? h.carbonizando : 0) * 1.5), 0);

    const kpiFornos = document.getElementById('kpi-fornos-ativos');
    const kpiCargas = document.getElementById('kpi-cargas-hoje');
    const kpiProd = document.getElementById('kpi-prod-mes');
    const kpiMaint = document.getElementById('kpi-maint');

    if (kpiFornos) kpiFornos.innerText = activeKilns;
    if (kpiCargas) kpiCargas.innerText = todayLoads;
    if (kpiProd) kpiProd.innerText = `${monthlyProd.toFixed(1)} t`;
    if (kpiMaint) kpiMaint.innerText = maintenance.filter(m => m && !m.resolved).length;
}

function renderKilns() {
    const list = document.getElementById('kilns-list-assets');
    const select = document.getElementById('daily-praca-select');
    const maintSelect = document.getElementById('maint-kiln-select');
    const historyList = document.getElementById('kiln-history-list');
    
    if (list) {
        list.innerHTML = kilns.map(k => `
            <div class="asset-pill">
                <i data-lucide="container"></i>
                <div class="info">
                    <h6>${k.praca}</h6>
                    <span>${k.modelo}</span>
                </div>
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
    const balanceEl = document.getElementById('kpi-stock-balance');
    if (balanceEl) balanceEl.innerText = `${bal.toFixed(1)} t`;
}

function renderExpenses() {
    console.log("Rendering expenses...", expenses);
    const list = document.getElementById('expense-history-list');
    const totalEl = document.getElementById('kpi-custo-mes');
    const total = expenses.reduce((acc, e) => acc + Number(e.expense_value || 0), 0);
    if (totalEl) totalEl.innerText = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    
    if (list) {
        if (expenses.length === 0) {
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-dim);">Nenhum lançamento encontrado.</td></tr>';
            return;
        }

        const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
        if (expensesPage > totalPages) expensesPage = totalPages || 1;

        const start = (expensesPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = expenses.slice(start, end);

        list.innerHTML = pageItems.map(e => `
            <tr>
                <td>${e.expense_date}</td>
                <td>${e.expense_desc || '-'}</td>
                <td>${e.payment_method}${e.payment_method === 'Cartão' && e.installments ? ` (${e.installments}x)` : ''}</td>
                <td>${Number(e.expense_quantity || 1).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                <td>R$ ${Number(e.expense_value).toFixed(2)}</td>
                <td>
                    <div style="display:flex; gap:8px;">
                        <button onclick="editExpense('${e.id}')" style="background:none; border:none; color:var(--text-dim); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>
                        <button onclick="deleteExpense('${e.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');

        const info = document.getElementById('expenses-page-info');
        if (info) info.innerText = `Página ${expensesPage} de ${totalPages}`;
        
        if (window.lucide) window.lucide.createIcons();
    }
}

function changeExpensesPage(dir) {
    const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
    const next = expensesPage + dir;
    if (next >= 1 && next <= totalPages) {
        expensesPage = next;
        renderExpenses();
    }
}

async function deleteExpense(id) {
    if (confirm("Deseja excluir?")) {
        await supabase.from('expenses').delete().eq('id', id);
        await loadAllData();
    }
}

function editExpense(id) {
    const e = expenses.find(item => item.id === id);
    if (!e) return;
    
    const form = document.getElementById('form-expense');
    form.querySelector('[name="expense_date"]')._flatpickr.setDate(e.expense_date);
    form.querySelector('[name="expense_category"]').value = e.expense_category;
    form.querySelector('[name="payment_method"]').value = e.payment_method;
    form.querySelector('[name="expense_desc"]').value = e.expense_desc;
    form.querySelector('[name="expense_quantity"]').value = e.expense_quantity;
    form.querySelector('[name="expense_value"]').value = e.expense_value;
    form.querySelector('[name="expense_id"]').value = e.id;

    const installmentsField = document.getElementById('installments-field');
    if (e.payment_method === 'Cartão') {
        installmentsField.style.display = 'block';
        form.querySelector('[name="installments"]').value = e.installments || 1;
    } else {
        installmentsField.style.display = 'none';
    }
    
    const btn = document.getElementById('btn-save-expense');
    btn.innerText = "Atualizar Lançamento";
    btn.style.background = "#2563eb"; // Blue for edit mode
    
    window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
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
                const btn = e.target.querySelector('button[type="submit"]');
                const originalText = btn ? btn.innerText : "Salvar";
                
                if (btn) {
                    btn.innerText = "Processando...";
                    btn.disabled = true;
                }

                const fd = new FormData(e.target);
                try {
                    await processForm(id, fd);
                    if (['kiln', 'load', 'settings'].includes(id)) hideModal(id);
                    e.target.reset();
                    showToast("Operação realizada com sucesso!");
                } catch (err) {
                    console.error("Form error:", err);
                    alert("Erro operacional: " + err.message + "\n\nVerifique se as tabelas foram criadas corretamente no Supabase.");
                } finally {
                    if (btn) {
                        btn.innerText = originalText;
                        btn.disabled = false;
                    }
                }
            });
        }
    });

    const paymentSelect = document.getElementById('payment-method-select');
    const installmentsField = document.getElementById('installments-field');
    if (paymentSelect && installmentsField) {
        paymentSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Cartão') {
                installmentsField.style.display = 'block';
            } else {
                installmentsField.style.display = 'none';
            }
        });
    }
}

async function processForm(id, fd) {
    if (id === 'kiln') await saveItem('kilns', { praca: fd.get('praca'), modelo: fd.get('modelo') });
    if (id === 'kiln-daily') {
        const item = { data: fd.get('data_lancamento'), responsavel: fd.get('responsavel'), praca: fd.get('praca_select'), vazios: fd.get('vazios'), cheios: fd.get('cheios'), carbonizando: fd.get('carbonizando'), esfriando: fd.get('esfriando'), obs: fd.get('obs') };
        await saveItem('production_history', item);
        if (item.obs) await saveItem('maintenance', { forno: item.praca, problema: item.obs, data: item.data, resolved: false });
    }
    if (id === 'load') await saveItem('loads', { identificador: fd.get('identificador'), data: fd.get('data_carga'), hora: fd.get('hora_carga'), placa: fd.get('placa'), motorista: fd.get('motorista'), tipo_carvao: fd.get('tipo_carvao'), metragem: fd.get('metragem'), peso: fd.get('peso'), destino: fd.get('destino') });
    if (id === 'expense') {
        const expenseId = fd.get('expense_id');
        const item = { 
            expense_date: fd.get('expense_date'), 
            expense_category: fd.get('expense_category'), 
            expense_desc: fd.get('expense_desc'), 
            expense_value: fd.get('expense_value'),
            expense_quantity: fd.get('expense_quantity') || 1,
            payment_method: fd.get('payment_method'),
            installments: fd.get('payment_method') === 'Cartão' ? fd.get('installments') : null
        };

        if (expenseId) {
            await supabase.from('expenses').update(item).eq('id', expenseId);
            document.getElementById('edit-expense-id').value = '';
            document.getElementById('btn-save-expense').innerText = "Salvar Lançamento";
            document.getElementById('btn-save-expense').style.background = ""; 
        } else {
            await saveItem('expenses', item);
        }
    }
    if (id === 'maintenance') await saveItem('maintenance', { forno: fd.get('kiln_target'), problema: fd.get('problema'), data: fd.get('repair_date'), cost: fd.get('cost'), resolved: false });
    if (id === 'settings') {
        await supabase.auth.updateUser({ 
            data: { 
                farm_name: fd.get('enterprise_name'),
                operator_name: fd.get('operator_name')
            } 
        });
        location.reload();
    }
}

let prodChartInstance = null;
let loadsChartInstance = null;
let efficiencyChartInstance = null;
let costsDistChartInstance = null;

function renderCharts() {
    const ctx1 = document.getElementById('prodChart');
    const ctx2 = document.getElementById('loadsChart');
    const ctx3 = document.getElementById('efficiencyChart');
    const ctx4 = document.getElementById('costsDistChart');

    if (prodChartInstance) prodChartInstance.destroy();
    if (loadsChartInstance) loadsChartInstance.destroy();
    if (efficiencyChartInstance) efficiencyChartInstance.destroy();
    if (costsDistChartInstance) costsDistChartInstance.destroy();

    if (ctx1) prodChartInstance = new Chart(ctx1, { type: 'line', data: { labels: ['S1', 'S2', 'S3', 'S4'], datasets: [{ label: 'Produção', data: [15, 22, 18, 25], borderColor: PRIMARY_COLOR, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    if (ctx2) loadsChartInstance = new Chart(ctx2, { type: 'bar', data: { labels: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], datasets: [{ label: 'Cargas', data: [2, 5, 3, 6, 8, 4, 2], backgroundColor: PRIMARY_COLOR }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    
    if (ctx3) {
        efficiencyChartInstance = new Chart(ctx3, {
            type: 'radar',
            data: {
                labels: ['Velocidade', 'Qualidade', 'Custo', 'Manutenção', 'Segurança'],
                datasets: [{
                    label: 'Score Atual',
                    data: [85, 92, 78, 88, 95],
                    backgroundColor: 'rgba(230, 0, 46, 0.2)',
                    borderColor: PRIMARY_COLOR,
                    pointBackgroundColor: PRIMARY_COLOR
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: { grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#94949e' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    if (ctx4) {
        costsDistChartInstance = new Chart(ctx4, {
            type: 'doughnut',
            data: {
                labels: ['Lenha', 'Mão de Obra', 'Logística', 'Manutenção'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: ['#e6002e', '#00d2ff', '#00e676', '#ffea00'],
                    borderWidth: 2,
                    borderColor: '#0f0f12'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#94949e', font: { size: 10 } } } }
            }
        });
    }
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
window.editExpense = editExpense;
window.changeExpensesPage = changeExpensesPage;
window.filterFiscalDocs = filterFiscalDocs;
window.renderFiscalDocs = renderFiscalDocs;
window.changeFiscalPage = changeFiscalPage;
window.viewFiscalDoc = viewFiscalDoc;
window.deleteFiscalDoc = deleteFiscalDoc;
window.downloadFiscalDoc = downloadFiscalDoc;
window.updateFiscalStatus = updateFiscalStatus;
// 9. PREMIUM REPORT ENGINE
function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function getReportDateRange(type) {
    const typeMap = { 'loads': 'loads', 'pracas': 'pracas', 'maint': 'maint', 'expenses': 'expenses' };
    const key = typeMap[type] || type;
    const start = document.getElementById(`report-${key}-start`).value;
    const end = document.getElementById(`report-${key}-end`).value;
    return { start, end };
}

function filterByDateRange(arr, dateField, start, end) {
    return arr.filter(item => {
        const d = item[dateField];
        return d && d >= start && d <= end;
    });
}

window.generateReport = async (type, format = 'pdf') => {
    const { start, end } = getReportDateRange(type);
    
    if (!start || !end) {
        alert("Por favor, selecione o período inicial e final.");
        return;
    }

    const typeLabel = {
        'loads': 'EXPEDICAO',
        'pracas': 'PRODUCAO',
        'maint': 'MANUTENCAO',
        'expenses': 'GASTOS'
    }[type] || type.toUpperCase();

    const farmName = currentUser?.user_metadata?.farm_name || "Fazenda";
    const now = new Date();
    const generatedAt = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}`;

    let reportConfig = {};

    // ─── EXPEDIÇÃO ───
    if (type === 'loads') {
        const filtered = filterByDateRange(loads, 'data', start, end);
        const totalPeso = filtered.reduce((a, l) => a + Number(l.peso || 0), 0);
        const totalMetragem = filtered.reduce((a, l) => a + Number(l.metragem || 0), 0);

        reportConfig = {
            title: "RELATÓRIO DE EXPEDIÇÃO E LOGÍSTICA",
            subtitle: "Controle de Saídas e Romaneios",
            summaryItems: [
                { label: "Total de Cargas", value: filtered.length },
                { label: "Peso Total", value: `${totalPeso.toLocaleString('pt-BR')} kg` },
                { label: "Metragem Total", value: `${totalMetragem.toFixed(1)} m³` },
                { label: "Destinos Únicos", value: [...new Set(filtered.map(l => l.destino))].length }
            ],
            headers: ["Nº ID", "Data", "Hora", "Veículo / Placa", "Motorista", "Tipo de Carvão", "Metragem (m³)", "Peso (kg)", "Destino"],
            rows: filtered.map(l => [
                l.identificador || '-',
                formatDateBR(l.data),
                l.hora || '-',
                l.placa || '-',
                l.motorista || '-',
                l.tipo_carvao || 'Eucalipto',
                l.metragem || '0',
                Number(l.peso || 0).toLocaleString('pt-BR'),
                l.destino || '-'
            ]),
            footer: `Peso Total Expedido: ${totalPeso.toLocaleString('pt-BR')} kg | Metragem Total: ${totalMetragem.toFixed(1)} m³`
        };
    }

    // ─── PRODUÇÃO ───
    else if (type === 'pracas') {
        const filtered = filterByDateRange(history, 'data', start, end);
        const totalCarbonizando = filtered.reduce((a, h) => a + Number(h.carbonizando || 0), 0);
        const totalProd = totalCarbonizando * 1.5;
        const unidades = [...new Set(filtered.map(h => h.praca))];

        reportConfig = {
            title: "RELATÓRIO DE PRODUÇÃO E CICLOS",
            subtitle: "Desempenho Operacional dos Fornos",
            summaryItems: [
                { label: "Registros no Período", value: filtered.length },
                { label: "Fornos em Carbonização", value: totalCarbonizando },
                { label: "Produção Estimada", value: `${totalProd.toFixed(1)} t` },
                { label: "Unidades Operantes", value: unidades.length }
            ],
            headers: ["Data", "Responsável", "Unidade / Forno", "Vazios", "Cheios", "Carbon.", "Esfria", "Observações / Manutenção"],
            rows: filtered.map(h => [
                formatDateBR(h.data),
                h.responsavel || '-',
                h.praca || '-',
                h.vazios || '0',
                h.cheios || '0',
                h.carbonizando || '0',
                h.esfriando || '0',
                h.obs || '-'
            ]),
            footer: `Produção Estimada no Período: ${totalProd.toFixed(1)} toneladas`
        };
    }

    // ─── MANUTENÇÃO ───
    else if (type === 'maint') {
        const filtered = filterByDateRange(maintenance, 'data', start, end);
        const pendentes = filtered.filter(m => !m.resolved).length;
        const resolvidos = filtered.filter(m => m.resolved).length;
        const custoTotal = filtered.reduce((a, m) => a + Number(m.cost || 0), 0);

        reportConfig = {
            title: "RELATÓRIO DE MANUTENÇÃO E ATIVOS",
            subtitle: "Gestão de Reparos e Ordens de Serviço",
            summaryItems: [
                { label: "Total de Ocorrências", value: filtered.length },
                { label: "Pendentes", value: pendentes },
                { label: "Resolvidos", value: resolvidos },
                { label: "Custo Total", value: `R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` }
            ],
            headers: ["Data", "Forno", "Problema", "Custo (R$)", "Status"],
            rows: filtered.map(m => [
                formatDateBR(m.data),
                m.forno || '-',
                m.problema || '-',
                `R$ ${Number(m.cost || 0).toFixed(2)}`,
                m.resolved ? '✓ Resolvido' : '⚠ Pendente'
            ]),
            footer: `Custo Total de Manutenção: R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        };
    }

    // ─── CUSTOS ───
    else if (type === 'expenses') {
        const filtered = filterByDateRange(expenses, 'expense_date', start, end);
        const total = filtered.reduce((a, e) => a + Number(e.expense_value || 0), 0);
        
        reportConfig = {
            title: "RELATÓRIO DE CUSTOS OPERACIONAIS",
            subtitle: "Análise Financeira e Fluxo de Despesas",
            summaryItems: [
                { label: "Total de Lançamentos", value: filtered.length },
                { label: "Custo Total", value: `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` }
            ],
            headers: ["Data", "Descrição", "Pagamento", "Qtd", "Valor (R$)"],
            rows: filtered.map(e => [
                formatDateBR(e.expense_date),
                e.expense_desc || '-',
                e.payment_method === 'Cartão' && e.installments ? `${e.payment_method} (${e.installments}x)` : (e.payment_method || '-'),
                Number(e.expense_quantity || 1).toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
                `R$ ${Number(e.expense_value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
            ]),
            footer: `Valor Total no Período: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        };
    }
    
    // ─── FISCAL ───
    else if (type === 'fiscal') {
        const filtered = filterByDateRange(fiscalDocs, 'reference_date', start, end);
        const totalValue = filtered.reduce((a, d) => a + Number(d.value || 0), 0);
        const statusLabels = { 'pago': 'Liquidado / Pago', 'aberto': 'Em Aberto', 'analise': 'Em Análise' };

        reportConfig = {
            title: "RELATÓRIO DE GESTÃO FISCAL E DOCUMENTAL",
            subtitle: "Nuvem Fiscal e Controle de Recebimentos",
            summaryItems: [
                { label: "Total de Documentos", value: filtered.length },
                { label: "Valor Total", value: `R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` },
                { label: "Clientes / Fornecedores", value: [...new Set(filtered.map(d => d.client))].length },
                { label: "Documentos em Aberto", value: filtered.filter(d => d.status === 'aberto').length }
            ],
            headers: ["Data", "Categoria", "Cliente / Fornecedor", "Nº Doc", "Descrição", "Valor (R$)", "Situação"],
            rows: filtered.map(d => [
                formatDateBR(d.reference_date),
                FISCAL_CATEGORY_LABELS[d.category] || d.category,
                d.client || '-',
                d.doc_number || '-',
                d.description || '-',
                `R$ ${Number(d.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                statusLabels[d.status] || 'Em Aberto'
            ]),
            footer: `Valor Total no Período: R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        };
    }

    if (reportConfig.rows.length === 0) {
        alert("Nenhum registro encontrado no período selecionado.");
        return;
    }

    // ════════════════════════════════════
    //  EXPORTAÇÃO XLS (SpreadsheetML com estilo)
    // ════════════════════════════════════
    if (format === 'excel') {
        const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        // Estilos: 0=normal, 1=cabeçalho (azul/branco/negrito), 2=zebra clara
        const styles = `
        <Styles>
            <Style ss:ID="s0">
                <Alignment ss:Vertical="Center" ss:WrapText="0"/>
                <Borders>
                    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                </Borders>
                <Font ss:FontName="Calibri" ss:Size="11"/>
            </Style>
            <Style ss:ID="s1">
                <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:WrapText="0"/>
                <Borders>
                    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
                    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFFFFF"/>
                </Borders>
                <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
                <Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/>
            </Style>
            <Style ss:ID="s2">
                <Alignment ss:Vertical="Center" ss:WrapText="0"/>
                <Borders>
                    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                </Borders>
                <Font ss:FontName="Calibri" ss:Size="11"/>
                <Interior ss:Color="#EEF3F8" ss:Pattern="Solid"/>
            </Style>
        </Styles>`;

        // Linha de cabeçalho
        const headerRow = `<Row ss:Height="22">
            ${reportConfig.headers.map(h => `<Cell ss:StyleID="s1"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}
        </Row>`;

        // Linhas de dados (alternadas)
        const dataRows = reportConfig.rows.map((row, i) => {
            const style = i % 2 === 1 ? 's2' : 's0';
            return `<Row ss:Height="18">
                ${row.map(cell => `<Cell ss:StyleID="${style}"><Data ss:Type="String">${esc(cell)}</Data></Cell>`).join('')}
            </Row>`;
        }).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    ${styles}
    <Worksheet ss:Name="${esc(reportConfig.title.slice(0,31))}">
        <Table>
            ${reportConfig.headers.map(() => '<Column ss:Width="120"/>').join('')}
            ${headerRow}
            ${dataRows}
        </Table>
    </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CARBONIZE_${typeLabel}_${formatDateBR(start)}_a_${formatDateBR(end)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast();
        return;
    }

    // ════════════════════════════════════
    //  EXPORTAÇÃO PDF PREMIUM
    // ════════════════════════════════════
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: reportConfig.headers.length > 6 ? 'landscape' : 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── CABEÇALHO PREMIUM ──
    // Barra vermelha superior
    doc.setFillColor(230, 0, 46);
    doc.rect(0, 0, pageWidth, 28, 'F');
    
    // Barra escura secundária
    doc.setFillColor(15, 15, 18);
    doc.rect(0, 28, pageWidth, 8, 'F');

    // Título na barra vermelha
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("CARBONIZE", 14, 14);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("INTELIGÊNCIA INDUSTRIAL", 14, 20);

    // Info direita
    doc.setFontSize(9);
    doc.text(farmName.toUpperCase(), pageWidth - 14, 12, { align: 'right' });
    doc.setFontSize(7);
    doc.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 18, { align: 'right' });
    doc.text(`Período: ${formatDateBR(start)} a ${formatDateBR(end)}`, pageWidth - 14, 24, { align: 'right' });

    // ── TÍTULO DO RELATÓRIO ──
    let yPos = 44;
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(reportConfig.title, 14, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(reportConfig.subtitle, 14, yPos);
    yPos += 10;

    // ── CARDS DE RESUMO ──
    const cardWidth = (pageWidth - 28 - 18) / 4;
    reportConfig.summaryItems.forEach((item, i) => {
        const x = 14 + i * (cardWidth + 6);
        
        // Card background
        doc.setFillColor(245, 245, 248);
        doc.roundedRect(x, yPos, cardWidth, 20, 3, 3, 'F');
        
        // Barra lateral vermelha
        doc.setFillColor(230, 0, 46);
        doc.rect(x, yPos, 2, 20, 'F');

        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text(item.label.toUpperCase(), x + 8, yPos + 7);

        // Value
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text(String(item.value), x + 8, yPos + 15);
    });

    yPos += 30;

    // ── LINHA SEPARADORA ──
    doc.setDrawColor(230, 0, 46);
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;

    // ── TABELA DE DADOS ──
    doc.autoTable({
        startY: yPos,
        head: [reportConfig.headers],
        body: reportConfig.rows,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.3,
            font: 'helvetica'
        },
        headStyles: {
            fillColor: [30, 30, 35],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            cellPadding: 5
        },
        alternateRowStyles: {
            fillColor: [248, 248, 252]
        },
        columnStyles: reportConfig.headers.reduce((acc, _, i) => {
            acc[i] = { halign: i === 0 ? 'center' : 'left' };
            return acc;
        }, {}),
        margin: { left: 14, right: 14 },
        didDrawPage: function(data) {
            // Rodapé em cada página
            doc.setFillColor(245, 245, 248);
            doc.rect(0, pageHeight - 18, pageWidth, 18, 'F');
            doc.setDrawColor(230, 0, 46);
            doc.setLineWidth(0.5);
            doc.line(0, pageHeight - 18, pageWidth, pageHeight - 18);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(120, 120, 120);
            doc.text("Carbonize - Inteligência Industrial | Documento gerado automaticamente", 14, pageHeight - 8);
            doc.text(`Página ${data.pageNumber}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
    });

    // ── RODAPÉ FINAL COM TOTAIS ──
    let finalY = doc.lastAutoTable.finalY + 10;
    if (finalY > pageHeight - 40) {
        doc.addPage();
        finalY = 20;
    }

    // Barra de total
    doc.setFillColor(30, 30, 35);
    doc.roundedRect(14, finalY, pageWidth - 28, 14, 3, 3, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(reportConfig.footer, pageWidth / 2, finalY + 9, { align: 'center' });



    doc.save(`CARBONIZE_${typeLabel}_${formatDateBR(start)}_a_${formatDateBR(end)}.pdf`);
    showToast();
};

// ═══════════════════════════════════════
// 10. NUVEM FISCAL — Document Cloud Engine
// ═══════════════════════════════════════

const FISCAL_CATEGORY_LABELS = {
    'nf_entrada': 'NF Entrada',
    'nf_saida': 'NF Saída',
    'comprovante_pagamento': 'Comprovante Pgto',
    'comprovante_recebimento': 'Comprovante Receb.',
    'folha_pagamento': 'Folha Pagamento',
    'outros': 'Outros'
};

const FISCAL_CATEGORY_ICONS = {
    'nf_entrada': 'file-input',
    'nf_saida': 'file-output',
    'comprovante_pagamento': 'credit-card',
    'comprovante_recebimento': 'banknote',
    'folha_pagamento': 'users',
    'outros': 'folder'
};

function getMonthLabel(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return dateStr;
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(parts[1]) - 1]}/${parts[0]}`;
}

function getMonthValue(dateStr) {
    if (!dateStr) return '';
    return dateStr.substring(0, 7);
}

function filterFiscalDocs(category, btn) {
    fiscalCategoryFilter = category;
    fiscalPage = 1;
    document.querySelectorAll('.fiscal-cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFiscalDocs();
}

function getFilteredFiscalDocs() {
    let filtered = [...fiscalDocs];

    if (fiscalCategoryFilter !== 'todos') {
        filtered = filtered.filter(d => d.category === fiscalCategoryFilter);
    }

    const clientFilter = document.getElementById('fiscal-filter-client');
    if (clientFilter && clientFilter.value !== 'todos') {
        filtered = filtered.filter(d => d.client === clientFilter.value);
    }

    const monthFilter = document.getElementById('fiscal-filter-month');
    if (monthFilter && monthFilter.value !== 'todos') {
        filtered = filtered.filter(d => getMonthValue(d.reference_date) === monthFilter.value);
    }

    const statusFilter = document.getElementById('fiscal-filter-status');
    if (statusFilter && statusFilter.value !== 'todos') {
        filtered = filtered.filter(d => d.status === statusFilter.value);
    }

    const search = document.getElementById('fiscal-search');
    if (search && search.value.trim()) {
        const term = search.value.toLowerCase().trim();
        filtered = filtered.filter(d =>
            (d.description || '').toLowerCase().includes(term) ||
            (d.client || '').toLowerCase().includes(term) ||
            (d.doc_number || '').toLowerCase().includes(term) ||
            (FISCAL_CATEGORY_LABELS[d.category] || '').toLowerCase().includes(term) ||
            (d.status || '').toLowerCase().includes(term)
        );
    }

    return filtered;
}

function renderFiscalDocs() {
    const nfEntrada = document.getElementById('kpi-nf-entrada');
    const nfSaida = document.getElementById('kpi-nf-saida');
    const comprovantes = document.getElementById('kpi-comprovantes');
    const totalDocs = document.getElementById('kpi-total-docs');

    if (nfEntrada) nfEntrada.innerText = fiscalDocs.filter(d => d.category === 'nf_entrada').length;
    if (nfSaida) nfSaida.innerText = fiscalDocs.filter(d => d.category === 'nf_saida').length;
    if (comprovantes) comprovantes.innerText = fiscalDocs.filter(d => d.category === 'comprovante_pagamento' || d.category === 'comprovante_recebimento').length;
    if (totalDocs) totalDocs.innerText = fiscalDocs.length;

    const clientSelect = document.getElementById('fiscal-filter-client');
    if (clientSelect) {
        const currentVal = clientSelect.value;
        const clients = [...new Set(fiscalDocs.map(d => d.client).filter(Boolean))].sort();
        clientSelect.innerHTML = '<option value="todos">Todos</option>' + clients.map(c => `<option value="${c}">${c}</option>`).join('');
        clientSelect.value = currentVal || 'todos';
    }

    const monthSelect = document.getElementById('fiscal-filter-month');
    if (monthSelect) {
        const currentVal = monthSelect.value;
        const months = [...new Set(fiscalDocs.map(d => getMonthValue(d.reference_date)).filter(Boolean))].sort().reverse();
        monthSelect.innerHTML = '<option value="todos">Todos</option>' + months.map(m => `<option value="${m}">${getMonthLabel(m + '-01')}</option>`).join('');
        monthSelect.value = currentVal || 'todos';
    }

    const filtered = getFilteredFiscalDocs();
    const grid = document.getElementById('fiscal-docs-grid');
    const countEl = document.getElementById('fiscal-docs-count');

    if (countEl) countEl.innerText = `${filtered.length} documento${filtered.length !== 1 ? 's' : ''}`;

    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="fiscal-empty-state">
                <div style="width: 80px; height: 80px; background: var(--primary-dim); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                    <i data-lucide="cloud-off" style="width: 36px; height: 36px; color: var(--text-dim);"></i>
                </div>
                <h4 style="color: var(--text-dim); margin-bottom: 8px;">Nenhum documento encontrado</h4>
                <p style="color: var(--text-dim); font-size: 13px; opacity: 0.6;">Envie seu primeiro documento fiscal clicando no botão acima.</p>
            </div>`;
        const pagination = document.getElementById('fiscal-pagination');
        if (pagination) pagination.style.display = 'none';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const totalPages = Math.ceil(filtered.length / FISCAL_ITEMS_PER_PAGE);
    if (fiscalPage > totalPages) fiscalPage = totalPages || 1;
    const start = (fiscalPage - 1) * FISCAL_ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + FISCAL_ITEMS_PER_PAGE);

    grid.innerHTML = pageItems.map(doc => {
        const icon = FISCAL_CATEGORY_ICONS[doc.category] || 'file';
        const label = FISCAL_CATEGORY_LABELS[doc.category] || 'Documento';
        const dateFormatted = formatDateBR(doc.reference_date);
        const value = doc.value ? `R$ ${Number(doc.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
        const hasFile = doc.file_path && doc.file_path.length > 0;
        const fileName = doc.file_name || 'Sem arquivo';
        const fileExt = fileName.split('.').pop().toUpperCase();
        
        const statusConfig = {
            'pago': { label: 'Pago', class: 'success' },
            'aberto': { label: 'Em Aberto', class: 'warning' },
            'analise': { label: 'Em Análise', class: 'danger' }
        }[doc.status || 'aberto'] || { label: 'Em Aberto', class: 'warning' };

        return `
            <div class="fiscal-doc-card" data-cat="${doc.category}">
                <div class="fiscal-doc-header">
                    <div class="fiscal-doc-icon ${doc.category}">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <p style="font-weight:700; font-size:14px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${doc.description || 'Sem descrição'}</p>
                            <span class="status-badge ${statusConfig.class}" style="font-size:9px; padding:2px 6px; border-radius:6px; flex-shrink:0;">${statusConfig.label}</span>
                        </div>
                        <p style="font-size:12px; color:var(--text-dim); margin-top:2px;">${label}</p>
                    </div>
                </div>

                <div class="fiscal-doc-meta">
                    <span><i data-lucide="user" style="width:12px;"></i> ${doc.client || '-'}</span>
                    <span><i data-lucide="calendar" style="width:12px;"></i> ${dateFormatted}</span>
                    ${doc.doc_number ? `<span><i data-lucide="hash" style="width:12px;"></i> ${doc.doc_number}</span>` : ''}
                    ${value ? `<span style="color: var(--success); font-weight:700;">${value}</span>` : ''}
                </div>

                ${hasFile ? `
                <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:rgba(0,0,0,0.2); border-radius:10px; font-size:12px;">
                    <i data-lucide="file" style="width:14px; color:var(--text-dim);"></i>
                    <span style="color:var(--text-dim); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${fileName}</span>
                    <span style="color:var(--primary); font-weight:700; font-size:10px;">${fileExt}</span>
                </div>` : ''}

                <div class="fiscal-doc-actions">
                    <button onclick="viewFiscalDoc('${doc.id}')"><i data-lucide="eye" style="width:14px;"></i> Ver</button>
                    ${hasFile ? `<button onclick="downloadFiscalDoc('${doc.id}')"><i data-lucide="download" style="width:14px;"></i> Baixar</button>` : ''}
                    <button class="delete-btn" onclick="deleteFiscalDoc('${doc.id}')"><i data-lucide="trash-2" style="width:14px;"></i></button>
                </div>
            </div>
        `;
    }).join('');

    const pagination = document.getElementById('fiscal-pagination');
    if (pagination) {
        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        const info = document.getElementById('fiscal-page-info');
        if (info) info.innerText = `Página ${fiscalPage} de ${totalPages}`;
    }

    if (window.lucide) window.lucide.createIcons();
}

function changeFiscalPage(dir) {
    const filtered = getFilteredFiscalDocs();
    const totalPages = Math.ceil(filtered.length / FISCAL_ITEMS_PER_PAGE);
    const next = fiscalPage + dir;
    if (next >= 1 && next <= totalPages) {
        fiscalPage = next;
        renderFiscalDocs();
    }
}

async function viewFiscalDoc(id) {
    const doc = fiscalDocs.find(d => d.id === id);
    if (!doc) return;

    const label = FISCAL_CATEGORY_LABELS[doc.category] || 'Documento';
    const dateFormatted = formatDateBR(doc.reference_date);
    const value = doc.value ? `R$ ${Number(doc.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informado';

    document.getElementById('fiscal-view-title').innerText = doc.description || label;

    let filePreview = '';
    if (doc.file_path) {
        const ext = (doc.file_name || '').split('.').pop().toLowerCase();
        const { data: urlData } = await supabase.storage.from('fiscal-docs').createSignedUrl(doc.file_path, 3600);
        const fileUrl = urlData?.signedUrl || '#';

        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
            filePreview = `
                <div style="margin-top:20px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
                    <div style="padding:10px 16px; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:12px; color:var(--text-dim); font-weight:600;">📎 PREVIEW DO ARQUIVO</span>
                        <a href="${fileUrl}" target="_blank" style="color:var(--primary); font-size:12px; text-decoration:none; font-weight:700;">Abrir em nova aba →</a>
                    </div>
                    <img src="${fileUrl}" style="width:100%; display:block; max-height:500px; object-fit:contain; background:#111;" alt="Preview">
                </div>`;
        } else if (ext === 'pdf') {
            filePreview = `
                <div style="margin-top:20px; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.06);">
                    <div style="padding:10px 16px; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:12px; color:var(--text-dim); font-weight:600;">📄 PREVIEW DO ARQUIVO</span>
                        <a href="${fileUrl}" target="_blank" style="color:var(--primary); font-size:12px; text-decoration:none; font-weight:700;">Abrir em nova aba →</a>
                    </div>
                    <iframe src="${fileUrl}" style="width:100%; height:500px; border:none; display:block; background:#fff;"></iframe>
                </div>`;
        } else {
            filePreview = `
                <div style="text-align:center; margin-top:20px; padding:32px; background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
                    <div style="padding:10px 16px; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; margin-bottom:16px; border-radius:8px;">
                        <span style="font-size:12px; color:var(--text-dim); font-weight:600;">📎 ARQUIVO ANEXADO</span>
                    </div>
                    <i data-lucide="file" style="width:48px; height:48px; color:var(--text-dim);"></i>
                    <p style="margin-top:12px; color:#fff; font-weight:600;">${doc.file_name}</p>
                    <p style="margin-top:4px; color:var(--text-dim); font-size:12px;">Tipo: ${ext.toUpperCase()}</p>
                    <a href="${fileUrl}" target="_blank" style="display:inline-block; margin-top:16px; padding:10px 24px; background:var(--primary); color:#fff; font-weight:700; text-decoration:none; border-radius:8px;">Abrir Arquivo →</a>
                </div>`;
        }
    } else {
        filePreview = `
            <div style="text-align:center; margin-top:20px; padding:32px; background:rgba(0,0,0,0.15); border-radius:12px; border:1px dashed rgba(255,255,255,0.1);">
                <i data-lucide="file-x" style="width:40px; height:40px; color:var(--text-dim); opacity:0.5;"></i>
                <p style="margin-top:12px; color:var(--text-dim); font-size:13px;">Nenhum arquivo anexado a este documento.</p>
            </div>`;
    }

    const statusLabels = { 'pago': 'Liquidado / Pago', 'aberto': 'Em Aberto', 'analise': 'Em Análise' };
    const statusLabel = statusLabels[doc.status] || 'Em Aberto';

    document.getElementById('fiscal-view-content').innerHTML = `
        <div class="fiscal-detail-grid">
            <div class="fiscal-detail-item"><label>Categoria</label><p>${label}</p></div>
            <div class="fiscal-detail-item"><label>Cliente / Fornecedor</label><p>${doc.client || '-'}</p></div>
            <div class="fiscal-detail-item"><label>Data de Referência</label><p>${dateFormatted}</p></div>
            <div class="fiscal-detail-item"><label>Nº Documento</label><p>${doc.doc_number || '-'}</p></div>
            <div class="fiscal-detail-item"><label>Valor</label><p>${value}</p></div>
            <div class="fiscal-detail-item">
                <label>Situação</label>
                <select onchange="updateFiscalStatus('${doc.id}', this.value)" style="margin-top:4px; padding:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:8px; color:#fff; width:100%; cursor:pointer;">
                    <option value="pago" ${doc.status === 'pago' ? 'selected' : ''}>Liquidado / Pago</option>
                    <option value="aberto" ${doc.status === 'aberto' ? 'selected' : ''}>Em Aberto</option>
                    <option value="analise" ${doc.status === 'analise' ? 'selected' : ''}>Em Análise / Pendente</option>
                </select>
            </div>
            <div class="fiscal-detail-item"><label>Arquivo</label><p>${doc.file_name || 'Nenhum'}</p></div>
        </div>
        ${filePreview}
    `;

    showModal('fiscal-view');
    if (window.lucide) window.lucide.createIcons();
}

async function updateFiscalStatus(id, newStatus) {
    try {
        const { error } = await supabase
            .from('fiscal_documents')
            .update({ status: newStatus })
            .eq('id', id);

        if (error) throw error;

        // Atualiza localmente para feedback rápido
        const docIndex = fiscalDocs.findIndex(d => d.id === id);
        if (docIndex !== -1) {
            fiscalDocs[docIndex].status = newStatus;
        }

        showToast("Situação atualizada!");
        renderFiscalDocs();
    } catch (err) {
        console.error('Update status error:', err);
        alert('Erro ao atualizar status: ' + err.message);
    }
}

async function downloadFiscalDoc(id) {
    const doc = fiscalDocs.find(d => d.id === id);
    if (!doc || !doc.file_path) return;

    try {
        const { data: urlData, error } = await supabase.storage.from('fiscal-docs').createSignedUrl(doc.file_path, 3600);
        if (error) throw error;
        if (urlData?.signedUrl) {
            // Cria link de download real
            const link = document.createElement('a');
            link.href = urlData.signedUrl;
            link.target = '_blank';
            link.download = doc.file_name || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('Erro ao gerar link de download.');
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('Erro ao gerar link de download: ' + err.message);
    }
}

async function deleteFiscalDoc(id) {
    if (!confirm('Deseja excluir este documento fiscal?')) return;

    const doc = fiscalDocs.find(d => d.id === id);
    if (doc && doc.file_path) {
        await supabase.storage.from('fiscal-docs').remove([doc.file_path]);
    }

    await supabase.from('fiscal_documents').delete().eq('id', id);
    await loadAllData();
    showToast();
}

// ─── FISCAL UPLOAD FORM & DRAG/DROP ───
function setupFiscalUpload() {
    const dropzone = document.getElementById('fiscal-dropzone');
    const fileInput = document.getElementById('fiscal-file-input');
    const form = document.getElementById('form-fiscal-upload');

    if (!dropzone || !fileInput || !form) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            showSelectedFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            showSelectedFile(fileInput.files[0]);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-fiscal-submit');
        const textEl = document.getElementById('fiscal-submit-text');
        const originalText = textEl.innerText;
        textEl.innerText = 'Enviando...';
        btn.disabled = true;

        try {
            const fd = new FormData(form);
            const file = fileInput.files[0];
            let filePath = null;
            let fileName = null;

            if (file) {
                const ext = file.name.split('.').pop();
                const safeName = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
                filePath = `${currentUser.id}/${fd.get('fiscal_category')}/${safeName}`;
                fileName = file.name;

                const { error: uploadError } = await supabase.storage
                    .from('fiscal-docs')
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });

                if (uploadError) {
                    console.warn('Upload warning:', uploadError);
                    filePath = null;
                    fileName = null;
                }
            }

            const metadata = {
                user_id: currentUser.id,
                category: fd.get('fiscal_category'),
                client: fd.get('fiscal_client'),
                reference_date: fd.get('fiscal_date'),
                doc_number: fd.get('fiscal_number') || null,
                description: fd.get('fiscal_desc'),
                value: fd.get('fiscal_value') || null,
                status: fd.get('fiscal_status') || 'aberto',
                file_path: filePath,
                file_name: fileName
            };

            const { error: dbError } = await supabase.from('fiscal_documents').insert([metadata]);
            if (dbError) throw dbError;

            hideModal('fiscal-upload');
            form.reset();
            resetDropzone();
            await loadAllData();
            showToast();

        } catch (err) {
            console.error('Fiscal upload error:', err);
            alert('Erro ao salvar documento: ' + err.message);
        } finally {
            textEl.innerText = originalText;
            btn.disabled = false;
        }
    });
}

function showSelectedFile(file) {
    const contentEl = document.getElementById('dropzone-content');
    const infoEl = document.getElementById('dropzone-file-info');
    const nameEl = document.getElementById('dropzone-filename');
    const sizeEl = document.getElementById('dropzone-filesize');

    if (contentEl) contentEl.style.display = 'none';
    if (infoEl) infoEl.style.display = 'flex';
    if (nameEl) nameEl.innerText = file.name;
    if (sizeEl) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeKB = (file.size / 1024).toFixed(0);
        sizeEl.innerText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
    }
    if (window.lucide) window.lucide.createIcons();
}

function resetDropzone() {
    const contentEl = document.getElementById('dropzone-content');
    const infoEl = document.getElementById('dropzone-file-info');
    if (contentEl) contentEl.style.display = 'block';
    if (infoEl) infoEl.style.display = 'none';
    if (window.lucide) window.lucide.createIcons();
}

// Initialize fiscal upload after DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupFiscalUpload, 500);
});

// 10. PWA INSTALLATION LOGIC
let deferredPrompt;
const installContainer = document.getElementById('install-app-container');
const installBtn = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
    // Impede que o mini-infobar apareça no mobile
    e.preventDefault();
    // Salva o evento para ser acionado depois
    deferredPrompt = e;
    // Mostra o botão de instalação (que está escondido por padrão)
    if (installContainer) {
        installContainer.style.display = 'block';
    }
    console.log("PWA: App está pronto para ser instalado.");
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            alert("O aplicativo já está instalado ou não é suportado neste navegador.");
            return;
        }
        
        // Mostra o prompt de instalação nativo
        deferredPrompt.prompt();
        
        // Aguarda a resposta do usuário
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA: Usuário escolheu: ${outcome}`);
        
        // Limpa o prompt para não ser usado novamente
        deferredPrompt = null;
        
        // Esconde o botão se o usuário instalou
        if (outcome === 'accepted') {
            if (installContainer) installContainer.style.display = 'none';
        }
    });
}

// Oculta o botão se o app já estiver instalado
window.addEventListener('appinstalled', (event) => {
    console.log('PWA: App instalado com sucesso!');
    if (installContainer) installContainer.style.display = 'none';
    showToast("Aplicativo instalado com sucesso!");
});

// Verifica se já está rodando como PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log("PWA: Rodando em modo standalone.");
    if (installContainer) installContainer.style.display = 'none';
}

