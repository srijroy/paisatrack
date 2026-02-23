/* ============================================
   PaisaTrack - AI Smart Expense Tracker
   script.js — Full App Logic
   ============================================ */

'use strict';

// =============================================
// CONSTANTS & CONFIG
// =============================================

const CATEGORIES = {
  food:    { label: 'Food',     icon: '🍔', color: '#f7c46e', bg: 'cat-food' },
  travel:  { label: 'Travel',   icon: '🚌', color: '#6ec4f7', bg: 'cat-travel' },
  shop:    { label: 'Shop',     icon: '🛍️', color: '#f76e6e', bg: 'cat-shop' },
  bills:   { label: 'Bills',    icon: '💡', color: '#7c6ef7', bg: 'cat-bills' },
  others:  { label: 'Others',   icon: '📦', color: '#6ef7b8', bg: 'cat-others' }
};

const CHART_COLORS = ['#7c6ef7','#f7c46e','#f76e6e','#6ec4f7','#6ef7b8'];

// Keyword → Category auto-suggest map
const KEYWORD_MAP = {
  food:   ['chai','tea','coffee','food','lunch','dinner','breakfast','biryani','pizza','burger','maggi','snack','eat','restaurant','zomato','swiggy','canteen','mess','thali','roti','rice','dal','sabzi','paratha','dosa','idli','samosa','vada','pav','bread','milk','fruit','vegetable','grocery','kirana'],
  travel: ['bus','auto','rickshaw','metro','train','cab','uber','ola','petrol','diesel','fuel','travel','trip','ticket','toll','parking','rapido','bike','cycle','flight'],
  shop:   ['amazon','flipkart','myntra','shopping','clothes','shirt','shoes','book','stationery','pen','notebook','hostel','room','rent','repair','mobile','phone','laptop','headphone','earphone','watch','bag','wallet'],
  bills:  ['recharge','internet','wifi','electricity','water','gas','bill','dth','subscription','netflix','hotstar','spotify','amazon prime','fee','college','tuition','insurance','emi'],
  others: ['medicine','medical','health','doctor','hospital','gym','haircut','salon','movie','entertainment','gift','party','birthday','wedding','donation','charity','miscellaneous']
};

const STORAGE_KEYS = {
  expenses:   'pt_expenses',
  budget:     'pt_budget',
  borrows:    'pt_borrows',
  goal:       'pt_goal',
  profile:    'pt_profile',
  lastNotif:  'pt_last_notif'
};

// =============================================
// STATE
// =============================================
let state = {
  expenses:      [],
  borrows:       [],
  budget:        { monthly: 0, start: null },
  goal:          { name: '', target: 0, saved: 0, deadline: '' },
  profile:       { name: 'Student', college: 'My College', notifEnabled: false },
  activePeriod:  'today',
  editingId:     null,
  editingBorrow: null,
  activeFilter:  'all',
  chartInstance: null
};

// =============================================
// STORAGE HELPERS
// =============================================
const save = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.error('Save failed:', e); }
};
const load = (key, fallback) => {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch(e) { return fallback; }
};

function loadAllData() {
  state.expenses = load(STORAGE_KEYS.expenses, []);
  state.borrows  = load(STORAGE_KEYS.borrows,  []);
  state.budget   = load(STORAGE_KEYS.budget,   { monthly: 0, start: null });
  state.goal     = load(STORAGE_KEYS.goal,     { name: '', target: 0, saved: 0, deadline: '' });
  state.profile  = load(STORAGE_KEYS.profile,  { name: 'Student', college: 'My College', notifEnabled: false });
}

// =============================================
// UTILITY FUNCTIONS
// =============================================
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0, 10);

function getDateRange(period) {
  const now = new Date();
  const start = new Date();
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return start;
}

function filterExpensesByPeriod(period) {
  const start = getDateRange(period);
  return state.expenses.filter(e => new Date(e.date) >= start);
}

