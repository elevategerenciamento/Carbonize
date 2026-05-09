// State Management
let kilns = JSON.parse(localStorage.getItem('carboniza_kilns')) || [];
let loads = JSON.parse(localStorage.getItem('carboniza_loads')) || [];
let history = JSON.parse(localStorage.getItem('carboniza_history')) || [];
let maintenance = JSON.parse(localStorage.getItem('carboniza_maint')) || [];

// Constants
const TOAST_DURATION = 2000;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
});

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('current-date').innerText = now.toLocaleDateString('pt-BR', options);
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    
    document.getElementById('greeting').innerText = `${greeting}, Operador`;
}

// Tab Navigation
function switchTab(tab) {
    const sections = document.querySelectorAll('.content-section');
    const navItems = document.querySelectorAll('.nav-item');

    sections.forEach(s => s.style.display = 'none');
    navItems.forEach(n => n.classList.remove('active'));

    const activeSection = document.getElementById(`section-${tab}`);
    if (activeSection) activeSection.style.display = 'block';

    navItems.forEach(n => {
        if (n.innerText.toLowerCase().includes(tab)) n.classList.add('active');
    });

    renderAll();
}

// Modal Logic
function showModal(type) {
    document.getElementById(`modal-${type}`).style.display = 'flex';
}

function hideModal(type) {
    document.getElementById(`modal-${type}`).style.display = 'none';
    document.getElementById(`form-${type}`).reset();
}

// Global Render
function renderAll() {
    updateKPIs();
    updateSelectors();
    renderDashboard();
    renderKilnHistory();
    renderLoadsTable();
    renderMaintenance();
    renderStock();
    updateMaintBadge();
}

function updateKPIs() {
    // Fornos
    document.getElementById('kpi-fornos-ativos').innerText = kilns.length;
    document.getElementById('kpi-fornos-total').innerText = `de ${kilns.length} cadastrados`;

    // Cargas hoje
    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today);
    const totalKgToday = todayLoads.reduce((sum, l) => sum + Number(l.peso), 0);
    
    document.getElementById('kpi-cargas-hoje').innerText = todayLoads.length;
    document.getElementById('kpi-kg-hoje').innerText = `${totalKgToday.toLocaleString()} kg despachados`;

    // Produção / Mês (Estimativa baseada em cargas)
    const currentMonth = new Date().getMonth();
    const monthLoads = loads.filter(l => new Date(l.data.split('/').reverse().join('-')).getMonth() === currentMonth);
    const totalTons = (monthLoads.reduce((sum, l) => sum + Number(l.peso), 0) / 1000).toFixed(1);
    
    document.getElementById('kpi-prod-mes').innerText = `${totalTons} t`;

    // Manutenções
    const openMaint = maintenance.filter(m => !m.resolved).length;
    document.getElementById('kpi-maint').innerText = openMaint;
}

