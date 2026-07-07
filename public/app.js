// ========== State ==========
let customers = [];
let visits = [];
let stats = {};
let currentPage = 'dashboard';
let currentFilters = { search: '', area: '', rfm: '', brand: '' };
let editingVisitId = null;
let detailCustomer = null;
let brandChart = null;
let rfmChart = null;

const VISITOR_KEY = 'crm_visitor_name';

function getVisitor() { return localStorage.getItem(VISITOR_KEY) || ''; }
function setVisitorName(name) { localStorage.setItem(VISITOR_KEY, name); }

// ========== API ==========
const API = '/api';

async function apiGet(path) {
  const r = await fetch(API + path);
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiPut(path, body) {
  const r = await fetch(API + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function apiDelete(path) {
  const r = await fetch(API + path, { method: 'DELETE' });
  return r.json();
}

// ========== Init ==========
async function init() {
  const visitor = getVisitor();
  if (visitor) {
    document.getElementById('visitorTag').textContent = visitor;
  } else {
    setVisitor();
  }

  await loadData();
  navTo('dashboard');
}

async function loadData() {
  try {
    const [custRes, visitRes, statsRes] = await Promise.all([
      apiGet('/customers'),
      apiGet('/visits'),
      apiGet('/stats')
    ]);
    customers = custRes.data || [];
    visits = visitRes.data || [];
    stats = statsRes.data || {};
  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="loading">加载失败，请检查服务器是否运行</div>';
  }
}

// ========== Navigation ==========
function navTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: '仪表盘', customers: '客户管理', schedule: '拜访排程', visits: '拜访记录', profile: '我的' };
  document.getElementById('pageTitle').textContent = titles[page] || '';

  const fab = document.querySelector('.fab');
  if (fab) fab.remove();

  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'customers': renderCustomers(); break;
    case 'schedule': renderSchedule(); break;
    case 'visits': renderVisits(); break;
    case 'profile': renderProfile(); break;
  }
}

// ========== Dashboard ==========
function renderDashboard() {
  const s = stats;
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="metric-grid">
      <div class="metric-card">
        <div class="label">客户总数</div>
        <div class="value">${s.totalCustomers || 0}</div>
        <div class="sub">已拜访 ${s.visitedCustomers || 0} 家</div>
      </div>
      <div class="metric-card">
        <div class="label">1-6月总额</div>
        <div class="value">¥${fmtF(s.totalAmount || 0)}</div>
        <div class="sub">全年累计</div>
      </div>
      <div class="metric-card">
        <div class="label">6月销售</div>
        <div class="value">¥${fmtF(s.junAmount || 0)}</div>
        <div class="sub">环比 ${s.mayAmount ? (((s.junAmount - s.mayAmount) / s.mayAmount) * 100).toFixed(1) : 0}%</div>
      </div>
      <div class="metric-card">
        <div class="label">拜访记录</div>
        <div class="value">${s.totalVisits || 0}</div>
        <div class="sub">累计拜访次数</div>
      </div>
    </div>
    <div class="chart-wrap">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">品牌销售占比（1-6月）</div>
      <canvas id="brandChart"></canvas>
    </div>
    <div class="chart-wrap">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">RFM客户分层</div>
      <canvas id="rfmChart"></canvas>
    </div>
    <div class="card">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">区域分布</div>
      <div id="areaList"></div>
    </div>
  `;

  // Brand chart
  const bt = s.brandTotals || {};
  const brandLabels = Object.keys(bt).filter(b => bt[b] > 0);
  const brandData = brandLabels.map(b => bt[b]);
  const brandColors = ['#3b82f6','#f59e0b','#10b981','#ec4899','#8b5cf6','#14b8a6','#9ca3af'];
  const brandIdx = { '4C':0, '淘力派':1, 'EF':2, '萨沙':3, '双妥':4, '可口清':5, '优立乐':6 };

  if (brandChart) brandChart.destroy();
  brandChart = new Chart(document.getElementById('brandChart'), {
    type: 'doughnut',
    data: {
      labels: brandLabels,
      datasets: [{
        data: brandData,
        backgroundColor: brandLabels.map(b => brandColors[brandIdx[b] || 6]),
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, padding: 8 } },
        tooltip: { callbacks: { label: c => {
          const t = c.dataset.data.reduce((a,b)=>a+b,0);
          return c.label + ': ¥' + c.parsed.toLocaleString() + ' (' + (c.parsed/t*100).toFixed(1) + '%)';
        }}}
      }
    }
  });

  // RFM chart
  const rd = s.rfmDist || {};
  const rfmOrder = ['重要价值客户','重要保持客户','重要发展客户','重要挽留客户','一般价值客户','一般保持客户','一般发展客户','流失客户'];
  const rfmLabels = rfmOrder.filter(k => rd[k]);
  const rfmData = rfmLabels.map(k => rd[k]);

  if (rfmChart) rfmChart.destroy();
  rfmChart = new Chart(document.getElementById('rfmChart'), {
    type: 'bar',
    data: {
      labels: rfmLabels,
      datasets: [{ data: rfmData, backgroundColor: '#3b82f6', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { font: { size: 10 } } }, x: { ticks: { font: { size: 9 }, maxRotation: 45 } } }
    }
  });

  // Area list
  const ad = s.areaDist || {};
  const areaSorted = Object.entries(ad).sort((a,b) => b[1] - a[1]);
  const maxArea = Math.max(...areaSorted.map(a => a[1]));
  document.getElementById('areaList').innerHTML = areaSorted.map(([area, count]) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="width:60px;font-size:12px;color:var(--text-secondary)">${area}</span>
      <div style="flex:1;height:20px;background:var(--bg);border-radius:4px;overflow:hidden">
        <div style="width:${count/maxArea*100}%;height:100%;background:var(--primary-light);border-radius:4px"></div>
      </div>
      <span style="width:30px;font-size:12px;font-weight:600;text-align:right">${count}</span>
    </div>
  `).join('');
}

