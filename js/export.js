/**
 * Export.js — 导出功能
 * 支持 PDF / CSV / JSON 三种格式导出
 */

const Exporter = {
  /**
   * 导出 PDF — 通过浏览器打印生成精美报告（完美支持中文）
   */
  exportPDF(child, records) {
    if (!records || records.length === 0) {
      App.toast('没有记录可以导出', 'warning');
      return;
    }

    const childName = child ? child.name : '宝贝';
    const childAvatar = child ? (child.avatar || '👶') : '👶';
    const exportDate = new Date().toLocaleDateString('zh-CN');

    let body = '';

    records.forEach((r, idx) => {
      const date = new Date(r.date);
      const weekday = ['日','一','二','三','四','五','六'][date.getDay()];

      body += `<div class="print-record">`;
      body += `<div class="print-record-header">`;
      body += `<div class="print-date">${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 星期${weekday}</div>`;
      if (r.mood) body += `<div class="print-mood">心情 ${r.mood}</div>`;
      body += `</div>`;

      body += `<div class="print-record-body">`;

      // 身高体重
      if (r.height || r.weight) {
        body += `<div class="print-stats">`;
        if (r.height) body += `<span class="print-stat">📏 身高 ${r.height} cm</span>`;
        if (r.weight) body += `<span class="print-stat">⚖️ 体重 ${r.weight} kg</span>`;
        body += `</div>`;
      }

      // 表格行
      const rows = [];
      if (r.tags && r.tags.length) rows.push(['活动标签', r.tags.join('、')]);
      if (r.activities) rows.push(['今日活动', r.activities]);
      if (r.breakfast) rows.push(['🌅 早餐', r.breakfast]);
      if (r.lunch) rows.push(['☀️ 午餐', r.lunch]);
      if (r.dinner) rows.push(['🌙 晚餐', r.dinner]);
      if (r.snacks) rows.push(['🍪 点心', r.snacks]);
      if (r.milkFeeds && r.milkFeeds.length) rows.push(['🍼 喝奶', r.milkFeeds.map(m => `${m.time || ''} ${m.type || ''} ${this._formatMl(m.amount)}${m.note ? '(' + m.note + ')' : ''}`).join('；')]);
      if (r.diaperChanges && r.diaperChanges.length) rows.push(['🚽 排泄', r.diaperChanges.map(d => `${d.time || ''} ${d.type || ''}${d.consistency ? ' ' + d.consistency : ''}${d.color ? ' ' + d.color : ''}${d.note ? '(' + d.note + ')' : ''}`).join('；')]);
      if (r.solidFoods && r.solidFoods.length) rows.push(['🥣 辅食', r.solidFoods.map(s => `${s.time || ''} ${s.food || ''} ${s.amount || ''}${s.note ? '(' + s.note + ')' : ''}`).join('；')]);
      if (r.sleepHours) rows.push(['😴 睡眠', r.sleepHours + ' 小时']);
      if (r.milestones) rows.push(['⭐ 里程碑', r.milestones]);
      if (r.notes) rows.push(['📝 备注', r.notes]);

      if (rows.length) {
        body += `<table class="print-table"><tbody>`;
        rows.forEach(([label, content]) => {
          body += `<tr><td class="print-label">${label}</td><td>${content}</td></tr>`;
        });
        body += `</tbody></table>`;
      }

      // 照片
      if (r.photos && r.photos.length) {
        body += `<div class="print-photos">`;
        r.photos.forEach(p => { body += `<img src="${p}" class="print-photo" />`; });
        body += `</div>`;
      }

      body += `</div></div>`;
    });

    // 计算年龄
    let ageText = '';
    if (child && child.birthday) {
      const birth = new Date(child.birthday);
      const now = new Date();
      const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      ageText = months >= 12 ? `${Math.floor(months/12)}岁${months%12 ? months%12+'个月' : ''}` : `${months}个月`;
    }

    const genderText = child ? { girl: '女孩', boy: '男孩', other: '' }[child.gender] || '' : '';

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>童心日记 — ${childName}的成长报告</title>
<style>
  @page { margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif;
    color: #2D3436; font-size: 13px; line-height: 1.7; background: #fff;
  }
  .print-cover { text-align: center; padding: 30px 0 20px; border-bottom: 3px solid #FF6B9D; margin-bottom: 20px; }
  .print-cover h1 { font-size: 26px; color: #E84C7E; margin-bottom: 8px; }
  .print-cover .info { color: #636E72; font-size: 13px; }
  .print-cover .avatar { font-size: 40px; }
  .print-record { margin-bottom: 16px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
  .print-record-header { display: flex; justify-content: space-between; align-items: center; background: #FFF0F5; padding: 8px 14px; border-bottom: 1px solid #FFE0E9; }
  .print-date { font-weight: 700; color: #2D3436; font-size: 14px; }
  .print-mood { font-size: 14px; }
  .print-record-body { padding: 12px 14px; }
  .print-stats { display: flex; gap: 12px; margin-bottom: 10px; }
  .print-stat { background: #F0FAF0; color: #4A9A50; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .print-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .print-table td { padding: 5px 8px; border: 1px solid #f0f0f0; vertical-align: top; }
  .print-label { width: 90px; font-weight: 700; color: #E84C7E; background: #FFF8FA; white-space: nowrap; }
  .print-photos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .print-photo { width: 100px; height: 100px; object-fit: cover; border-radius: 6px; border: 1px solid #eee; }
  .print-footer { text-align: center; color: #B2BEC3; font-size: 11px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="print-cover">
    <div class="avatar">${childAvatar}</div>
    <h1>童心日记 — 成长报告</h1>
    <div class="info">
      ${childName}${genderText ? ' · ' + genderText : ''}${ageText ? ' · ' + ageText : ''}<br>
      导出日期：${exportDate} &nbsp;|&nbsp; 共 ${records.length} 条记录
    </div>
  </div>
  ${body}
  <div class="print-footer">童心日记 · 用爱记录成长的每一天 💝</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      App.toast('请允许弹出窗口以导出 PDF', 'warning');
      return;
    }
    win.document.write(html);
    win.document.close();
    App.toast('PDF 报告已打开，请在打印对话框选择「另存为 PDF」', 'info');
  },

  /**
   * 导出 CSV — 适合表格软件打开
   */
  exportCSV(child, records) {
    if (!records || records.length === 0) {
      App.toast('没有记录可以导出', 'warning');
      return;
    }

    const headers = [
      '日期', '心情', '身高(cm)', '体重(kg)',
      '今日活动', '早餐', '午餐', '晚餐', '点心',
      '喝奶记录', '排泄记录', '辅食记录',
      '睡眠时长(小时)', '成长里程碑', '备注', '照片数量'
    ];

    const rows = records.map(r => [
      r.date,
      r.mood || '',
      r.height || '',
      r.weight || '',
      this._csvEscape(r.activities || ''),
      this._csvEscape(r.breakfast || ''),
      this._csvEscape(r.lunch || ''),
      this._csvEscape(r.dinner || ''),
      this._csvEscape(r.snacks || ''),
      this._formatCareCSV((r.milkFeeds || []).map(m => ({ ...m, amount: this._formatMl(m.amount) })), ['time', 'type', 'amount', 'note']),
      this._formatCareCSV(r.diaperChanges, ['time', 'type', 'consistency', 'color', 'note']),
      this._formatCareCSV(r.solidFoods, ['time', 'food', 'amount', 'note']),
      r.sleepHours || '',
      this._csvEscape(r.milestones || ''),
      this._csvEscape(r.notes || ''),
      (r.photos || []).length,
    ]);

    // 添加 BOM 头确保 Excel 正确识别 UTF-8
    const bom = '\uFEFF';
    const csv = bom + [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    this._download(csv, `童心日记_${child ? child.name : '宝贝'}_${this._formatDateShort(new Date().toISOString())}.csv`, 'text/csv;charset=utf-8');
    App.toast('CSV 导出成功！', 'success');
  },

  /**
   * 导出 JSON — 完整数据备份
   */
  exportJSON(data) {
    const json = JSON.stringify(data, null, 2);
    const childName = data.child ? data.child.name : '宝贝';
    this._download(
      json,
      `童心日记_备份_${childName}_${this._formatDateShort(new Date().toISOString())}.json`,
      'application/json;charset=utf-8'
    );
    App.toast('JSON 备份导出成功！', 'success');
  },

  /* ===== 工具方法 ===== */
  _csvEscape(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '""').replace(/\n/g, ' ');
  },

  /** 用量格式化：纯数字自动补 ml 单位，已含单位则原样返回 */
  _formatMl(v) {
    if (!v) return '';
    const s = String(v).trim();
    return /ml|毫升/i.test(s) ? s : `${s}ml`;
  },

  /** 将护理记录数组格式化为 CSV 单元格文本 */
  _formatCareCSV(entries, fields) {
    if (!entries || !entries.length) return '';
    return entries.map(e =>
      fields.map(f => e[f] || '').filter(v => v).join(' ')
    ).join('；');
  },

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${['日','一','二','三','四','五','六'][d.getDay()]}`;
  },

  _formatDateShort(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  },

  _download(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