function autoCategory(note) {
  const lower = note.toLowerCase();
  for (const [cat, words] of Object.entries(KEYWORD_MAP)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return 'others';
}

function daysInMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getDailyBudget() {
  if (!state.budget.monthly) return 0;
  return state.budget.monthly / daysInMonth();
}

function getMonthlySpend() {
  return filterExpensesByPeriod('month').reduce((s, e) => s + e.amount, 0);
}

function getTodaySpend() {
  return filterExpensesByPeriod('today').reduce((s, e) => s + e.amount, 0);
}

function getWeekSpend() {
  return filterExpensesByPeriod('week').reduce((s, e) => s + e.amount, 0);
}

function getCategoryTotals(period) {
  const filtered = period ? filterExpensesByPeriod(period) : state.expenses;
  const totals = {};
  Object.keys(CATEGORIES).forEach(k => { totals[k] = 0; });
  filtered.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  return totals;
}

// =============================================
// AI-LIKE INSIGHTS ENGINE
// =============================================
function generateInsights() {
  const insights = [];
  const totals = getCategoryTotals('month');
  const monthlySpend = getMonthlySpend();
  const budget = state.budget.monthly;
  const todaySpend = getTodaySpend();
  const dailyBudget = getDailyBudget();

  // Over budget check
  if (budget > 0 && monthlySpend > budget) {
    insights.push({
      type: 'danger',
      title: '🚨 Over Budget!',
      text: `You've overspent by ${fmt(monthlySpend - budget)} this month. Cut back on non-essentials.`
    });
  } else if (budget > 0 && monthlySpend > budget * 0.85) {
    insights.push({
      type: 'warn',
      title: '⚠️ Budget Warning',
      text: `You've used ${Math.round(monthlySpend / budget * 100)}% of your monthly budget. Slow down!`
    });
  }

  // Today vs daily budget
  if (dailyBudget > 0 && todaySpend > dailyBudget * 1.3) {
    insights.push({
      type: 'warn',
      title: '📅 High Daily Spend',
      text: `Today's spend (${fmt(todaySpend)}) is ${Math.round((todaySpend / dailyBudget - 1) * 100)}% above your daily budget of ${fmt(dailyBudget)}.`
    });
  }

  // Food spending
  const foodRatio = monthlySpend > 0 ? (totals.food / monthlySpend) : 0;
  if (foodRatio > 0.45) {
    insights.push({
      type: 'warn',
      title: '🍔 Food Overdose',
      text: `${Math.round(foodRatio * 100)}% of your spending is on food. Consider cooking in hostel to save ${fmt(totals.food * 0.3)} per month.`
    });
  }

  // Savings goal
  if (state.goal.target > 0) {
    const remaining = state.goal.target - state.goal.saved;
    const spendable = budget > 0 ? (budget - monthlySpend) : 0;
    insights.push({
      type: remaining <= 0 ? 'good' : 'info',
      title: '🎯 Goal Check',
      text: remaining <= 0
        ? `Goal achieved! You've saved ${fmt(state.goal.saved)} for "${state.goal.name}".`
        : `Save ${fmt(remaining)} more to reach your "${state.goal.name}" goal. Try to set aside ${fmt(Math.ceil(remaining / 30))}/day.`
    });
  }

  // Travel insights
  if (totals.travel > (budget * 0.25) && budget > 0) {
    insights.push({
      type: 'warn',
      title: '🚌 Travel Heavy',
      text: `You spent ${fmt(totals.travel)} on travel this month. Consider monthly bus passes or biking.`
    });
  }

  // No expenses today
  if (todaySpend === 0 && state.expenses.length > 0) {
    insights.push({
      type: 'info',
      title: '📝 Nothing logged today',
      text: `Don't forget to log today's expenses. Tracking daily is key to financial control.`
    });
  }

  // Good saver
  if (budget > 0 && monthlySpend < budget * 0.6) {
    insights.push({
      type: 'good',
      title: '💰 Great Saver!',
      text: `You're well within budget! You've saved ${fmt(budget - monthlySpend)} so far this month. Keep it up!`
    });
  }

  return insights;
}

function getSpendingPersonality() {
  const monthlySpend = getMonthlySpend();
  const budget = state.budget.monthly || 1;
  const ratio = monthlySpend / budget;

  // Check impulsive: many small transactions
  const todayTxns = filterExpensesByPeriod('today');
  if (todayTxns.length > 5 || (state.expenses.length > 0 && ratio > 1.1)) {
    return { label: 'Impulsive Spender', emoji: '🔥', tag: 'impulsive', desc: 'You spend fast without thinking. Take a breath before each purchase!' };
  }
  if (ratio < 0.6) {
    return { label: 'Smart Saver', emoji: '🧠', tag: 'saver', desc: 'Excellent discipline! You spend wisely and save consistently.' };
  }
  return { label: 'Balanced Spender', emoji: '⚖️', tag: 'spender', desc: 'You spend reasonably. Small improvements in food/travel can help more.' };
}

// =============================================
// RENDER FUNCTIONS
// =============================================

// --- Dashboard / Home ---
function renderHome() {
  // Period spend
  const periodSpend = filterExpensesByPeriod(state.activePeriod).reduce((s, e) => s + e.amount, 0);
  const todayS = getTodaySpend();
  const weekS  = getWeekSpend();
  const monthS = getMonthlySpend();

  // Balance card
  const balAmt = document.getElementById('balance-amount');
  if (balAmt) balAmt.innerHTML = `<span>₹</span>${Number(periodSpend).toLocaleString('en-IN')}`;

  const el = (id) => document.getElementById(id);
  if (el('today-stat')) el('today-stat').textContent = fmt(todayS);
  if (el('week-stat'))  el('week-stat').textContent  = fmt(weekS);
  if (el('month-stat')) el('month-stat').textContent = fmt(monthS);

  // Budget progress bar
  const budget = state.budget.monthly;
  const budgetPct = budget > 0 ? Math.min((monthS / budget) * 100, 100) : 0;
  const fill = document.getElementById('budget-bar-fill');
  const budgetLeft = document.getElementById('budget-remaining');
  const budgetPctEl = document.getElementById('budget-pct');
  if (fill) {
    fill.style.width = budgetPct + '%';
    fill.className = 'budget-bar-fill';
    if (budgetPct > 100) fill.classList.add('danger');
    else if (budgetPct > 80) fill.classList.add('warning');
  }
  if (budgetLeft) budgetLeft.innerHTML = budget > 0
    ? `<strong>${fmt(Math.max(0, budget - monthS))}</strong> remaining`
    : `<a onclick="navigateTo('profile')" style="color:var(--accent);cursor:pointer">Set budget →</a>`;
  if (budgetPctEl) budgetPctEl.textContent = budget > 0
    ? `${fmt(monthS)} / ${fmt(budget)}`
    : 'No budget set';

  // Category chart
  renderCategoryChart();

  // Recent expenses (last 5)
  renderExpenseList('home-expense-list', state.expenses.slice(0, 5));
}

function renderCategoryChart() {
  const totals = getCategoryTotals(state.activePeriod);
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = Object.keys(CATEGORIES).map(k => CATEGORIES[k].label);
  const data   = Object.keys(CATEGORIES).map(k => totals[k] || 0);
  const total  = data.reduce((a, b) => a + b, 0);

  if (total === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '14px Space Grotesk';
    ctx.textAlign = 'center';
    ctx.fillText('No expenses yet', canvas.width / 2, canvas.height / 2);
    renderCategoryLegend(data, labels, total);
    return;
  }

  // Draw donut chart manually
  canvas.width = canvas.offsetWidth * window.devicePixelRatio || 300;
  canvas.height = 180 * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const cx = canvas.offsetWidth / 2;
  const cy = 90;
  const outerR = 70;
  const innerR = 44;
  let angle = -Math.PI / 2;

  ctx.clearRect(0, 0, canvas.offsetWidth, 180);

  data.forEach((val, i) => {
    if (val === 0) return;
    const slice = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i];
    ctx.fill();
    angle += slice;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0f';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#f0f0f8';
  ctx.font = `bold 18px Syne`;
  ctx.textAlign = 'center';
  ctx.fillText(fmt(total), cx, cy + 4);
  ctx.font = '11px Space Grotesk';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('Total', cx, cy + 18);

  renderCategoryLegend(data, labels, total);
}

function renderCategoryLegend(data, labels, total) {
  const legend = document.getElementById('category-legend');
  if (!legend) return;
  legend.innerHTML = '';
  data.forEach((val, i) => {
    if (val === 0) return;
    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
    legend.innerHTML += `
      <div class="legend-item">
        <div class="legend-dot" style="background:${CHART_COLORS[i]}"></div>
        <span class="legend-name">${labels[i]}</span>
        <span class="legend-amount">${fmt(val)} <span style="color:var(--text-muted)">${pct}%</span></span>
      </div>`;
  });
}

function renderExpenseList(containerId, expenses) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p>No expenses here yet.<br>Add your first one!</p>
      </div>`;
    return;
  }

  container.innerHTML = expenses.map(e => {
    const cat = CATEGORIES[e.category] || CATEGORIES.others;
    return `
      <div class="expense-item" id="exp-${e.id}">
        <div class="expense-icon ${cat.bg}">${cat.icon}</div>
        <div class="expense-info">
          <div class="expense-note">${escapeHtml(e.note)}</div>
          <div class="expense-meta">
            <span class="expense-tag">${cat.label}</span>
            <span>${formatDate(e.date)}</span>
          </div>
        </div>
        <div class="expense-amount">${fmt(e.amount)}</div>
        <div class="expense-actions">
          <button class="expense-action-btn edit-btn" onclick="openEditExpense('${e.id}')" title="Edit">✏️</button>
          <button class="expense-action-btn delete-btn" onclick="deleteExpense('${e.id}')" title="Delete">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Full Expenses View ---
function renderAllExpenses() {
  let filtered = [...state.expenses];
  if (state.activeFilter !== 'all') {
    filtered = filtered.filter(e => e.category === state.activeFilter);
  }
  renderExpenseList('all-expense-list', filtered);

  // Update filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === state.activeFilter);
  });
}

