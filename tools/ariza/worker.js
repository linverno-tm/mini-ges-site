/* MINI GES: the enquiry form posts here, the Worker forwards it to Telegram through a bot.
   The visitor no longer has to press "Send" in Telegram: the lead arrives even without the app.

   Secrets (never in the repo):  TG_TOKEN  — bot token from @BotFather
                                 TG_CHAT   — chat id(s) that receive leads, comma separated
   Vars (wrangler.jsonc):        ALLOWED_ORIGINS — sites allowed to post (the form's origin)
   Optional binding:             LIMIT — Workers rate limiting (5 leads a minute per IP)          */

const MAX = { name: 80, phone: 20, region: 60, source: 30, msg: 600, lang: 2, page: 200 };

export default {
  async fetch(req, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return reply({ ok: false, error: 'method' }, 405);
    if (!allowed.includes(origin)) return reply({ ok: false, error: 'origin' }, 403);
    if (!env.TG_TOKEN || !env.TG_CHAT) return reply({ ok: false, error: 'not configured' }, 503);

    if (env.LIMIT) {
      const ip = req.headers.get('CF-Connecting-IP') || 'x';
      const { success } = await env.LIMIT.limit({ key: ip });
      if (!success) return reply({ ok: false, error: 'rate' }, 429);
    }

    let d;
    try { d = JSON.parse((await req.text()).slice(0, 4000)); } catch { return reply({ ok: false, error: 'json' }, 400); }
    if (!d || typeof d !== 'object') return reply({ ok: false, error: 'json' }, 400);
    if (d.website) return reply({ ok: true });          // honeypot filled: a bot, pretend all is well

    const f = {};
    for (const [k, n] of Object.entries(MAX)) f[k] = String(d[k] ?? '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, n);
    const digits = f.phone.replace(/\D/g, '');
    if (f.name.length < 2 || digits.length < 9 || digits.length > 15 || !f.region) return reply({ ok: false, error: 'fields' }, 422);

    const when = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
    const text = [
      '⚡ Saytdan yangi ariza (MINI GES)',
      '',
      `Ism: ${f.name}`,
      `Telefon: ${f.phone}`,
      `Hudud: ${f.region}`,
      f.source ? `Yo'nalish: ${f.source}` : null,
      f.msg ? `Izoh: ${f.msg}` : null,
      '',
      `${when} · til: ${f.lang || 'uz'}`,
      f.page || null,
    ].filter(v => v != null).join('\n');

    // plain text (no parse_mode): nothing the visitor types can turn into markup
    const sent = await Promise.all(env.TG_CHAT.split(',').map(s => s.trim()).filter(Boolean).map(chat_id =>
      fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text, link_preview_options: { is_disabled: true } }),
      }).then(r => r.ok, () => false)));

    return sent.some(Boolean) ? reply({ ok: true }) : reply({ ok: false, error: 'telegram' }, 502);
  },
};