// ========== Customers ==========
function renderCustomers() {
  const content = document.getElementById('content');
  const areas = [...new Set(customers.map(c => c.area))].sort();
  const rfms = [...new Set(customers.map(c => c.rfm_segment))].filter(Boolean);

  content.innerHTML = `
    <div class="search-bar">
      <input class="search-input" id="searchInput" type="search" placeholder="搜索客户名称..." oninput="onSearch(this.value)">
    </div>
    <div class="filter-row" id="areaFilters">
      <div class="chip active" data-type="area" data-val="" onclick="toggleFilter(this)">全部区域</div>
      ${areas.map(a => `<div class="chip" data-type="area" data-val="${a}" onclick="toggleFilter(this)">${a}</div>`).join('')}
    </div>
    <div class="filter-row" id="rfmFilters">
      <div class="chip active" data-type="rfm" data-val="" onclick="toggleFilter(this)">全部分层</div>
      ${rfms.map(r => `<div class="chip" data-type="rfm" data-val="${r}" onclick="toggleFilter(this)">${r}</div>`).join('')}
    </div>
    <div id="custList"></div>
  `;

  document.getElementById('searchInput').addEventListener('input', function() {
    currentFilters.search = this.value.toLowerCase();
    renderCustList();
  });

  renderCustList();
}

