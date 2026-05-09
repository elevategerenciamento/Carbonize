// State Management
let kilns = JSON.parse(localStorage.getItem('carboniza_kilns')) || [];
let loads = JSON.parse(localStorage.getItem('carboniza_loads')) || [];
let history = JSON.parse(localStorage.getItem('carboniza_history')) || [];
let maintenance = JSON.parse(localStorage.getItem('carboniza_maint')) || [];

// Charts Instances
let prodChart = null;
let loadsChart = null;

// Constants
const TOAST_DURATION = 2000;

// Expose functions to window
window.switchTab = switchTab;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleMobileMenu = toggleMobileMenu;
window.generateReport = generateReport;

// Initialize
function init() {
    console.log("Iniciando Carboniza...");
    try {
        if (kilns.length === 0) {
            kilns = [
                { praca: 'Sul 01', responsavel: 'Ricardo', modelo: 'Forno Menor' },
                { praca: 'Sul 01', responsavel: 'Ricardo', modelo: 'Forno JG' },
                { praca: 'Norte 01', responsavel: 'José', modelo: 'Circular 5m' }
            ];
            saveAll();
        }
        updateDateTime();
        renderAll();
        setupForms();
        setInterval(updateDateTime, 60000);
    } catch (e) {
        console.error("Erro na inicialização:", e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function updateDateTime() {
    const elDate = document.getElementById('current-date');
    const elGreeting = document.getElementById('greeting');
    if (!elDate || !elGreeting) return;

    const now = new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    elDate.innerText = now.toLocaleDateString('pt-BR', options).replace('.', '');
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    
    elGreeting.innerText = `${greeting}, Operador`;
}

// Navigation Logic
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

    if (tab === 'analise') {
        setTimeout(renderCharts, 100);
    }

    renderAll();
}

function toggleMobileMenu() {
    const mobileNav = document.getElementById('mobile-nav');
    if (!mobileNav) return;
    mobileNav.style.display = (mobileNav.style.display === 'flex') ? 'none' : 'flex';
}

// Modal Logic
function showModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.style.display = 'flex';
}

function hideModal(type) {
    const modal = document.getElementById(`modal-${type}`);
    const form = document.getElementById(`form-${type}`);
    if (modal) modal.style.display = 'none';
    if (form) form.reset();
}

// Global Render
function renderAll() {
    try {
        updateKPIs();
        updateSelectors();
        renderDashboard();
        renderKilnHistory();
        renderLoadsTable();
        renderMaintenance();
        renderStock();
        updateMaintBadge();
    } catch (e) {
        console.error("Erro ao renderizar:", e);
    }
}

function updateKPIs() {
    const elFornosAtivos = document.getElementById('kpi-fornos-ativos');
    const elCargasHoje = document.getElementById('kpi-cargas-hoje');
    const elProdMes = document.getElementById('kpi-prod-mes');
    const elMaint = document.getElementById('kpi-maint');

    if (elFornosAtivos) elFornosAtivos.innerText = kilns.length;

    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today);
    if (elCargasHoje) elCargasHoje.innerText = todayLoads.length;

    const currentMonth = new Date().getMonth();
    const monthLoads = loads.filter(l => {
        try {
            return new Date(l.data.split('/').reverse().join('-')).getMonth() === currentMonth;
        } catch (e) { return false; }
    });
    const totalTons = (monthLoads.reduce((sum, l) => sum + Number(l.peso), 0) / 1000).toFixed(1);
    if (elProdMes) elProdMes.innerText = `${totalTons} t`;

    const openMaint = maintenance.filter(m => !m.resolved).length;
    if (elMaint) elMaint.innerText = openMaint;
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
            div.innerHTML = `<h5>${name}</h5><div class="mini-indicators"><span>V: ${g.v}</span><span>C: ${g.c}</span><span>CA: ${g.ca}</span><span>E: ${g.e}</span></div>`;
            pracasList.appendChild(div);
        });
    }
}

function updateSelectors() {
    const dailyPraca = document.getElementById('daily-praca-select');
    const maintKiln = document.getElementById('maint-kiln-select');
    const uniquePracas = [...new Set(kilns.map(k => k.praca))];
    if (dailyPraca) dailyPraca.innerHTML = '<option value="">Unidade</option>' + uniquePracas.map(p => `<option value="${p}">${p}</option>`).join('');
    if (maintKiln) maintKiln.innerHTML = '<option value="">Forno</option>' + kilns.map(k => `<option value="${k.praca} - ${k.modelo}">${k.praca} — ${k.modelo}</option>`).join('');
}

