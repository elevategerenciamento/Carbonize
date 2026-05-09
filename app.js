console.log("Carbonize: app.js carregando...");

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
const PRIMARY_COLOR = '#cc092f'; // Bradesco Red

// Expose functions to window IMMEDIATELY
window.switchTab = switchTab;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleMobileMenu = toggleMobileMenu;
window.generateReport = generateReport;
window.resolveMaint = resolveMaint;

// Initialize
function init() {
    console.log("Carbonize: Inicializando sistema...");
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
        setupFilters();
        setInterval(updateDateTime, 60000);
        console.log("Carbonize: Sistema pronto.");
    } catch (e) {
        console.error("Carbonize: Erro na inicialização:", e);
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
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    elDate.innerText = now.toLocaleDateString('pt-BR', options);
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    
    elGreeting.innerText = `${greeting}, Operador`;
}

// Navigation Logic
function switchTab(tab) {
    console.log("Carbonize: Trocando para aba", tab);
    const sections = document.querySelectorAll('.content-section');
    const navLinks = document.querySelectorAll('.nav-link');

    sections.forEach(s => s.style.display = 'none');
    navLinks.forEach(n => n.classList.remove('active'));

    const activeSection = document.getElementById(`section-${tab}`);
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    navLinks.forEach(n => {
        const attr = n.getAttribute('onclick') || "";
        if (attr.includes(`'${tab}'`)) n.classList.add('active');
    });

    if (tab === 'analise') setTimeout(renderCharts, 100);
    
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
        
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error("Carbonize: Erro ao renderizar:", e);
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
    
    if (elProgress) {
        const percent = Math.min(100, (totalTons / 160) * 100);
        elProgress.style.width = `${percent}%`;
    }

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
            div.innerHTML = `
                <h5>${name}</h5>
                <div class="mini-indicators">
                    <span class="ind-item">Vazios <b>${g.v}</b></span>
                    <span class="ind-item">Cheios <b>${g.c}</b></span>
                    <span class="ind-item">Carbon. <b>${g.ca}</b></span>
                    <span class="ind-item">Esfria <b>${g.e}</b></span>
                </div>
            `;
            pracasList.appendChild(div);
        });
    }

    const dashLoads = document.getElementById('dashboard-loads-list');
    if (dashLoads) {
        dashLoads.innerHTML = loads.slice(-5).reverse().map(l => `
            <tr>
                <td>${l.hora}</td>
                <td>${l.placa}</td>
                <td>${Number(l.peso).toLocaleString()} kg</td>
                <td><span class="status-badge success">Expedido</span></td>
            </tr>
        `).join('');
    }
}

function updateSelectors() {
    const dailyPraca = document.getElementById('daily-praca-select');
    const maintKiln = document.getElementById('maint-kiln-select');
    const uniquePracas = [...new Set(kilns.map(k => k.praca))];
    if (dailyPraca) dailyPraca.innerHTML = '<option value="">Selecionar Unidade...</option>' + uniquePracas.map(p => `<option value="${p}">${p}</option>`).join('');
    if (maintKiln) maintKiln.innerHTML = '<option value="">Selecionar Ativo...</option>' + kilns.map(k => `<option value="${k.praca} - ${k.modelo}">${k.praca} — ${k.modelo}</option>`).join('');
}