// --- Insights ---
function renderInsights() {
  const insights = generateInsights();
  const container = document.getElementById('insights-list');
  if (!container) return;

  if (insights.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🤔</div><p>Add some expenses to get smart insights!</p></div>`;
  } else {
    container.innerHTML = insights.map(ins => `
      <div class="insight-card card ${ins.type}">
        <div class="insight-title">${ins.title}</div>
        <div class="insight-text">${ins.text}</div>
      </div>`).join('');
  }

  // Personality
  const personality = getSpendingPersonality();
  const pEl = document.getElementById('personality-display');
  if (pEl) {
    pEl.innerHTML = `
      <div class="personality-badge">
        <span class="badge-emoji">${personality.emoji}</span>
        <span>${personality.label}</span>
        <span class="tag-pill tag-${personality.tag}">${personality.tag}</span>
      </div>
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:8px">${personality.desc}</p>`;
  }

  // Category breakdown for insights
  const totals = getCategoryTotals('month');
  const catContainer = document.getElementById('cat-breakdown');
  if (catContainer) {
    const entries = Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, ...v, amount: totals[k] || 0 }))
      .sort((a, b) => b.amount - a.amount);
    catContainer.innerHTML = entries.map(cat => {
      const monthTotal = getMonthlySpend();
      const pct = monthTotal > 0 ? Math.round((cat.amount / monthTotal) * 100) : 0;
      return `
        <div style="margin-bottom:10px">
          <div class="flex-between" style="margin-bottom:5px">
            <span style="font-size:0.85rem">${cat.icon} ${cat.label}</span>
            <span style="font-size:0.85rem;font-weight:600">${fmt(cat.amount)}</span>
          </div>
          <div class="budget-bar-track" style="height:5px">
            <div class="budget-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
          </div>
        </div>`;
    }).join('');
  }
}

