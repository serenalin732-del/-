export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = corsOrigin(request, env);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin);

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return cors(json({
          ok: true,
          service: "credit-card-butler-worker",
          hasSupabaseUrl: Boolean(env.SUPABASE_URL),
          hasServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
          hasEncryptionSecret: Boolean(env.KEY_ENCRYPTION_SECRET),
          hasEmailProvider: Boolean(env.RESEND_API_KEY && env.FROM_EMAIL),
          aiProviders: Object.keys(PROVIDER_DEFAULTS),
          defaultProvider: (env.AI_PROVIDER || "openai").toLowerCase(),
          aiModelDefaults: PROVIDER_DEFAULTS,
          aiTaskTiers: TASK_TIER
        }), origin);
      }

      if (url.pathname === "/api-keys" && request.method === "GET") return cors(await listApiKeys(request, env), origin);
      if (url.pathname === "/api-keys" && request.method === "POST") return cors(await saveApiKey(request, env), origin);
      if (url.pathname === "/card-benefits" && request.method === "POST") return cors(await suggestCardBenefits(request, env), origin);
      if (url.pathname === "/ai-summary" && request.method === "POST") return cors(await createAiSummary(request, env), origin);
      if (url.pathname === "/parse-statement" && request.method === "POST") return cors(await parseStatement(request, env), origin);
      if (url.pathname === "/send-reminders" && request.method === "POST") return cors(await sendDueReminders(env), origin);
      if (url.pathname === "/test-email" && request.method === "POST") return cors(await sendTestEmail(request, env), origin);
      if (url.pathname === "/test-key" && request.method === "POST") return cors(await testKey(request, env), origin);

      return cors(json({ ok: false, error: "Not found" }, 404), origin);
    } catch (error) {
      return cors(json({ ok: false, error: error.message || "Worker error" }, 500), origin);
    }
  },

  async scheduled(_event, env) {
    await sendDueReminders(env);
  }
};

// CORS origin policy. Set ALLOWED_ORIGINS (comma-separated, e.g.
// "https://benefit-butler.pages.dev,https://your-domain.com") in the Worker
// variables to restrict access. If unset, stays "*" (backward compatible).
function corsOrigin(request, env) {
  const allow = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!allow.length) return "*";
  const origin = request.headers.get("origin") || "";
  return allow.includes(origin) ? origin : allow[0];
}

function cors(response, origin = "*") {
  response.headers.set("access-control-allow-origin", origin);
  if (origin !== "*") response.headers.set("vary", "Origin");
  response.headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  response.headers.set("access-control-allow-headers", "authorization,content-type");
  return response;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function getUser(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing auth token");

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) throw new Error("Invalid auth token");
  return response.json();
}

async function supabase(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) throw new Error(await response.text());
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function encryptionKey(secret) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptText(text, secret) {
  if (!secret) throw new Error("Missing KEY_ENCRYPTION_SECRET");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptText(payload, secret) {
  if (!payload) return "";
  const [ivText, encryptedText] = payload.split(".");
  const iv = Uint8Array.from(atob(ivText), (char) => char.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedText), (char) => char.charCodeAt(0));
  const key = await encryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

async function saveApiKey(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const provider = String(body.provider || "openai").toLowerCase();
  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) throw new Error("Missing API key");

  const encryptedKey = await encryptText(apiKey, env.KEY_ENCRYPTION_SECRET);
  const lastFour = apiKey.slice(-4);
  await supabase(env, "user_api_keys?on_conflict=user_id,provider", {
    method: "POST",
    // merge-duplicates makes this a real upsert; without it, re-saving a key for
    // the same (user, provider) hits the unique constraint (23505).
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      provider,
      encrypted_key: encryptedKey,
      last_four: lastFour,
      status: "active",
      last_tested_at: new Date().toISOString()
    })
  });

  return json({ ok: true, provider, lastFour, message: "API key saved in Worker backend only." });
}

async function listApiKeys(request, env) {
  const user = await getUser(request, env);
  const rows = await supabase(env, `user_api_keys?user_id=eq.${encodeURIComponent(user.id)}&select=provider,last_four,status,last_tested_at,created_at`);
  return json({ ok: true, keys: rows || [] });
}

async function getUserApiKey(env, userId, provider = "openai") {
  const rows = await supabase(env, `user_api_keys?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${encodeURIComponent(provider)}&status=eq.active&select=encrypted_key&limit=1`);
  if (!rows?.length) throw new Error("No active API key saved for this user.");
  return decryptText(rows[0].encrypted_key, env.KEY_ENCRYPTION_SECRET);
}

