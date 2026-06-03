export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return cors(json({
          ok: true,
          service: "credit-card-butler-worker",
          hasSupabaseUrl: Boolean(env.SUPABASE_URL),
          hasServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
          hasEncryptionSecret: Boolean(env.KEY_ENCRYPTION_SECRET),
          hasEmailProvider: Boolean(env.RESEND_API_KEY && env.FROM_EMAIL),
          openAiModel: env.OPENAI_MODEL || "gpt-5-mini",
          openAiSearchModel: env.OPENAI_SEARCH_MODEL || "gpt-5-mini",
          allowedClientModels: ["gpt-5-mini", "gpt-5"],
          aiRouter: {
            fast: "gpt-5-mini",
            balanced: "gpt-5-mini",
            advisor: "gpt-5"
          }
        }));
      }

      if (url.pathname === "/api-keys" && request.method === "GET") return cors(await listApiKeys(request, env));
      if (url.pathname === "/api-keys" && request.method === "POST") return cors(await saveApiKey(request, env));
      if (url.pathname === "/card-benefits" && request.method === "POST") return cors(await suggestCardBenefits(request, env));
      if (url.pathname === "/ai-summary" && request.method === "POST") return cors(await createAiSummary(request, env));
      if (url.pathname === "/parse-statement" && request.method === "POST") return cors(await parseStatement(request, env));
      if (url.pathname === "/send-reminders" && request.method === "POST") return cors(await sendDueReminders(env));
      if (url.pathname === "/test-email" && request.method === "POST") return cors(await sendTestEmail(request, env));

      return cors(json({ ok: false, error: "Not found" }, 404));
    } catch (error) {
      return cors(json({ ok: false, error: error.message || "Worker error" }, 500));
    }
  },

  async scheduled(_event, env) {
    await sendDueReminders(env);
  }
};

function cors(response) {
  response.headers.set("access-control-allow-origin", "*");
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

async function suggestCardBenefits(request, env) {
  const user = await getUser(request, env);
  const body = await request.json();
  const model = normalizeClientModel(body.model);
  const cardName = String(body.cardName || body.name || "").trim();
  const rawBank = String(body.bank || body.issuer || "").trim();
  const bank = normalizeIssuerName(rawBank);
  const normalizedCardName = normalizeCardSearchName(bank, cardName);
  if (!cardName) throw new Error("Missing card name");

  const apiKey = await getUserApiKey(env, user.id, "openai");
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
Use official bank pages when possible. If unsure, mark notes clearly.`;

  const result = await callOpenAiJson(env, apiKey, prompt, { webSearch: true, model });
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
  const model = normalizeClientModel(body.model);
  const apiKey = await getUserApiKey(env, user.id, "openai");
  const prompt = `Summarize this user's credit card benefits and reward usage. Return JSON with keys summary, wins, missed, nextActions.\n\n${JSON.stringify(body).slice(0, 18000)}`;
  const result = await callOpenAiJson(env, apiKey, prompt, { model });

  if (body.period) {
    await supabase(env, "ai_summaries", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        period: String(body.period),
        summary_type: String(body.summaryType || "manual"),
        content: result
      })
    });
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
    model: normalizeClientModel(body.model)
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

async function parseUploadedStatement({ env, user, file, fileName, mimeType, cardId, cardRules, model }) {
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

    const extracted = await aiExtractTextStatement(env, user.id, text, fileName, cardRules, model);
    const enriched = estimateRewards(extracted.transactions || [], cardRules, cardId);
    return {
      parser: "ai-text",
      message: "Text statement parsed by AI and reward rules.",
      transactions: enriched,
      summary: summarizeTransactions(enriched),
      raw: extracted
    };
  }

  const extracted = await aiExtractStatement(env, user.id, file, fileName, mimeType, cardRules, model);
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