function toggleFilter(el) {
  const type = el.dataset.type;
  const val = el.dataset.val;
  document.querySelectorAll(`.chip[data-type="${type}"]`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  currentFilters[type] = val;
  renderCustList();
}

function renderCustList() {
  let filtered = customers.filter(c => {
    if (currentFilters.search && !c.name.toLowerCase().includes(currentFilters.search)) return false;
    if (currentFilters.area && c.area !== currentFilters.area) return false;
    if (currentFilters.rfm && c.rfm_segment !== currentFilters.rfm) return false;
    return true;
  });

  const list = document.getElementById('custList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">未找到匹配客户</div>';
    return;
  }

  list.innerHTML = filtered.map(c => {
    const visited = visits.some(v => v.customer_name === c.name);
    const rfmClass = getRfmClass(c.rfm_segment);
    const brands = (c.visit_brands || '').split('/').filter(Boolean).slice(0, 4).map(b => {
      const cls = {'4C':'bp-4c','EF':'bp-ef','淘力派':'bp-tao','萨沙':'bp-sha'}[b] || 'bp-other';
      return `<span class="brand-pill ${cls}">${b}</span>`;
    }).join('');

    return `
      <div class="cust-card" onclick="openDetail('${escapeHtml(c.name)}')">
        <div class="cust-header">
          <span class="cust-name">${c.name}</span>
          <span class="cust-rank">#${c.rank || '-'}</span>
        </div>
        <div class="cust-info">
          <span class="badge badge-area">${c.area || '未知'}</span>
          <span class="badge ${rfmClass}">${c.rfm_segment || ''}</span>
          ${visited ? '<span class="badge badge-visited">已拜访</span>' : '<span class="badge badge-unvisited">未拜访</span>'}
        </div>
        <div class="cust-info" style="margin-top:6px">
          <span class="cust-amount">¥${fmtF(c.total_amount || 0)}</span>
          <span>6月 ¥${fmtF(c.jun_amount || 0)}</span>
          <span>健康度 ${c.health_score || '-'}</span>
        </div>
        ${brands ? `<div class="brand-pills">${brands}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ========== Customer Detail ==========
function openDetail(name) {
  const customer = customers.find(c => c.name === name);
  if (!customer) return;
  detailCustomer = customer;
  const custVisits = visits.filter(v => v.customer_name === name).sort((a,b) => (b.visit_date||'').localeCompare(a.visit_date||''));

  document.getElementById('detailTitle').textContent = customer.name;
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <span class="badge badge-area">${customer.area || '未知'}</span>
          <span class="badge ${getRfmClass(customer.rfm_segment)}">${customer.rfm_segment || ''}</span>
        </div>
        <span style="font-size:12px;color:var(--text-tertiary)">排名 #${customer.rank || '-'}</span>
      </div>
      <div class="detail-metrics">
        <div class="detail-metric"><div class="dm-label">1-6月金额</div><div class="dm-value">¥${fmtF(customer.total_amount||0)}</div></div>
        <div class="detail-metric"><div class="dm-label">6月金额</div><div class="dm-value">¥${fmtF(customer.jun_amount||0)}</div></div>
        <div class="detail-metric"><div class="dm-label">5月金额</div><div class="dm-value">¥${fmtF(customer.may_amount||0)}</div></div>
        <div class="detail-metric"><div class="dm-label">健康度</div><div class="dm-value">${customer.health_score||'-'}</div></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="ds-title">品牌贡献（1-6月）</div>
      <div class="brand-grid">
        ${renderBrandItem('4C', customer.brand_4c_h1, '#dbeafe', '#1d4ed8')}
        ${renderBrandItem('淘力派', customer.brand_tao_h1, '#fef3c7', '#92400e')}
        ${renderBrandItem('EF', customer.brand_ef_h1, '#d1fae5', '#065f46')}
        ${renderBrandItem('萨沙', customer.brand_sha_h1, '#fce7f3', '#9d174d')}
        ${renderBrandItem('双妥', customer.brand_shuang_h1, '#ede9fe', '#5b21b6')}
        ${renderBrandItem('可口清', customer.brand_keke_h1, '#ccfbf1', '#115e59')}
        ${renderBrandItem('优立乐', customer.brand_youli_h1, '#f3f4f6', '#4b5563')}
      </div>
    </div>

    <div class="detail-section">
      <div class="ds-title">订单信息</div>
      <div style="display:flex;gap:16px;font-size:13px;color:var(--text-secondary)">
        <span>最近订单: <strong style="color:var(--text)">${customer.last_order||'-'}</strong></span>
        <span>下单次数: <strong style="color:var(--text)">${customer.order_times||0}</strong></span>
      </div>
      <div style="margin-top:6px;font-size:13px;color:var(--text-secondary)">
        合作品牌: <strong style="color:var(--text)">${customer.visit_brands || customer.brands_list?.join('/') || '-'}</strong>
      </div>
    </div>

    ${customer.visit_reason ? `
    <div class="detail-section">
      <div class="ds-title">拜访理由</div>
      <div style="font-size:13px;color:var(--text)">${customer.visit_reason}</div>
    </div>` : ''}

    <div class="detail-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="ds-title" style="margin-bottom:0">拜访记录 (${custVisits.length})</div>
        <button class="btn-primary" style="width:auto;padding:6px 16px;font-size:13px;margin:0" onclick="openVisitForm('${escapeHtml(name)}')">+ 新建拜访</button>
      </div>
      ${custVisits.length === 0 ? '<div style="color:var(--text-tertiary);font-size:13px;padding:8px 0">暂无拜访记录</div>' :
        custVisits.map(v => `
          <div class="visit-card" onclick="openVisitForm('${escapeHtml(name)}','${v.id}')">
            <div class="vc-header">
              <span class="vc-customer">${v.visit_date || '未记录'}</span>
              <span class="vc-date">${v.visitor || ''}</span>
            </div>
            ${v.visit_notes ? `<div class="vc-notes">${v.visit_notes}</div>` : ''}
            ${v.next_visit ? `<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">下次拜访: ${v.next_visit}</div>` : ''}
          </div>
        `).join('')
      }
    </div>
  `;
  document.getElementById('detailModal').style.display = 'flex';
}

function closeDetail() {
  document.getElementById('detailModal').style.display = 'none';
  detailCustomer = null;
}

// ========== Schedule ==========
function renderSchedule() {
  const content = document.getElementById('content');
  const sorted = [...customers].sort((a, b) => (b.schedule_score || 0) - (a.schedule_score || 0));
  const top30 = sorted.slice(0, 30);

  content.innerHTML = `
    <div class="card" style="background:var(--primary-light);color:var(--primary)">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px">智能拜访排程</div>
      <div style="font-size:12px;opacity:0.8">按排程得分排序，前30名优先拜访客户</div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;font-size:12px;color:var(--text-secondary)">
      <span><span class="priority-dot high"></span>高优先(≥60)</span>
      <span><span class="priority-dot mid"></span>中优先(40-59)</span>
      <span><span class="priority-dot low"></span>低优先(<40)</span>
    </div>
    <div id="schedList"></div>
  `;

  document.getElementById('schedList').innerHTML = top30.map((c, idx) => {
    const score = c.schedule_score || 0;
    const rankClass = score >= 60 ? 'high' : score >= 40 ? 'mid' : 'low';
    return `
      <div class="sched-item" onclick="openDetail('${escapeHtml(c.name)}')">
        <div class="sched-rank ${rankClass}">${idx + 1}</div>
        <div class="sched-info">
          <div class="sched-name">${c.name}</div>
          <div class="sched-reason">${(c.visit_reason || '').slice(0, 35)}${c.visit_reason && c.visit_reason.length > 35 ? '...' : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="sched-score">${score}</div>
          <div style="font-size:11px;color:var(--text-tertiary)">${c.suggest_freq || ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ========== Visits ==========
function renderVisits() {
  const content = document.getElementById('content');
  const sorted = [...visits].sort((a, b) => (b.visit_date || '').localeCompare(a.visit_date || ''));

  content.innerHTML = `
    <button class="fab" onclick="openVisitForm('')">+</button>
    <div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary)">共 ${visits.length} 条拜访记录</div>
    ${sorted.length === 0 ? `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M9 11H7v6h2v-6zm4 0h-2v6h2v-6zm4 0h-2v6h2v-6zm2-9h-1V0h-2v2H8V0H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H5V8h14v12z"/></svg>
        <div>暂无拜访记录</div>
        <div style="font-size:12px;margin-top:4px">点击右下角 + 新建拜访</div>
      </div>
    ` : sorted.map(v => `
      <div class="visit-card" onclick="openVisitForm('${escapeHtml(v.customer_name)}','${v.id}')">
        <div class="vc-header">
          <span class="vc-customer">${v.customer_name || '未知客户'}</span>
          <span class="vc-date">${v.visit_date || ''}</span>
        </div>
        ${v.visit_notes ? `<div class="vc-notes">${v.visit_notes}</div>` : ''}
        <div class="vc-visitor">${v.visitor || ''} ${v.is_priority === 'true' || v.is_priority === true ? '| 优先' : ''}</div>
        ${v.next_visit ? `<div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">下次: ${v.next_visit}</div>` : ''}
      </div>
    `).join('')}
  `;
}

// ========== Visit Form ==========
function openVisitForm(customerName, visitId) {
  editingVisitId = visitId || null;
  const isEdit = !!visitId;

  document.getElementById('visitFormTitle').textContent = isEdit ? '编辑拜访' : '新建拜访';
  document.getElementById('vfCustomer').value = customerName || (detailCustomer ? detailCustomer.name : '');

  if (detailCustomer) {
    closeDetail();
  }

  const visitor = getVisitor();
  document.getElementById('vfVisitor').value = visitor;

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('vfDate').value = today;

  if (isEdit) {
    const v = visits.find(x => x.id === visitId);
    if (v) {
      document.getElementById('vfVisitor').value = v.visitor || visitor;
      document.getElementById('vfDate').value = v.visit_date || today;
      document.getElementById('vfNext').value = v.next_visit || '';
      document.getElementById('vfPriority').value = String(v.is_priority);
      document.getElementById('vfNotes').value = v.visit_notes || '';
    }
    document.getElementById('vfDeleteBtn').style.display = 'block';
  } else {
    document.getElementById('vfNext').value = '';
    document.getElementById('vfPriority').value = 'false';
    document.getElementById('vfNotes').value = '';
    document.getElementById('vfDeleteBtn').style.display = 'none';
  }

  document.getElementById('visitModal').style.display = 'flex';
}

function closeVisitForm() {
  document.getElementById('visitModal').style.display = 'none';
  editingVisitId = null;
}

async function saveVisitForm() {
  const data = {
    customer_name: document.getElementById('vfCustomer').value,
    visitor: document.getElementById('vfVisitor').value,
    visit_date: document.getElementById('vfDate').value,
    next_visit: document.getElementById('vfNext').value,
    is_priority: document.getElementById('vfPriority').value === 'true',
    visit_notes: document.getElementById('vfNotes').value,
  };

  if (!data.customer_name) { alert('请选择客户'); return; }
  if (!data.visitor) { alert('请填写拜访人'); return; }

  setVisitorName(data.visitor);
  document.getElementById('visitorTag').textContent = data.visitor;

  if (editingVisitId) {
    await apiPut('/visits/' + editingVisitId, data);
  } else {
    await apiPost('/visits', data);
  }

  closeVisitForm();
  await loadData();
  navTo(currentPage);
}

async function deleteVisitForm() {
  if (!editingVisitId) return;
  if (!confirm('确定删除这条拜访记录？')) return;
  await apiDelete('/visits/' + editingVisitId);
  closeVisitForm();
  await loadData();
  navTo(currentPage);
}

// ========== Profile ==========
function renderProfile() {
  const visitor = getVisitor();
  const myVisits = visits.filter(v => v.visitor === visitor);
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">${visitor ? visitor[0].toUpperCase() : '?'}</div>
      <div class="profile-name">${visitor || '未登录'}</div>
      <div class="profile-role">上海片区销售</div>
    </div>
    <div class="profile-menu-item" onclick="setVisitor()">
      <span class="pmi-label">修改姓名</span>
      <span class="pmi-value">${visitor || '点击设置'} &rsaquo;</span>
    </div>
    <div class="profile-menu-item">
      <span class="pmi-label">我的拜访记录</span>
      <span class="pmi-value">${myVisits.length} 条 &rsaquo;</span>
    </div>
    <div class="profile-menu-item">
      <span class="pmi-label">客户总数</span>
      <span class="pmi-value">${customers.length} 家</span>
    </div>
    <div class="profile-menu-item">
      <span class="pmi-label">1-6月销售总额</span>
      <span class="pmi-value">¥${fmtF(stats.totalAmount || 0)}</span>
    </div>
    <div class="profile-menu-item" onclick="navTo('dashboard')">
      <span class="pmi-label">刷新数据</span>
      <span class="pmi-value">点击刷新 &rsaquo;</span>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:var(--text-tertiary)">
      上海片区CRM系统 v2.0<br>数据截至 2026.6.30
    </div>
  `;
}

function setVisitor() {
  const name = prompt('请输入你的姓名（用于拜访记录）：', getVisitor());
  if (name && name.trim()) {
    setVisitorName(name.trim());
    document.getElementById('visitorTag').textContent = name.trim();
    if (currentPage === 'profile') renderProfile();
  }
}

// ========== Helpers ==========
function fmtF(n) {
  if (!n || isNaN(n)) return '0';
  return Math.round(n).toLocaleString('zh-CN');
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function getRfmClass(segment) {
  if (!segment) return '';
  if (segment.startsWith('重要价值')) return 'badge-rfm-important';
  if (segment.startsWith('重要保持')) return 'badge-rfm-keep';
  if (segment.startsWith('重要发展')) return 'badge-rfm-develop';
  if (segment.startsWith('重要挽留')) return 'badge-rfm-retain';
  if (segment.startsWith('一般')) return 'badge-rfm-general';
  if (segment === '流失客户') return 'badge-rfm-loss';
  return '';
}

function renderBrandItem(name, amount, bg, color) {
  if (!amount || amount <= 0) return '';
  return `<div style="text-align:center;padding:8px;background:${bg};border-radius:8px">
    <div style="font-size:11px;color:${color}">${name}</div>
    <div style="font-weight:700;color:${color};font-size:14px">¥${fmtF(amount)}</div>
  </div>`;
}

// ========== Start ==========
init();
