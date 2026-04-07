/**
 * EcoBudget - Logic Script
 */

// --- Data Management ---
const DEFAULT_INCOMES = [];
const DEFAULT_EXPENSES = [
    { id: 1, name: 'Transport', amount: 0, type: 'fixed', icon: '🚌', color: '#3498db' },
    { id: 2, name: 'Loyer / Maison', amount: 0, type: 'fixed', icon: '🏠', color: '#e67e22' },
    { id: 3, name: 'Abonnement téléphonique', amount: 0, type: 'fixed', icon: '📱', color: '#9b59b6' },
    { id: 4, name: 'Fast food & Restaurant', amount: 0, type: 'variable', icon: '🍔', color: '#e74c3c' }
];
const DEFAULT_GOALS = [
    { id: 1, name: 'Logement', target: 171500, current: 0, monthly: 0, priority: 1, type: 'moyen', icon: '🏠', color: '#2ecc71' },
    { id: 2, name: 'Véhicule', target: 2000000, current: 0, monthly: 0, priority: 2, type: 'long', icon: '🚗', color: '#3498db' }
];

let incomes = JSON.parse(localStorage.getItem('eco_incomes')) || [...DEFAULT_INCOMES];
let expenses = JSON.parse(localStorage.getItem('eco_expenses')) || [...DEFAULT_EXPENSES];
let goals = JSON.parse(localStorage.getItem('eco_goals')) || [...DEFAULT_GOALS];
let dailyEntries = JSON.parse(localStorage.getItem('eco_daily_entries')) || [];

// --- State ---
let currentViewMonth = new Date().getMonth();
let currentViewYear = new Date().getFullYear();
let historyCompareMonths = []; // Array of "YYYY-MM" strings

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initMonthContext();
    checkFirstLaunch();
    updateUI();
    setupForms();
    setupSimulator();
    setupDailyTab();
    setupHistoryTab();
});

function checkFirstLaunch() {
    const hasLaunched = localStorage.getItem('eco_launched');
    if (!hasLaunched) {
        document.getElementById('welcome-screen').classList.remove('hidden');
    }
}

window.startApp = () => {
    localStorage.setItem('eco_launched', 'true');
    document.getElementById('welcome-screen').classList.add('hidden');
    // Redirect to Income tab
    const incomeBtn = document.querySelector('[data-tab="income"]');
    if (incomeBtn) incomeBtn.click();
};

window.confirmReset = () => {
    if (confirm('Êtes-vous sûr ? Cette action est irréversible.')) {
        if (confirm('Confirmez-vous la suppression de TOUTES vos données ?')) {
            resetAllData();
        }
    }
};

function resetAllData() {
    incomes = [...DEFAULT_INCOMES];
    expenses = [...DEFAULT_EXPENSES];
    goals = [...DEFAULT_GOALS];
    dailyEntries = [];
    saveToStorage();
    location.reload(); // Simplest way to reset everything
}

function saveToStorage() {
    localStorage.setItem('eco_incomes', JSON.stringify(incomes));
    localStorage.setItem('eco_expenses', JSON.stringify(expenses));
    localStorage.setItem('eco_goals', JSON.stringify(goals));
    localStorage.setItem('eco_daily_entries', JSON.stringify(dailyEntries));
    localStorage.setItem('eco_launched', 'true'); // Ensure welcome screen doesn't show after first save
}

function initMonthContext() {
    const now = new Date();
    currentViewMonth = now.getMonth();
    currentViewYear = now.getFullYear();
    checkAndInjectFixedExpenses(currentViewMonth, currentViewYear);
}

function checkAndInjectFixedExpenses(month, year) {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthEntries = dailyEntries.filter(e => e.date.startsWith(monthStr));
    
    // Check if fixed expenses already exist for this month
    const hasFixed = monthEntries.some(e => e.isFixed);
    
    if (!hasFixed) {
        const fixedTemplates = expenses.filter(exp => exp.type === 'fixed' && exp.amount > 0);
        fixedTemplates.forEach(template => {
            dailyEntries.push({
                id: Date.now() + Math.random(),
                date: `${monthStr}-01`,
                type: 'expense',
                amount: template.amount,
                category: template.name,
                description: 'Dépense fixe automatique',
                isFixed: true,
                templateId: template.id
            });
        });
        saveToStorage();
    }
}

// --- Tab Logic ---
function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Refresh charts if needed
            if (tabId === 'income') renderIncomeCharts();
            if (tabId === 'expenses') renderExpenseCharts();
            if (tabId === 'dashboard') renderDashboardCharts();
            if (tabId === 'daily') renderDailyTab();
            if (tabId === 'history') renderHistoryTab();
        });
    });
}

