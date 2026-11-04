/* ============================================================
 * 我的课程页逻辑
 * 功能：报名档案状态与学时、课程进度、课程学习（演示）、
 *       学时达标提醒、安全生产教育培训证书预览
 * 业务规则与 PC 端保持一致：
 *   - 21 学时达标；24 小时内最多累计 7 学时
 *   - 仅「审核通过 + 已缴费」可开始学习
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  var STATUS = {
    pending:         { cls: 'tag-pending',  text: '待审核' },
    approved_unpaid: { cls: 'tag-info',     text: '审核通过待缴费' },
    paid:            { cls: 'tag-done',     text: '已缴费可学习' },
    hours_done:      { cls: 'tag-reached',  text: '学时已完成' },
    rejected:        { cls: 'tag-rejected', text: '审核驳回' }
  };

  var archives = [];
  var hoursMap = {};        // archiveId -> 学时数据
  var courses = [];
  var currentWork = '';     // 课程筛选工种
  var currentCourse = null; // 当前学习的课程
  var currentCertId = null; // 当前证书对应的档案 id
  var currentArchiveId = ''; // 当前开始学习的档案 id（用于播放页计学时）

  /* ---------------- 工具 ---------------- */
  function hoursInLast24h(h) {
    var now = Date.now();
    return (h.dailyRecords || [])
      .filter(function (r) { return now - r.ts < 24 * 60 * 60 * 1000; })
      .reduce(function (s, r) { return s + r.hours; }, 0);
  }

  function stateOf(a) {
    if (a.status === 'rejected') return 'rejected';
    if (a.status === 'approved') {
      if (!a.paid) return 'approved_unpaid';
      var h = hoursMap[a.id] || { hoursReached: false };
      return h.hoursReached ? 'hours_done' : 'paid';
    }
    return 'pending';
  }

  /* ---------------- 报名档案渲染 ---------------- */
  function renderArchives() {
    var box = $('#archive-list');
    if (!archives.length) {
      box.innerHTML = '<div class="empty-card"><span class="ico">📭</span>' +
        '暂无报名档案，请先前往「报名信息」提交报名</div>';
      return;
    }

    box.innerHTML = archives.map(function (a) {
      var state = stateOf(a);
      var st = STATUS[state];
      var h = hoursMap[a.id] || { totalHours: 0, dailyRecords: [], hoursReached: false };
      var total = MOCK.TARGET_HOURS;
      var pct = Math.min(100, Math.round(h.totalHours / total * 100));
      var numCls = h.hoursReached ? 'ok' : (h.totalHours >= 18 ? 'warn' : '');

      var hoursHtml = a.status === 'approved'
        ? '<div class="hours-line">' +
            '<div class="num"><span>累计学时</span><span><b class="' + numCls + '">' +
              h.totalHours.toFixed(1) + '</b> / ' + total + ' 学时</span></div>' +
            '<div class="progress"><div class="progress-bar ' + (h.hoursReached ? 'done' : '') +
              '" style="width:' + pct + '%"></div></div>' +
            '<div class="num" style="margin:6px 0 0;"><span>24 小时内累计</span><span>' +
              hoursInLast24h(h).toFixed(1) + ' 学时（上限 ' + MOCK.DAILY_CAP_HOURS + ' 学时）</span></div>' +
          '</div>'
        : '';

      var actions;
      var tip = '';
      if (state === 'approved_unpaid') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-primary btn-sm" data-pay="' + a.id + '">立即缴费</button>' +
          '<button class="btn btn-ghost btn-sm" disabled>开始学习</button>' +
          '</div>';
      } else if (state === 'paid') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-primary btn-sm" data-learn="' + a.id + '">开始学习</button>' +
          '</div>';
      } else if (state === 'hours_done') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" data-cert="' + a.id + '">查看证书</button>' +
          '<button class="btn btn-primary btn-sm" data-exam="1">去考试</button>' +
          '</div>';
      } else if (state === 'rejected') {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" disabled>立即缴费</button>' +
          '<button class="btn btn-ghost btn-sm" disabled>开始学习</button>' +
          '</div>';
        tip = '<div class="action-tip">报名审核未通过，请前往「报名信息」修改后重新提交</div>';
      } else {
        actions = '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" disabled>立即缴费</button>' +
          '<button class="btn btn-ghost btn-sm" disabled>开始学习</button>' +
          '</div>';
        tip = '<div class="action-tip">报名信息待审核，审核通过并完成缴费后即可学习</div>';
      }

      return '<section class="card archive-card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + Util.escapeHtml(a.workType || '—') +
            '<span class="tag ' + st.cls + '">' + st.text + '</span></div>' +
        '</div>' +
        '<div class="kv"><span class="k">证书编号</span><span class="v">' + Util.escapeHtml(a.certNo || '—') + '</span></div>' +
        '<div class="kv"><span class="k">报名时间</span><span class="v">' + Util.escapeHtml(a.createdAt || '—') + '</span></div>' +
        hoursHtml + actions + tip +
        '</section>';
    }).join('');
  }

  /* ---------------- 课程列表 ---------------- */
  function renderCourseChips() {
    var types = [];
    MOCK.COURSES.forEach(function (c) {
      if (types.indexOf(c.workType) < 0) types.push(c.workType);
    });
    var html = '<button class="chip' + (currentWork ? '' : ' active') + '" data-work="">全部工种</button>';
    html += types.map(function (t) {
      return '<button class="chip' + (currentWork === t ? ' active' : '') + '" data-work="' + t + '">' + t + '</button>';
    }).join('');
    $('#course-chips').innerHTML = html;
  }

  function renderCourses() {
    var box = $('#course-list');
    if (!courses.length) {
      box.innerHTML = '<div class="empty-card"><span class="ico">📚</span>暂无符合条件的课程</div>';
      return;
    }

    var ST = {
      notstart: { cls: 'tag-default', text: '未开始' },
      learning: { cls: 'tag-info',    text: '学习中' },
      done:     { cls: 'tag-done',    text: '已完成' }
    };

    box.innerHTML = courses.map(function (c) {
      var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
      var st = ST[c.status];
      return '<div class="course-card">' +
        '<div class="c-head">' +
          '<span class="c-name">' + Util.escapeHtml(c.name) + '</span>' +
          '<span class="tag ' + st.cls + '">' + st.text + '</span>' +
        '</div>' +
        '<div class="c-meta">' + Util.escapeHtml(c.workType) + ' · 已学 ' + c.done + ' / ' + c.total + ' 课时</div>' +
        '<div class="c-foot">' +
          '<div class="progress"><div class="progress-bar ' + (c.status === 'done' ? 'done' : '') +
            '" style="width:' + pct + '%"></div></div>' +
          '<span class="c-pct">' + pct + '%</span>' +
        '</div>' +
        '<div class="card-actions"><button class="btn btn-primary btn-sm" data-course="' + c.id + '">去学习</button></div>' +
      '</div>';
    }).join('');
  }

  function loadCourses() {
    return API.getCourses(currentWork).then(function (list) {
      courses = list;
      renderCourses();
    });
  }

  function loadAll() {
    return API.getArchives().then(function (list) {
      archives = list;
      return Promise.all(archives.map(function (a) { return API.getStudyHours(a.id); }));
    }).then(function (hoursList) {
      hoursMap = {};
      archives.forEach(function (a, i) { hoursMap[a.id] = hoursList[i]; });
      renderArchives();
      return loadCourses();
    }).then(checkHoursDone).catch(function (err) {
      Util.toast(err.message);
    });
  }

  /* ---------------- 学时达标提醒（每个档案仅提醒一次） ---------------- */
  function checkHoursDone() {
    var shown = Util.get('h5_hours_done_shown', []);
    var target = archives.filter(function (a) {
      var h = hoursMap[a.id] || {};
      return a.status === 'approved' && a.paid && h.hoursReached && shown.indexOf(a.id) < 0;
    })[0];
    if (!target) return;

    shown.push(target.id);
    Util.set('h5_hours_done_shown', shown);
    currentCertId = target.id;
    $('#hours-done-text').innerHTML = '您报名的「<b>' + Util.escapeHtml(target.workType) +
      '</b>」累计学时已达标（≥ 21 学时）。<br>系统已生成安全生产教育培训证书，请前往参加考试。';
    setTimeout(function () { Util.openSheet('dialog-hours-done'); }, 320);
  }

  /* ---------------- 课程学习 ---------------- */
  /* 选定计学时的报名档案：优先「开始学习」所选档案，否则取首个已缴费档案（学时按档案独立计算） */
  function resolveArchiveId() {
    var candidates = archives.filter(function (a) {
      return a.status === 'approved' && a.paid;
    });
    var cur = candidates.filter(function (a) { return a.id === currentArchiveId; })[0];
    return cur ? cur.id : (candidates[0] ? candidates[0].id : '');
  }

  function openCourse(id) {
    var c = courses.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    currentCourse = id;
    updateCourseSheet(c);
    Util.openSheet('sheet-course');
  }

  function updateCourseSheet(c) {
    var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    $('#cd-name').textContent = c.name;
    $('#cd-meta').textContent = c.workType + ' · ' + (c.status === 'done' ? '已完成学习' : '学习进行中');
    $('#cd-bar').style.width = pct + '%';
    $('#cd-bar').className = 'progress-bar' + (c.status === 'done' ? ' done' : '');
    $('#cd-done').textContent = '已学 ' + c.done + ' 课时';
    $('#cd-total').textContent = '共 ' + c.total + ' 课时';
  }

  // 进入课程播放页：正常观看累计学时（60 秒 = 1 学时，演示压缩）
  $('#btn-learn-one').addEventListener('click', function () {
    if (!currentCourse) return;
    var aid = resolveArchiveId();
    if (!aid) { Util.toast('请先完成报名缴费后开始学习'); return; }
    location.href = '课程播放.html?courseId=' + encodeURIComponent(currentCourse) +
      '&archiveId=' + encodeURIComponent(aid);
  });

  /* ---------------- 证书预览 ---------------- */
  function openCert(archiveId) {
    currentCertId = archiveId;
    API.getCertificate(archiveId).then(function (c) {
      $('#cert-body').innerHTML =
        '<div class="safety-cert">' +
          '<div class="safety-cert-title">安全生产教育培训证书</div>' +
          '<div class="safety-cert-sub">CERTIFICATE OF SAFETY PRODUCTION TRAINING & EDUCATION</div>' +
          '<div class="safety-cert-body">' +
            '<div><span class="label">证书编号：</span><span class="val cert-no">' + c.certCode + '</span></div>' +
            '<div><span class="label">学员姓名：</span><span class="val">' + Util.escapeHtml(c.userName) + '</span></div>' +
            '<div><span class="label">性别：</span><span class="val">' + c.gender + '</span></div>' +
            '<div><span class="label">证件号码：</span><span class="val">' + c.idCardMasked + '</span></div>' +
            '<div><span class="label">作业工种：</span><span class="val">' + Util.escapeHtml(c.workType) + '</span></div>' +
            '<div><span class="label">学时完成：</span><span class="val">累计完成 ' + c.totalHours + ' 学时</span></div>' +
            '<div><span class="label">发证日期：</span><span class="val">' + c.finishDate + '</span></div>' +
            '<div style="margin-top:12px;font-size:12px;color:#595959;line-height:1.8;">' +
              '该学员已完成规定的安全生产教育培训并达到 21 学时要求，特此发证。' +
            '</div>' +
          '</div>' +
        '</div>';
      Util.openSheet('sheet-cert');
    }).catch(function (err) { Util.toast(err.message); });
  }

  $('#btn-download-cert').addEventListener('click', function () {
    if (!currentCertId) return;
    Util.toast('证书 PDF 下载中...（演示）');
    setTimeout(function () { Util.toast('证书已保存（演示）'); }, 1000);
  });

  /* ---------------- 事件 ---------------- */
  $('#archive-list').addEventListener('click', function (e) {
    var pay = e.target.closest('[data-pay]');
    var learn = e.target.closest('[data-learn]');
    var cert = e.target.closest('[data-cert]');
    var exam = e.target.closest('[data-exam]');

    if (pay) {
      location.href = '缴费订单.html?pay=' + encodeURIComponent(pay.dataset.pay);
    } else if (learn) {
      var a = archives.filter(function (x) { return x.id === learn.dataset.learn; })[0];
      if (a) currentArchiveId = a.id;   // 记住本次学习的档案，播放页按档案计学时
      currentWork = a ? a.workType : '';
      renderCourseChips();
      loadCourses();
      // 滚动到课程进度区域（留出固定导航高度）
      var sec = $('#section-courses');
      var y = sec.getBoundingClientRect().top + window.pageYOffset - 60;
      window.scrollTo({ top: y, behavior: 'smooth' });
      Util.toast('请在下方课程中选择「去学习」');
    } else if (cert) {
      openCert(cert.dataset.cert);
    } else if (exam) {
      location.href = '我的考试.html';
    }
  });

  $('#course-list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-course]');
    if (btn) openCourse(btn.dataset.course);
  });

  $('#course-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-work]');
    if (!chip) return;
    currentWork = chip.dataset.work;
    $$('#course-chips .chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    loadCourses();
  });

  // 学时达标弹窗按钮
  $('#btn-cert-from-dialog').addEventListener('click', function () {
    Util.closeSheet('dialog-hours-done');
    if (currentCertId) openCert(currentCertId);
  });
  $('#btn-exam-from-dialog').addEventListener('click', function () {
    location.href = '我的考试.html';
  });

  /* ---------------- 弹层 & 退出 ---------------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { Util.closeSheet(btn.dataset.close); });
  });
  Util.bindMask('sheet-course');
  Util.bindMask('sheet-cert');
  Util.bindMask('dialog-hours-done');
  $('#btn-logout').addEventListener('click', Util.logout);

  /* ---------------- 初始化 ---------------- */
  renderCourseChips();
  loadAll();
})();
