/* ============================================================
 * 重置密码页逻辑
 * 规则与 PC 端一致：
 *   - 手机号 11 位校验；验证码 60 秒倒计时（演示验证码 123456）
 *   - 新密码 6-20 位；两次输入需一致
 *   - 重置成功 3 秒后返回登录页
 * ============================================================ */
(function () {
  'use strict';

  var $ = Util.$;

  var PHONE_RE = /^1[3-9]\d{9}$/;

  /* ---------------- 错误提示 ---------------- */
  function setError(id, msg) { $('#e-' + id).textContent = msg || ''; }
  function clearError(id) { $('#e-' + id).textContent = ''; }

  /* ---------------- 验证码倒计时 ---------------- */
  var codeTimer = null;
  $('#btn-code').addEventListener('click', function () {
    var phone = $('#f-phone').value.trim();
    if (!phone) { setError('phone', '请输入手机号'); return; }
    if (!PHONE_RE.test(phone)) { setError('phone', '请输入正确的11位手机号'); return; }
    clearError('phone');

    // 60 秒倒计时（与 PC 端一致）
    var btn = this;
    var n = 60;
    btn.disabled = true;
    btn.textContent = n + 's 后重发';
    codeTimer = setInterval(function () {
      n--;
      if (n <= 0) {
        clearInterval(codeTimer);
        codeTimer = null;
        btn.disabled = false;
        btn.textContent = '获取验证码';
      } else {
        btn.textContent = n + 's 后重发';
      }
    }, 1000);

    // 演示环境：固定验证码 123456（真实环境由后端短信下发）
    Util.toast('验证码已发送（演示验证码：123456）');
  });

  /* ---------------- 输入时实时清错 / 一致性校验 ---------------- */
  $('#f-phone').addEventListener('input', function () { clearError('phone'); });
  $('#f-code').addEventListener('input', function () { clearError('code'); });
  $('#f-newpwd').addEventListener('input', function () {
    clearError('newpwd');
    checkConfirmMatch();
  });
  $('#f-newpwd').addEventListener('blur', function () {
    var v = this.value;
    if (v && (v.length < 6 || v.length > 20)) setError('newpwd', '密码长度需为6-20位');
  });
  $('#f-confirmpwd').addEventListener('input', function () {
    clearError('confirmpwd');
    checkConfirmMatch();
  });

  function checkConfirmMatch() {
    var np = $('#f-newpwd').value;
    var cp = $('#f-confirmpwd').value;
    if (cp && np !== cp) setError('confirmpwd', '两次输入的密码不一致');
    else clearError('confirmpwd');
  }

  /* ---------------- 提交 ---------------- */
  $('#btn-submit').addEventListener('click', function () {
    var phone = $('#f-phone').value.trim();
    var code = $('#f-code').value.trim();
    var newpwd = $('#f-newpwd').value;
    var confirmpwd = $('#f-confirmpwd').value;
    var ok = true;

    if (!phone) { setError('phone', '请输入手机号'); ok = false; }
    else if (!PHONE_RE.test(phone)) { setError('phone', '请输入正确的11位手机号'); ok = false; }

    if (!code) { setError('code', '请输入验证码'); ok = false; }

    if (!newpwd) { setError('newpwd', '请设置新密码'); ok = false; }
    else if (newpwd.length < 6 || newpwd.length > 20) { setError('newpwd', '密码长度需为6-20位'); ok = false; }

    if (!confirmpwd) { setError('confirmpwd', '请再次输入新密码'); ok = false; }
    else if (newpwd !== confirmpwd) { setError('confirmpwd', '两次输入的密码不一致'); ok = false; }

    if (!ok) return;

    var btn = this;
    btn.disabled = true;
    btn.textContent = '提交中...';

    API.resetPassword({ phone: phone, code: code, newPassword: newpwd })
      .then(function () { showSuccess(); })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = '确认重置';
        Util.toast(err.message);
      });
  });

  /* ---------------- 成功弹窗：3 秒倒计时后返回登录 ---------------- */
  var goTimer = null;
  function showSuccess() {
    document.querySelector('#dialog-success').classList.add('show');
    var n = 3;
    $('#cd-num').textContent = n;
    goTimer = setInterval(function () {
      n--;
      $('#cd-num').textContent = n;
      if (n <= 0) goLogin();
    }, 1000);
  }

  function goLogin() {
    if (goTimer) { clearInterval(goTimer); goTimer = null; }
    location.replace('登录.html');
  }

  $('#btn-go-login').addEventListener('click', goLogin);
})();