// --- Calculations ---
function getMonthlyIncome() {
    return incomes.reduce((total, inc) => {
        switch (inc.frequency) {
            case 'weekly': return total + (inc.amount * 4.33);
            case 'monthly': return total + inc.amount;
            case 'quarterly': return total + (inc.amount / 3);
            case 'semiannual': return total + (inc.amount / 6);
            case 'annual': return total + (inc.amount / 12);
            default: return total;
        }
    }, 0);
}

function getTotalExpenses() {
    return expenses.reduce((total, exp) => total + exp.amount, 0);
}

function getTotalSavings() {
    return goals.reduce((total, g) => total + g.current, 0);
}

function getFinancialHealth(ratio) {
    if (ratio > 0.4) return { text: '💎 Excellente', class: 'bg-success' };
    if (ratio > 0.2) return { text: '🟢 Bonne', class: 'bg-success' };
    if (ratio > 0.05) return { text: '🟠 Attention', class: 'bg-warning' };
    return { text: '🔴 Critique', class: 'bg-danger' };
}

// --- UI Updates ---
function updateUI() {
    const monthlyIncome = getMonthlyIncome();
    const totalExpenses = getTotalExpenses();
    
    // Calculate real monthly spending from daily entries for CURRENT REAL MONTH
    const now = new Date();
    const realMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const currentMonthEntries = dailyEntries.filter(e => e.date.startsWith(realMonthStr));
    
    const realMonthlyExpenses = currentMonthEntries
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
        
    const realMonthlySavings = currentMonthEntries
        .filter(e => e.type === 'saving')
        .reduce((sum, e) => sum + e.amount, 0);

    const available = monthlyIncome - totalExpenses;
    const totalSaved = getTotalSavings();
    
    // Dashboard
    document.getElementById('dash-income').textContent = formatCurrency(monthlyIncome);
    document.getElementById('dash-expenses').textContent = formatCurrency(realMonthlyExpenses);
    document.getElementById('dash-available').textContent = formatCurrency(monthlyIncome - realMonthlyExpenses);
    document.getElementById('dash-available').className = (monthlyIncome - realMonthlyExpenses) >= 0 ? 'amount text-success' : 'amount text-danger';
    document.getElementById('dash-savings').textContent = formatCurrency(totalSaved);
    
    const health = getFinancialHealth((monthlyIncome - realMonthlyExpenses) / monthlyIncome);
    const healthBadge = document.getElementById('health-badge');
    healthBadge.textContent = 'Santé : ' + health.text;
    healthBadge.style.backgroundColor = health.class === 'bg-success' ? '#2ecc71' : (health.class === 'bg-warning' ? '#f39c12' : '#e74c3c');
    healthBadge.style.color = 'white';

    // Prime Banner
    const currentMonth = new Date().getMonth() + 1;
    const isPrimeMonth = [3, 6, 9, 12].includes(currentMonth);
    const banner = document.getElementById('bonus-banner');
    if (isPrimeMonth) banner.classList.remove('hidden');
    else banner.classList.add('hidden');

    // Countdown
    const nextPrimeMonth = [3, 6, 9, 12].find(m => m >= currentMonth) || 3;
    const diff = nextPrimeMonth >= currentMonth ? nextPrimeMonth - currentMonth : (12 - currentMonth + 3);
    document.getElementById('prime-countdown').textContent = diff === 0 ? "C'est ce mois-ci !" : `${diff} mois`;
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    document.getElementById('prime-month-name').textContent = monthNames[nextPrimeMonth - 1];

    renderGoalsList();
    renderIncomeList();
    renderExpenseList();
    renderSavingsGoals();
    updateRule503020();
    
    if (document.getElementById('dashboard').classList.contains('active')) renderDashboardCharts();
    
    saveToStorage();
}

function formatCurrency(num) {
    return Math.round(num).toLocaleString('fr-FR') + ' DA';
}

// --- Lists Rendering ---
function renderGoalsList() {
    const container = document.getElementById('dash-goals-list');
    container.innerHTML = '';
    
    goals.forEach(goal => {
        const percent = Math.min(100, (goal.current / goal.target) * 100);
        const div = document.createElement('div');
        div.className = 'goal-progress-item';
        div.innerHTML = `
            <div class="allocation-info">
                <span>${goal.icon} ${goal.name}</span>
                <span>${Math.round(percent)}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%; background: ${goal.color}"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderIncomeList() {
    const container = document.getElementById('income-list');
    container.innerHTML = '';
    
    incomes.forEach(inc => {
        let monthly = inc.amount;
        if (inc.frequency === 'weekly') monthly *= 4.33;
        if (inc.frequency === 'quarterly') monthly /= 3;
        if (inc.frequency === 'semiannual') monthly /= 6;
        if (inc.frequency === 'annual') monthly /= 12;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="item-info">
                    <div class="item-icon" style="background: ${inc.color}20; color: ${inc.color}">${inc.icon}</div>
                    <span>${inc.name}</span>
                </div>
            </td>
            <td>${formatCurrency(inc.amount)}</td>
            <td>${translateFreq(inc.frequency)}</td>
            <td>${formatCurrency(monthly)}</td>
            <td>
                <button class="btn-icon" onclick="editIncome(${inc.id})">✏️</button>
                <button class="btn-icon delete" onclick="deleteIncome(${inc.id})">🗑️</button>
            </td>
        `;
        container.appendChild(tr);
    });
}

