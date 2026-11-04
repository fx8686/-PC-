/* ============================================================
 * 缴费订单页逻辑
 * 功能：订单列表 / 状态筛选 / 订单详情 /
 *       聚合二维码支付（微信、支付宝） / 支付状态查询（自动轮询 + 手动查询）
 * 说明：
 *   - 缴费成功后同步报名档案 paid 状态，解锁对应工种课程
 *   - 支付二维码由 Util.drawMockQR 生成，仅用于原型演示；
 *     真实环境应由后端下单接口返回二维码图片或支付链接
 * ============================================================ */
(function () {
  'use strict';

  if (!Util.requireAuth()) return;

  var $ = Util.$, $$ = Util.$$;

  var orders = [];
  var filterStatus = '';
  var currentOrder = null;      // 当前正在支付的订单
  var currentArchiveId = null;
  var currentChannel = 'wechat'; // wechat | alipay
  var pollTimer = null;
  var detailOrderNo = null;
  // 发票流程
  var pendingInvoice = null;
  var currentInvArchiveId = null;

  var STATUS = {
    unpaid: { cls: 'tag-wait', text: '待支付' },
    paid:   { cls: 'tag-done', text: '已支付' }
  };

  var CHANNEL_UI = {
    wechat: { logo: '微', cls: 'wechat', hint: '请使用微信扫一扫，扫描上方二维码完成支付' },
    alipay: { logo: '支', cls: 'alipay', hint: '请使用支付宝扫一扫，扫描上方二维码完成支付' }
  };

  /* ---------------- 订单列表 ---------------- */
  function render() {
    var list = orders.filter(function (o) {
      return !filterStatus || o.status === filterStatus;
    });
    var box = $('#order-list');

    if (!list.length) {
      box.innerHTML = '<div class="empty-card"><span class="ico">💰</span>' +
        (orders.length ? '暂无符合条件的缴费订单' : '暂无缴费订单，报名审核通过后将自动生成') + '</div>';
      return;
    }

    box.innerHTML = list.map(function (o) {
      var st = STATUS[o.status];
      var payBtn = o.status === 'unpaid'
        ? '<button class="btn btn-primary btn-sm" data-pay="' + o.archiveId + '">去缴费</button>'
        : '';
      var invTxt = o.invoice ? (o.invoice.type === 'personal' ? '个人发票' : '企业发票') : '—';
      return '<section class="card order-card">' +
        '<div class="card-head">' +
          '<div>' +
            '<div class="order-no">' + Util.escapeHtml(o.orderNo) + '</div>' +
            '<div class="order-sub">' + Util.escapeHtml(o.workType) + ' · 证书编号 ' + Util.escapeHtml(o.certNo) + '</div>' +
          '</div>' +
          '<span class="tag ' + st.cls + '">' + st.text + '</span>' +
        '</div>' +
        '<div class="kv"><span class="k">创建时间</span><span class="v">' + Util.escapeHtml(o.createTime) + '</span></div>' +
        '<div class="kv"><span class="k">支付时间</span><span class="v">' + Util.escapeHtml(o.payTime || '—') + '</span></div>' +
        '<div class="kv"><span class="k">发票类型</span><span class="v">' + Util.escapeHtml(invTxt) + '</span></div>' +
        '<div class="kv"><span class="k">订单金额</span><span class="v order-amount"><span class="rmb">￥</span>' + o.amount + '</span></div>' +
        '<div class="card-actions">' +
          '<button class="btn btn-ghost btn-sm" data-detail="' + o.orderNo + '">查看详情</button>' +
          payBtn +
        '</div>' +
      '</section>';
    }).join('');
  }

  function loadOrders() {
    return API.getOrders().then(function (list) {
      orders = list;
      render();
    }).catch(function (err) { Util.toast(err.message); });
  }

  /* ---------------- 支付弹层 ---------------- */
  function updateChannelUI() {
    var cfg = CHANNEL_UI[currentChannel];
    $$('#pay-channels .channel').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.channel === currentChannel);
    });
    var center = $('#qr-center');
    center.className = 'qr-center ' + cfg.cls;
    center.textContent = cfg.logo;
    $('#pay-hint').textContent = cfg.hint;
  }

  function resetPayUI() {
    $('#pay-main').classList.remove('hide');
    $('#pay-success').classList.add('hide');
    $('#pay-foot').classList.remove('hide');
    $('#pay-foot-success').classList.add('hide');
    $('#pay-status-text').textContent = '等待支付...';
  }

  function openPay(archiveId) {
    var order = orders.filter(function (o) { return o.archiveId === archiveId; })[0];
    if (!order) { Util.toast('未找到对应的缴费订单'); return; }
    if (order.status === 'paid') { Util.toast('该订单已完成缴费，无需重复支付'); return; }

    currentArchiveId = archiveId;
    // 先打开发票填写
    openInvoiceSheet(archiveId);
  }

  /* ---------------- 发票填写弹层 ---------------- */
  function openInvoiceSheet(archiveId) {
    var order = orders.filter(function (o) { return o.archiveId === archiveId; })[0];
    if (!order) return;
    currentInvArchiveId = archiveId;
    pendingInvoice = null;
    $('#inv-work').textContent = order.workType || '-';
    $('#inv-cert').textContent = order.certNo || '-';
    switchInvType('personal', true);
    Util.openSheet('sheet-invoice');
  }

  function resetInvFormErrors(container) {
    container.querySelectorAll('input').forEach(function (i) {
      i.classList.remove('err');
      var es = i.parentElement.querySelector('.err-msg');
      if (es) es.textContent = '';
    });
  }

  function setInvErr(input, msg) {
    input.classList.add('err');
    var es = input.parentElement.querySelector('.err-msg');
    if (es) es.textContent = msg;
  }

  function switchInvType(type, reset) {
    var pers = $('#inv-personal'), ent = $('#inv-enterprise');
    if (type === 'personal') {
      pers.classList.remove('hidden'); ent.classList.add('hidden');
      (reset ? pers : ent).querySelectorAll('input').forEach(function (i) {
        if (reset) { i.value = ''; i.classList.remove('err'); var es = i.parentElement.querySelector('.err-msg'); if (es) es.textContent = ''; }
        else { i.value = ''; }
      });
    } else {
      ent.classList.remove('hidden'); pers.classList.add('hidden');
      (reset ? ent : pers).querySelectorAll('input').forEach(function (i) {
        if (reset) { i.value = ''; i.classList.remove('err'); var es = i.parentElement.querySelector('.err-msg'); if (es) es.textContent = ''; }
        else { i.value = ''; }
      });
    }
  }

  function validateAndCollectInvoice() {
    var type = document.querySelector('input[name="invType"]:checked').value;
    var form = type === 'personal' ? $('#inv-personal') : $('#inv-enterprise');
    resetInvFormErrors(form);
    function inputBy(field) { return form.querySelector('input[data-field="' + field + '"]'); }

    var data = { type: type };
    if (type === 'personal') {
      var name = inputBy('p.name'), idCard = inputBy('p.idCard'), email = inputBy('p.email'), phone = inputBy('p.phone');
      if (!name.value.trim()) { setInvErr(name, '请输入姓名'); return null; }
      if (!idCard.value.trim()) { setInvErr(idCard, '请输入身份证号'); return null; }
      if (!/^\d{17}[\dXx]$/.test(idCard.value.trim())) { setInvErr(idCard, '身份证号格式错误（应为 18 位）'); return null; }
      if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setInvErr(email, '邮箱格式错误'); return null; }
      if (!phone.value.trim()) { setInvErr(phone, '请输入手机号'); return null; }
      if (!/^1\d{10}$/.test(phone.value.trim())) { setInvErr(phone, '手机号格式错误（应为 11 位）'); return null; }
      data.name = name.value.trim();
      data.idCard = idCard.value.trim().toUpperCase();
      data.email = email.value.trim();
      data.phone = phone.value.trim();
    } else {
      var coName = inputBy('e.companyName'), taxNo = inputBy('e.taxNo'), addr = inputBy('e.address');
      var tel = inputBy('e.phone'), bank = inputBy('e.bankAccount');
      var cName = inputBy('e.contactName'), cPhone = inputBy('e.contactPhone'), email2 = inputBy('e.email');
      if (!coName.value.trim()) { setInvErr(coName, '请输入企业名称'); return null; }
      if (!taxNo.value.trim()) { setInvErr(taxNo, '请输入纳税人识别号'); return null; }
      if (!/^[0-9A-Za-z]{15,18}$/.test(taxNo.value.trim())) { setInvErr(taxNo, '统一社会信用代码格式错误'); return null; }
      if (!addr.value.trim()) { setInvErr(addr, '请输入企业地址'); return null; }
      if (!tel.value.trim()) { setInvErr(tel, '请输入企业电话'); return null; }
      if (!bank.value.trim()) { setInvErr(bank, '请输入开户行及账号'); return null; }
      if (!cName.value.trim()) { setInvErr(cName, '请输入联系人姓名'); return null; }
      if (!cPhone.value.trim()) { setInvErr(cPhone, '请输入联系人电话'); return null; }
      if (!/^1\d{10}$/.test(cPhone.value.trim())) { setInvErr(cPhone, '联系人手机号格式错误'); return null; }
      if (!email2.value.trim()) { setInvErr(email2, '请输入接收邮箱'); return null; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2.value.trim())) { setInvErr(email2, '邮箱格式错误'); return null; }
      data.companyName = coName.value.trim();
      data.taxNo = taxNo.value.trim().toUpperCase();
      data.address = addr.value.trim();
      data.phone = tel.value.trim();
      data.bankAccount = bank.value.trim();
      data.contactName = cName.value.trim();
      data.contactPhone = cPhone.value.trim();
      data.email = email2.value.trim();
    }
    return data;
  }

  function invoiceNextStep() {
    var data = validateAndCollectInvoice();
    if (!data) { Util.toast('请检查红色提示项'); return; }
    pendingInvoice = data;
    var archiveId = currentInvArchiveId || currentArchiveId;
    Util.closeSheet('sheet-invoice');
    // 走原支付弹层流程
    API.createPaymentOrder({ archiveId: archiveId, channel: currentChannel })
      .then(function (payOrder) {
        currentOrder = payOrder;
        resetPayUI();
        var order = orders.filter(function (o) { return o.archiveId === archiveId; })[0] || {};
        $('#pay-amount').textContent = payOrder.amount;
        $('#pay-sub').textContent = (order.workType || '') + ' · 证书编号 ' + (order.certNo || '—');
        updateChannelUI();
        Util.drawMockQR($('#pay-qr'), payOrder.qrText || payOrder.orderNo);
        Util.openSheet('sheet-pay');
        startPoll();
      })
      .catch(function (err) { Util.toast(err.message); });
  }

  /* ---------------- 支付状态轮询 ---------------- */
  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function () { checkStatus(false); }, 3000);
  }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function checkStatus(manual) {
    if (!currentOrder) return;
    API.queryPaymentStatus(currentOrder.orderNo).then(function (res) {
      if (res.status === 'paid') {
        showPaid(res);
      } else if (manual) {
        Util.toast('暂未查询到支付结果，请扫码完成支付后重试');
      }
    }).catch(function (err) {
      if (manual) Util.toast(err.message);
    });
  }

  function showPaid(res) {
    stopPoll();
    // 把发票数据同步到对应报名档案
    if (pendingInvoice && currentOrder) {
      var archives = MOCK.getArchives();
      var idx = archives.map(function (a) { return a.id; }).indexOf(currentOrder.archiveId);
      if (idx >= 0) {
        archives[idx].invoice = pendingInvoice;
        MOCK.saveArchives(archives);
      }
    }
    pendingInvoice = null;

    $('#pay-main').classList.add('hide');
    $('#pay-success').classList.remove('hide');
    $('#pay-foot').classList.add('hide');
    $('#pay-foot-success').classList.remove('hide');
    $('#success-text').innerHTML =
      '订单号：' + Util.escapeHtml(currentOrder.orderNo) + '<br>' +
      '支付金额：￥' + currentOrder.amount + '<br>' +
      '支付时间：' + Util.escapeHtml(res.payTime || Util.nowText());
    Util.toast('支付成功，已解锁该工种课程学习');
    loadOrders();
  }

  /* ---------------- 订单详情 ---------------- */
  function openDetail(orderNo) {
    var o = orders.filter(function (x) { return x.orderNo === orderNo; })[0];
    if (!o) return;
    detailOrderNo = orderNo;
    var st = STATUS[o.status];
    var html = '';
    // 订单基础
    html += '<div style="font-size:14px;font-weight:600;color:var(--text);padding-bottom:6px;margin-bottom:8px;border-bottom:1px solid #f0f0f0;">订单基础信息</div>';
    html += '<div class="detail-row"><span class="k">订单号</span><span class="v">' + Util.escapeHtml(o.orderNo) + '</span></div>';
    html += '<div class="detail-row"><span class="k">对应工种</span><span class="v">' + Util.escapeHtml(o.workType) + '</span></div>';
    html += '<div class="detail-row"><span class="k">证书编号</span><span class="v">' + Util.escapeHtml(o.certNo) + '</span></div>';
    html += '<div class="detail-row"><span class="k">订单金额</span><span class="v amount">￥' + o.amount + '</span></div>';
    html += '<div class="detail-row"><span class="k">订单状态</span><span class="v"><span class="tag ' + st.cls + '">' + st.text + '</span></span></div>';
    html += '<div class="detail-row"><span class="k">创建时间</span><span class="v">' + Util.escapeHtml(o.createTime) + '</span></div>';
    html += '<div class="detail-row"><span class="k">支付时间</span><span class="v">' + Util.escapeHtml(o.payTime || '—') + '</span></div>';
    // 发票分区
    html += '<div style="font-size:14px;font-weight:600;color:var(--text);padding:12px 0 6px;margin-top:8px;border-top:1px dashed #e8e8e8;margin-bottom:8px;">发票信息</div>';
    if (!o.invoice) {
      html += '<div class="detail-row"><span class="k">发票类型</span><span class="v" style="color:#bfbfbf;">未填写</span></div>';
    } else if (o.invoice.type === 'personal') {
      var inv = o.invoice;
      html += '<div class="detail-row"><span class="k">发票类型</span><span class="v">个人发票</span></div>';
      html += '<div class="detail-row"><span class="k">姓名</span><span class="v">' + Util.escapeHtml(inv.name || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">身份证号</span><span class="v">' + Util.escapeHtml(inv.idCard || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">手机号</span><span class="v">' + Util.escapeHtml(inv.phone || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">电子发票接收邮箱</span><span class="v">' + Util.escapeHtml(inv.email || '未填写') + '</span></div>';
    } else {
      var inv2 = o.invoice;
      html += '<div class="detail-row"><span class="k">发票类型</span><span class="v">企业发票</span></div>';
      html += '<div class="detail-row"><span class="k">企业名称</span><span class="v">' + Util.escapeHtml(inv2.companyName || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">纳税人识别号</span><span class="v">' + Util.escapeHtml(inv2.taxNo || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">地址</span><span class="v">' + Util.escapeHtml(inv2.address || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">电话</span><span class="v">' + Util.escapeHtml(inv2.phone || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">开户行及账号</span><span class="v">' + Util.escapeHtml(inv2.bankAccount || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">联系人姓名</span><span class="v">' + Util.escapeHtml(inv2.contactName || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">联系人电话</span><span class="v">' + Util.escapeHtml(inv2.contactPhone || '—') + '</span></div>';
      html += '<div class="detail-row"><span class="k">电子发票接收邮箱</span><span class="v">' + Util.escapeHtml(inv2.email || '—') + '</span></div>';
    }
    $('#detail-body').innerHTML = html;
    $('#btn-detail-pay').classList.toggle('hide', o.status === 'paid');
    Util.openSheet('sheet-detail');
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#order-list').addEventListener('click', function (e) {
    var payBtn = e.target.closest('[data-pay]');
    var detailBtn = e.target.closest('[data-detail]');
    if (payBtn) openPay(payBtn.dataset.pay);
    else if (detailBtn) openDetail(detailBtn.dataset.detail);
  });

  $('#order-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-status]');
    if (!chip) return;
    filterStatus = chip.dataset.status;
    $$('#order-chips .chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
    render();
  });

  $('#pay-channels').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-channel]');
    if (!btn) return;
    currentChannel = btn.dataset.channel;
    updateChannelUI();
  });

  $('#btn-query').addEventListener('click', function () { checkStatus(true); });

  $('#btn-detail-pay').addEventListener('click', function () {
    var o = orders.filter(function (x) { return x.orderNo === detailOrderNo; })[0];
    Util.closeSheet('sheet-detail');
    if (o) openPay(o.archiveId);
  });

  /* 发票弹层事件 */
  document.querySelectorAll('#sheet-invoice input[name="invType"]').forEach(function (rb) {
    rb.addEventListener('change', function () {
      switchInvType(rb.value, false); // 切换时清空另一表单，不清空当前（保留已填内容）
    });
  });
  $('#btn-invoice-next').addEventListener('click', invoiceNextStep);

  // 关闭支付弹层时停止轮询
  $$('[data-close="sheet-pay"]').forEach(function (btn) {
    btn.addEventListener('click', stopPoll);
  });
  $('#sheet-pay').addEventListener('click', function (e) {
    if (e.target.id === 'sheet-pay') stopPoll();
  });

  /* ---------------- 弹层 & 退出 ---------------- */
  $$('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { Util.closeSheet(btn.dataset.close); });
  });
  Util.bindMask('sheet-pay');
  Util.bindMask('sheet-detail');
  $('#btn-logout').addEventListener('click', Util.logout);

  /* ---------------- 初始化 ---------------- */
  var payId = new URLSearchParams(location.search).get('pay');

  loadOrders().then(function () {
    // 从「我的课程」点击立即缴费带参进入时，自动打开支付弹层
    if (payId) openPay(payId);
  });
})();
