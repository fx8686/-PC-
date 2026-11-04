/* ============================================================
 * 个人报名信息页逻辑
 * 功能：基本信息展示、报名档案列表、新增/编辑报名、
 *       证明材料上传（压缩）、提交审核、删除档案
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  // 档案状态配置（班级样式复用公共标签）
  var STATUS = {
    draft:    { cls: 'tag-default',  text: '未提交' },
    pending:  { cls: 'tag-pending',  text: '已提交待审核' },
    approved: { cls: 'tag-pass',     text: '审核通过' },
    rejected: { cls: 'tag-rejected', text: '审核驳回' }
  };

  var archives = [];        // 当前档案列表
  var pendingDeleteId = null;

  /* ---------------- 共用材料读写（sessionStorage） ---------------- */
  var SHARED_KEY = 'signup_shared_materials_v1';
  function getShared() {
    try { return JSON.parse(sessionStorage.getItem(SHARED_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveShared(obj) {
    sessionStorage.setItem(SHARED_KEY, JSON.stringify(obj));
  }
  function sharedOk() {
    var s = getShared();
    return !!(s.idFront && s.idBack && s.healthReport);
  }

  /* ---------------- 顶部用户信息 ---------------- */
  function renderUser(u) {
    $('#user-avatar').textContent = (u.name || '学').charAt(0);
    $('#user-name').textContent = u.name || '—';
    $('#user-idcard').textContent = '证件号：' + Util.maskIdCard(u.idCard);
    $('#user-phone').textContent = '手机号：' + Util.maskPhone(u.phone);
  }

  function updateUserStatus() {
    var el = $('#user-status');
    if (el) el.style.display = 'none';
  }

  /* ---------------- 档案列表 ---------------- */
  function cnNum(n) {
    var arr = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
    return n <= 10 ? arr[n] : n;
  }

  function renderList() {
    var box = $('#archive-list');
    if (!archives.length) {
      box.innerHTML = '<div class="empty-card"><span class="ico">📭</span>' +
        '暂无报名档案，点击右上角「新增报名」开始报名</div>';
      return;
    }

    box.innerHTML = archives.map(function (arc, idx) {
      var st = STATUS[arc.status] || STATUS.draft;
      var locked = arc.status === 'pending' || arc.status === 'approved';
      var headAction = !locked
        ? '<button class="link-btn danger" data-del="' + arc.id + '">删除</button>'
        : '';

      var actions;
      if (arc.status === 'draft' || arc.status === 'rejected') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + arc.id + '">编辑</button>' +
          '<button class="btn btn-primary btn-sm" data-submit="' + arc.id + '">提交审核</button>' +
          '</div>';
      } else if (arc.status === 'pending') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" data-approve="' + arc.id + '">模拟审核通过（演示）</button>' +
          '</div>';
      } else {
        actions = '<div class="archive-lock-tip">该报名已审核通过，如需修改请联系管理员。</div>';
      }

      return '<section class="card archive-card">' +
        '<div class="card-head">' +
          '<div class="card-title">报名学习' + cnNum(idx + 1) +
            '<span class="tag ' + st.cls + '">' + st.text + '</span>' +
          '</div>' + headAction +
        '</div>' +
        '<div class="kv"><span class="k">报名工种</span><span class="v strong">' + Util.escapeHtml(arc.workType || '—') + '</span></div>' +
        '<div class="kv"><span class="k">证书编号</span><span class="v">' + Util.escapeHtml(arc.certNo || '—') + '</span></div>' +
        '<div class="kv"><span class="k">证书有效期</span><span class="v">' +
          (arc.validFrom && arc.validTo ? arc.validFrom + ' 至 ' + arc.validTo : '—') + '</span></div>' +
        '<div class="kv"><span class="k">提交时间</span><span class="v">' + Util.escapeHtml(arc.createdAt || '—') + '</span></div>' +
        actions +
        '</section>';
    }).join('');
  }

  function loadArchives() {
    return API.getArchives().then(function (list) {
      archives = list;
      renderList();
      renderSharedTiles();
      renderBatchBar();
      updateUserStatus();
    }).catch(function (err) {
      Util.toast(err.message);
    });
  }

  /* ---------------- 多工种表单：内存状态 ---------------- */
  var sheetRows = []; // [{ workType, certNo, validFrom, validTo, certImg }]

  /* ---------------- 多工种表单：打开 ---------------- */
  function openForm(existingId) {
    if (existingId) {
      var arc = archives.filter(function (a) { return a.id === existingId; })[0];
      if (!arc) return;
      sheetRows = [{
        workType: arc.workType || '',
        certNo: arc.certNo || '',
        validFrom: arc.validFrom || '',
        validTo: arc.validTo || '',
        certImg: arc.certImg || ''
      }];
    } else {
      sheetRows = [{ workType: '', certNo: '', validFrom: '', validTo: '', certImg: '' }];
    }
    renderSheet();
    Util.openSheet('sheet-archive');
  }

  /* ---------------- 多工种表单：渲染整个弹层 ---------------- */
  function renderSheet() {
    renderSharedTip();
    renderRowList();
    renderFootStat();
  }

  function renderSharedTip() {
    var s = getShared();
    var cnt = (s.idFront ? 1 : 0) + (s.idBack ? 1 : 0) + (s.healthReport ? 1 : 0);
    var box = $('#sheet-shared-tip');
    box.className = 'sheet-shared-tip ' + (cnt === 3 ? 'st-ok' : 'st-wait');
    if (cnt === 3) {
      box.innerHTML = '<span class="st-icon">✅</span>共用材料已齐全（身份证正/反面、体检报告），将自动同步到每个报名工种档案中';
    } else {
      box.innerHTML = '<span class="st-icon">⚠️</span>共用材料尚未齐全（' + cnt + '/3），请先在页面顶部上传区完成身份证正/反面、体检报告的上传';
    }
  }

  function renderRowList() {
    var tpl = $('#wt-row-tpl');
    var list = $('#wt-list');
    list.innerHTML = '';
    sheetRows.forEach(function (row, idx) {
      var node = tpl.content.firstElementChild.cloneNode(true);
      // 编号 & 标题
      var nums = ['一','二','三','四','五','六','七','八','九','十'];
      node.querySelector('.wt-row-num').textContent = (idx + 1);
      node.querySelector('.wt-row-title').textContent = '报名工种' + (idx < 10 ? nums[idx] : (idx + 1));
      if (sheetRows.length <= 1) node.querySelector('.wt-row-del').style.display = 'none';
      else node.querySelector('.wt-row-del').style.display = 'flex';

      // 工种下拉（写入选项）
      var sel = node.querySelector('.wt-workType');
      MOCK.WORK_TYPES.forEach(function (w) {
        var opt = document.createElement('option'); opt.value = w; opt.textContent = w;
        if (row.workType === w) opt.selected = true;
        sel.appendChild(opt);
      });

      // 回填值
      node.querySelector('.wt-certNo').value = row.certNo || '';
      node.querySelector('.wt-validFrom').value = row.validFrom || '';
      node.querySelector('.wt-validTo').value = row.validTo || '';

      // certImg 上传格回填
      var img = node.querySelector('.upload-tile img');
      var del = node.querySelector('.upload-tile .tile-del');
      var tile = node.querySelector('.upload-tile');
      if (row.certImg) {
        img.src = row.certImg; img.classList.remove('hide');
        del.classList.remove('hide'); tile.classList.add('has-img');
      } else {
        img.removeAttribute('src'); img.classList.add('hide');
        del.classList.add('hide'); tile.classList.remove('has-img');
      }

      list.appendChild(node);
    });
  }

  function renderFootStat() {
    var b = $('#foot-stat');
    if (!b) return;
    b.innerHTML = '共 <b>' + sheetRows.length + '</b> 个工种';
  }

  /* ---------------- 多工种表单：增/删 ---------------- */
  function addRow() {
    if (sheetRows.length >= 10) { Util.toast('单次报名最多添加 10 个工种'); return; }
    sheetRows.push({ workType: '', certNo: '', validFrom: '', validTo: '', certImg: '' });
    renderRowList();
    renderFootStat();
  }
  function removeRow(idx) {
    if (sheetRows.length <= 1) { Util.toast('至少保留 1 个报名工种'); return; }
    sheetRows.splice(idx, 1);
    renderRowList();
    renderFootStat();
  }

  /* ---------------- 多工种表单：收集 ---------------- */
  function collectRowFromNode(rowEl) {
    return {
      workType: rowEl.querySelector('.wt-workType').value,
      certNo: rowEl.querySelector('.wt-certNo').value.trim(),
      validFrom: rowEl.querySelector('.wt-validFrom').value,
      validTo: rowEl.querySelector('.wt-validTo').value,
      certImg: rowEl.querySelector('.upload-tile img:not(.hide)')
        ? (sheetRows[getRowIdx(rowEl)] || {}).certImg || ''
        : (sheetRows[getRowIdx(rowEl)] || {}).certImg || ''
    };
  }
  function getRowIdx(rowEl) {
    var all = $$('#wt-list .wt-row');
    return all.indexOf(rowEl);
  }

  /* ---------------- 多工种表单：校验（行内红字提示） ---------------- */
  function clearRowErrs() {
    $$('#wt-list .wt-field').forEach(function (f) { f.classList.remove('error'); });
    $$('#wt-list .wt-field .wt-err').forEach(function (e) { e.textContent = ''; });
  }

  function validateAllRows() {
    clearRowErrs();
    var ok = true;
    var firstErrRow = -1;
    var rows = $$('#wt-list .wt-row');
    rows.forEach(function (rowEl, idx) {
      var r = collectRowFromNode(rowEl);
      var rowOk = true;
      var fields = {}; // key: 字段类型 → DOM

      if (!r.workType) { setRowErr(rowEl, 'wt-workType', '请选择工种'); rowOk = false; }
      if (!r.certNo) { setRowErr(rowEl, 'wt-certNo', '请输入证书编号'); rowOk = false; }
      if (!r.validFrom || !r.validTo) {
        setRowErr(rowEl, 'wt-validTo', '请选择证书生效时间与到期时间'); rowOk = false;
      } else if (r.validFrom >= r.validTo) {
        setRowErr(rowEl, 'wt-validTo', '证书到期时间需晚于生效时间'); rowOk = false;
      }
      if (!r.certImg) { setRowErr(rowEl, 'wt-field-upload', '请上传证书照片'); rowOk = false; }

      if (!rowOk && firstErrRow === -1) firstErrRow = idx;
      if (!rowOk) ok = false;
    });
    return { ok: ok, firstErrRow: firstErrRow };
  }

  function setRowErr(rowEl, fieldSelector, msg) {
    var f = rowEl.querySelector('.' + fieldSelector);
    if (!f) return;
    f.classList.add('error');
    var errEl = f.querySelector('.wt-err');
    if (errEl) errEl.textContent = msg;
  }

  /* ---------------- 多工种表单：保存全部草稿 ---------------- */
  function saveAllDrafts() {
    var rows = $$('#wt-list .wt-row');
    var shared = getShared();
    var btn = $('#btn-draft');
    btn.disabled = true;

    // 逐个保存
    var chain = Promise.resolve();
    rows.forEach(function (rowEl) {
      var r = collectRowFromNode(rowEl);
      var data = {
        workType: r.workType, certNo: r.certNo,
        validFrom: r.validFrom, validTo: r.validTo,
        learnType: '继续教育学员',
        idFront: shared.idFront || '', idBack: shared.idBack || '', healthReport: shared.healthReport || '',
        certImg: r.certImg,
        status: 'draft'
      };
      chain = chain.then(function () { return API.saveArchive(data); });
    });

    chain.then(function () {
      btn.disabled = false;
      Util.closeSheet('sheet-archive');
      Util.toast('已保存 ' + rows.length + ' 个报名工种为草稿');
      return loadArchives();
    }).catch(function (err) {
      btn.disabled = false;
      Util.toast(err.message);
    });
  }

  /* ---------------- 多工种表单：提交全部 ---------------- */
  function submitAllInSheet() {
    var shared = getShared();
    if (!sharedOk()) {
      Util.toast('请先在页面顶部完成身份证正/反面、体检报告三项共用材料的上传');
      return;
    }
    var { ok, firstErrRow } = validateAllRows();
    if (!ok) {
      Util.toast('有报名工种填写不完整，请修正标红项后再提交');
      // 滚动到第一个错误行
      if (firstErrRow >= 0) {
        var rows = $$('#wt-list .wt-row');
        var rect = rows[firstErrRow].getBoundingClientRect();
        var body = $('#sheet-archive .sheet-body');
        body.scrollTop = rows[firstErrRow].offsetTop - body.offsetTop - 10;
      }
      return;
    }

    var rows = $$('#wt-list .wt-row');
    var btn = $('#btn-submit');
    btn.disabled = true; btn.textContent = '批量提交中...';

    var okCount = 0;
    var failNames = [];
    var idx = 0;

    function next() {
      if (idx >= rows.length) finish();
      else {
        var r = collectRowFromNode(rows[idx]);
        var data = {
          workType: r.workType, certNo: r.certNo,
          validFrom: r.validFrom, validTo: r.validTo,
          learnType: '继续教育学员',
          idFront: shared.idFront, idBack: shared.idBack, healthReport: shared.healthReport,
          certImg: r.certImg
        };
        API.saveArchive(data).then(function (saved) {
          return API.submitArchive(saved.id);
        }).then(function () {
          okCount++; idx++; next();
        }).catch(function (err) {
          failNames.push(r.workType || '未命名工种');
          idx++; next();
        });
      }
    }

    function finish() {
      btn.disabled = false; btn.textContent = '提交全部报名';
      Util.closeSheet('sheet-archive');
      loadArchives().then(function () {
        if (okCount > 0 && !failNames.length) {
          $('#batch-result-title').textContent = '批量提交成功';
          $('#batch-result-text').innerHTML =
            '您的 <b>' + okCount + '</b> 个工种报名已批量提交。<br>' +
            '共用证件材料已同步应用到所有报名档案。<br>' +
            '请等待系统审核，审核通过后可在「缴费订单」中缴费并开始学习。';
        } else {
          $('#batch-result-title').textContent = '批量提交完成';
          $('#batch-result-text').innerHTML =
            '成功 <b>' + okCount + '</b> 个，失败 <b>' + failNames.length + '</b> 个：<br>' +
            failNames.map(function (n) { return '· ' + n; }).join('<br>');
        }
        Util.openSheet('dialog-batch-result');
      });
    }

    next();
  }

  // 列表中直接提交审核（草稿/驳回状态）
  function submitDirect(id) {
    var arc = archives.filter(function (a) { return a.id === id; })[0];
    if (!arc) return;
    if (!sharedOk()) {
      Util.toast('共用材料不完整，请先在页面顶部上传身份证正/反面、体检报告');
      return;
    }
    if (!arc.workType) { Util.toast('请先编辑并选择工种'); return; }
    if (!arc.certNo) { Util.toast('请先编辑并填写证书编号'); return; }
    if (!arc.validFrom || !arc.validTo || arc.validFrom >= arc.validTo) {
      Util.toast('请先编辑并填写正确的证书有效期'); return;
    }
    if (!arc.certImg) { Util.toast('请先编辑并上传证书照片'); return; }

    var shared = getShared();
    var data = {
      id: id,
      workType: arc.workType, certNo: arc.certNo,
      validFrom: arc.validFrom, validTo: arc.validTo,
      learnType: '继续教育学员',
      idFront: shared.idFront || arc.idFront || '',
      idBack: shared.idBack || arc.idBack || '',
      healthReport: shared.healthReport || arc.healthReport || '',
      certImg: arc.certImg
    };
    API.saveArchive(data).then(function () {
      return API.submitArchive(id);
    }).then(function () {
      Util.openSheet('dialog-submit');
      return loadArchives();
    }).catch(function (err) { Util.toast(err.message); });
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#archive-list').addEventListener('click', function (e) {
    var t = e.target;
    var editBtn = t.closest('[data-edit]');
    var submitBtn = t.closest('[data-submit]');
    var delBtn = t.closest('[data-del]');
    var approveBtn = t.closest('[data-approve]');

    if (editBtn) openForm(editBtn.dataset.edit);
    else if (submitBtn) submitDirect(submitBtn.dataset.submit);
    else if (delBtn) {
      pendingDeleteId = delBtn.dataset.del;
      Util.openSheet('dialog-delete');
    } else if (approveBtn) {
      API.mockApproveArchive(approveBtn.dataset.approve).then(function () {
        Util.toast('（演示）审核已通过，可前往缴费并学习');
        return loadArchives();
      });
    }
  });

  $('#btn-confirm-delete').addEventListener('click', function () {
    if (!pendingDeleteId) return;
    API.deleteArchive(pendingDeleteId).then(function () {
      pendingDeleteId = null;
      Util.closeSheet('dialog-delete');
      Util.toast('档案已删除');
      return loadArchives();
    }).catch(function (err) { Util.toast(err.message); });
  });

  $('#btn-add').addEventListener('click', function () { openForm(); });
  $('#btn-draft').addEventListener('click', saveAllDrafts);
  $('#btn-submit').addEventListener('click', submitAllInSheet);
  $('#wt-add-btn').addEventListener('click', addRow);

  /* ---------------- 多工种弹层：事件委托（动态生成的行） ---------------- */
  $('#wt-list').addEventListener('click', function (e) {
    // 行删除按钮
    var delBtn = e.target.closest('.wt-row-del');
    if (delBtn) {
      var rowEl = delBtn.closest('.wt-row');
      var idx = getRowIdx(rowEl);
      removeRow(idx);
      return;
    }
    // certImg 删除按钮
    var tileDel = e.target.closest('.tile-del');
    if (tileDel) {
      e.preventDefault(); e.stopPropagation();
      var rowEl2 = tileDel.closest('.wt-row');
      var idx2 = getRowIdx(rowEl2);
      sheetRows[idx2].certImg = '';
      renderRowList();
      return;
    }
  });

  $('#wt-list').addEventListener('change', function (e) {
    // certImg 上传
    var input = e.target.closest('.upload-tile input[type="file"]');
    if (input) {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { Util.toast('图片大小不能超过 5MB'); input.value = ''; return; }
      if (!/^image\//.test(file.type)) { Util.toast('仅支持图片格式'); input.value = ''; return; }
      var rowEl = input.closest('.wt-row');
      var idx = getRowIdx(rowEl);
      Util.compressImage(file, 800, 0.6).then(function (dataUrl) {
        sheetRows[idx].certImg = dataUrl;
        renderRowList();
      }).catch(function () { Util.toast('图片读取失败，请重试'); });
      input.value = '';
      return;
    }
    // 工种选择变更时清除该行校验错误
    if (e.target.classList.contains('wt-workType')) {
      var rowEl3 = e.target.closest('.wt-row');
      rowEl3.querySelector('.wt-field-select').classList.remove('error');
      rowEl3.querySelector('.wt-field-select .wt-err').textContent = '';
    }
  });

  // 下载体检表模板（演示）
  $('#btn-template').addEventListener('click', function () {
    Util.toast('体检表模板下载中...（演示）');
  });

  /* ---------------- 页面顶部：共用材料上传 ---------------- */
  $$('.upload-tile.shared input[type="file"]').forEach(function (input) {
    input.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { Util.toast('图片大小不能超过 5MB'); e.target.value = ''; return; }
      if (!/^image\//.test(file.type)) { Util.toast('仅支持图片格式'); e.target.value = ''; return; }
      var key = input.closest('.upload-tile').dataset.key;
      Util.compressImage(file, 800, 0.6).then(function (dataUrl) {
        var s = getShared();
        s[key] = dataUrl;
        saveShared(s);
        renderSharedTiles();
        Util.toast('共用材料已上传');
      }).catch(function () { Util.toast('图片读取失败，请重试'); });
      e.target.value = '';
    });
  });

  $$('.upload-tile.shared .tile-del').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var s = getShared();
      s[btn.dataset.del] = '';
      saveShared(s);
      renderSharedTiles();
    });
  });

  // 共用材料渲染（页面顶部三个上传框）
  function renderSharedTiles() {
    var s = getShared();
    $$('.upload-tile.shared').forEach(function (tile) {
      var key = tile.dataset.key;
      var img = tile.querySelector('img');
      var del = tile.querySelector('.tile-del');
      var src = s[key];
      if (src) {
        img.src = src; img.classList.remove('hide');
        del.classList.remove('hide'); tile.classList.add('has-img');
      } else {
        img.removeAttribute('src'); img.classList.add('hide');
        del.classList.add('hide'); tile.classList.remove('has-img');
      }
    });
    var cnt = (s.idFront ? 1 : 0) + (s.idBack ? 1 : 0) + (s.healthReport ? 1 : 0);
    var el = $('#shared-count');
    if (el) el.textContent = cnt;
    // 如果悬浮批量栏存在，也同步刷新
    if (typeof renderBatchBar === 'function') renderBatchBar();
  }

  /* ---------------- 弹层 & 退出 ---------------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { Util.closeSheet(btn.dataset.close); });
  });
  Util.bindMask('sheet-archive');
  Util.bindMask('dialog-delete');
  Util.bindMask('dialog-submit');
  Util.bindMask('sheet-batch-confirm');
  Util.bindMask('dialog-batch-result');

  $('#btn-logout').addEventListener('click', Util.logout);

  /* ---------------- 底部悬浮批量栏 ---------------- */
  $('#btn-batch-reset').addEventListener('click', resetAllDrafts);
  $('#btn-batch-submit').addEventListener('click', openBatchConfirm);
  $('#btn-batch-confirm').addEventListener('click', batchSubmit);

  function renderBatchBar() {
    var drafts = archives.filter(function (a) { return a.status === 'draft'; });
    var bar = $('#batch-bar');
    if (!bar) return;
    if (drafts.length === 0) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    var s = getShared();
    var cnt = (s.idFront ? 1 : 0) + (s.idBack ? 1 : 0) + (s.healthReport ? 1 : 0);
    $('#bar-draft-num').textContent = drafts.length;
    $('#bar-shared-num').textContent = cnt;
    var hint = $('#bar-shared-hint');
    var submitBtn = $('#btn-batch-submit');
    if (cnt === 3) {
      hint.textContent = '可批量提交'; hint.className = 'ok';
      submitBtn.disabled = false;
    } else {
      hint.textContent = '共用材料未齐全'; hint.className = 'bad';
      submitBtn.disabled = true;
    }
  }

  function openBatchConfirm() {
    var drafts = archives.filter(function (a) { return a.status === 'draft'; });
    if (!drafts.length) return;
    if (!sharedOk()) { Util.toast('请先完成共用材料三项上传'); return; }

    var batchList = $('#batch-list');
    batchList.innerHTML = drafts.map(function (arc, idx) {
      var issues = [];
      if (!arc.workType) issues.push('未选择工种');
      if (!arc.certNo) issues.push('证书编号未填');
      if (!arc.validFrom || !arc.validTo || arc.validFrom >= arc.validTo) issues.push('证书有效期错误');
      if (!arc.certImg) issues.push('证书照片未上传');
      var numCls = issues.length ? 'bi-err-mark' : 'bi-num';
      return '<div class="batch-item">' +
        '<div class="' + numCls + '">' + (issues.length ? '!' : (idx + 1)) + '</div>' +
        '<div class="bi-info">' +
          '<div class="bi-name">' + Util.escapeHtml(arc.workType || '未选择工种') + '</div>' +
          '<div class="bi-sub">证书号 ' + Util.escapeHtml(arc.certNo || '未填') +
            ' · ' + (arc.validFrom && arc.validTo ? arc.validFrom + ' 至 ' + arc.validTo : '有效期未填') + '</div>' +
          (issues.length ? '<div class="bi-err-hint">⚠ ' + issues.join(' / ') + '</div>' : '') +
        '</div></div>';
    }).join('');
    $('#batch-count').textContent = drafts.length;

    var hasIssue = drafts.some(function (a) {
      return !a.workType || !a.certNo || !a.validFrom || !a.validTo || !a.certImg ||
        (a.validFrom && a.validTo && a.validFrom >= a.validTo);
    });
    var shared = getShared();
    var cnt = (shared.idFront ? 1 : 0) + (shared.idBack ? 1 : 0) + (shared.healthReport ? 1 : 0);
    $('#batch-shared-box').innerHTML =
      '<div class="st-row"><span class="st-icon">' + (cnt === 3 ? '✅' : '⚠️') + '</span>' +
      '<span class="st-label">共用材料状态</span>' +
      '<span class="st-val ' + (cnt === 3 ? 'ready' : 'wait') + '">' + cnt + ' / 3 已上传</span></div>';

    var confirmBtn = $('#btn-batch-confirm');
    confirmBtn.disabled = hasIssue;
    confirmBtn.textContent = hasIssue ? '请先修正标红项' : '确认批量提交';
    Util.openSheet('sheet-batch-confirm');
  }

  function batchSubmit() {
    var drafts = archives.filter(function (a) { return a.status === 'draft'; });
    if (!drafts.length) { Util.closeSheet('sheet-batch-confirm'); return; }
    if (!sharedOk()) { Util.toast('共用材料不完整'); return; }

    var shared = getShared();
    var btn = $('#btn-batch-confirm');
    btn.disabled = true; btn.textContent = '批量提交中...';
    var okCount = 0, failNames = [], idx = 0;

    function next() {
      if (idx >= drafts.length) finish();
      else {
        var arc = archives.filter(function (a) { return a.id === drafts[idx].id; })[0];
        var data = {
          id: arc.id, workType: arc.workType, certNo: arc.certNo,
          validFrom: arc.validFrom, validTo: arc.validTo,
          learnType: '继续教育学员',
          idFront: shared.idFront || arc.idFront || '',
          idBack: shared.idBack || arc.idBack || '',
          healthReport: shared.healthReport || arc.healthReport || '',
          certImg: arc.certImg
        };
        API.saveArchive(data).then(function (saved) { return API.submitArchive(saved.id); })
          .then(function () { okCount++; idx++; next(); })
          .catch(function (e) { failNames.push(arc.workType || '未命名'); idx++; next(); });
      }
    }
    function finish() {
      Util.closeSheet('sheet-batch-confirm');
      btn.disabled = false; btn.textContent = '确认批量提交';
      loadArchives().then(function () {
        $('#batch-result-title').textContent = okCount > 0 && !failNames.length ? '批量提交成功' : '批量提交完成';
        $('#batch-result-text').innerHTML =
          '成功 <b>' + okCount + '</b> 个' + (failNames.length ? '，失败 <b>' + failNames.length + '</b> 个' : '') +
          (failNames.length ? '：<br>' + failNames.map(function (n) { return '· ' + n; }).join('<br>') :
          '<br>共用证件材料已同步应用到所有报名档案。');
        Util.openSheet('dialog-batch-result');
      });
    }
    next();
  }

  function resetAllDrafts() {
    var drafts = archives.filter(function (a) { return a.status === 'draft'; });
    if (!drafts.length) return;
    if (!confirm('确定清空全部 ' + drafts.length + ' 个未提交的报名草稿吗？此操作不可恢复。')) return;
    archives = archives.filter(function (a) { return a.status !== 'draft'; });
    Util.set('archives', archives);
    renderList();
    renderBatchBar();
    Util.toast('已清空所有报名草稿');
  }

  /* ---------------- 初始化 ---------------- */
  API.getProfile().then(renderUser).catch(function (err) { Util.toast(err.message); });
  loadArchives();
})();