function renderExpenseList() {
    const container = document.getElementById('expense-list');
    container.innerHTML = '';
    const monthlyIncome = getMonthlyIncome();
    
    expenses.forEach(exp => {
        const percent = (exp.amount / monthlyIncome) * 100;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="item-info">
                    <div class="item-icon" style="background: ${exp.color}20; color: ${exp.color}">${exp.icon}</div>
                    <span>${exp.name}</span>
                </div>
            </td>
            <td>${formatCurrency(exp.amount)}</td>
            <td>${percent.toFixed(1)}%</td>
            <td>${exp.type === 'fixed' ? 'Fixe' : 'Variable'}</td>
            <td>
                <button class="btn-icon" onclick="editExpense(${exp.id})">✏️</button>
                <button class="btn-icon delete" onclick="deleteExpense(${exp.id})">🗑️</button>
            </td>
        `;
        container.appendChild(tr);
    });
    
    const available = monthlyIncome - getTotalExpenses();
    document.getElementById('remaining-life').textContent = formatCurrency(available);
    document.getElementById('remaining-life').style.color = available >= 0 ? '#2ecc71' : '#e74c3c';
}

function renderSavingsGoals() {
    const container = document.getElementById('savings-goals-grid');
    container.innerHTML = '';
    
    goals.forEach(goal => {
        const percent = Math.min(100, (goal.current / goal.target) * 100);
        const monthsLeft = goal.monthly > 0 ? Math.ceil((goal.target - goal.current) / goal.monthly) : Infinity;
        
        const card = document.createElement('div');
        card.className = 'card goal-card';
        card.innerHTML = `
            ${percent >= 100 ? '<span class="goal-badge">🏆 Atteint !</span>' : ''}
            <div class="card-header">
                <div class="item-info">
                    <div class="item-icon" style="background: ${goal.color}20; color: ${goal.color}">${goal.icon}</div>
                    <div>
                        <h3>${goal.name}</h3>
                        <small class="text-secondary">${goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} terme</small>
                    </div>
                </div>
            </div>
            <div class="progress-container">
                <div class="allocation-info">
                    <span>${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</span>
                    <span>${Math.round(percent)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%; background: ${goal.color}"></div>
                </div>
            </div>
            <div class="goal-details" style="margin-top: 15px; font-size: 0.85rem;">
                <div class="allocation-info">
                    <span class="text-secondary">Allocation mensuelle:</span>
                    <span class="text-main font-bold">${formatCurrency(goal.monthly)}</span>
                </div>
                <div class="allocation-info">
                    <span class="text-secondary">Temps estimé:</span>
                    <span class="text-main">${monthsLeft === Infinity ? 'Non défini' : monthsLeft + ' mois'}</span>
                </div>
            </div>
            <div class="btn-group" style="margin-top: 15px;">
                <button class="btn btn-secondary btn-sm" onclick="editGoal(${goal.id})">✏️ Modifier</button>
                <button class="btn btn-secondary btn-sm text-danger" onclick="deleteGoal(${goal.id})">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function translateFreq(f) {
    const map = { weekly: 'Hebdo', monthly: 'Mensuel', quarterly: 'Trimestriel', semiannual: 'Semestriel', annual: 'Annuel', unique: 'Unique' };
    return map[f] || f;
}

// --- Charts ---
let evolutionChart, incomePieChart, incomeBarChart, expenseChart;

function renderDashboardCharts() {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (evolutionChart) evolutionChart.destroy();
    
    const monthlyIncome = getMonthlyIncome();
    const exp = getTotalExpenses();
    
    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['M-5', 'M-4', 'M-3', 'M-2', 'M-1', 'Actuel'],
            datasets: [
                { label: 'Revenus', data: [monthlyIncome, monthlyIncome, monthlyIncome + 8000, monthlyIncome, monthlyIncome, monthlyIncome], borderColor: '#3498db', tension: 0.4, fill: false },
                { label: 'Dépenses', data: [exp - 2000, exp + 1000, exp, exp - 500, exp, exp], borderColor: '#e74c3c', tension: 0.4, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderIncomeCharts() {
    const pieCtx = document.getElementById('incomePieChart').getContext('2d');
    if (incomePieChart) incomePieChart.destroy();
    
    incomePieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: incomes.map(i => i.name),
            datasets: [{
                data: incomes.map(i => i.amount),
                backgroundColor: incomes.map(i => i.color)
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });

    const barCtx = document.getElementById('incomeBarChart').getContext('2d');
    if (incomeBarChart) incomeBarChart.destroy();
    
    const monthlyData = Array(12).fill(0);
    incomes.forEach(inc => {
        for(let i=0; i<12; i++) {
            if (inc.frequency === 'monthly') monthlyData[i] += inc.amount;
            else if (inc.frequency === 'quarterly' && (i+1) % 3 === 0) monthlyData[i] += inc.amount;
            else if (inc.frequency === 'semiannual' && (i+1) % 6 === 0) monthlyData[i] += inc.amount;
            else if (inc.frequency === 'annual' && i === 11) monthlyData[i] += inc.amount;
        }
    });

    incomeBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
            datasets: [{ label: 'Revenus DA', data: monthlyData, backgroundColor: '#3498db' }]
        }
    });
}

function renderExpenseCharts() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: expenses.map(e => e.name),
            datasets: [{
                data: expenses.map(e => e.amount),
                backgroundColor: expenses.map(e => e.color)
            }]
        },
        options: { plugins: { legend: { position: 'right' } } }
    });
}

// --- Rule 50/30/20 ---
function updateRule503020() {
    const income = getMonthlyIncome();
    const needs = expenses.filter(e => e.type === 'fixed').reduce((t, e) => t + e.amount, 0);
    const wants = expenses.filter(e => e.type === 'variable').reduce((t, e) => t + e.amount, 0);
    const savings = income - needs - wants;
    
    const pNeeds = Math.max(0, (needs / income) * 100);
    const pWants = Math.max(0, (wants / income) * 100);
    const pSavings = Math.max(0, (savings / income) * 100);
    
    document.getElementById('rule-needs').style.width = pNeeds + '%';
    document.getElementById('rule-wants').style.width = pWants + '%';
    document.getElementById('rule-savings').style.width = pSavings + '%';
    
    let status = "Équilibre correct";
    if (pNeeds > 55) status = "⚠️ Besoins trop élevés (>50%)";
    else if (pSavings < 15) status = "⚠️ Épargne insuffisante (<20%)";
    else if (pSavings > 25) status = "💎 Excellente capacité d'épargne";
    
    document.getElementById('rule-status').textContent = status;
}

// --- Modals & Forms ---
function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    document.getElementById('incomeForm').reset();
    document.getElementById('expenseForm').reset();
    document.getElementById('savingsForm').reset();
    document.getElementById('income-id').value = '';
    document.getElementById('expense-id').value = '';
    document.getElementById('savings-id').value = '';
}