// --- Borrow / Lend ---
function renderBorrows() {
  const container = document.getElementById('borrow-list');
  if (!container) return;

  const totalLent   = state.borrows.filter(b => b.type === 'lend').reduce((s, b) => s + b.amount, 0);
  const totalBorrow = state.borrows.filter(b => b.type === 'borrow').reduce((s, b) => s + b.amount, 0);

  const lendEl = document.getElementById('total-lent');
  const borEl  = document.getElementById('total-borrowed');
  if (lendEl) lendEl.textContent = fmt(totalLent);
  if (borEl)  borEl.textContent  = fmt(totalBorrow);

  if (state.borrows.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🤝</div><p>No borrow/lend records yet.</p></div>`;
    return;
  }

  container.innerHTML = state.borrows.map(b => {
    const initials = b.name.slice(0, 2).toUpperCase();
    return `
      <div class="borrow-item">
        <div class="borrow-avatar ${b.type}">${initials}</div>
        <div class="borrow-info">
          <div class="borrow-name">${escapeHtml(b.name)}</div>
          <div class="borrow-type ${b.type}">${b.type === 'lend' ? '💸 You lent' : '💰 You borrowed'} • ${formatDate(b.date)}</div>
          ${b.note ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${escapeHtml(b.note)}</div>` : ''}
        </div>
        <div class="borrow-amount ${b.type}">${b.type === 'lend' ? '+' : '-'}${fmt(b.amount)}</div>
        <button class="expense-action-btn delete-btn" onclick="deleteBorrow('${b.id}')" title="Delete">🗑️</button>
      </div>`;
  }).join('');
}

