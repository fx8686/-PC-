/* ============================================================
 * 课程播放页逻辑（与 PC 端课程播放页业务一致）
 * 规则：
 *   - 正常观看每 60 秒 = 1 学时（演示压缩，真实为 60 分钟 = 1 学时）
 *   - 禁止快进 / 拖拽进度条 / 倍速调整
 *   - 同一章节仅计一次学时；24 小时内上限 7 学时
 *   - 累计达标 21 学时 → 弹出达标提醒，解锁考试与证书
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  /* ---------------- URL 参数 ---------------- */
  var qs = new URLSearchParams(location.search);
  var courseId = qs.get('courseId') || 'c2';
  var archiveId = qs.get('archiveId') || '';

  /* 演示参数：每 60 秒计 1 学时（真实业务为 3600 秒） */
  var SECONDS_PER_HOUR = 60;

  /* ---------------- 状态 ---------------- */
  var course = null;        // 当前课程 { id, name, total, workType }
  var chapters = [];        // 章节数组（含 counted 是否已计学时）
  var chapterState = [];    // 章节学习进度 [{ learnedSec, done }]
  var curIdx = 0;
  var playing = false;
  var playTimer = null;
  var study = { totalHours: 0, hoursReached: false, h24: 0 };

  function formatDur(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------------- 初始化加载 ---------------- */
  API.getCoursePlay(courseId, archiveId).then(function (res) {
    course = res.course;
    chapters = res.chapters;
    study = res.study;

    $('#nav-title').textContent = course.name;
    document.title = course.name + ' - 特殊工种延期教育系统';

    // 章节状态：已计学时的章节直接视为已完成；首个未完成章节为当前章节
    chapterState = chapters.map(function (ch) {
      return ch.counted ? { learnedSec: ch.hours * SECONDS_PER_HOUR, done: true }
                        : { learnedSec: 0, done: false };
    });
    var firstUndone = chapterState.findIndex(function (st) { return !st.done; });
    curIdx = firstUndone < 0 ? 0 : firstUndone;

    renderChapters();
    updateInfo();
  }).catch(function (err) {
    Util.toast(err.message);
    setTimeout(function () { location.href = '我的课程.html'; }, 1200);
  });

  /* ---------------- 章节列表渲染 ---------------- */
  function renderChapters() {
    $('#chapter-list').innerHTML = chapters.map(function (ch, i) {
      var st = chapterState[i];
      var locked = i > 0 && !chapterState[i - 1].done; // 顺序学习：上一章完成才解锁
      var statusCls, statusText;
      if (st.done) { statusCls = 'done'; statusText = '✓ 已完成'; }
      else if (locked) { statusCls = 'locked'; statusText = '🔒 未解锁'; }
      else { statusCls = 'learning'; statusText = i === curIdx ? '学习中' : '可学习'; }

      return '<div class="chapter-item' + (i === curIdx ? ' active' : '') + (locked ? ' disabled' : '') +
        '" data-ch="' + i + '">' +
          '<div>' +
            '<div class="ch-name">' + Util.escapeHtml(ch.name) + '</div>' +
            '<div class="ch-meta">时长：' + ch.hours + ' 学时' +
              '<span class="hl' + (ch.counted ? ' ok' : '') + '">' +
                (ch.counted ? '✓ 已计入学时' : '未计学时') + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="ch-status ' + statusCls + '">' + statusText + '</span>' +
        '</div>';
    }).join('');
    $('#cur-chapter').textContent = chapters[curIdx] ? chapters[curIdx].name : '—';
  }

  /* 章节切换（锁定章节不可进入） */
  $('#chapter-list').addEventListener('click', function (e) {
    var item = e.target.closest('[data-ch]');
    if (!item) return;
    var i = parseInt(item.dataset.ch, 10);
    if (i > 0 && !chapterState[i - 1].done) {
      Util.toast('请先完成上一章节学习');
      return;
    }
    pause();
    curIdx = i;
    renderChapters();
    updateInfo();
  });

  /* ---------------- 信息刷新（进度条 + 学时状态） ---------------- */
  function updateInfo() {
    var ch = chapters[curIdx];
    if (!ch) return;
    var st = chapterState[curIdx];
    var learned = Math.min(st.learnedSec, ch.hours * SECONDS_PER_HOUR);

    $('#progress-fill').style.width =
      Math.round(learned / (ch.hours * SECONDS_PER_HOUR) * 100) + '%';
    $('#time-text').textContent = formatDur(learned) + ' / 约 ' + formatDur(ch.hours * SECONDS_PER_HOUR);

    // 顶部与状态条学时
    $('#hb-total').textContent = study.totalHours.toFixed(1);
    $('#bar-total').textContent = study.totalHours.toFixed(1);
    var h24b = $('#bar-24h');
    h24b.textContent = study.h24.toFixed(1);
    h24b.parentElement.classList.toggle('warn', study.h24 >= MOCK.DAILY_CAP_HOURS);
  }

  /* ---------------- 播放控制 ---------------- */
  $('#btn-play').addEventListener('click', function () {
    if (playing) { pause(); return; }

    var ch = chapters[curIdx];
    var st = chapterState[curIdx];

    // 学时已达标：允许回放但不计学时
    if (study.hoursReached) {
      Util.toast('学时已达标，播放不再累计学时（保留可回放）');
    }

    // 24 小时上限预检（未达标章节且未计学时时才拦截）
    if (study.h24 >= MOCK.DAILY_CAP_HOURS && !st.done && !ch.counted) {
      $('#cap-current').textContent = study.h24.toFixed(1);
      document.querySelector('#dialog-24h-cap').classList.add('show');
      return;
    }

    play();
  });

  function play() {
    playing = true;
    $('#video-box').classList.add('playing');
    $('#btn-play').textContent = '⏸';

    playTimer = setInterval(function () {
      var ch = chapters[curIdx];
      var st = chapterState[curIdx];
      st.learnedSec++;

      // 章节观看完成：上报学时（服务端做重复 / 上限 / 达标校验）
      if (st.learnedSec >= ch.hours * SECONDS_PER_HOUR && !st.done) {
        st.done = true;
        st.learnedSec = ch.hours * SECONDS_PER_HOUR;
        pause();

        API.reportChapterHours({
          archiveId: archiveId,
          courseId: courseId,
          chapterId: ch.id,
          hours: ch.hours
        }).then(function (r) {
          study.totalHours = r.totalHours;
          study.hoursReached = r.hoursReached;
          study.h24 = r.h24;
          ch.counted = r.added > 0 || ch.counted;

          if (r.repeat) {
            Util.toast('该章节已计过学时，本次不再累计');
          } else if (r.capped) {
            Util.toast('今日 24 小时学时已达上限，暂停累计');
          } else {
            Util.toast('✓ 已累计 ' + ch.hours + ' 学时');
          }

          // 自动切换到下一个未完成章节
          var next = chapterState.findIndex(function (s) { return !s.done; });
          if (next >= 0) curIdx = next;

          renderChapters();
          updateInfo();

          // 首次触达 21 学时：弹出达标提醒
          if (r.reached) {
            $('#done-worktype').textContent = course.workType;
            setTimeout(function () {
              document.querySelector('#dialog-hours-done').classList.add('show');
            }, 400);
          }
        }).catch(function (err) { Util.toast(err.message); });

        return;
      }
      updateInfo();
    }, 1000);
  }

  function pause() {
    playing = false;
    $('#video-box').classList.remove('playing');
    $('#btn-play').textContent = '▶';
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
  }

  /* ---------------- 防作弊：禁止快进拖拽 / 倍速 / 右键长按 ---------------- */
  // 点击进度条：仅提示，不跳转时间
  $('#progress-line').addEventListener('click', function (e) {
    e.preventDefault();
    Util.toast('禁止快进拖拽，请正常观看学习');
  });
  // 倍速文案不可点击调整
  $('#speed-text').addEventListener('click', function () {
    Util.toast('学习期间禁止倍速调整');
  });
  // 禁用视频区右键 / 长按菜单
  $('#video-box').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------------- 弹层关闭 ---------------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelector('#' + btn.dataset.close).classList.remove('show');
    });
  });
})();
