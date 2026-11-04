/* ============================================================
 * 在线考试页逻辑（与 PC 端在线考试业务一致）
 * 规则：
 *   - 80 题 = 40 单选 + 20 判断 + 20 多选；满分 100，合格线 60
 *   - 60 分钟倒计时；剩余 5 分钟红色警告；时间到自动交卷
 *   - 多选漏选 / 错选均不得分
 *   - 不合格扣减剩余考试机会（每场考试共 2 次）
 *   - 考试页禁止复制 / 选择 / 右键
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  var examId = new URLSearchParams(location.search).get('examId') || '';

  /* ---------------- 组卷（前端模拟题库，与 PC 端一致） ---------------- */
  var questions = API.buildExamQuestions();
  var TOTAL = questions.length;

  /* ---------------- 答题状态 ---------------- */
  var answers = {};          // qid -> [已选下标]
  var marked = {};           // qid -> true（标记集合）
  var curIdx = 0;
  var remain = 60 * 60;      // 倒计时秒数（60 分钟）
  var timeTimer = null;
  var submitted = false;

  function isAnswered(qid) {
    var a = answers[qid];
    return Array.isArray(a) && a.length > 0;
  }

  /* ---------------- 准入校验：课程学时完成 + 剩余机会 ---------------- */
  API.getExams().then(function (list) {
    var exam = list.filter(function (e) { return e.id === examId; })[0];
    if (!exam) { Util.toast('考试记录不存在'); goBack(); return; }

    $('#nav-title').textContent = exam.name;
    $('#meta-name').textContent = exam.name;

    if (exam.status === 'pass') {
      Util.toast('该场考试已合格，无需再次参加');
      goBack(); return;
    }
    if (!exam.courseDone) {
      Util.toast('课程学时未完成21学时，暂不可考试');
      goBack(); return;
    }
    if (exam.retries <= 0) {
      Util.toast('重考次数已用尽，请重新报名缴费学习后参加考试');
      goBack(); return;
    }

    renderQuestion();
    startTimer();
  }).catch(function (err) { Util.toast(err.message); goBack(); });

  function goBack() {
    setTimeout(function () { location.href = '我的考试.html'; }, 1200);
  }

  /* ---------------- 题目渲染 ---------------- */
  function renderQuestion() {
    var q = questions[curIdx];
    var typeTag = { single: '单选题', multiple: '多选题', judge: '判断题' }[q.type];
    $('#q-title').innerHTML =
      '<span class="q-type-tag ' + q.type + '">' + typeTag + '</span>' +
      (curIdx + 1) + '. ' + Util.escapeHtml(q.title);

    var selected = answers[q.id] || [];
    var isMulti = q.type === 'multiple';
    var labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    $('#q-options').innerHTML = q.options.map(function (opt, i) {
      return '<div class="option' + (selected.indexOf(i) >= 0 ? ' selected' : '') +
        (isMulti ? ' multiple' : '') + '" data-opt="' + i + '">' +
        '<span class="opt-label">' + labels[i] + '</span><span>' + Util.escapeHtml(opt) + '</span></div>';
    }).join('');

    var mb = $('#mark-btn');
    mb.className = 'mark-btn' + (marked[q.id] ? ' active' : '');
    mb.textContent = marked[q.id] ? '🚩 已标记' : '🚩 标记本题';

    $('#cur-num').textContent = curIdx + 1;
    $('#q-total').textContent = TOTAL;
    var prev = $('#btn-prev');
    prev.disabled = curIdx === 0;
    prev.style.opacity = curIdx === 0 ? 0.5 : 1;
    $('#btn-next').textContent = curIdx === TOTAL - 1 ? '交卷' : '下一题';

    renderGrid();
  }

  /* 选项点击：单选/判断直接替换；多选切换勾选 */
  $('#q-options').addEventListener('click', function (e) {
    var opt = e.target.closest('[data-opt]');
    if (!opt) return;
    var q = questions[curIdx];
    var i = parseInt(opt.dataset.opt, 10);
    var cur = answers[q.id] || [];

    if (q.type === 'multiple') {
      var idx = cur.indexOf(i);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(i);
      answers[q.id] = cur;
    } else {
      answers[q.id] = [i];
    }
    renderQuestion();
  });

  /* 标记本题 */
  $('#mark-btn').addEventListener('click', function () {
    var qid = questions[curIdx].id;
    if (marked[qid]) delete marked[qid]; else marked[qid] = true;
    renderQuestion();
  });

  /* 上一题 / 下一题（末题变交卷） */
  $('#btn-prev').addEventListener('click', function () {
    if (curIdx > 0) { curIdx--; renderQuestion(); }
  });
  $('#btn-next').addEventListener('click', function () {
    if (curIdx < TOTAL - 1) { curIdx++; renderQuestion(); }
    else openSubmitConfirm();
  });

  /* ---------------- 答题卡 ---------------- */
  function renderGrid() {
    var answered = questions.filter(function (q) { return isAnswered(q.id); }).length;
    $('#answered-count').textContent = answered;

    $('#q-grid').innerHTML = questions.map(function (q, i) {
      var cls = 'q-num';
      if (i === curIdx) cls += ' current';
      if (marked[q.id]) cls += ' marked';
      else if (isAnswered(q.id)) cls += ' answered';
      return '<div class="' + cls + '" data-q="' + i + '">' + (i + 1) + '</div>';
    }).join('');
  }

  $('#btn-grid').addEventListener('click', function () { Util.openSheet('sheet-grid'); });
  $('#q-grid').addEventListener('click', function (e) {
    var n = e.target.closest('[data-q]');
    if (!n) return;
    curIdx = parseInt(n.dataset.q, 10);
    renderQuestion();
    Util.closeSheet('sheet-grid');
  });

  /* ---------------- 交卷 ---------------- */
  function openSubmitConfirm() {
    var unanswered = questions.filter(function (q) { return !isAnswered(q.id); }).length;
    $('#unanswered-num').textContent = unanswered;
    document.querySelector('#dialog-submit').classList.add('show');
  }

  $('#btn-submit-grid').addEventListener('click', function () {
    Util.closeSheet('sheet-grid');
    openSubmitConfirm();
  });

  $('#btn-submit-ok').addEventListener('click', function () {
    document.querySelector('#dialog-submit').classList.remove('show');
    doSubmit();
  });

  function doSubmit() {
    if (submitted) return;
    submitted = true;
    if (timeTimer) { clearInterval(timeTimer); timeTimer = null; }

    API.submitExam({
      examId: examId,
      timeUsedSec: 60 * 60 - remain,
      answers: answers
    }).then(renderResult).catch(function (err) {
      submitted = false;
      Util.toast(err.message || '交卷失败，请重试');
    });
  }

  /* ---------------- 倒计时（60 分钟；剩 5 分钟警告；到点自动交卷） ---------------- */
  function startTimer() {
    var el = $('#timer');
    timeTimer = setInterval(function () {
      remain--;
      var m = Math.floor(remain / 60), s = remain % 60;
      el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
      if (remain <= 5 * 60) el.classList.add('warning');   // 剩余 5 分钟警告
      if (remain <= 0) {
        if (timeTimer) { clearInterval(timeTimer); timeTimer = null; }
        // 时间到：弹窗提示并自动交卷
        document.querySelector('#dialog-timeout').classList.add('show');
        setTimeout(doSubmit, 1200);
      }
    }, 1000);
  }

  /* ---------------- 结果视图 ---------------- */
  function renderResult(r) {
    $('#exam-main').classList.add('hide');
    $('#result-main').classList.remove('hide');

    var scoreEl = $('#r-score');
    scoreEl.textContent = r.score;
    scoreEl.className = 'score-num ' + (r.passed ? 'pass' : 'fail');

    var tag = $('#r-tag');
    tag.textContent = r.passed ? '合格' : '不合格';
    tag.className = 'result-tag ' + (r.passed ? 'pass' : 'fail');

    $('#r-correct').textContent = r.correct;
    $('#r-wrong').textContent = r.wrong;
    $('#r-time').textContent = r.timeUsed;
    $('#r-tip').textContent = r.passed
      ? '恭喜您通过本次考试，成绩已记入「我的考试」，可在详情中查看答卷情况。'
      : '很遗憾未达到合格线（60 分），本次已消耗 1 次考试机会，剩余机会可在「我的考试」中查看。';

    window.scrollTo({ top: 0 });
  }

  /* ---------------- 防复制：右键 / 复制 / 选取 ---------------- */
  ['contextmenu', 'copy', 'cut', 'selectstart', 'dragstart'].forEach(function (evt) {
    document.addEventListener(evt, function (e) { e.preventDefault(); });
  });

  /* ---------------- 弹层关闭 ---------------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelector('#' + btn.dataset.close).classList.remove('show');
    });
  });
  Util.bindMask('sheet-grid');
})();