// --- Savings Goal ---
function renderGoal() {
  const goal = state.goal;
  const container = document.getElementById('goal-section');
  if (!container) return;

  if (!goal.target) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎯</div>
        <p>No savings goal set yet.<br>Tap below to create one!</p>
      </div>`;
    return;
  }

  const pct = Math.min((goal.saved / goal.target) * 100, 100);
  const remaining = Math.max(0, goal.target - goal.saved);

  // Days remaining
  let dailyNeeded = 0;
  if (goal.deadline) {
    const days = Math.max(1, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000));
    dailyNeeded = remaining / days;
  }

  container.innerHTML = `
    <div class="goal-card card">
      <div class="goal-header">
        <div>
          <div class="goal-amount-display"><span>₹</span>${Number(goal.saved).toLocaleString('en-IN')}</div>
          <div class="goal-label">saved toward "${escapeHtml(goal.name)}"</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.8rem;font-weight:700">${Math.round(pct)}%</div>
          <div class="goal-label">complete</div>
        </div>
      </div>
      <div class="goal-progress-track">
        <div class="goal-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="goal-info">
        <span>Saved: <strong>${fmt(goal.saved)}</strong></span>
        <span>Goal: <strong>${fmt(goal.target)}</strong></span>
        <span>Left: <strong>${fmt(remaining)}</strong></span>
      </div>
      ${dailyNeeded > 0 ? `
      <div class="goal-daily-needed mt-12">
        Save <strong>${fmt(Math.ceil(dailyNeeded))}/day</strong> to reach your goal on time.
      </div>` : ''}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-primary" onclick="openGoalModal('add-savings')">➕ Add Savings</button>
      <button class="btn btn-ghost btn-sm" onclick="openGoalModal('edit-goal')">Edit Goal</button>
    </div>`;
}

// --- Profile ---
function renderProfile() {
  const name = document.getElementById('profile-name-display');
  const college = document.getElementById('profile-college-display');
  const budgetDisplay = document.getElementById('budget-display');
  if (name)    name.textContent    = state.profile.name;
  if (college) college.textContent = state.profile.college;
  if (budgetDisplay) budgetDisplay.textContent = state.budget.monthly ? fmt(state.budget.monthly) + '/month' : 'Not set';
}

// =============================================
// EXPENSE CRUD
// =============================================
function addExpense(expense) {
  expense.id = genId();
  state.expenses.unshift(expense); // newest first
  save(STORAGE_KEYS.expenses, state.expenses);
  checkOverspendNotification();
  showToast('Expense added!', 'success');
}

function updateExpense(id, updated) {
  const idx = state.expenses.findIndex(e => e.id === id);
  if (idx !== -1) {
    state.expenses[idx] = { ...state.expenses[idx], ...updated };
    save(STORAGE_KEYS.expenses, state.expenses);
    showToast('Expense updated!', 'success');
  }
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  save(STORAGE_KEYS.expenses, state.expenses);
  renderCurrentSection();
  showToast('Expense deleted', 'info');
}

function deleteBorrow(id) {
  if (!confirm('Delete this record?')) return;
  state.borrows = state.borrows.filter(b => b.id !== id);
  save(STORAGE_KEYS.borrows, state.borrows);
  renderBorrows();
  showToast('Record deleted', 'info');
}

// =============================================
// MODALS
// =============================================

// Open Add/Edit Expense Modal
function openExpenseModal(preset = {}) {
  state.editingId = preset.id || null;

  document.getElementById('modal-title').textContent = state.editingId ? 'Edit Expense' : 'Add Expense';
  document.getElementById('expense-amount').value = preset.amount || '';
  document.getElementById('expense-note').value   = preset.note   || '';
  document.getElementById('expense-date').value   = preset.date   || today();

  // Set category
  const cat = preset.category || 'food';
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.cat === cat);
  });

  openModal('expense-modal');
  setTimeout(() => document.getElementById('expense-amount').focus(), 400);
}

function openEditExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (exp) openExpenseModal({ ...exp });
}

// Expense modal submit
function submitExpense() {
  const amount   = parseFloat(document.getElementById('expense-amount').value);
  const note     = document.getElementById('expense-note').value.trim() || 'Expense';
  const date     = document.getElementById('expense-date').value || today();
  const category = document.querySelector('.category-chip.selected')?.dataset.cat || 'others';

  if (!amount || amount <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }

  if (state.editingId) {
    updateExpense(state.editingId, { amount, note, date, category });
    state.editingId = null;
  } else {
    addExpense({ amount, note, date, category });
  }

  closeModal('expense-modal');
  renderCurrentSection();
}

// Open Borrow Modal
function openBorrowModal(preset = {}) {
  state.editingBorrow = preset.id || null;
  document.getElementById('borrow-name').value   = preset.name   || '';
  document.getElementById('borrow-amount').value = preset.amount || '';
  document.getElementById('borrow-note').value   = preset.note   || '';
  document.getElementById('borrow-date').value   = preset.date   || today();
  document.getElementById('borrow-type').value   = preset.type   || 'lend';
  openModal('borrow-modal');
}

function submitBorrow() {
  const name   = document.getElementById('borrow-name').value.trim();
  const amount = parseFloat(document.getElementById('borrow-amount').value);
  const note   = document.getElementById('borrow-note').value.trim();
  const date   = document.getElementById('borrow-date').value || today();
  const type   = document.getElementById('borrow-type').value;

  if (!name) { showToast('Enter a name', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

  const record = { id: genId(), name, amount, note, date, type };
  state.borrows.unshift(record);
  save(STORAGE_KEYS.borrows, state.borrows);
  closeModal('borrow-modal');
  renderBorrows();
  showToast(type === 'lend' ? `Lent ${fmt(amount)} to ${name}` : `Borrowed ${fmt(amount)} from ${name}`, 'success');
}

// Open Goal Modal
function openGoalModal(mode = 'edit-goal') {
  if (mode === 'add-savings') {
    document.getElementById('goal-modal-title').textContent = 'Add Savings';
    document.getElementById('goal-form-main').style.display = 'none';
    document.getElementById('goal-form-savings').style.display = 'block';
    document.getElementById('savings-amount').value = '';
  } else {
    document.getElementById('goal-modal-title').textContent = 'Set Savings Goal';
    document.getElementById('goal-form-main').style.display = 'block';
    document.getElementById('goal-form-savings').style.display = 'none';
    document.getElementById('goal-name').value     = state.goal.name     || '';
    document.getElementById('goal-target').value   = state.goal.target   || '';
    document.getElementById('goal-deadline').value = state.goal.deadline || '';
  }
  openModal('goal-modal');
}

function submitGoal() {
  const mainForm = document.getElementById('goal-form-main');
  if (mainForm.style.display !== 'none') {
    const name     = document.getElementById('goal-name').value.trim();
    const target   = parseFloat(document.getElementById('goal-target').value);
    const deadline = document.getElementById('goal-deadline').value;
    if (!name)            { showToast('Enter goal name', 'error'); return; }
    if (!target || target <= 0) { showToast('Enter valid target amount', 'error'); return; }
    state.goal = { ...state.goal, name, target, deadline };
    save(STORAGE_KEYS.goal, state.goal);
    showToast('Goal set!', 'success');
  } else {
    const amount = parseFloat(document.getElementById('savings-amount').value);
    if (!amount || amount <= 0) { showToast('Enter valid amount', 'error'); return; }
    state.goal.saved = (state.goal.saved || 0) + amount;
    save(STORAGE_KEYS.goal, state.goal);
    showToast(`${fmt(amount)} added to savings!`, 'success');
  }
  closeModal('goal-modal');
  renderGoal();
}

// Open Budget Modal
function openBudgetModal() {
  document.getElementById('budget-input').value = state.budget.monthly || '';
  openModal('budget-modal');
}

function submitBudget() {
  const monthly = parseFloat(document.getElementById('budget-input').value);
  if (!monthly || monthly <= 0) { showToast('Enter valid budget', 'error'); return; }
  state.budget = { monthly, start: today() };
  save(STORAGE_KEYS.budget, state.budget);
  closeModal('budget-modal');
  renderHome();
  showToast(`Budget set to ${fmt(monthly)}/month!`, 'success');
}

// Open Profile Modal
function openProfileModal() {
  document.getElementById('profile-name-input').value   = state.profile.name   || '';
  document.getElementById('profile-college-input').value = state.profile.college || '';
  openModal('profile-modal');
}

function submitProfile() {
  const name    = document.getElementById('profile-name-input').value.trim()   || 'Student';
  const college = document.getElementById('profile-college-input').value.trim() || 'My College';
  state.profile = { ...state.profile, name, college };
  save(STORAGE_KEYS.profile, state.profile);
  closeModal('profile-modal');
  renderProfile();
  showToast('Profile updated!', 'success');
}

// Generic modal open/close
function openModal(id) {
  const overlay = document.getElementById(id + '-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const overlay = document.getElementById(id + '-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Click outside overlay closes modal
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// =============================================
// QUICK ADD
// =============================================
function quickAdd(amount, note, category) {
  addExpense({ amount, note, date: today(), category });

  // Animate button briefly
  renderCurrentSection();
}

// =============================================
// NAVIGATION
// =============================================
let currentSection = 'home';

function navigateTo(section) {
  currentSection = section;

  // Update sections
  document.querySelectorAll('.section').forEach(s => {
    s.classList.toggle('active', s.id === `section-${section}`);
  });

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === section);
  });

  renderCurrentSection();
}

function renderCurrentSection() {
  switch (currentSection) {
    case 'home':     renderHome();       break;
    case 'expenses': renderAllExpenses(); break;
    case 'insights': renderInsights();   break;
    case 'profile':
      renderProfile();
      renderBorrows();
      renderGoal();
      break;
  }
}

// =============================================
// CATEGORY AUTO-SUGGEST
// =============================================
let suggestTimeout = null;
function onNoteInput(val) {
  clearTimeout(suggestTimeout);
  suggestTimeout = setTimeout(() => {
    const suggested = autoCategory(val);
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.cat === suggested);
    });
  }, 300);
}

// =============================================
// PERIOD TABS
// =============================================
function setPeriod(period) {
  state.activePeriod = period;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.period === period);
  });
  renderHome();
}

// =============================================
// FILTER
// =============================================
function setFilter(filter) {
  state.activeFilter = filter;
  renderAllExpenses();
}

// =============================================
// NOTIFICATIONS
// =============================================
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotification(title, body) {
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/manifest.json',
        badge: '/manifest.json'
      });
    } catch(e) {
      console.log('Notification failed:', e);
    }
  }
}

function checkOverspendNotification() {
  const budget = state.budget.monthly;
  if (!budget) return;
  const monthSpend = getMonthlySpend();
  if (monthSpend > budget) {
    sendNotification('⚠️ PaisaTrack: Over Budget!', `You've spent ${fmt(monthSpend)} vs budget of ${fmt(budget)} this month.`);
  } else if (monthSpend > budget * 0.9) {
    sendNotification('⚠️ PaisaTrack: Budget Alert', `You've used 90% of your monthly budget!`);
  }
}

