// Подписка из "Карты самопознания" в MailerLite.
// Ключ API хранится в Netlify: Site configuration -> Environment variables -> MAILERLITE_API_KEY.
// Группы указаны по ID, чтобы не искать их по названию при каждой отправке.

const API = "https://connect.mailerlite.com/api";

const QUIZ_GROUPS = {
  love: "205139819363305080", // Карта: Языки любви
  aware: "205151079291160036", // Карта: Самоосознанность
  esteem: "205151079745193488", // Карта: Самооценка
  mindset: "205151080230684221", // Карта: Тип мышления
};
const NEWSLETTER_GROUP = process.env.NEWSLETTER_GROUP_ID || "198069116802697159"; // Life by Design — Newsletter

// lbd_l1..lbd_l5 и lbd_l1_text..lbd_l5_text - части результата с описаниями (языки любви).
// Каждое поле в MailerLite вмещает до 1024 символов, поэтому описания идут в отдельных полях.
const PARTS = 5;

async function ml(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API + path, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`MailerLite ${res.status} ${options.method || "GET"} ${path}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

const clean = (v, max = 1000) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function partFields(parts) {
  const list = Array.isArray(parts) ? parts.slice(0, PARTS) : [];
  const out = {};
  for (let i = 0; i < PARTS; i++) {
    out[`lbd_l${i + 1}`] = clean(list[i]?.t, 200);
    out[`lbd_l${i + 1}_text`] = clean(list[i]?.d, 1000);
  }
  return out;
}

export default async (req) => {
  // Диагностика без отправки писем: GET ?check=1 показывает, видит ли функция ключ и отвечает ли MailerLite.
  if (req.method === "GET" && new URL(req.url).searchParams.get("check") === "1") {
    const out = { configured: Boolean(process.env.MAILERLITE_API_KEY), keyLength: (process.env.MAILERLITE_API_KEY || "").length };
    try { await ml(`/groups/${QUIZ_GROUPS.love}`); out.mailerlite = "ok"; } catch (e) { out.mailerlite = String(e.message || e).slice(0, 300); }
    return json(out);
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!process.env.MAILERLITE_API_KEY) return json({ error: "not configured" }, 500);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // Ловушка для ботов: настоящие люди это поле не видят и не заполняют.
  if (b.website) return json({ ok: true });

  const email = clean(b.email, 200).toLowerCase();
  const name = clean(b.name, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) return json({ error: "invalid" }, 400);
  const qid = QUIZ_GROUPS[b.quiz];
  if (!qid) return json({ error: "quiz" }, 400);

  try {
    // Создает подписчицу или обновляет существующую (не удаляя ее из других групп).
    const sub = (await ml("/subscribers", {
      method: "POST",
      body: JSON.stringify({
        email,
        fields: {
          name,
          lbd_test: clean(b.test, 200),
          lbd_result: clean(b.result, 300),
          lbd_details: clean(b.details),
          lbd_question: clean(b.ask, 400),
          ...partFields(b.parts),
        },
        groups: b.newsletter === true ? [NEWSLETTER_GROUP] : [],
      }),
    })).data;

    // Добавляем в группу теста заново, чтобы письмо пришло и при повторном прохождении.
    const inGroup = (sub.groups || []).some((g) => String(g.id) === qid);
    if (inGroup) await ml(`/subscribers/${sub.id}/groups/${qid}`, { method: "DELETE" });
    await ml(`/subscribers/${sub.id}/groups/${qid}`, { method: "POST" });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "mailerlite", detail: String(e.message || e).slice(0, 300) }, 502);
  }
};
