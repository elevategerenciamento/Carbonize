console.log("Carbonize: app.js carregando...");

// State Management
let kilns = JSON.parse(localStorage.getItem('carboniza_kilns')) || [];
let loads = JSON.parse(localStorage.getItem('carboniza_loads')) || [];
let history = JSON.parse(localStorage.getItem('carboniza_history')) || [];
let maintenance = JSON.parse(localStorage.getItem('carboniza_maint')) || [];
let settings = JSON.parse(localStorage.getItem('carboniza_settings')) || { enterprise_name: 'FAZENDAPETKOV', access_email: 'fazendapetkov@carbonize.com' };

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
window.deleteKiln = deleteKiln;
window.editKiln = editKiln;
window.renderKilnAssets = renderKilnAssets;

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
        
        const dailyDateInput = document.getElementById('daily-date');
        if (dailyDateInput) dailyDateInput.value = new Date().toISOString().split('T')[0];

        renderAll();
        setupForms();
        setupFilters();
        setInterval(updateDateTime, 60000);
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
    const forms = ['kiln', 'kiln-daily', 'load', 'maintenance', 'settings'];
    forms.forEach(id => {
        const f = document.getElementById(`form-${id}`);
        if (f) {
            f.onsubmit = (e) => {
                e.preventDefault();
                processForm(id, new FormData(e.target));
                saveAll();
                if (id === 'kiln' || id === 'load' || id === 'settings') hideModal(id);
                e.target.reset();
                showToast();
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

function resolveMaint(ts) {
    maintenance = maintenance.map(m => m.timestamp.toString() === ts ? { ...m, resolved: true } : m);
    saveAll();
}

function saveAll() {
    localStorage.setItem('carboniza_kilns', JSON.stringify(kilns));
    localStorage.setItem('carboniza_loads', JSON.stringify(loads));
    localStorage.setItem('carboniza_history', JSON.stringify(history));
    localStorage.setItem('carboniza_maint', JSON.stringify(maintenance));
    localStorage.setItem('carboniza_settings', JSON.stringify(settings));
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
        doc.autoTable({ startY: 50, head: [columns], body: tableData, theme: 'grid', headStyles: { fillColor: [204, 9, 47] } });
        if (print) window.open(doc.output('bloburl'), '_blank'); else doc.save(`carbonize_${type}.pdf`);
    } catch (e) { alert("Erro ao gerar relatório."); }
}