function setupDailyReminder() {
  // Check last notification time
  const lastNotif = load(STORAGE_KEYS.lastNotif, null);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  if (lastNotif === todayKey) return;

  // Schedule for next 8 PM (or 30s delay for demo)
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (target < now) target.setDate(target.getDate() + 1);

  const delay = target - now;
  setTimeout(() => {
    sendNotification('📝 PaisaTrack Daily Reminder', "Don't forget to add today's expenses! Tap to open app.");
    save(STORAGE_KEYS.lastNotif, todayKey);
  }, Math.min(delay, 2147483647)); // JS max setTimeout

  // Also show reminder if no expenses today
  const todayExpenses = filterExpensesByPeriod('today');
  if (todayExpenses.length === 0 && state.expenses.length > 0) {
    setTimeout(() => {
      sendNotification('💡 PaisaTrack', "No expenses logged today. Keep your tracker updated!");
    }, 5000);
  }
}

async function enableNotifications() {
  const granted = await requestNotificationPermission();
  state.profile.notifEnabled = granted;
  save(STORAGE_KEYS.profile, state.profile);

  const btn = document.getElementById('notif-btn');
  if (granted) {
    showToast('Notifications enabled! 🔔', 'success');
    if (btn) btn.textContent = '✅ Notifications On';
    setupDailyReminder();
  } else {
    showToast('Notification permission denied', 'error');
  }
}

