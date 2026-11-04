/* ============================================================
 * 我的考试页逻辑
 * 功能：考试列表、状态筛选、考试准入校验（课程学时）、
 *       考试成绩与答卷详情、剩余考试机会展示
 * 规则与 PC 端一致：
 *   - 学时达标（课程完成）后方可进入考试
 *   - 每场考试 2 次机会，80 题，60 分钟，满分 100 / 合格线 60
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  var exams = [];
  var filterStatus = '';
  var currentExamId = null;

  var STATUS = {
    wait: { cls: 'tag-wait', text: '待考试' },
    pass: { cls: 'tag-pass', text: '合格' },
    fail: { cls: 'tag-fail', text: '不合格' }
  };

  /* ---------------- 资质校验 ---------------- */
  function checkQualification() {
    return API.getArchives().then(function (list) {
      var hasApproved = list.some(function (a) { return a.status === 'approved'; });
      var hasPending = list.some(function (a) { return a.status === 'pending'; });

      if (hasApproved) return true;

      $('#exam-content').classList.add('hide');
      $('#qual-tip').classList.remove('hide');
      if (hasPending) {
        $('#qual-tip-title').textContent = '报名信息审核中';
        $('#qual-tip-text').textContent = '您的报名信息正在审核，审核通过后方可参加考试。';
      } else {
        $('#qual-tip-title').textContent = '尚未提交报名';
        $('#qual-tip-text').textContent = '请先在「报名信息」中提交报名并通过审核。';
      }
      return false;
    });
  }

  /* ---------------- 考试列表 ---------------- */
  function detailButton(e) {
    return e.details && e.details.length
      ? '<button class="btn btn-ghost btn-sm" data-detail="' + e.id + '">查看详情</button>'
      : '';
  }

  function render() {
    var list = exams.filter(function (e) {
      return !filterStatus || e.status === filterStatus;
    });
    var box = $('#exam-list');

    if (!list.length) {
      box.innerHTML = '<div class="empty-card"><span class="ico">📝</span>暂无符合条件的考试记录</div>';
      return;
    }

    box.innerHTML = list.map(function (e) {
      var st = STATUS[e.status];
      var scoreCls = e.score == null ? '' : (e.score >= 60 ? 'pass' : 'fail');
      var scoreText = e.score == null ? '—' : e.score + ' 分';
      var courseText = e.courseDone ? '已完成' : '未完成';
      var courseCls = e.courseDone ? '' : 'muted';

      var actions;
      if (e.status === 'pass') {
        actions = '<div class="card-actions">' + detailButton(e) + '</div>' +
          '<div class="exam-tip">该场考试已合格，无需再次参加</div>';
      } else if (e.retries <= 0) {
        actions = '<div class="card-actions">' + detailButton(e) + '</div>' +
          '<div class="exam-tip danger">重考次数已用尽，请重新报名缴费学习后参加考试或联系管理员</div>';
      } else {
        actions = '<div class="card-actions">' + detailButton(e) +
          '<button class="btn btn-primary btn-sm" ' + (e.courseDone ? '' : 'disabled') +
          ' data-enter="' + e.id + '">进入考试</button></div>' +
          (e.courseDone ? '' : '<div class="exam-tip">课程学时未完成21学时，暂不可考试</div>');
      }

      return '<section class="card exam-card">' +
        '<div class="card-head">' +
          '<div class="card-title">' + Util.escapeHtml(e.name) + '</div>' +
          '<span class="tag ' + st.cls + '">' + st.text + '</span>' +
        '</div>' +
        '<div class="kv"><span class="k">考试工种</span><span class="v">' + Util.escapeHtml(e.workType) + '</span></div>' +
        '<div class="exam-stats">' +
          '<div class="stat"><b class="' + scoreCls + '">' + scoreText + '</b><span>考试分数</span></div>' +
          '<div class="stat"><b>' + e.retries + ' 次</b><span>剩余考试机会</span></div>' +
          '<div class="stat"><b class="' + courseCls + '">' + courseText + '</b><span>课程学时</span></div>' +
        '</div>' +
        actions +
      '</section>';
    }).join('');
  }

  function loadExams() {
    return API.getExams().then(function (list) {
      exams = list;
      render();
    }).catch(function (err) { Util.toast(err.message); });
  }

  /* ---------------- 进入考试确认 ---------------- */
  function openConfirm(id) {
    var e = exams.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    currentExamId = id;
    $('#confirm-name').textContent = e.name;
    Util.openSheet('sheet-confirm');
  }

  $('#btn-enter-exam').addEventListener('click', function () {
    if (!currentExamId) return;
    // 进入移动端在线答题页（80 题 / 60 分钟倒计时）
    location.href = '在线考试.html?examId=' + encodeURIComponent(currentExamId);
  });

  /* ---------------- 答卷详情 ---------------- */
  function openDetail(id) {
    API.getExamDetail(id).then(function (e) {
      if (!e.details) { Util.toast('暂无答卷详情'); return; }
      var pass = e.score >= 60;
      var correct = e.details.filter(function (d) { return d.ok; }).length;
      var wrong = e.details.length - correct;

      var summary = '<div class="exam-summary">' +
        '<div class="item"><div class="val ' + (pass ? 'pass' : 'fail') + '">' + e.score + ' 分</div><div class="lbl">总分 100 · 合格线 60</div></div>' +
        '<div class="item"><div class="val ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '合格' : '不合格') + '</div><div class="lbl">考试结果</div></div>' +
        '<div class="item"><div class="val">' + (e.timeUsed || '—') + '</div><div class="lbl">用时</div></div>' +
        '<div class="item"><div class="val" style="color:#389e0d;">' + correct + '</div><div class="lbl">答对</div></div>' +
        '<div class="item"><div class="val" style="color:#cf1322;">' + wrong + '</div><div class="lbl">答错</div></div>' +
        '</div>' +
        '<div class="detail-title">答卷详情（共 ' + e.details.length + ' 题）</div>';

      var questions = e.details.map(function (d, i) {
        return '<div class="q-item ' + (d.ok ? 'correct' : 'wrong') + '">' +
          '<div class="q-stem">' + (d.ok ? '✓' : '✗') + ' 第 ' + (i + 1) + ' 题 · ' +
            Util.escapeHtml(d.q) + '</div>' +
          '<div class="q-row"><span class="label">正确答案：</span>' + Util.escapeHtml(d.a) + '</div>' +
          '<div class="q-row"><span class="label">您的答案：</span><span class="' + (d.ok ? 'ok' : 'no') + '">' +
            Util.escapeHtml(d.ua) + (d.ok ? '（正确）' : '（错误）') + '</span></div>' +
        '</div>';
      }).join('');

      $('#detail-body').innerHTML = summary + questions;
      Util.openSheet('sheet-detail');
    }).catch(function (err) { Util.toast(err.message); });
  }

  /* ---------------- 事件 ---------------- */
  $('#exam-list').addEventListener('click', function (e) {
    var enter = e.target.closest('[data-enter]');
    var detail = e.target.closest('[data-detail]');
    if (enter) openConfirm(enter.dataset.enter);
    else if (detail) openDetail(detail.dataset.detail);
  });

  $('#exam-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-status]');
    if (!chip) return;
    filterStatus = chip.dataset.status;
    $$('#exam-chips .chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    render();
  });

  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { Util.closeSheet(btn.dataset.close); });
  });
  Util.bindMask('sheet-confirm');
  Util.bindMask('sheet-detail');
  $('#btn-logout').addEventListener('click', Util.logout);

  /* ---------------- 初始化 ---------------- */
  checkQualification().then(function (ok) {
    if (ok) loadExams();
  }).catch(function (err) { Util.toast(err.message); });
})();
