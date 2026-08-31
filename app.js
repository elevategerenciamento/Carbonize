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
let closedMonths = [];
let userSettings = {
    threshold_carbonizacao: 2,
    threshold_resfriamento: 2,
    threshold_carga: 1
};
let notifications = [];
let isSettingsExpanded = false;
let isNotificationPanelOpen = false;
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
    protectDevTools();

    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('login-screen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';

        // Ativar o PIN Lock Modal com Blur
        document.querySelector('.app-container').classList.add('blur-background');
        document.getElementById('modal-pin-unlock').style.display = 'flex';
        initPinLogic(); // Iniciar lógica dos quadrados de PIN

        await loadAllData();
        initRealtimeSync();
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
    console.log("Carbonize: handleLogin disparado");
    const fd = new FormData(e.target);
    const farmName = fd.get('farm_name');
    const password = fd.get('password');
    const action = e.submitter ? e.submitter.dataset.action : e.target.dataset.action;
    console.log("Carbonize: Ação de autenticação:", action, "Empreendimento:", farmName);

    if (!farmName || !password) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    const sanitizedFarmName = farmName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    const email = `${sanitizedFarmName}@carbonize.com`;

    try {
        if (action === 'signup') {
            console.log("Carbonize: Iniciando signUp para email:", email);
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { farm_name: farmName } }
            });
            if (error) throw error;
            alert("Conta criada! Tente entrar agora.");
        } else {
            console.log("Carbonize: Iniciando signIn para email:", email);
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            location.reload();
        }
    } catch (err) {
        console.error("Carbonize: Erro de autenticação:", err);
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
        const [k, l, h, m, e, f, c, s] = await Promise.all([
            supabase.from('kilns').select('*').eq('user_id', uid),
            supabase.from('loads').select('*').eq('user_id', uid),
            supabase.from('production_history').select('*').eq('user_id', uid),
            supabase.from('maintenance').select('*').eq('user_id', uid),
            supabase.from('expenses').select('*').eq('user_id', uid),
            supabase.from('fiscal_documents').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
            supabase.from('closed_months').select('*').eq('user_id', uid),
            supabase.from('user_settings').select('*').eq('user_id', uid)
        ]);

        if (k.error) console.warn("Erro Kilns:", k.error);
        if (l.error) console.warn("Erro Loads:", l.error);
        if (h.error) console.warn("Erro History:", h.error);
        if (m.error) console.warn("Erro Maintenance:", m.error);
        if (e.error) console.warn("Erro Expenses:", e.error);
        if (f.error) console.warn("Erro Fiscal Docs:", f.error);
        if (c.error) console.warn("Erro Closed Months:", c.error);
        if (s.error) console.warn("Erro User Settings:", s.error);

        kilns = k.data || [];
        loads = l.data || [];
        history = h.data || [];
        maintenance = m.data || [];
        expenses = e.data || [];
        fiscalDocs = f.data || [];
        closedMonths = c.data || [];

        if (s.data && s.data.length > 0) {
            userSettings = s.data[0];
        } else {
            userSettings = {
                threshold_carbonizacao: 2,
                threshold_resfriamento: 2,
                threshold_carga: 1
            };
        }

        // Sincronizar inputs de limites globais na página Central de Alertas
        const inputC = document.getElementById('setting-threshold-c');
        const inputE = document.getElementById('setting-threshold-e');
        const inputX = document.getElementById('setting-threshold-x');
        if (inputC) inputC.value = userSettings.threshold_carbonizacao || 2;
        if (inputE) inputE.value = userSettings.threshold_resfriamento || 2;
        if (inputX) inputX.value = userSettings.threshold_carga || 1;

        console.log("Data loaded:", { kilns, loads, history, maintenance, expenses, fiscalDocs, closedMonths, userSettings });
        renderAll();

        // Calcular e renderizar notificações
        calculateNotifications();
        renderNotifications();
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
        renderAll();
        updateUI();
    }
}

async function saveItems(table, itemsList) {
    if (!currentUser) return;
    const payloads = itemsList.map(item => ({ ...item, user_id: currentUser.id }));

    try {
        const { error } = await supabase.from(table).insert(payloads);
        if (error) throw error;
        await loadAllData();
    } catch (err) {
        console.warn("Modo Offline: Salvando localmente...", err);
        for (const payload of payloads) {
            saveOffline(table, payload);
        }
        showToast("Salvo localmente (Modo Offline)");

        if (table === 'kilns') {
            kilns.push(...payloads.map(p => ({ ...p, id: 'temp-' + Date.now() + Math.random() })));
        }
        renderAll();
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

// RBAC Definitions
const PIN_HASHES = {
    'operacional': 'f795433afccabfcda36925de8c0158c2dca4ccd79a538daadebd206fcce4d3f2',
    'contabil': 'b1bffc9f62cbc5a72c4b6867211fa884d1a8f557f5c7885f8a2f7fa0c211f3f9',
    'financeiro': '0168578f353f7bb90e3b46f17d336232469a3c602c04d058fe1ab62920bce1b5',
    'gestor_carvoaria': '25778c7b9c9983b7b0de179c0ad6d0c04927c704b56672697004b0becf5efd39',
    'admin': '16e01095a53cc5fd7040dd37bdcff310cc0c721e99bc24671e0017ebe63ee11d'
};

const PERMISSIONS = {
    'operacional': ['dashboard', 'fornos', 'cargas', 'alertas', 'analise'],
    'gestor_carvoaria': ['fornos', 'alertas', 'relatorios'],
    'financeiro': ['dashboard', 'dados_fiscais', 'analise', 'relatorios', 'custos'],
    'contabil': ['dashboard', 'dados_fiscais', 'analise', 'relatorios'],
    'admin': ['dashboard', 'fornos', 'cargas', 'alertas', 'dados_fiscais', 'analise', 'custos', 'relatorios']
};

function applyNavigationPermissions(role) {
    const allowedTabs = PERMISSIONS[role] || PERMISSIONS.admin;
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        const tabId = link.getAttribute('onclick')?.match(/switchTab\('([^']+)'/)?.[1];
        link.style.display = !tabId || allowedTabs.includes(tabId) ? '' : 'none';
    });
}

function switchTab(tabId) {
    const role = (currentUser && currentUser.user_metadata && currentUser.user_metadata.role) ? currentUser.user_metadata.role : 'admin';
    const allowedTabs = PERMISSIONS[role] || PERMISSIONS['admin'];

    let targetSection = tabId;
    if (!allowedTabs.includes(tabId)) {
        targetSection = 'acesso-negado';
    }

    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    const sectionEl = document.getElementById(`section-${targetSection}`);
    if (sectionEl) sectionEl.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`button[onclick*="switchTab('${tabId}')"]`).forEach(l => l.classList.add('active'));

    if (targetSection === 'analise' || targetSection === 'dashboard') renderCharts();
    if (targetSection === 'fornos') initSpreadsheet();
    if (targetSection === 'relatorios') applyReportPermissions(role);
    if (targetSection === 'acesso-negado' && window.lucide) window.lucide.createIcons();
}

function applyReportPermissions(role) {
    const allowedReports = role === 'gestor_carvoaria' ? ['kilns', 'alerts'] : null;
    document.querySelectorAll('.report-card').forEach(card => {
        const reportType = card.dataset.reportType || card.querySelector('[onclick*="generateReport"]')?.getAttribute('onclick')?.match(/generateReport\('([^']+)'/)?.[1];
        card.style.display = !allowedReports || allowedReports.includes(reportType) ? '' : 'none';
    });
    if (window.lucide) window.lucide.createIcons();
}