// Real validation: make a tiny live call with the saved key + chosen
// provider/model so "test key" actually confirms it works.
async function testKey(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const cfg = aiConfig(body, env);
  const apiKey = await getUserApiKey(env, user.id, cfg.provider);
  const model = resolveModel(cfg, "classify");
  const out = await callAIText({ env, apiKey, cfg, task: "classify", content: "Reply with the single word: OK", json: false });
  return json({ ok: true, provider: cfg.provider, model, sample: String(out).slice(0, 60) });
}

async function suggestCardBenefits(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const cfg = aiConfig(body, env);
  const cardName = String(body.cardName || body.name || "").trim();
  const rawBank = String(body.bank || body.issuer || "").trim();
  const bank = normalizeIssuerName(rawBank);
  const normalizedCardName = normalizeCardSearchName(bank, cardName);
  if (!cardName) throw new Error("Missing card name");

  const apiKey = await getUserApiKey(env, user.id, cfg.provider);
  const prompt = `Find the latest official issuer information for this credit card: ${bank} ${normalizedCardName}.
Important:
- Use the issuer's official website first.
- BOA means Bank of America.
- If the card is Alaska from Bank of America, look for Atmos Rewards Ascent Visa Signature / Alaska Airlines Visa Signature, not American Express.
Return only JSON:
{
  "card": {"name": "", "bank": "", "annualFee": 0, "sourceUrl": ""},
  "rewardRules": {"program": "", "defaultRate": 1, "rates": {"dining": 1, "groceries": 1, "gas_ev": 1, "hotel": 1, "flight": 1, "travel": 1, "everyday": 1}},
  "benefits": [{
    "name": "",
    "benefitType": "recurring_credit|annual_perk|welcome_bonus|one_time|elite_status|other",
    "value": 0,
    "period": "annual|semiannual|monthly|quarterly|one_time",
    "installmentValue": 0,
    "resetRule": "monthly use-it-or-lose-it|quarterly use-it-or-lose-it|semiannual use-it-or-lose-it|calendar year|anniversary year|multi-year|unknown",
    "rollover": "no|yes|unknown",
    "requiresActivation": false,
    "eligibleUse": "",
    "trackingRecommendation": "auto|review|manual",
    "description": "",
    "sourceUrl": ""
  }],
  "notes": []
}
For each benefit, be explicit about whether the value is total annual value or per-month/per-period value. If the official page says monthly credits expire or do not roll over, say that. If not confirmed, use "unknown" and state that the user should verify in their account.
Classify each item with benefitType: sign-up / welcome offers => "welcome_bonus"; credits that recur (monthly/quarterly/semiannual/annual statement credits) => "recurring_credit"; yearly perks like a free night award or companion pass => "annual_perk"; one-time credits such as Global Entry/TSA every 4 years => "one_time"; elite or loyalty status => "elite_status"; anything else => "other". Do not present welcome/sign-up bonuses as recurring annual value.
Use official bank pages when possible. If unsure, mark notes clearly.`;

  const result = await callAIJson({ env, apiKey, cfg, task: "cardBenefits", content: prompt, webSearch: true });
  const normalized = normalizeCardBenefitResult(result, bank, normalizedCardName);
  return json({ ok: true, result: normalized, ...normalized });
}

function normalizeIssuerName(value = "") {
  const text = String(value || "").trim();
  if (/^(boa|bofa)$/i.test(text)) return "Bank of America";
  if (/amex/i.test(text)) return "American Express";
  return text;
}

function normalizeCardSearchName(bank = "", cardName = "") {
  const value = String(cardName || "").trim();
  const text = `${bank} ${value}`.toLowerCase();
  if (text.includes("bank of america") && text.includes("alaska")) {
    return "Atmos Rewards Ascent Visa Signature Alaska Airlines credit card";
  }
  return value;
}

function normalizeCardBenefitResult(result = {}, fallbackBank = "", fallbackCardName = "") {
  const card = result.card || {};
  const sourceUrls = [
    card.sourceUrl,
    ...(result.benefits || []).map(item => item.sourceUrl)
  ].filter(Boolean);
  const cycleMap = {
    annual: "calendar",
    yearly: "calendar",
    calendar_year: "calendar",
    semiannual: "semiannual",
    half_year: "semiannual",
    monthly: "monthly",
    quarterly: "quarterly",
    one_time: "custom",
    anniversary: "anniversary"
  };
  return {
    issuer: card.bank || fallbackBank,
    cardName: card.name || fallbackCardName,
    annualFee: Number(card.annualFee || result.annualFee || 0),
    rewardRules: result.rewardRules || {},
    sourceUrls: [...new Set(sourceUrls)],
    notes: result.notes || [],
    benefits: (result.benefits || []).map(item => ({
      name: item.name || "Unnamed benefit",
      benefitType: String(item.benefitType || "").toLowerCase().replace(/[^a-z_]/g, "") ||
        (String(item.period || item.cycle || "").toLowerCase() === "one_time" ? "one_time" : "recurring_credit"),
      value: Number(item.value || 0),
      cycle: cycleMap[String(item.cycle || item.period || "calendar").toLowerCase()] || "calendar",
      activation: item.requiresActivation === true || String(item.activation || "").toLowerCase() === "yes" ? "yes" : "no",
      tracking: item.tracking || item.trackingRecommendation || "review",
      notes: buildBenefitNotes(item),
      sourceUrl: item.sourceUrl || card.sourceUrl || ""
    }))
  };
}

