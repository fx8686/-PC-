/* ============================================================
 * 登录 / 注册页逻辑
 * 校验规则与 PC 端保持一致：
 *   身份证 15/18 位、手机号 1[3-9] 开头 11 位、密码 6-20 位、两次密码一致
 * ============================================================ */
(function () {
  'use strict';

  var $ = Util.$, $$ = Util.$$;
  var genderValue = '';       // 注册时选择的性别
  var afterTip = null;        // 弹窗关闭后的回调

  /* ---------------- 错误提示 ---------------- */
  function fieldEl(id) { return document.getElementById('f-' + id); }

  function setErr(id, msg) {
    var f = fieldEl(id);
    if (!f) return;
    f.classList.add('error');
    var e = f.querySelector('.err');
    if (e) e.textContent = msg;
  }

  function clearErr(id) {
    var f = fieldEl(id);
    if (f) f.classList.remove('error');
  }

  // 输入时自动清除对应错误
  $$('#form-login .input, #form-register .input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      var f = inp.closest('.field');
      if (f) f.classList.remove('error');
    });
  });

  /* ---------------- 登录 / 注册 切换 ---------------- */
  $$('.auth-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.auth-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var isLogin = tab.dataset.tab === 'login';
      $('#form-login').classList.toggle('hide', !isLogin);
      $('#form-register').classList.toggle('hide', isLogin);
    });
  });

  function switchToLogin() {
    $$('.auth-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === 'login');
    });
    $('#form-login').classList.remove('hide');
    $('#form-register').classList.add('hide');
  }

  /* ---------------- 密码显隐 ---------------- */
  function bindToggle(btnId, inputId) {
    var btn = document.getElementById(btnId);
    var input = document.getElementById(inputId);
    btn.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? '隐藏' : '显示';
    });
  }
  bindToggle('toggle-pwd', 'password');
  bindToggle('toggle-r-pwd', 'r-pwd');

  /* ---------------- 性别选择 ---------------- */
  $$('#r-gender .radio-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      $$('#r-gender .radio-chip').forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      genderValue = chip.dataset.value;
      clearErr('r-gender');
    });
  });

  /* ---------------- 协议勾选控制按钮 ---------------- */
  $('#agree-login').addEventListener('change', function (e) {
    $('#btn-login').disabled = !e.target.checked;
  });
  $('#agree-reg').addEventListener('change', function (e) {
    $('#btn-register').disabled = !e.target.checked;
  });

  /* ---------------- 轻提示弹窗 ---------------- */
  function showTip(title, msg, isSuccess, after) {
    $('#tip-title').textContent = title;
    $('#tip-text').textContent = msg;
    var icon = $('#tip-icon');
    icon.className = 'dialog-icon' + (isSuccess ? ' success' : '');
    icon.textContent = isSuccess ? '✓' : '!';
    afterTip = after || null;
    Util.openSheet('mask-tip');
  }

  function closeTip(runAfter) {
    Util.closeSheet('mask-tip');
    if (runAfter && afterTip) {
      var fn = afterTip;
      afterTip = null;
      fn();
    }
  }

  $('#tip-ok').addEventListener('click', function () { closeTip(true); });
  $('#mask-tip').addEventListener('click', function (e) {
    if (e.target.id === 'mask-tip') closeTip(true);
  });

  /* ---------------- 按钮加载态 ---------------- */
  function setLoading(btn, loading, text) {
    if (loading) {
      btn.dataset.text = btn.textContent;
      btn.textContent = text || '处理中...';
      btn.disabled = true;
    } else {
      btn.textContent = btn.dataset.text || btn.textContent;
      btn.disabled = false;
    }
  }

  /* ---------------- 登录 ---------------- */
  $('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var account = $('#account').value.trim();
    var password = $('#password').value.trim();
    var ok = true;

    if (!account) { setErr('account', '请输入账号'); ok = false; }
    if (!password) { setErr('password', '请输入密码'); ok = false; }
    if (!ok) return;

    var btn = $('#btn-login');
    setLoading(btn, true, '登录中...');

    API.login({ account: account, password: password })
      .then(function (user) {
        Util.set('h5_user', user);         // 保存登录态，供后续页面读取
        location.replace('我的课程.html');  // 与 PC 端一致：登录后进入「我的课程」
      })
      .catch(function (err) {
        setLoading(btn, false);
        btn.disabled = !$('#agree-login').checked;
        showTip('登录失败', err.message, false);
      });
  });

  /* ---------------- 注册 ---------------- */
  $('#form-register').addEventListener('submit', function (e) {
    e.preventDefault();

    var name = $('#r-name').value.trim();
    var idCard = $('#r-idcard').value.trim();
    var phone = $('#r-phone').value.trim();
    var account = $('#r-account').value.trim();
    var pwd = $('#r-pwd').value;
    var pwd2 = $('#r-pwd2').value;
    var ok = true;

    if (!name) { setErr('r-name', '请填写真实姓名'); ok = false; }
    if (!genderValue) { setErr('r-gender', '请选择性别'); ok = false; }

    if (!idCard) { setErr('r-idcard', '请输入身份证号'); ok = false; }
    else if (!Util.isIdCard(idCard)) { setErr('r-idcard', '身份证号格式不正确'); ok = false; }

    if (!phone) { setErr('r-phone', '请输入手机号'); ok = false; }
    else if (!Util.isPhone(phone)) { setErr('r-phone', '请输入正确的11位手机号'); ok = false; }

    if (!account) { setErr('r-account', '请设置登录账号'); ok = false; }

    if (!pwd) { setErr('r-pwd', '请设置密码'); ok = false; }
    else if (pwd.length < 6 || pwd.length > 20) { setErr('r-pwd', '密码长度需为6-20位'); ok = false; }

    if (!pwd2) { setErr('r-pwd2', '请再次输入密码'); ok = false; }
    else if (pwd !== pwd2) { setErr('r-pwd2', '两次输入的密码不一致'); ok = false; }

    if (!ok) return;

    var btn = $('#btn-register');
    setLoading(btn, true, '提交中...');

    API.register({
      name: name, gender: genderValue, idCard: idCard,
      phone: phone, account: account, password: pwd
    }).then(function () {
      setLoading(btn, false);
      btn.disabled = !$('#agree-reg').checked;
      showTip('注册成功', '注册成功，请使用账号密码登录系统', true, function () {
        switchToLogin();
        $('#account').value = account;
        $('#password').value = '';
        $('#f-account').classList.remove('error');
      });
    }).catch(function (err) {
      setLoading(btn, false);
      btn.disabled = !$('#agree-reg').checked;
      if (/已被注册/.test(err.message)) setErr('r-account', err.message);
      showTip('注册失败', err.message, false);
    });
  });

  /* ---------------- 实时校验：两次密码一致 ---------------- */
  $('#r-pwd2').addEventListener('input', function () {
    var p = $('#r-pwd').value;
    var p2 = $('#r-pwd2').value;
    if (p2 && p !== p2) { setErr('r-pwd2', '两次输入的密码不一致'); }
    else { clearErr('r-pwd2'); }
  });

  /* ---------------- 手机号仅允许数字 ---------------- */
  $('#r-phone').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '');
  });

  /* ---------------- 已登录用户进入登录页时，自动填充账号 ---------------- */
  var cur = Util.currentUser();
  if (cur) $('#account').value = cur.account || '';
})();
