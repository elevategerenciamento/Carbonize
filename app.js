// State Management
let kilns = JSON.parse(localStorage.getItem('carboniza_kilns')) || [];
let loads = JSON.parse(localStorage.getItem('carboniza_loads')) || [];
let history = JSON.parse(localStorage.getItem('carboniza_history')) || [];
let maintenance = JSON.parse(localStorage.getItem('carboniza_maint')) || [];

// Constants
const TOAST_DURATION = 2000;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
});

function updateDateTime() {
    const elDate = document.getElementById('current-date');
    const elGreeting = document.getElementById('greeting');
    if (!elDate || !elGreeting) return;

    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    elDate.innerText = now.toLocaleDateString('pt-BR', options);
    
    const hour = now.getHours();
    let greeting = "Boa noite";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    
    elGreeting.innerText = `${greeting}, Operador`;
}

// Tab Navigation
function switchTab(tab) {
    console.log("Switching to tab:", tab);
    const sections = document.querySelectorAll('.content-section');
    const navItems = document.querySelectorAll('.nav-item');

    sections.forEach(s => s.style.display = 'none');
    navItems.forEach(n => n.classList.remove('active'));

    const activeSection = document.getElementById(`section-${tab}`);
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    navItems.forEach(n => {
        const btnText = n.innerText.toLowerCase();
        // More robust matching for accented words
        if (btnText.includes(tab) || 
            (tab === 'pracas' && btnText.includes('praças')) ||
            (tab === 'manutencao' && btnText.includes('manutenção')) ||
            (tab === 'relatorios' && btnText.includes('relatórios'))) {
            n.classList.add('active');
        }
    });

    renderAll();
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
    const elFornosTotal = document.getElementById('kpi-fornos-total');
    const elCargasHoje = document.getElementById('kpi-cargas-hoje');
    const elKgHoje = document.getElementById('kpi-kg-hoje');
    const elProdMes = document.getElementById('kpi-prod-mes');
    const elMaint = document.getElementById('kpi-maint');

    if (elFornosAtivos) elFornosAtivos.innerText = kilns.length;
    if (elFornosTotal) elFornosTotal.innerText = `de ${kilns.length} cadastrados`;

    const today = new Date().toLocaleDateString('pt-BR');
    const todayLoads = loads.filter(l => l.data === today);
    const totalKgToday = todayLoads.reduce((sum, l) => sum + Number(l.peso), 0);
    
    if (elCargasHoje) elCargasHoje.innerText = todayLoads.length;
    if (elKgHoje) elKgHoje.innerText = `${totalKgToday.toLocaleString()} kg despachados`;

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
    if (!pracasList) return;
    pracasList.innerHTML = '';

    const pracaGroups = {};
    kilns.forEach(k => {
        if (!pracaGroups[k.praca]) pracaGroups[k.praca] = { vazios: 0, cheios: 0, carbon: 0, esfria: 0, total: 0 };
        const latest = history.filter(h => h.praca === k.praca).sort((a, b) => b.timestamp - a.timestamp)[0];
        if (latest) {
            pracaGroups[k.praca].vazios += Number(latest.vazios || 0);
            pracaGroups[k.praca].cheios += Number(latest.cheios || 0);
            pracaGroups[k.praca].carbon += Number(latest.carbonizando || 0);
            pracaGroups[k.praca].esfria += Number(latest.esfriando || 0);
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

    const dashLoads = document.getElementById('dashboard-loads-list');
    if (dashLoads) {
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
}

function updateSelectors() {
    const dailyPraca = document.getElementById('daily-praca-select');
    const maintKiln = document.getElementById('maint-kiln-select');
    
    const uniquePracas = [...new Set(kilns.map(k => k.praca))];
    
    if (dailyPraca) {
        dailyPraca.innerHTML = '<option value="">Selecione a praça</option>' + 
            uniquePracas.map(p => `<option value="${p}">${p}</option>`).join('');
    }
        
    if (maintKiln) {
        maintKiln.innerHTML = '<option value="">Selecione o forno</option>' + 
            kilns.map(k => `<option value="${k.praca} - ${k.modelo}">${k.praca} — ${k.modelo}</option>`).join('');
    }
}

function renderKilnHistory() {
    const list = document.getElementById('kiln-history-list');
    if (!list) return;
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

    const totals = history.reduce((acc, h) => {
        acc.v += Number(h.vazios || 0);
        acc.c += Number(h.cheios || 0);
        acc.ca += Number(h.carbonizando || 0);
        acc.e += Number(h.esfriando || 0);
        return acc;
    }, { v: 0, c: 0, ca: 0, e: 0 });

    const elV = document.getElementById('total-vazios');
    const elC = document.getElementById('total-cheios');
    const elCa = document.getElementById('total-carbon');
    const elE = document.getElementById('total-esfria');

    if (elV) elV.innerText = totals.v;
    if (elC) elC.innerText = totals.c;
    if (elCa) elCa.innerText = totals.ca;
    if (elE) elE.innerText = totals.e;
}

function renderLoadsTable() {
    const list = document.getElementById('loads-table-body');
    if (!list) return;
    list.innerHTML = '';
    
    const today = new Date().toLocaleDateString('pt-BR');
    const elTodayDate = document.getElementById('loads-today-date');
    if (elTodayDate) elTodayDate.innerText = today;

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

    const elCount = document.getElementById('loads-count-summary');
    const elM3 = document.getElementById('loads-total-m3');
    const elKg = document.getElementById('loads-total-kg');

    if (elCount) elCount.innerText = `${todayLoads.length} cargas`;
    if (elM3) elM3.innerText = `Total: ${todayLoads.reduce((s, l) => s + Number(l.metragem || 0), 0).toFixed(1)} m³`;
    if (elKg) elKg.innerText = `Peso total: ${todayLoads.reduce((s, l) => s + Number(l.peso || 0), 0).toLocaleString()} kg`;
}

function renderMaintenance() {
    const openList = document.getElementById('open-issues-list');
    const historyList = document.getElementById('maint-history-list');
    
    if (openList) {
        openList.innerHTML = '';
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
    }

    if (historyList) {
        historyList.innerHTML = '';
        maintenance.filter(m => m.resolved).slice(-5).reverse().forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.data}</td>
                <td>${m.forno}</td>
                <td>${m.servico}</td>
                <td>R$ ${Number(m.custo || 0).toLocaleString('pt-BR')}</td>
            `;
            historyList.appendChild(tr);
        });
    }
}

function renderStock() {
    const totalIn = history.reduce((acc, h) => acc + Number(h.carbonizando || 0), 0) * 1.5;
    const totalOut = loads.reduce((acc, l) => acc + (Number(l.peso || 0) / 1000), 0);
    const balance = Math.max(0, totalIn - totalOut).toFixed(1);

    const elBalance = document.getElementById('stock-balance');
    const elIn = document.getElementById('stock-in');
    const elOut = document.getElementById('stock-out');

    if (elBalance) elBalance.innerText = `${balance} t`;
    if (elIn) elIn.innerText = `${totalIn.toFixed(1)} t`;
    if (elOut) elOut.innerText = `${totalOut.toFixed(1)} t`;
}

function updateMaintBadge() {
    const count = maintenance.filter(m => !m.resolved).length;
    const elCount = document.getElementById('maint-count');
    const elAlertBadge = document.getElementById('maint-alert-badge');

    if (elCount) elCount.innerText = count;
    if (elAlertBadge) {
        if (count > 0) {
            elAlertBadge.style.display = 'block';
            elAlertBadge.innerText = `${count} fornos com problema`;
        } else {
            elAlertBadge.style.display = 'none';
        }
    }
}

// Form Handlers
function setupForms() {
    const fKiln = document.getElementById('form-kiln');
    const fDaily = document.getElementById('form-kiln-daily');
    const fLoad = document.getElementById('form-load');
    const fMaint = document.getElementById('form-maintenance');

    if (fKiln) {
        fKiln.onsubmit = (e) => {
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
    }

    if (fDaily) {
        fDaily.onsubmit = (e) => {
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
            
            const obs = (fd.get('obs') || "").toLowerCase();
            if (obs.includes('rachadura') || obs.includes('problema')) {
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
    }

    if (fLoad) {
        fLoad.onsubmit = (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const now = new Date();
            loads.push({
                id: 10000 + loads.length + 1,
                data: now.toLocaleDateString('pt-BR'),
                hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                placa: (fd.get('placa') || "").toUpperCase(),
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
    }

    if (fMaint) {
        fMaint.onsubmit = (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const targetVal = fd.get('kiln_target') || "";
            const target = targetVal.split(' — ');
            maintenance.push({
                data: fd.get('repair_date'),
                praca: target[0] || "Desconhecido",
                forno: target[1] || "Desconhecido",
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
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), TOAST_DURATION);
    }
}

// PDF Generation
window.generateReport = function(type, print = false) {
    try {
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
        } else {
            // Default empty for other types
            columns = ["Info"];
            tableData = [["Relatório em desenvolvimento"]];
        }

        doc.autoTable({
            startY: 35,
            head: [columns],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [255, 107, 0] }
        });

        if (print) {
            doc.autoPrint();
            window.open(doc.output('bloburl'), '_blank');
        } else {
            doc.save(`carbonize_relatorio_${type}.pdf`);
        }
    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Erro ao gerar PDF. Verifique se o navegador bloqueou pop-ups.");
    }
}
