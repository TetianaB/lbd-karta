// Подписка из "Карты самопознания" в MailerLite.
// Ключ API хранится в Netlify: Site configuration -> Environment variables -> MAILERLITE_API_KEY.
// Группы и поля в MailerLite создаются автоматически при первой отправке.

const API = "https://connect.mailerlite.com/api";

const QUIZ_GROUPS = {
  love: "Карта: Языки любви",
  aware: "Карта: Самоосознанность",
  esteem: "Карта: Самооценка",
  mindset: "Карта: Тип мышления",
};
const NEWSLETTER_GROUP = process.env.NEWSLETTER_GROUP || "Life by Design — Newsletter";
const FIELDS = ["lbd_test", "lbd_result", "lbd_details", "lbd_question"];

const cache = { groups: {}, fieldsReady: false };

async function ml(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`MailerLite ${res.status} ${path}: ${text.slice(0, 300)}`);
  return data;
}

async function groupId(name) {
  if (cache.groups[name]) return cache.groups[name];
  const found = await ml(`/groups?limit=100&filter[name]=${encodeURIComponent(name)}`);
  let g = (found.data || []).find((x) => x.name === name);
  if (!g) g = (await ml("/groups", { method: "POST", body: JSON.stringify({ name }) })).data;
  cache.groups[name] = g.id;
  return g.id;
}

async function ensureFields() {
  if (cache.fieldsReady) return;
  const existing = (await ml("/fields?limit=100")).data || [];
  for (const key of FIELDS) {
    if (!existing.some((f) => f.key === key)) {
      await ml("/fields", { method: "POST", body: JSON.stringify({ name: key, type: "text" }) });
    }
  }
  cache.fieldsReady = true;
}

const clean = (v, max = 1000) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!process.env.MAILERLITE_API_KEY) return json({ error: "not configured" }, 500);

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // Ловушка для ботов: настоящие люди это поле не видят и не заполняют.
  if (b.website) return json({ ok: true });

  const email = clean(b.email, 200).toLowerCase();
  const name = clean(b.name, 100);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) return json({ error: "invalid" }, 400);
  const quizGroup = QUIZ_GROUPS[b.quiz];
  if (!quizGroup) return json({ error: "quiz" }, 400);

  try {
    await ensureFields();
    const qid = await groupId(quizGroup);
    const groups = [];
    if (b.newsletter === true) groups.push(await groupId(NEWSLETTER_GROUP));

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
        },
        groups,
      }),
    })).data;

    // Добавляем в группу теста заново, чтобы автоматизация с письмом сработала и при повторном прохождении.
    const inGroup = (sub.groups || []).some((g) => g.id === qid);
    if (inGroup) await ml(`/subscribers/${sub.id}/groups/${qid}`, { method: "DELETE" });
    await ml(`/subscribers/${sub.id}/groups/${qid}`, { method: "POST" });

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "mailerlite" }, 502);
  }
};
