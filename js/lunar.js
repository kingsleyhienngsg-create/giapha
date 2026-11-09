/* Âm lịch Việt Nam – thuật toán Hồ Ngọc Đức, múi giờ +7. Dùng chung cho app (trình duyệt) và script nhắc giỗ (Node). */
(function (root) {
  var PI = Math.PI, TZ = 7;
  function INT(d) { return Math.floor(d); }
  function jdFromDate(dd, mm, yy) { var a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3; var jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045; if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083; return jd; }
  function jdToDate(jd) { var a, b, c; if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); } else { b = 0; c = jd + 32082; } var d = INT((4 * c + 3) / 1461), e = c - INT((1461 * d) / 4), m = INT((5 * e + 2) / 153); return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)]; }
  function NewMoon(k) { var T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180; var Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3; Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr); var M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3; var Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3; var F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3; var C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M); C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr); C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr); C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr)); C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M)); C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr)); C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M)); var dt; if (T < -11) dt = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3; else dt = -0.000278 + 0.000265 * T + 0.000262 * T2; return Jd1 + C1 - dt; }
  function SunLongitude(jdn) { var T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180; var M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2; var L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2; var DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M); DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M); var L = (L0 + DL) * dr; L = L - PI * 2 * INT(L / (PI * 2)); return L; }
  function getSunLongitude(dn) { return INT(SunLongitude(dn - 0.5 - TZ / 24) / PI * 6); }
  function getNewMoonDay(k) { return INT(NewMoon(k) + 0.5 + TZ / 24); }
  function getLunarMonth11(yy) { var off = jdFromDate(31, 12, yy) - 2415021; var k = INT(off / 29.530588853); var nm = getNewMoonDay(k); if (getSunLongitude(nm) >= 9) nm = getNewMoonDay(k - 1); return nm; }
  function getLeapMonthOffset(a11) { var k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5); var last = 0, i = 1; var arc = getSunLongitude(getNewMoonDay(k + i)); do { last = arc; i++; arc = getSunLongitude(getNewMoonDay(k + i)); } while (arc != last && i < 14); return i - 1; }
  function solar2lunar(dd, mm, yy) { var dn = jdFromDate(dd, mm, yy); var k = INT((dn - 2415021.076998695) / 29.530588853); var ms = getNewMoonDay(k + 1); if (ms > dn) ms = getNewMoonDay(k); var a11 = getLunarMonth11(yy), b11 = a11, ly; if (a11 >= ms) { ly = yy; a11 = getLunarMonth11(yy - 1); } else { ly = yy + 1; b11 = getLunarMonth11(yy + 1); } var ld = dn - ms + 1; var diff = INT((ms - a11) / 29); var leap = 0; var lm = diff + 11; if (b11 - a11 > 365) { var lmd = getLeapMonthOffset(a11); if (diff >= lmd) { lm = diff + 10; if (diff == lmd) leap = 1; } } if (lm > 12) lm -= 12; if (lm >= 11 && diff < 4) ly -= 1; return [ld, lm, ly, leap]; }
  function lunar2solar(ld, lm, ly, leap) { var a11, b11; if (lm < 11) { a11 = getLunarMonth11(ly - 1); b11 = getLunarMonth11(ly); } else { a11 = getLunarMonth11(ly); b11 = getLunarMonth11(ly + 1); } var k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853); var off = lm - 11; if (off < 0) off += 12; if (b11 - a11 > 365) { var lo = getLeapMonthOffset(a11); var lpm = lo - 2; if (lpm < 0) lpm += 12; if (leap && lm != lpm) return [0, 0, 0]; else if (leap || off >= lo) off += 1; } var ms = getNewMoonDay(k + off); return jdToDate(ms + ld - 1); }

  var CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  var CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  var WD = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  function canchi(y) { return CAN[(y + 6) % 10] + ' ' + CHI[(y + 8) % 12]; }
  function weekday(jd) { return WD[(jd + 1) % 7]; }

  /* Ngày hôm nay theo giờ Việt Nam (UTC+7), bất kể máy đang ở múi giờ nào */
  function todayVN(now) { var t = new Date((now || Date.now()) + 7 * 3600 * 1000); return [t.getUTCDate(), t.getUTCMonth() + 1, t.getUTCFullYear()]; }
  function jdTodayVN(now) { var p = todayVN(now); return jdFromDate(p[0], p[1], p[2]); }

  /* jd của ngày âm d/m năm âm ly; tháng thiếu không có ngày 30 thì lùi về 29 */
  function lunarJd(d, m, ly) { var s = lunar2solar(d, m, ly, 0); if (!s[0]) return null; if (d === 30) { var b = solar2lunar(s[0], s[1], s[2]); if (b[0] !== 30) s = lunar2solar(29, m, ly, 0); } return jdFromDate(s[0], s[1], s[2]); }
  function nextLunar(d, m, fromJd) { var t = fromJd, s = jdToDate(t), ly = solar2lunar(s[0], s[1], s[2])[2]; for (var y = ly - 1; y <= ly + 2; y++) { var jd = lunarJd(d, m, y); if (jd !== null && jd >= t) return { jd: jd, ly: y }; } return null; }
  function thanhMinh(y) { for (var d = 1; d <= 10; d++) { var jd = jdFromDate(d, 4, y); var a = SunLongitude(jd - 0.5 - TZ / 24), b = SunLongitude(jd + 0.5 - TZ / 24); if (a < PI / 12 && b >= PI / 12) return jd; } return jdFromDate(5, 4, y); }
  function fmt(jd) { var s = jdToDate(jd); return s[0] + '/' + s[1] + '/' + s[2]; }
  function ymd(jd) { var s = jdToDate(jd); return s[2] + String(s[1]).padStart(2, '0') + String(s[0]).padStart(2, '0'); }

  var FIXED = [
    [1, 1, 'Tết Nguyên Đán', 'Mùng 1 Tết'], [15, 1, 'Rằm tháng Giêng', 'Tết Nguyên Tiêu'], [3, 3, 'Tết Hàn thực', ''],
    [5, 5, 'Tết Đoan Ngọ', ''], [15, 7, 'Rằm tháng Bảy', 'Vu Lan · xá tội vong nhân'], [15, 8, 'Tết Trung thu', ''],
    [23, 12, 'Ông Công ông Táo', 'Tiễn Táo quân về trời']
  ];
  function yearsOf(p) { if (p.b && p.d) return p.b + '–' + p.d; if (p.b) return 'sinh ' + p.b; if (p.d) return 'mất ' + p.d; return ''; }

  /* Danh sách sự kiện trong `days` ngày tới, tính từ fromJd */
  function events(data, fromJd, days, opt) {
    opt = opt || {}; var t = fromJd, end = t + (days || 366), out = [];
    function add(jd, title, sub, kind, id) { if (jd !== null && jd >= t && jd < end) out.push({ jd: jd, title: title, sub: sub, kind: kind, id: id }); }
    (data.people || []).forEach(function (p) { if (p.gd && p.gm) { var n = nextLunar(p.gd, p.gm, t); if (n) add(n.jd, 'Giỗ ' + p.n, 'Âm lịch ' + p.gd + '/' + p.gm + (yearsOf(p) ? ' · ' + yearsOf(p) : ''), 'gio', p.id); } });
    FIXED.forEach(function (f) { var n = nextLunar(f[0], f[1], t); if (n) add(n.jd, f[2], 'Âm lịch ' + f[0] + '/' + f[1] + (f[3] ? ' · ' + f[3] : ''), 'le'); });
    var s = jdToDate(t), ly = solar2lunar(s[0], s[1], s[2])[2];
    [ly, ly + 1].forEach(function (y) { var j = lunarJd(1, 1, y + 1); if (j) add(j - 1, 'Cúng Tất niên', 'Ngày cuối năm âm lịch ' + canchi(y), 'le'); });
    [s[2], s[2] + 1].forEach(function (y) { add(thanhMinh(y), 'Tiết Thanh minh', 'Tảo mộ, thăm mồ mả tổ tiên', 'le'); });
    (data.events || []).forEach(function (e, i) { var n = nextLunar(e.d, e.m, t); if (n) add(n.jd, e.t, 'Âm lịch ' + e.d + '/' + e.m + ' · ngày của họ', 'rieng', i); });
    if (opt.monthly) { var l = solar2lunar(s[0], s[1], s[2]); var m = l[1], y = l[2]; for (var i = 0; i < 14; i++) { [1, 15].forEach(function (d) { if (m === 1 || (m === 7 && d === 15)) return; add(lunarJd(d, m, y), d === 1 ? 'Mùng 1 tháng ' + m : 'Rằm tháng ' + m, 'Âm lịch ' + d + '/' + m, 'thang'); }); m++; if (m > 12) { m = 1; y++; } } }
    var seen = {}; out = out.filter(function (e) { var k = e.jd + '|' + e.title; if (seen[k]) return false; seen[k] = 1; return true; });
    out.sort(function (a, b) { return a.jd - b.jd; }); return out;
  }

  var Lunar = { jdFromDate: jdFromDate, jdToDate: jdToDate, solar2lunar: solar2lunar, lunar2solar: lunar2solar, lunarJd: lunarJd, nextLunar: nextLunar, thanhMinh: thanhMinh, canchi: canchi, weekday: weekday, todayVN: todayVN, jdTodayVN: jdTodayVN, fmt: fmt, ymd: ymd, events: events, yearsOf: yearsOf, FIXED: FIXED };
  if (typeof module !== 'undefined' && module.exports) module.exports = Lunar; else root.Lunar = Lunar;
})(typeof self !== 'undefined' ? self : this);