window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
}

function setupForms() {
    document.getElementById('incomeForm').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('income-id').value;
        const data = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('income-name').value,
            amount: parseFloat(document.getElementById('income-amount').value),
            frequency: document.getElementById('income-frequency').value,
            icon: document.getElementById('income-icon').value,
            color: document.getElementById('income-color').value
        };
        
        if (id) {
            const idx = incomes.findIndex(i => i.id === data.id);
            incomes[idx] = data;
        } else {
            incomes.push(data);
        }
        closeModal('incomeModal');
        updateUI();
    };

    document.getElementById('expenseForm').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('expense-id').value;
        const data = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('expense-name').value,
            amount: parseFloat(document.getElementById('expense-amount').value),
            type: document.getElementById('expense-type').value,
            icon: document.getElementById('expense-icon').value,
            color: document.getElementById('expense-color').value
        };
        
        if (id) {
            const idx = expenses.findIndex(e => e.id === data.id);
            expenses[idx] = data;
        } else {
            expenses.push(data);
        }
        closeModal('expenseModal');
        updateUI();
    };

    document.getElementById('savingsForm').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('savings-id').value;
        const data = {
            id: id ? parseInt(id) : Date.now(),
            name: document.getElementById('savings-name').value,
            target: parseFloat(document.getElementById('savings-target').value),
            current: parseFloat(document.getElementById('savings-current').value),
            monthly: parseFloat(document.getElementById('savings-monthly').value),
            priority: parseInt(document.getElementById('savings-priority').value),
            type: parseFloat(document.getElementById('savings-target').value) > 500000 ? 'long' : 'moyen',
            icon: document.getElementById('savings-icon').value,
            color: document.getElementById('savings-color').value
        };
        
        if (id) {
            const idx = goals.findIndex(g => g.id === data.id);
            goals[idx] = data;
        } else {
            goals.push(data);
        }
        closeModal('savingsModal');
        updateUI();
    };
}

// --- CRUD Actions ---
window.deleteIncome = (id) => { if(confirm('Supprimer ce revenu ?')) { incomes = incomes.filter(i => i.id !== id); updateUI(); } };
window.deleteExpense = (id) => { if(confirm('Supprimer cette dépense ?')) { expenses = expenses.filter(e => e.id !== id); updateUI(); } };
window.deleteGoal = (id) => { if(confirm('Supprimer cet objectif ?')) { goals = goals.filter(g => g.id !== id); updateUI(); } };