function showModal(id) {
    document.getElementById(`modal-${id}`).style.display = 'flex';
    if (id === 'settings') {
        document.getElementById('settings-enterprise').value = currentUser.user_metadata.farm_name || "";
        document.getElementById('settings-operator').value = currentUser.user_metadata.operator_name || "";
        const roleSelect = document.getElementById('settings-role');
        if (roleSelect) roleSelect.value = currentUser.user_metadata.role || "admin";
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
    updateSpreadsheetSelects();
    renderOperationalAlerts();
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
            <div class="asset-pill" onclick="openEditKilnModal('${k.praca}')" style="cursor: pointer;" title="Configurar Forno ${k.praca}">
                <i data-lucide="container"></i>
                <div class="info">
                    <h6>Forno ${k.praca}</h6>
                </div>
            </div>
        `).join('');
    }

    if (select) {
        select.innerHTML = '<option value="">Selecione...</option>' + kilns.map(k => `<option value="${k.praca}">${k.praca}</option>`).join('');
    }

    if (maintSelect) {
        maintSelect.innerHTML = '<option value="">Selecione...</option>' + kilns.map(k => `<option value="${k.praca}">${k.praca}</option>`).join('');
    }

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

    // Render spreadsheet grid
    renderSpreadsheetGrid();
}

function renderLoads() {
    const tbody = document.getElementById('loads-table-body');
    if (tbody) {
        tbody.innerHTML = loads.map(l => `
            <tr>
                <td>#${l.identificador}</td>
                <td>${l.data ? formatDateBR(l.data) : ''} ${l.hora || ''}</td>
                <td>${l.destino || '-'}</td>
                <td>${l.data_descarregamento ? formatDateBR(l.data_descarregamento) : '-'}</td>
                <td>${l.metragem ? l.metragem + ' m³' : '-'}</td>
                <td>${l.peso ? Number(l.peso).toLocaleString('pt-BR') + ' kg' : '-'}</td>
                <td>${l.motorista || '-'}</td>
                <td>${l.placa || '-'}</td>
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
    const { error } = await supabase.from('maintenance').update({ resolved: true }).eq('id', id).eq('user_id', currentUser.id);
    if (error) throw error;
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

    // Filtra para pegar apenas os gastos gerais (sem planilha rápida)
    const generalExpenses = expenses.filter(e => !e.spreadsheet_name);

    const total = generalExpenses.reduce((acc, e) => acc + Number(e.expense_value || 0), 0);
    if (totalEl) totalEl.innerText = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    if (list) {
        if (generalExpenses.length === 0) {
            list.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-dim);">Nenhum lançamento encontrado.</td></tr>';
            return;
        }

        const totalPages = Math.ceil(generalExpenses.length / ITEMS_PER_PAGE);
        if (expensesPage > totalPages) expensesPage = totalPages || 1;

        const start = (expensesPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = generalExpenses.slice(start, end);

        list.innerHTML = pageItems.map(e => `
            <tr>
                <td>${e.expense_date}</td>
                <td>${e.expense_desc || '-'}</td>
                <td>${e.payment_method}${e.payment_method === 'Cartão' && e.installments && Number(e.installments) > 1 ? ` (${e.installments}x)` : ''}</td>
                <td><span class="status-badge ${e.expense_status === 'Pendente' ? 'warning' : 'success'}" style="font-size:9px; padding:2px 6px; border-radius:6px;">${e.expense_status || 'Quitado'}</span></td>
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
        const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', currentUser.id);
        if (error) throw error;
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
    if (form.querySelector('[name="expense_status"]')) {
        form.querySelector('[name="expense_status"]').value = e.expense_status || 'Quitado';
    }
    if (form.querySelector('[name="spreadsheet_name"]')) {
        form.querySelector('[name="spreadsheet_name"]').value = e.spreadsheet_name || '';
    }

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
                        btn.disabled = false;
                        if (id === 'expense') {
                            const expenseId = document.getElementById('edit-expense-id').value;
                            btn.innerText = expenseId ? "Atualizar Lançamento" : "Salvar Lançamento";
                        } else {
                            btn.innerText = originalText;
                        }
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
    if (id === 'kiln') {
        const quantityValue = String(fd.get('kiln_quantity') || '').trim();
        const pracaInput = String(fd.get('praca') || '').trim();
        const quantity = Number(quantityValue);
        let pracasToRegister = [];

        // A quantidade cria automaticamente a sequência 1..N em um único cadastro.
        if (quantityValue && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10000) {
            for (let i = 1; i <= quantity; i++) {
                pracasToRegister.push(i.toString());
            }
        } else if (pracaInput) {
            // Mantém o cadastro manual para números específicos ou intervalos personalizados.
            if (pracaInput.includes(',')) {
                pracasToRegister = pracaInput.split(',').map(s => s.trim()).filter(Boolean);
            } else if (pracaInput.includes('-')) {
                const [startStr, endStr] = pracaInput.split('-');
                const start = parseInt(startStr.trim());
                const end = parseInt(endStr.trim());
                if (!isNaN(start) && !isNaN(end)) {
                    const min = Math.min(start, end);
                    const max = Math.max(start, end);
                    for (let i = min; i <= max; i++) {
                        pracasToRegister.push(i.toString());
                    }
                }
            } else {
                pracasToRegister.push(pracaInput);
            }
        } else {
            throw new Error('Informe uma quantidade inteira entre 1 e 10.000.');
        }

        pracasToRegister = pracasToRegister.filter((v, i, self) => self.indexOf(v) === i);

        const existingPracas = kilns.map(k => k.praca);
        const newPracas = pracasToRegister.filter(p => !existingPracas.includes(p));

        if (newPracas.length === 0) {
            showToast("Nenhum forno novo para cadastrar.");
            return;
        }

        const payloads = newPracas.map(p => ({ praca: p }));
        await saveItems('kilns', payloads);
        showToast(`${newPracas.length} forno(s) cadastrado(s)!`);
    }
    if (id === 'kiln-daily') {
        const item = { data: fd.get('data_lancamento'), responsavel: fd.get('responsavel'), praca: fd.get('praca_select'), vazios: fd.get('vazios'), cheios: fd.get('cheios'), carbonizando: fd.get('carbonizando'), esfriando: fd.get('esfriando'), obs: fd.get('obs') };
        await saveItem('production_history', item);
        if (item.obs) await saveItem('maintenance', { forno: item.praca, problema: item.obs, data: item.data, resolved: false });
    }
    if (id === 'load') await saveItem('loads', {
        identificador: fd.get('identificador'),
        data: fd.get('data_carga'),
        hora: fd.get('hora_carga'),
        placa: fd.get('placa'),
        motorista: fd.get('motorista'),
        tipo_carvao: fd.get('tipo_carvao'),
        metragem: fd.get('metragem'),
        peso: fd.get('peso'),
        destino: fd.get('destino'),
        data_descarregamento: fd.get('data_descarregamento')
    });
    if (id === 'expense') {
        const expenseId = fd.get('expense_id');
        const item = {
            expense_date: fd.get('expense_date'),
            expense_category: fd.get('expense_category'),
            expense_desc: fd.get('expense_desc'),
            expense_value: fd.get('expense_value'),
            expense_quantity: fd.get('expense_quantity') || 1,
            payment_method: fd.get('payment_method'),
            installments: fd.get('payment_method') === 'Cartão' ? fd.get('installments') : null,
            expense_status: fd.get('expense_status') || 'Quitado',
            spreadsheet_name: fd.get('spreadsheet_name') || null
        };

        if (expenseId) {
            const { error } = await supabase.from('expenses').update(item).eq('id', expenseId).eq('user_id', currentUser.id);
            if (error) throw error;
            document.getElementById('edit-expense-id').value = '';
            document.getElementById('btn-save-expense').innerText = "Salvar Lançamento";
            document.getElementById('btn-save-expense').style.background = "";
            if (document.getElementById('expense-spreadsheet-select')) {
                document.getElementById('expense-spreadsheet-select').value = '';
            }
            await loadAllData();
        } else {
            await saveItem('expenses', item);
        }
    }
    if (id === 'maintenance') await saveItem('maintenance', { forno: fd.get('kiln_target'), problema: fd.get('problema'), data: fd.get('repair_date'), cost: fd.get('cost'), resolved: false });
    if (id === 'settings') {
        await supabase.auth.updateUser({
            data: {
                farm_name: fd.get('enterprise_name'),
                operator_name: fd.get('operator_name'),
                role: fd.get('user_role')
            }
        });
        location.reload();
    }
}

let prodChartInstance = null;
let loadsChartInstance = null;
let efficiencyChartInstance = null;
let costsDistChartInstance = null;
let cashFlowChartInstance = null;
let cashFlowChartDashInstance = null;

// ── Helpers de data para os gráficos ─────────────────────────────
function getLastNDaysISO(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

function weekdayLabelShort(dateStr) {
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const parts = dateStr.split('-').map(Number);
    return labels[new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
}

function getLastNWeeksRanges(n) {
    const weeks = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        weeks.push({
            label: 'S' + (n - i),
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
    }
    return weeks;
}

function buildCashFlowConfig(last7, despesasPorDia, receitasPorDia) {
    return {
        type: 'line',
        data: {
            labels: last7.map(weekdayLabelShort),
            datasets: [
                {
                    label: 'Receitas (est.)',
                    data: receitasPorDia,
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.12)',
                    fill: true, tension: 0.45,
                    pointBackgroundColor: '#00e676', pointRadius: 4, pointHoverRadius: 7
                },
                {
                    label: 'Despesas',
                    data: despesasPorDia,
                    borderColor: PRIMARY_COLOR,
                    backgroundColor: 'rgba(230, 0, 46, 0.12)',
                    fill: true, tension: 0.45,
                    pointBackgroundColor: PRIMARY_COLOR, pointRadius: 4, pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, labels: { color: '#94949e', font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function(c) {
                            return c.dataset.label + ': R$ ' + c.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94949e' } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94949e',
                        callback: function(v) {
                            return 'R$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Number(v).toFixed(0));
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    };
}

function renderCharts() {
    var ctx1 = document.getElementById('prodChart');
    var ctx2 = document.getElementById('loadsChart');
    var ctx3 = document.getElementById('efficiencyChart');
    var ctx4 = document.getElementById('costsDistChart');
    var ctxCash = document.getElementById('cashFlowChart');
    var ctxCashDash = document.getElementById('cashFlowChartDash');

    if (prodChartInstance) { prodChartInstance.destroy(); prodChartInstance = null; }
    if (loadsChartInstance) { loadsChartInstance.destroy(); loadsChartInstance = null; }
    if (efficiencyChartInstance) { efficiencyChartInstance.destroy(); efficiencyChartInstance = null; }
    if (costsDistChartInstance) { costsDistChartInstance.destroy(); costsDistChartInstance = null; }
    if (cashFlowChartInstance) { cashFlowChartInstance.destroy(); cashFlowChartInstance = null; }
    if (cashFlowChartDashInstance) { cashFlowChartDashInstance.destroy(); cashFlowChartDashInstance = null; }

    // ── 1. PRODUÇÃO REAL — últimas 4 semanas ─────────────────
    if (ctx1) {
        var weeks = getLastNWeeksRanges(4);
        var prodData = weeks.map(function(w) {
            return history
                .filter(function(h) { return h && h.data && h.data >= w.start && h.data <= w.end; })
                .reduce(function(acc, h) { return acc + Number(h.carbonizando || 0) * 1.5; }, 0);
        });
        prodChartInstance = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: weeks.map(function(w) { return w.label; }),
                datasets: [{
                    label: 'Produção (t)',
                    data: prodData,
                    borderColor: PRIMARY_COLOR,
                    backgroundColor: 'rgba(230, 0, 46, 0.12)',
                    fill: true, tension: 0.4,
                    pointBackgroundColor: PRIMARY_COLOR,
                    pointRadius: 4, pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return c.parsed.y.toFixed(2) + ' t'; } } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94949e' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94949e', callback: function(v) { return Number(v).toFixed(0) + 't'; } }, beginAtZero: true }
                }
            }
        });
    }

    // ── 2. CARGAS REAIS — últimos 7 dias ────────────────────
    if (ctx2) {
        var last7 = getLastNDaysISO(7);
        var loadsData = last7.map(function(day) {
            return loads.filter(function(l) { return l && l.data === day; }).length;
        });
        loadsChartInstance = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: last7.map(weekdayLabelShort),
                datasets: [{
                    label: 'Cargas',
                    data: loadsData,
                    backgroundColor: 'rgba(230, 0, 46, 0.7)',
                    borderColor: PRIMARY_COLOR,
                    borderWidth: 1, borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return c.parsed.y + (c.parsed.y !== 1 ? ' cargas' : ' carga'); } } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94949e' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94949e', stepSize: 1, precision: 0 }, beginAtZero: true }
                }
            }
        });
    }

    // ── 3. RADAR DE EFICIÊNCIA REAL ──────────────────────────
    if (ctx3) {
        var totalDays = Math.max(1, history.map(function(h) { return h.data; }).filter(Boolean).filter(function(v, i, a) { return a.indexOf(v) === i; }).length);
        var totalCarb = history.reduce(function(a, h) { return a + Number(h.carbonizando || 0); }, 0);
        var avgCarb = totalCarb / totalDays;
        var velocidade = Math.min(100, Math.round((avgCarb / 20) * 100));

        var totalStatus = history.reduce(function(a, h) {
            return a + Number(h.vazios || 0) + Number(h.cheios || 0) + Number(h.carbonizando || 0) + Number(h.esfriando || 0);
        }, 0);
        var qualidade = totalStatus > 0 ? Math.min(100, Math.round((totalCarb / totalStatus) * 200)) : 0;

        var totalExp = expenses.filter(function(e) { return !(e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha'); })
            .reduce(function(a, e) { return a + Number(e.expense_value || 0); }, 0);
        var totalProd = history.reduce(function(a, h) { return a + Number(h.carbonizando || 0) * 1.5; }, 0);
        var custoPorTon = totalProd > 0 ? totalExp / totalProd : 0;
        var custoScore = Math.min(100, Math.max(0, Math.round(100 - (custoPorTon / 300) * 100)));

        var totalMaint = maintenance.length;
        var resolved = maintenance.filter(function(m) { return m.resolved; }).length;
        var manutScore = totalMaint > 0 ? Math.round((resolved / totalMaint) * 100) : 100;

        var pendentes = maintenance.filter(function(m) { return !m.resolved; }).length;
        var segScore = Math.min(100, Math.max(0, Math.round(100 - (pendentes / 10) * 100)));

        efficiencyChartInstance = new Chart(ctx3, {
            type: 'radar',
            data: {
                labels: ['Velocidade', 'Qualidade', 'Custo', 'Manutenção', 'Segurança'],
                datasets: [{
                    label: 'Score Atual',
                    data: [velocidade, qualidade, custoScore, manutScore, segScore],
                    backgroundColor: 'rgba(230, 0, 46, 0.2)',
                    borderColor: PRIMARY_COLOR,
                    pointBackgroundColor: PRIMARY_COLOR, pointRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 0, max: 100,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        angleLines: { color: 'rgba(255,255,255,0.1)' },
                        pointLabels: { color: '#94949e', font: { size: 11 } },
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: function(c) { return c.label + ': ' + c.parsed.r + '%'; } } }
                }
            }
        });
    }

    // ── 4. DISTRIBUIÇÃO DE CUSTOS REAL por categoria ─────────
    if (ctx4) {
        var catMap = { 'Lenha': 0, 'Mão de Obra': 0, 'Logística': 0, 'Manutenção': 0, 'Outros': 0 };
        expenses.forEach(function(e) {
            if (e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha') return;
            var cat = e.expense_category || 'Outros';
            if (!catMap.hasOwnProperty(cat)) cat = 'Outros';
            catMap[cat] += Number(e.expense_value || 0);
        });
        maintenance.forEach(function(m) { catMap['Manutenção'] += Number(m.cost || 0); });

        var catLabels = Object.keys(catMap).filter(function(k) { return catMap[k] > 0; });
        var catData = catLabels.map(function(k) { return catMap[k]; });
        var catColors = ['#e6002e', '#00d2ff', '#00e676', '#ffea00', '#ff6b35'];

        costsDistChartInstance = new Chart(ctx4, {
            type: 'doughnut',
            data: {
                labels: catLabels.length > 0 ? catLabels : ['Sem dados'],
                datasets: [{
                    data: catData.length > 0 ? catData : [1],
                    backgroundColor: catData.length > 0 ? catColors.slice(0, catLabels.length) : ['rgba(255,255,255,0.05)'],
                    borderWidth: 2, borderColor: '#0f0f12'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94949e', font: { size: 10 },
                            generateLabels: function(chart) {
                                var ds = chart.data.datasets[0];
                                return chart.data.labels.map(function(lbl, i) {
                                    return {
                                        text: catData.length > 0
                                            ? lbl + ': R$' + ds.data[i].toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                                            : lbl,
                                        fillStyle: ds.backgroundColor[i],
                                        hidden: false, index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        enabled: catData.length > 0,
                        callbacks: {
                            label: function(c) {
                                var total = c.dataset.data.reduce(function(a, b) { return a + b; }, 0);
                                var pct = total > 0 ? ((c.parsed / total) * 100).toFixed(1) : 0;
                                return ' R$ ' + c.parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    // ── 5 & 6. FLUXO DE CAIXA REAL — últimos 7 dias ─────────
    var last7cf = getLastNDaysISO(7);
    var despesasPorDia = last7cf.map(function(day) {
        return expenses
            .filter(function(e) { return e && e.expense_date === day && !(e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha'); })
            .reduce(function(a, e) { return a + Number(e.expense_value || 0); }, 0);
    });
    var receitasPorDia = last7cf.map(function(day) {
        return loads
            .filter(function(l) { return l && l.data === day; })
            .reduce(function(a, l) { return a + (Number(l.peso || 0) / 1000) * 500; }, 0);
    });

    if (ctxCash) {
        cashFlowChartInstance = new Chart(ctxCash, buildCashFlowConfig(last7cf, despesasPorDia, receitasPorDia));
    }
    if (ctxCashDash) {
        cashFlowChartDashInstance = new Chart(ctxCashDash, buildCashFlowConfig(last7cf, despesasPorDia, receitasPorDia));
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
window.initSpreadsheetsModal = initSpreadsheetsModal;
window.showSpreadsheetsList = showSpreadsheetsList;
window.showCreateSpreadsheet = showCreateSpreadsheet;
window.saveNewSpreadsheet = saveNewSpreadsheet;
window.viewSpreadsheet = viewSpreadsheet;
window.deleteSpreadsheetExpense = deleteSpreadsheetExpense;
window.renameCurrentSpreadsheet = renameCurrentSpreadsheet;
window.deleteCurrentSpreadsheet = deleteCurrentSpreadsheet;
window.updateSpreadsheetSelects = updateSpreadsheetSelects;
// 9. PREMIUM REPORT ENGINE
function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function getReportDateRange(type) {
    const typeMap = { 'loads': 'loads', 'pracas': 'pracas', 'kilns': 'kilns', 'alerts': 'alerts', 'maint': 'maint', 'expenses': 'expenses' };
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

    let typeLabel = {
        'loads': 'EXPEDICAO',
        'pracas': 'PRODUCAO',
        'kilns': 'FORNOS',
        'alerts': 'ALERTAS_OPERACIONAIS',
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
            headers: ["Nº ID", "Data", "Hora", "Veículo / Placa", "Motorista", "Tipo de Carvão", "Metragem (m³)", "Peso (kg)", "Destino", "Descarregamento"],
            rows: filtered.map(l => [
                l.identificador || '-',
                formatDateBR(l.data),
                l.hora || '-',
                l.placa || '-',
                l.motorista || '-',
                l.tipo_carvao || 'Eucalipto',
                l.metragem || '0',
                Number(l.peso || 0).toLocaleString('pt-BR'),
                l.destino || '-',
                l.data_descarregamento ? formatDateBR(l.data_descarregamento) : '-'
            ]),
            footer: `Peso Total Expedido: ${totalPeso.toLocaleString('pt-BR')} kg | Metragem Total: ${totalMetragem.toFixed(1)} m³`,
            totalRow: [
                "TOTAL",
                "",
                "",
                "",
                "",
                "",
                totalMetragem.toFixed(1),
                totalPeso.toLocaleString('pt-BR'),
                "",
                ""
            ]
        };
    }

    // ─── FORNOS ───
    else if (type === 'kilns') {
        const filtered = filterByDateRange(history, 'data', start, end);
        const totalCarbonizando = filtered.reduce((a, h) => a + Number(h.carbonizando || 0), 0);
        const totalCheios = filtered.reduce((a, h) => a + Number(h.cheios || 0), 0);
        const totalEsfriando = filtered.reduce((a, h) => a + Number(h.esfriando || 0), 0);
        const totalVazios = filtered.reduce((a, h) => a + Number(h.vazios || 0), 0);
        const unidades = [...new Set(filtered.map(h => h.praca).filter(Boolean))];
        reportConfig = {
            title: "RELATÓRIO DE FORNOS E OPERAÇÃO",
            subtitle: "Acompanhamento de Ciclos e Ocupação Operacional",
            summaryItems: [
                { label: "Registros no Período", value: filtered.length },
                { label: "Fornos Monitorados", value: unidades.length },
                { label: "Em Carbonização", value: totalCarbonizando },
                { label: "Fornos Carregados", value: totalCheios }
            ],
            headers: ["Data", "Responsável", "Forno", "Vazios", "Cheios", "Carbonização", "Resfriamento", "Observações"],
            rows: filtered.map(h => [formatDateBR(h.data), h.responsavel || '-', h.praca || '-', h.vazios || '0', h.cheios || '0', h.carbonizando || '0', h.esfriando || '0', h.obs || '-']),
            footer: `Resumo operacional: ${totalCarbonizando} em carbonização | ${totalCheios} carregados | ${totalEsfriando} em resfriamento`,
            totalRow: ["TOTAL", "", "", totalVazios, totalCheios, totalCarbonizando, totalEsfriando, ""]
        };
    }

    // ─── ALERTAS OPERACIONAIS ───
    else if (type === 'alerts') {
        calculateNotifications();
        const filtered = notifications
            .filter(n => n && n.lastUpdated && n.lastUpdated >= start && n.lastUpdated <= end)
            .sort((a, b) => b.delayDays - a.delayDays || String(a.praca).localeCompare(String(b.praca), 'pt-BR', { numeric: true }));
        const critical = filtered.filter(n => n.severity === 'red').length;
        const recurrent = filtered.filter(n => n.isRecurrent).length;
        const totalDelay = filtered.reduce((total, n) => total + Number(n.delayDays || 0), 0);
        reportConfig = {
            title: "RELATÓRIO DE ALERTAS OPERACIONAIS",
            subtitle: "Acompanhamento de atrasos, prioridades e recorrência por forno",
            summaryItems: [
                { label: "Alertas no Período", value: filtered.length },
                { label: "Prioridade Crítica", value: critical },
                { label: "Alertas Recorrentes", value: recurrent },
                { label: "Dias Acumulados de Atraso", value: totalDelay }
            ],
            headers: ["Forno", "Estágio", "Início do Estágio", "Dias no Estágio", "Limite", "Atraso", "Prioridade", "Recorrência"],
            rows: filtered.map(n => [
                n.praca || '-', n.stageName || '-', formatDateBR(n.lastUpdated), n.consecutiveDays || 0,
                `${n.threshold || 0} dias`, `${n.delayDays || 0} dias`,
                n.severity === 'red' ? 'Crítica' : 'Atenção', n.isRecurrent ? 'Sim' : 'Não'
            ]),
            footer: `Monitoramento operacional: ${critical} alerta(s) crítico(s) | ${recurrent} recorrente(s) | ${totalDelay} dia(s) de atraso acumulado`,
            totalRow: ["TOTAL", "", "", "", "", `${totalDelay} dias`, `${critical} crítico(s)`, ""]
        };
    }

    // ─── GERENCIAMENTO DE CARVOARIA (LEGADO) ───
    else if (type === 'carvoaria') {
        const alertas = notifications.filter(n => n && n.praca);
        const filteredMaint = filterByDateRange(maintenance, 'data', start, end);
        const pendentes = filteredMaint.filter(m => !m.resolved).length;
        const resolvidos = filteredMaint.filter(m => m.resolved).length;
        const custoManutencao = filteredMaint.reduce((a, m) => a + Number(m.cost || 0), 0);
        reportConfig = {
            title: "RELATÓRIO DE GERENCIAMENTO DE CARVOARIA",
            subtitle: "Visão Executiva de Alertas, Pendências e Manutenção",
            summaryItems: [
                { label: "Alertas Ativos", value: alertas.length },
                { label: "Manutenções no Período", value: filteredMaint.length },
                { label: "Pendências", value: pendentes },
                { label: "Custo de Manutenção", value: `R$ ${custoManutencao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` }
            ],
            headers: ["Data", "Forno", "Ocorrência / Serviço", "Status", "Custo (R$)"],
            rows: filteredMaint.map(m => [formatDateBR(m.data), m.forno || '-', m.problema || '-', m.resolved ? 'Resolvido' : 'Pendente', `R$ ${Number(m.cost || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`]),
            footer: `Gestão operacional: ${alertas.length} alertas ativos | ${pendentes} pendências | ${resolvidos} serviços concluídos`,
            totalRow: ["TOTAL", "", "", `${resolvidos} resolvidos / ${pendentes} pendentes`, `R$ ${custoManutencao.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`]
        };
    }

    // ─── PRODUÇÃO ───
    else if (type === 'pracas') {
        const filtered = filterByDateRange(history, 'data', start, end);
        const totalCarbonizando = filtered.reduce((a, h) => a + Number(h.carbonizando || 0), 0);
        const totalProd = totalCarbonizando * 1.5;
        const unidades = [...new Set(filtered.map(h => h.praca))];
        const totalVazios = filtered.reduce((a, h) => a + Number(h.vazios || 0), 0);
        const totalCheios = filtered.reduce((a, h) => a + Number(h.cheios || 0), 0);
        const totalEsfriando = filtered.reduce((a, h) => a + Number(h.esfriando || 0), 0);

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
            footer: `Produção Estimada no Período: ${totalProd.toFixed(1)} toneladas`,
            totalRow: [
                "TOTAL",
                "",
                "",
                totalVazios,
                totalCheios,
                totalCarbonizando,
                totalEsfriando,
                `Prod. Est.: ${totalProd.toFixed(1)} t`
            ]
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
            footer: `Custo Total de Manutenção: R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            totalRow: [
                "TOTAL",
                "",
                "",
                `R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                ""
            ]
        };
    }

    // ─── CUSTOS ───
    else if (type === 'expenses') {
        const filterInput = document.getElementById('report-expenses-filter');
        const filterText = filterInput ? filterInput.value.trim() : '';
        const sheetFilter = document.getElementById('report-expenses-spreadsheet').value;

        let filtered = filterByDateRange(expenses, 'expense_date', start, end)
            .filter(e => !(e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha'));
        if (sheetFilter) {
            filtered = filtered.filter(e => e.spreadsheet_name === sheetFilter);
            typeLabel = `GASTOS_${sheetFilter.toUpperCase().replace(/\s+/g, '_')}`;
        } else {
            // Se nenhuma planilha estiver selecionada, mostre apenas os custos avulsos (sem planilha)
            filtered = filtered.filter(e => !e.spreadsheet_name);
            typeLabel = `GASTOS_GERAIS`;
        }
        if (filterText) {
            const lowerFilterText = filterText.toLowerCase();
            filtered = filtered.filter(e => e.expense_desc && e.expense_desc.toLowerCase().includes(filterText));
            if (!sheetFilter) {
                typeLabel = `GASTOS_GERAIS_${filterText.toUpperCase().replace(/\s+/g, '_')}`;
            }
        }

        const total = filtered.reduce((a, e) => a + Number(e.expense_value || 0), 0);
        const totalQtd = filtered.reduce((a, e) => a + Number(e.expense_quantity || 1), 0);
        const totalQuitados = filtered.filter(e => (e.expense_status || 'Quitado') === 'Quitado').reduce((a, e) => a + Number(e.expense_value || 0), 0);
        const totalPendentes = filtered.filter(e => e.expense_status === 'Pendente').reduce((a, e) => a + Number(e.expense_value || 0), 0);

        let reportTitle = "RELATÓRIO DE GASTOS GERAIS";
        let reportSubtitle = "Análise Financeira de Gastos Gerais (Sem Planilhas Rápidas)";
        if (sheetFilter) {
            reportTitle = `RELATÓRIO DE CUSTOS: ${sheetFilter.toUpperCase()}`;
            reportSubtitle = `Planilha de Custos Vinculada: ${sheetFilter}`;
        }
        if (filterText) {
            reportSubtitle += ` | Filtro: "${filterText}"`;
        }

        reportConfig = {
            title: reportTitle,
            subtitle: reportSubtitle,
            summaryItems: [
                { label: "Total de Lançamentos", value: filtered.length },
                { label: "Custo Total", value: `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` },
                { label: "Total Quitado", value: `R$ ${totalQuitados.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` },
                { label: "Total Pendente", value: `R$ ${totalPendentes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` }
            ],
            headers: ["Data", "Descrição", "Pagamento", "Status", "Qtd", "Valor (R$)"],
            rows: filtered.map(e => [
                formatDateBR(e.expense_date),
                e.expense_desc || '-',
                e.payment_method === 'Cartão' && e.installments && Number(e.installments) > 1 ? `${e.payment_method} (${e.installments}x)` : (e.payment_method || '-'),
                e.expense_status || 'Quitado',
                Number(e.expense_quantity || 1).toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
                `R$ ${Number(e.expense_value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
            ]),
            footer: `Total: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Quitados: R$ ${totalQuitados.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Pendentes: R$ ${totalPendentes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            totalRows: [
                [
                    "TOTAL GERAL", "", "", "", totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 }), `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                ],
                [
                    "SUBTOTAL QUITADOS", "", "", "", "", `R$ ${totalQuitados.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                ],
                [
                    "SUBTOTAL PENDENTES", "", "", "", "", `R$ ${totalPendentes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                ]
            ]
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
            footer: `Valor Total no Período: R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            totalRow: [
                "TOTAL",
                "",
                "",
                "",
                "",
                `R$ ${totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                ""
            ]
        };
    }

    if (reportConfig.rows.length === 0) {
        alert("Nenhum registro encontrado no período selecionado.");
        return;
    }

    // Perguntar ao usuário o nome do arquivo
    let defaultFileName = `CARBONIZE_${typeLabel}_${formatDateBR(start)}_a_${formatDateBR(end)}`;
    let finalFileName = defaultFileName;
    const userFileName = prompt("Deseja definir um nome personalizado para o arquivo do relatório?\n(Deixe em branco ou cancele para usar o nome padrão)", "");
    if (userFileName !== null && userFileName.trim() !== "") {
        finalFileName = userFileName.trim();
        reportConfig.title = finalFileName.toUpperCase();
    }

    // ════════════════════════════════════
    //  EXPORTAÇÃO XLS (SpreadsheetML com estilo)
    // ════════════════════════════════════
    if (format === 'excel') {
        const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        // Estilos: 0=normal, 1=cabeçalho (azul/branco/negrito), 2=zebra clara, 3=total (negrito, bordas e fundo cinza claro)
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
            <Style ss:ID="s3">
                <Alignment ss:Vertical="Center" ss:WrapText="0"/>
                <Borders>
                    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
                    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="2" ss:Color="#000000"/>
                    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
                </Borders>
                <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
                <Interior ss:Color="#EAEAEA" ss:Pattern="Solid"/>
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

        // Linha de total
        let totalRowXml = '';
        if (reportConfig.totalRows) {
            totalRowXml = reportConfig.totalRows.map(row =>
                `<Row ss:Height="20">${row.map(cell => `<Cell ss:StyleID="s3"><Data ss:Type="String">${esc(cell)}</Data></Cell>`).join('')}</Row>`
            ).join('');
        } else if (reportConfig.totalRow) {
            totalRowXml = `<Row ss:Height="20">
                ${reportConfig.totalRow.map(cell => `<Cell ss:StyleID="s3"><Data ss:Type="String">${esc(cell)}</Data></Cell>`).join('')}
            </Row>`;
        }

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
            ${totalRowXml}
        </Table>
    </Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = finalFileName.toLowerCase().endsWith('.xls') ? '' : '.xls';
        link.download = `${finalFileName}${extension}`;
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



    const extension = finalFileName.toLowerCase().endsWith('.pdf') ? '' : '.pdf';
    doc.save(`${finalFileName}${extension}`);
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
        const { error: storageError } = await supabase.storage.from('fiscal-docs').remove([doc.file_path]);
        if (storageError) console.warn('Erro ao remover arquivo do storage:', storageError);
    }

    const { error } = await supabase.from('fiscal_documents').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) throw error;
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


// 10. PIN AUTHENTICATION SYSTEM

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function protectDevTools() {
    // Disable right click
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Disable F12 and keyboard shortcuts for inspection
    document.addEventListener('keydown', e => {
        if (e.key === 'F12') {
            e.preventDefault();
        }
        if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
            e.preventDefault();
        }
        if (e.ctrlKey && e.key.toUpperCase() === 'U') {
            e.preventDefault();
        }
        // Mac shortcuts (Cmd + Opt + I / J / C)
        if (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
            e.preventDefault();
        }
    });
}

function initPinLogic() {
    const inputs = document.querySelectorAll('.pin-input');
    const select = document.getElementById('pin-role-select');

    // Auto-focus next input
    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            if(e.target.value.length > 1) {
                e.target.value = e.target.value.slice(0,1);
            }
            if(e.target.value.length === 1 && idx < inputs.length - 1) {
                inputs[idx + 1].focus();
            }
            checkPinSubmit();
        });
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                inputs[idx - 1].focus();
                inputs[idx - 1].value = '';
            }
        });
    });

    async function checkPinSubmit() {
        const val = Array.from(inputs).map(i => i.value).join('');
        if(val.length === 6) {
            const role = select.value;
            if(!role) {
                showPinError('Selecione um perfil primeiro!');
                return;
            }
            const hash = await sha256(val);
            if(hash === PIN_HASHES[role]) {
                // Success - Unlock
                document.getElementById('modal-pin-unlock').style.display = 'none';
                document.querySelector('.app-container').classList.remove('blur-background');

                // Override currentUser role for this session
                if(!currentUser.user_metadata) currentUser.user_metadata = {};
                currentUser.user_metadata.role = role;

                // Apply permissions
                applyNavigationPermissions(role);
                switchTab(PERMISSIONS[role][0]);
                updateUI();
            } else {
                showPinError('PIN incorreto. Tente novamente.');
            }
        }
    }

    function showPinError(msg) {
        document.getElementById('pin-error-msg').innerText = msg;
        const container = document.getElementById('pin-inputs-container');
        container.classList.add('shake');
        inputs.forEach(i => i.value = '');
        inputs[0].focus();
        setTimeout(() => {
            container.classList.remove('shake');
            document.getElementById('pin-error-msg').innerText = '';
        }, 1500);
    }

    const sheetExpenseForm = document.getElementById('form-spreadsheet-expense');
    if (sheetExpenseForm) {
        sheetExpenseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn ? btn.innerText : "Adicionar Lançamento";
            if (btn) {
                btn.innerText = "Processando...";
                btn.disabled = true;
            }

            const fd = new FormData(e.target);
            const expenseId = fd.get('expense_id');
            const item = {
                expense_date: fd.get('expense_date'),
                expense_category: fd.get('expense_category'),
                expense_desc: fd.get('expense_desc'),
                expense_value: fd.get('expense_value'),
                expense_quantity: Number(fd.get('expense_quantity') || 1),
                payment_method: fd.get('payment_method'),
                expense_status: fd.get('expense_status') || 'Quitado',
                spreadsheet_name: currentSpreadsheetName
            };

            try {
                if (expenseId) {
                    const { error } = await supabase.from('expenses').update(item).eq('id', expenseId).eq('user_id', currentUser.id);
                    if (error) throw error;
                    document.getElementById('edit-sheet-expense-id').value = '';
                    document.getElementById('sheet-expense-form-title').innerText = "Adicionar Lançamento na Planilha";
                    const saveBtn = document.getElementById('btn-save-sheet-expense');
                    saveBtn.innerHTML = `<i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Adicionar`;
                    saveBtn.style.background = "";
                } else {
                    await saveItem('expenses', item);
                }
                e.target.reset();
                if (e.target.querySelector('[name="expense_date"]')._flatpickr) {
                    e.target.querySelector('[name="expense_date"]')._flatpickr.setDate(new Date());
                }
                showToast(expenseId ? "Lançamento atualizado com sucesso!" : "Lançamento adicionado com sucesso!");
                await loadAllData();
                renderSpreadsheetItems();
                updateSpreadsheetSelects();
            } catch (err) {
                console.error("Sheet expense form error:", err);
                alert("Erro operacional: " + err.message);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            }
        });
    }
}

