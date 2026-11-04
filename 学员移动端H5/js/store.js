/* ============================================================
 * Mock 数据层（H5 独立存储，键名统一 h5_ 前缀）
 * 说明：
 *   1. 所有演示数据仅保存在浏览器 localStorage，刷新/换设备会重置；
 *   2. 数据结构与 PC 端保持一致，便于后续接入同一套后端接口；
 *   3. 真实环境请删除本文件的种子数据，改由 API 层请求后端。
 * ============================================================ */
(function (global) {
  'use strict';

  var K = {
    seed: 'h5_seed_v2',   // v2：章节 id 改为「课程-章节」格式，旧数据自动清空重建
    seedV1: 'h5_seed_v1',
    user: 'h5_user',
    users: 'h5_users',
    archives: 'h5_archives',
    courseProgress: 'h5_course_progress',
    payOrders: 'h5_pay_orders',
    examRetries: 'h5_exam_retries',
    examResults: 'h5_exam_results',
    hoursPrefix: 'h5_study_hours_',
    hoursDoneShown: 'h5_hours_done_shown'
  };

  /* ---------------- 基础常量（与 PC 端一致） ---------------- */
  var UNIT_PRICE = 600;       // 报名费单价：600 元 / 条
  var TARGET_HOURS = 21;      // 学时目标
  var DAILY_CAP_HOURS = 7;    // 24 小时内最多累计 7 学时

  var WORK_TYPES = [
    '低压电工作业', '高压电工作业', '焊接与热切割作业',
    '高处作业', '制冷与空调作业', '煤矿安全作业'
  ];

  /* ---------------- 课程库 ---------------- */
  var COURSES = [
    { id: 'c1', name: '安全生产法律法规',       workType: '低压电工作业', total: 8 },
    { id: 'c2', name: '低压电工安全技术',       workType: '低压电工作业', total: 16 },
    { id: 'c3', name: '电气防火防爆',           workType: '低压电工作业', total: 6 },
    { id: 'c4', name: '高处作业安全技术',       workType: '高处作业',     total: 12 },
    { id: 'c5', name: '高处坠落防护与应急',     workType: '高处作业',     total: 9 },
    { id: 'c6', name: '高压电工安全技术',       workType: '高压电工作业', total: 14 },
    { id: 'c7', name: '焊接与热切割安全技术',   workType: '焊接与热切割作业', total: 10 }
  ];

  /* ---------------- 课程章节（与 PC 端课程播放页同构，总学时与课程库一致） ---------------- */
  var CHAPTERS = {
    c1: [
      { id: 'c1-ch1', name: '第一章 安全生产法律法规概述', hours: 2 },
      { id: 'c1-ch2', name: '第二章 从业人员权利义务',     hours: 2 },
      { id: 'c1-ch3', name: '第三章 法律责任',             hours: 2 },
      { id: 'c1-ch4', name: '第四章 典型案例分析',         hours: 2 }
    ],
    c2: [
      { id: 'c2-ch1', name: '第一章 电工基础知识',   hours: 4 },
      { id: 'c2-ch2', name: '第二章 常用电工仪表',   hours: 4 },
      { id: 'c2-ch3', name: '第三章 电气安全用具',   hours: 4 },
      { id: 'c2-ch4', name: '第四章 低压配电装置',   hours: 4 }
    ],
    c3: [
      { id: 'c3-ch1', name: '第一章 电气火灾成因',   hours: 2 },
      { id: 'c3-ch2', name: '第二章 防火防爆措施',   hours: 2 },
      { id: 'c3-ch3', name: '第三章 灭火器材使用',   hours: 2 }
    ],
    c4: [
      { id: 'c4-ch1', name: '第一章 高处作业基础知识',     hours: 4 },
      { id: 'c4-ch2', name: '第二章 高处作业安全防护',     hours: 4 },
      { id: 'c4-ch3', name: '第三章 高处作业典型事故案例', hours: 4 }
    ],
    c5: [
      { id: 'c5-ch1', name: '第一章 高处坠落风险辨识', hours: 3 },
      { id: 'c5-ch2', name: '第二章 坠落防护用品使用', hours: 3 },
      { id: 'c5-ch3', name: '第三章 应急处置与救援',   hours: 3 }
    ],
    c6: [
      { id: 'c6-ch1', name: '第一章 高压电工基础知识', hours: 2 },
      { id: 'c6-ch2', name: '第二章 高压配电装置操作', hours: 4 },
      { id: 'c6-ch3', name: '第三章 继电保护与二次回路', hours: 4 },
      { id: 'c6-ch4', name: '第四章 高压安全用具',     hours: 4 }
    ],
    c7: [
      { id: 'c7-ch1', name: '第一章 焊接与热切割基础', hours: 2 },
      { id: 'c7-ch2', name: '第二章 动火作业安全管理', hours: 4 },
      { id: 'c7-ch3', name: '第三章 作业现场应急处置', hours: 4 }
    ]
  };

  /* ---------------- 在线考试题库（与 PC 端一致：前端模拟题库循环生成 80 题） ---------------- */
  var QUESTION_BANK = {
    single: [
      { t: '低压电工操作时，下列哪种做法是正确的？', o: ['带电作业时不戴绝缘手套', '停电后先验电再作业', '用湿手操作电气开关', '单人从事高压作业'], a: 1 },
      { t: '发现有人触电，首先应采取的措施是？', o: ['立即用手拉开触电者', '立即切断电源或用绝缘物使触电者脱离电源', '立即拨打120', '立即进行心肺复苏'], a: 1 },
      { t: '低压电气设备接地电阻一般不应大于多少欧姆？', o: ['4Ω', '10Ω', '30Ω', '100Ω'], a: 0 },
      { t: '下列哪种灭火器不适用于电气火灾？', o: ['二氧化碳灭火器', '干粉灭火器', '泡沫灭火器', '四氯化碳灭火器'], a: 2 },
      { t: '绝缘手套使用前应检查的项目不包括？', o: ['外观有无破损', '是否在有效期内', '有无漏气', '手套的颜色'], a: 3 },
      { t: '停电作业时，应在开关手柄上悬挂什么标示牌？', o: ['禁止合闸，有人工作', '在此工作', '从此上下', '止步，高压危险'], a: 0 },
      { t: '交流电压表测量电压时应与被测电路如何连接？', o: ['串联', '并联', '混联', '短路'], a: 1 },
      { t: '人体触电后，对人体伤害最严重的是？', o: ['烧伤', '电击', '电伤', '电弧'], a: 1 }
    ],
    judge: [
      { t: '电气设备发生火灾时，应立即用水扑救。', a: 1 },
      { t: '停电作业必须执行停电、验电、装设接地线、悬挂标示牌的技术措施。', a: 0 },
      { t: '绝缘工具可以超期使用，只要外观完好即可。', a: 1 },
      { t: '发现有人触电时，应立即用干燥的木棒等绝缘物使触电者脱离电源。', a: 0 },
      { t: '同一台变压器供电的系统中，可以一部分设备接地、一部分设备接零。', a: 1 },
      { t: '万用表使用完毕后，应将转换开关置于交流电压最高档或空档。', a: 0 }
    ]
  };

  /* ---------------- 考试记录（与 PC 端演示数据一致） ---------------- */
  var EXAMS = [
    {
      id: 'e1', name: '2025年度继续教育考试', workType: '低压电工作业',
      valid: '2025-09-01 ~ 2025-12-31', status: 'wait', retries: 2, courseId: 'c2',
      score: null, timeUsed: null, details: null
    },
    {
      id: 'e4', name: '2025年度继续教育考试（高处作业）', workType: '高处作业',
      valid: '2025-09-01 ~ 2025-12-31', status: 'wait', retries: 2, courseId: 'c4',
      score: null, timeUsed: null, details: null
    },
    {
      id: 'e2', name: '2024年度继续教育补考', workType: '低压电工作业',
      valid: '2024-09-01 ~ 2024-12-31', status: 'fail', retries: 0, courseId: 'c1',
      score: 48, timeUsed: '86 分钟',
      details: [
        { q: '触电急救时，首先应采取的措施是：', a: '立即切断电源', ua: '直接用手拉开触电者', ok: false },
        { q: '万用表测量电压时，应将表笔与被测电路：', a: '并联', ua: '串联', ok: false },
        { q: '低压配电柜前操作通道的宽度应不小于：', a: '1.5 米', ua: '1.0 米', ok: false },
        { q: '绝缘手套使用前应进行：', a: '充气检查有无漏气', ua: '外观检查即可', ok: true },
        { q: '保护零线（PE 线）的颜色应为：', a: '黄绿双色', ua: '蓝色', ok: false }
      ]
    },
    {
      id: 'e3', name: '2024年度继续教育考试', workType: '低压电工作业',
      valid: '2024-01-01 ~ 2024-03-31', status: 'pass', retries: 0, courseId: 'c1',
      score: 92, timeUsed: '58 分钟',
      details: [
        { q: '触电急救的八字方针是：', a: '迅速、就地、准确、坚持', ua: '—', ok: true },
        { q: '万用表测量电阻前应进行：', a: '欧姆调零', ua: '机械调零', ok: true },
        { q: '电气设备金属外壳应：', a: '可靠接地或接零', ua: '与零线相连', ok: true },
        { q: '绝缘鞋的作用是：', a: '防止跨步电压', ua: '耐高压冲击', ok: true },
        { q: '低压开关安装时，手柄向上为：', a: '合闸位置', ua: '分闸位置', ok: false }
      ]
    }
  ];

  /* ---------------- 默认演示账号 ---------------- */
  var DEFAULT_USERS = {
    admin: {
      password: '123456',
      name: '张三',
      gender: '男',
      idCard: '110101199001011234',
      phone: '13800138000'
    }
  };

  /* ---------------- 演示数据种子（仅首次打开时写入） ---------------- */
  function seed() {
    // 版本升级：检测到 v1 旧数据时全部清空，按 v2 结构重建
    if (localStorage.getItem(K.seedV1) && !localStorage.getItem(K.seed)) {
      Object.keys(localStorage)
        .filter(function (k) { return k.indexOf('h5_') === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    }
    if (localStorage.getItem(K.seed)) return;
    localStorage.setItem(K.seed, '1');

    // 报名档案：一人多证，覆盖待审核 / 待缴费 / 已缴费 / 学时完成
    Util.set(K.archives, [
      {
        id: 'REG2025010001', status: 'approved', paid: true, workType: '低压电工作业',
        certNo: 'TZ202111000123', learnType: '继续教育学员',
        validFrom: '2022-08-01', validTo: '2027-08-01',
        createdAt: '2025-09-02 10:12', paidAt: '2025-09-03 09:20'
      },
      {
        id: 'REG2025010002', status: 'approved', paid: false, workType: '高压电工作业',
        certNo: 'TZ202111000456', learnType: '继续教育学员',
        validFrom: '2022-09-01', validTo: '2027-09-01',
        createdAt: '2025-09-05 14:30'
      },
      {
        id: 'REG2025010003', status: 'pending', paid: false, workType: '焊接与热切割作业',
        certNo: 'TZ202111000789', learnType: '继续教育学员',
        validFrom: '2023-01-01', validTo: '2028-01-01',
        createdAt: '2025-09-08 16:45'
      },
      {
        id: 'REG2025010004', status: 'approved', paid: true, workType: '高处作业',
        certNo: 'TZ202411000321', learnType: '继续教育学员',
        validFrom: '2021-08-01', validTo: '2026-08-01',
        createdAt: '2024-08-11 09:00', paidAt: '2024-08-12 10:05'
      }
    ]);

    // 课程进度（课时）：c4 已完成 => 解锁「高处作业」考试
    Util.set(K.courseProgress, { c1: 8, c2: 4, c3: 0, c4: 12, c5: 3, c6: 0, c7: 0 });

    // 学时：0001 未达标（18.5），0004 已达标（21）
    // watchedChapterIds 记录「已计入学时」的章节（课程-章节格式，与播放页对应）
    Util.set(K.hoursPrefix + 'REG2025010001', {
      totalHours: 18.5,
      dailyRecords: [
        { ts: Date.now() - 3600000, hours: 2.5 },
        { ts: Date.now() - 7200000, hours: 4 },
        { ts: Date.now() - 86400000, hours: 12 }
      ],
      watchedChapterIds: ['c1-ch1', 'c1-ch2', 'c1-ch3', 'c1-ch4'],
      hoursReached: false
    });
    Util.set(K.hoursPrefix + 'REG2025010004', {
      totalHours: 21,
      dailyRecords: [{ ts: Date.now() - 86400000 * 2, hours: 21 }],
      watchedChapterIds: ['c4-ch1', 'c4-ch2', 'c4-ch3'],
      hoursReached: true
    });
  }

  /* ---------------- 数据读写 ---------------- */
  function getUsers() {
    var custom = Util.get(K.users, {});
    var all = {};
    Object.keys(DEFAULT_USERS).forEach(function (k) { all[k] = DEFAULT_USERS[k]; });
    Object.keys(custom).forEach(function (k) { all[k] = custom[k]; });
    return all;
  }

  function saveUser(account, profile) {
    var custom = Util.get(K.users, {});
    custom[account] = profile;
    Util.set(K.users, custom);
  }

  function getArchives() { return Util.get(K.archives, []); }
  function saveArchives(list) { Util.set(K.archives, list); }

  function getStudyHours(archiveId) {
    return Util.get(K.hoursPrefix + archiveId, {
      totalHours: 0,
      dailyRecords: [],
      watchedChapterIds: [],
      hoursReached: false
    });
  }

  function saveStudyHours(archiveId, data) {
    Util.set(K.hoursPrefix + archiveId, data);
  }

  function getProgress() { return Util.get(K.courseProgress, {}); }
  function saveProgress(map) { Util.set(K.courseProgress, map); }

  function getPayOrders() { return Util.get(K.payOrders, {}); }
  function savePayOrders(map) { Util.set(K.payOrders, map); }

  function getExamRetries() { return Util.get(K.examRetries, {}); }
  function saveExamRetries(map) { Util.set(K.examRetries, map); }

  /* 在线考试成绩持久化：examId -> { status, score, timeUsed, details } */
  function getExamResults() { return Util.get(K.examResults, {}); }
  function saveExamResults(map) { Util.set(K.examResults, map); }

  /* 课程章节数据 */
  function getChapters(courseId) { return CHAPTERS[courseId] || []; }

  /* 近 24 小时累计学时（与 PC 端课程播放页口径一致） */
  function hoursInLast24h(archiveId) {
    var now = Date.now();
    return getStudyHours(archiveId).dailyRecords
      .filter(function (r) { return now - r.ts < 24 * 60 * 60 * 1000; })
      .reduce(function (s, r) { return s + r.hours; }, 0);
  }

  /* 写入章节学时（与 PC 端 addStudyHours 逻辑一致）
   * 返回 { added: 实际新增, capped: 是否被 24h 上限截断, reached: 是否刚达标, repeat: 重复观看 } */
  function addChapterHours(archiveId, chapterId, deltaHours) {
    var d = getStudyHours(archiveId);
    // 重复校验：该章节已计入学时，不再累计（同一视频仅计一次）
    if (d.watchedChapterIds.indexOf(chapterId) >= 0) {
      return { added: 0, capped: false, reached: false, repeat: true };
    }
    var h24 = hoursInLast24h(archiveId);
    var remain24 = Math.max(0, DAILY_CAP_HOURS - h24);
    var added = Math.min(deltaHours, remain24);
    var capped = remain24 <= 0;
    if (added > 0) {
      d.watchedChapterIds.push(chapterId);
      d.totalHours = +(d.totalHours + added).toFixed(1);
      d.dailyRecords.push({ ts: Date.now(), hours: added });
    }
    var reached = false;
    if (!d.hoursReached && d.totalHours >= TARGET_HOURS) {
      d.hoursReached = true;
      reached = true;
    }
    saveStudyHours(archiveId, d);
    return { added: added, capped: capped, reached: reached, repeat: false };
  }

  function courseTotal(courseId) {
    var c = COURSES.filter(function (x) { return x.id === courseId; })[0];
    return c ? c.total : 0;
  }

  function isCourseDone(courseId) {
    var p = getProgress();
    return (p[courseId] || 0) >= courseTotal(courseId) && courseTotal(courseId) > 0;
  }

  /* ---------------- 订单由「审核通过」的报名档案派生（与 PC 端一致） ---------------- */
  function buildOrders() {
    return getArchives()
      .filter(function (a) { return a.status === 'approved'; })
      .map(function (a) {
        return {
          orderNo: 'ORD' + String(a.id || '').replace('REG', ''),
          archiveId: a.id,
          workType: a.workType || '-',
          certNo: a.certNo || '-',
          amount: UNIT_PRICE,
          createTime: a.createdAt || '-',
          status: a.paid ? 'paid' : 'unpaid',
          payTime: a.paid ? (a.paidAt || '-') : '',
          invoice: a.invoice || null  // 从档案读取发票信息（若未填写则为 null）
        };
      });
  }

  /* ---------------- 对外暴露 ---------------- */
  global.MOCK = {
    K: K,
    UNIT_PRICE: UNIT_PRICE,
    TARGET_HOURS: TARGET_HOURS,
    DAILY_CAP_HOURS: DAILY_CAP_HOURS,
    WORK_TYPES: WORK_TYPES,
    COURSES: COURSES,
    CHAPTERS: CHAPTERS,
    QUESTION_BANK: QUESTION_BANK,
    EXAMS: EXAMS,
    seed: seed,
    getUsers: getUsers,
    saveUser: saveUser,
    getArchives: getArchives,
    saveArchives: saveArchives,
    getStudyHours: getStudyHours,
    saveStudyHours: saveStudyHours,
    getProgress: getProgress,
    saveProgress: saveProgress,
    getPayOrders: getPayOrders,
    savePayOrders: savePayOrders,
    getExamRetries: getExamRetries,
    saveExamRetries: saveExamRetries,
    getExamResults: getExamResults,
    saveExamResults: saveExamResults,
    getChapters: getChapters,
    hoursInLast24h: hoursInLast24h,
    addChapterHours: addChapterHours,
    courseTotal: courseTotal,
    isCourseDone: isCourseDone,
    buildOrders: buildOrders
  };

  // 首次打开自动写入演示数据
  seed();
})(window);