window.editIncome = (id) => {
    const inc = incomes.find(i => i.id === id);
    document.getElementById('income-id').value = inc.id;
    document.getElementById('income-name').value = inc.name;
    document.getElementById('income-amount').value = inc.amount;
    document.getElementById('income-frequency').value = inc.frequency;
    document.getElementById('income-icon').value = inc.icon;
    document.getElementById('income-color').value = inc.color;
    document.getElementById('incomeModalTitle').textContent = 'Modifier la source';
    openModal('incomeModal');
};

window.editExpense = (id) => {
    const exp = expenses.find(e => e.id === id);
    document.getElementById('expense-id').value = exp.id;
    document.getElementById('expense-name').value = exp.name;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-type').value = exp.type;
    document.getElementById('expense-icon').value = exp.icon;
    document.getElementById('expense-color').value = exp.color;
    document.getElementById('expenseModalTitle').textContent = 'Modifier la catégorie';
    openModal('expenseModal');
};

window.editGoal = (id) => {
    const goal = goals.find(g => g.id === id);
    document.getElementById('savings-id').value = goal.id;
    document.getElementById('savings-name').value = goal.name;
    document.getElementById('savings-target').value = goal.target;
    document.getElementById('savings-current').value = goal.current;
    document.getElementById('savings-monthly').value = goal.monthly;
    document.getElementById('savings-priority').value = goal.priority;
    document.getElementById('savings-icon').value = goal.icon;
    document.getElementById('savings-color').value = goal.color;
    document.getElementById('savingsModalTitle').textContent = 'Modifier l\'objectif';
    openModal('savingsModal');
};

// --- Daily Tab Logic ---
let weeklyChart;

function setupDailyTab() {
    const picker = document.getElementById('month-picker');
    picker.addEventListener('change', (e) => {
        const [year, month] = e.target.value.split('-');
        currentViewMonth = parseInt(month) - 1;
        currentViewYear = parseInt(year);
        checkAndInjectFixedExpenses(currentViewMonth, currentViewYear);
        renderDailyTab();
    });

    document.getElementById('dailyForm').onsubmit = (e) => {
        e.preventDefault();
        saveDailyEntry();
    };

    document.getElementById('filter-type-daily').onchange = renderDailyHistory;
    document.getElementById('toggle-fixed-expenses').onchange = renderDailyHistory;
}

function toggleMonthPicker() {
    document.getElementById('month-picker').showPicker();
}

function resetToCurrentMonth() {
    const now = new Date();
    currentViewMonth = now.getMonth();
    currentViewYear = now.getFullYear();
    renderDailyTab();
}

function saveDailyEntry() {
    const date = document.getElementById('daily-date').value;
    const type = document.querySelector('input[name="daily-type"]:checked').value;
    const amount = parseFloat(document.getElementById('daily-amount').value);
    const categoryName = document.getElementById('daily-category').value;
    const desc = document.getElementById('daily-desc').value;

    if (!amount || !categoryName) return;

    // Smart Logic: Check if category exists
    if (type === 'expense') {
        const existingExp = expenses.find(e => e.name.toLowerCase() === categoryName.toLowerCase());
        if (!existingExp) {
            expenses.push({
                id: Date.now(),
                name: categoryName,
                amount: 0,
                type: 'variable',
                icon: '📌',
                color: '#95a5a6'
            });
        }
    } else {
        const existingGoal = goals.find(g => g.name.toLowerCase() === categoryName.toLowerCase());
        if (!existingGoal) {
            goals.push({
                id: Date.now(),
                name: categoryName,
                target: amount * 10,
                current: 0,
                monthly: 0,
                priority: 3,
                type: 'moyen',
                icon: '📌',
                color: '#95a5a6'
            });
        }
        const goal = goals.find(g => g.name.toLowerCase() === categoryName.toLowerCase());
        goal.current += amount;
    }

    const entry = {
        id: Date.now(),
        date,
        type,
        amount,
        category: categoryName,
        description: desc,
        isFixed: false
    };

    dailyEntries.unshift(entry);
    
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const status = document.getElementById('save-status');
    status.textContent = `✅ Enregistré dans ${monthNames[new Date(date).getMonth()]} ${new Date(date).getFullYear()} !`;
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2000);

    document.getElementById('daily-amount').value = '';
    document.getElementById('daily-desc').value = '';
    
    updateUI();
    renderDailyTab();
}

