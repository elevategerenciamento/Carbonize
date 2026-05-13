console.log("Carbonize: app.js carregando...");

// Supabase Configuration
const SUPABASE_URL = "https://bdzppelpteaxkmmcrmcoc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkenBwZWxwdGVheGttY3JtY29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NDYxNjksImV4cCI6MjA5NDIyMjE2OX0.KFbnzEIGBfvHtnKK0pQp8_YurYwBttl5dTMOXfQq-OQ";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State Management
let kilns = [];
let loads = [];
let history = [];
let maintenance = [];
let expenses = [];

// Charts Instances
let prodChart = null;
let loadsChart = null;

// Constants
const TOAST_DURATION = 2000;
const PRIMARY_COLOR = '#cc092f'; // Bradesco Red

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
    console.log("Carbonize: Inicializando sistema com Auth...");
    
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
    setInterval(() => {
        if (supabase.auth.getSession()) loadAllFromSupabase();
    }, 30000);
}

async function handleLogin(e) {
    e.preventDefault();
    console.log("Carbonize: Tentando login/cadastro...");
    
    if (!supabase) {
        alert("Erro: Sistema de conexão (Supabase) não inicializado.");
        return;
    }

    const fd = new FormData(e.target);
    const farmNameRaw = fd.get('farm_name');
    const password = fd.get('password');
    
    if (!farmNameRaw || !password) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    const farmName = farmNameRaw.trim().toLowerCase().replace(/\s+/g, '_');
    const email = `${farmName}@carbonize.com`;
    const action = e.target.dataset.action || 'login';
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerText = "...";
        }

        if (action === 'signup') {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            alert("Conta criada com sucesso! Você já pode entrar.");
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        }
    } catch (err) {
        console.error("Erro Auth:", err);
        alert("Erro na Autenticação: " + (err.message || "Tente novamente mais tarde."));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = action === 'login' ? 'Entrar' : 'Cadastrar';
        }
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
        console.error("Erro ao carregar dados do Supabase:", err);
    }
}

async function updateDateTime() {
    const elDate = document.getElementById('current-date');
    const elGreeting = document.getElementById('greeting');
    if (!elDate || !elGreeting) return;

    const now = new Date();
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    elDate.innerText = now.toLocaleDateString('pt-BR', options);
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    const { data: { user } } = await supabase.auth.getUser();
    const farmName = user?.email?.split('@')[0].replace(/_/g, ' ').toUpperCase() || "Operador";
    elGreeting.innerText = `${greeting}, ${farmName}`;
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
    const mobileNav = document.getElementById('mobile-nav');
    const menuOverlay = document.getElementById('menu-overlay');
    if (!mobileNav) return;
    mobileNav.classList.toggle('show');
    if (menuOverlay) menuOverlay.classList.toggle('show');
}