function buildBenefitNotes(item = {}) {
  const notes = [];
  if (item.description) notes.push(item.description);
  if (item.installmentValue) notes.push(`Per-period amount: $${Number(item.installmentValue || 0)}.`);
  if (item.resetRule) notes.push(`Reset/expiration rule: ${item.resetRule}.`);
  if (item.rollover) notes.push(`Rollover: ${item.rollover}.`);
  if (item.eligibleUse) notes.push(`Eligible use: ${item.eligibleUse}.`);
  if (item.requiresActivation) notes.push("Activation or enrollment may be required.");
  if (item.sourceUrl) notes.push(`Source: ${item.sourceUrl}`);
  if (item.notes) notes.push(item.notes);
  return notes.filter(Boolean).join(" ");
}

async function createAiSummary(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const cfg = aiConfig(body, env);
  const apiKey = await getUserApiKey(env, user.id, cfg.provider);
  const prompt = `Summarize this user's credit card benefits and reward usage. Return JSON with keys summary, wins, missed, nextActions.\n\n${JSON.stringify(body).slice(0, 18000)}`;
  const task = String(body.summaryType || "") === "advisor" ? "advisor" : "summary";
  const result = await callAIJson({ env, apiKey, cfg, task, content: prompt });

  // Persisting the summary is best-effort: never fail the user's request just
  // because logging to the database hiccupped.
  try {
    await supabase(env, "ai_summaries", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        summary_type: String(body.summaryType || "manual"),
        provider: cfg.provider,
        summary_text: typeof result === "string" ? result : JSON.stringify(result),
        summary_data: result
      })
    });
  } catch (error) {
    // ignore: summary is still returned below
  }

  return json({ ok: true, result });
}