function renderDailyTab() {
    const now = new Date();
    const isCurrentMonth = currentViewMonth === now.getMonth() && currentViewYear === now.getFullYear();
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    
    const banner = document.getElementById('month-context-banner');
    const label = document.getElementById('current-view-month-label');
    const resetBtn = document.getElementById('btn-reset-month');
    
    label.textContent = `Saisie pour : ${monthNames[currentViewMonth]} ${currentViewYear}`;
    
    if (isCurrentMonth) {
        banner.classList.remove('warning');
        resetBtn.classList.add('hidden');
        document.getElementById('daily-date').valueAsDate = new Date();
    } else {
        banner.classList.add('warning');
        label.textContent = `⚠️ Vous saisissez sur : ${monthNames[currentViewMonth]} ${currentViewYear} — Ce n'est pas le mois actuel`;
        resetBtn.classList.remove('hidden');
        document.getElementById('daily-date').value = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}-01`;
    }

    renderCategoryDatalist();
    renderDailyHistory();
    renderComparison();
    renderWeeklyChart();
}

function renderCategoryDatalist() {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    
    const fixed = expenses.filter(e => e.type === 'fixed').map(e => e.name);
    const variable = expenses.filter(e => e.type === 'variable').map(e => e.name);
    const savings = goals.map(g => g.name);

    const groups = [
        { label: 'Dépenses fixes', items: fixed },
        { label: 'Dépenses variables', items: variable },
        { label: 'Objectifs épargne', items: savings }
    ];

    groups.forEach(group => {
        group.items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = group.label;
            list.appendChild(opt);
        });
    });
}

function renderDailyHistory() {
    const container = document.getElementById('daily-history-list');
    container.innerHTML = '';
    
    const filterType = document.getElementById('filter-type-daily').value;
    const includeFixed = document.getElementById('toggle-fixed-expenses').checked;
    
    const monthStr = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
    let filtered = dailyEntries.filter(e => e.date.startsWith(monthStr));

    if (!includeFixed) {
        filtered = filtered.filter(e => !e.isFixed);
    }

    if (filterType === 'fixed') filtered = filtered.filter(e => e.isFixed);
    else if (filterType === 'manual') filtered = filtered.filter(e => !e.isFixed && e.type === 'expense');
    else if (filterType === 'saving') filtered = filtered.filter(e => e.type === 'saving');

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(entry => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(entry.date).toLocaleDateString('fr-FR')}</td>
            <td>
                <div class="item-info">
                    <span class="text-secondary">${entry.type === 'expense' ? '💸' : '💰'}</span>
                    <span>${entry.category} ${entry.isFixed ? '<span class="badge-fixed">🔒 Fixe</span>' : ''}</span>
                </div>
                <small class="text-secondary">${entry.description || ''}</small>
            </td>
            <td class="${entry.type === 'expense' ? 'text-danger' : 'text-success'} font-bold">
                ${formatCurrency(entry.amount)}
            </td>
            <td>
                ${entry.isFixed ? `<button class="btn-icon" onclick="editFixedEntry(${entry.id})">✏️</button>` : ''}
                <button class="btn-icon delete" onclick="deleteDailyEntry(${entry.id})">🗑️</button>
            </td>
        `;
        container.appendChild(tr);
    });
}

window.editFixedEntry = (id) => {
    const entry = dailyEntries.find(e => e.id === id);
    const newAmount = prompt(`Modifier le montant de ${entry.category} pour ce mois uniquement :`, entry.amount);
    if (newAmount !== null && !isNaN(newAmount)) {
        entry.amount = parseFloat(newAmount);
        saveToStorage();
        updateUI();
        renderDailyTab();
    }
};

window.deleteDailyEntry = (id) => {
    if (confirm('Supprimer cette saisie ?')) {
        const entry = dailyEntries.find(e => e.id === id);
        if (entry && entry.type === 'saving') {
            const goal = goals.find(g => g.name.toLowerCase() === entry.category.toLowerCase());
            if (goal) goal.current -= entry.amount;
        }
        dailyEntries = dailyEntries.filter(e => e.id !== id);
        saveToStorage();
        updateUI();
        renderDailyTab();
    }
};

function renderComparison() {
    const monthStr = `${currentViewYear}-${String(currentViewMonth + 1).padStart(2, '0')}`;
    const monthEntries = dailyEntries.filter(e => e.date.startsWith(monthStr));

    const realExp = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const realSav = monthEntries.filter(e => e.type === 'saving').reduce((s, e) => s + e.amount, 0);
    
    const plannedExp = getTotalExpenses();
    const plannedSav = goals.reduce((s, g) => s + g.monthly, 0);

    const container = document.getElementById('monthly-comparison-stats');
    container.innerHTML = `
        <div class="comp-item">
            <span class="label">Dépenses réelles</span>
            <span class="value">${formatCurrency(realExp)}</span>
            <span class="diff ${realExp > plannedExp ? 'text-danger' : 'text-success'}">
                ${plannedExp > 0 ? ((realExp / plannedExp) * 100).toFixed(0) : 0}% du budget
            </span>
        </div>
        <div class="comp-item">
            <span class="label">Épargne réelle</span>
            <span class="value">${formatCurrency(realSav)}</span>
            <span class="diff ${realSav >= plannedSav ? 'text-success' : 'text-warning'}">
                ${plannedSav > 0 ? ((realSav / plannedSav) * 100).toFixed(0) : 0}% de l'objectif
            </span>
        </div>
    `;
}

function renderWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    if (weeklyChart) weeklyChart.destroy();

    const days = [];
    const data = [];
    const now = new Date();
    const viewDate = new Date(currentViewYear, currentViewMonth, 15); // Middle of view month

    for (let i = 6; i >= 0; i--) {
        const d = new Date(viewDate);
        d.setDate(viewDate.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
        
        const dayTotal = dailyEntries
            .filter(e => e.date === dateStr && e.type === 'expense')
            .reduce((s, e) => s + e.amount, 0);
        data.push(dayTotal);
    }

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [{
                label: 'Dépenses (DA)',
                data: data,
                backgroundColor: '#3498db',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- History Tab Logic ---
let historyPieChart, historyBarChart, evolution12mChart, comparisonGroupedChart;
let historyViewMonth = new Date().getMonth();
let historyViewYear = new Date().getFullYear();

function setupHistoryTab() {
    const select = document.getElementById('history-month-select');
    select.addEventListener('change', (e) => {
        const [year, month] = e.target.value.split('-');
        historyViewMonth = parseInt(month) - 1;
        historyViewYear = parseInt(year);
        renderHistoryTab();
    });
}

function changeHistoryMonth(dir) {
    historyViewMonth += dir;
    if (historyViewMonth > 11) { historyViewMonth = 0; historyViewYear++; }
    if (historyViewMonth < 0) { historyViewMonth = 11; historyViewYear--; }
    renderHistoryTab();
}

function resetHistoryToCurrent() {
    const now = new Date();
    historyViewMonth = now.getMonth();
    historyViewYear = now.getFullYear();
    renderHistoryTab();
}

function renderHistoryTab() {
    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    document.getElementById('history-month-label').textContent = `${monthNames[historyViewMonth]} ${historyViewYear}`;
    
    const monthStr = `${historyViewYear}-${String(historyViewMonth + 1).padStart(2, '0')}`;
    const monthEntries = dailyEntries.filter(e => e.date.startsWith(monthStr));
    
    const income = getMonthlyIncome();
    const expensesTotal = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const savingsTotal = monthEntries.filter(e => e.type === 'saving').reduce((s, e) => s + e.amount, 0);
    const balance = income - expensesTotal;

    document.getElementById('hist-income').textContent = formatCurrency(income);
    document.getElementById('hist-expenses').textContent = formatCurrency(expensesTotal);
    document.getElementById('hist-savings').textContent = formatCurrency(savingsTotal);
    document.getElementById('hist-balance').textContent = formatCurrency(balance);
    document.getElementById('hist-balance').className = balance >= 0 ? 'amount text-success' : 'amount text-danger';
    
    const rate = income > 0 ? (savingsTotal / income) * 100 : 0;
    document.getElementById('hist-savings-rate').textContent = rate.toFixed(1) + '%';

    renderHistoryCharts(monthEntries);
    renderComparisonDashboard();
    renderHeatmap();
    updateMonthDropdown();
}

function updateMonthDropdown() {
    const select = document.getElementById('history-month-select');
    select.innerHTML = '';
    
    // Get all unique months from dailyEntries
    const months = [...new Set(dailyEntries.map(e => e.date.substring(0, 7)))];
    const nowStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (!months.includes(nowStr)) months.push(nowStr);
    
    months.sort().reverse().forEach(m => {
        const [y, mon] = m.split('-');
        const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = `${monthNames[parseInt(mon)-1]} ${y}`;
        if (parseInt(mon)-1 === historyViewMonth && parseInt(y) === historyViewYear) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderHistoryCharts(entries) {
    const pieCtx = document.getElementById('historyPieChart').getContext('2d');
    if (historyPieChart) historyPieChart.destroy();
    
    const catData = {};
    entries.filter(e => e.type === 'expense').forEach(e => {
        catData[e.category] = (catData[e.category] || 0) + e.amount;
    });

    historyPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#34495e', '#1abc9c']
            }]
        }
    });

    const barCtx = document.getElementById('historyBarChart').getContext('2d');
    if (historyBarChart) historyBarChart.destroy();
    
    const planned = expenses.map(e => ({ name: e.name, amount: e.amount }));
    const real = planned.map(p => ({
        name: p.name,
        amount: entries.filter(e => e.category === p.name && e.type === 'expense').reduce((s, e) => s + e.amount, 0)
    }));

    historyBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: planned.map(p => p.name),
            datasets: [
                { label: 'Prévu', data: planned.map(p => p.amount), backgroundColor: '#bdc3c7' },
                { label: 'Réel', data: real.map(r => r.amount), backgroundColor: '#3498db' }
            ]
        }
    });
}