// 11. SPREADSHEETS (PLANILHAS RÁPIDAS) ENGINE
let currentSpreadsheetName = null;

function initSpreadsheetsModal() {
    showSpreadsheetsList();
}

function showSpreadsheetsList() {
    document.getElementById('spreadsheets-list-view').style.display = 'block';
    document.getElementById('spreadsheet-detail-view').style.display = 'none';
    if (document.getElementById('spreadsheet-create-view')) {
        document.getElementById('spreadsheet-create-view').style.display = 'none';
    }
    renderSpreadsheetsList();
}

function renderSpreadsheetsList() {
    const tbody = document.getElementById('spreadsheets-table-body');
    if (!tbody) return;

    const sheetsMap = {};
    expenses.forEach(e => {
        if (e.spreadsheet_name) {
            if (!sheetsMap[e.spreadsheet_name]) {
                sheetsMap[e.spreadsheet_name] = { count: 0, total: 0 };
            }
            if (!(e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha')) {
                sheetsMap[e.spreadsheet_name].count++;
            }
            sheetsMap[e.spreadsheet_name].total += Number(e.expense_value || 0);
        }
    });

    const sheets = Object.keys(sheetsMap);
    if (sheets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-dim); padding:20px;">Nenhuma planilha cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = sheets.map(sheet => `
        <tr>
            <td style="font-weight: 700; color: #fff;">${sheet}</td>
            <td>${sheetsMap[sheet].count} item(ns)</td>
            <td>R$ ${sheetsMap[sheet].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">
                <button onclick="viewSpreadsheet('${sheet.replace(/'/g, "\\'")}')" class="btn-primary" style="padding: 6px 12px; font-size: 11px; display: inline-flex; width: auto; margin: 0; justify-content:center;">Gerenciar</button>
            </td>
        </tr>
    `).join('');
}

function showCreateSpreadsheet() {
    document.getElementById('spreadsheets-list-view').style.display = 'none';
    document.getElementById('spreadsheet-detail-view').style.display = 'none';
    document.getElementById('spreadsheet-create-view').style.display = 'block';
    document.getElementById('new-spreadsheet-name').value = '';
    document.getElementById('new-spreadsheet-name').focus();
}

async function saveNewSpreadsheet() {
    const input = document.getElementById('new-spreadsheet-name');
    const name = input ? input.value.trim() : '';
    if (!name) return;

    const exists = expenses.some(e => e.spreadsheet_name && e.spreadsheet_name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert("Já existe uma planilha com este nome!");
        return;
    }

    const item = {
        expense_date: new Date().toISOString().split('T')[0],
        expense_category: 'Outros',
        expense_desc: 'Inicialização da Planilha',
        expense_value: 0,
        expense_quantity: 0,
        payment_method: 'Pix',
        expense_status: 'Quitado',
        spreadsheet_name: name
    };

    try {
        await saveItem('expenses', item);
        showToast("Planilha salva com sucesso!");
        updateSpreadsheetSelects();
        viewSpreadsheet(name);
    } catch (err) {
        console.error("Erro ao salvar planilha:", err);
        alert("Erro operacional ao salvar planilha: " + err.message);
    }
}

function viewSpreadsheet(name) {
    currentSpreadsheetName = name;
    document.getElementById('spreadsheets-list-view').style.display = 'none';
    document.getElementById('spreadsheet-detail-view').style.display = 'block';
    if (document.getElementById('spreadsheet-create-view')) {
        document.getElementById('spreadsheet-create-view').style.display = 'none';
    }
    document.getElementById('current-spreadsheet-title').innerText = name;

    const form = document.getElementById('form-spreadsheet-expense');
    if (form) {
        form.reset();
        if (form.querySelector('[name="expense_date"]')._flatpickr) {
            form.querySelector('[name="expense_date"]')._flatpickr.setDate(new Date());
        }
    }

    renderSpreadsheetItems();
}

function renderSpreadsheetItems() {
    const tbody = document.getElementById('spreadsheet-items-table-body');
    if (!tbody) return;

    let items = expenses.filter(e => e.spreadsheet_name === currentSpreadsheetName);

    if (items.length > 1) {
        items = items.filter(e => !(e.expense_value == 0 && e.expense_desc === 'Inicialização da Planilha'));
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">Nenhum lançamento nesta planilha.</td></tr>';
        return;
    }

    const sorted = [...items].sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

    tbody.innerHTML = sorted.map(e => `
        <tr>
            <td>${formatDateBR(e.expense_date)}</td>
            <td>${e.expense_desc || '-'}</td>
            <td>${e.payment_method}</td>
            <td><span class="status-badge ${e.expense_status === 'Pendente' ? 'warning' : 'success'}" style="font-size:9px; padding:2px 6px; border-radius:6px;">${e.expense_status || 'Quitado'}</span></td>
            <td>${Number(e.expense_quantity || 1).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
            <td>R$ ${Number(e.expense_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right;">
                <div style="display:flex; gap:8px; justify-content: flex-end;">
                    <button onclick="editSpreadsheetExpense('${e.id}')" style="background:none; border:none; color:var(--text-dim); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>
                    <button onclick="deleteSpreadsheetExpense('${e.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
}

async function deleteSpreadsheetExpense(id) {
    if (confirm("Deseja excluir este lançamento da planilha?")) {
        const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', currentUser.id);
        if (error) throw error;
        await loadAllData();
        renderSpreadsheetItems();
        renderSpreadsheetsList();
        updateSpreadsheetSelects();
    }
}

async function renameCurrentSpreadsheet() {
    const newName = prompt("Digite o novo nome para a planilha:", currentSpreadsheetName);
    if (!newName || !newName.trim() || newName.trim() === currentSpreadsheetName) return;
    const trimmedNewName = newName.trim();

    const itemsToUpdate = expenses.filter(e => e.spreadsheet_name === currentSpreadsheetName);
    if (itemsToUpdate.length > 0) {
        const { error } = await supabase.from('expenses')
            .update({ spreadsheet_name: trimmedNewName })
            .eq('spreadsheet_name', currentSpreadsheetName)
            .eq('user_id', currentUser.id);

        if (error) {
            alert("Erro ao renomear planilha: " + error.message);
            return;
        }
    }

    currentSpreadsheetName = trimmedNewName;
    document.getElementById('current-spreadsheet-title').innerText = trimmedNewName;
    await loadAllData();
    renderSpreadsheetItems();
    updateSpreadsheetSelects();
    showToast();
}

async function deleteCurrentSpreadsheet() {
    if (confirm(`Deseja excluir a planilha "${currentSpreadsheetName}" e TODOS os seus lançamentos?`)) {
        const { error } = await supabase.from('expenses')
            .delete()
            .eq('spreadsheet_name', currentSpreadsheetName)
            .eq('user_id', currentUser.id);

        if (error) {
            alert("Erro ao excluir planilha: " + error.message);
            return;
        }

        await loadAllData();
        showSpreadsheetsList();
        updateSpreadsheetSelects();
        showToast();
    }
}

function updateSpreadsheetSelects() {
    const expSelect = document.getElementById('expense-spreadsheet-select');
    const repSelect = document.getElementById('report-expenses-spreadsheet');
    if (!expSelect && !repSelect) return;

    const sheets = [...new Set(expenses.map(e => e.spreadsheet_name).filter(Boolean))].sort();

    if (expSelect) {
        const currentVal = expSelect.value;
        expSelect.innerHTML = '<option value="">Nenhuma (Custo Avulso)</option>' +
            sheets.map(s => `<option value="${s}">${s}</option>`).join('');
        expSelect.value = currentVal;
    }
    if (repSelect) {
        const currentVal = repSelect.value;
        repSelect.innerHTML = '<option value="">Custos Avulsos (Sem Planilha)</option>' +
            sheets.map(s => `<option value="${s}">${s}</option>`).join('');
        repSelect.value = currentVal;
    }
}

function editSpreadsheetExpense(id) {
    const e = expenses.find(item => item.id === id);
    if (!e) return;

    const form = document.getElementById('form-spreadsheet-expense');
    form.querySelector('[name="expense_date"]')._flatpickr.setDate(e.expense_date);
    form.querySelector('[name="expense_category"]').value = e.expense_category;
    form.querySelector('[name="payment_method"]').value = e.payment_method;
    form.querySelector('[name="expense_desc"]').value = e.expense_desc;
    form.querySelector('[name="expense_quantity"]').value = e.expense_quantity || 1;
    form.querySelector('[name="expense_value"]').value = e.expense_value;
    form.querySelector('[name="expense_id"]').value = e.id;
    form.querySelector('[name="expense_status"]').value = e.expense_status || 'Quitado';

    document.getElementById('sheet-expense-form-title').innerText = "Editar Lançamento na Planilha";
    const btn = document.getElementById('btn-save-sheet-expense');
    btn.innerHTML = `<i data-lucide="save" style="width: 16px; height: 16px;"></i> Salvar Alterações`;
    btn.style.background = "#2563eb"; // Blue for edit mode

    if (window.lucide) window.lucide.createIcons();
}

window.editSpreadsheetExpense = editSpreadsheetExpense;

// ==========================================
// INTERACTIVE SPREADSHEET MONITORING ENGINE
// ==========================================

let selectedSpreadsheetMonth = new Date().toISOString().substring(0, 7);
let activePopoverCell = null;
let selectedPopoverStageCode = null;

function initSpreadsheet() {
    const picker = document.getElementById('spreadsheet-month-picker');
    if (picker && !picker.value) {
        picker.value = selectedSpreadsheetMonth;
    }
    renderSpreadsheetGrid();
}

function naturalSortKilns(kilnsList) {
    return [...kilnsList].sort((a, b) => {
        return a.praca.localeCompare(b.praca, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function renderSpreadsheetGrid() {
    const picker = document.getElementById('spreadsheet-month-picker');
    if (picker) {
        selectedSpreadsheetMonth = picker.value || new Date().toISOString().substring(0, 7);
    }
    updateMonthStatusUI();

    const [yearStr, monthStr] = selectedSpreadsheetMonth.split('-');
    if (!yearStr || !monthStr) return;
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;

    const totalDays = new Date(year, month + 1, 0).getDate();

    const headerRow = document.getElementById('spreadsheet-header-days');
    if (!headerRow) return;

    let headerHtml = `<th class="sticky-col">Fila / Forno</th>`;
    for (let d = 1; d <= totalDays; d++) {
        const date = new Date(year, month, d);
        const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' })
            .replace('.', '')
            .toUpperCase()
            .substring(0, 3);
        headerHtml += `<th>${d}<br><span style="font-size: 8px; opacity:0.7;">${weekday}</span></th>`;
    }
    headerRow.innerHTML = headerHtml;

    const bodyRows = document.getElementById('spreadsheet-body-rows');
    if (!bodyRows) return;

    const sortedKilns = naturalSortKilns(kilns);
    let bodyHtml = "";

    const dailyCargas = new Array(totalDays + 1).fill(0);
    const dailyCarboniz = new Array(totalDays + 1).fill(0);
    const dailyResfri = new Array(totalDays + 1).fill(0);
    const dailyVazios = new Array(totalDays + 1).fill(0);

    sortedKilns.forEach((k) => {
        // Verificar se há alerta ativo para este forno
        const kilnNotif = notifications.find(n => n.praca === k.praca);
        let alertIndicator = '';
        if (kilnNotif) {
            const color = kilnNotif.severity === 'red' ? 'var(--primary)' : 'var(--warning)';
            const title = `Atrasado em ${kilnNotif.stageName} há ${kilnNotif.consecutiveDays} dias (${kilnNotif.delayDays} dias de atraso)`;
            alertIndicator = `<span class="kiln-alert-dot" style="background-color: ${color};" title="${title}"></span>`;
        }

        bodyHtml += `<tr>`;
        bodyHtml += `<td class="sticky-col" onclick="openEditKilnModal('${k.praca}')" style="cursor: pointer; transition: background 0.2s;" title="Clique para configurar o Forno ${k.praca}">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span style="font-weight: 700;">${k.praca}</span>
                ${alertIndicator}
            </div>
        </td>`;

        for (let d = 1; d <= totalDays; d++) {
            const dayStr = String(d).padStart(2, '0');
            const dateStr = `${selectedSpreadsheetMonth}-${dayStr}`;

            const hRecord = history.find(h => h && h.praca === k.praca && h.data === dateStr);

            let stageCode = "";
            let cellClass = "";
            let obs = "";

            if (hRecord) {
                obs = hRecord.obs || "";
                if (hRecord.estagio) {
                    stageCode = hRecord.estagio;
                } else {
                    if (Number(hRecord.carbonizando) > 0) stageCode = "C";
                    else if (Number(hRecord.esfriando) > 0) stageCode = "E";
                    else if (Number(hRecord.cheios) > 0) stageCode = "X";
                    else if (Number(hRecord.vazios) > 0) stageCode = "V";
                }

                if (stageCode === "C") {
                    cellClass = "stage-c";
                    dailyCarboniz[d]++;
                } else if (stageCode === "E") {
                    cellClass = "stage-e";
                    dailyResfri[d]++;
                } else if (stageCode === "D" || stageCode === "DX") {
                    stageCode = "V";
                    cellClass = "stage-v";
                    dailyVazios[d]++;
                } else if (stageCode === "X") {
                    cellClass = "stage-x";
                    dailyCargas[d]++;
                } else if (stageCode === "V") {
                    cellClass = "stage-v";
                    dailyVazios[d]++;
                }
            }

            bodyHtml += `
                <td class="spreadsheet-cell-clickable ${cellClass}"
                    title="${obs ? 'Obs: ' + obs : ''}"
                    onclick="openSpreadsheetPopover('${k.praca}', '${dateStr}', this, '${stageCode}', '${obs.replace(/'/g, "\\'")}')">
                    ${stageCode}
                </td>
            `;
        }
        bodyHtml += `</tr>`;
    });

    // Add summary rows
    bodyHtml += `<tr class="summary-row"><td class="sticky-col summary-row-label">CARGAS</td>`;
    for (let d = 1; d <= totalDays; d++) {
        bodyHtml += `<td>${dailyCargas[d]}</td>`;
    }
    bodyHtml += `</tr>`;

    bodyHtml += `<tr class="summary-row"><td class="sticky-col summary-row-label">CARBONIZ</td>`;
    for (let d = 1; d <= totalDays; d++) {
        bodyHtml += `<td>${dailyCarboniz[d]}</td>`;
    }
    bodyHtml += `</tr>`;

    bodyHtml += `<tr class="summary-row"><td class="sticky-col summary-row-label">RESFRI</td>`;
    for (let d = 1; d <= totalDays; d++) {
        bodyHtml += `<td>${dailyResfri[d]}</td>`;
    }
    bodyHtml += `</tr>`;

    bodyHtml += `<tr class="summary-row"><td class="sticky-col summary-row-label">VAZIOS</td>`;
    for (let d = 1; d <= totalDays; d++) {
        bodyHtml += `<td>${dailyVazios[d]}</td>`;
    }
    bodyHtml += `</tr>`;

    bodyRows.innerHTML = bodyHtml;
}

function openSpreadsheetPopover(praca, dateStr, element, currentStage, currentObs) {
    const monthRef = dateStr.substring(0, 7);
    const isClosed = closedMonths.some(cm => cm.month_ref === monthRef);
    if (isClosed) {
        alert("Este mês está fechado e não permite edições. Caso queira fazer alterações, reabra o mês.");
        return;
    }

    activePopoverCell = { praca, data: dateStr, element };
    selectedPopoverStageCode = currentStage || null;

    const [y, m, d] = dateStr.split('-');
    document.getElementById('popover-title').innerText = `Forno ${praca} - Dia ${d}/${m}`;

    document.querySelectorAll('.btn-stage').forEach(btn => {
        btn.classList.remove('selected');
    });

    if (selectedPopoverStageCode) {
        const selectedBtn = document.querySelector(`.btn-stage-${selectedPopoverStageCode.toLowerCase()}`);
        if (selectedBtn) selectedBtn.classList.add('selected');
    }

    document.getElementById('popover-obs').value = currentObs || "";

    const popover = document.getElementById('spreadsheet-popover');
    popover.style.display = 'block';

    const popoverWidth = popover.offsetWidth || 280;
    const popoverHeight = popover.offsetHeight || 220;

    const rect = element.getBoundingClientRect();
    let left = window.scrollX + rect.left + rect.width / 2 - popoverWidth / 2;
    let top = window.scrollY + rect.top + rect.height + 6;

    if (left < 10) left = 10;
    if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    setTimeout(() => {
        document.getElementById('popover-obs').focus();
    }, 50);
}

function selectPopoverStage(stageCode) {
    selectedPopoverStageCode = stageCode;
    document.querySelectorAll('.btn-stage').forEach(btn => {
        btn.classList.remove('selected');
    });
    const selectedBtn = document.querySelector(`.btn-stage-${stageCode.toLowerCase()}`);
    if (selectedBtn) selectedBtn.classList.add('selected');
}

function closeSpreadsheetPopover() {
    const popover = document.getElementById('spreadsheet-popover');
    if (popover) popover.style.display = 'none';
    activePopoverCell = null;
}

async function savePopoverData() {
    if (!activePopoverCell) return;
    const { praca, data } = activePopoverCell;
    const obs = document.getElementById('popover-obs').value.trim();
    const stage = selectedPopoverStageCode;

    if (!stage && !obs) {
        await clearPopoverData();
        return;
    }

    const hRecord = history.find(h => h && h.praca === praca && h.data === data);

    const payload = {
        data: data,
        praca: praca,
        responsavel: (currentUser && currentUser.user_metadata && currentUser.user_metadata.operator_name)
            || (currentUser && currentUser.email)
            || "Sistema",
        vazios: stage === 'V' ? 1 : 0,
        cheios: stage === 'X' ? 1 : 0,
        carbonizando: stage === 'C' ? 1 : 0,
        esfriando: stage === 'E' ? 1 : 0,
        estagio: stage,
        obs: obs
    };

    try {
        if (hRecord) {
            const { error } = await supabase.from('production_history')
                .update(payload)
                .eq('id', hRecord.id)
                .eq('user_id', currentUser.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('production_history')
                .insert([{ ...payload, user_id: currentUser.id }]);
            if (error) throw error;
        }

        if (obs && (!hRecord || hRecord.obs !== obs)) {
            const existingIssue = maintenance.find(m => m && m.forno === praca && !m.resolved);
            if (!existingIssue) {
                await saveItem('maintenance', { forno: praca, problema: obs, data: data, resolved: false });
            }
        }

        showToast("Dados salvos!");
        await loadAllData();
    } catch (err) {
        console.error("Erro ao salvar célula:", err);
        showToast("Erro ao salvar! Armazenando localmente...");
        const offlinePayload = { ...payload, user_id: currentUser.id };
        if (hRecord) {
            offlinePayload.id = hRecord.id;
            const idx = history.findIndex(h => h.id === hRecord.id);
            if (idx !== -1) history[idx] = offlinePayload;
        } else {
            offlinePayload.id = 'temp-' + Date.now();
            history.unshift(offlinePayload);
        }
        saveOffline('production_history', offlinePayload);
        renderAll();
        updateUI();
        calculateNotifications();
        renderNotifications();
    }

    closeSpreadsheetPopover();
}

async function clearPopoverData() {
    if (!activePopoverCell) return;
    const { praca, data } = activePopoverCell;

    const hRecord = history.find(h => h && h.praca === praca && h.data === data);

    if (hRecord) {
        try {
            const { error } = await supabase.from('production_history')
                .delete()
                .eq('id', hRecord.id)
                .eq('user_id', currentUser.id);
            if (error) throw error;

            showToast("Célula limpa!");
            await loadAllData();
        } catch (err) {
            console.error("Erro ao limpar célula:", err);
            showToast("Erro ao deletar. Removendo localmente...");
            const idx = history.findIndex(h => h.id === hRecord.id);
            if (idx !== -1) history.splice(idx, 1);
            saveOffline('production_history_delete', { id: hRecord.id });
            renderAll();
            updateUI();
            calculateNotifications();
            renderNotifications();
        }
    }

    closeSpreadsheetPopover();
}

// Click outside popover logic
document.addEventListener('click', (e) => {
    const popover = document.getElementById('spreadsheet-popover');
    if (popover && popover.style.display === 'block') {
        const isCell = e.target.classList.contains('spreadsheet-cell-clickable');
        const isPopover = e.target.closest('#spreadsheet-popover');
        if (!isCell && !isPopover) {
            closeSpreadsheetPopover();
        }
    }
});

function updateMonthStatusUI() {
    const picker = document.getElementById('spreadsheet-month-picker');
    if (!picker) return;

    const selectedMonth = picker.value || new Date().toISOString().substring(0, 7);
    const container = document.getElementById('month-status-container');
    if (!container) return;

    // Verifica se o mês selecionado está fechado
    const isClosed = closedMonths.some(cm => cm.month_ref === selectedMonth);

    let html = "";
    if (isClosed) {
        html = `
            <span class="badge badge-danger" style="background-color: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                <i data-lucide="lock" style="width: 14px; height: 14px;"></i> FECHADO
            </span>
            <button class="btn-secondary" onclick="toggleMonthStatus('${selectedMonth}', false)" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 8px; margin: 0; background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: #fff; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="unlock" style="width: 14px; height: 14px;"></i> Reabrir Mês
            </button>
        `;
    } else {
        html = `
            <span class="badge badge-success" style="background-color: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                <i data-lucide="lock-open" style="width: 14px; height: 14px;"></i> ABERTO
            </span>
            <button class="btn-danger" onclick="toggleMonthStatus('${selectedMonth}', true)" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 8px; margin: 0; background: #ef4444; border: none; color: white; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px;">
                <i data-lucide="lock" style="width: 14px; height: 14px;"></i> Fechar Mês
            </button>
        `;
    }
    container.innerHTML = html;

    // Atualiza os ícones do Lucide
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function toggleMonthStatus(monthRef, shouldClose) {
    if (!currentUser) {
        alert("Usuário não autenticado.");
        return;
    }

    const [yearStr, monthStr] = monthRef.split('-');
    const dateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const formattedMonth = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (shouldClose) {
        const confirmClose = confirm(`Tem certeza que deseja fechar o mês de ${formattedMonth}? Isso impedirá novas edições nos dados deste período.`);
        if (!confirmClose) return;

        try {
            const { error } = await supabase.from('closed_months').insert([
                { user_id: currentUser.id, month_ref: monthRef }
            ]);
            if (error) throw error;

            showToast(`Mês de ${formattedMonth} fechado com sucesso!`);

            // Recarregar os dados
            await loadAllData();

            // Pergunta para iniciar novo mês do zero
            const nextMonthDate = new Date(parseInt(yearStr), parseInt(monthStr), 1);
            const nextMonthRef = nextMonthDate.toISOString().substring(0, 7);
            const formattedNextMonth = nextMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

            const initNewMonth = confirm(`Deseja iniciar o novo mês de ${formattedNextMonth} do zero?`);
            if (initNewMonth) {
                const picker = document.getElementById('spreadsheet-month-picker');
                if (picker) {
                    picker.value = nextMonthRef;
                    selectedSpreadsheetMonth = nextMonthRef;
                    renderSpreadsheetGrid();
                }
            }
        } catch (err) {
            console.error("Erro ao fechar mês:", err);
            alert("Erro ao fechar mês: " + err.message);
        }
    } else {
        const confirmOpen = confirm(`Tem certeza que deseja reabrir o mês de ${formattedMonth}? Isso permitirá novas edições nos dados deste período.`);
        if (!confirmOpen) return;

        try {
            const { error } = await supabase.from('closed_months')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('month_ref', monthRef);
            if (error) throw error;

            showToast(`Mês de ${formattedMonth} reaberto com sucesso!`);
            await loadAllData();
        } catch (err) {
            console.error("Erro ao reabrir mês:", err);
            alert("Erro ao reabrir mês: " + err.message);
        }
    }
}

// Expose functions globally
window.initSpreadsheet = initSpreadsheet;
window.renderSpreadsheetGrid = renderSpreadsheetGrid;
window.openSpreadsheetPopover = openSpreadsheetPopover;
window.selectPopoverStage = selectPopoverStage;
window.closeSpreadsheetPopover = closeSpreadsheetPopover;
window.savePopoverData = savePopoverData;
window.clearPopoverData = clearPopoverData;
window.updateMonthStatusUI = updateMonthStatusUI;
window.toggleMonthStatus = toggleMonthStatus;

// ═══ NOTIFICATION PANEL ENGINE ═══
function getStageCode(hRecord) {
    if (!hRecord) return "";
    if (hRecord.estagio === 'D' || hRecord.estagio === 'DX') return "V";
    if (hRecord.estagio) return hRecord.estagio;
    if (Number(hRecord.carbonizando) > 0) return "C";
    if (Number(hRecord.esfriando) > 0) return "E";
    if (Number(hRecord.esvaziando) > 0 || Number(hRecord.descarga) > 0) return "V";
    if (Number(hRecord.cheios) > 0) return "X";
    if (Number(hRecord.vazios) > 0) return "V";
    return "";
}

function calculateNotifications() {
    notifications = [];
    if (!kilns || kilns.length === 0) return;

    // Thresholds
    const tc = userSettings.threshold_carbonizacao || 2;
    const te = userSettings.threshold_resfriamento || 2;
    const tx = userSettings.threshold_carga || 1;

    kilns.forEach(k => {
        // Obter histórico do forno
        const kHistory = history
            .filter(h => h && h.praca === k.praca)
            .sort((a, b) => b.data.localeCompare(a.data));

        if (kHistory.length === 0) return;

        // Último estado
        const latest = kHistory[0];
        const currentStage = getStageCode(latest);

        // Apenas avaliamos processos operacionais que podem atrasar
        if (!['C', 'E', 'X'].includes(currentStage)) return;

        // Calcular os dias reais no estágio: usa o primeiro registro contínuo
        // e compara com hoje, mesmo quando não houve lançamento diário.
        let consecutiveDays = 0;
        const activeStageHistory = [];
        for (let i = 0; i < kHistory.length; i++) {
            if (getStageCode(kHistory[i]) === currentStage) {
                activeStageHistory.push(kHistory[i]);
            } else {
                break;
            }
        }
        const oldestStageDate = activeStageHistory.reduce((oldest, item) => {
            return !oldest || item.data < oldest ? item.data : oldest;
        }, latest.data);
        const oldestDate = new Date(`${oldestStageDate}T00:00:00`);
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        consecutiveDays = Math.max(1, Math.floor((todayDate - oldestDate) / 86400000) + 1);

        // Limiar correspondente com fallback para o global do usuário
        let threshold = 1;
        if (currentStage === 'C') {
            threshold = (k.threshold_carbonizacao !== null && k.threshold_carbonizacao !== undefined && k.threshold_carbonizacao > 0)
                ? k.threshold_carbonizacao
                : tc;
        } else if (currentStage === 'E') {
            threshold = (k.threshold_resfriamento !== null && k.threshold_resfriamento !== undefined && k.threshold_resfriamento > 0)
                ? k.threshold_resfriamento
                : te;
        } else if (currentStage === 'X') {
                threshold = (k.threshold_carga !== null && k.threshold_carga !== undefined && k.threshold_carga > 0)
                    ? k.threshold_carga
                    : tx;
            }

            if (consecutiveDays > threshold) {
            const delayDays = consecutiveDays - threshold;

            // Analisar se houve recorrência de atrasos (ciclos passados)
            let cycles = [];
            let currentBlock = null;
            kHistory.forEach(h => {
                const stage = getStageCode(h);
                if (!currentBlock) {
                    currentBlock = { stage: stage, count: 1 };
                } else if (currentBlock.stage === stage) {
                    currentBlock.count++;
                } else {
                    cycles.push(currentBlock);
                    currentBlock = { stage: stage, count: 1 };
                }
            });
            if (currentBlock) cycles.push(currentBlock);

            // Filtra ciclos passados do mesmo tipo, pulando o primeiro (ativo)
            const pastCyclesOfSameStage = cycles.slice(1).filter(c => c.stage === currentStage);
            const pastDelays = pastCyclesOfSameStage.filter(c => {
                let limit = 1;
                if (c.stage === 'C') limit = tc;
                else if (c.stage === 'E') limit = te;
                else if (c.stage === 'X') limit = tx;
                return c.count > limit;
            });

            const isRecurrent = pastDelays.length > 0;

            notifications.push({
                id: `notif-${k.praca}-${currentStage}-${latest.data}`,
                praca: k.praca,
                stage: currentStage,
                stageName: { 'C': 'Carbonização', 'E': 'Resfriamento', 'X': 'Carregamento' }[currentStage] || currentStage,
                consecutiveDays: consecutiveDays,
                threshold: threshold,
                delayDays: delayDays,
                severity: delayDays >= 3 ? 'red' : 'yellow',
                isRecurrent: isRecurrent,
                lastUpdated: latest.data
            });
        }
    });

    // Ordenar: Vermelhas (Críticas) primeiro, depois pelo desvio de dias decrescente
    notifications.sort((a, b) => {
        if (a.severity === b.severity) {
            return b.delayDays - a.delayDays;
        }
        return a.severity === 'red' ? -1 : 1;
    });
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    isNotificationPanelOpen = !isNotificationPanelOpen;
    if (isNotificationPanelOpen) {
        panel.style.right = '0px';
        const userDropdown = document.getElementById('user-dropdown');
        if (userDropdown) userDropdown.style.display = 'none';
    } else {
        panel.style.right = '-380px';
    }
}

function toggleSettingsForm() {
    isSettingsExpanded = !isSettingsExpanded;
    renderNotifications();
}

function toggleCarvoariaSettings() {
    const panel = document.getElementById('carvoaria-settings-panel');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveUserSettings(e) {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const tc = parseInt(document.getElementById('setting-threshold-c').value) || 2;
    const te = parseInt(document.getElementById('setting-threshold-e').value) || 2;
    const tx = parseInt(document.getElementById('setting-threshold-x').value) || 1;

    const payload = {
        threshold_carbonizacao: tc,
        threshold_resfriamento: te,
        threshold_carga: tx,
        user_id: currentUser.id,
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('user_settings')
            .upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;

        showToast("Prazos da carvoaria salvos!");
        userSettings = { ...userSettings, ...payload };
        calculateNotifications();
        isSettingsExpanded = false;
        renderNotifications();
    } catch (err) {
        console.error("Erro ao salvar limites:", err);
        alert("Erro ao salvar configurações: " + err.message);
    }
}

function renderNotifications() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (notifications.length > 0) {
            badge.innerText = notifications.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    const panel = document.getElementById('notification-panel');
    if (!panel) return;

    let html = `
        <div class="notification-header">
            <h3><i data-lucide="bell" style="width: 18px; height: 18px; color: var(--primary);"></i> Alertas e Notificações</h3>
            <div class="notification-header-actions">
                <button class="btn-icon-nav" onclick="toggleCarvoariaSettings(); toggleNotificationPanel();" title="Configurar Tempos Médios">
                    <i data-lucide="settings" style="width: 18px; height: 18px;"></i>
                </button>
                <button class="btn-icon-nav" onclick="toggleNotificationPanel()" title="Fechar">
                    <i data-lucide="x" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        </div>
        <div class="notification-body">
    `;

    if (notifications.length === 0) {
        html += `
            <div class="notification-empty-state">
                <i data-lucide="check-circle-2" style="width: 48px; height: 48px; color: var(--success); opacity: 0.6;"></i>
                <p>Nenhum alerta pendente. Todos os fornos estão operando dentro do prazo estimado.</p>
            </div>
        `;
    } else {
        notifications.forEach(n => {
            const dateStr = formatDateBR(n.lastUpdated);
            const severityClass = n.severity === 'red' ? 'alert-red' : 'alert-yellow';
            const badgeText = n.severity === 'red' ? 'Crítico' : 'Atenção';

            html += `
                <div class="notification-card ${severityClass}">
                    <div class="notification-card-header">
                        <span class="notification-title">
                            <i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i> Forno ${n.praca}
                        </span>
                        <span class="notification-badge-tag">${badgeText}</span>
                    </div>
                    <p class="notification-desc">
                        O processo de <strong>${n.stageName}</strong> está ativo há <strong>${n.consecutiveDays} dias</strong> (${n.delayDays} ${n.delayDays === 1 ? 'dia' : 'dias'} acima da média de ${n.threshold} dias).
                    </p>
            `;

            if (n.isRecurrent) {
                html += `
                    <div style="background: rgba(230,0,46,0.06); border: 1px solid rgba(230,0,46,0.12); border-radius: 6px; padding: 8px 10px; font-size: 10.5px; color: #ff8b9e; display: flex; align-items: flex-start; gap: 6px; line-height: 1.4;">
                        <i data-lucide="info" style="width: 12px; height: 12px; margin-top: 1px; flex-shrink: 0;"></i>
                        <span>Atraso recorrente neste processo. Possível entrada de ar falsa (vazamento). Recomenda-se vistoria física.</span>
                    </div>
                `;
            }

            html += `
                    <div class="notification-card-header" style="margin-top: 4px;">
                        <span class="notification-meta">Último lançamento: ${dateStr}</span>
                        <div class="notification-actions">
                            <button class="notification-btn-action" onclick="abrirManutencaoForno('${n.praca}', '${n.stageName}', ${n.consecutiveDays})">
                                <i data-lucide="wrench" style="width: 12px; height: 12px;"></i> Manutenção
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `
        </div>
    `;

    panel.innerHTML = html;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function abrirManutencaoForno(praca, estagioName, dias) {
    switchTab('alertas');

    const select = document.getElementById('maint-kiln-select');
    if (select) {
        select.value = praca;
    }

    const textarea = document.querySelector('#form-maintenance textarea[name="problema"]');
    if (textarea) {
        textarea.value = `Atraso no processo de ${estagioName}: permanecendo há ${dias} dias consecutivamente (acima do limite operacional configurado).`;
    }

    const dateInput = document.querySelector('#form-maintenance input[name="repair_date"]');
    if (dateInput) {
        dateInput.value = new Date().toISOString().substring(0, 10);
        if (dateInput._flatpickr) {
            dateInput._flatpickr.setDate(new Date());
        }
    }

    toggleNotificationPanel();
    showToast(`Preenchido Ordem de Reparo para Forno ${praca}!`);
}

// Click outside notification panel to close it
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notification-panel');
    const trigger = e.target.closest('.notification-trigger');
    const isInsidePanel = e.target.closest('#notification-panel');

    if (panel && isNotificationPanelOpen && !isInsidePanel && !trigger) {
        toggleNotificationPanel();
    }
});

function renderOperationalAlerts() {
    const dashboardPanel = document.getElementById('dashboard-alerts-panel');
    const productionPanel = document.getElementById('operational-alerts-panel');
    const centralPanel = document.getElementById('central-alerts-list');

    if (notifications.length === 0) {
        if (dashboardPanel) dashboardPanel.style.display = 'none';
        if (productionPanel) productionPanel.style.display = 'none';
        if (centralPanel) {
            centralPanel.innerHTML = `
                <div class="notification-empty-state" style="margin-top: 40px;">
                    <i data-lucide="check-circle-2" style="width: 48px; height: 48px; color: var(--success); opacity: 0.8; margin-bottom: 12px;"></i>
                    <p style="font-size: 13px; font-weight: 600; color: #fff;">Tudo em Ordem!</p>
                    <p style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">Todos os fornos da carvoaria estão operando dentro do prazo operacional configurado.</p>
                </div>
            `;
        }
        return;
    }

    let alertsHtml = `
        <div class="operational-alerts-section">
            <div class="operational-alerts-title">
                <i data-lucide="alert-triangle" style="width: 15px; height: 15px; color: var(--primary);"></i>
                <span>Alertas Operacionais Ativos (${notifications.length})</span>
            </div>
            <div class="operational-alerts-grid">
    `;

    let centralHtml = "";

    notifications.forEach(n => {
        const severityClass = n.severity === 'red' ? 'critical' : 'warning';
        const badgeText = n.severity === 'red' ? 'Crítico' : 'Atenção';
        const badgeClass = n.severity === 'red' ? 'critical' : 'warning';

        const cardHtml = `
            <div class="operational-alert-card ${severityClass}">
                <div class="operational-alert-card-header">
                    <span class="operational-alert-card-title">
                        <i data-lucide="container" style="width: 14px; height: 14px;"></i> Forno ${n.praca}
                    </span>
                    <span class="operational-alert-card-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="operational-alert-card-desc">
                    O processo de <strong>${n.stageName}</strong> está ativo há <strong>${n.consecutiveDays} dias</strong> (${n.delayDays} ${n.delayDays === 1 ? 'dia' : 'dias'} acima da média de ${n.threshold} dias).
                </div>
                ${n.isRecurrent ? `
                <div style="background: rgba(230,0,46,0.05); border: 1px solid rgba(230,0,46,0.1); border-radius: 6px; padding: 6px 10px; font-size: 10px; color: #ff8b9e; display: flex; align-items: flex-start; gap: 6px; line-height: 1.3; margin-top: 4px;">
                    <i data-lucide="info" style="width: 11px; height: 11px; margin-top: 1px; flex-shrink: 0;"></i>
                    <span>Possível vazamento ou entrada de ar falsa. Recomenda-se vistoria física.</span>
                </div>` : ''}
                <div class="operational-alert-card-meta">
                    <span>Lançamento: ${formatDateBR(n.lastUpdated)}</span>
                    <button class="operational-alert-card-action" onclick="abrirManutencaoForno('${n.praca}', '${n.stageName}', ${n.consecutiveDays})">
                        <i data-lucide="wrench" style="width: 11px; height: 11px;"></i> Reparo
                    </button>
                </div>
            </div>
        `;

        alertsHtml += cardHtml;
        centralHtml += cardHtml;
    });

    alertsHtml += `
            </div>
        </div>
    `;

    if (dashboardPanel) {
        dashboardPanel.innerHTML = alertsHtml;
        dashboardPanel.style.display = 'block';
    }
    if (productionPanel) {
        productionPanel.innerHTML = alertsHtml;
        productionPanel.style.display = 'block';
    }
    if (centralPanel) {
        centralPanel.innerHTML = centralHtml;
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function openEditKilnModal(praca) {
    const k = kilns.find(item => item.praca === praca);
    if (!k) return;

    document.getElementById('edit-praca-hidden').value = praca;
    document.getElementById('edit-praca-display').value = `Forno ${praca}`;

    // Thresholds Globais como fallback e placeholders
    const tc = userSettings.threshold_carbonizacao || 2;
    const te = userSettings.threshold_resfriamento || 2;
    const tx = userSettings.threshold_carga || 1;

    document.getElementById('edit-threshold-c').placeholder = `Padrão (${tc} dias)`;
    document.getElementById('edit-threshold-e').placeholder = `Padrão (${te} dias)`;
    document.getElementById('edit-threshold-x').placeholder = `Padrão (${tx} dias)`;

    // Valores atuais do forno
    document.getElementById('edit-threshold-c').value = k.threshold_carbonizacao || '';
    document.getElementById('edit-threshold-e').value = k.threshold_resfriamento || '';
    document.getElementById('edit-threshold-x').value = k.threshold_carga || '';

    showModal('edit-kiln');
}

async function saveKilnSettings(e) {
    if (e) e.preventDefault();
    const praca = document.getElementById('edit-praca-hidden').value;
    const k = kilns.find(item => item.praca === praca);
    if (!k) return;

    const tc = document.getElementById('edit-threshold-c').value;
    const te = document.getElementById('edit-threshold-e').value;
    const tx = document.getElementById('edit-threshold-x').value;

    const payload = {
        threshold_carbonizacao: tc ? parseInt(tc) : null,
        threshold_resfriamento: te ? parseInt(te) : null,
        threshold_carga: tx ? parseInt(tx) : null
    };

    try {
        showToast("Salvando configurações...");

        if (k.id && !k.id.toString().startsWith('temp-')) {
            const { error } = await supabase
                .from('kilns')
                .update(payload)
                .eq('praca', praca)
                .eq('user_id', currentUser.id);

            if (error) throw error;
        }

        // Atualiza localmente
        k.threshold_carbonizacao = payload.threshold_carbonizacao;
        k.threshold_resfriamento = payload.threshold_resfriamento;
        k.threshold_carga = payload.threshold_carga;

        hideModal('edit-kiln');
        showToast("Limites salvos!");

        // Recalcular e renderizar
        calculateNotifications();
        renderAll();
        renderNotifications();
    } catch (err) {
        console.error("Erro ao salvar limites do forno:", err);
        alert("Erro ao salvar limites do forno: " + err.message);
    }
}

async function deleteKilnFromModal() {
    const praca = document.getElementById('edit-praca-hidden').value;
    const k = kilns.find(item => item.praca === praca);
    if (!k) return;

    if (!confirm(`Tem certeza que deseja excluir o Forno ${praca}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        showToast("Excluindo forno...");

        if (k.id && !k.id.toString().startsWith('temp-')) {
            const { error } = await supabase
                .from('kilns')
                .delete()
                .eq('praca', praca)
                .eq('user_id', currentUser.id);

            if (error) throw error;
        }

        // Remove do array local
        kilns = kilns.filter(item => item.praca !== praca);

        hideModal('edit-kiln');
        showToast("Forno excluído!");

        // Recalcular e renderizar
        calculateNotifications();
        renderAll();
        renderNotifications();
    } catch (err) {
        console.error("Erro ao excluir forno:", err);
        alert("Erro ao excluir forno: " + err.message);
    }
}

async function deleteAllKilns() {
    if (!currentUser) {
        alert("Usuário não autenticado.");
        return;
    }

    if (kilns.length === 0) {
        showToast("Nenhum forno cadastrado.");
        return;
    }

    const firstConfirmation = confirm(`ATENÇÃO: ${kilns.length} forno(s) serão excluídos. Os históricos de produção, cargas e manutenções serão preservados. Deseja continuar?`);
    if (!firstConfirmation) return;

    const confirmationText = prompt('Para confirmar, digite EXCLUIR:');
    if (confirmationText?.trim().toUpperCase() !== 'EXCLUIR') {
        showToast("Exclusão cancelada.");
        return;
    }

    try {
        showToast("Excluindo fornos...");
        const { error } = await supabase
            .from('kilns')
            .delete()
            .eq('user_id', currentUser.id);

        if (error) throw error;

        kilns = [];
        notifications = [];
        renderAll();
        renderNotifications();
        showToast("Todos os fornos foram excluídos.");
    } catch (err) {
        console.error("Erro ao excluir todos os fornos:", err);
        alert("Erro ao excluir todos os fornos: " + err.message);
    }
}

// Expose functions globally
window.toggleNotificationPanel = toggleNotificationPanel;
window.toggleSettingsForm = toggleSettingsForm;
window.toggleCarvoariaSettings = toggleCarvoariaSettings;
window.saveUserSettings = saveUserSettings;
window.abrirManutencaoForno = abrirManutencaoForno;
window.openEditKilnModal = openEditKilnModal;
window.saveKilnSettings = saveKilnSettings;
window.deleteKilnFromModal = deleteKilnFromModal;
window.deleteAllKilns = deleteAllKilns;
window.renderOperationalAlerts = renderOperationalAlerts;

function initRealtimeSync() {
    if (!currentUser) return;
    console.log("Carbonize: Initializing Realtime channels...");

    supabase
        .channel('realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings' }, async (payload) => {
            console.log('Realtime user_settings change:', payload);
            await loadAllData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kilns' }, async (payload) => {
            console.log('Realtime kilns change:', payload);
            await loadAllData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'production_history' }, async (payload) => {
            console.log('Realtime production_history change:', payload);
            await loadAllData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance' }, async (payload) => {
            console.log('Realtime maintenance change:', payload);
            await loadAllData();
        })
        .subscribe();
}