async function parseStatement(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const documentId = body.documentId;
  if (!documentId) throw new Error("Missing documentId");

  const rows = await supabase(env, `uploaded_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`);
  if (!rows?.length) throw new Error("Document not found");

  const document = rows[0];
  const file = await downloadStorageObject(
    env,
    document.bucket_id || document.bucket || "private-documents",
    document.object_path || document.path || document.storage_path
  );
  const parsed = await parseUploadedStatement({
    env,
    user,
    file,
    fileName: document.original_filename || document.file_name || document.name || "statement",
    mimeType: document.mime_type || "",
    cardId: body.cardId || document.card_id,
    cardRules: body.cardRules || {},
    cfg: aiConfig(body, env)
  });

  await supabase(env, `uploaded_documents?id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "parsed",
      extracted_data: parsed
    })
  });

  return json({ ok: true, ...parsed });
}

async function downloadStorageObject(env, bucket, objectPath) {
  if (!bucket || !objectPath) throw new Error("Missing storage path");
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!response.ok) throw new Error(await response.text());
  return new Uint8Array(await response.arrayBuffer());
}

async function parseUploadedStatement({ env, user, file, fileName, mimeType, cardId, cardRules, cfg }) {
  const name = String(fileName || "").toLowerCase();
  const type = String(mimeType || "").toLowerCase();
  const isCsv = name.endsWith(".csv") || name.endsWith(".tsv") || type.includes("csv") || type.includes("tab-separated");
  const isText = name.endsWith(".txt") || type.startsWith("text/");

  if (isCsv || isText) {
    const text = new TextDecoder().decode(file);
    if (isCsv) {
      const delimiter = name.endsWith(".tsv") || type.includes("tab-separated") ? "\t" : detectDelimiter(text);
      const rows = parseDelimited(text, delimiter);
      const transactions = normalizeRows(rows);
      if (!transactions.length) throw new Error("No transactions found in CSV/TSV file.");
      const enriched = estimateRewards(transactions, cardRules, cardId);
      return {
        parser: "csv-rule",
        message: "CSV/TSV parsed quickly with card reward rules.",
        transactions: enriched,
        summary: summarizeTransactions(enriched)
      };
    }

    const extracted = await aiExtractTextStatement(env, user.id, text, fileName, cardRules, cfg);
    const enriched = estimateRewards(extracted.transactions || [], cardRules, cardId);
    return {
      parser: "ai-text",
      message: "Text statement parsed by AI and reward rules.",
      transactions: enriched,
      summary: summarizeTransactions(enriched),
      raw: extracted
    };
  }

  const extracted = await aiExtractStatement(env, user.id, file, fileName, mimeType, cardRules, cfg);
  const enriched = estimateRewards(extracted.transactions || [], cardRules, cardId);
  return {
    parser: "ai-file",
    message: "File parsed by AI and reward rules.",
    transactions: enriched,
    summary: summarizeTransactions(enriched),
    raw: extracted
  };
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseDelimited(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(value);
      value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] ?? "";
    });
    return item;
  });
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const merchant = pick(row, ["merchant", "description", "name", "payee", "vendor"]);
    const description = pick(row, ["description", "details", "memo", "category", "transaction_description"]);
    const amount = parseMoney(pick(row, ["amount", "debit", "charge", "transaction_amount", "posted_amount"])) || 0;
    const points = parseNumber(pick(row, ["points", "rewards", "reward_points", "earned_points"])) || 0;
    return {
      date: pick(row, ["date", "transaction_date", "posted_date", "post_date"]),
      merchant: merchant || description || "Unknown",
      description,
      amount,
      category: classifyCategory(merchant, description),
      points,
      raw: row
    };
  }).filter((transaction) => transaction.merchant !== "Unknown" || transaction.amount);
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function parseMoney(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  const number = Number(text.replace(/[(),$+\s]/g, ""));
  if (!Number.isFinite(number)) return 0;
  return negative ? -Math.abs(number) : number;
}

function parseNumber(value) {
  const number = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

// Ordered merchant -> category rules. More specific / higher-priority first
// (e.g. warehouse clubs before the generic grocery rule, since Costco/Sam's
// usually earn the base rate rather than the grocery multiplier).
const MERCHANT_CATEGORY = [
  [/\b(costco|sam'?s club|bj'?s wholesale)\b/, "everyday"],
  [/\b(whole foods|trader joe'?s?|safeway|kroger|publix|wegmans|aldi|sprouts|h-?e-?b|ralphs|albertsons|food lion|stop & shop|supermarket|grocery)\b/, "groceries"],
  [/\b(marriott|ritz|sheraton|westin|hilton|hampton inn|hyatt|ihg|holiday inn|wyndham|airbnb|vrbo|hotel|motel|lodging|resort)\b/, "hotel"],
  [/\b(delta|united airlines|american airlines|southwest|jetblue|alaska air|spirit air|frontier air|hawaiian air|airline|airfare)\b/, "flight"],
  [/\b(uber(?! eats)|lyft|taxi|transit|metro|parking|amtrak|train|rail|rental car|avis|hertz|enterprise rent|national car|budget rent)\b/, "travel"],
  [/\b(tesla supercharger|electrify america|evgo|chargepoint|ev charg)\b/, "gas_ev"],
  [/\b(shell|chevron|exxon|mobil|conoco|sunoco|valero|marathon|speedway|gas station|fuel)\b/, "gas_ev"],
  [/\b(restaurant|grill|kitchen|cafe|coffee|starbucks|dunkin|panera|chipotle|mcdonald|doordash|uber eats|ubereats|grubhub|seamless|bar|pub|brewery|tavern|diner|bistro|pizzeria)\b/, "dining"],
  [/\b(netflix|spotify|hulu|disney\+|youtube premium|apple music|paramount|subscription|software|adobe|microsoft 365|openai|anthropic|claude|google one|icloud|dropbox)\b/, "services"],
  [/\b(walmart|target|amazon|best buy|walgreens|cvs|dollar general)\b/, "everyday"]
];

function classifyCategory(merchant = "", description = "") {
  const text = `${merchant} ${description}`.toLowerCase();
  if (/payment|autopay|mobile payment|refund|credit received/.test(text)) return "credit";
  if (/interest|fee|finance charge|late charge|cash advance/.test(text)) return "fee";
  for (const [pattern, category] of MERCHANT_CATEGORY) {
    if (pattern.test(text)) return category;
  }
  return "everyday";
}

function isNonRewardTransaction(transaction = {}) {
  const text = `${transaction.merchant || ""} ${transaction.description || ""} ${transaction.category || ""}`.toLowerCase();
  return /payment|autopay|mobile payment|refund|credit received|interest|fee|finance charge|late charge|cash advance/.test(text);
}

function estimateRewards(transactions, cardRules = {}, cardId = "") {
  const rules = cardRules || {};
  const rates = rules.rates || rules.categoryRates || {};
  const defaultRate = Number(rules.defaultRate || rules.default_rate || 1);
  const program = rules.program || rules.rewardProgram || rules.pointsProgram || "points";

  return (transactions || []).map((transaction) => {
    const amount = Number(transaction.amount || 0);
    const category = transaction.category || classifyCategory(transaction.merchant, transaction.description);
    if (isNonRewardTransaction({ ...transaction, category })) {
      return { ...transaction, cardId, rewardProgram: program, category, multiplier: 0, points: 0, rewardReason: "No rewards for payments, credits, fees, or interest." };
    }

    const multiplier = Number(transaction.multiplier || rates[category] || defaultRate || 1);
    const existingPoints = Number(transaction.points || 0);
    const points = existingPoints > 0 ? existingPoints : Math.max(0, Math.round(Math.abs(amount) * multiplier));
    return { ...transaction, cardId, rewardProgram: program, category, multiplier, points, rewardReason: `${multiplier}x ${category}` };
  });
}

function summarizeTransactions(transactions) {
  const list = transactions || [];
  return {
    transactionCount: list.length,
    totalAmount: Math.round(list.reduce((sum, item) => sum + Number(item.amount || 0), 0) * 100) / 100,
    totalPoints: list.reduce((sum, item) => sum + Number(item.points || 0), 0),
    byCategory: list.reduce((summary, item) => {
      const category = item.category || "everyday";
      summary[category] = summary[category] || { amount: 0, points: 0, count: 0 };
      summary[category].amount = Math.round((summary[category].amount + Number(item.amount || 0)) * 100) / 100;
      summary[category].points += Number(item.points || 0);
      summary[category].count += 1;
      return summary;
    }, {})
  };
}

async function aiExtractTextStatement(env, userId, text, fileName, cardRules = {}, cfg = aiConfig({}, env)) {
  const apiKey = await getUserApiKey(env, userId, cfg.provider);
  const prompt = `Extract credit card transactions from this text statement named ${fileName}.
Return only JSON: {"transactions":[{"date":"","merchant":"","description":"","amount":0,"category":"","points":0,"multiplier":0}],"notes":[]}
If points are not directly shown, leave points as 0. Card rules for later reward estimation: ${JSON.stringify(cardRules)}

TEXT:
${text.slice(0, 40000)}`;
  return callAIJson({ env, apiKey, cfg, task: "extract", content: prompt });
}

async function aiExtractStatement(env, userId, file, fileName, mimeType, cardRules = {}, cfg = aiConfig({}, env)) {
  const apiKey = await getUserApiKey(env, userId, cfg.provider);
  const lowerName = String(fileName || "").toLowerCase();
  const type = mimeType || (lowerName.endsWith(".pdf") ? "application/pdf" : "image/png");
  const data = bytesToBase64(file);
  const instruction = `Read this statement or screenshot and extract transactions. Return only JSON: {"transactions":[{"date":"","merchant":"","description":"","amount":0,"category":"","points":0,"multiplier":0}],"notes":[]}. If points are not visible, set points to 0. Card rules for later reward estimation: ${JSON.stringify(cardRules)}`;
  const isPdf = type.includes("pdf") || lowerName.endsWith(".pdf");
  const content = [
    { kind: "text", text: instruction },
    isPdf
      ? { kind: "file", mime: type, data, filename: fileName || "statement.pdf" }
      : { kind: "image", mime: type, data }
  ];
  return callAIJson({ env, apiKey, cfg, task: "extract", content });
}

// ---- AI provider routing (bring-your-own provider) -----------------------
// The chosen provider plus the user's stored key for that provider decide where
// requests go. Models are picked per task: a cheap model for extraction /
// parsing / card lookup, a stronger model only for advisory summaries — so an
// expensive model is never used by accident, and the model name can be
// overridden per provider from Settings.
const PROVIDER_DEFAULTS = {
  openai: { fast: "gpt-4.1-mini", strong: "gpt-4.1", search: true },
  anthropic: { fast: "claude-haiku-4-5", strong: "claude-sonnet-4-6", search: false },
  gemini: { fast: "gemini-2.0-flash", strong: "gemini-2.5-pro", search: true },
  custom: { fast: "", strong: "", search: false }
};

const TASK_TIER = {
  extract: "fast",
  classify: "fast",
  cardBenefits: "fast",
  summary: "fast",
  advisor: "strong"
};

function aiConfig(body = {}, env = {}) {
  const provider = String(body.provider || env.AI_PROVIDER || "openai").toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;
  return {
    provider,
    defaults,
    baseUrl: String(body.aiBaseUrl || "").trim(),
    modelOverride: String(body.aiModel || "").trim()
  };
}

function resolveModel(cfg, task) {
  if (cfg.modelOverride) return cfg.modelOverride; // explicit user choice wins
  const tier = TASK_TIER[task] || "fast";
  return cfg.defaults[tier] || cfg.defaults.fast || "";
}

// Normalized content: a string, or an array of parts:
//   { kind: "text", text }
//   { kind: "image", mime, data }            (data = base64)
//   { kind: "file",  mime, data, filename }
function asParts(content) {
  if (Array.isArray(content)) return content;
  return [{ kind: "text", text: String(content) }];
}

function parseAiJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI returned empty output");
  try {
    return JSON.parse(raw);
  } catch {
    const slice = extractJsonObject(raw);
    if (slice) {
      try {
        return JSON.parse(slice);
      } catch {
        // fall through to the readable error
      }
    }
    throw new Error(`AI returned non-JSON output: ${raw.slice(0, 400)}`);
  }
}

async function callAIText({ env, apiKey, cfg, task, content, webSearch = false, json = false }) {
  const model = resolveModel(cfg, task);
  if (!model) throw new Error(`No model configured for provider "${cfg.provider}". Set a model name in Settings.`);
  const useSearch = webSearch && cfg.defaults.search;
  if (cfg.provider === "anthropic") return callAnthropic({ apiKey, model, parts: asParts(content), json });
  if (cfg.provider === "gemini") return callGemini({ apiKey, model, parts: asParts(content), json, webSearch: useSearch });
  if (cfg.provider === "custom") return callOpenAiCompatible({ baseUrl: cfg.baseUrl, apiKey, model, parts: asParts(content), json });
  return callOpenAiResponses({ apiKey, model, parts: asParts(content), json, webSearch: useSearch });
}

async function callAIJson(opts) {
  return parseAiJson(await callAIText({ ...opts, json: true }));
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.[0]?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : "") ||
      `AI request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

// OpenAI Responses API (also the default provider).
async function callOpenAiResponses({ apiKey, model, parts, json, webSearch }) {
  const content = parts.map((p) => {
    if (p.kind === "image") return { type: "input_image", image_url: `data:${p.mime};base64,${p.data}` };
    if (p.kind === "file") return { type: "input_file", filename: p.filename || "file", file_data: `data:${p.mime};base64,${p.data}` };
    return { type: "input_text", text: p.text || "" };
  });
  const body = { model, input: [{ role: "user", content }] };
  if (webSearch) {
    body.tools = [{ type: "web_search_preview", search_context_size: "low" }];
    body.tool_choice = "auto";
  } else if (json) {
    body.text = { format: { type: "json_object" } };
  }
  const payload = await postJson("https://api.openai.com/v1/responses", { authorization: `Bearer ${apiKey}` }, body);
  const out = extractOutputText(payload);
  if (!out) throw new Error("OpenAI returned empty output");
  return out;
}

// Anthropic Messages API.
async function callAnthropic({ apiKey, model, parts, json }) {
  const content = parts.map((p) => {
    if (p.kind === "image") return { type: "image", source: { type: "base64", media_type: p.mime, data: p.data } };
    if (p.kind === "file") return { type: "document", source: { type: "base64", media_type: p.mime || "application/pdf", data: p.data } };
    return { type: "text", text: p.text || "" };
  });
  const body = { model, max_tokens: 4096, messages: [{ role: "user", content }] };
  if (json) body.system = "Respond with only a single valid JSON object and no other text.";
  const payload = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body
  );
  const out = (payload?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  if (!out) throw new Error("Anthropic returned empty output");
  return out;
}

// Google Gemini generateContent API.
async function callGemini({ apiKey, model, parts, json, webSearch }) {
  const gParts = parts.map((p) => {
    if (p.kind === "image" || p.kind === "file") return { inline_data: { mime_type: p.mime, data: p.data } };
    return { text: p.text || "" };
  });
  const body = { contents: [{ role: "user", parts: gParts }], generationConfig: {} };
  if (webSearch) body.tools = [{ google_search: {} }];
  else if (json) body.generationConfig.response_mime_type = "application/json";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = await postJson(url, {}, body);
  const out = (payload?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("Gemini returned empty output");
  return out;
}

// Any OpenAI-compatible endpoint (OpenRouter, Together, Azure, local, ...).
async function callOpenAiCompatible({ baseUrl, apiKey, model, parts, json }) {
  if (!baseUrl) throw new Error("Custom provider needs a base URL (set it in Settings).");
  const content = parts.map((p) => {
    if (p.kind === "image" || p.kind === "file") return { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.data}` } };
    return { type: "text", text: p.text || "" };
  });
  const body = { model, messages: [{ role: "user", content }] };
  if (json) body.response_format = { type: "json_object" };
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const payload = await postJson(endpoint, { authorization: `Bearer ${apiKey}` }, body);
  const out = payload?.choices?.[0]?.message?.content;
  if (!out) throw new Error("Custom provider returned empty output");
  return String(out);
}

function extractJsonObject(text) {
  const value = String(text || "").trim();
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first < 0 || last <= first) return "";
  return value.slice(first, last + 1);
}

function extractOutputText(payload) {
  if (payload?.output_text) return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) return content.text;
      if (content.type === "text" && content.text) return content.text;
    }
  }
  return "";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

// "Today" (YYYY-MM-DD) in a given IANA time zone, so reminders match the user's
// local calendar instead of UTC.
function todayInTimeZone(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function sendDueReminders(env) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return json({ ok: true, sent: 0, message: "Email provider is not configured." });
  }

  const nowUtc = new Date().toISOString().slice(0, 10);
  // Wide window so per-cycle dedup works across the multi-day reminder window
  // and across time zones (a user's "today" can be UTC ±1).
  const since = addDays(nowUtc, -45);
  const until = addDays(nowUtc, 2);
  const [settingsRows, profileRows, existingLogs, cards, benefits] = await Promise.all([
    supabase(env, "automation_settings?select=user_id,email_reminder_enabled,default_reminder_email,payment_reminder_days,benefit_reminder_days&limit=1000"),
    supabase(env, "profiles?select=id,timezone&limit=2000"),
    supabase(env, `reminder_logs?select=user_id,subject,created_at&created_at=gte.${since}T00:00:00Z&created_at=lt.${until}T00:00:00Z&limit=5000`),
    supabase(env, "cards?select=id,user_id,card_name,nickname,due_day,reminder_days_before,reminder_channel,reminder_email,anniversary_date&limit=1000"),
    supabase(env, "benefits?select=id,user_id,card_id,name,total_value,used_value,cycle,cycle_end,tracking_mode&limit=2000")
  ]);
  const settingsByUser = new Map((settingsRows || []).map(row => [row.user_id, row]));
  const tzByUser = new Map((profileRows || []).map(row => [row.id, row.timezone || "UTC"]));
  // Dedup by user + subject. Subjects encode the due/cycle date, so each
  // cycle/stage is emailed at most once even though the window spans days.
  const sentKeys = new Set((existingLogs || []).map(row => `${row.user_id}::${row.subject}`));
  let sent = 0;

  async function fire(userId, to, subject, text, meta) {
    const key = `${userId}::${subject}`;
    if (sentKeys.has(key)) return;
    const providerResponse = await sendEmail(env, to, subject, text);
    await supabase(env, "reminder_logs", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        channel: "email",
        recipient: to,
        subject,
        status: "sent",
        provider_response: { ...providerResponse, ...meta },
        sent_at: new Date().toISOString()
      })
    });
    sentKeys.add(key);
    sent += 1;
  }

  for (const card of cards || []) {
    const settings = settingsByUser.get(card.user_id) || {};
    if (settings.email_reminder_enabled === false) continue;
    if (!["email", "both"].includes(card.reminder_channel || "calendar")) continue;
    // Fall back to the account-wide reminder email when the card has none.
    const to = card.reminder_email || settings.default_reminder_email;
    if (!to || !card.due_day) continue;
    const today = todayInTimeZone(tzByUser.get(card.user_id));
    const label = card.nickname || card.card_name;
    const dueDate = dueDateThisMonth(Number(card.due_day), today);
    const reminderDays = Number(card.reminder_days_before ?? settings.payment_reminder_days ?? 7);
    const diff = daysBetweenDates(today, dueDate); // dueDate - today, in whole days
    // Stage the nudge: a window before (catches up if a cron run was missed),
    // the due day itself, and a single overdue nudge the day after.
    let stage = "";
    if (diff > 0 && diff <= reminderDays) stage = "upcoming";
    else if (diff === 0) stage = "due";
    else if (diff === -1) stage = "overdue";
    if (!stage) continue;
    const subject =
      stage === "overdue" ? `Payment overdue: ${label} (due ${dueDate})`
      : stage === "due" ? `Payment due today: ${label} (${dueDate})`
      : `Payment reminder: ${label} (due ${dueDate})`;
    const text =
      stage === "overdue" ? `Payment for ${label} was due ${dueDate} and may be overdue. Please confirm it is paid.`
      : stage === "due" ? `Payment for ${label} is due today (${dueDate}).`
      : `Payment for ${label} is due ${dueDate}, in ${diff} day${diff === 1 ? "" : "s"}.`;
    await fire(card.user_id, to, subject, text, { type: "payment", stage, cardId: card.id, scheduledFor: today });
  }

  const cardsById = new Map((cards || []).map(card => [card.id, card]));
  for (const benefit of benefits || []) {
    const settings = settingsByUser.get(benefit.user_id) || {};
    if (settings.email_reminder_enabled === false) continue;
    const to = settings.default_reminder_email;
    if (!to) continue;
    const remaining = Number(benefit.total_value || 0) - Number(benefit.used_value || 0);
    if (remaining <= 0) continue;
    const today = todayInTimeZone(tzByUser.get(benefit.user_id));
    const card = cardsById.get(benefit.card_id);
    const endDate = benefit.cycle_end || benefitCycleEndDate(benefit.cycle, card, today);
    if (!endDate) continue;
    const reminderDays = Number(settings.benefit_reminder_days ?? 14);
    const diff = daysBetweenDates(today, endDate); // endDate - today, in whole days
    // Remind through the run-up to expiry (and catch up if a cron run was missed).
    if (!(diff >= 0 && diff <= reminderDays)) continue;
    const subject = `Benefit reminder: ${benefit.name} (by ${endDate})`;
    const text = `Benefit reminder for ${benefit.name}${card ? ` on ${card.nickname || card.card_name}` : ""}. Cycle ends ${endDate} (in ${diff} day${diff === 1 ? "" : "s"}). Remaining tracked value: $${Math.max(0, Math.round(remaining))}.`;
    await fire(benefit.user_id, to, subject, text, { type: "benefit", benefitId: benefit.id, cardId: benefit.card_id, scheduledFor: today });
  }

  return json({ ok: true, sent });
}

async function sendTestEmail(request, env) {
  const user = await getUser(request, env);
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    throw new Error("Email provider is not configured. Add RESEND_API_KEY and FROM_EMAIL in Cloudflare Worker variables.");
  }
  const body = await request.json();
  const to = String(body.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Missing valid recipient email.");
  const subject = "Benefit Butler email test";
  const text = "This is a test email from Benefit Butler. If you received this, automated email reminders are configured correctly.";
  const providerResponse = await sendEmail(env, to, subject, text);
  await supabase(env, "reminder_logs", {
    method: "POST",
    body: JSON.stringify({
      user_id: user.id,
      channel: "email",
      recipient: to,
      subject,
      status: "sent",
      provider_response: { ...providerResponse, type: "test" },
      sent_at: new Date().toISOString()
    })
  });
  return json({ ok: true, sent: 1 });
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

// This month's payment due date (clamped to the last day for short months).
function dueDateThisMonth(day, todayText) {
  const now = new Date(`${todayText}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(Number(day) || 1, 1), lastDay);
  return new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
}

// Whole-day difference (b - a) between two YYYY-MM-DD strings.
function daysBetweenDates(aText, bText) {
  const a = new Date(`${aText}T00:00:00Z`);
  const b = new Date(`${bText}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

// Estimated end date of the benefit's current cycle. Supports calendar cycles
// and (using the card's anniversary date) cardmember-year cycles. Accepts both
// the strict schema enum values and the app's shorthand spellings.
function benefitCycleEndDate(cycle = "", card = null, todayText = new Date().toISOString().slice(0, 10)) {
  const now = new Date(`${todayText}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (cycle === "monthly") return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  if (cycle === "quarterly") return new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 0)).toISOString().slice(0, 10);
  if (cycle === "semiannual") return new Date(Date.UTC(year, month < 6 ? 6 : 12, 0)).toISOString().slice(0, 10);
  if (cycle === "calendar_year" || cycle === "calendar") return `${year}-12-31`;
  if (cycle === "anniversary_year" || cycle === "anniversary") {
    if (!card?.anniversary_date) return "";
    const ann = new Date(`${card.anniversary_date}T00:00:00Z`);
    let next = new Date(Date.UTC(year, ann.getUTCMonth(), ann.getUTCDate()));
    if (next.toISOString().slice(0, 10) <= todayText) {
      next = new Date(Date.UTC(year + 1, ann.getUTCMonth(), ann.getUTCDate()));
    }
    next.setUTCDate(next.getUTCDate() - 1); // day before next anniversary = end of current year
    return next.toISOString().slice(0, 10);
  }
  return "";
}

async function sendEmail(env, to, subject, text) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to,
      subject,
      text
    })
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
