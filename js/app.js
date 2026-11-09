/* Gia phả họ Nguyễn Duy – app chính */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var L = window.Lunar;
  var HO = CFG.tenHo || 'Gia phả';
  var MODE = (CFG.supabaseUrl && CFG.supabaseAnonKey) ? 'live' : 'demo';

  /* ---------------- tiện ích ---------------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); }
  function low(s) { return String(s || '').normalize('NFC').toLowerCase().trim(); }
  function given(n) { var w = String(n || '').trim().split(/\s+/); return w[w.length - 1] || ''; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function toast(msg) { document.querySelectorAll('.toast').forEach(function (x) { x.remove(); }); var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
  function ago(iso) { var s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'vừa xong'; if (s < 3600) return Math.floor(s / 60) + ' phút trước'; if (s < 86400) return Math.floor(s / 3600) + ' giờ trước'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' ngày trước'; var d = new Date(iso); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }
  function newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  /* ---------------- trạng thái ---------------- */
  var DATA = null, UPDATED = null, CODE = ls('gp-ma'), ADMIN = ss('gp-qt');
  var counts = {}, recent = [], personMsgs = {}, collapsed = {}, query = '', editing = null, delArm = false;
  var photoCache = {}, album = { items: null, filter: '', more: false }, personPhotos = {}, demoPhotos = [];
  var ALBUMS = ['Nhà thờ họ', 'Giỗ chạp – Tết', 'Họp họ', 'Ảnh xưa', 'Mộ phần', 'Khác'];
  var nameState = { ho: 'Nguyễn', dem: 'Duy', ten: '', g: 'm', par: '' };
  var vkState = { dip: 'gio', id: '', xung: 'cụ', tinchu: ls('gp-tinchu') || '', diachi: ls('gp-diachi') || '', lg: false };
  var calMonthly = ls('gp-monthly') !== '0', calRemind = +(ls('gp-remind') || 7);
  var installEvt = null, pushOn = false;

  /* ---------------- dữ liệu (Supabase hoặc chế độ thử) ---------------- */
  function rpc(fn, args) {
    return fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: Object.assign({ apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json' }, /^eyJ/.test(CFG.supabaseAnonKey) ? { Authorization: 'Bearer ' + CFG.supabaseAnonKey } : {}),
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var e = new Error((j && j.message) || t || ('Lỗi ' + r.status)); e.code = (j && j.message) || ''; throw e; }
        return j;
      });
    });
  }
  function demoIncense() { try { return JSON.parse(ls('gp-demo-huong') || '[]'); } catch (e) { return []; } }
  var store = {
    load: function () {
      if (MODE === 'demo') {
        var s = ls('gp-demo'); DATA = s ? JSON.parse(s) : JSON.parse(JSON.stringify(window.DEMO_DATA || { people: [], events: [] }));
        UPDATED = null; return Promise.resolve();
      }
      return rpc('get_family', { p_code: CODE }).then(function (r) { DATA = r.data || {}; UPDATED = r.updated_at; DATA.people = DATA.people || []; DATA.events = DATA.events || []; });
    },
    save: function () {
      if (MODE === 'demo') { ls('gp-demo', JSON.stringify(DATA)); return Promise.resolve(); }
      return rpc('save_family', { p_admin: ADMIN, p_data: DATA, p_base: UPDATED }).then(function (r) { UPDATED = r; });
    },
    checkAdmin: function (c) { if (MODE === 'demo') return Promise.resolve(c === 'demo'); return rpc('check_admin', { p_admin: c }); },
    light: function (pid, name, msg) {
      if (MODE === 'demo') { var a = demoIncense(); a.unshift({ id: Date.now(), person_id: pid, name: name, message: msg, created_at: new Date().toISOString() }); ls('gp-demo-huong', JSON.stringify(a.slice(0, 300))); return Promise.resolve(); }
      return rpc('light_incense', { p_code: CODE, p_person: pid, p_name: name, p_msg: msg });
    },
    list: function (pid) {
      if (MODE === 'demo') return Promise.resolve(demoIncense().filter(function (x) { return !pid || x.person_id === pid; }).slice(0, 50));
      return rpc('list_incense', { p_code: CODE, p_person: pid || null, p_limit: 50 });
    },
    counts: function () {
      if (MODE === 'demo') { var c = {}; demoIncense().forEach(function (x) { c[x.person_id] = (c[x.person_id] || 0) + 1; }); return Promise.resolve(c); }
      return rpc('incense_counts', { p_code: CODE });
    },
    photos: function (o) {
      o = o || {};
      if (MODE === 'demo') return Promise.resolve(demoPhotos.filter(function (x) { return (!o.person || x.person_id === o.person) && (!o.album || x.album === o.album) && (!o.before || x.id < o.before); }).slice(0, 60));
      return rpc('list_photos', { p_code: CODE, p_person: o.person || null, p_album: o.album || null, p_limit: 60, p_before: o.before || null });
    },
    photo: function (id) {
      if (MODE === 'demo') { var f = demoPhotos.filter(function (x) { return x.id === id; })[0]; return Promise.resolve(f ? f.full : null); }
      return rpc('get_photo', { p_code: CODE, p_id: id });
    },
    upload: function (o) {
      if (MODE === 'demo') { var id = Date.now() + Math.floor(Math.random() * 1000); demoPhotos.unshift({ id: id, person_id: o.person || null, album: o.album || null, caption: o.caption || null, uploader: o.uploader || null, thumb: o.thumb, full: o.full, created_at: new Date().toISOString() }); return Promise.resolve(id); }
      return rpc('upload_photo', { p_code: CODE, p_person: o.person || null, p_album: o.album || null, p_caption: o.caption || null, p_uploader: o.uploader || null, p_thumb: o.thumb, p_full: o.full });
    },
    delPhoto: function (id) {
      if (MODE === 'demo') { demoPhotos = demoPhotos.filter(function (x) { return x.id !== id; }); return Promise.resolve(); }
      return rpc('delete_photo', { p_admin: ADMIN, p_id: id });
    },
    delIncense: function (id) {
      if (MODE === 'demo') { ls('gp-demo-huong', JSON.stringify(demoIncense().filter(function (x) { return x.id !== id; }))); return Promise.resolve(); }
      return rpc('delete_incense', { p_admin: ADMIN, p_id: id });
    }
  };

  /* ---------------- chỉ mục cây ---------------- */
  var byId = {}, kids = {}, depth = {}, order = [], roots = [];
  function reindex() {
    byId = {}; kids = {}; depth = {}; order = [];
    DATA.people.forEach(function (p) { byId[p.id] = p; kids[p.id] = []; });
    DATA.people.forEach(function (p) { if (p.p && byId[p.p]) kids[p.p].push(p); });
    roots = DATA.people.filter(function (p) { return !p.p || !byId[p.p]; });
    (function walkAll() { function w(p, d) { depth[p.id] = d; order.push(p); kids[p.id].forEach(function (c) { w(c, d + 1); }); } roots.forEach(function (r) { w(r, 0); }); })();
  }
  function isDead(p) { return !!(p.dead || p.d || p.ls); }
  function years(p) { return L.yearsOf(p); }
  function descendants(id) { var out = {}; (function r(i) { (kids[i] || []).forEach(function (c) { out[c.id] = 1; r(c.id); }); })(id); return out; }
  function role(p) { if (p.ph || depth[p.id] === 0) return ''; return p.g === 'f' ? 'con gái' : 'con trai'; }

  /* ---------------- điều hướng ---------------- */
  function route() { var h = location.hash.replace('#', ''); if (!h) return { v: 'trang-chu' }; if (h.indexOf('nguoi-') === 0) return { v: 'nguoi', id: h.slice(6) }; return { v: h }; }
  function go(h) { location.hash = h; }
  var NAV = [['trang-chu', '⌂', 'Hôm nay'], ['gia-pha', '❦', 'Gia phả'], ['lich', '☾', 'Lịch giỗ'], ['ky-niem', '▣', 'Kỷ niệm'], ['them', '☰', 'Thêm']];

  function render() {
    var app = document.getElementById('app');
    if (MODE === 'live' && !DATA) { app.innerHTML = gateHtml(); return; }
    reindex();
    var r = route(), v = r.v, body;
    if (v === 'gia-pha') body = viewTree();
    else if (v === 'nguoi') body = viewPerson(r.id);
    else if (v === 'lich') body = viewCal();
    else if (v === 'van-khan') body = viewVK();
    else if (v === 'dat-ten') body = viewName();
    else if (v === 'them') body = viewMore();
    else if (v === 'ky-niem') body = viewAlbum();
    else { v = 'trang-chu'; body = viewHome(); }
    var p = L.todayVN(), l = L.solar2lunar(p[0], p[1], p[2]);
    var navOn = v === 'nguoi' ? 'gia-pha' : (v === 'dat-ten' || v === 'van-khan') ? 'them' : v;
    app.innerHTML = (MODE === 'demo' ? '<div class="demo">Bản xem thử – thay đổi chỉ lưu trên máy này' + (ADMIN ? '' : ' · mã quản trị thử: <b>demo</b>') + '</div>' : '') +
      '<header class="top"><h1>Gia phả ' + esc(HO.replace(/^Họ /, 'họ ')) + '</h1><div class="sub">' + L.weekday(L.jdTodayVN()) + ', ' + p[0] + '/' + p[1] + '/' + p[2] + ' · ' + l[0] + '/' + l[1] + (l[3] ? ' nhuận' : '') + ' âm lịch, năm ' + L.canchi(l[2]) + '</div></header>' +
      '<main class="wrap">' + body + '</main>' +
      '<nav class="nav">' + NAV.map(function (n) { return '<a href="#' + n[0] + '" class="' + (navOn === n[0] ? 'on' : '') + '"><span class="ic" aria-hidden="true">' + n[1] + '</span>' + n[2] + '</a>'; }).join('') + '</nav>' +
      (editing ? viewEditor() : '');
    hydrate();
  }

  /* ---------------- cổng vào ---------------- */
  function gateHtml(err) {
    return '<div class="gate"><div class="card" style="text-align:center"><div class="seal">族</div><h2 style="margin:0 0 4px">Gia phả ' + esc(HO.replace(/^Họ /, 'họ ')) + '</h2><p class="note" style="margin:0 0 14px">Trang dành riêng cho con cháu trong họ. Nhập mã của họ để vào.</p>' +
      '<form id="gateForm"><input id="gateCode" autocomplete="off" placeholder="Mã của họ" style="text-align:center;font-size:17px"><p class="err" id="gateErr">' + esc(err || '') + '</p><button class="pri block" type="submit">Vào gia phả</button></form><p class="note" style="margin-top:12px">Chưa có mã? Hỏi người quản lý gia phả trong họ.</p></div></div>';
  }

  /* ---------------- trang chủ ---------------- */
  function upcomingHtml(list, t) {
    return list.map(function (e) {
      var s = L.jdToDate(e.jd), d = e.jd - t, on = d <= calRemind && e.kind !== 'thang';
      var link = e.kind === 'gio' ? ' href="#nguoi-' + e.id + '"' : '';
      return '<div class="ev' + (on ? ' soon' : '') + '"><div class="dt"><b>' + s[0] + '</b><span>th ' + s[1] + '/' + String(s[2]).slice(2) + '</span></div><div style="flex:1;min-width:0"><div class="t">' + (link ? '<a' + link + ' style="color:inherit;text-decoration:none">' + esc(e.title) + '</a>' : esc(e.title)) + '</div><div class="m">' + L.weekday(e.jd) + ' ' + L.fmt(e.jd) + ' · ' + esc(e.sub) + '</div>' + (on ? '<div class="cd">' + (d === 0 ? 'Hôm nay' : 'Còn ' + d + ' ngày') + '</div>' : '') + '</div></div>';
    }).join('');
  }
  function viewHome() {
    var t = L.jdTodayVN(), p = L.todayVN(), l = L.solar2lunar(p[0], p[1], p[2]);
    var evs = L.events(DATA, t, 45, { monthly: true });
    var todayEv = evs.filter(function (e) { return e.jd === t; });
    var h = tuDuongHtml() + '<div class="today"><div class="big">' + (l[0] === 1 ? 'Mùng 1' : l[0] === 15 ? 'Ngày rằm' : 'Ngày ' + l[0]) + ' tháng ' + l[1] + (l[3] ? ' nhuận' : '') + '</div><div class="l">Năm ' + L.canchi(l[2]) + ' · ' + L.weekday(t) + ' ' + L.fmt(t) + '</div>' +
      (todayEv.length ? '<div class="l" style="margin-top:8px;font-weight:600;color:var(--red2)">Hôm nay: ' + todayEv.map(function (e) { return esc(e.title); }).join(', ') + '</div>' : '') + '</div>';
    h += pushCta();
    var main = evs.filter(function (e) { return e.kind !== 'thang' || e.jd - t <= 16; }).slice(0, 6);
    h += '<h2>Sắp tới</h2><div class="card">' + (main.length ? '<div>' + upcomingHtml(main, t) + '</div>' : '<p class="note" style="margin:0">Chưa có ngày giỗ nào trong thời gian tới.</p>') + '<div class="hr"></div><a href="#lich" class="small">Xem lịch cả năm →</a></div>';
    h += '<div class="quick"><a href="#gia-pha"><span class="ic">❦</span>Cây gia phả</a><a href="#van-khan"><span class="ic">✎</span>Văn khấn</a><a href="#ky-niem"><span class="ic">▣</span>Ảnh kỷ niệm</a></div>';
    h += '<h2>Tưởng nhớ gần đây</h2><div class="card" id="recentBox">' + recentHtml() + '</div>';
    var n = DATA.people.filter(function (x) { return !x.ph; });
    h += '<div class="stats"><div class="stat"><b>' + n.length + '</b><span>người trong gia phả</span></div><div class="stat"><b>' + (Math.max.apply(null, order.map(function (x) { return depth[x.id]; })) + 1) + '</b><span>đời</span></div><div class="stat"><b>' + n.filter(isDead).length + '</b><span>người đã khuất</span></div></div>';
    return h;
  }
  function recentHtml() {
    if (!recent.length) return '<p class="note" style="margin:0">Chưa có ai thắp hương. Mở trang của một cụ trong gia phả để thắp nén nhang tưởng nhớ.</p>';
    return recent.slice(0, 8).map(function (r) { var p = byId[r.person_id]; return '<div class="feed"><b>' + esc(r.name || 'Một người con cháu') + '</b> thắp hương ' + (p ? '<a href="#nguoi-' + p.id + '">' + esc(p.n) + '</a>' : '') + ' <span class="note">· ' + ago(r.created_at) + '</span>' + (r.message ? '<q>' + esc(r.message) + '</q>' : '') + '</div>'; }).join('');
  }

  /* ---------------- nhắc giỗ (push) ---------------- */
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function pushCta() {
    if (MODE !== 'live' || !CFG.vapidPublicKey || pushOn) return '';
    if (isIOS() && !isStandalone()) return '<div class="cta"><h3>Nhận nhắc giỗ trên iPhone</h3><div class="small">Bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên) ở Safari → <b>Thêm vào MH chính</b>. Sau đó mở app từ biểu tượng mới và bật nhắc giỗ.</div></div>';
    if (!pushSupported()) return '';
    return '<div class="cta"><h3>Nhận nhắc giỗ trên điện thoại này</h3><div class="small" style="margin-bottom:10px">Sáng 7h, app báo trước ' + 3 + ' ngày và đúng ngày giỗ, rằm, lễ Tết của họ.</div><button class="pri" data-act="push-on">Bật nhắc giỗ</button></div>';
  }
  function b64ToU8(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = (s + p).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(b), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  function checkPush() { if (!pushSupported() || MODE !== 'live') return; navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { var was = pushOn; pushOn = !!s; if (was !== pushOn) render(); }).catch(function () { }); }
  function pushEnable() {
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { toast('Bạn chưa cho phép thông báo. Vào cài đặt trình duyệt để bật lại.'); return; }
      return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CFG.vapidPublicKey) }); })
        .then(function (sub) { return rpc('save_sub', { p_code: CODE, p_sub: sub.toJSON(), p_name: ls('gp-ten') || null }); })
        .then(function () { pushOn = true; toast('Đã bật nhắc giỗ trên máy này.'); render(); });
    }).catch(function (e) { toast('Chưa bật được: ' + (e && e.message || e)); });
  }
  function pushDisable() {
    navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { if (!s) return; var ep = s.endpoint; return s.unsubscribe().then(function () { return rpc('delete_sub', { p_endpoint: ep }); }); })
      .then(function () { pushOn = false; toast('Đã tắt nhắc giỗ trên máy này.'); render(); }).catch(function () { pushOn = false; render(); });
  }

  /* ---------------- cây gia phả ---------------- */
  function hl(s) { if (!query) return esc(s); var q = norm(query), ns = norm(s), i = ns.indexOf(q); if (i < 0) return esc(s); return esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length)); }
  function viewTree() {
    var show = null;
    if (query) { show = {}; var q = norm(query); order.forEach(function (p) { if (norm(p.n).indexOf(q) >= 0 || norm(p.sp).indexOf(q) >= 0) { var c = p; while (c) { show[c.id] = 1; c = byId[c.p]; } } }); }
    var h = '<input id="q" placeholder="Tìm tên trong gia phả…" value="' + esc(query) + '" style="margin-bottom:10px">';
    h += '<div class="bar" style="justify-content:space-between;margin-bottom:8px"><div class="legend" style="margin:0"><span><i style="background:var(--mabg);border-color:var(--mabd)"></i>Nam</span><span><i style="background:var(--febg);border-color:var(--febd)"></i>Nữ</span><span><i style="background:var(--goldbg);border-color:var(--gold);border-style:dashed"></i>Vợ/chồng</span></div><span class="bar"><button class="ghost small" data-act="exp">Mở hết</button><button class="ghost small" data-act="col">Thu gọn</button></span></div>';
    h += '<div class="card tree">' + roots.map(function (r) { return nodeHtml(r, show); }).join('') + '</div>';
    h += '<p class="note">Bấm vào tên để xem trang của từng người, thắp hương tưởng nhớ các cụ đã khuất. Nhãn <span class="bd b-uc">?</span> là chỗ quan hệ cha–con chưa được xác nhận.</p>';
    if (ADMIN) h += '<button data-act="add-root">+ Thêm người (không có cha mẹ trong gia phả)</button>';
    return h;
  }
  function nodeHtml(p, show) {
    if (show && !show[p.id]) return '';
    var ks = kids[p.id], open = show ? true : !collapsed[p.id];
    var b = ''; if (p.ls) b += '<span class="bd b-ls">Liệt sỹ</span>'; if (p.uc) b += '<span class="bd b-uc">?</span>'; if (p.gd) b += '<span class="bd b-gio">giỗ ' + p.gd + '/' + p.gm + ' ÂL</span>';
    var yr = years(p); if (isDead(p) && !p.d && !p.ph) yr += (yr ? ' · ' : '') + 'đã mất';
    var h = '<div class="node"><div class="couple"><div class="pc ' + (p.ph ? 'ph' : p.g === 'f' ? 'fe' : 'ma') + (p.sp ? ' hs' : '') + '" data-go="nguoi-' + p.id + '"><div class="pr"><span class="n">' + hl(p.n) + '</span><span class="rl">' + role(p) + '</span></div>' +
      ((yr || b) ? '<div class="pm">' + (yr ? '<span>' + esc(yr) + '</span>' : '') + b + '</div>' : '') +
      (ks.length ? '<button class="tg" data-act="tg" data-id="' + p.id + '">' + (open ? '▾ ' : '▸ ') + ks.length + ' người con</button>' : '') + '</div>' +
      (p.sp ? '<div class="sc" data-go="nguoi-' + p.id + '"><span class="sl">' + (p.g === 'f' ? 'Chồng' : 'Vợ') + '</span><span class="n">' + hl(p.sp) + '</span></div>' : '') + '</div>';
    if (ks.length && open) h += '<div class="kids">' + ks.map(function (c) { return nodeHtml(c, show); }).join('') + '</div>';
    return h + '</div>';
  }

  /* ---------------- trang từng người ---------------- */
  function litToday(id) { var p = L.todayVN(); return ls('gp-lit-' + id) === p.join('-'); }
  function viewPerson(id) {
    var p = byId[id]; if (!p) return '<a class="back" href="#gia-pha">← Gia phả</a><div class="card">Không tìm thấy người này.</div>';
    var t = L.jdTodayVN(), dead = isDead(p) && !p.ph;
    var h = '<a class="back" href="#gia-pha">← Gia phả</a>';
    if (dead) {
      var lit = litToday(id), c = counts[id] || 0;
      h += '<div class="altar">' + (p.anh ? '<div class="portrait"><img data-photo="' + p.anh + '" alt="Ảnh ' + esc(p.n) + '"></div>' : '') + '<div class="burner' + (p.anh ? ' sm' : '') + (lit ? ' lit' : '') + '" aria-hidden="true"><span class="smoke k1"></span><span class="smoke k2"></span><span class="smoke k3"></span><span class="stick s1"><i></i></span><span class="stick s2"><i></i></span><span class="stick s3"><i></i></span><span class="bowl"></span></div>' +
        '<div class="nm">' + esc(p.n) + '</div><div class="cnt">' + esc(years(p) || 'Đã khuất') + (p.ls ? ' · Liệt sỹ' : '') + '</div><div class="cnt">' + (c ? c + ' lượt thắp hương' : 'Chưa có lượt thắp hương') + '</div>' +
        (lit ? '<div class="done">Bạn đã thắp hương hôm nay. Xin cảm ơn tấm lòng của con cháu.</div>' : '<button class="gold" data-act="light" data-id="' + id + '">Thắp một nén nhang</button>') + '</div>';
    } else {
      h += '<div class="card ph-head ' + (p.g === 'f' ? 'fe' : 'ma') + '">' + (p.anh ? '<div class="portrait lv"><img data-photo="' + p.anh + '" alt=""></div>' : '') + '<div class="role">' + esc(role(p) || (p.ph ? 'Giữ chỗ' : '')) + '</div><div class="nm">' + esc(p.n) + '</div><div class="muted">' + esc(years(p)) + '</div></div>';
    }
    var par = byId[p.p], ch = kids[id] || [], sib = par ? kids[par.id].filter(function (x) { return x.id !== id; }) : [];
    var dl = '';
    if (p.gd) { var n = L.nextLunar(p.gd, p.gm, t); dl += '<dt>Ngày giỗ</dt><dd>' + p.gd + '/' + p.gm + ' âm lịch' + (n ? '<br><span class="note">Lần tới: ' + L.weekday(n.jd) + ' ' + L.fmt(n.jd) + (n.jd === t ? ' (hôm nay)' : ' (còn ' + (n.jd - t) + ' ngày)') + '</span>' : '') + '</dd>'; }
    else if (dead) dl += '<dt>Ngày giỗ</dt><dd class="muted">Chưa có' + (ADMIN ? ' – bấm “Sửa thông tin” để ghi' : ' – nhờ người quản lý gia phả bổ sung') + '</dd>';
    if (p.sp) dl += '<dt>' + (p.g === 'f' ? 'Chồng' : 'Vợ') + '</dt><dd>' + esc(p.sp) + '</dd>';
    if (par) dl += '<dt>' + (par.g === 'f' ? 'Mẹ' : 'Cha') + '</dt><dd class="rel"><a href="#nguoi-' + par.id + '">' + esc(par.n) + '</a></dd>';
    if (ch.length) dl += '<dt>Các con</dt><dd class="rel">' + ch.map(function (x) { return '<a href="#nguoi-' + x.id + '">' + esc(x.n) + '</a>'; }).join('') + '</dd>';
    if (sib.length) dl += '<dt>Anh chị em</dt><dd class="rel">' + sib.map(function (x) { return '<a href="#nguoi-' + x.id + '">' + esc(x.n) + '</a>'; }).join('') + '</dd>';
    if (p.mo) { var map = /^https?:\/\//.test(p.map || '') ? p.map : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.mo); dl += '<dt>Mộ phần</dt><dd>' + esc(p.mo) + '<br><a href="' + esc(map) + '" target="_blank" rel="noopener">Chỉ đường →</a></dd>'; }
    if (p.uc) dl += '<dt>Ghi chú</dt><dd><span class="bd b-uc" style="margin:0">?</span> Quan hệ cha–con chưa được xác nhận</dd>';
    if (dl) h += '<div class="card"><dl class="kv">' + dl + '</dl></div>';
    if (p.ts) h += '<div class="card"><h3>Tiểu sử</h3><div style="white-space:pre-wrap">' + esc(p.ts) + '</div></div>';
    if (p.note) h += '<div class="card"><h3>Ghi chép</h3><div class="small" style="white-space:pre-wrap">' + esc(p.note) + '</div></div>';
    if (dead) {
      h += '<h2>Lời tưởng nhớ</h2><div class="card" id="msgs">' + msgsHtml(id) + '</div>';
      if (p.gd) h += '<a class="btn block" href="#van-khan" data-act="vk-for" data-id="' + id + '" style="margin-bottom:10px">Xem văn khấn ngày giỗ</a>';
    }
    h += '<h2>Ảnh</h2><div class="card"><div id="pphotos">' + gridHtml(personPhotos[id], 'Chưa có ảnh nào về ' + (dead ? 'cụ' : 'người này') + '.') + '</div><button class="small" data-act="up-open" data-id="' + id + '" style="margin-top:10px">+ Thêm ảnh</button></div>';
    if (ADMIN) h += '<div class="bar"><button class="pri" data-act="edit" data-id="' + id + '">Sửa thông tin</button><button data-act="add-child" data-id="' + id + '">+ Thêm con</button></div>';
    return h;
  }
  function msgsHtml(id) {
    var m = personMsgs[id]; if (!m) return '<p class="note" style="margin:0">Đang tải…</p>';
    if (!m.length) return '<p class="note" style="margin:0">Chưa có lời tưởng nhớ nào. Hãy là người đầu tiên thắp hương.</p>';
    return m.map(function (r) { return '<div class="msg"><span class="who">' + esc(r.name || 'Một người con cháu') + '</span> <span class="when">· ' + ago(r.created_at) + '</span>' + (r.message ? '<div>' + esc(r.message) + '</div>' : '<div class="note">đã thắp một nén nhang</div>') + (ADMIN ? '<button class="ghost danger small" data-act="del-msg" data-mid="' + r.id + '" data-id="' + id + '" style="padding:2px 0">Ẩn lời này</button>' : '') + '</div>'; }).join('');
  }
  function loadMsgs(id) { store.list(id).then(function (r) { personMsgs[id] = r || []; var b = document.getElementById('msgs'); if (b) b.innerHTML = msgsHtml(id); }).catch(function () { personMsgs[id] = []; }); }
  function lightSheet(id) {
    var p = byId[id];
    editing = { light: id };
    var html = '<div class="overlay" id="ov"><div class="sheet"><div class="bar" style="justify-content:space-between"><h2 style="margin:0">Thắp hương</h2><button class="ghost" data-act="close" aria-label="Đóng">✕</button></div><p class="small">Tưởng nhớ <b>' + esc(p.n) + '</b></p>' +
      '<label>Tên của bạn</label><input id="lt_name" maxlength="60" value="' + esc(ls('gp-ten') || '') + '" placeholder="vd: Cháu Vinh Hiển">' +
      '<label>Lời tưởng nhớ (không bắt buộc)</label><textarea id="lt_msg" rows="3" maxlength="500" placeholder="Đôi dòng gửi tới người đã khuất…"></textarea><p class="err" id="lt_err"></p>' +
      '<button class="gold block" data-act="light-go" data-id="' + id + '">Thắp hương</button></div></div>';
    return html;
  }

  /* ---------------- sửa người (quản trị) ---------------- */
  function viewEditor() {
    if (editing.light) return lightSheet(editing.light);
    if (editing.upload) return uploadSheet();
    if (editing.photo) return lightboxHtml();
    if (editing.tudong) return tuDuongSheet();
    var isNew = editing.isNew, p = editing.p, desc = isNew ? {} : descendants(p.id);
    var opts = '<option value="">(Không có – đời gốc)</option>' + order.filter(function (o) { return o.id !== p.id && !desc[o.id]; }).map(function (o) { return '<option value="' + o.id + '" ' + (o.id === p.p ? 'selected' : '') + '>' + '— '.repeat(depth[o.id]) + esc(o.n) + (years(o) ? ' (' + years(o) + ')' : '') + '</option>'; }).join('');
    var hasKids = !isNew && kids[p.id] && kids[p.id].length;
    function v(k) { return esc(p[k] == null ? '' : p[k]); }
    return '<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-label="Sửa thông tin"><div class="bar" style="justify-content:space-between"><h2 style="margin:0">' + (isNew ? 'Thêm người' : 'Sửa thông tin') + '</h2><button class="ghost" data-act="close" aria-label="Đóng">✕</button></div>' +
      '<label>Họ và tên</label><input id="f_n" value="' + v('n') + '">' +
      '<div class="row2"><div><label>Giới tính</label><select id="f_g"><option value="m" ' + (p.g !== 'f' ? 'selected' : '') + '>Nam</option><option value="f" ' + (p.g === 'f' ? 'selected' : '') + '>Nữ</option></select></div><div><label>Vợ / chồng</label><input id="f_sp" value="' + v('sp') + '"></div></div>' +
      '<div class="row2"><div><label>Năm sinh</label><input id="f_b" inputmode="numeric" value="' + v('b') + '"></div><div><label>Năm mất</label><input id="f_d" inputmode="numeric" value="' + v('d') + '"></div></div>' +
      '<label class="chk"><input type="checkbox" id="f_dead" ' + (isDead(p) ? 'checked' : '') + '> Đã mất</label><label class="chk"><input type="checkbox" id="f_ls" ' + (p.ls ? 'checked' : '') + '> Liệt sỹ</label>' +
      '<label>Ngày giỗ (âm lịch)</label><div class="row2"><input id="f_gd" inputmode="numeric" placeholder="Ngày 1–30" value="' + v('gd') + '"><input id="f_gm" inputmode="numeric" placeholder="Tháng 1–12" value="' + v('gm') + '"></div>' +
      '<label>Con của</label><select id="f_p">' + opts + '</select>' +
      '<label class="chk"><input type="checkbox" id="f_ok" ' + (!p.uc ? 'checked' : '') + '> Quan hệ cha–con đã xác nhận</label>' +
      '<label>Mộ phần (địa chỉ)</label><input id="f_mo" value="' + v('mo') + '" placeholder="vd: Nghĩa trang thôn …, xã …">' +
      '<label>Link bản đồ (không bắt buộc)</label><input id="f_map" value="' + v('map') + '" placeholder="Dán link Google Maps vị trí mộ">' +
      '<label>Tiểu sử</label><textarea id="f_ts" rows="3">' + v('ts') + '</textarea>' +
      '<label>Ghi chép khác</label><textarea id="f_note" rows="2">' + v('note') + '</textarea>' +
      '<p class="err" id="edErr"></p><div class="bar"><button class="pri" data-act="ed-save">' + (isNew ? 'Thêm vào gia phả' : 'Lưu') + '</button>' + (isNew || hasKids ? '' : '<button class="ghost danger" data-act="ed-del">' + (delArm ? 'Bấm lần nữa để xóa' : 'Xóa người này') + '</button>') + '</div>' +
      (hasKids ? '<p class="note">Muốn xóa người này thì chuyển hoặc xóa các con trước.</p>' : '') + '</div></div>';
  }
  function num(v, a, b) { v = String(v || '').trim(); if (!v) return null; var n = parseInt(v, 10); return (isNaN(n) || n < a || n > b) ? NaN : n; }
  function saveEditor() {
    function g(id) { return document.getElementById(id); }
    var err = g('edErr'), name = g('f_n').value.trim();
    if (!name) { err.textContent = 'Nhập họ tên trước.'; return; }
    var b = num(g('f_b').value, 1500, 2200), d = num(g('f_d').value, 1500, 2200), gd = num(g('f_gd').value, 1, 30), gm = num(g('f_gm').value, 1, 12);
    if (isNaN(b) || isNaN(d)) { err.textContent = 'Năm sinh/năm mất chưa đúng (ví dụ 1945).'; return; }
    if (isNaN(gd) || isNaN(gm)) { err.textContent = 'Ngày giỗ: ngày 1–30, tháng 1–12.'; return; }
    if ((gd && !gm) || (!gd && gm)) { err.textContent = 'Nhập đủ cả ngày và tháng giỗ.'; return; }
    var before = JSON.stringify(DATA), p = editing.isNew ? editing.p : byId[editing.p.id];
    p.n = name; p.g = g('f_g').value;
    var txt = { sp: g('f_sp').value, mo: g('f_mo').value, map: g('f_map').value, ts: g('f_ts').value, note: g('f_note').value };
    Object.keys(txt).forEach(function (k) { var v = txt[k].trim(); if (v) p[k] = v; else delete p[k]; });
    var nums = { b: b, d: d, gd: gd, gm: gm }; Object.keys(nums).forEach(function (k) { if (nums[k]) p[k] = nums[k]; else delete p[k]; });
    if (g('f_dead').checked || d || g('f_ls').checked) p.dead = true; else delete p.dead;
    if (g('f_ls').checked) p.ls = true; else delete p.ls;
    var par = g('f_p').value; if (par) p.p = par; else delete p.p;
    if (g('f_ok').checked) delete p.uc; else p.uc = true;
    if (p.ph && name.indexOf('Chưa rõ') !== 0) delete p.ph;
    if (editing.isNew) DATA.people.push(p);
    persist(before, function () { var id = p.id; editing = null; delArm = false; if (p.p) delete collapsed[p.p]; if (route().id !== id) go('nguoi-' + id); else render(); toast('Đã lưu.'); });
  }
  function persist(before, ok) {
    var btn = document.querySelector('[data-act="ed-save"]'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    store.save().then(ok).catch(function (e) {
      DATA = JSON.parse(before);
      if (e.code === 'xung_dot') { toast('Có người vừa cập nhật gia phả. Đã tải bản mới, bạn sửa lại giúp nhé.'); store.load().then(function () { editing = null; render(); }); }
      else if (e.code === 'sai_ma_qt') { ADMIN = null; ss('gp-qt', null); editing = null; toast('Mã quản trị không còn đúng.'); render(); }
      else { toast('Chưa lưu được: ' + e.message); if (btn) { btn.disabled = false; btn.textContent = 'Lưu'; } }
    });
  }

  /* ---------------- lịch giỗ ---------------- */
  function gcal(e) { return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.title) + '&dates=' + L.ymd(e.jd) + '/' + L.ymd(e.jd + 1) + '&details=' + encodeURIComponent(e.sub + '\n' + location.href.split('#')[0]); }
  function viewCal() {
    var t = L.jdTodayVN(), ev = L.events(DATA, t, 366, { monthly: calMonthly });
    var h = '<div class="card"><div class="row2"><div><label style="margin-top:0">Làm nổi trước</label><select id="c_rem">' + [3, 5, 7, 10, 14, 30].map(function (n) { return '<option value="' + n + '" ' + (n === calRemind ? 'selected' : '') + '>' + n + ' ngày</option>'; }).join('') + '</select></div><div><label style="margin-top:0">&nbsp;</label><label class="chk" style="margin:8px 0 0"><input type="checkbox" id="c_mon" ' + (calMonthly ? 'checked' : '') + '> Mùng 1 &amp; rằm</label></div></div></div>';
    h += '<div class="card">' + (ev.length ? ev.map(function (e) { var s = L.jdToDate(e.jd), d = e.jd - t, on = d <= calRemind && e.kind !== 'thang'; return '<div class="ev' + (on ? ' soon' : '') + '"><div class="dt"><b>' + s[0] + '</b><span>th ' + s[1] + '/' + String(s[2]).slice(2) + '</span></div><div style="flex:1;min-width:0"><div class="t">' + (e.kind === 'gio' ? '<a href="#nguoi-' + e.id + '" style="color:inherit;text-decoration:none">' + esc(e.title) + '</a>' : esc(e.title)) + '</div><div class="m">' + L.weekday(e.jd) + ' ' + L.fmt(e.jd) + ' · ' + esc(e.sub) + '</div>' + (on ? '<div class="cd">' + (d === 0 ? 'Hôm nay' : 'Còn ' + d + ' ngày') + '</div>' : '') + (e.kind !== 'thang' ? '<a href="' + gcal(e) + '" target="_blank" rel="noopener">+ Google Lịch</a>' : '') + '</div></div>'; }).join('') : '<p class="note">Chưa có sự kiện.</p>') + '</div>';
    var miss = order.filter(function (p) { return !p.ph && isDead(p) && !p.gd; });
    if (miss.length) h += '<h2>Chưa có ngày giỗ (' + miss.length + ')</h2><div class="card"><p class="note" style="margin-top:0">' + (ADMIN ? 'Bấm tên để mở trang và ghi ngày giỗ âm lịch.' : 'Ai biết ngày giỗ của các cụ dưới đây, xin báo người quản lý gia phả để bổ sung.') + '</p><div class="chips">' + miss.map(function (p) { return '<a class="chip" href="#nguoi-' + p.id + '" style="text-decoration:none;color:inherit">' + esc(p.n) + (p.d ? ' · ' + p.d : '') + '</a>'; }).join('') + '</div></div>';
    h += '<h2>Ngày riêng của họ</h2><div class="card">' + (DATA.events.length ? DATA.events.map(function (e, i) { return '<div class="bar" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>' + esc(e.t) + ' · <span class="muted">' + e.d + '/' + e.m + ' ÂL</span></span>' + (ADMIN ? '<button class="ghost danger small" data-act="del-ev" data-i="' + i + '">Xóa</button>' : '') + '</div>'; }).join('') : '<p class="note" style="margin:0">Chưa có. ' + (ADMIN ? '' : 'Người quản lý có thể thêm giỗ tổ, ngày họp họ…') + '</p>');
    if (ADMIN) h += '<label>Tên ngày</label><input id="e_t" placeholder="vd: Giỗ tổ họ Nguyễn Duy"><div class="row2"><div><label>Ngày âm</label><input id="e_d" inputmode="numeric"></div><div><label>Tháng âm</label><input id="e_m" inputmode="numeric"></div></div><p class="err" id="e_err"></p><button data-act="add-ev">+ Thêm</button>';
    h += '</div>';
    return h;
  }

  /* ---------------- văn khấn ---------------- */
  var DIP = [['gio', 'Ngày giỗ'], ['ram', 'Mùng 1 và ngày rằm'], ['tet', 'Cúng gia tiên ngày Tết'], ['thanhminh', 'Tảo mộ tiết Thanh minh'], ['ram7', 'Rằm tháng Bảy']];
  var XUNG = ['cụ ông', 'cụ bà', 'cụ', 'ông nội', 'bà nội', 'ông', 'bà', 'bố', 'mẹ', 'bác', 'chú', 'thím', 'cô', 'anh', 'chị'];
  function vkText() {
    var s = vkState, t = L.jdTodayVN(), p = byId[s.id], jd, d, m, ly;
    if (s.dip === 'gio' && p && p.gd) { var n = L.nextLunar(p.gd, p.gm, t); jd = n.jd; }
    else if (s.dip === 'ram') { var cands = []; var lt = L.solar2lunar.apply(null, L.todayVN()); [1, 15].forEach(function (x) { for (var k = 0; k < 2; k++) { var mm = lt[1] + k > 12 ? lt[1] + k - 12 : lt[1] + k, yy = lt[1] + k > 12 ? lt[2] + 1 : lt[2]; var j = L.lunarJd(x, mm, yy); if (j >= t) cands.push(j); } }); jd = Math.min.apply(null, cands); }
    else if (s.dip === 'tet') { jd = L.nextLunar(30, 12, t).jd; }
    else if (s.dip === 'thanhminh') { var y = L.todayVN()[2]; jd = L.thanhMinh(y); if (jd < t) jd = L.thanhMinh(y + 1); }
    else if (s.dip === 'ram7') { jd = L.nextLunar(15, 7, t).jd; }
    else jd = t;
    var dt = L.jdToDate(jd), lu = L.solar2lunar(dt[0], dt[1], dt[2]); d = lu[0]; m = lu[1]; ly = lu[2];
    var ho = HO.replace(/^Họ /, '');
    var tc = s.tinchu.trim() || '…………', dc = s.diachi.trim() || '…………';
    var ten = p ? p.n : '…………', xg = s.xung;
    var ngay = 'Hôm nay là ngày ' + d + ' tháng ' + m + ' năm ' + L.canchi(ly) + ' (tức ngày ' + L.fmt(jd) + ' dương lịch).';
    var mo = 'Nam mô A Di Đà Phật! (3 lần)\n\nCon lạy chín phương Trời, mười phương chư Phật, chư Phật mười phương.\nCon kính lạy Hoàng thiên Hậu thổ, chư vị Tôn thần.\nCon kính lạy ngài Bản cảnh Thành hoàng, ngài Bản xứ Thổ địa, ngài Bản gia Táo quân cùng các vị Thần linh cai quản trong xứ này.\nCon kính lạy các cụ Tổ tiên nội ngoại họ ' + ho + '.\n\n';
    var ket = '\n\nChúng con lễ bạc tâm thành, trước án kính lễ, cúi xin chứng giám.\n\nNam mô A Di Đà Phật! (3 lần)';
    var tin = 'Tín chủ con là ' + tc + ', ngụ tại ' + dc + '.';
    if (s.dip === 'gio') return mo + ngay + '\nChính ngày giỗ của ' + xg + ' ' + ten + (p && p.d ? ', mất năm ' + p.d : '') + '.\n' + tin + '\n\nThương nhớ ' + xg + ' đã khuất, con cháu chúng con thành tâm sửa biện hương hoa, lễ vật, trà quả, thắp nén tâm hương dâng lên trước án.\n\nChúng con kính mời hương linh ' + xg + ' ' + ten + ' về chứng giám lòng thành, thụ hưởng lễ vật, phù hộ độ trì cho con cháu được bình an, mạnh khỏe, gia đạo hưng long, mọi việc hanh thông.\n\nChúng con cũng kính mời các cụ Tổ tiên, các vị hương linh nội ngoại họ ' + ho + ' cùng về hâm hưởng.' + ket;
    if (s.dip === 'ram') return mo + ngay + '\n' + tin + '\n\nNhân ngày ' + (d === 1 ? 'mùng Một' : 'rằm') + ', chúng con thành tâm sắm lễ hương hoa, trà quả, thắp nén tâm hương dâng lên trước án.\n\nChúng con kính mời các vị Thần linh cai quản trong nhà, trong xứ về chứng giám. Kính mời các cụ Tổ tiên, hương linh nội ngoại họ ' + ho + ' về thụ hưởng lễ vật.\n\nCúi xin phù hộ cho cả nhà chúng con bình an, mạnh khỏe, công việc thuận lợi, mọi sự tốt lành.' + ket;
    if (s.dip === 'tet') return mo + ngay + '\n' + tin + '\n\nNay năm cũ sắp qua, năm mới sắp đến, con cháu chúng con thành tâm sắm sửa hương hoa, lễ vật, mâm cỗ cuối năm, thắp nén tâm hương dâng lên trước án.\n\nChúng con kính mời các cụ Tổ tiên, các vị hương linh nội ngoại họ ' + ho + ' về sum vầy ăn Tết cùng con cháu, chứng giám lòng thành.\n\nCúi xin phù hộ cho con cháu năm mới được bình an, mạnh khỏe, làm ăn thuận lợi, gia đình hòa thuận, hạnh phúc.' + ket;
    if (s.dip === 'thanhminh') return 'Nam mô A Di Đà Phật! (3 lần)\n\nCon kính lạy Hoàng thiên Hậu thổ, chư vị Tôn thần.\nCon kính lạy ngài Sơn thần, Thổ địa và các vị Thần linh cai quản khu vực này.\n\n' + ngay + '\nNhân tiết Thanh minh, ' + tin.charAt(0).toLowerCase() + tin.slice(1) + '\nChúng con cùng con cháu đến phần mộ của ' + xg + ' ' + ten + ' để sửa sang, quét dọn, thắp hương tưởng nhớ.\n\nKính xin các ngài cho phép, chứng giám, để phần mộ được yên ổn, sạch đẹp.\n\nChúng con kính mời hương linh ' + xg + ' ' + ten + ' về thụ hưởng lễ vật, phù hộ cho con cháu bình an, mạnh khỏe, mọi việc hanh thông.' + ket;
    return mo + ngay + '\n' + tin + '\n\nNhân ngày rằm tháng Bảy, mùa Vu Lan báo hiếu, con cháu chúng con nhớ đến công ơn sinh thành, dưỡng dục của Tổ tiên, ông bà, cha mẹ, thành tâm sắm lễ hương hoa, trà quả, thắp nén tâm hương dâng lên trước án.\n\nChúng con kính mời các cụ Tổ tiên, các vị hương linh nội ngoại họ ' + ho + ' về chứng giám, thụ hưởng lễ vật.\n\nCúi xin phù hộ độ trì cho con cháu được bình an, mạnh khỏe, sống hiếu thuận, gia đạo hưng long.' + ket;
  }
  function viewVK() {
    var s = vkState, needP = s.dip === 'gio' || s.dip === 'thanhminh';
    var dead = order.filter(function (p) { return !p.ph && isDead(p); });
    if (needP && !s.id) { var w = dead.filter(function (p) { return p.gd; })[0] || dead[0]; if (w) s.id = w.id; }
    var h = '<div class="card"><label style="margin-top:0">Dịp cúng</label><select id="vk_dip">' + DIP.map(function (d) { return '<option value="' + d[0] + '" ' + (d[0] === s.dip ? 'selected' : '') + '>' + d[1] + '</option>'; }).join('') + '</select>';
    if (needP) h += '<label>Người được cúng</label><select id="vk_id">' + dead.map(function (p) { return '<option value="' + p.id + '" ' + (p.id === s.id ? 'selected' : '') + '>' + esc(p.n) + (p.gd ? ' · giỗ ' + p.gd + '/' + p.gm : '') + '</option>'; }).join('') + '</select><label>Con cháu gọi người này là</label><select id="vk_xung">' + XUNG.map(function (x) { return '<option ' + (x === s.xung ? 'selected' : '') + '>' + x + '</option>'; }).join('') + '</select>';
    h += '<div class="row2"><div><label>Tín chủ (người khấn)</label><input id="vk_tc" value="' + esc(s.tinchu) + '" placeholder="Họ tên"></div><div><label>Địa chỉ</label><input id="vk_dc" value="' + esc(s.diachi) + '" placeholder="Nơi ở"></div></div></div>';
    var warn = s.dip === 'gio' && byId[s.id] && !byId[s.id].gd ? '<p class="note">Người này chưa có ngày giỗ nên văn khấn đang lấy ngày hôm nay.</p>' : '';
    h += warn + '<div class="bar" style="justify-content:flex-end;margin-bottom:8px"><button class="ghost small" data-act="vk-lg">' + (s.lg ? 'Chữ thường' : 'Chữ to') + '</button><button class="small" data-act="vk-copy">Sao chép</button></div>';
    h += '<div class="card"><div class="vk' + (s.lg ? ' lg' : '') + '" id="vkText">' + esc(vkText()) + '</div></div>';
    h += '<p class="note">Văn khấn theo lối dân gian phổ biến. Mỗi vùng, mỗi nhà có thể khấn khác, con cháu cứ theo nếp của gia đình mình. Điều quý nhất là tấm lòng thành.</p>';
    return h;
  }

  /* ---------------- đặt tên ---------------- */
  var BOY = ['An', 'Bảo', 'Bách', 'Cường', 'Đạt', 'Đăng', 'Đức', 'Dũng', 'Hào', 'Hiếu', 'Hoàng', 'Huy', 'Khang', 'Khải', 'Khiêm', 'Khoa', 'Khôi', 'Kiên', 'Lâm', 'Lộc', 'Luân', 'Nam', 'Nguyên', 'Nhân', 'Phát', 'Phong', 'Phúc', 'Quân', 'Quý', 'Sang', 'Tâm', 'Thiện', 'Tín', 'Toàn', 'Trí', 'Tùng', 'Tuệ', 'Uy', 'Việt', 'Vĩnh', 'Vương', 'Kha', 'Thuận', 'Nhật', 'Hưng', 'Gia Bảo', 'Minh Khôi', 'Đức Anh'];
  var GIRL = ['An', 'Anh', 'Châu', 'Chi', 'Diệp', 'Giang', 'Hân', 'Hạnh', 'Khuê', 'Lam', 'Lan', 'Linh', 'Mai', 'My', 'Ngân', 'Ngọc', 'Nhi', 'Nhiên', 'Như', 'Quyên', 'Quỳnh', 'Tâm', 'Thư', 'Trang', 'Trâm', 'Tú', 'Uyên', 'Vân', 'Vy', 'Yến', 'Thảo', 'Phương', 'Hằng', 'Tuệ', 'Vi', 'Khánh', 'Hà', 'Ly', 'Bích', 'Diệu', 'Đan', 'Miên', 'Nguyệt', 'Sương', 'Tiên', 'Trúc', 'Xuân', 'Hạ'];
  function usedGiven() { var u = {}; DATA.people.forEach(function (p) { if (p.ph) return; u[norm(given(p.n))] = 1; if (p.sp) u[norm(given(p.sp))] = 1; }); return u; }
  function relAnc(lv, sp, p) { if (sp) return ['', 'Mẹ', 'Bà nội', 'Cụ bà', 'Kỵ bà'][lv] || 'Tổ bà (đời trên ' + lv + ')'; if (lv === 1) return p.g === 'f' ? 'Mẹ' : 'Cha'; return ['', '', 'Ông nội', 'Cụ', 'Kỵ'][lv] || 'Tổ (đời trên ' + lv + ')'; }
  function checkName() {
    var T = nameState.ten.trim(); if (!T) return null;
    var tl = low(given(T)), tn = norm(given(T)), anc = {};
    if (nameState.par && byId[nameState.par]) { var c = byId[nameState.par], lv = 1; while (c) { anc[c.id] = lv; c = byId[c.p]; lv++; } }
    var cd = nameState.par && byId[nameState.par] ? depth[nameState.par] + 1 : null;
    var full = low([nameState.ho, nameState.dem, T].join(' ').replace(/\s+/g, ' ')), res = [];
    DATA.people.forEach(function (p) {
      if (p.ph) return; var cands = [{ n: p.n, sp: false }]; if (p.sp) cands.push({ n: p.sp, sp: true });
      cands.forEach(function (c) {
        var gv = given(c.n), ex = low(gv) === tl, near = !ex && norm(gv) === tn; if (!ex && !near) return;
        var lv = anc[p.id], sev, rel;
        if (lv) { sev = ex ? 3 : 2; rel = relAnc(lv, c.sp, p); }
        else { var diff = cd == null ? null : cd - depth[p.id]; sev = ex ? (diff != null && diff > 0 ? 2 : 1) : 0; rel = c.sp ? ((p.g === 'f' ? 'Chồng của ' : 'Vợ của ') + p.n) : (diff == null ? 'Người trong họ' : diff > 0 ? ('Bậc trên ' + diff + ' đời') : diff === 0 ? 'Cùng thế hệ' : 'Bậc dưới'); }
        res.push({ sev: sev, who: c.n, rel: rel, ex: ex, same: low(c.n) === full });
      });
    });
    res.sort(function (a, b) { return b.sev - a.sev; }); return res;
  }
  function nameResult() {
    var s = nameState; if (!s.ten.trim()) return '<p class="note" style="margin-top:12px">Nhập tên để kiểm tra.</p>';
    var res = checkName(), full = [s.ho, s.dem, s.ten].join(' ').replace(/\s+/g, ' ').trim(), mx = res.length ? res[0].sev : -1;
    var LV = ['Gần âm (khác dấu)', 'Lưu ý', 'Cân nhắc', 'Nên tránh'], V = ['Không trùng, chỉ gần âm', 'Có trùng nhẹ', 'Nên cân nhắc', 'Nên tránh tên này'];
    var h = '<div style="margin-top:14px"><div class="note">Tên đầy đủ</div><div class="verdict">' + esc(full) + '</div>';
    if (!res.length) return h + '<div class="ok">Chưa thấy trùng với ai trong gia phả (gồm cả vợ/chồng).</div></div>';
    h += '<div class="res s' + mx + '" style="font-weight:600">' + V[mx] + ' · ' + res.length + ' chỗ trùng</div>';
    res.forEach(function (r) { h += '<div class="res s' + r.sev + '"><div class="lv">' + LV[r.sev] + '</div><div><b>' + esc(r.who) + '</b> · ' + esc(r.rel) + '</div><div class="note">' + (r.sev === 3 ? 'Trùng tên chính với tổ tiên trực hệ, theo lệ thường kiêng (phạm húy).' : r.sev === 2 && !r.ex ? 'Tên tổ tiên trực hệ chỉ khác dấu, đọc dễ nhầm.' : r.ex ? 'Trùng tên chính' + (r.same ? ', trùng cả họ tên đầy đủ' : '') + '.' : 'Chỉ khác dấu, dễ nhầm khi viết không dấu.') + '</div></div>'; });
    return h + '</div>';
  }
  function viewName() {
    var s = nameState;
    var par = '<option value="">(Chưa chọn)</option>' + order.filter(function (o) { return !o.ph; }).map(function (o) { return '<option value="' + o.id + '" ' + (o.id === s.par ? 'selected' : '') + '>' + '— '.repeat(Math.max(0, depth[o.id] - 1)) + esc(o.n) + (years(o) ? ' (' + years(o) + ')' : '') + '</option>'; }).join('');
    var h = '<a class="back" href="#them">← Thêm</a><div class="card"><h3>Kiểm tra tên khi đặt cho con cháu</h3><div class="row3"><div><label>Họ</label><input id="n_ho" value="' + esc(s.ho) + '"></div><div><label>Tên đệm</label><input id="n_dem" value="' + esc(s.dem) + '"></div><div><label>Tên</label><input id="n_ten" value="' + esc(s.ten) + '" placeholder="vd: Khôi"></div></div>' +
      '<div class="row2"><div><label>Giới tính</label><select id="n_g"><option value="m" ' + (s.g === 'm' ? 'selected' : '') + '>Bé trai</option><option value="f" ' + (s.g === 'f' ? 'selected' : '') + '>Bé gái</option></select></div><div><label>Là con của</label><select id="n_par">' + par + '</select></div></div>' +
      '<p class="note">Chọn cha (hoặc mẹ) để biết tên có trùng với ông bà, cụ kỵ trực hệ không. Đây là trường hợp nên tránh nhất.</p></div><div id="nameRes">' + nameResult() + '</div>';
    var used = usedGiven(), list = (s.g === 'f' ? GIRL : BOY).filter(function (x) { return !used[norm(given(x))]; });
    h += '<h2>Gợi ý tên chưa ai trong họ dùng</h2><div class="chips">' + list.map(function (x) { return '<button class="chip" data-act="sug" data-v="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div><p class="note">Đã lọc bỏ tên trùng (kể cả khi bỏ dấu) với người trong gia phả và vợ/chồng. Bấm một tên để kiểm tra.</p>';
    return h;
  }

  /* ---------------- thêm / cài đặt ---------------- */
  function viewMore() {
    var h = '<div class="card"><h3>Nhắc giỗ trên điện thoại</h3>';
    if (MODE !== 'live') h += '<p class="note" style="margin:0">Có sau khi cài đặt xong (bản xem thử chưa gửi thông báo).</p>';
    else if (!CFG.vapidPublicKey) h += '<p class="note" style="margin:0">Người quản lý chưa cấu hình khóa thông báo.</p>';
    else if (isIOS() && !isStandalone()) h += '<p class="small" style="margin:0">Trên iPhone, cần thêm app ra màn hình chính trước (Safari → nút Chia sẻ → Thêm vào MH chính), rồi mở app từ biểu tượng để bật.</p>';
    else if (!pushSupported()) h += '<p class="note" style="margin:0">Trình duyệt này chưa hỗ trợ thông báo. Hãy dùng Chrome (Android) hoặc Safari (iPhone).</p>';
    else h += pushOn ? '<p class="small">Đang bật. Sáng 7h app sẽ báo trước 3 ngày và đúng ngày giỗ, lễ.</p><button data-act="push-off">Tắt nhắc trên máy này</button>' : '<p class="small">Chưa bật trên máy này.</p><button class="pri" data-act="push-on">Bật nhắc giỗ</button>';
    h += '</div>';
    h += '<div class="card"><h3>Cài app lên màn hình</h3>' + (isStandalone() ? '<p class="small" style="margin:0">Bạn đang dùng app đã cài. ✓</p>' : installEvt ? '<button class="pri" data-act="install">Cài app Gia phả</button>' : isIOS() ? '<p class="small" style="margin:0">Mở bằng Safari → bấm nút <b>Chia sẻ</b> → <b>Thêm vào MH chính</b>.</p>' : '<p class="small" style="margin:0">Mở menu ⋮ của Chrome → <b>Thêm vào màn hình chính</b> (hoặc “Cài đặt ứng dụng”).</p>') + '</div>';
    h += '<a class="card" href="#van-khan" style="display:block;text-decoration:none;color:inherit"><h3>✎ Văn khấn</h3><div class="note">Văn khấn ngày giỗ, rằm, Tết, Thanh minh – tự điền tên và ngày</div></a>';
    h += '<a class="card" href="#dat-ten" style="display:block;text-decoration:none;color:inherit"><h3>✦ Đặt tên cho con cháu</h3><div class="note">Kiểm tra tên có trùng ông bà, tổ tiên không</div></a>';
    h += '<div class="card"><h3>Chia sẻ cho người trong họ</h3><p class="small" style="margin:0 0 8px">Gửi đường link này kèm mã của họ qua Zalo:</p><div class="bar"><input readonly value="' + esc(location.href.split('#')[0]) + '" style="flex:1"><button data-act="copy-link">Sao chép</button></div></div>';
    h += '<div class="card"><h3>Quản lý gia phả</h3>' + (ADMIN ? '<p class="small">Bạn đang ở chế độ quản trị: có thể sửa thông tin, thêm người, ghi ngày giỗ, ẩn lời tưởng nhớ không phù hợp.</p><div class="bar"><button data-act="tudong-open">Nhà thờ họ</button><button data-act="backup">Tải bản sao lưu</button><label class="btn" style="margin:0;color:var(--ink);font-size:15px">Nhập bản sao lưu<input type="file" id="imp" accept=".json,application/json" style="display:none"></label><button class="ghost" data-act="admin-out">Thoát quản trị</button></div>' :
      '<p class="note" style="margin-top:0">Dành cho người được họ giao quản lý.</p><div class="bar"><input id="adm" type="password" placeholder="Mã quản trị" style="flex:1"><button data-act="admin-in">Vào</button></div><p class="err" id="admErr"></p>') + '</div>';
    if (MODE === 'live') h += '<button class="ghost block" data-act="logout">Đổi mã / thoát khỏi gia phả trên máy này</button>';
    h += '<p class="note" style="text-align:center;margin-top:16px">' + DATA.people.filter(function (p) { return !p.ph; }).length + ' người' + (UPDATED ? ' · cập nhật ' + ago(UPDATED) : '') + '</p>';
    return h;
  }

  /* ---------------- sự kiện ---------------- */
  document.addEventListener('click', function (e) {
    var go_ = e.target.closest('[data-go]');
    var a = e.target.closest('[data-act]');
    if (a) {
      var act = a.getAttribute('data-act'), id = a.getAttribute('data-id');
      if (act === 'tg') { e.stopPropagation(); collapsed[id] = !collapsed[id]; render(); return; }
      if (act === 'exp') { collapsed = {}; render(); }
      else if (act === 'col') { order.forEach(function (p) { if (depth[p.id] >= 1 && kids[p.id].length) collapsed[p.id] = true; }); render(); }
      else if (act === 'close') { editing = null; delArm = false; render(); }
      else if (act === 'edit') { editing = { p: JSON.parse(JSON.stringify(byId[id])) }; delArm = false; render(); }
      else if (act === 'add-child') { var par = byId[id]; editing = { isNew: true, p: { id: newId(), n: (par.n.split(' ')[0] || 'Nguyễn') + ' ', g: 'm', p: id } }; render(); }
      else if (act === 'add-root') { editing = { isNew: true, p: { id: newId(), n: 'Nguyễn ', g: 'm' } }; render(); }
      else if (act === 'ed-save') saveEditor();
      else if (act === 'ed-del') {
        if (!delArm) { delArm = true; render(); return; }
        var did = editing.p.id, before = JSON.stringify(DATA), par2 = byId[did].p;
        DATA.people = DATA.people.filter(function (p) { return p.id !== did; });
        persist(before, function () { editing = null; delArm = false; go(par2 ? 'nguoi-' + par2 : 'gia-pha'); toast('Đã xóa.'); });
      }
      else if (act === 'light') { editing = { light: id }; render(); }
      else if (act === 'light-go') {
        var nm = $('#lt_name').value.trim(), msg = $('#lt_msg').value.trim();
        if (nm) ls('gp-ten', nm);
        a.disabled = true; a.textContent = 'Đang thắp…';
        store.light(id, nm || null, msg || null).then(function () {
          ls('gp-lit-' + id, L.todayVN().join('-')); counts[id] = (counts[id] || 0) + 1; editing = null; personMsgs[id] = null; render(); loadMsgs(id); refreshRecent();
        }).catch(function (er) { a.disabled = false; a.textContent = 'Thắp hương'; $('#lt_err').textContent = 'Chưa gửi được: ' + er.message; });
      }
      else if (act === 'del-msg') { store.delIncense(+a.getAttribute('data-mid')).then(function () { loadMsgs(id); toast('Đã ẩn.'); }).catch(function (er) { toast(er.message); }); }
      else if (act === 'push-on') pushEnable();
      else if (act === 'push-off') pushDisable();
      else if (act === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(); }); }
      else if (act === 'copy-link') { navigator.clipboard.writeText(location.href.split('#')[0]).then(function () { toast('Đã sao chép link.'); }, function () { toast('Chưa sao chép được, hãy giữ và chọn link.'); }); }
      else if (act === 'admin-in') {
        var c = $('#adm').value.trim(); if (!c) { $('#admErr').textContent = 'Nhập mã quản trị.'; return; }
        store.checkAdmin(c).then(function (ok) { if (ok) { ADMIN = c; ss('gp-qt', c); toast('Đã vào chế độ quản trị.'); render(); } else $('#admErr').textContent = 'Mã quản trị chưa đúng.'; }).catch(function (er) { $('#admErr').textContent = er.message; });
      }
      else if (act === 'admin-out') { ADMIN = null; ss('gp-qt', null); render(); }
      else if (act === 'logout') { ls('gp-ma', null); CODE = null; DATA = null; ADMIN = null; ss('gp-qt', null); render(); }
      else if (act === 'backup') { var blob = new Blob([JSON.stringify(DATA, null, 1)], { type: 'application/json' }); var u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'gia-pha-' + L.todayVN().reverse().join('-') + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); }
      else if (act === 'sug') { nameState.ten = a.getAttribute('data-v'); $('#n_ten').value = nameState.ten; $('#nameRes').innerHTML = nameResult(); $('#nameRes').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      else if (act === 'vk-for') { vkState.dip = 'gio'; vkState.id = id; }
      else if (act === 'vk-lg') { vkState.lg = !vkState.lg; render(); }
      else if (act === 'ph-open-td') { var t0 = DATA.tuDuong; editing = { photo: { id: t0.photo, thumb: photoCache[t0.photo] || '', caption: t0.ten || 'Nhà thờ họ', album: 'Nhà thờ họ', created_at: new Date().toISOString(), uploader: '' } }; render(); }
      else if (act === 'up-open') { editing = { upload: { person: id || '' } }; render(); }
      else if (act === 'up-go') doUpload(a);
      else if (act === 'ph-open') { var it = findPhoto(+a.getAttribute('data-pid')); if (it) { editing = { photo: it }; render(); } }
      else if (act === 'ph-tudong') { var b3 = JSON.stringify(DATA); DATA.tuDuong = DATA.tuDuong || {}; DATA.tuDuong.photo = editing.photo.id; persist(b3, function () { editing = null; render(); toast('Đã đặt làm ảnh nhà thờ họ.'); }); }
      else if (act === 'ph-portrait') { var b4 = JSON.stringify(DATA); byId[editing.photo.person_id].anh = editing.photo.id; persist(b4, function () { editing = null; render(); toast('Đã đặt làm ảnh chân dung.'); }); }
      else if (act === 'ph-del') {
        if (!delArm) { delArm = true; render(); return; }
        var pid = editing.photo.id;
        store.delPhoto(pid).then(function () {
          var b5 = JSON.stringify(DATA), ch = false;
          if (DATA.tuDuong && DATA.tuDuong.photo === pid) { delete DATA.tuDuong.photo; ch = true; }
          DATA.people.forEach(function (x) { if (x.anh === pid) { delete x.anh; ch = true; } });
          var done = function () { editing = null; delArm = false; dropPhoto(pid); render(); toast('Đã xóa ảnh.'); };
          if (ch && ADMIN) persist(b5, done); else done();
        }).catch(function (er) { toast(er.message); });
      }
      else if (act === 'alb-filter') { album.filter = a.getAttribute('data-v'); album.items = null; render(); loadAlbum(); }
      else if (act === 'alb-more') loadAlbum(true);
      else if (act === 'tudong-open') { editing = { tudong: true }; render(); }
      else if (act === 'tudong-save') saveTuDuong(a);
      else if (act === 'vk-copy') { navigator.clipboard.writeText($('#vkText').textContent).then(function () { toast('Đã sao chép văn khấn.'); }, function () { toast('Chưa sao chép được.'); }); }
      else if (act === 'add-ev') {
        var tt = $('#e_t').value.trim(), dd = num($('#e_d').value, 1, 30), mm = num($('#e_m').value, 1, 12), er2 = $('#e_err');
        if (!tt) { er2.textContent = 'Nhập tên ngày.'; return; } if (!dd || !mm || isNaN(dd) || isNaN(mm)) { er2.textContent = 'Ngày 1–30, tháng 1–12.'; return; }
        var b1 = JSON.stringify(DATA); DATA.events.push({ t: tt, d: dd, m: mm }); persist(b1, function () { render(); toast('Đã thêm.'); });
      }
      else if (act === 'del-ev') { var b2 = JSON.stringify(DATA); DATA.events.splice(+a.getAttribute('data-i'), 1); persist(b2, function () { render(); }); }
      return;
    }
    if (go_) { go(go_.getAttribute('data-go')); return; }
    if (e.target.id === 'ov') { editing = null; delArm = false; render(); }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'q') { query = e.target.value; var pos = e.target.selectionStart; render(); var q = $('#q'); q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { } }
    else if (id === 'n_ho' || id === 'n_dem' || id === 'n_ten') { nameState[id.slice(2)] = e.target.value; $('#nameRes').innerHTML = nameResult(); }
    else if (id === 'vk_tc' || id === 'vk_dc') { vkState[id === 'vk_tc' ? 'tinchu' : 'diachi'] = e.target.value; ls(id === 'vk_tc' ? 'gp-tinchu' : 'gp-diachi', e.target.value); $('#vkText').textContent = vkText(); }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'n_g') { nameState.g = e.target.value; render(); }
    else if (id === 'n_par') { nameState.par = e.target.value; $('#nameRes').innerHTML = nameResult(); }
    else if (id === 'c_rem') { calRemind = +e.target.value; ls('gp-remind', String(calRemind)); render(); }
    else if (id === 'c_mon') { calMonthly = e.target.checked; ls('gp-monthly', calMonthly ? '1' : '0'); render(); }
    else if (id === 'vk_dip') { vkState.dip = e.target.value; render(); }
    else if (id === 'vk_id') { vkState.id = e.target.value; render(); }
    else if (id === 'vk_xung') { vkState.xung = e.target.value; $('#vkText').textContent = vkText(); }
    else if (id === 'imp') {
      var f = e.target.files[0]; if (!f) return;
      f.text().then(function (t) { var d = JSON.parse(t); if (!d.people || !d.people.length) throw new Error('x'); var before = JSON.stringify(DATA); DATA = d; DATA.events = DATA.events || []; persist(before, function () { render(); toast('Đã nạp ' + d.people.length + ' người.'); }); }).catch(function () { toast('File không đúng định dạng gia phả.'); });
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'gateForm') return; e.preventDefault();
    var c = $('#gateCode').value.trim(); if (!c) { $('#gateErr').textContent = 'Nhập mã của họ.'; return; }
    CODE = c; $('#gateErr').textContent = 'Đang kiểm tra…';
    store.load().then(function () { ls('gp-ma', c); afterLoad(); }).catch(function (er) { CODE = null; $('#gateErr').textContent = er.code === 'sai_ma' ? 'Mã chưa đúng, bạn kiểm tra lại nhé.' : 'Chưa kết nối được: ' + er.message; });
  });

  var lastRoute = '';
  window.addEventListener('hashchange', function () {
    editing = null; delArm = false;
    render(); window.scrollTo(0, 0);
    onEnter();
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; if (route().v === 'them') render(); });

  /* ---------------- ảnh ---------------- */
  function onEnter() { var r = route(); if (r.v === 'nguoi') { loadMsgs(r.id); loadPersonPhotos(r.id); } if (r.v === 'ky-niem' && !album.items) loadAlbum(); }
  function hydrate() {
    var lb = document.querySelector('.lbbox img[data-photo]');
    if (lb && !photoCache[+lb.getAttribute('data-photo')]) { var lid = +lb.getAttribute('data-photo'); store.photo(lid).then(function (u) { if (u) { photoCache[lid] = u; var el = document.querySelector('.lbbox img[data-photo="' + lid + '"]'); if (el) { el.src = u; el.style.filter = ''; } } }).catch(function () { }); }
    document.querySelectorAll('img[data-photo]').forEach(function (im) {
      var id = +im.getAttribute('data-photo'); if (!id || im.getAttribute('src')) return;
      if (photoCache[id]) { im.src = photoCache[id]; return; }
      store.photo(id).then(function (u) { if (u) { photoCache[id] = u; document.querySelectorAll('img[data-photo="' + id + '"]').forEach(function (x) { x.src = u; }); } }).catch(function () { });
    });
  }
  function findPhoto(id) { var all = (album.items || []).concat.apply(album.items || [], Object.keys(personPhotos).map(function (k) { return personPhotos[k] || []; })); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function dropPhoto(id) { if (album.items) album.items = album.items.filter(function (x) { return x.id !== id; }); Object.keys(personPhotos).forEach(function (k) { if (personPhotos[k]) personPhotos[k] = personPhotos[k].filter(function (x) { return x.id !== id; }); }); delete photoCache[id]; }
  function gridHtml(items, empty) {
    if (!items) return '<p class="note" style="margin:0">Đang tải ảnh…</p>';
    if (!items.length) return '<p class="note" style="margin:0">' + esc(empty) + '</p>';
    return '<div class="grid">' + items.map(function (x) { return '<button class="th" data-act="ph-open" data-pid="' + x.id + '" aria-label="' + esc(x.caption || 'Xem ảnh') + '"><img src="' + x.thumb + '" alt="" loading="lazy"></button>'; }).join('') + '</div>';
  }
  function loadAlbum(more) {
    var before = more && album.items && album.items.length ? album.items[album.items.length - 1].id : null;
    store.photos({ album: album.filter || null, before: before }).then(function (r) { r = r || []; album.items = (more ? (album.items || []) : []).concat(r); album.more = r.length >= 60; if (route().v === 'ky-niem' && !editing) render(); }).catch(function (e) { album.items = []; toast('Chưa tải được ảnh: ' + e.message); });
  }
  function loadPersonPhotos(id) { store.photos({ person: id }).then(function (r) { personPhotos[id] = r || []; var b = document.getElementById('pphotos'); if (b) b.innerHTML = gridHtml(personPhotos[id], 'Chưa có ảnh nào.'); }).catch(function () { personPhotos[id] = []; }); }
  function viewAlbum() {
    var h = '<div class="bar" style="justify-content:space-between;margin-bottom:10px"><h2 style="margin:0">Ảnh kỷ niệm của họ</h2><button class="pri" data-act="up-open">+ Thêm ảnh</button></div>';
    h += '<div class="chips" style="margin-bottom:12px">' + [''].concat(ALBUMS).map(function (a) { return '<button class="chip' + (album.filter === a ? ' on' : '') + '" data-act="alb-filter" data-v="' + esc(a) + '">' + (a || 'Tất cả') + '</button>'; }).join('') + '</div>';
    h += '<div class="card">' + gridHtml(album.items, album.filter ? 'Chưa có ảnh trong mục này.' : 'Chưa có ảnh nào. Hãy là người đầu tiên chia sẻ ảnh nhà thờ họ, ảnh giỗ Tết hay ảnh xưa của ông bà.') + (album.more ? '<button class="block" data-act="alb-more" style="margin-top:10px">Xem thêm ảnh</button>' : '') + '</div>';
    h += '<p class="note">Ảnh được nén gọn trước khi tải lên và chỉ người có mã của họ mới xem được. Mọi người trong họ đều có thể thêm ảnh; người quản lý có thể xóa ảnh không phù hợp.</p>';
    return h;
  }
  function tuDuongHtml() {
    var t = DATA.tuDuong || {}, name = t.ten || ('Nhà thờ ' + HO.replace(/^Họ /, 'họ '));
    if (!t.photo && !t.dc && !t.gt) return ADMIN ? '<div class="card tdempty"><div><b>' + esc(name) + '</b><div class="note">Chưa có ảnh và thông tin nhà thờ họ.</div></div><button class="small" data-act="tudong-open">Thêm</button></div>' : '';
    var map = t.dc ? (/^https?:\/\//.test(t.map || '') ? t.map : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.dc)) : '';
    return '<div class="tudong">' + (t.photo ? '<button class="tdimg" data-act="ph-open-td"><img data-photo="' + t.photo + '" alt="' + esc(name) + '"></button>' : '') +
      '<div class="tdbody"><div class="tdname">' + esc(name) + '</div>' + (t.dc ? '<div class="small">' + esc(t.dc) + ' · <a href="' + esc(map) + '" target="_blank" rel="noopener">Chỉ đường</a></div>' : '') + (t.gt ? '<div class="small tdgt">' + esc(t.gt) + '</div>' : '') + (ADMIN ? '<button class="ghost small" data-act="tudong-open" style="padding:4px 0">Sửa</button>' : '') + '</div></div>';
  }
  function tuDuongSheet() {
    var t = DATA.tuDuong || {};
    return '<div class="overlay" id="ov"><div class="sheet"><div class="bar" style="justify-content:space-between"><h2 style="margin:0">Nhà thờ họ</h2><button class="ghost" data-act="close" aria-label="Đóng">✕</button></div>' +
      (t.photo ? '<div class="tdprev"><img data-photo="' + t.photo + '" alt=""></div>' : '') +
      '<label>' + (t.photo ? 'Đổi ảnh nhà thờ họ' : 'Ảnh nhà thờ họ') + '</label><input type="file" id="td_file" accept="image/*">' +
      '<label>Tên</label><input id="td_ten" value="' + esc(t.ten || ('Nhà thờ ' + HO.replace(/^Họ /, 'họ '))) + '">' +
      '<label>Địa chỉ</label><input id="td_dc" value="' + esc(t.dc || '') + '" placeholder="Thôn …, xã …, huyện …, tỉnh …">' +
      '<label>Link bản đồ (không bắt buộc)</label><input id="td_map" value="' + esc(t.map || '') + '" placeholder="Dán link Google Maps">' +
      '<label>Đôi dòng về nhà thờ họ</label><textarea id="td_gt" rows="3" placeholder="Năm xây dựng, lần trùng tu, ngày giỗ tổ…">' + esc(t.gt || '') + '</textarea>' +
      '<p class="err" id="td_err"></p><button class="pri block" data-act="tudong-save">Lưu</button></div></div>';
  }
  function saveTuDuong(btn) {
    var f = $('#td_file').files[0], before = JSON.stringify(DATA);
    var t = DATA.tuDuong = DATA.tuDuong || {};
    ['ten', 'dc', 'map', 'gt'].forEach(function (k) { var v = $('#td_' + k).value.trim(); if (v) t[k] = v; else delete t[k]; });
    btn.disabled = true; btn.textContent = f ? 'Đang tải ảnh…' : 'Đang lưu…';
    var step = f ? prepImage(f).then(function (im) { return store.upload({ album: 'Nhà thờ họ', caption: t.ten || '', uploader: ls('gp-ten') || null, thumb: im.thumb, full: im.full }).then(function (id) { t.photo = id; photoCache[id] = im.full; album.items = null; }); }) : Promise.resolve();
    step.then(function () { persist(before, function () { editing = null; render(); toast('Đã lưu thông tin nhà thờ họ.'); }); })
      .catch(function (e) { DATA = JSON.parse(before); btn.disabled = false; btn.textContent = 'Lưu'; $('#td_err').textContent = 'Chưa lưu được: ' + e.message; });
  }
  function loadImg(file) { return new Promise(function (res, rej) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { res(im); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); }; im.onerror = function () { rej(new Error('Không đọc được ảnh “' + file.name + '”. Hãy chọn ảnh JPG hoặc PNG.')); }; im.src = u; }); }
  function shrink(im, max, q, limit) {
    var w = im.naturalWidth, h = im.naturalHeight, sc = Math.min(1, max / Math.max(w, h)), out = '';
    for (var i = 0; i < 7; i++) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc)); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q); if (out.length <= limit) break; q = Math.max(0.5, q - 0.08); sc *= 0.85; }
    return out;
  }
  function prepImage(file) { return loadImg(file).then(function (im) { return { full: shrink(im, 1600, 0.82, 650000), thumb: shrink(im, 420, 0.72, 70000) }; }); }
  function uploadSheet() {
    var u = editing.upload, pers = order.filter(function (o) { return !o.ph; });
    return '<div class="overlay" id="ov"><div class="sheet"><div class="bar" style="justify-content:space-between"><h2 style="margin:0">Thêm ảnh kỷ niệm</h2><button class="ghost" data-act="close" aria-label="Đóng">✕</button></div>' +
      '<label>Chọn ảnh (chọn được nhiều ảnh)</label><input type="file" id="up_files" accept="image/*" multiple>' +
      '<label>Mục</label><select id="up_album">' + ALBUMS.map(function (a) { return '<option ' + ((u.album || (u.person ? 'Ảnh xưa' : 'Giỗ chạp – Tết')) === a ? 'selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' +
      '<label>Ảnh về ai (không bắt buộc)</label><select id="up_person"><option value="">(Không gắn với ai)</option>' + pers.map(function (o) { return '<option value="' + o.id + '" ' + (o.id === u.person ? 'selected' : '') + '>' + esc(o.n) + (years(o) ? ' (' + years(o) + ')' : '') + '</option>'; }).join('') + '</select>' +
      '<label>Chú thích</label><input id="up_cap" maxlength="300" placeholder="vd: Giỗ cụ Bính năm 2025 tại nhà thờ họ">' +
      '<label>Người đăng</label><input id="up_name" maxlength="60" value="' + esc(ls('gp-ten') || '') + '" placeholder="Tên của bạn">' +
      '<p class="err" id="up_err"></p><button class="pri block" data-act="up-go">Tải ảnh lên</button></div></div>';
  }
  function doUpload(btn) {
    var files = Array.prototype.slice.call($('#up_files').files || []); if (!files.length) { $('#up_err').textContent = 'Chọn ít nhất 1 ảnh.'; return; }
    if (files.length > 20) { $('#up_err').textContent = 'Mỗi lần tải tối đa 20 ảnh.'; return; }
    var o = { album: $('#up_album').value, person: $('#up_person').value || null, caption: $('#up_cap').value.trim(), uploader: $('#up_name').value.trim() };
    if (o.uploader) ls('gp-ten', o.uploader);
    btn.disabled = true; var i = 0, ok = 0;
    (function next() {
      if (i >= files.length) { editing = null; album.items = null; if (o.person) personPhotos[o.person] = null; render(); onEnter(); toast('Đã tải lên ' + ok + ' ảnh.'); return; }
      btn.textContent = 'Đang tải ' + (i + 1) + '/' + files.length + '…';
      prepImage(files[i]).then(function (im) { return store.upload({ album: o.album, person: o.person, caption: o.caption, uploader: o.uploader, thumb: im.thumb, full: im.full }).then(function (id) { photoCache[id] = im.full; ok++; }); })
        .catch(function (e) { $('#up_err').textContent = e.code === 'qua_nhieu' ? 'Đã tải nhiều ảnh quá, đợi ít phút rồi tải tiếp.' : e.message; })
        .then(function () { i++; next(); });
    })();
  }
  function lightboxHtml() {
    var x = editing.photo, p = x.person_id ? byId[x.person_id] : null;
    return '<div class="overlay lb" id="ov"><div class="lbbox"><button class="lbx" data-act="close" aria-label="Đóng">✕</button><img data-photo="' + x.id + '" ' + (photoCache[x.id] ? '' : 'style="filter:blur(2px)" ') + 'src="' + (photoCache[x.id] || x.thumb) + '" alt="' + esc(x.caption || '') + '">' +
      '<div class="lbcap">' + (x.caption ? '<div>' + esc(x.caption) + '</div>' : '') + '<div class="note">' + esc(x.album || '') + (p ? ' · <a href="#nguoi-' + p.id + '">' + esc(p.n) + '</a>' : '') + ' · ' + esc(x.uploader || 'Người trong họ') + ' đăng ' + ago(x.created_at) + '</div>' +
      (ADMIN ? '<div class="bar" style="margin-top:8px"><button class="small" data-act="ph-tudong">Làm ảnh nhà thờ họ</button>' + (p ? '<button class="small" data-act="ph-portrait">Làm ảnh chân dung</button>' : '') + '<button class="small ghost danger" data-act="ph-del">' + (delArm ? 'Bấm lần nữa để xóa' : 'Xóa ảnh') + '</button></div>' : '') + '</div></div></div>';
  }
  function refreshRecent() { store.list(null).then(function (r) { recent = r || []; var b = document.getElementById('recentBox'); if (b) b.innerHTML = recentHtml(); }).catch(function () { }); }
  function afterLoad() {
    render();
    store.counts().then(function (c) { counts = c || {}; if (route().v === 'nguoi') render(); }).catch(function () { });
    refreshRecent();
    onEnter();
    checkPush();
  }

  /* ---------------- khởi động ---------------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') { navigator.serviceWorker.register('sw.js').catch(function () { }); }
  if (MODE === 'live' && !CODE) render();
  else store.load().then(afterLoad).catch(function (er) {
    if (er.code === 'sai_ma') { ls('gp-ma', null); CODE = null; DATA = null; document.getElementById('app').innerHTML = gateHtml('Mã của họ đã được đổi. Nhập mã mới nhé.'); }
    else { document.getElementById('app').innerHTML = '<div class="gate"><div class="card">Chưa tải được gia phả: ' + esc(er.message) + '<br><br><button class="pri" onclick="location.reload()">Thử lại</button></div></div>'; }
  });
})();