// =============================================
// TOAST NOTIFICATION
// =============================================
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// =============================================
// SERVICE WORKER
// =============================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  }
}

// =============================================
// PWA INSTALL
// =============================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.getElementById('install-btn');
  if (installBtn) installBtn.style.display = 'flex';
});

function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') showToast('App installed! 🎉', 'success');
      deferredInstallPrompt = null;
    });
  }
}

// =============================================
// AI API — CLAUDE INTEGRATION
// =============================================

// Build a summary of the user's financial data to send to AI
function buildFinancialContext() {
  const monthlySpend = getMonthlySpend();
  const todaySpend   = getTodaySpend();
  const weekSpend    = getWeekSpend();
  const budget       = state.budget.monthly || 0;
  const totals       = getCategoryTotals('month');
  const goal         = state.goal;
  const borrows      = state.borrows;
  const recentExp    = state.expenses.slice(0, 10).map(e =>
    `${e.note} (${CATEGORIES[e.category]?.label}) ₹${e.amount} on ${e.date}`
  ).join('\n');

  const totalLent     = borrows.filter(b => b.type === 'lend').reduce((s, b) => s + b.amount, 0);
  const totalBorrowed = borrows.filter(b => b.type === 'borrow').reduce((s, b) => s + b.amount, 0);

  return `
You are a friendly, practical financial advisor for an Indian college student. Be concise, warm, and use Indian context (₹, hostel life, canteen, etc.). Use bullet points and emojis to make it easy to read.

USER'S FINANCIAL DATA:
- Monthly Budget: ₹${budget || 'not set'}
- Spent Today: ₹${todaySpend}
- Spent This Week: ₹${weekSpend}
- Spent This Month: ₹${monthlySpend}
- Budget Remaining: ₹${Math.max(0, budget - monthlySpend)}

Category-wise this month:
- 🍔 Food: ₹${totals.food}
- 🚌 Travel: ₹${totals.travel}
- 🛍️ Shopping: ₹${totals.shop}
- 💡 Bills: ₹${totals.bills}
- 📦 Others: ₹${totals.others}

Savings Goal: ${goal.target ? `"${goal.name}" — ₹${goal.saved} saved of ₹${goal.target} target` : 'No goal set'}
Money lent to others: ₹${totalLent}
Money borrowed: ₹${totalBorrowed}

Recent expenses:
${recentExp || 'No expenses yet'}
  `.trim();
}

