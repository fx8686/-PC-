/* ============================================================
 * 接口层（统一出口，预留后端接入位置）
 * ------------------------------------------------------------
 * 接入后端时：
 *   1. 将 CONFIG.useMock 改为 false；
 *   2. 修改 CONFIG.baseUrl 为真实网关地址；
 *   3. 各方法内已标注 TODO 的位置替换为 request(...) 调用；
 *   4. 页面层代码无需改动（方法签名、返回数据结构保持不变）。
 * 统一返回结构约定：{ code: 0, message: 'ok', data: {...} }
 * ============================================================ */
(function (global) {
  'use strict';

  var CONFIG = {
    baseUrl: '/api/h5',   // TODO: 替换为真实后端地址
    useMock: true,        // 演示阶段走本地 Mock
    timeout: 8000
  };

  /* ---------------- 请求封装（真实接口用） ---------------- */
  function request(path, options) {
    var opts = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CONFIG.timeout);

    return fetch(CONFIG.baseUrl + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.data ? JSON.stringify(opts.data) : undefined,
      credentials: 'include', // 携带登录态 Cookie
      signal: controller.signal
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('网络异常（' + res.status + '）');
      return res.json();
    }).then(function (json) {
      if (json.code !== 0) throw new Error(json.message || '请求失败');
      return json.data;
    }).catch(function (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
      throw err;
    });
  }

  /* ---------------- Mock 辅助 ---------------- */
  function mockDelay(data, ms) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(data); }, ms || 260);
    });
  }

  function mockError(msg, ms) {
    return new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error(msg)); }, ms || 260);
    });
  }

  function findArchive(id) {
    return MOCK.getArchives().filter(function (a) { return a.id === id; })[0] || null;
  }

  /* ---------------- 增强课程数据（进度 / 状态） ---------------- */
  function buildCourse(c) {
    var progress = MOCK.getProgress();
    var done = Math.min(c.total, progress[c.id] || 0);
    var status = 'notstart';
    if (done >= c.total) status = 'done';
    else if (done > 0) status = 'learning';
    return {
      id: c.id, name: c.name, workType: c.workType,
      total: c.total, done: done, status: status
    };
  }

  /* ---------------- 接口定义 ---------------- */
  var API = {
    /* 登录 */
    login: function (payload) {
      if (!CONFIG.useMock) return request('/login', { method: 'POST', data: payload }); // TODO
      var users = MOCK.getUsers();
      var u = users[payload.account];
      if (!u) return mockError('账号不存在，请检查后重试');
      if (u.password !== payload.password) return mockError('密码错误，请重新输入');
      return mockDelay({
        account: payload.account,
        name: u.name,
        gender: u.gender,
        idCard: u.idCard,
        phone: u.phone
      });
    },

    /* 注册 */
    register: function (payload) {
      if (!CONFIG.useMock) return request('/register', { method: 'POST', data: payload }); // TODO
      var users = MOCK.getUsers();
      if (users[payload.account]) return mockError('该账号已被注册');
      MOCK.saveUser(payload.account, {
        password: payload.password,
        name: payload.name,
        gender: payload.gender,
        idCard: payload.idCard,
        phone: payload.phone
      });
      return mockDelay({
        account: payload.account,
        name: payload.name,
        gender: payload.gender,
        idCard: payload.idCard,
        phone: payload.phone
      });
    },

    /* 当前登录用户 */
    getProfile: function () {
      // TODO: return request('/profile')
      var u = Util.currentUser();
      return u ? mockDelay(u, 80) : mockError('登录已失效，请重新登录');
    },

    /* 报名档案列表 */
    getArchives: function () {
      // TODO: return request('/archives')
      return mockDelay(MOCK.getArchives().slice(), 120);
    },

    /* 新增 / 保存报名档案（草稿） */
    saveArchive: function (payload) {
      if (!CONFIG.useMock) return request('/archives', { method: 'POST', data: payload }); // TODO
      var list = MOCK.getArchives();
      var now = Util.nowText();

      if (payload.id) {
        var idx = list.map(function (a) { return a.id; }).indexOf(payload.id);
        if (idx < 0) return mockError('报名档案不存在');
        if (list[idx].status === 'pending' || list[idx].status === 'approved') {
          return mockError('该档案已提交审核，暂不可修改');
        }
        list[idx] = Object.assign({}, list[idx], payload);
        MOCK.saveArchives(list);
        return mockDelay(list[idx]);
      }

      var arc = Object.assign({
        id: 'REG' + Date.now(),
        status: 'draft',
        paid: false,
        createdAt: now,
        learnType: '继续教育学员'
      }, payload);
      list.push(arc);
      MOCK.saveArchives(list);
      return mockDelay(arc);
    },

    /* 提交审核 */
    submitArchive: function (id) {
      if (!CONFIG.useMock) return request('/archives/' + id + '/submit', { method: 'POST' }); // TODO
      var list = MOCK.getArchives();
      var idx = list.map(function (a) { return a.id; }).indexOf(id);
      if (idx < 0) return mockError('报名档案不存在');
      list[idx].status = 'pending';
      MOCK.saveArchives(list);
      return mockDelay(list[idx]);
    },

    /* 删除档案（仅草稿/驳回可删） */
    deleteArchive: function (id) {
      if (!CONFIG.useMock) return request('/archives/' + id, { method: 'DELETE' }); // TODO
      var list = MOCK.getArchives().filter(function (a) { return a.id !== id; });
      MOCK.saveArchives(list);
      return mockDelay(true);
    },

    /* 模拟审核通过：仅用于演示，真实环境由管理员后台操作 */
    mockApproveArchive: function (id) {
      var list = MOCK.getArchives();
      var idx = list.map(function (a) { return a.id; }).indexOf(id);
      if (idx < 0) return mockError('报名档案不存在');
      list[idx].status = 'approved';
      MOCK.saveArchives(list);
      return mockDelay(list[idx]);
    },

    /* 学时数据 */
    getStudyHours: function (archiveId) {
      // TODO: return request('/archives/' + archiveId + '/hours')
      return mockDelay(MOCK.getStudyHours(archiveId), 80);
    },

    /* 课程列表（可按工种筛选） */
    getCourses: function (workType) {
      // TODO: return request('/courses?workType=' + encodeURIComponent(workType || ''))
      var list = MOCK.COURSES.map(buildCourse);
      if (workType) list = list.filter(function (c) { return c.workType === workType; });
      return mockDelay(list, 120);
    },

    /* 累加学习进度（演示：直接按课时累加；真实环境由播放器上报学时） */
    addCourseProgress: function (courseId, step) {
      var progress = MOCK.getProgress();
      var course = MOCK.COURSES.filter(function (c) { return c.id === courseId; })[0];
      if (!course) return mockError('课程不存在');
      var next = Math.min(course.total, (progress[courseId] || 0) + (step || 1));
      progress[courseId] = next;
      MOCK.saveProgress(progress);
      return mockDelay(buildCourse(course));
    },

    /* 缴费订单列表 */
    getOrders: function () {
      // TODO: return request('/orders')
      return mockDelay(MOCK.buildOrders(), 120);
    },

    /* 创建聚合支付订单（微信 / 支付宝通用一个二维码） */
    createPaymentOrder: function (payload) {
      if (!CONFIG.useMock) {
        // TODO: return request('/payment/orders', { method: 'POST', data: payload })
      }
      var arc = findArchive(payload.archiveId);
      if (!arc) return mockError('报名档案不存在');
      if (arc.status !== 'approved') return mockError('该报名尚未审核通过，暂不可缴费');
      if (arc.paid) return mockError('该报名已完成缴费');

      var map = MOCK.getPayOrders();
      var now = Date.now();
      var exist = Object.keys(map)
        .map(function (k) { return map[k]; })
        .filter(function (o) {
          return o.archiveId === payload.archiveId && o.status === 'unpaid' &&
            now - o.createdAt < 15 * 60 * 1000; // 15 分钟内复用二维码
        })[0];

      if (exist) {
        exist.channel = payload.channel || exist.channel;
        MOCK.savePayOrders(map);
        return mockDelay(exist);
      }

      var order = {
        orderNo: 'PAY' + now,
        archiveId: payload.archiveId,
        channel: payload.channel || 'wechat',
        amount: MOCK.UNIT_PRICE,
        status: 'unpaid',
        createdAt: now,
        payTime: '',
        qrText: 'H5PAY://' + payload.archiveId + '/' + now
      };
      map[order.orderNo] = order;
      MOCK.savePayOrders(map);
      return mockDelay(order);
    },

    /* 查询支付状态（演示：下单 8 秒后自动模拟支付成功） */
    queryPaymentStatus: function (orderNo) {
      if (!CONFIG.useMock) return request('/payment/orders/' + orderNo + '/status'); // TODO
      var map = MOCK.getPayOrders();
      var order = map[orderNo];
      if (!order) return mockError('支付订单不存在');

      if (order.status !== 'paid' && Date.now() - order.createdAt > 8000) {
        order.status = 'paid';
        order.payTime = Util.nowText();
        map[orderNo] = order;
        MOCK.savePayOrders(map);

        // 同步报名档案缴费状态（真实环境由后端回调处理）
        var archives = MOCK.getArchives();
        var idx = archives.map(function (a) { return a.id; }).indexOf(order.archiveId);
        if (idx >= 0) {
          archives[idx].paid = true;
          archives[idx].paidAt = order.payTime;
          MOCK.saveArchives(archives);
        }
      }
      return mockDelay({ status: order.status, payTime: order.payTime || '' }, 180);
    },

    /* 考试列表（同步剩余机会、课程完成情况、在线考试结果） */
    getExams: function () {
      // TODO: return request('/exams')
      var retries = MOCK.getExamRetries();
      var results = MOCK.getExamResults();
      var list = MOCK.EXAMS.map(function (e) {
        var item = Object.assign({}, e, {
          retries: retries[e.id] !== undefined ? retries[e.id] : e.retries,
          courseDone: MOCK.isCourseDone(e.courseId)
        });
        var r = results[e.id];
        if (r) {
          item.status = r.status;
          item.score = r.score;
          item.timeUsed = r.timeUsed;
          item.details = r.details;
        }
        return item;
      });
      return mockDelay(list, 120);
    },

    /* 考试详情 */
    getExamDetail: function (id) {
      // TODO: return request('/exams/' + id)
      var exam = MOCK.EXAMS.filter(function (e) { return e.id === id; })[0];
      if (!exam) return mockError('考试记录不存在');
      var item = Object.assign({}, exam);
      var r = MOCK.getExamResults()[id];
      if (r) {
        item.status = r.status;
        item.score = r.score;
        item.timeUsed = r.timeUsed;
        item.details = r.details;
      }
      return mockDelay(item);
    },

    /* 安全生产教育培训证书数据（学时达标后可查看） */
    getCertificate: function (archiveId) {
      // TODO: return request('/archives/' + archiveId + '/certificate')
      var arc = findArchive(archiveId);
      if (!arc) return mockError('报名档案不存在');
      var hours = MOCK.getStudyHours(archiveId);
      var u = Util.currentUser() || {};
      var idCard = u.idCard || '';
      // 身份证第 17 位：奇数为男，偶数为女（与 PC 端规则一致）
      var gender = idCard.length >= 17
        ? (parseInt(idCard.charAt(16), 10) % 2 === 1 ? '男' : '女')
        : (u.gender || '男');

      return mockDelay({
        certCode: 'SC' + String(archiveId).replace('REG', ''),
        workType: arc.workType,
        certNo: arc.certNo,
        userName: u.name || '学员',
        gender: gender,
        idCardMasked: Util.maskIdCard(idCard),
        totalHours: Math.round(hours.totalHours),
        finishDate: Util.today()
      }, 120);
    },

    /* ---------------- 课程播放页 ---------------- */

    /* 课程播放数据：课程 + 章节 + 学时状态 */
    getCoursePlay: function (courseId, archiveId) {
      // TODO: return request('/courses/' + courseId + '/play?archiveId=' + archiveId)
      var course = MOCK.COURSES.filter(function (c) { return c.id === courseId; })[0];
      if (!course) return mockError('课程不存在');
      var arc = findArchive(archiveId);
      if (!arc) return mockError('请从「我的课程」进入学习，先选择报名档案');

      var chapters = MOCK.getChapters(courseId).map(function (ch) {
        return Object.assign({}, ch, { counted: false });
      });
      var study = MOCK.getStudyHours(archiveId);
      chapters.forEach(function (ch) {
        if (study.watchedChapterIds.indexOf(ch.id) >= 0) ch.counted = true;
      });

      return mockDelay({
        course: { id: course.id, name: course.name, total: course.total, workType: course.workType },
        archive: { id: arc.id, workType: arc.workType },
        chapters: chapters,
        study: {
          totalHours: study.totalHours,
          hoursReached: study.hoursReached,
          h24: MOCK.hoursInLast24h(archiveId)
        }
      }, 120);
    },

    /* 章节学时上报（演示：每 60 秒 = 1 学时；真实环境由播放器心跳上报）
     * 服务端完成：重复观看校验、24 小时上限截断、达标判定，并同步课程进度 */
    reportChapterHours: function (payload) {
      if (!CONFIG.useMock) {
        // TODO: return request('/study/chapters', { method: 'POST', data: payload })
      }
      var course = MOCK.COURSES.filter(function (c) { return c.id === payload.courseId; })[0];
      if (!course) return mockError('课程不存在');

      var r = MOCK.addChapterHours(payload.archiveId, payload.chapterId, payload.hours);
      // 同步课程进度（按学时累加，封顶为课程总学时）
      if (r.added > 0) {
        var progress = MOCK.getProgress();
        progress[payload.courseId] = Math.min(course.total, (progress[payload.courseId] || 0) + r.added);
        MOCK.saveProgress(progress);
      }

      var study = MOCK.getStudyHours(payload.archiveId);
      return mockDelay({
        added: r.added,
        capped: r.capped,
        reached: r.reached,
        repeat: r.repeat,
        totalHours: study.totalHours,
        hoursReached: study.hoursReached,
        h24: MOCK.hoursInLast24h(payload.archiveId)
      }, 100);
    },

    /* ---------------- 在线考试 ---------------- */

    /* 生成 80 道题（40 单选 + 20 判断 + 20 多选，与 PC 端组卷规则一致） */
    buildExamQuestions: function () {
      var bank = MOCK.QUESTION_BANK;
      var list = [];
      for (var i = 0; i < 40; i++) {
        var s = bank.single[i % bank.single.length];
        list.push({ id: i + 1, type: 'single', title: s.t, options: s.o, answer: [s.a] });
      }
      for (var j = 0; j < 20; j++) {
        var d = bank.judge[j % bank.judge.length];
        list.push({ id: 41 + j, type: 'judge', title: d.t, options: ['正确', '错误'], answer: [d.a] });
      }
      for (var k = 0; k < 20; k++) {
        var m = bank.single[k % bank.single.length];
        list.push({ id: 61 + k, type: 'multiple', title: m.t + '（多选）', options: m.o, answer: [0, 1] });
      }
      return list;
    },

    /* 交卷判分（与 PC 端 doSubmit 规则一致：全对得分，60 分合格）
     * 合格 → 写入考试结果；不合格 → 扣减剩余考试机会（共 2 次） */
    submitExam: function (payload) {
      if (!CONFIG.useMock) return request('/exams/' + payload.examId + '/submit', { method: 'POST', data: payload }); // TODO
      var exam = MOCK.EXAMS.filter(function (e) { return e.id === payload.examId; })[0];
      if (!exam) return mockError('考试记录不存在');

      var questions = API.buildExamQuestions();
      var answers = payload.answers || {};
      var correct = 0;
      questions.forEach(function (q) {
        var a = (answers[q.id] || []).slice().sort().join(',');
        var c = q.answer.slice().sort().join(',');
        if (a === c) correct++;
      });
      var total = questions.length;
      var score = Math.round(correct / total * 100);
      var passed = score >= 60;

      // 用时（分钟），不足 1 分钟按 1 分钟计
      var minutes = Math.max(1, Math.round((payload.timeUsedSec || 0) / 60));
      var timeUsed = minutes + ' 分钟';

      // 答卷详情摘要（最多 5 题：优先展示答错题目）
      var TYPE_TXT = { single: '单选题', judge: '判断题', multiple: '多选题' };
      function ansText(q, sel) {
        if (!sel || !sel.length) return '—';
        return sel.slice().sort().map(function (i) {
          return (q.type === 'judge' ? ['正确', '错误'][i] : ['A', 'B', 'C', 'D'][i] + '.' + q.options[i]);
        }).join('、');
      }
      var wrongList = questions.filter(function (q) {
        var a = (answers[q.id] || []).slice().sort().join(',');
        var c = q.answer.slice().sort().join(',');
        return a !== c;
      });
      var rightList = questions.filter(function (q) { return wrongList.indexOf(q) < 0; });
      var details = wrongList.concat(rightList).slice(0, 5).map(function (q) {
        var a = (answers[q.id] || []).slice().sort().join(',');
        var c = q.answer.slice().sort().join(',');
        return {
          q: '[' + TYPE_TXT[q.type] + '] ' + q.title,
          a: ansText(q, q.answer),
          ua: ansText(q, answers[q.id]),
          ok: a === c
        };
      });

      // 持久化考试结果
      var results = MOCK.getExamResults();
      results[exam.id] = { status: passed ? 'pass' : 'fail', score: score, timeUsed: timeUsed, details: details };
      MOCK.saveExamResults(results);

      // 不合格扣减剩余机会（与 PC 端一致：首次不合格后剩 1 次）
      if (!passed) {
        var retries = MOCK.getExamRetries();
        var cur = retries[exam.id];
        retries[exam.id] = cur === undefined ? exam.retries - 1 : Math.max(0, cur - 1);
        MOCK.saveExamRetries(retries);
      }

      return mockDelay({
        score: score, correct: correct, wrong: total - correct,
        passed: passed, total: total, timeUsed: timeUsed
      }, 400);
    },

    /* ---------------- 重置密码 ---------------- */
    resetPassword: function (payload) {
      if (!CONFIG.useMock) return request('/password/reset', { method: 'POST', data: payload }); // TODO
      // 演示环境：验证码固定 123456
      if (payload.code !== '123456') return mockError('验证码错误或已过期');

      var users = MOCK.getUsers();
      var account = Object.keys(users).filter(function (k) { return users[k].phone === payload.phone; })[0];
      if (!account) return mockError('该手机号未绑定任何账号');

      var profile = users[account];
      profile.password = payload.newPassword;
      MOCK.saveUser(account, profile);
      return mockDelay({ account: account }, 300);
    }
  };

  API.CONFIG = CONFIG;
  global.API = API;
})(window);
