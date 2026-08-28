/**
 * App.js — 核心应用逻辑
 * 处理 UI 渲染、用户交互、数据流转
 */

const App = {
  state: {
    currentTab: 'timeline',
    editingId: null,
    mood: '',
    tags: [],
    photos: [],
    milkFeeds: [],
    diaperChanges: [],
    solidFoods: [],
    avatar: '👶',
    filterMonth: '',
    searchText: '',
    charts: {}, // Chart.js 实例
  },

  MOODS: [
    { emoji: '😊', label: '开心', color: '--yellow' },
    { emoji: '😄', label: '兴奋', color: '--orange' },
    { emoji: '😌', label: '平静', color: '--teal' },
    { emoji: '😴', label: '困倦', color: '--blue' },
    { emoji: '😢', label: '难过', color: '--purple' },
    { emoji: '🤒', label: '不舒服', color: '--green' },
    { emoji: '😠', label: '生气', color: '--pink' },
    { emoji: '🤔', label: '好奇', color: '--blue' },
  ],

  AVATARS: ['👶', '👧', '👦', '🧒', '👶🏻', '👧🏻', '👦🏻', '🧒🏻', '🌸', '🐰', '🐻', '🐱'],

  TAG_PRESETS: ['户外活动', '阅读', '画画', '搭积木', '唱歌跳舞', '游泳', '骑车', '看动画片', '去公园', '看医生', '上学', '走亲访友'],

  MILK_TYPES: ['母乳', '配方奶', '混合喂养', '挤出母乳'],
  DIAPER_TYPES: ['小便', '大便', '大小便'],
  POOP_CONSISTENCY: ['正常', '偏干', '偏稀', '糊状', '水样', '颗粒状'],
  POOP_COLORS: ['黄色', '金黄色', '棕色', '绿色', '黄绿色', '黑色', '白色'],
  SOLID_FOOD_PRESETS: ['米粉', '果泥', '菜泥', '蛋黄', '肉泥', '面条', '粥', '馒头', '豆腐', '鱼泥'],

  async init() {
    // 从后端数据库拉取全部数据作为唯一数据源
    const res = await Store.load();
    const child = Store.getChild();
    if (child) {
      this.state.avatar = child.avatar || '👶';
      this._updateNavChild(child);
    }
    if (res.offline) {
      this.toast('后端数据库暂不可用，当前显示的是本地离线缓存', 'warning');
    }
    this.switchTab('timeline');
  },

  /* ===== Tab 切换 ===== */
  switchTab(tab) {
    this.state.currentTab = tab;
    // 清理 chart 实例
    Object.values(this.state.charts).forEach(c => { if (c && c.destroy) c.destroy(); });
    this.state.charts = {};

    // 更新 tab 按钮
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 渲染内容
    const main = document.getElementById('mainContent');
    switch (tab) {
      case 'timeline': main.innerHTML = this._renderTimeline(); this._bindTimeline(); break;
      case 'add':      main.innerHTML = this._renderAddForm(); this._bindAddForm(); break;
      case 'growth':   main.innerHTML = this._renderGrowth(); this._bindGrowth(); break;
      case 'settings':  main.innerHTML = this._renderSettings(); this._bindSettings(); break;
    }
    main.classList.remove('fade-in');
    void main.offsetWidth;
    main.classList.add('fade-in');
  },

  /* ================================================================
   *  记录列表 / 时间线
   * ================================================================ */
  _renderTimeline() {
    const allRecords = Store.getRecords();
    const months = this._getAvailableMonths();

    let html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📖 成长记录</h1>
          <p class="page-subtitle">每一页都是宝贝成长的故事</p>
        </div>
        <div class="filter-bar" style="margin: 0;">
          <select id="filterMonth" onchange="App.state.filterMonth=this.value; App._renderTimelineRefresh()">
            <option value="">全部时间</option>
            ${months.map(m => `<option value="${m.value}" ${this.state.filterMonth === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
          <input type="text" class="search-box" placeholder="🔍 搜索活动、备注、里程碑..." value="${this.state.searchText}"
            oninput="App.state.searchText=this.value; App._renderTimelineRefresh()" />
        </div>
      </div>
    `;

    if (allRecords.length === 0) {
      html += `
        <div class="card">
          <div class="empty-state">
            <div class="empty-icon">📓</div>
            <div class="empty-title">还没有任何记录</div>
            <div class="empty-desc">点击「添加」开始记录宝贝的第一页日记吧！</div>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="App.switchTab('add')">✏️ 写第一条记录</button>
              <button class="btn btn-secondary" onclick="App.addDemoData()">🎯 加载示例数据体验</button>
            </div>
          </div>
        </div>
      `;
      return html;
    }

    html += `<div class="timeline" id="timelineList">${this._renderTimelineList()}</div>`;

    return html;
  },

  _renderTimelineList() {
    const records = this._getFilteredRecords();
    if (records.length === 0) {
      return `<div class="card"><div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">没有找到记录</div>
        <div class="empty-desc">试试调整搜索条件或换个月份</div>
      </div></div>`;
    }
    let html = '';
    records.forEach(r => { html += this._renderRecordCard(r); });
    return html;
  },

  _renderTimelineRefresh() {
    const list = document.getElementById('timelineList');
    if (!list) { this.switchTab('timeline'); return; }
    list.innerHTML = this._renderTimelineList();
  },

  _renderRecordCard(r) {
    const date = new Date(r.date);
    const day = date.getDate();
    const month = `${date.getMonth() + 1}月`;
    const weekday = ['日','一','二','三','四','五','六'][date.getDay()];

    let html = `
      <div class="record-card">
        <div class="record-card-header">
          <div class="record-date">
            <div class="date-badge"><span class="day">${day}</span><span class="month">${month}</span></div>
            <div>
              <div>${date.getFullYear()}年${month}${day}日</div>
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 500;">星期${weekday}</div>
            </div>
          </div>
          <div class="record-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="App.editRecord('${r.id}')">✏️ 编辑</button>
            <button class="btn btn-danger btn-sm" onclick="App.deleteRecord('${r.id}')">🗑</button>
          </div>
        </div>
        <div class="record-card-body">
    `;

    // 心情
    if (r.mood) {
      html += `<div class="record-mood-row"><span class="mood-display">${r.mood}</span><span>今天的心情</span></div>`;
    }

    // 身高体重
    if (r.height || r.weight) {
      html += '<div class="record-growth-stats">';
      if (r.height) html += `<div class="growth-stat">📏 ${r.height} cm</div>`;
      if (r.weight) html += `<div class="growth-stat">⚖️ ${r.weight} kg</div>`;
      html += '</div>';
    }

    // 标签 / 活动
    if (r.tags && r.tags.length > 0) {
      html += '<div class="record-section"><div class="record-section-label">🏷 活动标签</div><div class="record-tags">';
      r.tags.forEach(t => { html += `<span class="record-tag">${t}</span>`; });
      html += '</div></div>';
    }

    // 活动
    if (r.activities) {
      html += `<div class="record-section"><div class="record-section-label">🎯 今日活动</div><div class="record-section-content">${this._escape(r.activities)}</div></div>`;
    }

    // 饮食
    if (r.breakfast || r.lunch || r.dinner || r.snacks) {
      html += '<div class="record-section"><div class="record-section-label">🍽 饮食记录</div><div class="record-meals">';
      if (r.breakfast) html += `<div class="meal-item"><span class="meal-label">🌅 早餐</span><span class="meal-content">${this._escape(r.breakfast)}</span></div>`;
      if (r.lunch)     html += `<div class="meal-item"><span class="meal-label">☀️ 午餐</span><span class="meal-content">${this._escape(r.lunch)}</span></div>`;
      if (r.dinner)    html += `<div class="meal-item"><span class="meal-label">🌙 晚餐</span><span class="meal-content">${this._escape(r.dinner)}</span></div>`;
      if (r.snacks)    html += `<div class="meal-item"><span class="meal-label">🍪 点心</span><span class="meal-content">${this._escape(r.snacks)}</span></div>`;
      html += '</div></div>';
    }

    // 喝奶 / 排泄 / 辅食
    if ((r.milkFeeds && r.milkFeeds.length) || (r.diaperChanges && r.diaperChanges.length) || (r.solidFoods && r.solidFoods.length)) {
      html += '<div class="record-section"><div class="record-section-label">🍼 喂养与护理</div><div class="record-care-grid">';

      if (r.milkFeeds && r.milkFeeds.length) {
        html += '<div class="care-card-mini milk"><div class="mini-title">🍼 喝奶</div><div class="mini-list">';
        r.milkFeeds.forEach(m => {
          let desc = m.type || '';
          if (m.amount) desc += ' ' + this._escape(this._formatMl(m.amount));
          if (m.note) desc += ' · ' + this._escape(m.note);
          html += `<div class="mini-item"><span class="mini-time">${m.time || ''}</span>${desc}</div>`;
        });
        html += '</div></div>';
      }

      if (r.diaperChanges && r.diaperChanges.length) {
        html += '<div class="care-card-mini diaper"><div class="mini-title">🚽 排泄</div><div class="mini-list">';
        r.diaperChanges.forEach(d => {
          let desc = d.type || '';
          if (d.consistency) desc += ' · ' + d.consistency;
          if (d.color) desc += ' · ' + d.color;
          if (d.note) desc += ' · ' + this._escape(d.note);
          html += `<div class="mini-item"><span class="mini-time">${d.time || ''}</span>${desc}</div>`;
        });
        html += '</div></div>';
      }

      if (r.solidFoods && r.solidFoods.length) {
        html += '<div class="care-card-mini solid"><div class="mini-title">🥣 辅食</div><div class="mini-list">';
        r.solidFoods.forEach(s => {
          let desc = s.food || '';
          if (s.amount) desc += ' ' + this._escape(s.amount);
          if (s.note) desc += ' · ' + this._escape(s.note);
          html += `<div class="mini-item"><span class="mini-time">${s.time || ''}</span>${desc}</div>`;
        });
        html += '</div></div>';
      }

      html += '</div></div>';
    }

    // 睡眠
    if (r.sleepHours) {
      html += `<div class="record-section"><div class="record-section-label">😴 睡眠</div><div class="record-section-content">睡了 ${r.sleepHours} 小时</div></div>`;
    }

    // 里程碑
    if (r.milestones) {
      html += `<div class="record-section"><div class="record-section-label">⭐ 成长里程碑</div><div class="record-section-content">${this._escape(r.milestones)}</div></div>`;
    }

    // 备注
    if (r.notes) {
      html += `<div class="record-section"><div class="record-section-label">📝 备注</div><div class="record-section-content">${this._escape(r.notes)}</div></div>`;
    }

    // 照片
    if (r.photos && r.photos.length > 0) {
      html += '<div class="record-section"><div class="record-section-label">📷 照片</div><div class="record-photos">';
      r.photos.forEach((p, i) => {
        html += `<img class="record-photo" src="${p}" alt="照片${i+1}" onclick="App.viewPhoto('${r.id}', ${i})" />`;
      });
      html += '</div></div>';
    }

    html += '</div></div>';
    return html;
  },

  _bindTimeline() { /* 事件已通过 inline 绑定 */ },

  _getFilteredRecords() {
    let records = Store.getRecords();
    if (this.state.filterMonth) {
      records = records.filter(r => r.date.startsWith(this.state.filterMonth));
    }
    if (this.state.searchText) {
      const q = this.state.searchText.toLowerCase();
      records = records.filter(r =>
        (r.activities || '').toLowerCase().includes(q) ||
        (r.milestones || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.breakfast || '').toLowerCase().includes(q) ||
        (r.lunch || '').toLowerCase().includes(q) ||
        (r.dinner || '').toLowerCase().includes(q) ||
        (r.snacks || '').toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (r.milkFeeds || []).some(m => (m.type || '').toLowerCase().includes(q) || (m.note || '').toLowerCase().includes(q)) ||
        (r.diaperChanges || []).some(d => (d.note || '').toLowerCase().includes(q)) ||
        (r.solidFoods || []).some(s => (s.food || '').toLowerCase().includes(q) || (s.note || '').toLowerCase().includes(q))
      );
    }
    return records;
  },

  _getAvailableMonths() {
    const records = Store.getRecords();
    const set = new Set();
    records.forEach(r => { if (r.date) set.add(r.date.substring(0, 7)); });
    const arr = [...set].sort().reverse();
    return arr.map(v => {
      const [y, m] = v.split('-');
      return { value: v, label: `${y}年${parseInt(m)}月` };
    });
  },

  /* ================================================================
   *  添加 / 编辑记录
   * ================================================================ */
  _renderAddForm() {
    const editing = this.state.editingId ? Store.getRecord(this.state.editingId) : null;

    // 如果编辑，恢复状态；否则重置
    if (editing) {
      this.state.mood = editing.mood || '';
      this.state.tags = [...(editing.tags || [])];
      this.state.photos = [...(editing.photos || [])];
      this.state.milkFeeds = [...(editing.milkFeeds || [])];
      this.state.diaperChanges = [...(editing.diaperChanges || [])];
      this.state.solidFoods = [...(editing.solidFoods || [])];
    } else {
      this.state.mood = '';
      this.state.tags = [];
      this.state.photos = [];
      this.state.milkFeeds = [];
      this.state.diaperChanges = [];
      this.state.solidFoods = [];
    }

    const now = new Date();
    const todayLocal = editing ? editing.date : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${editing ? '✏️ 编辑记录' : '✏️ 添加记录'}</h1>
          <p class="page-subtitle">记录今天的点滴，留住成长的美好</p>
        </div>
        ${editing ? `<button class="btn btn-secondary" onclick="App.cancelEdit()">← 返回列表</button>` : ''}
      </div>
    `;

    html += `<div class="card">
      <datalist id="solidFoodList">${this.SOLID_FOOD_PRESETS.map(f => `<option value="${f}">`).join('')}</datalist>
      <!-- 日期 -->
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">📅 日期</label>
          <input type="date" class="form-input" id="recordDate" value="${todayLocal}" />
        </div>
        <div class="form-group">
          <label class="form-label">😴 睡眠时长（小时）</label>
          <input type="number" class="form-input" id="recordSleep" min="0" max="24" step="0.5"
            value="${editing ? editing.sleepHours || '' : ''}" placeholder="如 10.5" />
        </div>
      </div>

      <!-- 心情 -->
      <div class="form-group">
        <label class="form-label">心情<span class="label-hint">选一个今天的状态</span></label>
        <div class="mood-grid" id="moodGrid">
          ${this.MOODS.map(m => `
            <div class="mood-option ${this.state.mood === m.emoji ? 'selected' : ''}"
              onclick="App.selectMood('${m.emoji}')">
              <span class="mood-emoji">${m.emoji}</span>
              <span class="mood-label">${m.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 身高体重 -->
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">📏 身高（cm）</label>
          <input type="number" class="form-input" id="recordHeight" min="0" max="250" step="0.1"
            value="${editing ? editing.height || '' : ''}" placeholder="如 95.5" />
        </div>
        <div class="form-group">
          <label class="form-label">⚖️ 体重（kg）</label>
          <input type="number" class="form-input" id="recordWeight" min="0" max="200" step="0.1"
            value="${editing ? editing.weight || '' : ''}" placeholder="如 14.2" />
        </div>
      </div>

      <!-- 活动标签 -->
      <div class="form-group">
        <label class="form-label">🏷 活动标签<span class="label-hint">回车添加，可点击下方预设</span></label>
        <div class="tag-input-wrap" id="tagWrap">
          <div id="tagList" style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${this.state.tags.map((t, i) => `<span class="tag-chip">${t}<button onclick="App.removeTag(${i})">×</button></span>`).join('')}
          </div>
          <input type="text" class="tag-input" id="tagInput" placeholder="输入标签后回车..." />
        </div>
        <div id="tagPresets" style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
          ${this.TAG_PRESETS.filter(t => !this.state.tags.includes(t)).map(t =>
            `<button class="btn btn-secondary btn-sm" onclick="App.addTag('${t}')">+ ${t}</button>`
          ).join('')}
        </div>
      </div>

      <!-- 今日活动 -->
      <div class="form-group">
        <label class="form-label">🎯 今日活动</label>
        <textarea class="form-textarea" id="recordActivities" rows="3"
          placeholder="今天做了什么有趣的事？">${editing ? this._escape(editing.activities || '') : ''}</textarea>
      </div>

      <!-- 饮食 -->
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">🌅 早餐</label>
          <input type="text" class="form-input" id="recordBreakfast" value="${editing ? this._escape(editing.breakfast || '') : ''}" placeholder="如 鸡蛋、牛奶、面包" />
        </div>
        <div class="form-group">
          <label class="form-label">☀️ 午餐</label>
          <input type="text" class="form-input" id="recordLunch" value="${editing ? this._escape(editing.lunch || '') : ''}" placeholder="如 米饭、红烧肉、青菜" />
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">🌙 晚餐</label>
          <input type="text" class="form-input" id="recordDinner" value="${editing ? this._escape(editing.dinner || '') : ''}" placeholder="如 面条、水果" />
        </div>
        <div class="form-group">
          <label class="form-label">🍪 点心/零食</label>
          <input type="text" class="form-input" id="recordSnacks" value="${editing ? this._escape(editing.snacks || '') : ''}" placeholder="如 酸奶、饼干" />
        </div>
      </div>

      <!-- 喝奶记录 -->
      <div class="form-group">
        <label class="form-label">🍼 喝奶记录<span class="label-hint">可多次记录，追踪喂养量</span></label>
        <div class="care-section">
          <div class="care-entries" id="milkList">
            ${this.state.milkFeeds.length ? this.state.milkFeeds.map((m, i) => this._renderMilkEntry(m, i)).join('') : '<div class="care-empty">暂无记录，点击下方添加</div>'}
          </div>
          <button class="care-add-btn" onclick="App.addMilkFeed()">+ 添加喝奶记录</button>
        </div>
      </div>

      <!-- 排泄记录 -->
      <div class="form-group">
        <label class="form-label">🚽 排泄记录<span class="label-hint">大小便情况，监测消化健康</span></label>
        <div class="care-section">
          <div class="care-entries" id="diaperList">
            ${this.state.diaperChanges.length ? this.state.diaperChanges.map((d, i) => this._renderDiaperEntry(d, i)).join('') : '<div class="care-empty">暂无记录，点击下方添加</div>'}
          </div>
          <button class="care-add-btn" onclick="App.addDiaperChange()">+ 添加排泄记录</button>
        </div>
      </div>

      <!-- 辅食记录 -->
      <div class="form-group">
        <label class="form-label">🥣 辅食记录<span class="label-hint">新尝试的辅食及反应</span></label>
        <div class="care-section">
          <div class="care-entries" id="solidList">
            ${this.state.solidFoods.length ? this.state.solidFoods.map((s, i) => this._renderSolidEntry(s, i)).join('') : '<div class="care-empty">暂无记录，点击下方添加</div>'}
          </div>
          <button class="care-add-btn" onclick="App.addSolidFood()">+ 添加辅食记录</button>
        </div>
      </div>

      <!-- 里程碑 -->
      <div class="form-group">
        <label class="form-label">⭐ 成长里程碑<span class="label-hint">学会了什么新技能？</span></label>
        <textarea class="form-textarea" id="recordMilestones" rows="2"
          placeholder="如 第一次自己穿鞋、学会了说「谢谢」、第一天上幼儿园...">${editing ? this._escape(editing.milestones || '') : ''}</textarea>
      </div>

      <!-- 照片 -->
      <div class="form-group">
        <label class="form-label">📷 照片<span class="label-hint">可选，最多 6 张</span></label>
        <div class="photo-upload-area" id="photoUpload" onclick="document.getElementById('photoFile').click()">
          <div class="photo-upload-icon">📸</div>
          <div class="photo-upload-text">点击或拖拽上传照片（自动压缩）</div>
          <input type="file" id="photoFile" accept="image/*" multiple style="display:none" onchange="App.uploadPhotos(this.files)" />
        </div>
        <div class="photo-grid" id="photoGrid">
          ${this.state.photos.map((p, i) => `
            <div class="photo-item">
              <img src="${p}" alt="照片${i+1}" />
              <button class="photo-remove" onclick="event.stopPropagation(); App.removePhoto(${i})">×</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-group">
        <label class="form-label">📝 备注</label>
        <textarea class="form-textarea" id="recordNotes" rows="3"
          placeholder="其他想记录的事情...">${editing ? this._escape(editing.notes || '') : ''}</textarea>
      </div>

      <!-- 提交 -->
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        ${editing ? `<button class="btn btn-secondary" onclick="App.cancelEdit()">取消</button>` : ''}
        <button class="btn btn-primary" onclick="App.saveRecord()">
          ${editing ? '💾 保存修改' : '✨ 添加记录'}
        </button>
      </div>
    </div>`;

    return html;
  },

  _bindAddForm() {
    // 标签输入
    const tagInput = document.getElementById('tagInput');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = tagInput.value.trim();
          if (val) {
            this.addTag(val);
            tagInput.value = '';
          }
        }
      });
    }

    // 拖拽上传
    const uploadArea = document.getElementById('photoUpload');
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        this.uploadPhotos(e.dataTransfer.files);
      });
    }
  },

  selectMood(emoji) {
    this.state.mood = this.state.mood === emoji ? '' : emoji;
    document.querySelectorAll('.mood-option').forEach(el => {
      el.classList.toggle('selected', el.querySelector('.mood-emoji').textContent === this.state.mood);
    });
  },

  addTag(tag) {
    tag = tag.trim();
    if (tag && !this.state.tags.includes(tag)) {
      this.state.tags.push(tag);
      this._renderTags();
    }
  },

  removeTag(index) {
    this.state.tags.splice(index, 1);
    this._renderTags();
  },

  _renderTags() {
    const list = document.getElementById('tagList');
    if (!list) return;
    list.innerHTML = this.state.tags.map((t, i) =>
      `<span class="tag-chip">${t}<button onclick="App.removeTag(${i})">×</button></span>`
    ).join('');
    // 更新预设按钮
    const presets = document.getElementById('tagPresets');
    if (presets) {
      presets.innerHTML = this.TAG_PRESETS.filter(t => !this.state.tags.includes(t)).map(t =>
        `<button class="btn btn-secondary btn-sm" onclick="App.addTag('${t}')">+ ${t}</button>`
      ).join('');
    }
  },

  async uploadPhotos(files) {
    if (this.state.photos.length + files.length > 6) {
      this.toast('最多上传 6 张照片', 'warning');
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await Store.compressImage(file);
        this.state.photos.push(compressed);
      } catch (err) {
        this.toast(`图片 ${file.name} 上传失败`, 'error');
      }
    }
    this._renderPhotos();
    // 清空 file input
    document.getElementById('photoFile').value = '';
  },

  removePhoto(index) {
    this.state.photos.splice(index, 1);
    this._renderPhotos();
  },

  _renderPhotos() {
    const grid = document.getElementById('photoGrid');
    if (!grid) return;
    grid.innerHTML = this.state.photos.map((p, i) => `
      <div class="photo-item">
        <img src="${p}" alt="照片${i+1}" />
        <button class="photo-remove" onclick="event.stopPropagation(); App.removePhoto(${i})">×</button>
      </div>
    `).join('');
  },

  /* ================================================================
   *  护理记录 — 喝奶 / 排泄 / 辅食
   * ================================================================ */
  _renderMilkEntry(m, i) {
    return `
      <div class="care-entry">
        <input type="time" class="care-time" data-field="time" value="${m.time || ''}" />
        <select class="care-type-sel" data-field="type">
          ${this.MILK_TYPES.map(t => `<option value="${t}" ${m.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <input type="text" data-field="amount" value="${this._escape(String(m.amount || '').replace(/ml|毫升/gi, '').trim())}" placeholder="用量" style="flex: 0 0 auto; min-width: 80px;" />
        <span style="align-self: center; color: #888; font-size: 13px;">ml</span>
        <input type="text" data-field="note" value="${this._escape(m.note || '')}" placeholder="备注" />
        <button class="care-remove" onclick="App.removeMilkFeed(${i})">×</button>
      </div>
    `;
  },

  _renderDiaperEntry(d, i) {
    return `
      <div class="care-entry">
        <input type="time" class="care-time" data-field="time" value="${d.time || ''}" />
        <select class="care-type-sel" data-field="type">
          ${this.DIAPER_TYPES.map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <select data-field="consistency" style="flex: 0 0 auto; min-width: 80px;">
          <option value="">性状</option>
          ${this.POOP_CONSISTENCY.map(c => `<option value="${c}" ${d.consistency === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <select data-field="color" style="flex: 0 0 auto; min-width: 80px;">
          <option value="">颜色</option>
          ${this.POOP_COLORS.map(c => `<option value="${c}" ${d.color === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
        <input type="text" data-field="note" value="${this._escape(d.note || '')}" placeholder="备注" style="min-width: 60px;" />
        <button class="care-remove" onclick="App.removeDiaperChange(${i})">×</button>
      </div>
    `;
  },

  _renderSolidEntry(s, i) {
    return `
      <div class="care-entry">
        <input type="time" class="care-time" data-field="time" value="${s.time || ''}" />
        <input type="text" data-field="food" value="${this._escape(s.food || '')}" placeholder="食物名称" list="solidFoodList" style="flex: 0 0 auto; min-width: 100px;" />
        <input type="text" data-field="amount" value="${this._escape(s.amount || '')}" placeholder="用量" style="flex: 0 0 auto; min-width: 70px;" />
        <input type="text" data-field="note" value="${this._escape(s.note || '')}" placeholder="反应/备注" />
        <button class="care-remove" onclick="App.removeSolidFood(${i})">×</button>
      </div>
    `;
  },

  _nowTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  /** 用量格式化：纯数字自动补 ml 单位，已含单位则原样返回 */
  _formatMl(v) {
    if (!v) return '';
    const s = String(v).trim();
    return /ml|毫升/i.test(s) ? s : `${s}ml`;
  },

  addMilkFeed() {
    this._saveCareState();
    this.state.milkFeeds.push({ time: this._nowTime(), type: '配方奶', amount: '', note: '' });
    this._renderMilkList();
  },

  removeMilkFeed(index) {
    this._saveCareState();
    this.state.milkFeeds.splice(index, 1);
    this._renderMilkList();
  },

  addDiaperChange() {
    this._saveCareState();
    this.state.diaperChanges.push({ time: this._nowTime(), type: '小便', consistency: '', color: '', note: '' });
    this._renderDiaperList();
  },

  removeDiaperChange(index) {
    this._saveCareState();
    this.state.diaperChanges.splice(index, 1);
    this._renderDiaperList();
  },

  addSolidFood() {
    this._saveCareState();
    this.state.solidFoods.push({ time: this._nowTime(), food: '', amount: '', note: '' });
    this._renderSolidList();
  },

  removeSolidFood(index) {
    this._saveCareState();
    this.state.solidFoods.splice(index, 1);
    this._renderSolidList();
  },

  _renderMilkList() {
    const c = document.getElementById('milkList');
    if (!c) return;
    c.innerHTML = this.state.milkFeeds.length
      ? this.state.milkFeeds.map((m, i) => this._renderMilkEntry(m, i)).join('')
      : '<div class="care-empty">暂无记录，点击下方添加</div>';
  },

  _renderDiaperList() {
    const c = document.getElementById('diaperList');
    if (!c) return;
    c.innerHTML = this.state.diaperChanges.length
      ? this.state.diaperChanges.map((d, i) => this._renderDiaperEntry(d, i)).join('')
      : '<div class="care-empty">暂无记录，点击下方添加</div>';
  },

  _renderSolidList() {
    const c = document.getElementById('solidList');
    if (!c) return;
    c.innerHTML = this.state.solidFoods.length
      ? this.state.solidFoods.map((s, i) => this._renderSolidEntry(s, i)).join('')
      : '<div class="care-empty">暂无记录，点击下方添加</div>';
  },

  /** 从 DOM 读取当前护理记录值到 state */
  _saveCareState() {
    this.state.milkFeeds = this._collectCareEntries('milkList', ['time', 'type', 'amount', 'note']);
    this.state.diaperChanges = this._collectCareEntries('diaperList', ['time', 'type', 'consistency', 'color', 'note']);
    this.state.solidFoods = this._collectCareEntries('solidList', ['time', 'food', 'amount', 'note']);
  },

  _collectCareEntries(containerId, fields) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const entries = [];
    container.querySelectorAll('.care-entry').forEach(row => {
      const entry = {};
      fields.forEach(f => {
        const el = row.querySelector(`[data-field="${f}"]`);
        entry[f] = el ? el.value.trim() : '';
      });
      if (Object.values(entry).some(v => v)) entries.push(entry);
    });
    return entries;
  },

  async saveRecord() {
    const date = document.getElementById('recordDate').value;
    if (!date) {
      this.toast('请选择日期', 'warning');
      return;
    }

    // 先保存护理记录数据（从 DOM 读取到 state）
    this._saveCareState();

    const record = {
      date,
      mood: this.state.mood,
      height: parseFloat(document.getElementById('recordHeight').value) || null,
      weight: parseFloat(document.getElementById('recordWeight').value) || null,
      tags: [...this.state.tags],
      activities: document.getElementById('recordActivities').value.trim(),
      breakfast: document.getElementById('recordBreakfast').value.trim(),
      lunch: document.getElementById('recordLunch').value.trim(),
      dinner: document.getElementById('recordDinner').value.trim(),
      snacks: document.getElementById('recordSnacks').value.trim(),
      milkFeeds: [...this.state.milkFeeds],
      diaperChanges: [...this.state.diaperChanges],
      solidFoods: [...this.state.solidFoods],
      sleepHours: parseFloat(document.getElementById('recordSleep').value) || null,
      milestones: document.getElementById('recordMilestones').value.trim(),
      photos: [...this.state.photos],
      notes: document.getElementById('recordNotes').value.trim(),
    };

    try {
      if (this.state.editingId) {
        await Store.updateRecord(this.state.editingId, record);
        this.toast('记录已更新！', 'success');
        this.cancelEdit();
      } else {
        await Store.addRecord(record);
        this.toast('记录已添加！', 'success');
        this.switchTab('add');
      }
    } catch (err) {
      this.toast('保存失败（后端不可达）：' + err.message, 'error');
      return;
    }
    this._updateNavChild(Store.getChild());
  },

  editRecord(id) {
    this.state.editingId = id;
    this.switchTab('add');
  },

  cancelEdit() {
    this.state.editingId = null;
    this.state.mood = '';
    this.state.tags = [];
    this.state.photos = [];
    this.state.milkFeeds = [];
    this.state.diaperChanges = [];
    this.state.solidFoods = [];
    this.switchTab('timeline');
  },

  deleteRecord(id) {
    this.showConfirm('删除记录', '确定要删除这条记录吗？删除后无法恢复。', async () => {
      try {
        await Store.deleteRecord(id);
        this.toast('记录已删除', 'success');
        this._renderTimelineRefresh();
      } catch (err) {
        this.toast('删除失败（后端不可达）：' + err.message, 'error');
      }
    });
  },

  /* ================================================================
   *  成长曲线 / 统计
   * ================================================================ */
  _renderGrowth() {
    const records = Store.getRecords();
    const child = Store.getChild();

    if (records.length === 0) {
      return `
        <div class="page-header"><div>
          <h1 class="page-title">📊 成长曲线</h1>
          <p class="page-subtitle">用数据见证宝贝的每一步成长</p>
        </div></div>
        <div class="card"><div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">暂无数据</div>
          <div class="empty-desc">添加记录后即可查看成长曲线</div>
          <button class="btn btn-primary" onclick="App.switchTab('add')">✏️ 添加记录</button>
        </div></div>
      `;
    }

    // 统计数据
    const heightData = records.filter(r => r.height).sort((a, b) => new Date(a.date) - new Date(b.date));
    const weightData = records.filter(r => r.weight).sort((a, b) => new Date(a.date) - new Date(b.date));
    const sleepData = records.filter(r => r.sleepHours).sort((a, b) => new Date(a.date) - new Date(b.date));
    const moodData = records.filter(r => r.mood);

    const latestHeight = heightData.length ? heightData[heightData.length - 1].height : null;
    const latestWeight = weightData.length ? weightData[weightData.length - 1].weight : null;
    const avgSleep = sleepData.length ? (sleepData.reduce((s, r) => s + r.sleepHours, 0) / sleepData.length).toFixed(1) : null;

    // 计算年龄
    let ageText = '—';
    if (child && child.birthday) {
      const birth = new Date(child.birthday);
      const now = new Date();
      const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      if (months >= 12) {
        ageText = `${Math.floor(months / 12)}岁${months % 12 ? months % 12 + '个月' : ''}`;
      } else {
        ageText = `${months}个月`;
      }
    }

    let html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">📊 成长曲线</h1>
          <p class="page-subtitle">${child ? child.name : '宝贝'}的成长数据一览</p>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="growth-stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🎂</div>
          <div class="stat-value">${ageText}</div>
          <div class="stat-label">宝贝年龄</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📏</div>
          <div class="stat-value">${latestHeight || '—'}<span class="stat-unit"> cm</span></div>
          <div class="stat-label">最新身高</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚖️</div>
          <div class="stat-value">${latestWeight || '—'}<span class="stat-unit"> kg</span></div>
          <div class="stat-label">最新体重</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">😴</div>
          <div class="stat-value">${avgSleep || '—'}<span class="stat-unit"> h</span></div>
          <div class="stat-label">平均睡眠</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📓</div>
          <div class="stat-value">${records.length}</div>
          <div class="stat-label">总记录数</div>
        </div>
      </div>
    `;

    // 身高曲线
    if (heightData.length >= 1) {
      html += `
        <div class="card">
          <div class="card-header"><div class="card-title">📏 身高变化曲线</div></div>
          <div class="chart-container"><canvas id="heightChart"></canvas></div>
        </div>
      `;
    }

    // 体重曲线
    if (weightData.length >= 1) {
      html += `
        <div class="card">
          <div class="card-header"><div class="card-title">⚖️ 体重变化曲线</div></div>
          <div class="chart-container"><canvas id="weightChart"></canvas></div>
        </div>
      `;
    }

    // 睡眠曲线
    if (sleepData.length >= 1) {
      html += `
        <div class="card">
          <div class="card-header"><div class="card-title">😴 睡眠时长趋势</div></div>
          <div class="chart-container"><canvas id="sleepChart"></canvas></div>
        </div>
      `;
    }

    // 心情分布
    if (moodData.length >= 1) {
      html += `
        <div class="card">
          <div class="card-header"><div class="card-title">😊 心情分布</div></div>
          <div class="chart-container"><canvas id="moodChart"></canvas></div>
        </div>
      `;
    }

    return html;
  },

  _bindGrowth() {
    const records = Store.getRecords();
    const colors = {
      pink: 'rgba(255, 107, 157, 0.8)',
      teal: 'rgba(78, 205, 196, 0.8)',
      yellow: 'rgba(255, 217, 61, 0.8)',
      blue: 'rgba(116, 185, 255, 0.8)',
      purple: 'rgba(162, 155, 254, 0.8)',
      green: 'rgba(107, 203, 119, 0.8)',
      orange: 'rgba(255, 159, 67, 0.8)',
    };

    // 身高曲线
    const heightData = records.filter(r => r.height).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (heightData.length >= 1) {
      const ctx = document.getElementById('heightChart');
      if (ctx) {
        this.state.charts.height = new Chart(ctx, {
          type: 'line',
          data: {
            labels: heightData.map(r => this._formatChartDate(r.date)),
            datasets: [{
              label: '身高 (cm)',
              data: heightData.map(r => r.height),
              borderColor: colors.pink,
              backgroundColor: 'rgba(255, 107, 157, 0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: colors.pink,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            }],
          },
          options: this._chartOptions('cm'),
        });
      }
    }

    // 体重曲线
    const weightData = records.filter(r => r.weight).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (weightData.length >= 1) {
      const ctx = document.getElementById('weightChart');
      if (ctx) {
        this.state.charts.weight = new Chart(ctx, {
          type: 'line',
          data: {
            labels: weightData.map(r => this._formatChartDate(r.date)),
            datasets: [{
              label: '体重 (kg)',
              data: weightData.map(r => r.weight),
              borderColor: colors.teal,
              backgroundColor: 'rgba(78, 205, 196, 0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: colors.teal,
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
            }],
          },
          options: this._chartOptions('kg'),
        });
      }
    }

    // 睡眠曲线
    const sleepData = records.filter(r => r.sleepHours).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sleepData.length >= 1) {
      const ctx = document.getElementById('sleepChart');
      if (ctx) {
        this.state.charts.sleep = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sleepData.map(r => this._formatChartDate(r.date)),
            datasets: [{
              label: '睡眠 (小时)',
              data: sleepData.map(r => r.sleepHours),
              backgroundColor: colors.blue,
              borderRadius: 8,
              borderSkipped: false,
            }],
          },
          options: this._chartOptions('小时'),
        });
      }
    }

    // 心情分布
    const moodData = records.filter(r => r.mood);
    if (moodData.length >= 1) {
      const moodCounts = {};
      moodData.forEach(r => { moodCounts[r.mood] = (moodCounts[r.mood] || 0) + 1; });
      const ctx = document.getElementById('moodChart');
      if (ctx) {
        this.state.charts.mood = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(moodCounts),
            datasets: [{
              data: Object.values(moodCounts),
              backgroundColor: Object.values(colors),
              borderWidth: 3,
              borderColor: '#fff',
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right', labels: { font: { size: 14, family: 'Nunito' }, padding: 16 } },
            },
          },
        });
      }
    }
  },

  _chartOptions(unit) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(45, 52, 54, 0.9)',
          padding: 12,
          titleFont: { size: 13, family: 'Nunito' },
          bodyFont: { size: 13, family: 'Nunito' },
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y || ctx.parsed} ${unit}` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11, family: 'Nunito' }, color: '#636E72' } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 11, family: 'Nunito' }, color: '#636E72', callback: (v) => v + ' ' + unit },
        },
      },
    };
  },

  _formatChartDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  /* ================================================================
   *  设置页面
   * ================================================================ */
  _renderSettings() {
    const child = Store.getChild() || {};
    const recordCount = Store.getRecords().length;

    let html = `
      <div class="page-header">
        <div>
          <h1 class="page-title">⚙️ 设置</h1>
          <p class="page-subtitle">管理宝贝档案和数据</p>
        </div>
      </div>
    `;

    // 宝贝档案
    html += `
      <div class="card">
        <div class="card-header"><div class="card-title">👶 宝贝档案</div></div>
        <div class="settings-avatar-row">
          <div class="avatar-preview" id="avatarPreview">${child.avatar || this.state.avatar}</div>
          <div style="flex: 1;">
            <label class="form-label">选择头像</label>
            <div class="avatar-options" id="avatarOptions">
              ${this.AVATARS.map(a => `
                <div class="avatar-option ${this.state.avatar === a ? 'selected' : ''}" onclick="App.selectAvatar('${a}')">${a}</div>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">宝贝姓名</label>
            <input type="text" class="form-input" id="childName" value="${this._escape(child.name || '')}" placeholder="如 小苹果" />
          </div>
          <div class="form-group">
            <label class="form-label">性别</label>
            <select class="form-select" id="childGender">
              <option value="girl" ${child.gender === 'girl' ? 'selected' : ''}>👧 女孩</option>
              <option value="boy" ${child.gender === 'boy' ? 'selected' : ''}>👦 男孩</option>
              <option value="other" ${child.gender === 'other' ? 'selected' : ''}>🧒 其他</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">🎂 出生日期</label>
          <input type="date" class="form-input" id="childBirthday" value="${child.birthday || ''}" />
        </div>
        <button class="btn btn-primary" onclick="App.saveChildProfile()">💾 保存档案</button>
      </div>
    `;

    // 快速开始
    if (recordCount === 0) {
      html += `
        <div class="card" style="border: 2px dashed var(--pink-light);">
          <div class="card-header"><div class="card-title">🎯 快速体验</div></div>
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
            还没有记录？一键加载示例数据，立即体验所有功能。
          </p>
          <button class="btn btn-secondary" onclick="App.addDemoData()">🎯 加载示例数据</button>
        </div>
      `;
    }

    // 数据导出
    html += `
      <div class="card">
        <div class="card-header"><div class="card-title">📤 数据导出</div></div>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
          当前共有 <strong style="color: var(--pink-dark);">${recordCount}</strong> 条记录，选择格式导出：
        </p>
        <div class="data-actions">
          <button class="btn btn-primary" onclick="App.doExportPDF()">
            📄 导出 PDF
          </button>
          <button class="btn btn-teal" onclick="App.doExportCSV()">
            📊 导出 CSV
          </button>
          <button class="btn btn-secondary" onclick="App.doExportJSON()">
            💾 导出 JSON 备份
          </button>
        </div>
      </div>
    `;

    // 后端数据存储状态
    const online = Store.isOnline();
    const pending = Store.pendingCount();
    html += `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🗄️ 后端数据存储</div>
          <span class="db-status-badge ${online ? 'db-on' : 'db-off'}">
            ${online ? '在线' : '离线'}
          </span>
        </div>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">
          数据由后端数据库（MySQL）统一存储，前端展示与保存均依赖它。
          目标：<code>${this._escape(DB_CONFIG.apiBaseUrl)}</code>
        </p>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
          离线待重试变更：<strong style="color: var(--pink-dark);">${pending}</strong> 条
          ${pending > 0 ? '（恢复连接后自动重试）' : '（后端在线时即时写入）'}
        </p>
        <div class="data-actions">
          <button class="btn btn-secondary" onclick="App.dbTestConnection()">🔌 测试连接</button>
          <button class="btn btn-teal" onclick="App.dbReload()">🔄 重新加载</button>
          <button class="btn btn-primary" onclick="App.dbPushAll()">☁️ 全量推送</button>
        </div>
      </div>
    `;

    // 数据导入
    html += `
      <div class="card">
        <div class="card-header"><div class="card-title">📥 数据导入</div></div>
        <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
          从 JSON 备份文件恢复数据（将覆盖现有记录）
        </p>
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">
          📂 选择 JSON 文件
        </button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="App.importJSON(this.files[0])" />
      </div>
    `;

    // 危险操作
    if (recordCount > 0) {
      html += `
        <div class="card" style="border-color: #FFD0CC;">
          <div class="card-header"><div class="card-title" style="color: #E74C3C;">⚠️ 危险操作</div></div>
          <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 16px;">
            删除所有记录，此操作不可撤销，请确保已导出备份。
          </p>
          <button class="btn btn-danger" onclick="App.clearAllData()">🗑 清空所有记录</button>
        </div>
      `;
    }

    return html;
  },

  _bindSettings() { /* 事件已通过 inline 绑定 */ },

  selectAvatar(emoji) {
    this.state.avatar = emoji;
    document.getElementById('avatarPreview').textContent = emoji;
    document.querySelectorAll('.avatar-option').forEach(el => {
      el.classList.toggle('selected', el.textContent === emoji);
    });
  },

  async saveChildProfile() {
    const name = document.getElementById('childName').value.trim();
    if (!name) {
      this.toast('请输入宝贝姓名', 'warning');
      return;
    }
    const profile = {
      name,
      gender: document.getElementById('childGender').value,
      birthday: document.getElementById('childBirthday').value,
      avatar: this.state.avatar,
    };
    try {
      await Store.saveChild(profile);
      this._updateNavChild(profile);
      this.toast('档案已保存！', 'success');
    } catch (err) {
      this.toast('保存失败（后端不可达）：' + err.message, 'error');
    }
  },

  doExportPDF() {
    Exporter.exportPDF(Store.getChild(), Store.getRecords());
  },

  doExportCSV() {
    Exporter.exportCSV(Store.getChild(), Store.getRecords());
  },

  doExportJSON() {
    Exporter.exportJSON(Store.getAllData());
  },

  /* ===== 后端数据操作 ===== */
  async dbTestConnection() {
    this.toast('正在测试后端连接…', 'info');
    const result = await ApiClient.testConnection();
    this.toast(result.message, result.ok ? 'success' : 'error');
  },

  async dbReload() {
    this.toast('正在从后端重新加载…', 'info');
    try {
      const res = await Store.load();
      if (res.offline) {
        this.toast('后端暂不可用，仍显示本地离线缓存', 'warning');
      } else {
        this.toast('已从后端重新加载 ✅', 'success');
        const child = Store.getChild();
        if (child) {
          this.state.avatar = child.avatar || '👶';
          this._updateNavChild(child);
        }
      }
    } catch (err) {
      this.toast('加载失败：' + err.message, 'error');
    }
    this.switchTab('settings');
  },

  async dbPushAll() {
    this.showConfirm('全量推送', '将用本地数据覆盖后端数据库（含档案与全部记录）。确定继续？', async () => {
      try {
        const result = await Store.pushAll();
        this.toast(result.message, 'success');
      } catch (err) {
        this.toast('推送失败（后端不可达）：' + err.message, 'error');
      }
      this.switchTab('settings');
    });
  },

  importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.showConfirm('导入数据', `即将导入 ${data.records ? data.records.length : 0} 条记录，将覆盖现有数据。确定继续？`, async () => {
          try {
            await Store.importData(data);
            const child = Store.getChild();
            if (child) {
              this.state.avatar = child.avatar || '👶';
              this._updateNavChild(child);
            }
            this.toast('数据导入成功！', 'success');
            this.switchTab('timeline');
          } catch (err) {
            this.toast('导入失败（后端不可达）：' + err.message, 'error');
          }
        });
      } catch (err) {
        this.toast('导入失败：文件格式不正确', 'error');
      }
    };
    reader.readAsText(file);
  },

  clearAllData() {
    this.showConfirm('清空所有记录', '这将永久删除所有记录和孩子档案，且无法恢复。确定要继续吗？', async () => {
      try {
        await Store.clearAllRecords();
        this.state.avatar = '👶';
        this._updateNavChild(null);
        this.toast('所有数据已清空', 'success');
        this.switchTab('settings');
      } catch (err) {
        this.toast('清空失败（后端不可达）：' + err.message, 'error');
      }
    });
  },

  /* ================================================================
   *  示例数据
   * ================================================================ */
  addDemoData() {
    if (Store.getRecords().length > 0) {
      this.showConfirm('添加示例数据', '当前已有记录，示例数据将追加到现有记录中。确定继续？', () => this._doAddDemo());
    } else {
      this._doAddDemo();
    }
  },

  async _doAddDemo() {
    try {
      const child = { name: '小苹果', gender: 'girl', birthday: '2022-06-15', avatar: '👧' };
      await Store.saveChild(child);
      this.state.avatar = '👧';
      this._updateNavChild(child);

    const demo = [
      { date: '2026-07-01', mood: '😊', height: 94.5, weight: 13.8, tags: ['户外活动','去公园'], activities: '今天去了小区旁边的公园玩滑梯，交到了新朋友！', breakfast: '小米粥 + 鸡蛋羹', lunch: '软米饭 + 番茄炒蛋 + 青菜', dinner: '南瓜面条', snacks: '酸奶 + 草莓', sleepHours: 10.5, milestones: '可以自己上下楼梯了！', notes: '天气很好，晒了不少太阳。',
        milkFeeds: [ {time:'06:30', type:'配方奶', amount:'150ml', note:''}, {time:'10:00', type:'配方奶', amount:'120ml', note:''}, {time:'15:30', type:'配方奶', amount:'150ml', note:''}, {time:'20:00', type:'配方奶', amount:'180ml', note:'睡前奶'} ],
        diaperChanges: [ {time:'07:00', type:'大小便', consistency:'正常', color:'黄色', note:''}, {time:'11:30', type:'小便', consistency:'', color:'', note:''}, {time:'16:00', type:'大便', consistency:'正常', color:'棕色', note:''} ],
        solidFoods: [ {time:'12:00', food:'番茄炒蛋', amount:'半碗', note:'爱吃'} ],
      },
      { date: '2026-07-08', mood: '😄', height: 94.8, weight: 13.9, tags: ['阅读','画画'], activities: '上午读了绘本《好饿的毛毛虫》，下午画了一幅画送给妈妈。', breakfast: '牛奶 + 全麦面包', lunch: '杂粮饭 + 红烧肉 + 蒸蛋', dinner: '馄饨', snacks: '香蕉', sleepHours: 11, milestones: '会主动说「我爱你」了！', notes: '画画时特别专注。',
        milkFeeds: [ {time:'07:00', type:'配方奶', amount:'150ml', note:''}, {time:'14:00', type:'配方奶', amount:'120ml', note:''}, {time:'20:30', type:'配方奶', amount:'180ml', note:''} ],
        diaperChanges: [ {time:'08:00', type:'小便', consistency:'', color:'', note:''}, {time:'14:30', type:'大便', consistency:'偏干', color:'棕色', note:'有点费力'} ],
        solidFoods: [],
      },
      { date: '2026-07-15', mood: '😌', height: 95.0, weight: 14.0, tags: ['阅读','搭积木'], activities: '在家安静地看了很久的书，还自己搭了积木城堡。', breakfast: '鸡蛋饼 + 豆浆', lunch: '米饭 + 清蒸鱼 + 西兰花', dinner: '番茄意面', snacks: '饼干 + 葡萄', sleepHours: 10, milestones: '', notes: '有点轻微咳嗽，多喝了水。',
        milkFeeds: [ {time:'06:00', type:'配方奶', amount:'180ml', note:''}, {time:'21:00', type:'配方奶', amount:'180ml', note:''} ],
        diaperChanges: [ {time:'09:00', type:'大小便', consistency:'正常', color:'黄色', note:''}, {time:'17:00', type:'小便', consistency:'', color:'', note:''} ],
        solidFoods: [ {time:'12:30', food:'清蒸鱼', amount:'少许', note:'第一次吃鱼，没有过敏'}, {time:'15:00', food:'葡萄', amount:'5颗', note:''} ],
      },
      { date: '2026-07-22', mood: '😄', height: 95.3, weight: 14.1, tags: ['游泳','骑车'], activities: '下午去了游泳馆，第一次不怕水了！还骑了平衡车。', breakfast: '燕麦粥 + 水煮蛋', lunch: '米饭 + 土豆炖牛肉 + 菠菜', dinner: '蔬菜粥', snacks: '酸奶', sleepHours: 10.5, milestones: '可以在水里憋气3秒了', notes: '游泳后食欲很好。',
        milkFeeds: [ {time:'07:30', type:'配方奶', amount:'150ml', note:''}, {time:'13:00', type:'配方奶', amount:'150ml', note:''}, {time:'20:00', type:'配方奶', amount:'200ml', note:'运动量大多喝了点'} ],
        diaperChanges: [ {time:'08:30', type:'小便', consistency:'', color:'', note:''}, {time:'12:00', type:'小便', consistency:'', color:'', note:''}, {time:'18:00', type:'大便', consistency:'正常', color:'黄色', note:''} ],
        solidFoods: [],
      },
      { date: '2026-08-01', mood: '🤔', height: 95.6, weight: 14.0, tags: ['看动画片','搭积木'], activities: '看了一会儿《小猪佩奇》，然后搭了很高很高的积木塔。', breakfast: '牛奶 + 鸡蛋三明治', lunch: '蛋炒饭 + 玉米排骨汤', dinner: '饺子', snacks: '苹果', sleepHours: 9.5, milestones: '能数到20了', notes: '活动量大，体重稍微降了一点。',
        milkFeeds: [ {time:'06:30', type:'配方奶', amount:'150ml', note:''}, {time:'20:30', type:'配方奶', amount:'180ml', note:''} ],
        diaperChanges: [ {time:'10:00', type:'大便', consistency:'偏稀', color:'绿色', note:'可能消化不太好'} ],
        solidFoods: [ {time:'11:30', food:'饺子', amount:'3个', note:'很爱吃'}, {time:'16:00', food:'苹果泥', amount:'半碗', note:''} ],
      },
      { date: '2026-08-10', mood: '😊', height: 96.0, weight: 14.3, tags: ['唱歌跳舞'], activities: '今天在家唱了好几首歌，还自己跳了舞。', breakfast: '红豆粥 + 花卷', lunch: '米饭 + 糖醋排骨 + 炒时蔬', dinner: '鸡汤面', snacks: '西瓜 + 饼干', sleepHours: 11, milestones: '会唱完整的《两只老虎》了', notes: '表现欲很强的一天。',
        milkFeeds: [ {time:'07:00', type:'配方奶', amount:'150ml', note:''}, {time:'15:00', type:'配方奶', amount:'150ml', note:''}, {time:'20:00', type:'配方奶', amount:'180ml', note:''} ],
        diaperChanges: [],
        solidFoods: [],
      },
      { date: '2026-08-18', mood: '😴', height: 96.2, weight: 14.4, tags: ['上学'], activities: '今天第一次上幼儿园半日体验，有点害羞但没哭。', breakfast: '牛奶 + 面包', lunch: '幼儿园午餐', dinner: '蔬菜炒饭', snacks: '老师发了小饼干', sleepHours: 12, milestones: '第一天上幼儿园！', notes: '回来后特别困，提前睡了。',
        milkFeeds: [ {time:'06:00', type:'配方奶', amount:'180ml', note:'早起喝奶'}, {time:'20:00', type:'配方奶', amount:'200ml', note:'睡前奶'} ],
        diaperChanges: [ {time:'07:30', type:'大小便', consistency:'正常', color:'黄色', note:''} ],
        solidFoods: [],
      },
      { date: '2026-08-25', mood: '😊', height: 96.5, weight: 14.6, tags: ['走亲访友','唱歌跳舞'], activities: '去外婆家玩了一整天，唱歌跳舞，开心极了。', breakfast: '红豆粥 + 花卷', lunch: '米饭 + 糖醋排骨 + 炒时蔬', dinner: '鸡汤面', snacks: '西瓜 + 饼干', sleepHours: 11, milestones: '会说完整句子了', notes: '外婆给好多零食，开心得不得了。',
        milkFeeds: [ {time:'07:00', type:'配方奶', amount:'150ml', note:''}, {time:'13:00', type:'配方奶', amount:'150ml', note:''}, {time:'16:00', type:'配方奶', amount:'120ml', note:''}, {time:'20:30', type:'配方奶', amount:'180ml', note:''} ],
        diaperChanges: [ {time:'08:00', type:'小便', consistency:'', color:'', note:''}, {time:'11:30', type:'大小便', consistency:'正常', color:'棕色', note:''}, {time:'17:00', type:'小便', consistency:'', color:'', note:''} ],
        solidFoods: [ {time:'12:00', food:'糖醋排骨', amount:'两块', note:'外婆做的，爱吃'}, {time:'15:00', food:'西瓜', amount:'一大块', note:''} ],
      },
    ];
      for (const r of demo) {
        try { await Store.addRecord(r); } catch (err) { /* 离线则入队列，忽略 */ }
      }
      this.toast(`已添加 ${demo.length} 条示例记录`, 'success');
      this.switchTab('timeline');
    } catch (err) {
      this.toast('添加示例数据失败（后端不可达）：' + err.message, 'error');
    }
  },

  /* ================================================================
   *  照片预览
   * ================================================================ */
  viewPhoto(recordId, index) {
    const record = Store.getRecord(recordId);
    if (!record || !record.photos || !record.photos[index]) return;
    const src = record.photos[index];
    this._showModal(`
      <div class="modal-body" style="padding: 0; text-align: center;">
        <img src="${src}" alt="照片预览" style="max-width: 100%; border-radius: 12px;" />
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">关闭</button>
      </div>
    `, 'image-modal');
  },

  /* ================================================================
   *  弹窗 / 确认框
   * ================================================================ */
  _showModal(bodyHtml, extraClass = '') {
    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal-overlay ${extraClass}" onclick="if(event.target===this)App.closeModal()">
        <div class="modal-box">
          ${bodyHtml}
        </div>
      </div>
    `;
  },

  showConfirm(title, message, onConfirm) {
    this._showModal(`
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="modal-close" onclick="App.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-muted); font-size: 14px; line-height: 1.7;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn btn-primary" id="modalConfirmBtn">确定</button>
      </div>
    `);
    document.getElementById('modalConfirmBtn').onclick = () => {
      this.closeModal();
      if (onConfirm) onConfirm();
    };
  },

  closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
  },

  /* ================================================================
   *  Toast 通知
   * ================================================================ */
  toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || '✅'}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 300);
    }, 3000);
  },

  /* ================================================================
   *  工具方法
   * ================================================================ */
  _updateNavChild(child) {
    const el = document.getElementById('navChildName');
    if (!el) return;
    if (child && child.name) {
      el.textContent = `${child.avatar || '👶'} ${child.name}`;
    } else {
      el.textContent = '还未设置宝贝信息';
    }
  },

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