function renderKilnHistory() {
    const list = document.getElementById('kiln-history-list');
    if (!list) return;
    list.innerHTML = history.slice(-5).reverse().map(h => `<tr><td>${h.praca}</td><td>${h.modelo}</td><td>${h.carbonizando}</td><td>${h.obs || '—'}</td></tr>`).join('');
}

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    if (!list) return;
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today).reverse();
    list.innerHTML = todayLoads.map(l => `<tr><td>#${l.id}</td><td>${l.hora}</td><td>${l.placa}</td><td>${l.motorista}</td><td>Eucalipto</td><td>${l.metragem}</td><td>${Number(l.peso).toLocaleString()}</td><td>${l.destino}</td></tr>`).join('');
}

function renderMaintenance() {
    const openList = document.getElementById('open-issues-list');
    if (openList) openList.innerHTML = maintenance.filter(m => !m.resolved).map(m => `<tr><td>${m.forno}</td><td>${m.problema}</td><td>${new Date(m.timestamp).toLocaleDateString('pt-BR')}</td></tr>`).join('');
}

function renderStock() {
    const totalIn = history.reduce((acc, h) => acc + Number(h.carbonizando || 0), 0) * 1.5;
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso || 0) / 1000), 0);
    const elBalance = document.getElementById('stock-balance');
    if (elBalance) elBalance.innerText = `${Math.max(0, totalIn - totalOut).toFixed(1)} t`;
}

function updateMaintBadge() {
    const count = maintenance.filter(m => !m.resolved).length;
    const elCount = document.getElementById('maint-count');
    if (elCount) elCount.innerText = count;
}

// Charts Logic
function renderCharts() {
    const prodCtx = document.getElementById('prodChart');
    const loadsCtx = document.getElementById('loadsChart');
    if (!prodCtx || !loadsCtx) return;

    if (prodChart) prodChart.destroy();
    if (loadsChart) loadsChart.destroy();

    // Data for Prod Chart
    const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    const dataProd = [12, 19, 15, 22]; // Mock or calculated from history

    prodChart = new Chart(prodCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Carbonização (t)',
                data: dataProd,
                borderColor: '#ff6b00',
                backgroundColor: 'rgba(255, 107, 0, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
    });

    // Data for Loads Chart
    const dataLoads = [5, 8, 4, 10, 6, 9, 7];
    loadsChart = new Chart(loadsCtx, {
        type: 'bar',
        data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
            datasets: [{
                label: 'Cargas',
                data: dataLoads,
                backgroundColor: '#2196f3',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
    });
}

// Form Handlers
function setupForms() {
    const forms = ['kiln', 'kiln-daily', 'load', 'maintenance'];
    forms.forEach(id => {
        const f = document.getElementById(`form-${id}`);
        if (f) {
            f.onsubmit = (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                processForm(id, fd);
                saveAll();
                if (id.includes('modal') || id === 'load') hideModal(id.replace('form-', ''));
                e.target.reset();
                showToast();
            };
        }
    });
}

function processForm(id, fd) {
    if (id === 'kiln') kilns.push({ praca: fd.get('praca'), responsavel: fd.get('responsavel'), modelo: fd.get('modelo') });
    if (id === 'kiln-daily') {
        const entry = { timestamp: Date.now(), data: new Date().toLocaleDateString('pt-BR'), praca: fd.get('praca_select'), modelo: fd.get('modelo_select'), vazios: fd.get('vazios'), cheios: fd.get('cheios'), carbonizando: fd.get('carbonizando'), esfriando: fd.get('esfriando'), obs: fd.get('obs') };
        history.push(entry);
    }
    if (id === 'load') loads.push({ id: 1000 + loads.length, data: new Date().toLocaleDateString('pt-BR'), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), placa: fd.get('placa').toUpperCase(), motorista: fd.get('motorista'), metragem: fd.get('metragem'), peso: fd.get('peso'), destino: fd.get('destino') });
}

function saveAll() {
    localStorage.setItem('carboniza_kilns', JSON.stringify(kilns));
    localStorage.setItem('carboniza_loads', JSON.stringify(loads));
    localStorage.setItem('carboniza_history', JSON.stringify(history));
    localStorage.setItem('carboniza_maint', JSON.stringify(maintenance));
    renderAll();
}

function showToast() {
    const toast = document.getElementById('toast');
    if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), TOAST_DURATION); }
}

function generateReport(type, print = false) {
    // Basic implementation
    alert("Gerando PDF...");
}
