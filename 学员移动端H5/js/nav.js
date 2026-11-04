/* ============================================================
 * 底部标签栏（全站公用）
 * 说明：各页面 body 上通过 data-page 指定当前模块，自动高亮
 * ============================================================ */
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page');
  // 登录页、课程播放页、在线考试页为独立布局，不显示底部标签栏
  if (!page || page === 'login' || page === 'player' || page === 'examdo') return;

  var items = [
    { key: 'profile', href: '个人报名信息.html', ico: '📋', text: '报名信息' },
    { key: 'courses', href: '我的课程.html', ico: '📚', text: '我的课程' },
    { key: 'orders',  href: '缴费订单.html',  ico: '💰', text: '缴费订单' },
    { key: 'exams',   href: '我的考试.html',   ico: '📝', text: '我的考试' }
  ];

  var nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.innerHTML = items.map(function (it) {
    var active = it.key === page ? ' active' : '';
    return '<a class="tab-item' + active + '" href="' + it.href + '">' +
      '<span class="ico">' + it.ico + '</span><span>' + it.text + '</span></a>';
  }).join('');

  var app = document.querySelector('.app');
  if (app) app.appendChild(nav);
})();
