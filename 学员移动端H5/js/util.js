/* ============================================================
 * 通用工具函数（全站公用）
 * 包含：DOM 选择、Toast、弹层、本地存储、格式化、校验、图片压缩
 * ============================================================ */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    // 先关闭再打开，保证连续提示时有动效
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------------- 底部弹层 ---------------- */
  function openSheet(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  function closeSheet(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }

  // 点击遮罩空白处关闭弹层
  function bindMask(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', function (e) {
      if (e.target === el) closeSheet(id);
    });
  }

  /* ---------------- 本地存储（H5 独立命名空间，避免与 PC 端冲突） ---------------- */
  function get(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      // 演示环境存储超限时给出提示（真实环境应改为上传到服务端，只存 URL）
      toast('本地存储空间不足，请删除部分报名图片后重试');
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  /* ---------------- 格式化 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function nowText() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 身份证脱敏：前 3 位 + *********** + 后 4 位
  function maskIdCard(id) {
    return id && id.length >= 10 ? id.substring(0, 3) + '***********' + id.substring(id.length - 4) : (id || '');
  }

  // 手机号脱敏：138****8000
  function maskPhone(p) {
    return p && p.length === 11 ? p.substring(0, 3) + '****' + p.substring(7) : (p || '');
  }

  /* ---------------- 校验（与 PC 端规则一致） ---------------- */
  function isIdCard(v) { return /(^\d{15}$)|(^\d{17}([0-9]|X|x)$)/.test(v || ''); }
  function isPhone(v) { return /^1[3-9]\d{9}$/.test(v || ''); }

  /* ---------------- 其他 ---------------- */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return (prefix || '') + Date.now() + Math.floor(Math.random() * 1000);
  }

  /* ---------------- 登录态 ---------------- */
  function currentUser() { return get('h5_user', null); }

  // 页面级登录守卫：未登录直接跳转登录页
  function requireAuth() {
    if (!currentUser()) {
      location.replace('登录.html');
      return false;
    }
    return true;
  }

  function logout() {
    remove('h5_user');
    location.replace('登录.html');
  }

  /* ---------------- 图片压缩（移动端拍照体积较大，压缩后存入本地） ---------------- */
  function compressImage(file, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var scale = Math.min(1, (maxWidth || 800) / img.width);
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality || 0.6));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- 演示二维码绘制 ----------------
   * 说明：仅用于原型演示，按文本生成稳定的伪二维码图案；
   * 真实环境应由后端下单接口返回二维码图片地址或支付串。
   */
  function drawMockQR(canvas, text) {
    var size = canvas.width;
    var ctx = canvas.getContext('2d');
    var modules = 33;
    var cell = Math.floor(size / modules);
    var offset = Math.floor((size - cell * modules) / 2);

    // 以文本生成稳定随机序列
    var seed = 2166136261;
    for (var i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    function rand() {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 1000) / 1000;
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1a1a1a';

    for (var r = 0; r < modules; r++) {
      for (var c = 0; c < modules; c++) {
        // 三个定位角附近留白，稍后单独绘制
        if ((r < 9 && c < 9) || (r < 9 && c >= modules - 9) || (r >= modules - 9 && c < 9)) continue;
        if (rand() > 0.52) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
      }
    }

    // 绘制三个定位角
    function finder(r0, c0) {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(offset + c0 * cell, offset + r0 * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = '#fff';
      ctx.fillRect(offset + (c0 + 1) * cell, offset + (r0 + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(offset + (c0 + 2) * cell, offset + (r0 + 2) * cell, 3 * cell, 3 * cell);
    }
    finder(1, 1);
    finder(1, modules - 8);
    finder(modules - 8, 1);
  }

  global.Util = {
    $: $, $$: $$,
    toast: toast,
    openSheet: openSheet, closeSheet: closeSheet, bindMask: bindMask,
    get: get, set: set, remove: remove,
    nowText: nowText, today: today,
    maskIdCard: maskIdCard, maskPhone: maskPhone,
    isIdCard: isIdCard, isPhone: isPhone,
    escapeHtml: escapeHtml, uid: uid,
    currentUser: currentUser, requireAuth: requireAuth, logout: logout,
    compressImage: compressImage, drawMockQR: drawMockQR
  };
})(window);