function classifyCategory(merchant = "", description = "") {
  const text = `${merchant} ${description}`.toLowerCase();
  if (/payment|autopay|mobile payment|refund|credit received/.test(text)) return "credit";
  if (/interest|fee|finance charge|late charge|cash advance/.test(text)) return "fee";
  if (/marriott|hilton|hyatt|ihg|hotel|airbnb|lodging|accommodation/.test(text)) return "hotel";
  if (/delta|united|american airlines|southwest|jetblue|alaska air|airline|flight/.test(text)) return "flight";
  if (/uber|lyft|taxi|transit|parking|travel|train|rail|rental car|avis|hertz|enterprise/.test(text)) return "travel";
  if (/whole foods|trader joe|costco|safeway|kroger|grocery|supermarket/.test(text)) return "groceries";
  if (/restaurant|dining|cafe|coffee|panera|doordash|ubereats|grubhub|bar /.test(text)) return "dining";
  if (/shell|chevron|exxon|mobil|gas|fuel|evgo|chargepoint/.test(text)) return "gas_ev";
  if (/subscription|software|cloud|google|openai|anthropic|claude|service/.test(text)) return "services";
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

async function aiExtractTextStatement(env, userId, text, fileName, cardRules = {}, model = "") {
  const apiKey = await getUserApiKey(env, userId, "openai");
  const prompt = `Extract credit card transactions from this text statement named ${fileName}.
Return only JSON: {"transactions":[{"date":"","merchant":"","description":"","amount":0,"category":"","points":0,"multiplier":0}],"notes":[]}
If points are not directly shown, leave points as 0. Card rules for later reward estimation: ${JSON.stringify(cardRules)}

TEXT:
${text.slice(0, 40000)}`;
  return callOpenAiJson(env, apiKey, prompt, { model });
}

async function aiExtractStatement(env, userId, file, fileName, mimeType, cardRules = {}, model = "") {
  const apiKey = await getUserApiKey(env, userId, "openai");
  const lowerName = String(fileName || "").toLowerCase();
  const type = mimeType || (lowerName.endsWith(".pdf") ? "application/pdf" : "image/png");
  const base64 = bytesToBase64(file);
  const instruction = `Read this statement or screenshot and extract transactions. Return only JSON: {"transactions":[{"date":"","merchant":"","description":"","amount":0,"category":"","points":0,"multiplier":0}],"notes":[]}. If points are not visible, set points to 0. Card rules for later reward estimation: ${JSON.stringify(cardRules)}`;
  const isPdf = type.includes("pdf") || lowerName.endsWith(".pdf");
  const prompt = isPdf
    ? [
      { type: "input_text", text: instruction },
      { type: "input_file", filename: fileName || "statement.pdf", file_data: `data:${type};base64,${base64}` }
    ]
    : [
      { type: "input_text", text: instruction },
      { type: "input_image", image_url: `data:${type};base64,${base64}` }
    ];
  return callOpenAiJson(env, apiKey, prompt, { model });
}

function normalizeClientModel(model = "") {
  const value = String(model || "").trim().toLowerCase();
  return ["gpt-5-mini", "gpt-5"].includes(value) ? value : "";
}

async function callOpenAiJson(env, apiKey, content, options = {}) {
  const body = {
    model: options.model || (options.webSearch ? (env.OPENAI_SEARCH_MODEL || "gpt-5-mini") : (env.OPENAI_MODEL || "gpt-5-mini")),
    input: Array.isArray(content)
      ? [{ role: "user", content }]
      : [{ role: "user", content: [{ type: "input_text", text: String(content) }] }]
  };

  if (options.webSearch) {
    body.tools = [{ type: "web_search_preview", search_context_size: "low" }];
    body.tool_choice = "auto";
  } else {
    body.text = { format: { type: "json_object" } };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI request failed");

  const output = extractOutputText(payload);
  if (!output) throw new Error("OpenAI returned empty output");
  try {
    return JSON.parse(output);
  } catch {
    const jsonText = extractJsonObject(output);
    if (jsonText) {
      try {
        return JSON.parse(jsonText);
      } catch {
        // Fall through to the readable error below.
      }
    }
    throw new Error(`OpenAI returned non-JSON output: ${output.slice(0, 500)}`);
  }
}

async function callOpenAiText(env, apiKey, content, options = {}) {
  const body = {
    model: options.model || (options.webSearch ? (env.OPENAI_SEARCH_MODEL || "gpt-5-mini") : (env.OPENAI_MODEL || "gpt-5-mini")),
    input: Array.isArray(content)
      ? [{ role: "user", content }]
      : [{ role: "user", content: [{ type: "input_text", text: String(content) }] }]
  };

  if (options.webSearch) {
    body.tools = [{ type: "web_search_preview", search_context_size: "low" }];
    body.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI web search request failed");
  const output = extractOutputText(payload);
  if (!output) throw new Error("OpenAI web search returned empty output");
  return output;
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

async function sendDueReminders(env) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return json({ ok: true, sent: 0, message: "Email provider is not configured." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = addDays(today, 1);
  const [settingsRows, existingLogs, cards, benefits] = await Promise.all([
    supabase(env, "automation_settings?select=user_id,email_reminder_enabled,default_reminder_email,payment_reminder_days,benefit_reminder_days&limit=1000"),
    supabase(env, `reminder_logs?select=user_id,recipient,subject,created_at&created_at=gte.${today}T00:00:00Z&created_at=lt.${tomorrow}T00:00:00Z&limit=2000`),
    supabase(env, "cards?select=id,user_id,name,nickname,payment_due_day,reminder_days_before,reminder_channel,reminder_email&limit=1000"),
    supabase(env, "benefits?select=id,user_id,card_id,name,total_value,used_value,cycle_type,cycle_end,tracking_mode&limit=2000")
  ]);
  const settingsByUser = new Map((settingsRows || []).map(row => [row.user_id, row]));
  const sentKeys = new Set((existingLogs || []).map(row => `${row.user_id}:${row.recipient}:${row.subject}`));
  let sent = 0;

  for (const card of cards || []) {
    const settings = settingsByUser.get(card.user_id) || {};
    if (settings.email_reminder_enabled === false) continue;
    if (!["email", "both"].includes(card.reminder_channel || "calendar")) continue;
    if (!card.reminder_email || !card.payment_due_day) continue;
    const dueDate = nextMonthlyDueDate(Number(card.payment_due_day || 1));
    const reminderDays = Number(card.reminder_days_before ?? settings.payment_reminder_days ?? 7);
    const scheduledFor = addDays(dueDate, -reminderDays);
    if (scheduledFor !== today) continue;
    const subject = `Payment reminder: ${card.nickname || card.name}`;
    const text = `Payment reminder for ${card.nickname || card.name}. Due date: ${dueDate}. Reminder timing: ${reminderDays} day(s) before.`;
    const logKey = `${card.user_id}:${card.reminder_email}:${subject}`;
    if (sentKeys.has(logKey)) continue;
    const providerResponse = await sendEmail(env, card.reminder_email, subject, text);
    await supabase(env, "reminder_logs", {
      method: "POST",
      body: JSON.stringify({
        user_id: card.user_id,
        channel: "email",
        recipient: card.reminder_email,
        subject,
        status: "sent",
        provider_response: { ...providerResponse, type: "payment", cardId: card.id, scheduledFor: today },
        sent_at: new Date().toISOString()
      })
    });
    sentKeys.add(logKey);
    sent += 1;
  }

  const cardsById = new Map((cards || []).map(card => [card.id, card]));
  for (const benefit of benefits || []) {
    const settings = settingsByUser.get(benefit.user_id) || {};
    if (settings.email_reminder_enabled === false) continue;
    const to = settings.default_reminder_email;
    if (!to) continue;
    const remaining = Number(benefit.total_value || 0) - Number(benefit.used_value || 0);
    if (remaining <= 0) continue;
    const endDate = benefit.cycle_end || benefitCycleEndDate(benefit.cycle_type);
    if (!endDate) continue;
    const reminderDays = Number(settings.benefit_reminder_days ?? 14);
    const scheduledFor = addDays(endDate, -reminderDays);
    if (scheduledFor !== today) continue;
    const card = cardsById.get(benefit.card_id);
    const subject = `Benefit reminder: ${benefit.name}`;
    const text = `Benefit reminder for ${benefit.name}${card ? ` on ${card.nickname || card.name}` : ""}. Estimated cycle end: ${endDate}. Remaining tracked value: $${Math.max(0, Math.round(remaining))}.`;
    const logKey = `${benefit.user_id}:${to}:${subject}`;
    if (sentKeys.has(logKey)) continue;
    const providerResponse = await sendEmail(env, to, subject, text);
    await supabase(env, "reminder_logs", {
      method: "POST",
      body: JSON.stringify({
        user_id: benefit.user_id,
        channel: "email",
        recipient: to,
        subject,
        status: "sent",
        provider_response: { ...providerResponse, type: "benefit", benefitId: benefit.id, cardId: benefit.card_id, scheduledFor: today },
        sent_at: new Date().toISOString()
      })
    });
    sentKeys.add(logKey);
    sent += 1;
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

function nextMonthlyDueDate(day) {
  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(Math.max(day, 1), lastDay)));
  if (due.toISOString().slice(0, 10) < now.toISOString().slice(0, 10)) {
    due.setUTCMonth(due.getUTCMonth() + 1);
    const nextLastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
    due.setUTCDate(Math.min(Math.max(day, 1), nextLastDay));
  }
  return due.toISOString().slice(0, 10);
}

function benefitCycleEndDate(cycleType = "") {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (cycleType === "monthly") return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  if (cycleType === "quarterly") return new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 0)).toISOString().slice(0, 10);
  if (cycleType === "semiannual") return new Date(Date.UTC(year, month < 6 ? 5 : 11, month < 6 ? 30 : 31)).toISOString().slice(0, 10);
  if (cycleType === "calendar_year" || cycleType === "calendar") return `${year}-12-31`;
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
