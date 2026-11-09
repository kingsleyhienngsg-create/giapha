/* Gửi thông báo nhắc giỗ mỗi sáng (chạy bằng GitHub Actions).
   Biến môi trường (đặt trong GitHub → Settings → Secrets and variables → Actions):
   SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (vd mailto:ban@gmail.com), APP_URL
   Tùy chọn: NHAC_TRUOC (mặc định "3,0" = báo trước 3 ngày và đúng ngày), THU=1 để gửi thử ngay. */
const webpush = require('web-push');
const L = require('../js/lunar.js');

const env = (k, d) => (process.env[k] || d || '').trim();
const URL_ = env('SUPABASE_URL').replace(/\/$/, '');
const KEY = env('SUPABASE_SERVICE_KEY');
const APP = env('APP_URL', './');
const TRUOC = env('NHAC_TRUOC', '3,0').split(',').map(Number).filter(n => !isNaN(n));
const THU = env('THU') === '1' || env('THU') === 'true';

async function sb(path, opt = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + path, { ...opt, headers: { apikey: KEY, ...(/^eyJ/.test(KEY) ? { Authorization: 'Bearer ' + KEY } : {}), 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(path + ' → ' + r.status + ' ' + await r.text());
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

function buildMessage(data, today) {
  const evs = L.events(data, today, Math.max(...TRUOC, 0) + 1, { monthly: true });
  const lines = [];
  for (const e of evs) {
    const d = e.jd - today;
    if (!TRUOC.includes(d)) continue;
    if (e.kind === 'thang' && d !== 0) continue;          // mùng 1, rằm: chỉ báo đúng ngày
    const when = d === 0 ? 'Hôm nay' : `Còn ${d} ngày (${L.weekday(e.jd)} ${L.fmt(e.jd)})`;
    lines.push({ d, text: `${when}: ${e.title}`, id: e.kind === 'gio' ? e.id : null });
  }
  if (!lines.length) return null;
  lines.sort((a, b) => a.d - b.d);
  const first = lines[0];
  return {
    title: first.d === 0 ? 'Hôm nay: ' + lines.filter(l => l.d === 0).map(l => l.text.replace('Hôm nay: ', '')).join(', ') : 'Nhắc giỗ – ' + env('TEN_HO', 'Gia phả họ Nguyễn Duy'),
    body: lines.map(l => l.text).join('\n'),
    url: APP + (lines.find(l => l.id) ? '#nguoi-' + lines.find(l => l.id).id : '#lich'),
    tag: 'nhac-gio-' + L.ymd(today)
  };
}

async function main() {
  if (!URL_ || !KEY) throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY');
  webpush.setVapidDetails(env('VAPID_SUBJECT', 'mailto:admin@example.com'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const fam = await sb('family?id=eq.1&select=data');           // lần gọi này cũng giữ cho Supabase không bị "ngủ"
  const data = (fam && fam[0] && fam[0].data) || { people: [] };
  const today = L.jdTodayVN();
  let msg = buildMessage(data, today);
  if (THU) msg = { title: 'Thử thông báo – Gia phả', body: msg ? msg.body : 'Nhắc giỗ đã hoạt động. Hôm nay không có ngày giỗ, lễ nào cần báo.', url: APP, tag: 'thu' };
  if (!msg) { console.log(L.fmt(today), '– không có gì cần nhắc.'); return; }
  const subs = await sb('push_subs?select=endpoint,sub');
  console.log(L.fmt(today), '–', msg.title, '| gửi tới', subs.length, 'máy');
  let ok = 0, gone = 0;
  for (const s of subs) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(msg), { TTL: 6 * 3600 }); ok++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { gone++; await sb('push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), { method: 'DELETE' }); }
      else console.log('Lỗi gửi:', e.statusCode, e.body || e.message);
    }
  }
  console.log('Đã gửi', ok, '· xóa', gone, 'máy không còn dùng');
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { buildMessage };