function renderDashboard() {
    const pracasList = document.getElementById('dashboard-pracas-list');
    pracasList.innerHTML = '';

    // Group kilns by praca for summary
    const pracaGroups = {};
    kilns.forEach(k => {
        if (!pracaGroups[k.praca]) pracaGroups[k.praca] = { vazios: 0, cheios: 0, carbon: 0, esfria: 0, total: 0 };
        // We get status from history or latest entry
        const latest = history.filter(h => h.praca === k.praca).sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latest) {
            pracaGroups[k.praca].vazios += Number(latest.vazios);
            pracaGroups[k.praca].cheios += Number(latest.cheios);
            pracaGroups[k.praca].carbon += Number(latest.carbonizando);
            pracaGroups[k.praca].esfria += Number(latest.esfriando);
        }
        pracaGroups[k.praca].total++;
    });

    Object.keys(pracaGroups).forEach(pracaName => {
        const group = pracaGroups[pracaName];
        const card = document.createElement('div');
        card.className = 'praca-mini-card';
        card.innerHTML = `
            <div class="praca-mini-header">
                <div class="praca-mini-info">
                    <h5>${pracaName}</h5>
                    <span>Responsável: Ricardo</span>
                </div>
                <span class="badge-status status-normal">Normal</span>
            </div>
            <div class="mini-stats-row">
                <div class="mini-stat-item"><span class="val">${group.vazios}</span><span class="lbl">Vazios</span></div>
                <div class="mini-stat-item"><span class="val">${group.cheios}</span><span class="lbl">Cheios</span></div>
                <div class="mini-stat-item"><span class="val">${group.carbon}</span><span class="lbl">Carbon.</span></div>
                <div class="mini-stat-item"><span class="val">${group.esfria}</span><span class="lbl">Esfria</span></div>
            </div>
        `;
        pracasList.appendChild(card);
    });

    // Dashboard Loads
    const dashLoads = document.getElementById('dashboard-loads-list');
    dashLoads.innerHTML = '';
    loads.slice(-5).reverse().forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="#" class="id-link">#${l.id}</a></td>
            <td>${l.hora}</td>
            <td>${l.placa}</td>
            <td>${l.peso} kg</td>
        `;
        dashLoads.appendChild(tr);
    });
}

function updateSelectors() {
    const dailyPraca = document.getElementById('daily-praca-select');
    const maintKiln = document.getElementById('maint-kiln-select');
    
    const uniquePracas = [...new Set(kilns.map(k => k.praca))];
    
    dailyPraca.innerHTML = '<option value="">Selecione a praça</option>' + 
        uniquePracas.map(p => `<option value="${p}">${p}</option>`).join('');
        
    maintKiln.innerHTML = '<option value="">Selecione o forno</option>' + 
        kilns.map(k => `<option value="${k.praca} - ${k.modelo}">${k.praca} — ${k.modelo}</option>`).join('');
}

function renderKilnHistory() {
    const list = document.getElementById('kiln-history-list');
    list.innerHTML = '';
    
    history.slice(-10).reverse().forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${h.data}</td>
            <td>${h.praca}</td>
            <td>${h.modelo}</td>
            <td>${h.carbonizando}</td>
            <td><small>${h.obs || '—'}</small></td>
        `;
        list.appendChild(tr);
    });

    // Totals in Praças Section
    const totals = history.reduce((acc, h) => {
        acc.v += Number(h.vazios);
        acc.c += Number(h.cheios);
        acc.ca += Number(h.carbonizando);
        acc.e += Number(h.esfriando);
        return acc;
    }, { v: 0, c: 0, ca: 0, e: 0 });

    document.getElementById('total-vazios').innerText = totals.v;
    document.getElementById('total-cheios').innerText = totals.c;
    document.getElementById('total-carbon').innerText = totals.ca;
    document.getElementById('total-esfria').innerText = totals.e;
}

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    list.innerHTML = '';
    
    const today = new Date().toLocaleDateString('pt-BR');
    document.getElementById('loads-today-date').innerText = today;

    const todayLoads = loads.filter(l => l.data === today).reverse();
    
    todayLoads.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="#" class="id-link">#${l.id}</a></td>
            <td>${l.data}</td>
            <td>${l.hora}</td>
            <td>${l.placa}</td>
            <td>${l.motorista}</td>
            <td><span class="badge-status status-normal">${l.tipo}</span></td>
            <td>${l.metragem} m³</td>
            <td>${Number(l.peso).toLocaleString()}</td>
            <td>${l.destino}</td>
        `;
        list.appendChild(tr);
    });

    document.getElementById('loads-count-summary').innerText = `${todayLoads.length} cargas`;
    document.getElementById('loads-total-m3').innerText = `Total: ${todayLoads.reduce((s, l) => s + Number(l.metragem), 0).toFixed(1)} m³`;
    document.getElementById('loads-total-kg').innerText = `Peso total: ${todayLoads.reduce((s, l) => s + Number(l.peso), 0).toLocaleString()} kg`;
}

function renderMaintenance() {
    const openList = document.getElementById('open-issues-list');
    const historyList = document.getElementById('maint-history-list');
    
    openList.innerHTML = '';
    historyList.innerHTML = '';

    maintenance.filter(m => !m.resolved).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.praca}</td>
            <td>${m.forno}</td>
            <td>${m.problema}</td>
            <td><span class="badge-status status-urgent">Aguardando</span></td>
        `;
        openList.appendChild(tr);
    });

    maintenance.filter(m => m.resolved).slice(-5).reverse().forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.data}</td>
            <td>${m.forno}</td>
            <td>${m.servico}</td>
            <td>R$ ${Number(m.custo).toLocaleString('pt-BR')}</td>
        `;
        historyList.appendChild(tr);
    });
}

function renderStock() {
    const totalIn = history.reduce((acc, h) => acc + Number(h.carbonizando), 0) * 1.5; // Estimativa simples m3 -> t
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso) / 1000), 0);
    const balance = Math.max(0, totalIn - totalOut).toFixed(1);

    document.getElementById('stock-balance').innerText = `${balance} t`;
    document.getElementById('stock-in').innerText = `${totalIn.toFixed(1)} t`;
    document.getElementById('stock-out').innerText = `${totalOut.toFixed(1)} t`;
}

function updateMaintBadge() {
    const count = maintenance.filter(m => !m.resolved).length;
    document.getElementById('maint-count').innerText = count;
    const alertBadge = document.getElementById('maint-alert-badge');
    if (count > 0) {
        alertBadge.style.display = 'block';
        alertBadge.innerText = `${count} fornos com problema`;
    } else {
        alertBadge.style.display = 'none';
    }
}

// Form Handlers
function setupForms() {
    // New Kiln (Base Config)
    document.getElementById('form-kiln').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        kilns.push({
            praca: fd.get('praca'),
            responsavel: fd.get('responsavel'),
            modelo: fd.get('modelo')
        });
        saveAll();
        hideModal('kiln');
        showToast();
    };

    // Daily Entry
    document.getElementById('form-kiln-daily').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const entry = {
            timestamp: Date.now(),
            data: new Date().toLocaleDateString('pt-BR'),
            praca: fd.get('praca_select'),
            modelo: fd.get('modelo_select'),
            vazios: fd.get('vazios'),
            cheios: fd.get('cheios'),
            carbonizando: fd.get('carbonizando'),
            esfriando: fd.get('esfriando'),
            obs: fd.get('obs')
        };
        history.push(entry);
        
        // If there's an observation, add to maintenance auto
        if (fd.get('obs').toLowerCase().includes('rachadura') || fd.get('obs').toLowerCase().includes('problema')) {
            maintenance.push({
                praca: entry.praca,
                forno: entry.modelo,
                problema: fd.get('obs'),
                resolved: false,
                timestamp: Date.now()
            });
        }
        
        saveAll();
        e.target.reset();
        showToast();
    };

    // New Load
    document.getElementById('form-load').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const now = new Date();
        loads.push({
            id: 10000 + loads.length + 1,
            data: now.toLocaleDateString('pt-BR'),
            hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            placa: fd.get('placa').toUpperCase(),
            motorista: fd.get('motorista'),
            tipo: fd.get('tipo'),
            metragem: fd.get('metragem'),
            peso: fd.get('peso'),
            destino: fd.get('destino')
        });
        saveAll();
        hideModal('load');
        showToast();
    };

    // Maintenance
    document.getElementById('form-maintenance').onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const target = fd.get('kiln_target').split(' — ');
        maintenance.push({
            data: fd.get('repair_date'),
            praca: target[0],
            forno: target[1],
            servico: fd.get('issue_type'),
            custo: fd.get('cost'),
            resolved: true,
            timestamp: Date.now()
        });
        saveAll();
        e.target.reset();
        showToast();
    };
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
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), TOAST_DURATION);
}

// PDF Generation
function generateReport(type, print = false) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Carbonize - Relatório de " + type.toUpperCase(), 14, 22);
    doc.setFontSize(10);
    doc.text("Gerado em: " + new Date().toLocaleString(), 14, 30);

    let tableData = [];
    let columns = [];

    if (type === 'loads') {
        columns = ["ID", "Data", "Placa", "Motorista", "Peso (kg)"];
        tableData = loads.map(l => [l.id, l.data, l.placa, l.motorista, l.peso]);
    } else if (type === 'pracas') {
        columns = ["Data", "Praça", "Modelo", "Carbonizando", "Obs"];
        tableData = history.map(h => [h.data, h.praca, h.modelo, h.carbonizando, h.obs]);
    }

    doc.autoTable({
        startY: 35,
        head: [columns],
        body: tableData,
        theme: 'striped',
        headStyles: { fillStyle: '#ff6b00' }
    });

    if (print) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(`carbonize_relatorio_${type}.pdf`);
    }
}