// Render AI response with markdown-like formatting
function renderAIResponse(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)/gm, '<div style="font-weight:700;margin:10px 0 4px;font-size:0.95rem">$1</div>')
    .replace(/^## (.*)/gm,  '<div style="font-weight:800;margin:12px 0 6px;font-size:1rem">$1</div>')
    .replace(/^- (.*)/gm,   '<div style="padding:3px 0 3px 4px;display:flex;gap:6px"><span>•</span><span>$1</span></div>')
    .replace(/\n\n/g, '<br/>')
    .replace(/\n/g,   '<br/>');
}

// Show loading state inside a container
function showAILoading(containerId) {
  document.getElementById(containerId).innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 0;color:var(--text-secondary)">
      <div style="display:flex;gap:4px">
        <span style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:pulse 1s infinite"></span>
        <span style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:pulse 1s 0.2s infinite"></span>
        <span style="width:8px;height:8px;background:var(--accent);border-radius:50%;animation:pulse 1s 0.4s infinite"></span>
      </div>
      <span style="font-size:0.85rem">Claude is analyzing your spending...</span>
    </div>`;
}

// Main: Get full AI analysis of spending
async function getAIInsights() {
  if (state.expenses.length === 0) {
    showToast('Add some expenses first!', 'info');
    return;
  }

  const btn = document.getElementById('ai-refresh-btn');
  btn.textContent = '⏳ Analyzing...';
  btn.disabled = true;

  showAILoading('ai-response');

  const context = buildFinancialContext();
  const prompt  = context + '\n\nGive me a comprehensive analysis of my spending habits. Include: 1) What I\'m doing well 2) Where I\'m overspending 3) Top 3 actionable tips to save more 4) One encouraging message. Keep it under 200 words.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not get insights. Try again!';

    document.getElementById('ai-response').innerHTML = `
      <div style="font-size:0.88rem;line-height:1.7;color:var(--text-primary)">
        ${renderAIResponse(text)}
      </div>
      <div style="margin-top:12px;font-size:0.7rem;color:var(--text-muted);text-align:right">
        ✨ Generated by Claude AI · ${new Date().toLocaleTimeString('en-IN')}
      </div>`;

  } catch (err) {
    document.getElementById('ai-response').innerHTML = `
      <div style="color:var(--danger);font-size:0.85rem;padding:8px 0">
        ⚠️ Could not connect to Claude AI. Check your internet connection and try again.
      </div>`;
  }

  btn.textContent = '✨ Analyze';
  btn.disabled = false;
}

// Ask a custom question
async function askAIQuestion() {
  const input    = document.getElementById('ai-question-input');
  const question = input.value.trim();
  if (!question) { showToast('Type a question first!', 'info'); return; }

  const responseEl = document.getElementById('ai-question-response');
  showAILoading('ai-question-response');
  input.value = '';

  const context = buildFinancialContext();
  const prompt  = context + `\n\nUser's question: "${question}"\n\nAnswer this specifically based on their financial data above. Be concise (under 120 words), friendly, and practical.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Could not get a response. Try again!';

    responseEl.innerHTML = `
      <div style="background:rgba(124,110,247,0.08);border:1px solid rgba(124,110,247,0.2);border-radius:12px;padding:14px">
        <div style="font-size:0.7rem;color:var(--accent);font-weight:600;margin-bottom:8px">🤖 Claude says:</div>
        <div style="font-size:0.88rem;line-height:1.7">${renderAIResponse(text)}</div>
      </div>`;

  } catch (err) {
    responseEl.innerHTML = `<div style="color:var(--danger);font-size:0.85rem">⚠️ Failed to connect. Check internet.</div>`;
  }
}

// Set question text from suggestion chips
function setAIQuestion(q) {
  document.getElementById('ai-question-input').value = q;
  document.getElementById('ai-question-input').focus();
}

// =============================================
// INIT
// =============================================
function init() {
  loadAllData();
  registerServiceWorker();
  navigateTo('home');

  // Set notification reminder if previously enabled
  if (state.profile.notifEnabled && Notification.permission === 'granted') {
    setupDailyReminder();
    const btn = document.getElementById('notif-btn');
    if (btn) btn.textContent = '✅ Notifications On';
  }

  // Ask for notifications after 3 seconds (first visit)
  if (!state.profile.notifEnabled && 'Notification' in window) {
    setTimeout(() => {
      if (Notification.permission === 'default') {
        showToast('Enable notifications for daily reminders? Tap 🔔 in Profile', 'info');
      }
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', init);