function renderKilnHistory() {
    const list = document.getElementById('kiln-history-list');
    if (!list) return;
    list.innerHTML = history.slice(-5).reverse().map(h => `
        <tr>
            <td>${h.praca}</td>
            <td>${h.modelo}</td>
            <td><span class="status-badge success">Ciclo Ativo</span></td>
            <td><small>${h.obs || 'Nenhuma ocorrência registrada'}</small></td>
        </tr>
    `).join('');
}

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    if (!list) return;
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today).reverse();
    list.innerHTML = todayLoads.map(l => `
        <tr>
            <td>#${l.id}</td>
            <td>${l.hora}</td>
            <td><strong>${l.placa}</strong></td>
            <td>${l.motorista}</td>
            <td>${l.metragem} m³</td>
            <td>${Number(l.peso).toLocaleString()}</td>
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
        openList.innerHTML = maintenance.filter(m => !m.resolved).map(m => `
            <tr>
                <td>${m.forno}</td>
                <td>${m.problema}</td>
                <td>${new Date(m.timestamp).toLocaleDateString('pt-BR')}</td>
                <td><button class="btn-icon" onclick="resolveMaint('${m.timestamp}')">Concluir</button></td>
            </tr>
        `).join('');
    }
}

function renderStock() {
    // Calculo básico: Entradas (carbonizando) vs Saídas (cargas)
    const totalIn = history.reduce((acc, h) => acc + (Number(h.carbonizando || 0) * 1.5), 0); // Fator de rendimento estimado
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso || 0) / 1000), 0);
    const balance = Math.max(0, totalIn - totalOut).toFixed(1);

    document.getElementById('stock-balance').innerText = `${balance} t`;
    document.getElementById('stock-in').innerText = `${totalIn.toFixed(1)} t`;
    document.getElementById('stock-out').innerText = `${totalOut.toFixed(1)} t`;

    const list = document.getElementById('stock-movement-list');
    if (!list) return;

    // Unindo movimentos para histórico
    const movements = [
        ...history.map(h => ({ type: 'entry', label: `Produção Forno ${h.modelo}`, amount: (Number(h.carbonizando || 0) * 1.5).toFixed(1) + ' t', date: h.data, ts: h.timestamp })),
        ...loads.map(l => ({ type: 'exit', label: `Venda Romaneio #${l.id}`, amount: (Number(l.peso || 0) / 1000).toFixed(1) + ' t', date: l.data, ts: new Date(l.data.split('/').reverse().join('-')).getTime() }))
    ].sort((a, b) => b.ts - a.ts);

    const filterType = document.getElementById('stock-filter-type')?.value || 'all';
    const filtered = movements.filter(m => filterType === 'all' || m.type === filterType);

    list.innerHTML = filtered.slice(0, 10).map(m => `
        <div class="stock-item ${m.type}">
            <div class="type-icon"><i data-lucide="${m.type === 'entry' ? 'plus-circle' : 'minus-circle'}"></i></div>
            <div class="info">
                <h6>${m.label}</h6>
                <span>${m.date}</span>
            </div>
            <div class="amount">${m.type === 'entry' ? '+' : '-'}${m.amount}</div>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
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
        elAlertBadge.innerText = count > 0 ? `${count} MANUTENÇÕES PENDENTES` : "SISTEMA INTEGRALMENTE OPERACIONAL";
        elAlertBadge.className = count > 0 ? "status-badge danger" : "status-badge success";
    }
}

// Charts Logic
function renderCharts() {
    const prodCtx = document.getElementById('prodChart');
    const loadsCtx = document.getElementById('loadsChart');
    if (!prodCtx || !loadsCtx) return;

    if (prodChart) prodChart.destroy();
    if (loadsChart) loadsChart.destroy();

    prodChart = new Chart(prodCtx, {
        type: 'line',
        data: {
            labels: ['S1', 'S2', 'S3', 'S4'],
            datasets: [{
                label: 'Carbonização (t)',
                data: [12.5, 18.2, 14.8, 21.0],
                borderColor: PRIMARY_COLOR,
                backgroundColor: 'rgba(204, 9, 47, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointBackgroundColor: PRIMARY_COLOR
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } }
        }
    });

    loadsChart = new Chart(loadsCtx, {
        type: 'bar',
        data: {
            labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
            datasets: [{
                label: 'Cargas',
                data: [4, 7, 5, 8, 12, 9, 6],
                backgroundColor: PRIMARY_COLOR,
                borderRadius: 6
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
                if (id === 'kiln' || id === 'load') hideModal(id);
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
        if ((fd.get('obs') || "").toLowerCase().includes('problema')) {
            maintenance.push({ praca: entry.praca, forno: entry.modelo, problema: fd.get('obs'), resolved: false, timestamp: Date.now() });
        }
    }
    if (id === 'load') loads.push({ id: 1000 + loads.length + 1, data: new Date().toLocaleDateString('pt-BR'), hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), placa: fd.get('placa').toUpperCase(), motorista: fd.get('motorista'), metragem: fd.get('metragem'), peso: fd.get('peso'), destino: fd.get('destino') });
    if (id === 'maintenance') {
        const target = fd.get('kiln_target').split(' — ');
        maintenance.push({ 
            data: fd.get('repair_date'), 
            praca: target[0], 
            forno: target[1], 
            servico: fd.get('issue_type'), 
            custo: fd.get('cost'), 
            notes: fd.get('maint_notes'),
            resolved: true, 
            timestamp: Date.now() 
        });
    }
}

function resolveMaint(ts) {
    maintenance = maintenance.map(m => m.timestamp.toString() === ts ? { ...m, resolved: true } : m);
    saveAll();
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
    try {
        const start = document.getElementById(`report-${type}-start`)?.value;
        const end = document.getElementById(`report-${type}-end`)?.value;

        const filterData = (data, dateKey = 'data') => {
            if (!start && !end) return data;
            return data.filter(item => {
                const itemDateStr = item[dateKey].split('/').reverse().join('-');
                const itemDate = new Date(itemDateStr).getTime();
                const startDate = start ? new Date(start).getTime() : 0;
                const endDate = end ? new Date(end).getTime() : Infinity;
                return itemDate >= startDate && itemDate <= endDate;
            });
        };

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(204, 9, 47);
        doc.rect(0, 0, 210, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text("CARBONIZE - GESTÃO INDUSTRIAL", 14, 10);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.text("Relatório de " + type.toUpperCase(), 14, 30);
        doc.setFontSize(10);
        doc.text(`Período: ${start || 'Início'} até ${end || 'Hoje'}`, 14, 38);
        doc.text("Emissão: " + new Date().toLocaleString(), 14, 44);
        
        let tableData = [];
        let columns = [];
        if (type === 'loads') {
            columns = ["ID", "Data", "Placa", "Metragem", "Peso (kg)"];
            const filtered = filterData(loads);
            tableData = filtered.map(l => [l.id, l.data, l.placa, l.metragem, l.peso]);
        } else if (type === 'pracas') {
            columns = ["Data", "Unidade", "Forno", "V/C/C/E", "Obs"];
            const filtered = filterData(history);
            tableData = filtered.map(h => [h.data, h.praca, h.modelo, `${h.vazios}/${h.cheios}/${h.carbonizando}/${h.esfriando}`, h.obs]);
        } else if (type === 'maint') {
            columns = ["Data", "Forno", "Serviço", "Custo (R$)", "Obs"];
            const filtered = filterData(maintenance, 'data');
            tableData = filtered.map(m => [m.data, m.forno, m.servico, m.custo, m.notes || '']);
        } else if (type === 'stock') {
            columns = ["Data", "Tipo", "Descrição", "Volume"];
            const filteredLoads = filterData(loads).map(l => [l.data, 'SAÍDA', `Venda #${l.id}`, `-${(l.peso/1000).toFixed(1)}t`]);
            const filteredHist = filterData(history).map(h => [h.data, 'ENTRADA', `Produção ${h.modelo}`, `+${(h.carbonizando*1.5).toFixed(1)}t`]);
            tableData = [...filteredHist, ...filteredLoads].sort((a,b) => new Date(b[0].split('/').reverse().join('-')) - new Date(a[0].split('/').reverse().join('-')));
        }
        
        doc.autoTable({ 
            startY: 50, 
            head: [columns], 
            body: tableData, 
            theme: 'grid', 
            headStyles: { fillColor: [204, 9, 47] },
            styles: { fontSize: 9 }
        });
        
        if (print) {
            window.open(doc.output('bloburl'), '_blank');
        } else {
            doc.save(`carbonize_${type}_${new Date().toISOString().split('T')[0]}.pdf`);
        }
    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Erro ao gerar relatório. Verifique os dados.");
    }
}