function renderComparisonDashboard() {
    const ctx = document.getElementById('evolution12mChart').getContext('2d');
    if (evolution12mChart) evolution12mChart.destroy();

    const months = [];
    const incData = [];
    const expData = [];
    const savData = [];

    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2y' }));
        
        const entries = dailyEntries.filter(e => e.date.startsWith(mStr));
        incData.push(getMonthlyIncome());
        expData.push(entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0));
        savData.push(entries.filter(e => e.type === 'saving').reduce((s, e) => s + e.amount, 0));
    }

    evolution12mChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                { label: 'Revenus', data: incData, borderColor: '#3498db', tension: 0.3 },
                { label: 'Dépenses', data: expData, borderColor: '#e74c3c', tension: 0.3 },
                { label: 'Épargne', data: savData, borderColor: '#2ecc71', tension: 0.3 }
            ]
        }
    });
}

function renderHeatmap() {
    const container = document.getElementById('savings-heatmap');
    container.innerHTML = '';
    
    // Last 30 days
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const daySavings = dailyEntries
            .filter(e => e.date === dateStr && e.type === 'saving')
            .reduce((s, e) => s + e.amount, 0);
            
        const day = document.createElement('div');
        day.className = 'heatmap-day';
        
        let level = 0;
        if (daySavings > 0) level = 1;
        if (daySavings > 2000) level = 2;
        if (daySavings > 5000) level = 3;
        if (daySavings > 10000) level = 4;
        
        const colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
        day.style.backgroundColor = colors[level];
        day.setAttribute('data-info', `${d.toLocaleDateString('fr-FR')}: ${formatCurrency(daySavings)}`);
        container.appendChild(day);
    }
}

// --- Export CSV ---
function exportCurrentMonthCSV() {
    const monthStr = `${historyViewYear}-${String(historyViewMonth + 1).padStart(2, '0')}`;
    const entries = dailyEntries.filter(e => e.date.startsWith(monthStr));
    downloadCSV(entries, `EcoBudget_${monthStr}.csv`);
}

function exportFullHistoryCSV() {
    downloadCSV(dailyEntries, `EcoBudget_Complet.csv`);
}

function downloadCSV(data, filename) {
    let csv = 'Date,Type,Categorie,Montant,Description\n';
    data.forEach(e => {
        csv += `${e.date},${e.type},${e.category},${e.amount},"${e.description || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    link.click();
}

// --- Simulator ---
function setupSimulator() {
    const slider = document.getElementById('total-savings-slider');
    const display = document.getElementById('total-savings-value');
    
    slider.oninput = function() {
        const val = parseInt(this.value);
        display.textContent = val.toLocaleString();
        autoAllocate(val);
    };
    
    // Set max based on available income
    const available = getMonthlyIncome() - getTotalExpenses();
    slider.max = Math.max(available, 100000);
    slider.value = goals.reduce((t, g) => t + g.monthly, 0);
    display.textContent = slider.value.toLocaleString();
    
    renderAllocationSliders();
}

function renderAllocationSliders() {
    const container = document.getElementById('allocation-sliders');
    container.innerHTML = '';
    
    goals.sort((a, b) => a.priority - b.priority).forEach(goal => {
        const div = document.createElement('div');
        div.className = 'allocation-item';
        div.innerHTML = `
            <div class="allocation-info">
                <span>${goal.icon} ${goal.name}</span>
                <span id="alloc-val-${goal.id}">${formatCurrency(goal.monthly)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (goal.monthly / 50000) * 100)}%; background: ${goal.color}"></div>
            </div>
        `;
        container.appendChild(div);
    });
    
    updateSimulatorStats();
}

function autoAllocate(total) {
    // Simple priority-based allocation
    let remaining = total;
    const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority);
    
    sortedGoals.forEach(g => {
        const needed = g.target - g.current;
        if (needed <= 0) {
            g.monthly = 0;
            return;
        }
        
        // Allocate up to a reasonable amount or what's left
        let alloc = Math.min(remaining, 20000); 
        g.monthly = alloc;
        remaining -= alloc;
    });
    
    renderAllocationSliders();
    updateSimulatorStats();
}

function updateSimulatorStats() {
    const totalAllocated = goals.reduce((t, g) => t + g.monthly, 0);
    const income = getMonthlyIncome();
    const rate = (totalAllocated / income) * 100;
    
    document.getElementById('savings-rate').textContent = rate.toFixed(1) + '%';
    
    const wealth1y = getTotalSavings() + (totalAllocated * 12);
    document.getElementById('wealth-1y').textContent = formatCurrency(wealth1y);
}