function showModal(type, data = null) {
    const modal = document.getElementById(`modal-${type}`);
    if (!modal) return;
    modal.style.display = 'flex';

    if (type === 'kiln') {
        const title = document.getElementById('kiln-modal-title');
        const btn = document.getElementById('kiln-modal-btn');
        const editIdx = document.getElementById('kiln-edit-index');
        
        if (data) {
            title.innerText = "Editar Forno";
            btn.innerText = "Salvar Alterações";
            editIdx.value = data.index;
            document.getElementById('kiln-modal-praca').value = data.praca;
            document.getElementById('kiln-modal-modelo').value = data.modelo;
            document.getElementById('kiln-modal-resp').value = data.responsavel;
        } else {
            title.innerText = "Novo Ativo de Produção";
            btn.innerText = "Cadastrar Forno";
            editIdx.value = "";
            document.getElementById('form-kiln').reset();
        }
    }

    if (type === 'load') {
        // Gerar número de série diferente (ex: 10000 + random)
        const nextId = 10000 + Math.floor(Math.random() * 90000);
        const elId = document.getElementById('load-id-auto');
        if (elId) elId.value = nextId;

        const elDate = document.getElementById('load-date-manual');
        const elTime = document.getElementById('load-time-manual');
        if (elDate) elDate.value = new Date().toISOString().split('T')[0];
        if (elTime) elTime.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

function hideModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.style.display = 'none';
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
    const todayLoads = loads.filter(l => l.data === today);
    if (elCargasHoje) elCargasHoje.innerText = todayLoads.length;

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
    const elCustoCat = document.getElementById('kpi-custo-categoria');
    const elCustoUltimo = document.getElementById('kpi-custo-ultimo');
    const elCustoCount = document.getElementById('kpi-custo-count');

    if (elCustoMes || elCustoCat) {
        const monthExpenses = expenses.filter(e => {
            try { return new Date(e.data.split('/').reverse().join('-')).getMonth() === currentMonth; }
            catch (err) { return false; }
        });
        const totalValue = monthExpenses.reduce((sum, e) => sum + Number(e.valor), 0);
        if (elCustoMes) elCustoMes.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        
        if (elCustoCat && monthExpenses.length > 0) {
            const cats = {};
            monthExpenses.forEach(e => cats[e.categoria] = (cats[e.categoria] || 0) + Number(e.valor));
            const topCat = Object.keys(cats).reduce((a, b) => cats[a] > cats[b] ? a : b);
            elCustoCat.innerText = topCat;
        }

        if (elCustoUltimo && expenses.length > 0) {
            const last = expenses[expenses.length - 1];
            elCustoUltimo.innerText = `R$ ${Number(last.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        if (elCustoCount) elCustoCount.innerText = monthExpenses.length;
    }
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

    if (filtered.length === 0) {
        list.innerHTML = `<p class="text-dim" style="font-size: 13px; text-align: center; padding-top: 20px;">${search ? 'Nenhum resultado.' : 'Nenhum forno cadastrado.'}</p>`;
        return;
    }

    list.innerHTML = filtered.map((k, idx) => {
        const originalIdx = kilns.indexOf(k);
        return `
            <div class="asset-card">
                <div class="icon"><i data-lucide="container"></i></div>
                <div class="details">
                    <h6>${k.praca}</h6>
                    <span>${k.modelo} • ${k.responsavel || 'Operador'}</span>
                </div>
                <div class="actions">
                    <button onclick="editKiln(${originalIdx})" title="Editar"><i data-lucide="edit-2"></i></button>
                    <button class="delete" onclick="deleteKiln(${originalIdx})" title="Excluir"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

function editKiln(idx) {
    const k = kilns[idx];
    showModal('kiln', { ...k, index: idx });
}

function deleteKiln(idx) {
    if (confirm("Deseja realmente excluir este ativo?")) {
        kilns.splice(idx, 1);
        saveAll();
    }
}

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    if (!list) return;
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today).reverse();
    list.innerHTML = todayLoads.map(l => `
        <tr>
            <td><strong>#${l.id}</strong></td>
            <td>${l.data} <br> <small>${l.hora}</small></td>
            <td><span class="status-badge success">${l.tipo || 'Eucalipto'}</span></td>
            <td><strong>${l.placa}</strong></td>
            <td>${l.motorista}</td>
            <td>${l.metragem} m³ <br> ${Number(l.peso).toLocaleString()} kg</td>
            <td>${l.destino}</td>
        </tr>
    `).join('');
    
    const elCount = document.getElementById('loads-count-summary');
    const elKg = document.getElementById('loads-total-kg');
    if (elCount) elCount.innerText = `${todayLoads.length} CARGAS`;
    if (elKg) elKg.innerText = `${todayLoads.reduce((s, l) => s + Number(l.peso || 0), 0).toLocaleString()} KG TOTAL`;
}

function renderMaintenance() {
    const openList = document.getElementById('open-issues-list');
    if (openList) {
        openList.innerHTML = maintenance.filter(m => !m.resolved).map(m => `<tr><td>${m.forno}</td><td>${m.problema}</td><td>${new Date(m.timestamp).toLocaleDateString('pt-BR')}</td><td><button class="btn-icon" onclick="resolveMaint('${m.timestamp}')">Concluir</button></td></tr>`).join('');
    }
}

function renderExpenses() {
    const list = document.getElementById('expense-history-list');
    if (!list) return;
    list.innerHTML = expenses.slice(-15).reverse().map((e, idx) => {
        const originalIdx = expenses.indexOf(e);
        return `
            <tr>
                <td>${e.data}</td>
                <td><span class="status-badge warning">${e.categoria}</span></td>
                <td>${e.desc}</td>
                <td><strong>R$ ${Number(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                <td>
                    <button class="btn-icon text-primary" onclick="deleteExpense(${originalIdx})" title="Excluir">
                        <i data-lucide="trash-2" style="width: 14px;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
}

function deleteExpense(idx) {
    if (confirm("Deseja realmente excluir este lançamento?")) {
        expenses.splice(idx, 1);
        saveAll();
    }
}

function renderStock() {
    const totalIn = history.reduce((acc, h) => acc + (Number(h.carbonizando || 0) * 1.5), 0);
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso || 0) / 1000), 0);
    const balance = Math.max(0, totalIn - totalOut).toFixed(1);
    const elBalance = document.getElementById('stock-balance');
    if (elBalance) elBalance.innerText = `${balance} t`;
    if (document.getElementById('stock-in')) document.getElementById('stock-in').innerText = `${totalIn.toFixed(1)} t`;
    if (document.getElementById('stock-out')) document.getElementById('stock-out').innerText = `${totalOut.toFixed(1)} t`;

    const list = document.getElementById('stock-movement-list');
    if (!list) return;
    const movements = [...history.map(h => ({ type: 'entry', label: `Produção Forno ${h.modelo}`, amount: (Number(h.carbonizando || 0) * 1.5).toFixed(1) + ' t', date: h.data, ts: h.timestamp })), ...loads.map(l => ({ type: 'exit', label: `Venda Romaneio #${l.id}`, amount: (Number(l.peso || 0) / 1000).toFixed(1) + ' t', date: l.data, ts: new Date(l.data.split('/').reverse().join('-')).getTime() }))].sort((a, b) => b.ts - a.ts);
    const filterType = document.getElementById('stock-filter-type')?.value || 'all';
    list.innerHTML = movements.filter(m => filterType === 'all' || m.type === filterType).slice(0, 10).map(m => `<div class="stock-item ${m.type}"><div class="type-icon"><i data-lucide="${m.type === 'entry' ? 'plus-circle' : 'minus-circle'}"></i></div><div class="info"><h6>${m.label}</h6><span>${m.date}</span></div><div class="amount">${m.type === 'entry' ? '+' : '-'}${m.amount}</div></div>`).join('');
}

function setupFilters() {
    const stockFilter = document.getElementById('stock-filter-type');
    if (stockFilter) stockFilter.onchange = renderStock;
}

function updateMaintBadge() {
    const count = maintenance.filter(m => !m.resolved).length;
    const elCount = document.getElementById('maint-count');
    const elAlertBadge = document.getElementById('maint-alert-badge');
    if (elCount) elCount.innerText = count;
    if (elAlertBadge) {
        elAlertBadge.innerText = count > 0 ? `${count} PENDENTES` : "SISTEMA OK";
        elAlertBadge.className = count > 0 ? "status-badge danger" : "status-badge success";
    }
}

function renderCharts() {
    const prodCtx = document.getElementById('prodChart');
    const loadsCtx = document.getElementById('loadsChart');
    if (!prodCtx || !loadsCtx) return;
    if (prodChart) prodChart.destroy();
    if (loadsChart) loadsChart.destroy();
    prodChart = new Chart(prodCtx, { type: 'line', data: { labels: ['S1', 'S2', 'S3', 'S4'], datasets: [{ label: 'Produção (t)', data: [12.5, 18.2, 14.8, 21.0], borderColor: PRIMARY_COLOR, backgroundColor: 'rgba(204, 9, 47, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false } });
    loadsChart = new Chart(loadsCtx, { type: 'bar', data: { labels: ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], datasets: [{ label: 'Cargas', data: [4, 7, 5, 8, 12, 9, 6], backgroundColor: PRIMARY_COLOR }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function setupForms() {
    const loginForm = document.getElementById('form-login');
    if (loginForm) loginForm.onsubmit = handleLogin;

    const settingsForm = document.getElementById('form-settings');
    if (settingsForm) settingsForm.onsubmit = updateProfile;

    const forms = ['kiln', 'kiln-daily', 'load', 'maintenance', 'expense'];
    forms.forEach(id => {
        const f = document.getElementById(`form-${id}`);
        if (f) {
            f.onsubmit = async (e) => {
                e.preventDefault();
                const btn = f.querySelector('button[type="submit"]');
                const originalText = btn ? btn.innerText : "";
                
                try {
                    if (btn) {
                        btn.disabled = true;
                        btn.innerText = "Sincronizando...";
                    }

                    processForm(id, new FormData(e.target));
                    await saveAll();
                    
                    if (id === 'kiln' || id === 'load') hideModal(id);
                    e.target.reset();
                    
                    // Re-set date fields after reset
                    const expDateInput = document.getElementById('expense-date');
                    if (expDateInput) expDateInput.value = new Date().toISOString().split('T')[0];
                    const dailyInput = document.getElementById('daily-date');
                    if (dailyInput) dailyInput.value = new Date().toISOString().split('T')[0];
                    
                    showToast("Dados salvos na nuvem!");
                } catch (err) {
                    console.error("Erro ao processar formulário:", err);
                    showToast("Erro ao conectar com servidor.");
                } finally {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerText = originalText;
                    }
                }
            };
        }
    });
}

function processForm(id, fd) {
    if (id === 'kiln') {
        const idx = fd.get('kiln_index');
        const data = { praca: fd.get('praca'), responsavel: fd.get('responsavel'), modelo: fd.get('modelo') };
        if (idx !== "") kilns[idx] = data;
        else kilns.push(data);
    }
    if (id === 'kiln-daily') {
        const praca = fd.get('praca_select');
        const kData = kilns.find(k => k.praca === praca) || { modelo: 'N/A' };
        const entry = { 
            timestamp: Date.now(), 
            data: fd.get('data_lancamento') ? new Date(fd.get('data_lancamento')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'), 
            responsavel: fd.get('responsavel'),
            praca: praca, 
            modelo: kData.modelo, 
            vazios: fd.get('vazios'), 
            cheios: fd.get('cheios'), 
            carbonizando: fd.get('carbonizando'), 
            esfriando: fd.get('esfriando'), 
            obs: fd.get('obs') 
        };
        history.push(entry);
        if (fd.get('obs') && fd.get('obs').trim() !== "") {
            maintenance.push({ forno: `${entry.praca}`, problema: fd.get('obs'), data: entry.data, resolved: false, timestamp: Date.now() });
        }
    }
    if (id === 'load') {
        loads.push({ 
            id: fd.get('identificador'), 
            data: fd.get('data_carga') ? new Date(fd.get('data_carga')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'), 
            hora: fd.get('hora_carga'),
            placa: fd.get('placa').toUpperCase(), 
            motorista: fd.get('motorista'), 
            tipo: fd.get('tipo_carvao'),
            metragem: fd.get('metragem'), 
            peso: fd.get('peso'), 
            destino: fd.get('destino') 
        });
    }
    if (id === 'maintenance') {
        const target = fd.get('kiln_target').split(' — ');
        maintenance.push({ data: fd.get('repair_date'), forno: target[0], servico: fd.get('issue_type'), custo: fd.get('cost'), notes: fd.get('maint_notes'), resolved: true, timestamp: Date.now() });
    }
    if (id === 'expense') {
        expenses.push({
            timestamp: Date.now(),
            data: fd.get('expense_date') ? new Date(fd.get('expense_date')).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
            categoria: fd.get('expense_category'),
            desc: fd.get('expense_desc'),
            valor: fd.get('expense_value')
        });
    }
}

function resolveMaint(ts) {
    maintenance = maintenance.map(m => m.timestamp.toString() === ts ? { ...m, resolved: true } : m);
    saveAll();
}

async function saveAll() {
    try {
        // Mapeamento para os nomes de colunas do Supabase
        const kilnsPayload = kilns.map(k => ({ praca: k.praca, responsavel: k.responsavel, modelo: k.modelo }));
        const loadsPayload = loads.map(l => ({ 
            identificador: l.id, 
            data_carga: l.data, 
            hora_carga: l.hora, 
            placa: l.placa, 
            motorista: l.motorista, 
            tipo_carvao: l.tipo, 
            metragem: Number(l.metragem), 
            peso: Number(l.peso), 
            destino: l.destino 
        }));
        const historyPayload = history.map(h => ({
            timestamp: h.timestamp,
            data_lancamento: h.data,
            responsavel: h.responsavel,
            praca: h.praca,
            modelo: h.modelo,
            vazios: Number(h.vazios),
            cheios: Number(h.cheios),
            carbonizando: Number(h.carbonizando),
            esfriando: Number(h.esfriando),
            obs: h.obs
        }));
        const maintPayload = maintenance.map(m => ({
            data_registro: m.data,
            forno: m.forno,
            problema: m.problema,
            servico: m.servico || m.problema,
            custo: Number(m.custo || 0),
            notes: m.notes || '',
            resolved: m.resolved,
            timestamp_maint: m.timestamp
        }));
        const expensesPayload = expenses.map(e => ({
            timestamp_expense: e.timestamp,
            data_expense: e.data,
            categoria: e.categoria,
            description: e.desc,
            valor: Number(e.valor)
        }));

        // Limpar e reinserir (estratégia simples para demo)
        // Em um app maior usaríamos IDs reais e PATCH/UPSERT individual
        await supabase.from('kilns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('kilns').insert(kilnsPayload);

        await supabase.from('loads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('loads').insert(loadsPayload);

        await supabase.from('production_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('production_history').insert(historyPayload);

        await supabase.from('maintenance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('maintenance').insert(maintPayload);

        await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('expenses').insert(expensesPayload);

        console.log("Sincronizado com Supabase!");
    } catch (err) {
        console.error("Erro ao salvar no Supabase:", err);
    }
    
    renderAll();
}

function showToast() {
    const toast = document.getElementById('toast');
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), TOAST_DURATION); }
}

function generateReport(type, print = false) {
    try {
        const start = document.getElementById(`report-${type}-start`)?.value;
        const end = document.getElementById(`report-${type}-end`)?.value;
        const filterData = (data, dateKey = 'data') => {
            if (!start && !end) return data;
            return data.filter(item => {
                const itemDate = new Date(item[dateKey].split('/').reverse().join('-')).getTime();
                const startDate = start ? new Date(start).getTime() : 0;
                const endDate = end ? new Date(end).getTime() : Infinity;
                return itemDate >= startDate && itemDate <= endDate;
            });
        };
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(204, 9, 47); doc.rect(0, 0, 210, 15, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.text("CARBONIZE - GESTÃO INDUSTRIAL", 14, 10);
        doc.setTextColor(0, 0, 0); doc.setFontSize(18); doc.text("Relatório de " + type.toUpperCase(), 14, 30);
        let tableData = []; let columns = [];
        if (type === 'loads') { columns = ["ID", "Data", "Hora", "Tipo", "Placa", "Peso (kg)"]; tableData = filterData(loads).map(l => [l.id, l.data, l.hora, l.tipo, l.placa, l.peso]); }
        else if (type === 'pracas') { columns = ["Data", "Unidade", "V/C/C/E", "Obs"]; tableData = filterData(history).map(h => [h.data, h.praca, `${h.vazios}/${h.cheios}/${h.carbonizando}/${h.esfriando}`, h.obs]); }
        else if (type === 'expenses') { columns = ["Data", "Categoria", "Descrição", "Valor (R$)"]; tableData = filterData(expenses).map(e => [e.data, e.categoria, e.desc, Number(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })]); }
        
        doc.autoTable({ startY: 50, head: [columns], body: tableData, theme: 'grid', headStyles: { fillColor: [204, 9, 47] } });
        if (print) window.open(doc.output('bloburl'), '_blank'); else doc.save(`carbonize_${type}.pdf`);
    } catch (e) { alert("Erro ao gerar relatório."); }
}

function exportToExcel(type) {
    try {
        const start = document.getElementById(`report-${type}-start`)?.value;
        const end = document.getElementById(`report-${type}-end`)?.value;
        
        let dataToExport = [];
        let filename = `carbonize_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;

        const filterData = (data, dateKey = 'data') => {
            if (!start && !end) return data;
            return data.filter(item => {
                const itemDate = new Date(item[dateKey].split('/').reverse().join('-')).getTime();
                const startDate = start ? new Date(start).getTime() : 0;
                const endDate = end ? new Date(end).getTime() : Infinity;
                return itemDate >= startDate && itemDate <= endDate;
            });
        };

        if (type === 'expenses') {
            dataToExport = filterData(expenses).map(e => ({
                'Data': e.data,
                'Categoria': e.categoria,
                'Descrição': e.desc,
                'Valor (R$)': Number(e.valor)
            }));
        } else if (type === 'loads') {
            dataToExport = filterData(loads).map(l => ({
                'ID': l.id,
                'Data': l.data,
                'Hora': l.hora,
                'Tipo': l.tipo,
                'Placa': l.placa,
                'Peso (kg)': Number(l.peso),
                'Destino': l.destino
            }));
        }

        if (dataToExport.length === 0) {
            alert("Nenhum dado encontrado no período selecionado.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
        
        // Exportar arquivo
        XLSX.writeFile(workbook, filename);
        showToast();
    } catch (e) {
        console.error("Erro ao exportar Excel:", e);
        alert("Erro ao exportar para Excel.");
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const displayName = fd.get('display_name');
    
    try {
        const { error } = await supabase.auth.updateUser({
            data: { display_name: displayName }
        });
        if (error) throw error;
        showToast("Perfil atualizado!");
        hideModal('settings');
        await updateUserDisplay();
    } catch (err) {
        console.error("Erro ao atualizar perfil:", err);
        showToast("Erro ao salvar.");
    }
}

function toggleUserDropdown() {
    const menu = document.getElementById('user-dropdown');
    if (menu) menu.classList.toggle('show');
}

async function updateUserDisplay() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const farmName = user.user_metadata?.display_name || user.email.split('@')[0].replace(/_/g, ' ').toUpperCase();
    const email = user.email;

    // Update greeting
    const elGreeting = document.getElementById('greeting');
    if (elGreeting) {
        const hour = new Date().getHours();
        let greetingPrefix = "Boa noite";
        if (hour >= 5 && hour < 12) greetingPrefix = "Bom dia";
        else if (hour >= 12 && hour < 18) greetingPrefix = "Boa tarde";
        elGreeting.innerText = `${greetingPrefix}, ${farmName}`;
    }

    // Update dropdown
    const elDropFarm = document.getElementById('dropdown-farm-name');
    const elDropEmail = document.getElementById('dropdown-email');
    if (elDropFarm) elDropFarm.innerText = farmName;
    if (elDropEmail) elDropEmail.innerText = email;

    // Update settings form
    const elSetFarm = document.getElementById('settings-display-name');
    const elSetEmail = document.getElementById('settings-email');
    if (elSetFarm) elSetFarm.value = farmName;
    if (elSetEmail) elSetEmail.value = email;
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const container = document.querySelector('.user-dropdown-container');
    const menu = document.getElementById('user-dropdown');
    if (container && !container.contains(e.target)) {
        if (menu) menu.classList.remove('show');
    }
});

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function togglePassword(id) {
    const input = document.getElementById(id);
    const btn = input.nextElementSibling;
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
}
