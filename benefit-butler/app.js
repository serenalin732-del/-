const storeKey = "credit-card-butler-v1";
const today = new Date();
const supabaseSettings = window.CARD_BUTLER_SUPABASE || {};
const hasSupabaseSettings = Boolean(supabaseSettings.url && supabaseSettings.anonKey && window.supabase?.createClient);
const maxUploadBytes = 10 * 1024 * 1024;
const AI_ROUTER_MODES = {
  fast: {
    model: "auto",
    labelZh: "Fast（便宜）",
    labelEn: "Fast (cheaper)",
    descriptionZh: "解析账单、商户分类、检索官网福利等用便宜模型。",
    descriptionEn: "Cheap model for parsing, categorization, and benefit lookup."
  },
  balanced: {
    model: "auto",
    labelZh: "Balanced（日常）",
    labelEn: "Balanced (daily)",
    descriptionZh: "日常 AI 总结与组合分析。",
    descriptionEn: "Daily AI summaries and portfolio checks."
  },
  advisor: {
    model: "auto",
    labelZh: "Advisor（强模型）",
    labelEn: "Advisor (stronger)",
    descriptionZh: "续卡决策与高级顾问报告才用强模型。",
    descriptionEn: "Stronger model only for renewal decisions and advisor reports."
  }
};
const allowedUploadTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  "application/vnd.ms-excel"
];
const allowedUploadExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".csv", ".tsv", ".txt"];
let supabaseClient = null;
let currentUser = null;
let syncReady = false;
let benefitFilters = {
  status: "all",
  cardId: "all",
  holder: "all"
};
let cardFilters = {
  holder: "all"
};
let rewardFilters = {
  cardId: "all",
  category: "all",
  status: "all"
};
let cardFormOpen = false;
let benefitFormOpen = false;
const expandedCardIds = new Set();
const expandedBenefitIds = new Set();
let mobilePriorityOpen = false;
let mobileMenuOpen = false;
let interfaceLanguage = localStorage.getItem(`${storeKey}:language`) || "zh";
let automationSettings = {
  emailReminderEnabled: "yes",
  defaultReminderEmail: "",
  reminderChannel: "both",
  paymentReminderDays: 7,
  benefitReminderDays: 15,
  benefitReminderDays2: 7,
  weeklyDigest: "yes",
  monthlyDigest: "yes",
  aiProvider: "openai",
  aiMode: "balanced",
  aiModel: "",
  aiBaseUrl: "",
  workerUrl: supabaseSettings.workerUrl || ""
};
let apiKeyStatus = [];

const templates = [
  {
    id: "custom",
    label: "自定义卡片",
  },
  {
    id: "amex-platinum",
    label: "Amex Platinum",
    issuer: "American Express",
    name: "Platinum Card",
    annualFee: 895,
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/platinum-card/",
    benefits: [
      ["Airline Fee Credit", 200, "calendar", "auto", "年度额度，通常按自然年计算；需先选择航空公司，适用于符合条件的航空杂费。未用额度通常不会滚到下一年。建议每年 1 月确认选择，12 月前用完。"],
      ["Uber Cash", 200, "monthly", "review", "年度总值按官网估算；通常按月发放到 Uber/Uber Eats，美国使用。每月额度未用通常不会滚存，月末前需要用掉；部分月份额度可能不同，请以官网和账户显示为准。建议每月 20 日后检查余额。"],
      ["Digital Entertainment Credit", 300, "monthly", "auto", "年度总值按月度订阅额度估算；通常每月针对指定数字娱乐服务报销。未用月度额度通常不滚存。建议绑定固定订阅并每月核对 statement credit。"],
      ["Lululemon Credit", 300, "quarterly", "review", "季度额度；通常每季度独立计算，未用季度额度通常不滚存。需符合官网指定渠道和条款。建议每季度最后一个月检查是否已使用。"],
      ["Hotel Credit", 600, "semiannual", "review", "半年度酒店额度；通常上半年/下半年分别计算，通过 Fine Hotels + Resorts 或 The Hotel Collection 预付酒店消费触发。未用半年度额度通常不滚存。建议提前规划入住和预付时间。"],
      ["CLEAR Plus Credit", 209, "calendar", "review", "年度报销额度；用于 CLEAR Plus 会员费等符合条件消费。通常按自然年计算，未用额度不滚存。建议在续费前确认家庭成员/折扣价格。"]
    ]
  },
  {
    id: "capone-venture-x",
    label: "Capital One Venture X",
    issuer: "Capital One",
    name: "Venture X",
    annualFee: 395,
    sourceUrl: "https://www.capitalone.com/credit-cards/venture-x/",
    benefits: [
      ["Travel Credit", 300, "anniversary", "review", "会员年旅行额度；通常需通过 Capital One Travel 使用。未用额度通常不滚存到下一会员年。建议在周年日前 60 天确认是否已用。"],
      ["Anniversary Miles", 100, "anniversary", "manual", "周年 10,000 miles，按 $100 估值；通常在续卡后发放。此项更适合人工确认到账。"],
      ["Global Entry / TSA PreCheck", 100, "custom", "review", "多年一次的申请费报销；通常不是每年福利。建议记录上次使用日期，避免误算成年度可追回价值。"]
    ]
  },
  {
    id: "amex-gold",
    label: "Amex Gold",
    issuer: "American Express",
    name: "Gold Card",
    annualFee: 325,
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/gold-card/",
    benefits: [
      ["Uber Cash", 120, "monthly", "review", "通常每月 $10 Uber Cash，年度总值 $120；未用月度额度通常不滚存。需关联符合条件的 Uber 账户。"],
      ["Dining Credit", 120, "monthly", "review", "通常每月 $10，适用指定餐饮商户；未用月度额度通常不滚存。建议绑定常用商户或每月固定检查。"],
      ["Resy Credit", 100, "semiannual", "review", "通常按半年度分段使用，适用 Resy 餐厅；未用半年度额度通常不滚存。"],
      ["Dunkin Credit", 84, "monthly", "review", "通常按月度小额 credit 计算；未用月度额度通常不滚存。建议每月固定消费或充值前核对条款。"],
      ["Grocery 4x", 0, "calendar", "auto", "买菜消费积分最大化提醒。"]
    ]
  },
  {
    id: "chase-sapphire-reserve",
    label: "Chase Sapphire Reserve",
    issuer: "Chase",
    name: "Sapphire Reserve",
    annualFee: 795,
    sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve",
    benefits: [
      ["Travel Credit", 300, "anniversary", "auto", "旅行类别报销。"],
      ["Priority Pass", 0, "anniversary", "manual", "贵宾厅权益。"],
      ["Dining Credit", 300, "semiannual", "review", "官网福利，Sapphire Reserve Exclusive Tables 适用餐厅。"],
      ["StubHub Credit", 300, "semiannual", "review", "官网福利，StubHub / viagogo 适用消费。"],
      ["Apple TV+ and Apple Music", 250, "anniversary", "manual", "官网福利，指定订阅权益。"]
    ]
  },
  {
    id: "chase-sapphire-preferred",
    label: "Chase Sapphire Preferred",
    issuer: "Chase",
    name: "Sapphire Preferred",
    annualFee: 95,
    sourceUrl: "https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred",
    benefits: [
      ["Hotel Credit", 50, "anniversary", "review", "官网福利，通过 Chase Travel 酒店消费。"],
      ["DoorDash DashPass", 0, "anniversary", "manual", "官网福利，需激活。"],
      ["Travel 2x/5x Tracking", 0, "calendar", "auto", "旅行消费积分最大化提醒。"]
    ]
  },
  {
    id: "bilt-mastercard",
    label: "Bilt Mastercard",
    issuer: "Bilt",
    name: "Bilt Mastercard",
    annualFee: 0,
    sourceUrl: "https://www.biltrewards.com/card",
    benefits: [
      ["Rent Rewards", 0, "monthly", "review", "官网福利，房租支付获得积分，需满足交易要求。"],
      ["Rent Day Bonuses", 0, "monthly", "manual", "每月 Rent Day 相关活动。"],
      ["Dining Rewards", 0, "calendar", "auto", "餐饮消费积分追踪。"]
    ]
  },
  {
    id: "citi-strata-premier",
    label: "Citi Strata Premier",
    issuer: "Citi",
    name: "Strata Premier",
    annualFee: 95,
    sourceUrl: "https://www.citi.com/credit-cards/citi-strata-premier-credit-card",
    benefits: [
      ["Annual Hotel Benefit", 100, "calendar", "review", "官网福利，符合条件酒店预订。"],
      ["Gas/EV 3x Tracking", 0, "calendar", "auto", "加油和 EV charging 积分追踪。"],
      ["Grocery 3x Tracking", 0, "calendar", "auto", "买菜积分追踪。"]
    ]
  },
  {
    id: "marriott-brilliant",
    label: "Marriott Bonvoy Brilliant Amex",
    issuer: "American Express",
    name: "Marriott Bonvoy Brilliant",
    annualFee: 650,
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/marriott-bonvoy-brilliant/",
    benefits: [
      ["Dining Credit", 300, "monthly", "review", "官网福利，每月餐饮 statement credit。"],
      ["Free Night Award", 0, "anniversary", "manual", "官网福利，周年免费房券。"],
      ["Marriott Platinum Elite", 0, "anniversary", "manual", "官网福利，酒店会籍权益。"]
    ]
  },
  {
    id: "hilton-aspire",
    label: "Hilton Honors Aspire",
    issuer: "American Express",
    name: "Hilton Honors Aspire",
    annualFee: 550,
    sourceUrl: "https://www.americanexpress.com/us/credit-cards/card/hilton-honors-aspire/",
    benefits: [
      ["Hilton Resort Credit", 400, "semiannual", "review", "官网福利，指定 Hilton resort 消费。"],
      ["Flight Credit", 200, "quarterly", "review", "官网福利，直接向航空公司或 Amex Travel 购买机票。"],
      ["Free Night Reward", 0, "anniversary", "manual", "官网福利，免费房晚奖励。"],
      ["Hilton Diamond Status", 0, "anniversary", "manual", "官网福利，Hilton Diamond 会籍。"]
    ]
  },
  {
    id: "world-of-hyatt",
    label: "World of Hyatt Credit Card",
    issuer: "Chase",
    name: "World of Hyatt",
    annualFee: 95,
    sourceUrl: "https://creditcards.chase.com/travel-credit-cards/world-of-hyatt-credit-card",
    benefits: [
      ["Free Night Award", 0, "anniversary", "manual", "官网福利，周年免费房晚。"],
      ["Hyatt Discoverist", 0, "anniversary", "manual", "官网福利，会籍权益。"],
      ["Hyatt Spend Tracking", 0, "calendar", "auto", "Hyatt 消费积分追踪。"]
    ]
  },
  {
    id: "united-explorer",
    label: "United Explorer Card",
    issuer: "Chase",
    name: "United Explorer",
    annualFee: 150,
    sourceUrl: "https://creditcards.chase.com/travel-credit-cards/united/united-explorer",
    benefits: [
      ["United TravelBank Cash", 100, "semiannual", "review", "官网福利，United TravelBank Cash。"],
      ["United Hotels Credit", 100, "anniversary", "review", "官网福利，United Hotels 预订。"],
      ["Free Checked Bag", 0, "anniversary", "manual", "官网福利，托运行李权益。"]
    ]
  }
];

const defaultData = {
  cards: [
    {
      id: crypto.randomUUID(),
      issuer: "American Express",
      name: "Platinum Card",
      nickname: "旅行白金",
      last4: "1234",
      holder: "Serena",
      annualFee: 695,
      dueDay: 15,
      remindDays: 7,
      reminderChannel: "both",
      reminderEmail: "",
      anniversary: "2026-01-10",
      notes: "已开启自动还款，重点追踪 airline / Saks / Uber。"
    },
    {
      id: crypto.randomUUID(),
      issuer: "Capital One",
      name: "Venture X",
      nickname: "旅行主卡",
      last4: "8899",
      holder: "Serena",
      annualFee: 395,
      dueDay: 22,
      remindDays: 5,
      reminderChannel: "calendar",
      reminderEmail: "",
      anniversary: "2026-04-03",
      notes: "适合旅行平台和日常 2x。"
    }
  ],
  benefits: [],
  rewards: [
    {
      id: crypto.randomUUID(),
      program: "Amex Membership Rewards",
      points: 5120,
      merchant: "Whole Foods",
      category: "买菜",
      cardId: "",
      multiplier: 4,
      uploadName: ""
    }
  ],
  statementAnalyses: [],
  history: []
};

defaultData.benefits = [
  {
    id: crypto.randomUUID(),
    cardId: defaultData.cards[0].id,
    name: "Saks Credit",
    value: 100,
    used: 50,
    cycle: "semiannual",
    expires: "2026-06-30",
    activation: "no",
    tracking: "review",
    notes: "上半年 $50 已使用，下半年需要重新追踪。"
  },
  {
    id: crypto.randomUUID(),
    cardId: defaultData.cards[0].id,
    name: "Airline Fee Credit",
    value: 200,
    used: 80,
    cycle: "calendar",
    expires: "2026-12-31",
    activation: "yes",
    tracking: "review",
    notes: "需要确认航空公司选择。"
  },
  {
    id: crypto.randomUUID(),
    cardId: defaultData.cards[1].id,
    name: "Travel Credit",
    value: 300,
    used: 120,
    cycle: "anniversary",
    expires: "2027-04-02",
    activation: "no",
    tracking: "review",
    notes: "通过 Capital One Travel 使用。"
  }
];

defaultData.rewards[0].cardId = defaultData.cards[0].id;

let data = loadData();

const cycleToDb = {
  monthly: "monthly",
  quarterly: "quarterly",
  semiannual: "semiannual",
  calendar: "calendar_year",
  anniversary: "anniversary_year",
  custom: "custom"
};

const cycleFromDb = Object.fromEntries(Object.entries(cycleToDb).map(([app, db]) => [db, app]));

function loadData() {
  const raw = localStorage.getItem(storeKey);
  if (!raw) return structuredClone(defaultData);
  try {
    return { ...structuredClone(defaultData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(storeKey, JSON.stringify(data));
}

function automationPreferencesKey() {
  return `${storeKey}:automation-preferences:${currentUser?.id || "local"}`;
}

function loadAutomationPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(automationPreferencesKey()) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveAutomationPreferences() {
  localStorage.setItem(automationPreferencesKey(), JSON.stringify({
    aiMode: automationSettings.aiMode || automationSettings.aiQuality || "balanced",
    workerUrl: automationSettings.workerUrl || "",
    aiProvider: automationSettings.aiProvider || "openai",
    aiModel: automationSettings.aiModel || "",
    aiBaseUrl: automationSettings.aiBaseUrl || ""
  }));
}

function getAiModeConfig(mode = automationSettings.aiMode) {
  return AI_ROUTER_MODES[mode] || AI_ROUTER_MODES.balanced;
}

function getAiModel(task = "balanced") {
  if (task === "advisor" || task === "advanced") return AI_ROUTER_MODES.advisor.model;
  if (task === "fast" || task === "statement" || task === "benefits" || task === "merchant") return AI_ROUTER_MODES.fast.model;
  return getAiModeConfig().model;
}

// Fields every Worker AI call sends so the backend can route to the chosen
// provider/model. The Worker picks a cheap vs strong model per task; leaving
// aiModel blank uses that automatic choice.
function aiRequestFields() {
  return {
    provider: automationSettings.aiProvider || "openai",
    aiModel: (automationSettings.aiModel || "").trim(),
    aiBaseUrl: (automationSettings.aiBaseUrl || "").trim()
  };
}

// Map an AI card-benefits result into benefit drafts (not yet added).
function benefitDraftsFromAi(cardId, aiResult) {
  const sourceNote = (aiResult.sourceUrls || []).slice(0, 3).join(" | ");
  return (aiResult.benefits || []).map(item => ({
    cardId,
    name: item.name || "Unnamed benefit",
    value: Number(item.value || 0),
    used: 0,
    cycle: ["monthly", "quarterly", "semiannual", "calendar", "anniversary", "custom"].includes(item.cycle) ? item.cycle : "calendar",
    expires: item.cycle === "calendar" ? `${today.getFullYear()}-12-31` : "",
    activation: item.activation === "yes" ? "yes" : "no",
    tracking: ["auto", "review", "manual"].includes(item.tracking) ? item.tracking : "review",
    benefitType: String(item.benefitType || "").toLowerCase() || "recurring_credit",
    notes: `${item.notes || "AI 建议，建议核对官网。"}${sourceNote ? ` 来源：${sourceNote}` : ""}`
  }));
}

// "Last refreshed from the issuer" label for a card (cache freshness).
function cardFreshnessText(card) {
  if (!card.sourceUpdatedAt) return interfaceLanguage === "zh" ? "未从官网更新" : "Not refreshed from issuer yet";
  const days = Math.max(0, Math.floor((Date.now() - new Date(card.sourceUpdatedAt).getTime()) / 86400000));
  const when = days === 0
    ? (interfaceLanguage === "zh" ? "今天" : "today")
    : (interfaceLanguage === "zh" ? `${days} 天前` : `${days} day(s) ago`);
  return (interfaceLanguage === "zh" ? "上次从官网刷新：" : "Last refreshed: ") + when;
}

// Re-fetch a single card's official benefits/reward rules from the issuer via
// AI, update the cached metadata, and let the user review which to track.
async function refreshCardBenefits(cardId) {
  const card = data.cards.find(item => item.id === cardId);
  if (!card) return;
  if (!automationSettings.workerUrl) {
    setSyncStatus(interfaceLanguage === "zh" ? "请先在设置里保存 Cloudflare Worker URL。" : "Save the Worker URL in Settings first.", "warn");
    return;
  }
  setSyncStatus(interfaceLanguage === "zh" ? `正在从官网刷新「${cardLabel(card)}」的福利，通常 20-90 秒...` : "Refreshing from the issuer site, 20-90s...");
  try {
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    if (!token) throw new Error(interfaceLanguage === "zh" ? "请先登录。" : "Please sign in.");
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/card-benefits`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ issuer: card.issuer, bank: card.issuer, cardName: card.name, ...aiRequestFields() })
    }, 120000);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || text || "刷新失败。");
    const aiResult = payload.result || payload;
    card.rewardRules = aiResult.rewardRules || card.rewardRules || null;
    card.sourceUrls = aiResult.sourceUrls || card.sourceUrls || [];
    card.officialName = aiResult.cardName || card.officialName || card.name;
    card.sourceUpdatedAt = new Date().toISOString();
    if ((!Number(card.annualFee) || Number(card.annualFee) <= 0) && Number(aiResult.annualFee) > 0) {
      card.annualFee = Number(aiResult.annualFee);
    }
    saveCardMetadata(card);
    render();
    await upsertRemoteCard(card);
    setSyncStatus(interfaceLanguage === "zh" ? "官网资料已刷新，请在弹窗确认要追踪的福利。" : "Refreshed — confirm which benefits to track.");
    presentBenefitReview(cardId, benefitDraftsFromAi(cardId, aiResult));
  } catch (error) {
    setSyncStatus((interfaceLanguage === "zh" ? "刷新失败：" : "Refresh failed: ") + (error.message || ""), "warn");
  }
}

const BENEFIT_TYPE_LABELS = {
  recurring_credit: { zh: "经常性额度", en: "Recurring credit" },
  annual_perk: { zh: "年度福利", en: "Annual perk" },
  welcome_bonus: { zh: "开卡奖励", en: "Welcome bonus" },
  one_time: { zh: "一次性", en: "One-time" },
  elite_status: { zh: "会员等级", en: "Elite status" },
  other: { zh: "其他", en: "Other" }
};

function benefitTypeLabel(type) {
  const item = BENEFIT_TYPE_LABELS[type] || BENEFIT_TYPE_LABELS.other;
  return interfaceLanguage === "zh" ? item.zh : item.en;
}

// One-time and welcome bonuses are not recurring annual value, so they are
// off by default in the review list.
function isRecurringBenefitType(type) {
  return !["welcome_bonus", "one_time"].includes(type);
}

// Let the user confirm which AI-fetched benefits to actually track. Nothing is
// added until they click "add selected".
function presentBenefitReview(cardId, drafts) {
  const list = (drafts || [])
    .slice()
    .sort((a, b) => Number(isRecurringBenefitType(b.benefitType)) - Number(isRecurringBenefitType(a.benefitType)));
  if (!list.length) {
    setSyncStatus(interfaceLanguage === "zh" ? "AI 未返回可添加的福利。" : "AI returned no benefits to add.");
    return;
  }
  let backdrop = byId("aiReviewModal");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "aiReviewModal";
    backdrop.className = "modal-backdrop";
    document.body.appendChild(backdrop);
  }
  const rows = list.map((b, index) => {
    const recurring = isRecurringBenefitType(b.benefitType);
    const tone = recurring ? "blue" : "warn";
    const valueText = b.value > 0 ? dollars(b.value) : "";
    return `
      <label class="list-item ai-review-row">
        <input type="checkbox" data-review-index="${index}" ${recurring ? "checked" : ""}>
        <div>
          <div class="item-top">
            <strong>${escapeHtml(b.name)}</strong>
            <span class="tag ${tone}">${escapeHtml(benefitTypeLabel(b.benefitType))}</span>
          </div>
          <div class="item-meta">${escapeHtml(cycleText(b.cycle))}${valueText ? " · " + escapeHtml(valueText) : ""}</div>
          ${b.notes ? `<div class="item-meta">${escapeHtml(b.notes)}</div>` : ""}
        </div>
      </label>`;
  }).join("");
  const zh = interfaceLanguage === "zh";
  backdrop.innerHTML = `
    <div class="modal ai-review-modal">
      <h3>${zh ? "确认要追踪的福利" : "Confirm benefits to track"}</h3>
      <p class="item-meta">${zh
        ? "开卡奖励 / 一次性默认不勾选（它们不是每年重复的福利）。勾选你想加入年度追踪的项，可随后再手动编辑。"
        : "Welcome / one-time bonuses are unchecked by default (not recurring). Tick what you want tracked; you can edit later."}</p>
      <div class="stack-list" id="aiReviewList">${rows}</div>
      <div class="form-actions">
        <button class="secondary-button" type="button" id="aiReviewCancel">${zh ? "取消" : "Cancel"}</button>
        <button class="primary-button" type="button" id="aiReviewConfirm">${zh ? "添加所选" : "Add selected"}</button>
      </div>
    </div>`;
  backdrop.hidden = false;
  byId("aiReviewCancel").onclick = () => { backdrop.hidden = true; };
  byId("aiReviewConfirm").onclick = async () => {
    const selected = [];
    backdrop.querySelectorAll("[data-review-index]").forEach(input => {
      if (input.checked) selected.push(list[Number(input.dataset.reviewIndex)]);
    });
    backdrop.hidden = true;
    let added = 0;
    selected.forEach(draft => {
      const { benefitType, ...benefit } = draft;
      const upserted = upsertLocalBenefit({ ...benefit, id: crypto.randomUUID() });
      if (!upserted.merged) added += 1;
    });
    render();
    const cardBenefits = data.benefits.filter(item => item.cardId === cardId);
    await Promise.all(cardBenefits.map(upsertRemoteBenefit));
    setSyncStatus(zh ? `已添加 ${added} 项福利，请核对官网后使用` : `Added ${added} benefits — verify against the issuer site.`);
  };
}

function cardMetadataCacheKey() {
  return `${storeKey}:card-metadata:${currentUser?.id || "local"}`;
}

function loadCardMetadataCache() {
  try {
    return JSON.parse(localStorage.getItem(cardMetadataCacheKey()) || "{}");
  } catch {
    return {};
  }
}

function saveCardMetadata(card) {
  if (!card?.id) return;
  const cache = loadCardMetadataCache();
  cache[card.id] = {
    rewardRules: card.rewardRules || null,
    sourceUrls: card.sourceUrls || [],
    officialName: card.officialName || "",
    sourceUpdatedAt: card.sourceUpdatedAt || ""
  };
  localStorage.setItem(cardMetadataCacheKey(), JSON.stringify(cache));
}

function mergeCardMetadata(card) {
  const cached = loadCardMetadataCache()[card.id] || {};
  return {
    ...card,
    rewardRules: card.rewardRules || cached.rewardRules || null,
    sourceUrls: card.sourceUrls?.length ? card.sourceUrls : (cached.sourceUrls || []),
    officialName: card.officialName || cached.officialName || "",
    sourceUpdatedAt: card.sourceUpdatedAt || cached.sourceUpdatedAt || ""
  };
}

function apiKeyStatusCacheKey() {
  return `${storeKey}:api-key-status:${currentUser?.id || "local"}`;
}

function loadCachedApiKeyStatus() {
  try {
    const cached = JSON.parse(localStorage.getItem(apiKeyStatusCacheKey()) || "[]");
    if (JSON.stringify(cached).match(/[åæèéçäãÂ�]/)) {
      localStorage.removeItem(apiKeyStatusCacheKey());
      return [];
    }
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

function saveCachedApiKeyStatus() {
  if (!currentUser) return;
  localStorage.setItem(apiKeyStatusCacheKey(), JSON.stringify(apiKeyStatus));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setFormBusy(form, busy, label = "") {
  form.querySelectorAll("button, input, select, textarea").forEach(control => {
    control.disabled = busy;
  });
  const submit = form.querySelector('button[type="submit"]');
  if (!submit) return;
  if (busy) {
    submit.dataset.originalText = submit.textContent;
    submit.textContent = label || "处理中...";
  } else if (submit.dataset.originalText) {
    submit.textContent = submit.dataset.originalText;
    delete submit.dataset.originalText;
  }
}

function setButtonBusy(button, busy, label = "") {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = label || "处理中...";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

function armTestButtonWatchdog() {
  const button = byId("testSyncButton");
  if (!button || button.dataset.watchdogReady) return;
  button.dataset.watchdogReady = "yes";
  button.addEventListener("click", () => {
    setTimeout(() => {
      if (!button.disabled) return;
      setButtonBusy(button, false);
      setSyncStatus("连接测试超时，按钮已恢复。", "warn");
    }, 15000);
  }, true);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function validateUpload(file) {
  if (!file) return "";
  const lowerName = file.name.toLowerCase();
  const extensionAllowed = allowedUploadExtensions.some(extension => lowerName.endsWith(extension));
  if (!allowedUploadTypes.includes(file.type) && !extensionAllowed) return "只支持 JPG、PNG、WEBP、PDF、CSV、TSV 或 TXT 文件。";
  if (file.size > maxUploadBytes) return "文件不能超过 10MB。";
  return "";
}

// Split a comma/semicolon/whitespace separated string into trimmed emails.
function parseEmailList(value) {
  return String(value || "").split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
}

function isValidEmailList(value) {
  const list = parseEmailList(value);
  return list.length > 0 && list.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

// Reads the card form's reminder fields. 'inherit' means the card follows the
// global Settings, so we store no per-card timing/email of its own (null/empty).
function readCardReminderInputs() {
  const reminderChannel = byId("reminderChannelInput").value;
  if (reminderChannel === "inherit") {
    return { remindDays: null, reminderChannel: "inherit", reminderEmail: "" };
  }
  return {
    remindDays: Number(byId("remindDaysInput").value || 0),
    reminderChannel,
    reminderEmail: byId("reminderEmailInput").value.trim()
  };
}

function validateCard(card) {
  if (!card.issuer || !card.name) return "请填写银行和卡片名称。";
  if (card.last4 && !/^\d{4}$/.test(card.last4)) return "尾号必须是 4 位数字。";
  if (card.annualFee < 0) return "年费不能是负数。";
  if (card.dueDay < 1 || card.dueDay > 31) return "还款到期日必须在 1 到 31 之间。";
  if (card.remindDays < 0 || card.remindDays > 60) return "提前提醒天数必须在 0 到 60 之间。";
  if ((card.reminderChannel === "email" || card.reminderChannel === "both")) {
    if (card.reminderEmail && !isValidEmailList(card.reminderEmail)) return "提醒邮箱格式不正确（多个邮箱请用逗号分隔）。";
    if (!card.reminderEmail && !automationSettings.defaultReminderEmail && !currentUser?.email) return "选择邮件提醒时，请填写提醒邮箱（或先在设置里填默认提醒邮箱）。";
  }
  return "";
}

function validateBenefit(benefit) {
  if (!benefit.cardId) return "请先选择所属卡片。";
  if (!benefit.name) return "请填写福利名称。";
  if (benefit.value < 0 || benefit.used < 0) return "福利金额不能是负数。";
  if (benefit.used > benefit.value) return "已使用金额不能超过总价值。";
  return "";
}

function validateReward(reward, file) {
  if (!reward.program) return "请填写积分体系。";
  if (reward.points < 0) return "点数不能是负数。";
  if (reward.multiplier < 1) return "倍率不能小于 1。";
  return validateUpload(file);
}

function validateAutomationSettings(settings) {
  if (settings.emailReminderEnabled === "yes" && settings.defaultReminderEmail && !isValidEmailList(settings.defaultReminderEmail)) return "提醒邮箱格式不正确（多个邮箱请用逗号分隔）。";
  if (settings.paymentReminderDays < 0 || settings.paymentReminderDays > 60) return "还款提醒天数必须在 0 到 60 之间。";
  if (settings.benefitReminderDays < 0 || settings.benefitReminderDays > 120) return "福利提醒天数必须在 0 到 120 之间。";
  if (settings.benefitReminderDays2 !== "" && settings.benefitReminderDays2 != null && (settings.benefitReminderDays2 < 0 || settings.benefitReminderDays2 > 120)) return "第二次福利提醒天数必须在 0 到 120 之间。";
  return "";
}

function setSyncStatus(message, tone = "ok") {
  const status = byId("syncStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("warn", tone === "warn");
}

function setAuthMessage(message, tone = "ok") {
  const target = byId("authMessage");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("warn", tone === "warn");
}

function getAuthRedirectUrl() {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return null;
  return `${window.location.origin}${window.location.pathname}`;
}

function showAuthMode(mode) {
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.authMode === mode);
  });
  document.querySelectorAll(".auth-mode").forEach(form => {
    form.classList.toggle("active", form.id === `${mode}Form`);
  });
  setAuthMessage("");
}

function updateAuthVisibility() {
  const authenticated = Boolean(currentUser);
  byId("authGate").hidden = authenticated;
  byId("appShell").hidden = !authenticated;
}

function remoteMode() {
  return Boolean(supabaseClient && currentUser);
}

function requireRemoteUser() {
  if (!remoteMode()) return null;
  return currentUser.id;
}

function toDbCard(card) {
  return {
    id: card.id,
    user_id: requireRemoteUser(),
    issuer: card.issuer,
    card_name: card.name,
    nickname: card.nickname || null,
    last4: card.last4 || null,
    holder_name: card.holder || null,
    annual_fee: card.annualFee || 0,
    due_day: card.dueDay || null,
    // null reminder_days_before / 'inherit' channel = follow the global defaults.
    reminder_days_before: card.reminderChannel === "inherit" || card.remindDays == null ? null : (card.remindDays || 0),
    reminder_channel: card.reminderChannel || "inherit",
    reminder_email: (card.reminderChannel === "inherit" ? "" : card.reminderEmail) || null,
    anniversary_date: card.anniversary || null,
    notes: card.notes || null,
    reward_rules: card.rewardRules || null,
    source_urls: card.sourceUrls || [],
    official_name: card.officialName || null,
    source_updated_at: card.sourceUpdatedAt || null
  };
}

function fromDbCard(row) {
  return {
    id: row.id,
    issuer: row.issuer,
    name: row.card_name,
    nickname: row.nickname || "",
    last4: row.last4 || "",
    holder: row.holder_name || "",
    annualFee: Number(row.annual_fee || 0),
    dueDay: Number(row.due_day || 1),
    remindDays: row.reminder_days_before == null ? null : Number(row.reminder_days_before),
    reminderChannel: row.reminder_channel || "inherit",
    reminderEmail: row.reminder_email || "",
    anniversary: row.anniversary_date || "",
    notes: row.notes || "",
    rewardRules: row.reward_rules || null,
    sourceUrls: row.source_urls || [],
    officialName: row.official_name || "",
    sourceUpdatedAt: row.source_updated_at || ""
  };
}

function toDbBenefit(benefit) {
  return {
    id: benefit.id,
    user_id: requireRemoteUser(),
    card_id: benefit.cardId,
    name: benefit.name,
    total_value: benefit.value || 0,
    used_value: benefit.used || 0,
    cycle: cycleToDb[benefit.cycle] || "custom",
    cycle_end: benefit.expires || null,
    requires_activation: benefit.activation === "yes",
    tracking_mode: benefit.tracking || "review",
    notes: benefit.notes || null
  };
}

function fromDbBenefit(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    name: row.name,
    value: Number(row.total_value || 0),
    used: Number(row.used_value || 0),
    cycle: cycleFromDb[row.cycle] || "custom",
    expires: row.cycle_end || "",
    activation: row.requires_activation ? "yes" : "no",
    tracking: row.tracking_mode || "review",
    notes: row.notes || ""
  };
}

function toDbReward(reward) {
  return {
    id: reward.id,
    user_id: requireRemoteUser(),
    card_id: reward.cardId || null,
    program: reward.program,
    points: reward.points || 0,
    merchant: reward.merchant || null,
    category: reward.category || null,
    multiplier: reward.multiplier || 1,
    source_document_id: reward.documentId || null,
    notes: reward.uploadName ? `Uploaded file: ${reward.uploadName}` : null
  };
}

function toDbAutomationSettings(settings) {
  return {
    user_id: requireRemoteUser(),
    email_reminder_enabled: settings.emailReminderEnabled === "yes",
    default_reminder_email: settings.defaultReminderEmail || null,
    reminder_channel: settings.reminderChannel || "both",
    payment_reminder_days: settings.paymentReminderDays,
    benefit_reminder_days: settings.benefitReminderDays,
    benefit_reminder_days_2: settings.benefitReminderDays2 === "" || settings.benefitReminderDays2 == null ? null : Number(settings.benefitReminderDays2),
    weekly_digest_enabled: settings.weeklyDigest === "yes",
    monthly_digest_enabled: settings.monthlyDigest === "yes",
    ai_provider: settings.aiProvider,
    worker_url: settings.workerUrl || null
  };
}

function fromDbAutomationSettings(row) {
  const localPreferences = loadAutomationPreferences();
  if (!row) return { ...structuredClone(automationSettings), ...localPreferences };
  return {
    emailReminderEnabled: row.email_reminder_enabled ? "yes" : "no",
    defaultReminderEmail: row.default_reminder_email || "",
    reminderChannel: row.reminder_channel || "both",
    paymentReminderDays: Number(row.payment_reminder_days || 7),
    benefitReminderDays: Number(row.benefit_reminder_days || 15),
    benefitReminderDays2: row.benefit_reminder_days_2 == null ? "" : Number(row.benefit_reminder_days_2),
    weeklyDigest: row.weekly_digest_enabled ? "yes" : "no",
    monthlyDigest: row.monthly_digest_enabled ? "yes" : "no",
    aiProvider: row.ai_provider || "openai",
    aiMode: localPreferences.aiMode || localPreferences.aiQuality || "balanced",
    aiModel: row.ai_model || localPreferences.aiModel || "",
    aiBaseUrl: row.ai_base_url || localPreferences.aiBaseUrl || "",
    workerUrl: row.worker_url || supabaseSettings.workerUrl || ""
  };
}

function fromDbReward(row) {
  return {
    id: row.id,
    program: row.program,
    points: Number(row.points || 0),
    merchant: row.merchant || "",
    category: row.category || "",
    cardId: row.card_id || "",
    multiplier: Number(row.multiplier || 1),
    uploadName: "",
    documentId: row.source_document_id || ""
  };
}

async function guardRemote(action) {
  if (!remoteMode()) return;
  try {
    await action();
    setSyncStatus(t("synced"));
  } catch (error) {
    setSyncStatus("同步失败，本地已保存", "warn");
  }
}

async function upsertRemoteCard(card) {
  await guardRemote(async () => {
    const payload = toDbCard(card);
    const { error } = await supabaseClient.from("cards").upsert(payload);
    if (!error) return;
    if (error.code === "PGRST204" || /reward_rules|source_urls|official_name|source_updated_at|schema cache/i.test(error.message || "")) {
      const fallback = { ...payload };
      delete fallback.reward_rules;
      delete fallback.source_urls;
      delete fallback.official_name;
      delete fallback.source_updated_at;
      const retry = await supabaseClient.from("cards").upsert(fallback);
      if (retry.error) throw retry.error;
      setSyncStatus("卡片已保存；官网资料库字段需要运行 Supabase 补丁后才能云端保存", "warn");
      return;
    }
    throw error;
  });
}

async function upsertRemoteBenefit(benefit) {
  await guardRemote(async () => {
    const { error } = await supabaseClient.from("benefits").upsert(toDbBenefit(benefit));
    if (error) throw error;
  });
}

async function upsertRemoteReward(reward) {
  await guardRemote(async () => {
    const { error } = await supabaseClient.from("reward_entries").upsert(toDbReward(reward));
    if (error) throw error;
  });
}

async function deleteRemoteRow(table, id) {
  await guardRemote(async () => {
    const { error } = await supabaseClient.from(table).delete().eq("id", id);
    if (error) throw error;
  });
}

async function saveRemoteSnapshot(snapshot) {
  await guardRemote(async () => {
    const { error } = await supabaseClient.from("yearly_snapshots").insert({
      user_id: requireRemoteUser(),
      snapshot_year: snapshot.year,
      annual_fee: snapshot.annualFee,
      used_value: snapshot.usedValue,
      remaining_value: snapshot.remainingValue,
      snapshot_data: snapshot
    });
    if (error) throw error;
  });
}

async function saveRemoteAutomationSettings() {
  await guardRemote(async () => {
    const { error } = await supabaseClient
      .from("automation_settings")
      .upsert(toDbAutomationSettings(automationSettings), { onConflict: "user_id" });
    if (error) throw error;
  });
}

async function loadRemoteApiKeyStatus() {
  apiKeyStatus = loadCachedApiKeyStatus();
  if (!automationSettings.workerUrl || !supabaseClient || !currentUser) return;

  try {
    const token = (await supabaseClient.auth.getSession())?.data?.session?.access_token;
    if (!token) return;
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/api-keys`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` }
    }, 10000);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload.ok === false) throw new Error(payload.error || text || "无法读取 API key 状态。");
    const remoteStatus = (payload.keys || []).map(item => ({
      provider: item.provider,
      message: `已保存，末四位 ${item.last_four || item.lastFour || "未知"}。完整 key 只保存在 Worker 后端，不会显示在浏览器里。`
    }));
    if (remoteStatus.length) {
      apiKeyStatus = remoteStatus;
      saveCachedApiKeyStatus();
    }
  } catch (error) {
    if (!apiKeyStatus.length) {
      apiKeyStatus = [{
        provider: automationSettings.aiProvider || "openai",
        message: `无法读取已保存 key 状态：${error.message || "Worker 不可用"}`
      }];
    }
  }
}

async function saveRemoteAiSummary(summary) {
  await guardRemote(async () => {
    const { error } = await supabaseClient.from("ai_summaries").insert({
      user_id: requireRemoteUser(),
      summary_type: "portfolio",
      provider: automationSettings.aiProvider,
      summary_text: summary.text,
      summary_data: summary
    });
    if (error) throw error;
  });
}

async function ensureProfile() {
  if (!supabaseClient || !currentUser) return;
  await supabaseClient.from("profiles").upsert({
    id: currentUser.id,
    display_name: currentUser.email,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  });
}

async function loadRemoteData() {
  if (!supabaseClient || !currentUser) return;
  const localStatementAnalyses = Array.isArray(data.statementAnalyses) ? data.statementAnalyses : [];
  setSyncStatus("正在同步...");
  updateAuthVisibility();
  syncReady = false;

  try {
    await ensureProfile();

    const [cardsResult, benefitsResult, rewardsResult, historyResult, settingsResult] = await Promise.all([
      supabaseClient.from("cards").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("benefits").select("*").order("created_at", { ascending: true }),
      supabaseClient.from("reward_entries").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("yearly_snapshots").select("*").order("created_at", { ascending: false }),
      supabaseClient.from("automation_settings").select("*").maybeSingle()
    ]);

    const firstError = [cardsResult, benefitsResult, rewardsResult, historyResult, settingsResult].find(result => result.error)?.error;
    if (firstError) throw firstError;

    data = {
      cards: cardsResult.data.map(fromDbCard).map(mergeCardMetadata),
      benefits: benefitsResult.data.map(fromDbBenefit),
      rewards: rewardsResult.data.map(fromDbReward),
      statementAnalyses: localStatementAnalyses,
      history: historyResult.data.map(row => ({
        year: row.snapshot_year,
        annualFee: Number(row.annual_fee || 0),
        usedValue: Number(row.used_value || 0),
        remainingValue: Number(row.remaining_value || 0),
        createdAt: row.created_at
      }))
    };
    const duplicateBenefits = dedupeBenefits();
    automationSettings = fromDbAutomationSettings(settingsResult.data);
    if (duplicateBenefits.length) {
      await Promise.all(duplicateBenefits.map(benefit => deleteRemoteRow("benefits", benefit.id)));
      setSyncStatus(`已清理 ${duplicateBenefits.length} 条重复福利记录`);
    }
    await loadRemoteApiKeyStatus();
    if (!duplicateBenefits.length) setSyncStatus(`${currentUser.email} ${t("synced")}`);
  } catch (error) {
    setSyncStatus(`同步失败：${error.message || "请稍后重试"}`, "warn");
  } finally {
    syncReady = true;
    updateAuthVisibility();
    render();
  }
}

async function initSupabase() {
  if (!hasSupabaseSettings) {
    setAuthMessage("还没有填写 Supabase 配置，请先设置 supabase-config.js。", "warn");
    updateAuthVisibility();
    return;
  }

  supabaseClient = window.supabase.createClient(supabaseSettings.url, supabaseSettings.anonKey);
  const { data: sessionData } = await supabaseClient.auth.getSession();
  currentUser = sessionData.session?.user || null;

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (_event === "PASSWORD_RECOVERY") {
      currentUser = session?.user || null;
      byId("authGate").hidden = false;
      byId("appShell").hidden = true;
      showAuthMode("updatePassword");
      setAuthMessage("请设置新密码。");
      return;
    }
    if (currentUser) await loadRemoteData();
    else {
      syncReady = false;
      updateAuthVisibility();
      setAuthMessage("已退出登录。");
      render();
    }
  });

  if (currentUser) await loadRemoteData();
  else {
    updateAuthVisibility();
    setAuthMessage("请登录，或第一次使用时注册新账户。");
  }
}

async function uploadPrivateDocument(file, cardId = "") {
  if (!remoteMode() || !file) return { documentId: "", uploadName: file?.name || "" };
  const validationError = validateUpload(file);
  if (validationError) throw new Error(validationError);

  const documentId = crypto.randomUUID();
  const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
  const lowerName = file.name.toLowerCase();
  const folder = file.type === "application/pdf" || lowerName.endsWith(".pdf")
    ? "statements"
    : lowerName.endsWith(".csv") || lowerName.endsWith(".tsv") || lowerName.endsWith(".txt")
      ? "imports"
      : "screenshots";
  const objectPath = `users/${currentUser.id}/${folder}/${documentId}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("private-documents")
    .upload(objectPath, file, {
      cacheControl: "0",
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { error: recordError } = await supabaseClient.from("uploaded_documents").insert({
    id: documentId,
    user_id: currentUser.id,
    card_id: cardId || null,
    bucket_id: "private-documents",
    object_path: objectPath,
    original_filename: file.name,
    mime_type: file.type || "application/octet-stream",
    byte_size: file.size,
    status: "uploaded"
  });

  if (recordError) throw recordError;
  return { documentId, uploadName: file.name };
}

function dollars(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function number(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function byId(id) {
  return document.getElementById(id);
}

function setupLogoFallback() {
  const fallbackLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAEAAElEQVR42uz9aaxtW5odCI0x9z7nntu8vokXbTbONtKdEH0joYICNyWoFLYQUkmGsmyDXVD8wFUlkPiBCowKkJCBctkIVSGVhBBdgQRlECAkoMoukLBdmekKp9N2ZGRm9PHeu+/d5pyz9xz82GvNOb5vzrXPeS8jMyPTGXZEvnvfObtZa645v298oyF+9z/tP5IIoCx/rCR15mf//QB+CMDN8jvX18fbn7lR/e98eHzJp4drvKg3PKgCBAoLigp2BQAIAoBO/7O+CZf/bX9j767139P/Xunfc/1wpx8sk9dsPy/YJzn9WQDI4acILn/d31z2ciSh0zUBSFDL7y1/BgBqeV0K5On3Zb8PaHnN0//l+nvrD/v3Wj/D+ntcvofWT9yuVvrOp/9ZvyKX15L/y3QNtFw9v0PhP+zXOL9Ru8Lsn2e9Ttx4oXYP2/eIC6BdChCnl1X8aOsP8HQ9aP/sLy0qfW77jrLXYv8R+mcFht9T+zxqnzGsXfsntqXK0+r0W0t7XTFeh/b76X3tPfzqrj/XrtdyURQucf6C/TXIdFnbevMnFsMK6X9me7X1ceB6P/xe+fWcLjemZ9J/lOlzqt/3dF/bN+OwhSzPJds1Wq+NoPY8Kjz4aPdofU3mj0+OT+HyjLVbTkESqoAKAao4Lh/hkgWPy6XeuXiMB+VCD8rlf323w88DeACgArgE8FWSf+37sa//w/Yf/u4lACQVADuSt+nvXwVwAPAYwH+1Au+U058B4B8H8NnbetTTwzU/Pt7gab3GM93gWCt2LNiD2C+ncH/oT5uk0uF7erCKPUFqB2vfO9U2RN+M21FDtn/ftr31fZdjjGzv2B9c2we0HtKnD502KbUNgOLprexn+mud/m7d7GzfTSVLLCCgXgSsP03bnNnOhNNn1/Ki68/UtgPaKd+rDNvf1a5FLBziYxE+67rpq1+HXhTR9lotP0IrZpbvqFh85XM37Nn0w2lZC9Jpg6aGk4nrdVyKC+VTSfFRJ9d7yfZ7/Ud7EQfb/HvJZPdi/UbsB6yW66+1gBDT6+TnLx6o7fqshVN4Qw6bVv8e6/WLZVu/fv0A6wean6YMRZ3stdanrN/P9bDszyVz4Un7zXTYr+tuPQDbFVAvHL12QyiOU4ku9mvrZ5td91DwMDcSdt20FtaTA52n6yd6cWZ7m111gqfXkcK9Gxcnxg+13I+jhKOOuK0VkvCAezzePcDj3SVe3V/hjcuH6y9+HcC/VlEBlH0Bvg3gfwjgGYA9yadpvVwAOJKsv1sA/MPb6be9bF0Iki4B/AeXhfOfAvBPVOAZUK8Kyu/x1/hefYlvv3x6/Kje8GU9QBD23PGi7LgD7dyw7kKpq7IHQZh19sw7rd2408OkagdUPvQ2DkJQy++lfYDe/3B5iO3Ab4WDdR1eI/iy6rv63YvQXqMdzhtLNZY3yyVaDuJa181+2nD0jVUK1zB0XbP2XrrzMVoPbk1OdaaudAuhCEWRlXlsH1u2V6bW1JCUdqoNjTr7ebp8WI2rYFl249/FgjEhSkvRgNRUD8sZG5c6I15UQ40SeNHqH4UC4PT9CS+Ucyfe/yYCaVaQE+nnOP2+Y6HE6R0muXS1/bb1446hiAqrfH3dcN01XDspdtq07z5e3Akq5kjQWiDREKmhVu2VvIayEGG99vun+C8wFgACQ+E7QyyPqrhVVa1VBPCoXODV/ZW+8PjN3RV24ecr8EsFeLk0b/8qgP/D8s//Bskba/w6EPEPITLAf8gO/h2AMun0/wCAnwXwe06Hfq0FpfjP3NTj8enhpd4/vMCHh5d4qZsdd4U7FO1YsDOg3GHe9W8F6xzXv1OqDdaNgn2zojrUDTtTIyS3wnR53+0wsRC7rAr1R3F5D4YihcuG2DdHrd21eiEBe8hpcH9DNbz+kW+AjJsr1+5/RQ+IWI7ErkOsfaMr/vkYiwQt3W67GwrzFFlrRG9SlteZfu+AKCzXYPn8asVP7+D8/hKpG2fse6n1EMrbq6xK5ARZtTKDI8wKR5js+61Ihmzc0ws8DbXnumYqtNznNGYyeFwrkiShpq0/H9pKYygvUDpCsXbNShMXghlJsYNdy3sMgJahTgpP7wJF4zS6C3cjLB9GJMhr9baG4ylqzX57zsNnVyxq2veHGoYte57a9coXQEOF0NYVNSnQDBFRGrGsz15dl7WPCey5O/3/fg+L1nELh0JNTFWfIWvieDQxzj10QMVRFYcqslY93F0e37l4jFf3V3j98hGBVBGcAMKyFAO/BOB/R/JvTpCBSvL4uwXA76xuH8vBf1z+7g0A7wD4wwD+c8s//+hplVSV06OmCuD58RrfuP0IHx5elut6AAqw5w77ZX2xgZ52+Gi8uGEEkOaNI/Ss8KSHCltjK+V/ZZjmvAPgrEFX3Dm13f36ISZ7z9lDmwYUAeYgiT4K9Q0yVwzjJj/M+b0bZvq0SgVTbBDj7yl3wH495vBu7sYyx6Lv/3a9/HCz9xPyHHzc7dtQJBx0SPMDpEO+9rXpX8GKt35Yb+8KcTlMBtV5yWQo3Q8aOGTcDwjnfAicf5SEGHcY3A4YCKicfBd7Z65FNsNaGa59GAJg5Fic7bVzAdCL9T4OMIQozOImg6mA6I2FfUQM04iPiqhDq8g1cAywjHQiRsmw4PqEx76H+mhNSPMiTPgWShwFJkSUC5fI7ldAQZd1c8ARh2MFATzZPcDbl4/rm/vHuNrtl9O/EiidFgX8PZxGBf8LAP86gG+TfN8axbqsJf1uAfDbd64Pn/NI+o8C+DKAPwLgP7FUhGuleLv8udzWI94/vOC3bj/GR8driMAOBfty6vQBooZTXvEQi2Ps3oG054E295Nt16VDvbbWnQtAI/rEtoxx82A8fE9QZZ8ft02vjQl8g/YRhlpnF0lZtrnISXk2l2Yme3lDIus6+kYWYUPGWsdnpoqz7XA9E18id8yt613ntkuXYsdr/5NG0ldkZMb5cW+O1A++5Xq3z8gF2WmoDtv9UxhJ9BN17dJXtIFi69Ljgesk0tO3qaygIurUx61cSFi2cSsiMpkE2TCZNiNeR1DldL3yoBqEUBu61WlqatcuzMIVyYKym98KJaihMJqOQRgOSFnV2zCVhRdQlmtcpcANOF1bxmmKFx9tvdKuV5zbMxfbK1cibgj9sQkkvPV1ZfweDAVyZAXJpn9MRS7tQ+W6dizoaOiZ8lhSiCRTpqLWC9q2RWk483vnzza+a2tjffbEAL1oMkgqyzN0kHCrAyThEgVv7B/j7YuHeP3ikQwJqAAulj8flz//XwD8nwD8Asn/x7lz5HcLgB/8jn9H8rD8+d2lw/9nAPxRAG+lVmBFJ8tNPeLrN0/xvcMzvKwHkAUX3GG3boHUMDccZrFD1xB6sQ41auAbz0d1656/9T4JUozzs8mUkWupoVB1KwDy9D0udX1qhzlS1792kUrEtNwmD5RBI6F5x7teKwZgY9kMahw7RKa7BmClHeYGXXeCnR2utr2s3ah8iyVT4ZfeN1MddToYnYHFQKhk5LvF08L27Xw4ZXJo73yjIsSVAl1+ISuKuBzQTX1ha5uJ8Cj0g6nNzJeFVZYvIQ2MzxN8nJGvsIYjpBXVK+pdph0U4+gjIwk+NXIui52za/Gj/h7FAYtiVBpNwDEnwRqDU6ZmkTrSQWL4WYeO+qgwlVs8z5fAgpA1focXRzT+zHpt2K+d81hmCM9YxMQiVXn+b4tUSHtXu44RxewkSyfXJo6HKX+8inVi5qlYOL3aERU3R6FIeGN3hbcuH+PNy8dLE4daAZWuDljf8LsA/o8A/oUFFfjW8hn2C3FQv1sA/Dbo+CX9MIA/DuC/DOAJgDes0995Hf+83uLbNx/jGzcf4xZH7AvxgDtQOwAneUpb9L5BpieSTuUJahqN0HHm9llDNLB8G+zr762RHscZxYobxCuFWcB6QCIxwoGJGiszqSdyvgbtkuGQysOBOaM7jU62phTr1SFTN75Jsk9SQIN+mX9GM93lCGMqHXqNTLZ2SbTarvbSin3+zIDAjEUS032l4hSocyrGbo2J3Nm6/uEeyk/Ffvho3tGua60dcJwtLSHONfrvKWjrSuJBYOjuA4cVocnvyIc0393OjDUClG4M/Xx94mhFcYRCTqqyyAfh5LkZ53h2r6SB8Nuff8WiacIhYDi1JzfHfreV/KkAYGZtEon1a+MaaQNxSJ+N46gUA4GW02eRgW8wPtmBcG1Y3kFH3NYjBOARLvCZB6/gnYtHuCg7JM3t0ZCB9wF8DOB/BOB/RfIf/E5EBPg7tOP/Ly2z/Z+0Hz1W1MLOFcbT4w2+cfsU7x9e4KAjLrjDnrverUtJKhR1MRyO6TSfXyEsGswVuXMI4iGXXuWOZiZNs89DJ2GJ0xl+lvmvGzm9y6UR47zsZxlkZwMK0g4o6yB9k/IzrphfQPqOvRO2nyEjIpEsD7rfgIJ2Xy6v4ih5w6gAs04kwtBcO1HFDa53LctYgZ22GDfy3M25bM87tj6bDvesFQ1EoUnT/JBYpZSN1LmQ8dYOV0YsDe9tv5cOaLIEqZ1WFIhoI5JW8BphbxS8dM8G2WKgYkGoMNkyAhmRNWkRlWa/b+vnL4scbf1+QTKb771Gci0m7P+6HD5F/SCtgeNihEIxHKYyguBIiFzXGZfv0hEyIo+w2J8ZJoIdkIi0Wf6anjPjODgK1LgUgWSU0Kj0vHs1XTL51b7fTIHU98cV+p94GHiRFe5hH4vJ9kRHJiuEQz3iUCseco939o/x2atXWyGw4oPlhAo7ifArC1fgL/1OQwT4O6jj/yEA/1kAfw7Al2y+kyEevDje4lduPsS3D88AChfcY49iDFQ09vKMqtcfAsSTiH0idVpKS0edyt0IqfXdJ8NvkSWsQJmK2n+Evye4NU1IqkA2GHR47awAC5vavNDvc/y+qd5BSYwHaIKmvaNX0vEjqQTiNEaJQJk4BYE0h8l9zmSmESLQFiSfCIg0PXynBJxpTZ34mN6WZ++wBv8CctTsOywclRlbqoPAMG1db80HHeaeEiWjApiQvNLj05tbGpcidqC5MHDugxcrw1TGiIP9gIhjBzL7BXQliiaXnORpxGHIYIb4ydlcz02ZIgdFitIZnnmAwv2E8zIGmurQtjCR8mod7ysS1VCDuljDGIdTHej2sXM63MuE3Djb2SYcodQkBeVI8lkAiZt6xO3xFo9Y8N7la3j3wSu4KPvZkMWLgV8G8D8B8L8k+dXfCYgAfwd0/J8F8CcB/AkAP2Y3TQB2vuRf1lt8/eZj/OrNh6gAHpY99ktnKzMxIel+PBn7DM+Ew7CBJ8ORXA6dGmkNW7k66aj2jgwL8aeZttBYBbIpKSPBLm7wMsZyb8mk0sh48vnhsKmYDM83HTcysQ7G+qR42K2HofEEcvfRD2zGz9GUBrFLbgZA6vp/kljMF/tGQAyyMt+D3WnQGdBdEobBPKbzBuIhX8ywh96RBgS8b7I1FHhxzOOHCGWzXppkMHfusmvH/tqNhLn8fQlEt34tiN6JqZ5GFixsBjAEuwlULkYUJZiBm1IVOGwuOVxHI+2+LtewLMiDgzxa1SdmviPF0Zp8rNU4BOif3RGF5l8wKkayH0MGu2pms6wOjyvCYoTEwjgo9Hs1QvCLwQd7IyJk501HUHgSPDSyKNK+wk5oxAQtsDUFXy+Ms3w0CbOjTGbK1ZqI6HzY+Rt2cKfCJqx3ZX+R5XsU2h5nRFACqgpKiTaWkRoHx4uz9bPd6IDb4y0eaof3HryOzzx4FReLAty2u+PKE1te4u8C+J8D+J+R/PpvZ0SAv90O//UCS/o8gP88gP8CTvp97/jD9zqo4ldfPsW3bj/CCx1wtbs4OfSlMbUf9h0ydLib07HWtMbljPC2oata56nqB2tgOUMjuWni5xnnoBw2LHeJo0nopEhQi4euoSGZY6Co9WIjIwmVUWbUP7c76TFC4bRyQMkJMRDYup1wc8gjUJbXF5w5b3CmNHUfasQ3c9IbCWVGalLsl+VjIXIul7PXZlA/RNfFfkmNbOkuf2Q42NeTu19PLwi2OnkMKg+5+0FyLFwPnK59d5zAIV/azL7fPyZim+hMcQ0dps+nQ6dvMrFgVpSueZTk2vMFDpa2fpgORbuZJrVSWP0ahBLI0LF+OHJYP9F4aMVIvGDBuF6Z3ZWURlTLzwb/CUb1RCgkmHgP/XpVZf6IBnfRwpKIf/Gz+j41NVdKfhpIPA+vlp0jWiVDZqMXQfM7WQsemBeJcShWMKAu16ssa/RWR9weD3iMS3zu6lV85uoVTLwdlRCBXwLwLwP4V0j+aj6jfrcA+D4795Gskr4A4J8A8F/EyYsfi11vccQRAI4SvnXzEX71+kO80AGXZY9L7pLpSJbW2mwzSMbi7KwZrVSF328H2QAvu2GOC7JdGaDgAtYNg6pPkJM0zuDZxMjV0nm0ZyzyvMKqXh/asQA4HeiZhOgdC4dDpXf0AUpd/l1F7258hBEsaptEr/TZnxnK+Ma6zuWZpFjOog8bftI/R9Qj4eeRbxxMkbi00kE+qNVw3A/TOJemy8bMdEnMaIrZvEoJHXDJHiMUbvpppVKVS2d6KkYUECIlslWE2RnUBq586JtuKoRDJ9cLOxSD56sx/AP/IBIqld0tTSJ3UiCk4gMcxgFR5skAoQ+z9HDmauiouzeUGkISkR5HDL2Y0YJi1G4HzC4rJjEWPj66COMKHxN2GeNk4nEqNQKIubynyRnXcYv8HluxHaSPjEiBQufeiy3nbqx8KLr2KtiMI6iYCuMQoK5oipd466Hvs/9ETg57m9mFh8d9uf+n0cABr+8f4ktXr+O1i4ezYd0qJVxnBl8F8C8B+FdJ/srqMPjboRDgb4PDf0fyuBQBXwbwlwD8R+xGrMqdcJOeHl7i719/gKeHl7ggccl9ewDr+iDZw8QZDJUWkMODdSFbFSrMnOQOYCsUaXCawlzRnd8Qqv9A9kGXr/lm0apx2eiCaTywVDi0zyY/PMIDozAD9Sq6MA0tFme5tUDxB74VORNjGe8ONHM15Nj5xXlehND93tRaI5PbPANK+5kug+obeQ2aeqYDtVo32gsLAbUXe8oEKysyS1KORLld/zzxKzoLe/yuCj7yPgNN4xR5JoQRF5OzZDg8Bsa1v/7ye8VIYzDNHN14yK4nk5wuf880C29rwFGZAT2JFs9hjYfXQJd/Ls9OKSXeM8UCev2uNYliyWgw1XMQ+nWShJ0fNo4GZL8MjsUWE7m3qsYCzGy6T5OCWIUrIVurLK51xk0OuyJmvUzo+5FLcEefBUdzwv4otnCfXqB4cNVS0Nbar32wAjf0yHIY4ro1YuTyeWtuYAI6GH0z1jPA0TpZdskRwst6QKnCZy6e4PNXr+Ph7mJ2PIXzB8D/cyGg/wJJrWfX7xYAv06S33L4//eXi/tw6fh3mPhz3OqIv3/9Ab59+xEKiQfYAeKp4EydXmc3qzGAhYmabsrVys5YZl5hyW6Zsdvg65lHuXU9YYQQEHiGgJq5PM42NGJqO+yf1x/CDFtqSJhTICc2hzExSZjG8cQ4/khz0SRXG4hqNqMvGt0OqqoZk2STxQhtR1XBfERAQ0FkZMmZgWPYuKdSqagg6cWfJoEI2WCPPWlvQk4P5L7CcND6FDsy/xNB0DfxyfJHomLlv+uE0vQR1/crJcH6hqeYYiagGMOkLGVnzH33MLrXMwVjjW49lKEFxcdlXXURjZhWC+043tIpkGJg4HNiegVMFXxDKGLjsCBvBpvWIX0tlWJs+rTepwLBFZGkhSopyOzCfkbFBE8fw5CGGCkEIbViH3PpYCg4GUeQXuxGeeksOWTZF+KmG5RcwWPTvF6qKq7rAZfc4UcevIl3Lp9Mr5tJCPcAXixN6n9tKQJ+oEmC/EE9/I3d/48D+DMA/lDydB4W/zduP8av3nyA5/UWV+UCO0VjHA02rsphd1F2pXl41TiSM6oc1TbjslS/A5zqUOZ6LihC0W68R4PzY1gOT5KkrCiAQpAPFoc2h49ljmpMbmLByMec8umzdyOZKW2oofCxeXZhsv494XpBYZAP4nU+Xldmn/kVwDq+tVPyLiASx7uDXmNIK5r+BATH9GvD+GAWY6zmN+2T8WS4sl7D/vlgnUuIWh4MZmLxGkyEBo1IDCnShI3u3a+PfBz9CNJMn5cjStDoHvMLEjCb7U8PuIX97fermcRUNYj99BDWaF/hYTzsz0gcZ3nyRQ/h6cTQaCzQiyj1uXNzzrTDxO5HYTefaaOUwu7NoDiCaevMonaVDkFOQ45szBGyBtBGOoGx0IhzMU47EIcZR2ptH7NRHodnzcm0taVf5s59UFSk4mJ8P4V8hYjG0aSxefynYDHNOAccuBDRKCoWHW5KtO49Bxxxe3uLV/dX+OGrN/HqfCyQz6a/CuAvk/zX8pn2uwXAHbnNC+T/OQD/aQD/PZxSnGo04ez/eV5v8fevv4fvHl7gEgUPuA8btWi1rZwEFwlTscq0GZQ0JHwpB9sqCJGiDx8TWWYmnRIGeLfPPvucE0mKFJuBVABMPAqY3fg4uhFGyDUavwRyVZbbIMLN7ibnoUFxg0vz6WB1nDq+JGviYN/aN/6aDYVinnCDBZ3RjE1Fg4Jten6/U3CEBiliP9hhcPnkIHQd/pb3+3S2PZFSBaLfhFCq0cwqeiPIYNUa+Rt07kLPcqBB7DPLnJLkWQ6DDN/JD5hshAX3YzA1x2wt0tZLrS3sqhFtB7mtGiITtCnJaEhGHMva9CmKFDiYcQ3QpJHMeQiJ72EndeTAMYb8aGK1Nfj5y9jzSEoes0kOxMfBRdAJlBo4MwrfP/EbUshYfJbimJGYjwrnKCqG1wpXweSRXRI4NwSLEtnTNXtRb1AEfPHBG/jc1WvYsWxZS63szmcA/jyA/z3JX1szBn6QuAH8QQvtWWCTHwfwvwHw+4zktx+6fgHfvPkIX715H7esuOJFm/MxZ9hnUh67acsgq0sOaj6vMmHRtAbkSlSzVtn9zznTejfyWwmpdHH2uz687ru9dk8+m7SjP1i5lmTisZIcZ8hDnE9PxwLGMu/WurZpJwidwfUuurRLPGUvhjk5USxoiSzBIKiEn91yWFuvB6HS5/HVpFmB6+BksWxS4974tM4voTqhoES01vU5++Ce5ms1+bhn8yINJLb+3qVJ9nrhNcytfR7drltdOuBJEFNwTkSUYrq5S3P/64VvWZMAFkvkfrxqsB7u8kxZHLGZ1ni3aJ4C+RDxHTioeBuxTKg1Wk3HNT557QXZq9U87UOiYjQAW7tzGTsdZBovVssaUCIac4DqG/GUSuZ8HLJIfH4u8/GISqKkvpBxGqxbl1KOQwsKUs9b0oRMq474lXX/IQzBCw4LVjQZOlVrkDa6hBpJptjDixjk/0qW2T27wUetPRckFAv20BUSt6q4Odzi1XKJH3n8Nl7ZX20daX5m/dsA/jMkf9HPud8tABLkL+kBgH8fgL8I4A/MZv3rf67rAb/48rt4//AMl7s9LrFvN00TqBMTX3mXZQmRSR/m4X44NmJSTXa2DBDW2NEmbbp5vLt0zWGt1kEuJKBm1+sJcqZ/EqKueYVWO+RstTIjQz5vgEhSvOKEoiTTGWWG7AleSY7n0cXO0GYKvls3ISf1iJFxTMwMeRgtcg2iJKOYe92IauoYkOKcZWY06/crqQvPxqSdrmEyp5AfP1nUXpBMPlOe95OcOLy6xauHCeXnIR0WqTBp9zCgCRFJYLR3C2t7cIREzFeYGF0n74n4nLQRQTZ4Ggy2JvryMUAQ0b8mOd9NmPgO3TcCad2wrfZxCyOyI+ucR/lejgMfC0AnFdYq5CVCPxARC76w5yQ9Pxx5gBZ1E2Mmhikdykp+neyVToEJ8l6D9zudJXbq61c8SfFHtCvzqdoxLUaHw5XXhe6REEpoQycyAtfruGW/LGxhFit68eJwC4j40oNX8YVHb5zLrVy5AX8TwH8FwF8nef2DMhLgD9Dh/xDAv4iTth/LhdvNfuf9wwt85cW3ccMDnvDBKRtmIIlrwrJJwRVENC/JQmCT7dDy7ftBnL3TE5nE/GW9Gx4Y0ppodZVPkxl3iWBFZ93SNkEx5NYoWYOHPcfnzbbxNoOWZbOgkmVtMDQycMIPCXAjnlyDIUnJybshHz0RBVtSmXuyL3Kmkg5nZ9TnEwA9m7ysmyp6YbV2x707Y/Ts9xaTlkvfZJBx0869pU4tZVBeIEH1yDbI0GQOXZIfQCacxQOyXReNYVGBPLjs1gu3rcntHMmJdlH9oA7kU3J6IGfCZ39GojQvEg+T14FiSMLo0+CHa4qzZYnPIpx53uWzeWvoa33iV3DK9QwuoCE61w17zPlufc0mCV29C2bOic0/oyafiOySy+hMaSqR0pod4+Dk7EfjUSBJbMdRUjToGaScvm8F9LCv+2yuNHB9ZsFhzTdpefb9DAhxCJwN0xpiFRUqgiptTfXQNEAoKLjVAde3N3hz/xA//uRdPNhdbDmf+ln2rwD4syRf/CAUAfxBMPZZtP3/LZxMfbK0Imwav/Tyu/jV6w9wudvjivtm1oOBoO2dlOnTzZ/UoXMaHO1QVvARHxI147iAiqQYMqXKGaTsvuB5Jk4qdvvp0G5rO2jcV5Id0wa3ZRvKICVbob4m59uYN0ey+unnSiI2Bb8E9DlhDr6RHSh5NcYNvra4G4d+nXncpW9I2v6JvXLaQOSHTzAc5TAzZCB7Mfr021y4o0slhbz4dcymvorFSnZEZtKxB2QqIgyRWJbVDz2XYr3nHreMFEbVbQAYg4XQu6iVcLq67YHR2CWMCFIghc+8MfF44FA4R9SnB8z4GCInAq4jESvWYlzgcpgbApZg5MATCrkGmCQ6xpRKV8y4qyUmipzZvtCRFXd6lNlS910s5yI4AdDHFR1tM93+KqWdkepSWnPfMzA6B4Z1JvMPUHCSDH4oNqpsSEEK2sLgcBjj0duo1pBUTSyeizV5UQYIM3OKLU7Io1hDSSm8PFzjCnv8yOO38PblK1vHnZ9r/zKA/+biGfBbahzEHwCy358B8N/GKaZ3M7fr+fEWv/j8W/hefYkn5RIXZYdjCJNJ2iyvtIXxYWMyaZkZnyg57wdmeXxh2i7RN4AULxt0xin6G+P/Xf+nkY6YOu+0YcQKuXcHQzrgAHQkX/UkkxmyB1PVj8H0jjFPntGfv7PI+8ZdUYODVzKFnzjVK6SxhdFIokFhJm4zyEGpNyjIDoT979ddvq6kv2K+ALPDVh0qndyJFCRkB3TyXvdDKI9LEIqUrv7oSI7nIGhIYxzolpoQ2gbCZ5K1mktf01y3JE12ExpgcO8jR1/NKT8gSNw4qCxj5K2vHzvUl/cuHhe1dqHFzLUmkdLhKqkHbwUUZOLGGA23ki9DCsCK8kFDHn10FdIwGTIaYgS2G2olCXHyyM/ZGyEREhHR0xAwOO6h2MglZfrcY+RvRxxnz9PELLDzFEwHwwmBe04ZHOIKoxuEOtsLk9TO0x5AvDwecDwe8UNXb+CHHr15Lgdl/evvAvhvkPzLv5XkwN+qAmBP8iDpTwH4HwO4zPI+v1Lv377A3335bdzoiKtymVDcaKYhi+CdpWX22fmYxR0lUNhM4FJ6eJk0g0MQR3twVtmUxu7PbWDFkFee00dCSliWvA22uejZ7XJNdO8CRxkkYxeVY0snHdw0f8CPYGV/+kEPFiBDUcOj6SS2/JCCk5jYkEQWryGDc1x+GMYUuEYYTYzwKc+DU0hq1IQ3eha67S8x9YBnKkboEb5pvMNU5CqRHZvFqRz9SdcwdI+RFi31AqUgyQmDbnZmVBEPI7q+Plg8+yMWYVqFwj0WCjl5b7DpQOQQhMeLStnX6UWMy9LUCOvVTnt3V0SY939+bnIEbwzc62ZEIYgpPTAJrcvV+Ezem08AJiKiNyZhT235Cz14uiYjpUD+C/yo+XGriWoo+Fj4aMPm/Vk51Bo6H/8iHdi27lpzZI6k0UBoTBwcfDjWAKWFIHhUxcvDLd65fISfevyZLc8AlwveAPinSP5P1zPxN/ssLr+Fh/+fAfCXtw7/9fb92vVT/Pzzr5+ynMuDBn1bPT+VocQDpS/mCK/OveGhmKTr0M86v1rhp3BoiMN8Fop59STGR0KdMObmMByyvJlL/PCZQpVNz09nOKDIWO2vh3aD8DffNUPTkehHKPkMR2g2JPFFF9Dza2aa843gW2+Jw2dfT5jJJrcrYRoVEInRQP9/TF97q8mY79NjE5bIesJoXuIFBmfXbGJk7ged6ImQMYUuGKe0zjkbYCRTKUYr12GlT4MzGmNw6PCymREmPh5ZC7v5XoPH0rpWlTp0hl+RnSsrn0OzRaZJ5+LX3mOkp/GRCssma2Uojp4QgQuQuS2z+xSbBIb9pnn19jGex2FPvmomfQpxjtQdNxFHQkgSPkNqmOKKvRCT4ibiO0G8HdxYowy1aN+zmR3b49oCglIsTC4MdSokHl9c4Du3z/E3P/pVfHy82dpXynLmXQL4y5L+zHIm7n/HIgAJ9l87/4uN1FAcJfzy9fv42s2HuCp7XGDXO7ZZzj0QrUGrBog7b54jNB1AtcDehiLbX9kIRz1xa+0UQ1eXahSa5KZbxrq3/8TVy3W0+TT12f4sVjTH6/pRkXXteb/1D24parOCS7RRhWKhk6NfmiGL2ZUGwkMePVheQJgFrnAz++sClhuAMY45b7OFEcrnxFo167udlSVpeq1PSW1qhUKcn2sMZkjw5nYFo+mDrGVdxEdk4o+33uZmZ5zQjgA9Izn4IczO29afZXBMvpPCcFCP9I/u8d/JmH39YJ0RJ/TEC8pcIIV1J/ckUOj2Iq8imu4H+95E1J3aXiekrCcvdgSEyacEcvtuDF4JIQUw0Ent7TWuiFBOtOkkbUSAAItrTYB0tEKW2eAqm8SenyVfRr1+EPJFdMgD0Zy+yi6npJFMFcYaiEmF+RtxC9vL3g1x7JYT0OMzHHMEqjnKvqy32KHgxx++hbcuH5/jBRDArSEBv6njgPKbHOF7lPSncQpOGA7/9Qbd1AN+4dk38bWbD/B4d4kL7lBXRThHaB5GeDo5TLKxf9eFvD6wVTD5SHfjkyeOWQXsEiEM3uOGBDBFoMIjQGGs9/VhQrDG7IScWK2G5S0PpakpgpiBiRSY0UqdXzjgSmfCO6ON3c74NMhV1IZbVyhnRmP8g9aCyDfEJQpXy/WuqT9QCxW1z06kPPD1mtcTw2at5hkDIhhQGLYmzHuoHMwTRz/J2lUWIEFttJsKuuVxDhmBAjcNankDiM6J/c916HWELpMcGtLBYEgDStGPAU7VMzEGmsFEKiCvyzPXD8s1Qo3BZKW9lxnSLG4JefjSMaCk0Z9gRKHJHpIx10OEHRnrl4JbYEywNLbB84TYSYxTfyReQ1zPI2rHAUWKa35ho1NT41uht9vOpQmXgpjKS2X34VTQ1p4USgQ+UysKHBhsbp7LiLE9x4iIU4pYhhXusbhU+K97OXoctvk+hQK/Kz56sms0COPgejqMjP1K8e5+WUvI0lXZQwT+9vNv4esvn547f7Wchf+SpD+9ZAfsJPF3BAKQOv8/vXT++xngQgAvjjf4uWffxLUOeLy7tOegto2Izraefo2YXx/3sk4YU6roOIPKhCQJS3K6qpaLLdn8KnSU5os9Q6yyVTyD91mSXcXfKV4xh2I6Ec+IDe119EHIx4FzGuYA3pzsoiA9QpildXWkOfNNRhPynHLkaxKZ/QEq3tqDOTEOWixnkcKelNLZYPAwKQtdMuhbGoYKWWIJDMmu/TDKcbRbMDO3HmAmCaLzRZCgTA0jKUVCuplk9UOLDjkjZsgzQwk+i90aX4RQIHdqU+ruDB2wtdOCZiz4KpRaqZAJz5+0ndKd5XSjrGSQmfozunb6ZV0nAepQWAQiN1IBNsZDiSAXZ+8K+58ycS2jRQOHaTKp3/x7DlypuEY0RSKwMU5iRtwY16nkMeca0FKXdmP2DCX3S0wkpMBogQ3jPkQLMyQr4TSEWHkB9YDPX7yCH3705jn3QODke/NPkfwrv1lIAH+TCX//onX8A+z/8eEav/Dsmziw4mG5DA5r1XNTzJlLa4capCuycA+TkzV5iEECbe7lchqF2b1UB/39OftbDkY7M8euGI4eYbE412BwrXKOOEw2iMnMVymve+xG42uOESUOt0cSjW/Cmfu1EetqaEhw2ZsUZHGFaiPypRcQdOtkPzuWRVPEtonH65d4aoPff29ClIugJWPVrVQ14zgEJUkWmJiMFIqQd2rnZ6Nj5c+DrAHXVI4XDwQmK5Zxv+7jrvwvRtSJRnZthVxQsWBg8XOUNiDMJjSx0+XEWtmfNavWqWwHbY5xoaRIk2N1pKP/YknXWZMCNb124NBqMAVKyz3VetFQKASKNRKk0+omBTMQJMgZkchKDKVV0Q5fmzOE4V4Yh7hMNh6s8wWs7ZEbXa9v9gMWPjWNhHLDpux1oRwUNUqF43Vjsna2UcQKkA4k7P6PRwrXtwe8tb/Cjz95Bxfcn5MJVpx8An5TiIHlN7LzX+IQV8LfX1o6f24d/j/38ddRi/CoXJxgzgYjxYNBBukIo5PehOMVZXxux7/+vWmQAQ6mKxrCuKKcpDvtIcy5vUIeM83PsIhSN+x/zsVzHvsRI9kuHEKWLhZMkxhhSIb5IULXR25Y2W203Vu8uJyesCUguht6Q4AaOcWF5q+Wb0PMRcDEQ84ODN23sk58kIgCR+LeRJWl6YvqTF3P+L62+XPjtXRnpzCVbCQ1TITGdY97xxm0NbmDnKzzXDJ2wln3sJ/5G2yTaycLQtr+LJjo/Hx+7H4MHGq1GIcMjSMORg4RMtk02fBOiZB3cFNzt6zpk8mzAAXzLCFkgKirloYrr81rysErwce857aF7W/KtJB4dndx0jgjpLQqsIYbxfDHlRdwtb/Ed44v8Lc/+jpuddg6i7mckX/JiIG/oeMA/iZK/fZj539a/E9vX+Lnnn0Du33BA5z0/SEKJEjv0mbqHT97glM41J0lrwTdNO/xYBM988TCkLYxeyLoaXW0apFBr+p2lHkAEeI7PMI1HxeJBNMCUIRgjpPiB6I/9kRzmz0DghsiJ5V/+vTgVuBpn8NqSk7TyPo2tIZTJQLiGGE2AuC8tBCM3EmTYCZIM89iq1ztoekGZezQ0XuBiSZuXgCnqHTLTc8teCYjTUyU+oxFA4O5HSKSXbN+aCr42NcRUVg89EvZiMc2LKn5AIAo6Z7nuOsYfYmJmoZRyj4jI1Km658VszNHJuNcKJZ39HEJQ3B3ROjOkNrimjgzmspOppMAnFmdPTbVSsWkkgJpI5qa547B7moaIp4ZFk/Gm4LulzmSe+JtYMy+yfGUolrdJCjIrjlIIDWZYIqaNGYZecv6TKVSWOazgcH1NJmjnEbchxu8srvETz9+Dw92+61EQR8H/IYiAeU3UerHkfBHfHh4iZ97/g3sdwWX2OGoSSW3so9XpKuc/tug+mZny2HWMy8UPRHNOelW6WoupdGUesQIJ3K+1ySsuc2N69aisZ2jgoO8Csp8gbt65KkIeBwOMpchk9l6+7tMWZ8C+TMBcILJU6TxyrOaWnlufydhu8vTmQqYwWd+1qFyEzLMUBNxxux//KbTzgfbHjR3VPRjZyvxjv4PGBIKdL+WQdbdddjc2OQ832HNAK9NLwbnXE6+DpGMarREPsvkKWd64E0ZKedMl06CVYTEOCcpEgkexLZs+b7PMTf0/TzXFW+8N+/TIfbeZtb3nv8+m1I9jfI8I3POPgw330tn0C2NW6uwsUY1AWhHTgpnTJzNPQR4uL/ER4db/PzHX8f18XZ23VYk4DdFIsjfwES/M53/YoV08zG+8vzb2O13eMA9DseTrSSKOd5phVK6aoJZQ+qkoME3PUPCJg9TnLGZHGDqPOUktTUuM1HxJ6b9mEhMYreUDUk4+PZrYPvnnxl8wtVnu2KNrCalUJaNMy28FiNJzLPFx7meKzMUPNmpDDZyQk6cEa3ysTnxuUd2D5sfxlJEdLI3BIMHPMf5IUf5UJiYhibQb9Joa0pp8ynMKXzw/HomJn+OuAamhCdy9DNQ8M9X16wTiFwrBSLWVGCve7S52Xd94HONMlByHn4MIwFGvyp2AyxgiLmexUuPktoYZStNzGUUeTTDlpCb9lQoaYreKCBHQLa7ZZoQKhXJmo81GDzCQi5Cc+SUtoSj4yi29QU9U4PTgCwmx2MNWQWEss/46F6aBfgZvSRGvz9Pf80UyOD7FAnHyJ5WmyfoYoc0EFZj+mbwRwDx4nCDh9jjZ159Dw/nGQIzJOD7niRYfgMKit3S+a9SP8ykft++/Rh/+9k3sd/t8QB7HBeiXdgzmyufQhcG5aBLhOx5eUBAx8PR9PrqRhWBYBISo7gxGzxBEKWZVmBgWCsZnOTP0VejdUglPpAuBZvOwcyyx2Eoyb0zVolMaUxzmvuamKD3VVNPhGKqReQO6Jxc7TU0Zt7xuIWrmIop1yClFlpidjVaZIUcDiK6NMs3OCdJJvJbJ2HJvOjPSeg2xiSTEWCqR6aSo42B/HTkRCOQ5VkxfeaeF+VAaFRD1FqhN7jUxa5nODSUOrmwntWUEgySOTaJmP9+Z9h3GWL4PXajKoVRkWn82SWgStefG1N/BkMtZQpM/K3qWnq3yzp9ZtHGOIpzYpJBqNjCcGaeZJx3+32NRaVBy4eYPg+KskPTTTlvSblAkpqMUsbuI1cZpVqmQduXhVMwGRh/3iXDqcgaiI6TwnVQXoXX8mFNkntbtodoOC8xFL+rlLivq1jIafm+Yv8uStJxUpPWZESF15HFw90FnvOAX3j6zXNIAEwi+Ge2knF/IBAAS/X7LIB/B8Cr2eGvzfwP1/hbz35tifHdDYe/39oaAniYqnirAHPqlUdVzrAj98heZlxtOQXmKMdq0C0hyWGvjpGiGBLk0nTN8q7zfNc3FMZxPxNR8YyNbTANai9SA2mxrTjyjt4t9PThUB+Y5htjGGVK3UayYsxeiWE/nRuSpF7BzCbzExA+K5cHt7ovfwhqQpqbJ4ljoqaGYBM7LN2Qh0ycBZ4bDo9dklvb5LS4kCePWUOloDCIc1CO0ImSaVAeZge5nsykaRxTZdldX7/MFNWBqBWUMxmEpRtxIeRiDCFYE1Ow0N+azHgw1bNRZExs7NbVbSYtTMydFJLxhmWjLQ6sRuMqBRpqJCkjhW6d27M5cdTcQKGy4iEUnWI06BpG9wnbs2d5plgIvJOBD2FR19jeYwL/gt21s103TSYSGzzXuK/klqw/x12oksyXsonYeglKwYvDNZ6UPX7myWdxWTY5AQXAUwA/RfLr388UwfJ9TPWrki4A/PMAHo+H/+lifXS4xs89+3qb+VfBEqByI8VWYfoh0Pp+Ro/45saGvjExGev0is2ToCKLWUq9N7MRTq+4O9rQDYHaZzaIcmRiM7BmG+FITPNN79RoTn2yKt+S0EzOBjcpWl57rZNlBkjNQZDzSXFPH4zVtxsABYtTRjQgmrRosLmFsTAaKbKNYRQ752ZIomBtG6A6xcJQ+RQ35xqZvnc9FPtB1L8F1TuJU4fksURmLcWeXIfUyTA6ywQooF2XYAPMNiZoRaAn94kj1C9N0IulW7PNfD00leVaGcJ34qFC37x8Lli3b+qc1YxnvTqK7H6Z/Q6pMKbrRjSZEzFaandjSrWAKXqnZu53TGM57+AA2v3tRjeOODF52Mf3YHelZOZcaICG+/XpPBeauVg0q2H4eWCbZ5L5RmEdtXXIaAWs9F3smoeC1eUospEIjdjLyfOtMZZrRGiUFFhMvZLt1eRgujWzis527U4yDhwGc0PmNLeA0XbY/k6rO6GSVoa25twyXFF99nB/iWf1Fv/Ox9/AbT1sIQF1OVP/eUkXy1nLH4gCYDX6kfQEwF8B8E9uSf2eH27w88+/AZYdrpbOf/33VUhwcu6icpyoguRGG9ax3UIyzw81mXBpLvsR74ZLOM7P3ZcgGxcrSGNkJDN/DGMlOTP2GeJsNJFlTar+YaLO+wJGk7SvlMQ398VLIxaN8zqtcL1iZzIjKMdkPEYXtNDpa5CPYjaiiXTADe8T9uJpIGsOMY6YEaLje7ifoT4xeKdNcms+DDh8vzjP1zjlUnS8PPvxlEkuHB+Ije6y94e6F2HUO15aN6U8d/XnjhaIMxALOVEx9HGS7iDDeVE0l6/GrniTlzIgGxuo0ESpMxMIzLkAnD7r2pDDkQgjwLEL5jTGe8OWbRi7qMyunKZuiIOiIimFmPajFkE+iXw567PEmXxSd2PmxGB7fXb1s1vTPiyX+FDX+Mqzb+Kg4zmJ4D8J4K8sZ235fhQB/D4UAKvF738IwP8LwHGZVSSHv1v8zWdfR6XwiBc4ogbCDsOmGZn/rFHDromglsk/jeb8l8OCVtkfoptGROiHaFwmSGmSGOpuXPn1MGOXmM93DAoeddXCZHTQO9gskdrW50dszTPkgRhm1D6VE2m0zUzvTmg9J3zOoHYHQItQbbI8y3+XF4IxZU5bBmYp3TAThhSMg6LngajAIB/DD50slKPclEJsYvBQMKZK3g7BWa/Z1CY7aO+sGhDU4deQqqb0edyL3Qhtc2+WFIplxk7RC71H6QZ3oxz964S7NGWIKZS9YBf8GqV4zizBoyZueTTBeAkxxzEjfpalp3DPApyu0WQImaxpi0DKKZR9rtzDt2jEYk15cG20UWjGVNmeN5oPhSRFxoNpKEHJOKaYmAFW9dAmaXTHRxhDTXwlpvxoNthcSd4X3U+1eWD12OvIsTibEzeMifKYIpk0KQ+yXX2qcC7RTNcqPEHUGpZTEMfymJ4OmpfHa7y1e4SfePwudmXam69n63+Y5P97PXt/yxCAZRZxlPRjAP6ihRskb/8jfv7ZN3BAxaNygeMQnKLYvLJDV6zZI5uezhn7mhRWUVceQIKGytDlnGF7zYoszU1QethJmVauo1wuOpV4ah6IgZE6zgVL129TDhD3sYRX9+K0H8yvG0I0hIn9roY2IW6hNZwqHPy55/NEBjFXll4wKro5wTcWss5gGOOb39q5FUwsa3GmUx2bfNooKWuxY4oyh0AS2GhjiGkcrHfz8tHk/kV9NEs0aWeOjeXobRFs3/NSnfovlBjzROcizKAqDU6MQjycuJBWi9yWdWwrm58EFRLdIlckbXHclBQMhLz11pTCtGZPv15spBCDZhTwmUjeUzD8Cal3Ts/3Z4M5UVHh8xY/q4tS7Jbzf+ZxNiGziRPSalXXXxXjYTH5VAx+HkRMOklSUyd6h2krE8lvW27bQ382igOx8yOS/0BhCWTpYbBpn8dHCLLsijGSaYK2Mo7VMuJEcDGWPI0Dvn18hn/w8nvnGvYK4C9K+rHl7C2/JQiAvfHnAPzrAH7vLNb3qIq//exb+N7xOV7ZXaHWGvlBKYnPI3VlNp6adaAZQOJyfdQPR9zhGOUEOC18BO9ecofQU70wOswEPVNkOpMx2MXzrjEY4Ew09RNzCkHRClNZLjOx2CRHAh4zmQ3x56RgyeuoS6jS1TkLQSLph5A0yOpyfLKoYJnLTbg0pbid8cdX2pR9/ipaEhutzFA/mZQj7Mi5ffsgyXSzp2QvZZbSGWZ1XokGImMP3glyyFmrE8YCM28LZY6bSWn7uCpv4hx8KRSChJiFmpxnJQyWr3b/+6NEk1cOmYrJppeTzzZcvShDzM7SEyJrJNfFcjCjKD0RlKesEESzITJ9fm2tbHQpY1A9xCCJPMTxEZrs98nI/i8JwPJuOI7hYoMWzbLUh2aMUe1ETvZTMAeapUIO44RUnTCZX63NRa0a/TPM6C3nL4ySM8Q4xSGVVVFeGDpItUbA0xujtXL0ogg22ewdZOXJLOgnrt7BZ69exYZlcAHwcwD+MIBfW75r/U1HAJY3/aPL4X/IjH8A+Nr1B/je8SVe2T1ERY1zNTUaUNsIZRey30AGOSCbQ4QmYQ9lIRVqmB83WYti/FVLbWvJf0lVY78X4F8jGYVoWJe2bTX9wdPT5vxikN/0VC0FSq6CTIYYML61iIKRcjyvgNFuk+HjzGbcjP7bLkcyiVGDtKIjzOBmplnYvRST3dr1NqKdDB7RqVvU6jFAI15Oy4BOtnSVwHrPm+uiyc1agTSoI7RpNhpgbbkcs6MXoZMyaWukoKQoXUdykoe859V3F8xJwqIYbK9D92TQeWTeW3fdaDImAV0K7hMA02ViJKPWnAwpjytyFcg/gwMkbXn3CGUluBayg5GdvKcgG41xw3KFgLHsAhnUdLWlcJDmrWsuXq6FFFgjjK1QfMbiDtzYHgKvKMKeGix4LclUEwRTqVdS4jmE/YGZBhsO+igRCNYgvbhNXA+G+xPfG5xHu3mGCQevfvawtMIEbarJJL3I7mtJ7eCmWf7K5muODNAJ2oEpNJkchVqDMbCpBXX5ehC09K1FxNX+Af7Oy+/guzcfzzDkspy1vxfAH/31qgHKr2PuXyX9LIC/MJ/7E1+//gi/fP0Ur+wuQjpfQ8hX+HgJVZGZ8ER6VE/bGs7StmEZ0SwdNN3idMtvOtDne6aAujywH3RWwVpnRTqLlGblyngAO7kNfTPVkKvJEE4ROAuK0iASKJ4stmHr2T5bTibzUA57mis6I13skNriLNAOIaU5fXvoFPs1Zxj3+Zt9Z473ysHuYGNLDfj8wHJHP8zycU3OvPMUipt1rhdmkPICVdFMkf1ermsq8Fbo8bcKxuYjiKrQ/Xhx0xnTdujbHHXIV5DHV/fxRy84hPwI5BjqprSwc0V2/2TfYz3ggidFSIWMsa/r69ZVX63MIRgzKahIIsx0Ade0U5M5GmPE7+olEBzjVvFMIBQzxuTavkBjlytB3QOPXD09NBjhtGvOFmDkP+dkWtqsMLDZzUAsqKeCF/gaKL52o+uByVbsc3JgOcITvPqpyNNaGzpZc7CqRsCJTwYHgl4fT5jcOIeJiSOZ20Ig+ueI0kEZ3zvuDx4X7mZvNBtv2QiF/R5NFB9+4YLKZW3kFC2tBWAP4mK3wy+++BaeHV/OAOzdcub+BUk/u5zFu9+UEUBy+/urAP6TS0Wy96r0e4fn+Pln38TD3QUuUE7+/jQ2P1LGtl9WPzia4USZKMgTvKeJ5J4jEzVAXOScsLwSXnTKMndiDR3uBkeNOO/Ka9FA7pP5o89AbDc6CmOFySUJkaAYIbTmhU0EiLe7L6pthkzQZy/G4karnJdBzXH7QbZEDMZWUoehNXY82f8+bq3acG/sWneGDAkGVzglyK4dWlTLH68BbnYP84m7aSIS9eJEg2xMd9OG52S4Ke9bXTIlRSODTIBhBDeHJTVYovM0E6bPpG28kezmyWQo0MilE6e3lIi3QukerdCKI6X1zijvjM9lcm1o99N8MBg8RUPEsUbIChwikhjX6Mz1DzM3vhlWNRv8IBR9XaqnXoxNb9po86wUpUczy4kZEb05CXkWyW+/O2j2wqHW7rWSfU60Ydod01A0EijNuXIYHTCNGQJiEFMk59Eufj05mluO23Y6Lvq+dc50G0Nqgd1P46y/qNd4ggv8wVe/NNsS1jP3/0zyD31al8BPgwAUABeS/gcA/tFlJrHzr3ZTj/jF59/Fg7LDHgUHJeMeGYyfkL/Suksfc5WVT4kx+kshhCqyPC24oh1mc7OK0bykP6EFG97+JnaUqZ/ktqrQptm2ar4Rcx/rOvsF/9B1Jm/UVNMiLPKbBATIWjUFMiVDJQ+LS+5jGyZHM4VDTmdqTnICpbMMM/Vu4DE4kwx+LZr4o69UpuAfKaLGI3/qYR5T02kw/ExtFTcOu3u2XDWc2ncI5k6MYdVB+rSVBBCIlMOWpFnm2YTSwMnuzM339hk/feQ5C1ay4mpG6o0jEA6iXb9ZnCwvmpvlOlYUNdNkDmGPll+3IUkDZkDwqaiQ+ZnkQ9J5TLSX5hi+gzQZGWY9yfY4mCLESN9xTBCFf8QYFU5sf7ZzIYq0985KwcnViG6TZ7JQRsUph4cgkw5n8cI1p24yIl75/KwYeLkNbWthQ8iy7w3hdN6Tmr+HF2+90braPcD7xxv8nY+/NfNS3C0f7x9dzuKLT3Oe81MY/kjSTwL4GwCuhj5EwM89/yY+rC/xuFyimtY/njhRktblaOyGInQpGob58/rz2x7Us25zRtySxbuXDh1xwqEik194JEd1eYma7zdT5c2xJE7deebjebcYBSsBliNH2RCSKyJz9TmSdSI7n6EjD25X4Vq4A2NEUGTjG22FqphZi9zfPIAYvbqv61w2oxhrMiTcInUujZxO8We+9Mnjvy0NpZykxn+IDoXVRlieXpZ5eplLqrQ5jJGv1vllM6Dms8/2WSo1yJvahlbYZ+E2omnQrSNOAbGioXQ0AifHEB8/AJkKhQHN0Nwq2W2uU+GjCYTCCVc7H7xUTnybZHeFLIh1bZbuNcHEYJ9608cMAVGD5wQDOXS0NR4OtkaEiwz7nHjaC1LF0U5Wsw6Oke7kyDF3pSrMHtxRUnAr8ZjqqSzf5YR4nDkFnj+SSeHkROmsxBXwA5+pmVMIgpsWwJPavXFKppj0doy0Zq7fdPBCbY08v73GTzx6B5+/eh2aPg14CeAPkvzKekZ/3xGARfInSV/CyfDn0mV/6zv+0svv4v3Dczwq+yb3a47TQ1pfNzTNHvAM9qy9MRw742740A492zhFbjKBkYgtHAJeTv9TRURGizvP+YxZUdozMcdv4pgysrCbl3kicCn1oxRt7s7NXO6pl4jiA66lL86BRXPQymejcYN3I6ew2SFllU+trpIGiz7v8+KqnDZdJ9VoY7TC0q7lChlHkmM/6DgBd50FKtVTSMoshU7RLe3kKd5jqWVjJglzqnPqFWS+7C41kxGqaldoRXmYe7evBzKESoVNr83/mWyIOCvMTq9TJ+Oqdm+IVpSdu9cIsLIDW4nMK4bETCh2i9RMuU9zkHNJrGYoeJhfa/GCj+6A2dCFKaNCjX/kz1VWc8hMldQCuoRMeFh3o/gsKXleWJfPuC/k4iwqjdjdIzXzFlIkdzoLWslytUVDY5KMqmlsX1b0t/XM0TFxSGEPVsc18l9y4UY3kWNKxNySdGvMLQkqZ5pvS7ykYDU+QTrvUiGzcghqRlnUR92rOdBaXBQUXO0u8fdefA/Px8yAVRZ4uRgEfWk5o8v3HQFY4giPAP4ZAP/d2dz/mzcf4RdffAeP9pcratluSA4wmyXLiml+Fmb6SpC1IYrFaux09+g+NpwcmhpFKz4GIBFMSTSVgSlt7iZQcpvVxJydiW8DfWuAua3AWCHUYnISeVXsc9FEoBGDlLH1z4yYAPy6ieOg2Y2V8vtzLvHDahnbTH+YBF2M1zPP7cJto5G5GCr/zsS3OX3q/KNJT425EcEHoqakSQU0yU1LgjHVSm5bULCYyrflW6+4QxprPZr5cOrEN6w1mBeGI2fNqKqm0JWZqY4CpyGws6l4Lya2Ot27XcO6lBc4mhScZAwCC7kCin43MztOaWDDOJLU/RHmEdDiqJOjyV0ntO++x2ic47tMdzSrmgAeinhfMDzze5Ln1KOaOCJrA12Ak33QzJI0HzTBnt8GoVsgmqb5Rlo6IJ1VaTszn7MAIXIajOUxlsymVDHUBVMtIjeSFA218QMoSqFtNGBNIg0N9lwKDfd4lHoWAi/qAQ9qwR947fO4LPt8eK9n8T8H4F8AsCN5+L4hAEtFccRJ8/9ns96fAF7WW/z9l+/jAfdLh2ozaW/WUjfolo0ukwpQi5TG4wZYBzIQg28zpbkMLJF44qycvSLz6S9psz3LAjMG8CpTCoxfOjNbnTnvmnqlbHVnn2pjY15fVdlKVhFOU/f9x+A6mCBRdTILFbvjQUFhjHNOk3848XJVym5P3QHn81kx+sortVed5GPSz/a9uxRo/S8dwl/kWp3QN2sTGWBmDXL9jsgoKSyapjzgXbLNwjZLU040lnXKdtBgiMPge66cYsSublh5N8FLMWjDZ06R/T1cIhhDuWm5eAxW1lnSGGbbLvdNqEhOqhZHdZC7Ia73uks2FZRwZCqwwKRXnxkrq3d/WpM+V2mhd4QubfS0zWz3HLkOyuNszkypLLSsyROdzJg4Cisbnx2ZbKocOjGVHQ1gVNq0zAAO9j2BMSTjVQTU0r0ENHFD9XUdqFdRseMBY27r7E6MM4UP6Hc13BnjZnDIEpDnlUC258yM21zaamocjowH+jhPjgj2/Sskrqb3qAAelAs8xwF/7/l3ZrbNa17An13O6HsbBJVPoPkXgD8B4Ev5d48S/s6L76JCuNjtl0xpg98qOtlKFq1o8pTmcCaO5kBOWDE5R5tni8NzExNHTV50xnZ9vTFxPyoBju4vrkSh6kVICIVhDJOYmeK6pNEfQOR0wYzmc5a/68q6FB3LtPE2yZ6ReyZpWE5goh2UNJa0I4UMGwLToFxBb9bYyOxQWE4pW1+LinHLwX2u6YprIGHSeRpEkOVRefJk97llT9QenSwPhVEoCAH0eegy968ZzVEy8jHr1iDRolkHq4fH0Ikw+fLa6VKXOFRJi/dGX5O+QdEIsl4gocn4FHw4AtTeQqbswAlhHrYJq4cFwYuyJNuTkXSDZkeu2+8FlHw9aEKAl6K7m7Lrfb++faxmgUy2Zzj3pV0XpTm6xXNTaRas7IXgEsIx71FedGYTJXYvCb+WIYgp7Q/twPSOmmNIEaTpKCwkpK7FT1XPSEsImxOJ3cchFqUml56Md5TJkFMUUIHUKHf+W163JjWBp//IgrjGuHZvPNkkod2LZFEjLARdNQda9zqyACLRoolptgJKPiwxAXd9iYcXD/Ct22f4zvXHW+f4lwD8ie8rB2CpJCTpPQB/MrsiA8DXbz7CB8cXeLS76PAr0yjVY69k8JhZ+2qYiSs4YoUUPtjiZy+YUqZV4m8rzQE1H4QwQrgKm0fXLosjy73nQo9hL+tnBpm41zpHXRyysaPHaILWktjZ0wA5gdcyYSp2kbJEQk6jhmfE6InuYBhlrN1UJMZzwhJbbzunGaHK14/dCyGGDJnbX2YVpy5KLrVjJ0wpRcxGMzFOo0k1gZU3HM1nZo+x+xBDAdbNY07rsyp8CfNXUih2YmrfzDQmdiZBqx7y8Cz8pznwcTP+NBQ+wkaEsBnFTKJ73CAqoCfoM/Wmy1dKPWxogFLq6CSmIpB21WymLQpxGu7D9nOyEcYkY2719pDxApYGyE9x99+Q0nNMgRjNfUhDD5kgBs22i5FaRvnYSRa+xIRyMdlxRMK2Oy2KPUApavIVpHCeyBmQT8UiZZYxsB6a9LGVQ+6KEfHccOP2MixGqWdV12RcMJHdksmfIDxv0wSiSSi4sN/t8ZXn38LHx+tp3hiAP7mc1ffiAtwHAShLRfGnAPzoMgpoU/cPD9f46ov3l8MfqKiRpIVis+Z+MDLwN8oQotZNVsaNgKMJ5dhOc+L7wYlIhNtzKE6TuMZUNWdjdW9z9XjfwTQV8zwDdRKR/0YBgzcC5YtzzDBv9qOZvrRsHj28wiNPJxIKKskS2l4fmca500JUa8wlPDa3dXWbRllXBO6UZG7ZfLvEVaEaSFYdej/Zbgq9w4+lQcVMb8F2JHBIslsh3yjyWDb36rbO60dVK4QzEz3Y0WZUSnN/UFe6EJkVzq2E8pCj0ci1nBOFmANcNpMyrf9tiZfpPRXUtikOYbmyVTHO2QcyTIdvEqtF/x+aj0awv2tukx6r3bbGFLDVvkti0kXZn3Xa63NbENjvHGN3pkYyp1wHv5tKRP3TgV9yaO0qX17OgDJx+5MpBhhMsLp4lVKU63IQxEYKQqsNagyAUprjVy3PRI28HUcyjRxa7GpVl4+yBF5PmYQhl1I2wp6SUE/YdCPwUTYxIbOVcS9vPAAimKchk3xTSqmSmVO7sBW4LHvc7oC/++I7mbuyjul/FMCfWs7s8usiAS7M/yrphwH8X5cXDy/8tz76Oj6ut3i436PWeW5omwxOZE2a3hd1iZFDTj7jJUYnKZ+zRv1KSINzkkrUIyH4djsc1qtrn5nOhB1m/5s1rObLLUw4K+ux4klnOL/xT23VwWDuMUjBmQNnjBFu3UZ0J5vYyRsJ0HU5J+fC+XETswk6q1l2XxuEV3K0raLjkrXMXB4xl+QMaYwNairRfjSY9kTCaUcAFF1chiTF7Ic+UT0rujavkCzTd1GKiB4zToxEFsJFNJCg3JCmOUpONddxntCltbHcll8PJrKhGf7kWOi16/Yo1+acJ22OxyLpcZJYwyFAdFikCmRYpIMc4TMHhpyTLw0CX9dwlabZE9zIhujFWL5PGTFJnhSMh78UiXk5t6AhCSGgsT9YWfHh66+ajHnqCrGOOpZOujCXQUp8OiapcSIPui+Lr1VXgK3JeLX2lNDkvNa89VNGB+2ZykmNLY00SQfpaY+5mdEk8dVNr2bl3ODFxIAsn3xP1iCzEoilCuaNC1egAC9vX+LHH76Dzz14LfcBBPD3APzHSf6D9Qz/9YwACOCPA/g967a8fqhfefEhntaXeLhbJH9usoLs8xzNmriRJx+IeGaxu51BPiLiHCq6UeK6Et06bO9zegaqGlMSW9zwGdjknsjXMwW6KxnDXDNFkTHTqqK1a37Ilb9Usk+tDVbT6AMzwFqRwOMmF5EBqPQZZ3WIhoFGqMcmrndhMw5Ce1m1bGIpbtnUGWfCvdpDFqqCKYzfkxh0NOrj4ixSyaZYQ1EKcq5FD0FB0eJ1ZMumtlnjHJTZTtminRnIRWlcxWkFabLCOiTTraiFB0V5xGyeThGajj6aOmhqqZ6JfpFTMAbfDH6i/aBnzgtJMrLBY0eLnNO7DcZ+Ikb9dbtmt0gGgpR1tGmucTRKU3EoKvDYLG37z8yGcgNZmEFTaKqYaMakzHFLUgGF7rXf15oUmmQ2SNJ0Wqnhn2Nh0rlBHAt+/400YpgZJ1S4bTRHEylu1GvTvNRsp3xHmGiuW5f7x+adgahmCVHNDGdEIxNW4LJc4FdefoCbesznuZaz+o9L4qdGAOyX3wbw/wXwxeU6FgJ4drjB3/jo13C532OXZnGNMYwM/cwjLiUnpDAa1HiueXI5c9a8yIkkJ85iOPGNZpB3xcrLDX04m7Eb+9yFOi1sIuRwr91eSYeBkv2oHxqyhz/rWrtRBHNW6einOskZ55CWled8OTSoMW5lhB7vKoL0T82zALOUPb8GtOttJCxmQhxjtG9gWSjG0nJD8xsy7WndPhnmhZ1DIEvIU9CrKj+Y6Da0oRt1eGOSYOiWqyGlLv3MTKWUDbakuN6d/1CoYQNb13hNfXfrvshBktqteJWCZBAlY46UGHIQfOfsegVf9FZgp/S7mcw36AiTpfHaOSUVQl/7G2ugrcUo640WmrTUzSRDlIXOpM7U3ShbSiInOnp/vpO1bfTZcCnmaAjE7FoVEhoNCXTZo2Yxl4aKKGp8aOtEgSCtsK+puhrKCcPda79npfRkUb++UvxOAXmj38vlB6sGGW9GY5iTUcdbaWha5kqVsAe03W2y32fEZjA8Q4QUKhLCsayeQuLl8QZv7K/wM08+5/3jigJ8DcC/G8B3zlkEn0MAdssv/TkAn1+lf1wYzr/0/DtgAfYoDQqbuY2GuQ85VPgKSWYebsKgZ+8DmBw/y6AT5cYAgph1ugwhKnE84DaAGk1pPF0wdel0mMjMNVZXNm1Y/iJxlIfSOuldlSxao4QlxrOG14lwiZ2feTzh6YmKb0oF2QtDN6vE6Ri9rzWRWylxLGRtGWeeWskWWhvqikjUjIoEeeQpRp8fumuaEVUbzBrqLsVkxxygEySxCsExSggDPdzJIH5C2OqXpay8DEHWGKcoNMJjNCEKt9qirLtxUCxOoYnBDwb/rHCtXBQ5UE88cEhK90dNxRCkwhydfqUJauesjuY+ymAoJqQDnXMeD+fNk8HbSEhJYqyFZEZMbYdHxoF742vkOsDJkPG6iZ0xHShps2aRCKoRJTMrOcw52QeRnz9HiUNqJcYIdQ/8mfD+5sbBGs4cJe8IT8KMDqwaXZ8nslvN8P2kdQzBQulP/uwo2WtnMydt2aUvn+lqf4Hv3j7H924+9hW9SgI/D+DPLWf47hMhAEva33GZ/f9VAD8J4ChgRwC/ev0Uf+/Fd/B4dxUkfwxdkeCZMEpeq036lDT47TXWeMTSZ5lNV2umAlR0vpAxY1tnkQw71pmX3BxI7L+/VHoZTgvjweSRv86N3CO6X5eyuLf1zx9IIpkUJA3sxXZ4LCdEYzqz2GeIhiw5ECWH1iho6Nk6rraZp1z6YOxDlwDF4kTNwIJjtpH57Aa3LBSD8JQCiqKbns8saQl8Mrc7Jn/0qg6Hx5xxbwjodkQ2J6TZvarHBq9aaPN2qhUhcAhuCEM/qJg6P4ymT6X0+NvE9I7KEiclK6Tw+br1TJ7edVcLelmL6ZrcHRi4Gq6o6Bv/EpcrDayCLhPjMF8NSNs4CVzaGW8CTmujZIqroga8WwxrjH7XQA8KFtbrZ3XjHKbxAz3WGdHbNtAjQBQqpAkG9wy3NnZjq4BAdDOufi8TJ2Vq+nNyplzp90ymVZza5kYDnmBZnPZFDgFdDEmcDLHBboonpLozGlE5GrP+bOkNQkmFhrSy0hcXxeCzplSWmzUyLBBNPZEx8gCW56adQ379I8eEhmygrghGseagf7dMfcAaNV0RuQBEQ03EWCwQxG09YF+BP/jqF/CgtHN+Tef9CoA/tHABdiSP90YAlnjBP9YPf+2Ik+HP1168j4vdRafxMrqqhY262TBalUsDwO2f6QQwpI4zbe00O1ePbV2jGRVVy6FbGCzm09jBySCkaXNp0LMwJITRdaa2dXj+d7c3td+T+bIr5WFOQmeykZHD4r2zZdqgFbLVHUaTzW3lSXJtrqkpBWNGVAI7p6Jm7NogvNCdmxtbw1+U4oKF8OCGSj4FgTkZtEuK2EZKfZzBVoStm2uysAgtKbM3uRcyzSBnDPxo3gGKXY0XLwM93lGJ4DbmueKp+6AG6+WOjFgojpuT0OOKBeYRG912gEYQU+gAs6DVzQwD8mO/u14vGTdj/f6OMCglPdG09nDN/npYyH0q+r4TRpEeNkQf1aSRQ+YxpUyMKg1WvAx2tH4Y98bE7dBXyR6X7AyGPUKWBaKgRpCtr9UTwQuNJoVjl/X5KE+IXXgknOWKVGMYpRdAzK4tZkRkSEwvwINmaNr5hj3LJKPVUZk24WIaDcTETTXfBrZnl8Z9iIRphuyCaquYKdyqNxLZyl4xwMzdWNu2ZmNXzz4QQ4x9tlKhQSuXuz2udcSvvHzfr90aF/yTAP7YuajgshH4c1xm//90dv37+sunuMYRD7jr+uIgDUpOV+Swt8my5Nm6LjNsECw3fSFxcCQi9QctwqPugT049MpnkpGxWqWg05FZ7LqXd60aFSQ2Hq5QIitrZDqHGT3CpjrCfTIDlJMsaIDNcpEl25xCSqFigrrNHqW6fIcSVICxij9Z3FCxIKmqtkhpGwV7ul8g8tSkCFw+VxnBAg5ZARFc84CdIKFs7nyJyCnLMvcNrS6Jgdbp1sAEVkr+KmFNCjxV8oX9wGxM/Di6kbJQEMnRUn02v3ZspUxSK7P7WQ/3AZjkREwFr0OYNZBDvbiVsIlUGEkk6G85xHuUqDNfn3v5vXb8xSnsnIY5Rb5LRfIhSqoeazxWG3t6FkLKv1MUFDoJDqU0ZrpL1wo5Tw00oxs5nFtrVwcRCUXTmIGX3CbXArTWLumrA6hbJvB5l9jVVH0G8Gi9/tVdB7WpfgAZGy1NyMc5Ac020LpcD7+viU4SRisxIjgRGFU77zRxOeNvFMsySciWxyDXCm3YtZTCUISo1jgasZE2WdJ3sN3Qxyu+LwoQSjAAKxbmdbG/wK/dfIhnh5ezUcA/DeDtBdEfEP/9GfOftwA8AlAqoALig9vn+JWXT/Hw4sKqsKRXnBzUngcQknYbmKMge+tZ9YAqk+w+zmVON8fnJBoWkcPiwabSoQpZNWuObpSgsrjQVXOvggK6gaD/NG999XZbLu1gnC0PDOMJK9xDJtbNs6ydAGsvjNoohEM0MFPkrzN+6YxjpkwGdMZw76JKcOQL2Q3m9x8UFE3CxC4pgwadt9Jc10lPhgb3OlsRHl8dFVvWQ4JKabwHJfOhEzRYBq7KavUcpGuKXJMY1apmpeusqcHu2rtxJ1gOClAFx8SoasnqZ6XRAEPQS9AXO3Tr4zlkbbINR2gjmjC/VfjHPjrJDHqHXzWmRdHIiJrE0voM2zq+1R2PE5MZeUMwkfd1j/5uWNbGE1XNZIrKzYNSxkOUOA6JnYPXFaFJSFTPxWAbN3VvfrN15swh1Hgz/hygh9J0tLY7NCb6cdqfY6BZk9B5p+3MwsK038EaN7QRVJdpMpo3qI+mAiI8SS9kasSi6UK08vYdfEVXio1Z1wwbFASpZTekc+Iq4swnPdpKDXBDYZIsdc0ZKKuhgI8qHd5NtXBVxb4U3AD46ovv4ctPPuvFelnO8LckfXumiytzR1xWAP8sgDdQ65EAq4SvPf8QKsBuo6rc0upluwwwSstibKsbtrC7a23o7bXK3CbGGkyHUozvTZK2bH/rm4rLWuR63GS44htLIBTORCSMbmQaP/vohjWm9uWQv7HCTg9Qmgdnu00nL/qcPJh0kMOdnWXbzzK5adrqqSPNWo1zYivI7KhncJrd2/XBrM1D3r9vtPEjBhF5P7DNB+GcFYPOyIVy8oLIaTaoIxM6s2qUs3WzYRXncbmya4FM9CZChv3d4qGk9Nc5jwpOOlpseEPMnheapXZUvCgUt0yJlZm0x4klsNVr6tyk6OGQ9gq5SdToGhjBnlEYa/jGdK8B46gU4fCPREtlohmTSd2E9EylkKU21lDgH3XXUrMdHmb7jDN8Zj1gljcbCdMnfAblcz552DhveiPXHP5oXKcUcKVke+wFAUw9pElhEQ7lQb3GqXMfJimSHnCSQbX4TI2yy4FrZ3vrg90lvn37HN+9feaL7wjgDQD/7HKm82wBsMwKJOkfAfBHAKCWQgJ4/+Y53j+8wMPd3ljmKbvZw2lCmIjS3H2FOGuM2DWmPY3iLpexEWaaAJOHdPc9Vpe9CXGMYtnsOQFttfclA4kH7pLl80nnB6gunnJ9kl0XFzqRTc6RtqIlUCPO63qFy0SuVIs7jSFA0TUORmSMMbhLJoMWlwAjtPnwgUPiG8OhnRMVaZt8ICil18wRxrRsgHUOVqVeJCwckw4u0ZwW1J6RgY9hc0+KLW6Y5gQnIYQZtewGGMEyORMqWLgiEEDbZ123uYIYB2z++1ly6I5uko8yOhLiDoYrPyOMdJZ11Iu34q7Ty3cxvwLCuitby8v3o0Ul02V8pFkQM/qpuwUxelG2Pm/BMc8PaJulnmbV/YAtJaX9sb9rSzU0Um2bfYd7ze71YcErbf1Q4Tu2+atHtLY9qDbb46hA0IkEyY40UBrzRzQWPs2gyXgLxX0dBtMi69qLppa43W576bJVu3+lk6ntXsoyJJpddHZSVEQD5F6/NC6RbVJcI9oV/TKCryNlTa6Q8x2caCwXnDMmTEpOpmSbp9fqgWBGcvQ9f0VOi3G3VtdQdV8CqURPG/r1UvhOHS2LXjLZoMqTIevCPKS7CNEVZgq8A+lEuN6VHX7lxQc4qOYK9I8sZ7oyH6BMun8t5IG3K+qxAKVK+OXrD1B2u6X7V9e3RgwyzrWdxBBySKKUDskNJHdBdPmUkhtcinqdP21KLl6Kdj/J8CV7QstZonNv1IlV3ihRUeINNH92JdldtsmY+XVTpjdNxkMwWPsuqEaRHzBonKI7R0ow7N7czGlESIPYSQZ3ng8KURM6AB9MmJLS2lMytkmuU3PZVh+b9MOSwRQoJpJsIADZiM+L0iTHoubLxcdSbTNx1rEQkgO1Zb5L5xFa2llifIdo3OF5sIw/JWxTHGReU2kRs5IlIRP65AHlHAxwJs+kOFUl66434Ux3p3MP+xBe6cqgSPJlRBswykNnrNru668QctU7eA7mNjn2OiM01DgGQfZCGZA7Rz6FDaxxWI2Ctq/xpr4uJTU65yGgrprEohD0yJXJCiAniuBZlHXbmzlBIRgDBMgNDFCTZ1yjbZUmfsrJsyARyOIpoVNOwAeHa3zn+tl6/VZ74LcB/CQjlB45AAtB4CjpMwD+8MlF+sR0+d7Nc3x8vMHD/QU8BLasxAczbyi0kBGXrzCaQNa1wSsro1cDuah51S8kiMasDDI1ojBrJumhU8tv1QCFn+Y81XzmJ/COm8o40qBuYxlCalI6FVlCR9yIWPR5WjWYnmMgiRErkSx3hQ0rUGeb29xTMvTDTUnWudRKbiwRd6ur+xOi0U/zQVgIXmHumueTiuYxsVpXZ8tTQz75iuhVaVHLCDWwsZmkVNFD09nPnVnYV5TS6EboBEBPTFy7k7rGPiuHvZo2O8rje6wuEbwVlCJW2aJaY9ytj4TidIKN8OnWzTJrVDduqQ41NmpIDd116KbWfIDqts+WaVATlFly/rqivDSkoMGkT9VyLYzfIg3jT7ZEtvWAqGNuvbqhSkOJWG08XVrRSxsB+KnuaCWhwawqjG2kgJg58Zdu72vOr2227651XvQ5Ez08d/27cvmO1caVtaqNxZqgjP2ZFGVr0YydyIVcZteXsYHCkmsQ3DnV+SArCfH0HaNigkWNbBcoOWYEFlAAIT67hpoUj/xWjtztwdQuz+snfjYzi2NdcTSXL0lL2kKa0PeuLkFXGDsxGVXJ7LyReSOq7To0B9/gvdDNkVqSZXPoI8p+h197+SHeefAEO9LdAf+wpP8tgG8tRH9lBGD9y1cA/GMdARV+7fpD7Etp2ltm+anBobVt8CbMowbtKJJb18Ds9SwaRVjIDyKmGVpz13L0AdnrO5lVhqzmSQaTZJBWMuFVfp8x2VCDj7uCidDY/RtCIUWpG+JcnppEVTcr+IgChLknk996K2Z8pMIEFXepXJ5w+QML00hnC1ixb+AuqaKnfaVUkPA4NmdGcwGT+ztgCCiBI0ohaljJPbGbm7gWWO19JnwKN8MxWR9zhkIrMmNwVJCVeXHAvtbWsBot8HhdI4pT9mWIkzaR8YpuVCuUalDY+viIUQabqCUtKlf1BKu2OKU09wzBgn1tr9+D2dwnNEwMxOIeFMRgGV/cpbD5H3QJXTCdMV7L4C8xjLQ6H56WTd/leQxabvi4zSKN5f4Vtr9pgIMRGoSMDvi82seabpbVSeeKuSbNwIcD6iSzMg9xzMKkqHX0JcU0IxaZkY4qK6A8kCl9/3CeaFAAjx6uCs5+2W6ny/o08TGjh15atHRCATy6d3zq7QUZ/CYikMmpBZrzjGSuVTIEyQFcGcdkji2frsFl2eOj40t8+/qjbOf0jwF4JaMAJVIAtAPwRwHcLKIgfOfmGZ7WGzxYZv+wji9H22VmsTtEccNwmZNQpq6VZot2zTZf9AxgcBSmCzF1KSzhJb0p3bEhK5xx4XGSfauZ0WNgiSuwUDldSCka0wqO88SpMYUPKYZ1sD9N92egp3CUeDWhpnucB2+D1RSoRkORNEeWtXJ+sBTRCJrJk0ETr4F5TIkVpzQofoRTgj2rsZGyN/wkxjAwiDs0M3e+C/nemOZsWm67R9TWMPKoC5+kHdzZpY2MRKMwIowW1cFh0f37vZhitpam3Tc2w6Mgt1z4LicpV9qQFQvBxKs6KSdXCZZ9bk2Igkoh2248E2SWrdPTKNObkK9WDkAZuwQrNMcBX3N01EjEW53klCB9WjF9AgkZYH0PbRojL+1+08xhNGMG1/hZ2ddARZ7DL4YzMjm275uuoKgpVVVj9FUzDfLLVZX2rlX2GxUHZAxCW7kepTA99WaqVTPxOT4oNKfYLseLnz1/vxyh7BUONaOscpBwTyZT2EqhT0Le4b9mkzGZ7J6e3QKg7Hb4tRcfOhdAAG4A/NGV5xfz0Zb2bkn++7cA/HsAHI+qu5//6Jv4GDd4WE6BPy2zuSFmGi26JyzgTXo4J3a8wR1MwMRychwocZz7u+d9nnlZ7ru/R3HI1yr8RhARor95VeecBBkVBwfBOD9j0rG6fEqJVRu90eOYaKaF1YC1uDf9IEsKRsTu526OWGtlLXNbq9W8HhIPYJYuHPITTAVvMlGa33WIGTU9v2jdHKP0ThwLldNZ22Wb8rhm5wgY+TKMIpIlutvn0haKkk3rqBt2N7ls2NO7sHV9Zj++fE/oEs5ZYFSQNjKZJvmIhqlAXymrpblOKtiMM4QAjam5ClwKDhXQGMfavc5t+KNpC5jaxU7CjRrPmCTKcY6QGO1pRj4kjiqMc1oX56Za+dmyYmQIz3KzJzGmaiqrRDlmPyxFQvUxiwaH75hLkDaK6Xaqca0Fz5C1QXFEJNjYKyCF3qBxkhcSjce20958b4rya4VuwkPCBq2Mc1eS8iLYtZgawBGdkGLbZUVJnhTXj1Kh0PpnRSdTlzt6dkXwack3zGES66gF4uXNS/z0o3fxmatXUYFjOZkD/X9I/nsXmb/INamgIUz6gwBeX1/tg9uXeFqvcYme9jcySWYpZzMhICceHtxmpaXOTqmzHQBWRrbqtlP3KH8LQAA7c3UoxjK5SNlJMHeiWSGo6cw+FzPOmJ7GpWHiboRkwYZsrco7aTuhbk0jgphOxsFZkQPufo7nw2AsknPrO4nO0xk5zbLPUQeTqIf2UCnFrzI4LLrrloLjno+Hh+edzulNuGWISo7EUmKU5G2S1BSJmRJS9ruBgGY8poUbICEoPbpZFG3TsYGCGWPV1g/GuWYwWNIQapdAzz7yqqaHyfHbWdevPK6SNncYB3OUAosCMBLzwUyNMyZlShnOTckNhLnauY6NgzIsK1Xce0IhlWIG1bu004Js3EBIGLgvs2BJJw2P+CIn2OZGt7nReoW4K56Jb52EPkcsh2MuCDSLmwkxyrH35iT3OHNUhgSWENc0hBByQmDOezAjiNqNrRxp1FjUJsdb0dI9E8lwTAaJJk6l7PCNl09xVF2dBQTg9eWMb7dqb8E/t5J+FsCPAzgA2P/q9YenrphqJCN59R3stqKDVyMVWZIaQ9gIUzdlYTzFdtxiTnzWqUtRprd+pm50E2MaPXagE1g0gcdnC7ino8mtURWlhRgA+TjLjHPj6AqWDSfGxLsUMmEEscy21+CeFs09qHhYiwEoDmY19MQsRZRBLYnMExPzBIExrS/auudIspiUpr7w3cO8R6LG+a782rXvaanyVgRoUPAzJInKU+QYWchgygTPMaSKiWjRiREjLOs8AucmACHNL+YydLtnKcLAMpczoKIGoY1tr4XuPjq61gUHunj4dttjhgTDjHVSQHUFjzuEcmTa03IZshucz+ursosmbcSTRl1NLmjdI7uRDTOSpoGPGz3u18PXbGjdbZHp2Wce8ZWVSOxacyfIMo3S1Isa57mGvdPIz5b34Vtp4A0AQxEf8gwCDB+7bYW2TkGi2cjfVmgMXWs2f/KuN3fXKQbT/UtWtLBxDBjdHNvzPvOmUVbeW2MgBTtsWeJgNPBPwV0ZeVVKhcnmREK63xya60Aydd8C88aQRvXE5W6Pp7c3eHa4wasXV6XWeiil/DiAnyX5NyTtAdS9sf+fAPjh9bO+f/McHx2u8WC3SxPuSV6yNFSO27ZAaa7OYLbZ2ZGuqeYojWCOsnebQTKYYSinjLiTWpie8qTdn7jtEClWNydlIUdgYhr2ohR6kV2yxBQBuymjQ0iQCoaH0wrVmZu0h5nJi4HBNETmIx6/75m87BA4opgxMJRKyWhnK4bTOiaGNZIDpUYIcCy+YqhTHw2bl/lkqrQexiUVYS4+6Eq5CXVIvqUYEiTM5VNiukoK96X/RmkvX5di+ChAODbd8ylcyL5Xa1gjWqTCcC6XED5ipCHC5qq0+46QQilGXSlTJgA5Fl7Mu0WCPqs0JtUqe3FFtQJMgRO9Pzha6WWKegyNTX9vJbt7UoQRg2vYu8dJDKfN+bqjGU6cnESyGqzFCmZDntQ3jMeUyKpOHkzOdtrGH5HUPkhQ/yDXtFjx0LlPUH3epRYUQjhamndaE2D+M0MAFYNHHYYZPi0GO7MjlOMKAlGaSV3TOYGy/YPxGSezgesUgMlnrY95yYJaiF99+QFevXgPpTSyxQ8vZ/1zSaQl//0jAP5vK3Xk73z0LX73+AxX+8tWbXP1V04PpcvOxNGjnAhJM4H4N8Z1qqeVJetZejaySfcQLGcZZs1BfhfblOHn+6GsSe46R4jZDjwfJ+dsb6Zs8XBwmDwOiTnuZj5SzKAO2dXJYrLbczLJl/L1jJ1J7xBHO9bhcQwfN87lmg1wyr0PbGW4ac2MJsLk4cZgaNO6DTsNAwyPzIMwREB5szEb0MRN8A5VlrjY8+QVCaJMDz8W06VwXzs6tspg3QBofaGqADd0e2N7jRXiX3UBRaf0sVIKLlCwB7ErBZfc46LssFvkuzSCpyDUeoLnb1Bx0BGHKhzqEbc64lYVh4XgWVBQyvIaKCiK+Qh+JHbnPfZ8gmztRpO0kZM1adavPlNGCkoKz7iCpHDgT7T9qkNRNOTS11vjjlQOIVwKxlnJ6hsK30fa2vw6J4VhRh35JkOZ3UJtYmpmqGvaHknXobRryuDap1ENpc6od15L2zuoji4N37ObL2VPARmy2Pe2GFc9jBDUDZtg10rWrTduEvJzk6Pluzw9KMyC4kkDaTrEeQeDJA2IgtsnexEke47DjmokUobCn7H8NG4cQyJqb4zWGugWAg63+INPvoDHFw+0hPoQwH+M5P9d0s6zAD6otdZSCp8frvF+fYF92XX5m3WvTDV6I00Qo32qEkfAWbuD00tMnBJTKiAVNamMiXaDwDBe4RBzSWwYFlOT4IrYahATZ0PltrHrt4P23avJFNQykHeiLWAoB3PH5PGVCjwDRovJDSMUNulbcraURlb7+rDRswwShAoNJinDv2c2XLL/Gw5qDpU4gjeD6d8RXSBzmltQpFADp8NHIvPJJ1soUpAT+ePvRViI8mU8xMIjwDQi6HIsZ+prIbwd6+nI33GHByx4UHZ4vHuAq90FLrnDw90FLspu6doZOTLT3iqS3VYS4o2OeHk84MXxBrf1gOfHA54fb3CoRxx1OHkikNgVBrgyz4hJNH26p+o1DMNS6nLnSUesvCWyMULgd3gHNaHSRZVINI6iR8YuunYijpJyoaokq+AgYU18qdDcmE8I3QOAMb44eDPEinkL61JomJK7qB9c8r2UidypwXiGQmh4kB1W22iA046diRsTri0yaqQQgRvcM2301YnBCgS7aIs9QT6pSF9W9iFOn0OR9O0jOGbioWUF5AN/OhYO1yyiOYEAmp7jkDRpE/F92eE5bvD16w/xYxfvnqQ7pVQAH8CMgOoyD/hZFhYA9f3DCx5rxcX+IlSWnAU5KYqjhsPVjR3cnjNRF6Y+StsGWSNePIXJORUIpKh2DONahRTiFDO7NdcQMmAbYdD42ejpbUywpWuLEVGSaFFscHbC6QROLqAnljCEyzDxD4YaKs+5E6xKr9EmYVAB7kwzRsI9zzVyNxJ7uxlHpVEPzuh1Z/dUGtIj7D5OtnCOamTnMXhhW9Mqj5t3X5eeNtjhYTaCF42DclxuyCUKHl9c4vH+Cq/tLnG12+MCO+zWtMBl06k2I66DPTNnwWa2pRA7EI94gUcXF8DFw7Z8rustruupEPjo9iWeHa7xUkccKhZ0oEuW0IxqaAZc1iQYC5pB4schE2OgFWtMdxM8VTBmqGSTy5VLxLy5KK7xZjec/O+zKVdG/jxIB2HkyGkRyOn3woSJODrBzRCCUXkxkt1CITFBGuJIhhHjTimNwzskfkYoOqzYoCNjyOmo2SuEQX2WvUSYpLjZgCd//DxdDvlnmlwumUmX3MAse/bnDJHUNCorAHKDgMRBmLRuMq8Pj+Ve0I0iYF/2+O7NM3zhcIOr/aWWKd7PSvpbAI6rDPDVCvx8Ab5wW4/13/7oG+UGR1zsSt84NJnh0+fpZSFtrXNKmy1yJoVjsHhZDzBGDCsknSnhY8yORPcKKIqSiYxQhFyBCQzln8mrebmH/gZfwg/pUSfbCZNIUONmdT8vjoOd8hCugYlUaJA1cOhb+sOaDzWErqUzyhloEqEbUUokcvvdWUhMkko2GWpQABlUWvusl3lzc6WBUvCNxmLHu4MeOzzsxUOV7gMQl4JFa+pYKMlm6gRxXGKWBeDBbocnuyu8uX+IV/cP8KDssWtpjJkn0dUyRmE67756Bh8aBFXWvVcJN/WIj44v8b3r5/jw8ALXOixOoWXR3mtYcyXkQeQ3ZBYNjZ9dGNw4wyHg4TCBN7GOusqwb3jIjYLdrmKRJ6T7a8mFzEYxJtz256oioCFrfC2VE0wZAmzGam0kgQ2fYdKYbQY8tRRWW/klsee90g9NSryfTPI+97tQSKDMjrGW8Jn79+SA2YmWSn4xhvhKgb/laJF7MVJZPqQou0Qkj/qe7jyYE9+mjNLzFOzWM3LU7e8HabaX5N33gSlzI4YhmUNoAV7evMRPXL2Nzz96Y5kC4FcA/AzJp+sI4ADUD4HyhQ9un+NFPeJyX0YdpbnrCcxH+FSNH2VsGoQWLYRE4wEcY3w5hT88mnSdnzi8nuU8oVqUM3vd5EEheYurdyeiMxQYIybHuYyClWvrFHygn4l5mQsQNs8NKH9WpQy54kwQnnXGUIyfDDNTn8f5bN9INcRMpzDkxVMTDXJi1AO1zzeVdNxGGIqkPRrSMo5JMEE0ZNd+XT8MzV/nGFAjNSjKpHLATyQIBVhV2hzIrO9TIRzrAYU7vLa/wpsXj/DaxRUe7R6crFoX0tNaHLh8LLCVsSGDOWdOhBwogPD91dCEfs2udntc7Z7g7YsneH68wdPDS3z35jk+vH2BGxyxK8QOZTyQgrWty2QXm2XjB4QxZJK8rRK4ELuMTiQutn/QeGJ++LijWzSRiqO1vtn3tZ+sKIKTPR25U/bMwLzAMNWKj80G3g40ZkAgjk3kGfeJ8EczemLyRPFutMs9Y9R4D3rrQUGRRMuBAc8BGZjYT2cOVYon74VSRFEjohTVR8w+78lFNtjxonNE/FzLKinGxA9rusz/Yva9bMFUj0H2ICWmNeDR8oEoqPZeSkzY9hnLDt++eYbPPnpj0QXhw3JS+jUZ4ENUPEAB3j9cgztgR+IohZE4JyU7MxFDHKChwY0ty7UWopQCnMpgDAN1uQnpB3wUXrZktGlwi7r9qr2Xz/0GDgNnnT+C9KzlGdhhIINAGbJpFNL+2kJpJBAORmxOBgmTpsSY7mSk1EWZF33f1JOT26RK7XnvXoV27xJqZhg0xsDOGMOCjDEvUCUxY6NzoXDKKgh8Z3ZZ6npPtVDVe9PFNMZw9zTF7p4u92T063fpnVmgUn6dnFDFkdhg6IgXk+sPHVFxVMVV2eOdB4/wzuUTPNk/wJ67ZrN9NMOkU+JfJOFxEKIyQpsaTaACCWkLZmpFnFLGvAdJEY93l3i8v8S7D57go8M1vnX9ET68fY6XxyNQiB0LyoJcdEOZiXlVs0JmGMG4VzpMbeHEKSiGqLm1c1+L1dLt2DuwhSXFGhE7T3QLnbwwGFsFmaQdjNHhVKGUPD1iJTluRnnrTErV0FPkJkQL0pJGBczmTDR/j2pFgZY8DCNpFiMbtiJtOditQOoIW/K8t8PQuSJu7d15FjQ/h+gNEIPLLI/F1qESyqhk9exGcBRiQiBM/kyGlsf5PPLvTZcfRnh/JUqqVsskgSX+reEJVng2RZhSyB2DzKBHn5zyCmTP8vorF2WPj443eHr7HK9fPAJqfYBSHgJ4vhYAf76U8qMvDjfHp4fr3a7EwzAHnsxaqm3ryhjS0JnmtZuRWEwlELXf8w43EyIwMdiYj8AikWs0vomRmuN4YZzuJJdncmDFZ0WATDXg0GX0FfCwCmeBKkFhmeUbh2HkCKFbBTCV8znUBYOxaR4KyiYsCcEtjKEimElcvDNtAl9OyDORsZ7nZAEpkbuGxYcRKQjJYQgySh2jPYUmtqDdlazafYve3ylUR4oOb4vP72Fh3j8sl/j81Wt49/IJHu0u2sG9dvrMfnKZWO4DzKAg0ZR0lL01EJjkCt1nDFWZkZhO3/m4fK8C4vWLh3jt4iFeHm/wnZtn+Nb1R3hWb1C4w34hKAabZSuCkSF+Gz8op8hsSG5h2vSJLUYs8KWucQxcF4Z9LkSF14jc+BfiZHYcXteVDm4uktUpxDCenJkpEklJJKVUVffTyEa12gBZFRCF8XlVmOtzZoVt37mHZ2HIX8AE22OcJ0AD3owAyXtaoCNjSuhDI22nxoDJzyEy0ieeCY7+ycXgKyEyygyJ6DMQFdlJFM0opw7pncIEZcyeEf23ColbCN+5fl5ev3h0LKX8KIA/D+Cf258gx/pWQSlPD9eHGxzwgPuWhNaqFHFcwzQy12B72B+6aslSLaihrnKFGkhrAYxdK1uT/REu+xrdn5gSq3rcayRNrNnproX2yrvK58oTBz0yzJh9TiSD/z24o0cCJ0gKHdmAquXII7iy0eZYIVnPyXzs92qV1tCNTxLHyc003AZXwfcg6T5okHwx8p3nF9DztG3W2arz2kOBXB6TDqDasskTnOYbJGPaYYMok/QmQ89r51dbmhxC5Oo6q5YlJoYHzA7Z3gWuGwIbXM5UoKza/aMqDjjgijt84cEbeOfBK3i8uwQAHFVD9gDt/bzLC6hNQgNGExYn3+VEyfmoLrCNc+raZEN0u/bTdxAe7i7wxYdv4N0Hr+C71x/jG9cf4dnxFvuyw44tDzPadNvosObCTBOeTWHrStdrU4es+Q6jNmSIZdDnV4dtfEQl2nXrkl4v7B1RWuV2VTbFNTi7qxs0IIj9uaMdWiY3ZgxKa0TgZR2WUgIM3N4zyZy7ZNU5Bjp1/i7jpqeJnr5/tf2PjIxnra/ho7x2H/o9cOTWIwI6FM+eHsuMnPW12M6rde82eVxQ+8gSY0s34GGxfaUloy7XtfbIZH8/WIKhaKmPtOwUjKOI6miQjYeZlRp27QJHYL0GhUEK61LThtzXUwGwLzt8eHyB2+NBF7v9rgJvAcBqBHQjnIJ/yHJ6KHScy+SEMAPuPtawi88WqqGJIbDaGe1+/aur3UyelfTcjBnNQR9vc3yf1a+z974Aa/C3V5oPjUk0/RtUuHQn6mFE945O1Xdy0cvG31K2CU/yhPXYZPZ5VzLNige9WuQqAjSmiYVmnPNrMCGhsWs5S6dyWZZrVAcpIS2ydp1l0aRYqTBZqpUq1zjnzHIOWejrWlkLOsOeeuHhqWsBLUBi+UYnNNcXyzkSmSxmI5V1rd7WA3YkPn/5Oj5/9Soe7i4AnUYADNPFSW4GRhj1rv8MhlS2YSqyRzd/d0bUnJIHlXIilzX4oOzwuYev450HT/DNlx/j69cf4VqHExqgsmQQJOQCvYiVOVeCcWzRfTDUE4Yt9KkdUMVIbstIATnop7gb47ISCyNhWGNxDUZvD5d1hrNASiQYN3Is/VkIxFdMdOFLs8HEy2E+exSACCLapHZnUC3borc8JRl0KPrwB25Y5OOHfSrsifnwH+XhzA6Z3DbGEU7qE1d0udeBUgHsbqD0RoXZPpkD8uuc1vWfS4lWz7QRoJKyax13KLmchuwMJjdWb26glvArKZmlTTzgluu8Y8HHhxt87/Y5PrN7Faj1RhLLEg8oAnh6eIldYYob3fA7TlKRqV7aMsFHRrE7deX3QZvN59hGBBvEGp+jxvKNfgLkuIEOFv/J0KL9s8Ee7rLn1T6Zyy4mP+txxbZpvT28Lap0kKOOSYSdfKZkvpSSuyyngIFjwJjr7omwyfGqR/UymL0rREEv8/AgTfHQGw0O1u5fH1nTERJ16LvZHzOb8zMGnmyQ22xPX7pMM2taCVEG8w5xC4pBAvR0sFYE18VD3w1GTt9gNdh54+IhfubJZ/Fjj9/CVbnAURXHVbMPT6ZLkbXmXHfO2UHK4C+Hw33qqz6B0lvoEueHffDut2e2eKQ0gKOAg47Yc4cvPHodX37lPbx7+QSsK7dhF9z6gpqXkfFPp1ys10wZHlbysp9njEgxoyED01xUTW2DXmEIRus+KmVkJC6RssbcnzGTGra13qBzhU6Hg/V5uBl9dILoOhqZ7G6J7gc7Y9AWJ3uQIXudS9IJavIUU8b/Mkkte3S8b8SJ89DQPvNQmGUrJA7V4GrIuPPRjI68IGmcIi5IMrOzAiIpDN0YLIaSaGJvqOGhCxwvdhJiG2FYF0ZxtClQItwrflZB2C3f//3rF6catxSRFCX9BwD8r791/dHnvvLsO/Xh5eXJM7DWNM/eCFsJfsZjJri0Lb876y05jUiMJiIyRyRnYufqMiOboVpllNlwFpQz2JbfR1SjYRPLkpv42ZQbginBbiYtZE4gM4ctTUM3LAKzLfZxzMWZZM1YqR1S5HCdmEYkWUefyTMO6yWSa/RhTya/w+x3zJ0aaIgBKksa5IEKl1L8mE1mWqVfm4mHa3t75jZxowMe8gJfunoD7z54gkI2qL9sSLJm0kjFVifnPk5ioGOmhTJxKiEowRlzK4DZOnSOSvFIQORIyK0Adst9fXr7Al978QE+qNfYlR12Ao6Ga43GQSbJnPh6OCSfvZeQ/CldgeAz87Lgk0zu204Db0x4cGqXjhlKQw4TGW7YpWtL15+yCDxjo1HWyCERMqjKI5dsYrgyBtRk5AFh5BtzFriR+FobyMLJsztJvBtXk0H5nZcQig5zGYxZKoYetrVbutGTfPSqkX+FSRLfRJo5WjAo8loGc6YkwVS0F47KLB+lpGyIvGmGZ6PgVkfsD6j/rte/UC7K7tcA/LFyxPGHAHzu29cf13Ki/3UIV7CbSvfvGByMQjAFV2mNol0se/UGKUB8vWr1VGUNY8wWR3lmDtnnoZZ+NmFhWx6yMdwVbD5ln9VRCRKhCIHBPxEuyw52Sd+vSbLZ6GkY33tleTYWc3xI45zWNLJUGBcE0ZJ1FgrXmOHEJnM5wUGN0Of81q27xEiTCM7AR1OcxUtjeFY7kDEEiwxLQhN4uskS2SNvqSHQqUF7iu8bHJ4MLg4WrsvPHFFxXY94Z/8Ev++Vz+K9q1dOowgph8T2JD9fi7beNUthnMlCrRhWtuLmOF5oMi8pvHfcx21TVY5pjU5762Eq9rk8U0R2XS7waxeP8FOvvIcvXb0G1orDahukCCHLZU+CyUrH5M8Gmcqy5gJTHWGzD+x4j88lpq6D4kDLS/uNQhHV1z5inr1d78AhGJzUetKjOx5KY5gNzrjNwceMxquhoWpt6eZrTqaYYt8fPda5PyOS7dkugw3FUYSzA1wnIzhKIzJq54bHOgYis5TSADV4X2oYHrr0eOzYlSU1g3x0MvtB2l8MzRjGq3LOGrIfYDIhS8TiNjGNGbV7FLzQoXz3+lkF8Lnj8fhDZYfd9cvDjT6uNyhl3fvVCHAy0lfowpKu6/Q81G5oAw4JaF4Za4HqGaz41ghS2KGdo0OZ3AlLW0xL4EFg2fuDVJMqS9BC9mDoSKuqzRd9E0YjmMglTG2h1ZM3O/usicX1SMgB96fvuLxoKSV0/qcHqiyFF1HXjYx9Vt42etW2aa2HrlKXaOVyI0iFlDAzS+ne+J2FTWZXRi6yKYa4XPpDwNSnLZVqM3JJVg/IED9pEm0vttbvuMo6O0Q8HordI15B01msYPQBUEFsTE7cAxlKJJslrL/fWCfq0qeDDoCI3/PwLfz0k3fxoOyXrh+TeM+YO5BR1GAokmOtFSnYXngSkyRCM8XpCBNNdqfEQRklWFT2ALXxyiiMn9yV01o4StiR+NLVm/ipx+/iCqdupXnpr3R7O0TivoMhI16qJ8kgIqcDjWdSPUTU5LlaQsFk9/20twnwqgNaiIfVuSSKo6G+h9LOp6528oRJDz2jKyBWqaIRq/szU5oFLz2+OnmStGwCO+S9uJVqaya6z4ERD2nPiSF/qxkbm31yCbHI+ZwMCOh6jasSusUTJkaXcCbZHBIhdd0H1uVaOKwTtmON4TOvnBCZbJNuFhbQfAZDsY7EcGiaxgxNBlvv1dhn3S+7BXrnwbjBkMeL+3iHlmsuRrebMIxY3uj9w/PlV3VdAOyeHq95oyP2BkRS6aCayIPDVNdZkXCxOIOdqTwRBoyxoDkb17yhs+zPLy0nM1ElvoLCGChKKWabo0IHZczxgTSVsuWZGNvButSRAI2O4co2x4is4XH/7hWsH5CWU96QliGL3BMZR2gtaK2RI1Y7jpulPd4Qy967L8CY5SDbYGYaZx9raECFlgPMsFRlY0NGC+DI7XHo21CcdPivBMRmOBSQpuhX4JGhNzri4e4SX37yHr748LWBVTMZkTalwVaq5tDVqcsLe/gMwzVr92+W6546Jhjhzw+QAX6XguzJB/czD44tUJc2Gq0SXr94hJ9+8lm8WR7iph4bu7oVJEquaa07TiWUpYwOKYGpM1rXCNdxgMfYKqJRGTHJnvE9PpobOSeKxdHQqTgTnOHzR67U6E453lulP/ZnR+v35Khbx6YnfkIYc7Y3XWrMQBB2LkyUS85Hrko2m2sD1g5AbnxPYBh9cDYLNqQ3SCOlwE1Syz1JUaIhlZYx4tqllWm80Pgsa3yxOEhyaQQr34PDuI1xz+sFDoeQNtpn3bHg6fEaR1Xu9/tdAfDs6eG60Y/ajbQEusHDOMc0qxvsBI5DM+yJH3/1OVeg3PSkqtbhGpN2lW6MUZsJKnVnOKhL2pAZlxjdl9ClQSEwhGkOSWeg0+xDEwGvn4TRdtbCN0KV6HniRgoK/Aa3OgWj85P916Vzjqb0Qk3RkplO/OGgXMjMeK6w+fLdaAJOTOBq74y5BgkZ/OhKjOb5naxc0SxfYwC9gu1xdI7raoaIjKwPfvTcz+EtXXPWNyCT97HDjB3NOH2n23rE2xev4Pe/8lm8efGwSw2XJy2qCGLSH5LeX75B5Bn+JK8dSRoZokwVu3QFT3VaEWKwfYax1wM5hHdZh8L4LWSbbi8sOuRebK0fVXG12+GnXvkMvnD5GlSPnflMJtOg9XqX9pzLC0Hawb2MeNaxRA0IqzrqKcY0Nvq9YTq0GRIuW/2UDJLIUa8jmwN7Cp3zX+FZJTRynZGOXRa7rr9iUbdtD61mn73ea9EirJk4Hv2ZaXLd9Tl1l1C5b78Cs5q0AjnsBavLI4cCPDr4da+N9d4auNbl0I5+5J7bz5CAeOZmZ9LgKX9+fy59/KhAMJZd++5D0fchNrTQLfHYw66oIF1VyqmQmY+txFOXC7b6Zt1f1HkR+7LDi+MBH9w8B4Bn5aPrF7/vo+NL7HYlXZyY7b1WOk52JBVm+9Xiq7RI2t2ABcFW0Zjw5h4VILlA+GPaWMY5KYZkquztb5sXc25ziuadzOZcupHpdPDDOo01fCbrs0FNZ5YmKdNo0y9kuYnCw9AXOTvIkosfM9HhEOGhaHtMJBiZbWFHNjUnqAgnVAcNSeih3ldHL+jwNlwqqdHnOZDnOrwa0gWdeMXIaFZGYjQzwrYsc5zS7arBptTp/h3qEZ9/8Bq+/ORdPCg7VNVo1evrDZGgNyhuzkj6OHVh0l2G7xMy0/mQgC1OQKyVmBjXVhhNQwgm4ChPxdEqJf7Rx2/iR6/eWvaRI4oZ5PSnr1oyo2e8R4QvdNkyNG7wZVZML02SHD+4OQk+E/IJ3jdj59PQ9jxPM5QYRzrspGZi0Pdtazo4Fu4DcjH+eCT+pb3CR3ZM+6obIjFJ4bLrZFNSKOcWMMUmp1TPfDak0ZMsprvtemksGICAmYFOQF4TBwRJjZZ8KyiFOHhlH6Emcdb0PkiuMhuDojLnjmMu+xBsweGMAY6o+Ph4DQC/r6DwL7yoB+zLrvQsBnP6T9afstPOyT7TRBpoIrOxhaw66i77E2PEE4ZsbKTPoxVNECYyhdiVel57kNEwSnOVIKIA2rM7YXlnhuCXPcqomKFph1PASYyigjNWgIms4qSbzPjLkIOPQEubS8F0SmFNAWkJoxr1lDCl7Ax2syYyJ0CNe1bg0jGvZfv+BsEFwg4RgnB6vrffE0039x7VG8moCLAxu6yRXixw8YNQQFdA4YgjvnT1Jn7s0VuB6DdyqiN5JxL+CM2c/mxMgHPJlDPVQGJlS0pXc7zumsC0AOdSS/axAROhMecJ+O/UPBLgyss+8XM+9/A1/NSjt3EhLlaqpc9qaZ/UNmjmjHr0TjZmg3QfdZqMrY+VOqqQs5saqdaL7jDwU5/JOpfKEUD1xqqBha0CVrBF8+vOtPY9TyWgP4z6dMQ6pyOoHOXbgnNEkiLIpJhgzwsIz/nSxXrR5WMc34sdXemfNyF55IbER879GwOlLCjKEQPYfcMQppTSFhVt0juB0XgzllOArERjHL30WOG+sZB+6+JMnGCih3PYSKOxV7KtDpYzJHelvH94gUM9/oX9926fs+ZJVXB98oXvsBJCGpGrgAnixMdLMkIwRKCui7aETcpJH4y56+iLrtYe2ABL0FpvnTtD9fCi02sXMsktaA/e6vxU2mcqdrM9NId0GZiiz7+iVj6H7Qxe7H4NklWtR+e6AQ+ta2hMdq36cSdRKhBy1P1Glo1gcI+IY56Q5ufuY+vnKMEPvumLG1Te144b5bh9Lm2jbKZQE4/64TANmc7cGA/1h83TCJllDbBiZPn31T5UXSFNaYhiPS7eGT989Ra+ePU6qk6q/u57j1AoYGrC5FJIdkIPOVAkyBi1LJ9DC4MpiCaJfGEstIECzCSXo+rCJF2hq87yt0jgHYhcdhXW7eOoircfPMGeO3zl2TdwWw/Yo5zuRdtUC4qiWcooYV1MpEAvp5Oii6NcLxuCMdkX59GIr1diGnMeJNNKTqphf+gFZ8GJqOedaBwZKXXxGlUfbazrMcWGvLkkdyv0jZGbtZXVnonbyZ3Z/AaMXbAWReaEuuL9xQolH/GqzaVLjBpO83MGL//oytrNm1wayrCnCNn8TBb4xp7/4k6RZtHcnxuD+pUk9s7HAIM9MVPX4xkPSAoWT58eHHYk7EE8O9zgVkeWDw/XLIxyBFlwjRQDJTloS7NJEAcJn280C1n9BJfQ4IwU1tBkgdbRhfGDO1ghV5p24Qctucn6hkCTSLrLc9oGazrb04k1DSJkSggbIXuPmOhkpE5IamOCZNAdxEcOIyYnOyYDkDbDzq+BUWJGaw0aZEUEy95B1EKfpfoMchxnZEJnh99SR61+hVwuKkcEFLutjNi07y3vz7oTV3aFWjdcN/GBJQRy8h5HVBxU8UMP3lwO/xqQJ05kagikv6FBH6KbM+QfZGXacPGz+XUYbRmyluV5YHpGhtGDktTPO5wE+TNlNSBPxRj5CIqmPetzUlXx+uVD/OTjz2Av4hbHZdyC4PDJRB5THJ12BCinbTbVwMil+aT/xUwv7mBWDhpzgpeR3RwBiJbNqZEgQ2SsP89kzmftc/tmIjZkuMS0OUqRSJmJjBx5Id0fg4HnRCTyb/BkyJbGMPMiX+JKChlGlUtQC6XRaowfNRdPmaSbcSxtVu9SnsV7+Fe0Vgajta8Cl0ABUO15HZz4RsSF5EmTXV6dSH9CyNKQI6kAdtzhWhUf396wXNfDkitui6/RYs0ABZa2FNGV9uHXw1/iaW5XUzgNESxo20yd0ZCGad4ixIsXIF1VOwRrvGCrY2Aj0PSUpSD9WZPB0qhBpkGP9qmL/GcxS/IksFPXW7uFieJh4UQraIGR0RO1hs03xRT7Ta2rPEm2iCvMP31FBWorKhqIVKvJTXp355GqQo0SvPV7h80uFQyGWrjLHwf2dLR3jtYIJzll5fo9a2A7a5kTV4Pu65oWWDv0WU2J0TeE1YbYk95sXGVrSq3rspwyh4+X73hQxZcevokvPnwdBx1DUKgfMh1OjfCja6Xj1Ca6smUDLC9uOovfqwKa5GlD/8/oHZDv1RADJg0ITHhvucyJlglhPBV71prE1BRIkkPzp3c7Snj98uQXsFPBYR0ftjVQLVOgNsmvArnEYpTNl6MrmSoGNXpkaZo0dc0T6c4lTthaJcY1FwnVXPzSyMHhb2foJK5v9KKoNYxRItk3IrOnfaXGyJpgqVxAnWzc6bbLrjSREhzO4KFAs4Y/ySgVk5OEsD9MfUDsuZRqG7X1NFiG7r+TibusuymylrOtk/1qRH2ksA825BkxCdQbDXrh1VC46A/TPCjUCabVkmLhPDXVQO4mObVZlqEICpG/3gOvjc1yHpToAMoF0QaF92+eodwyxmtySuRi6JLcvjfKNXpgClIsaXbtyiuWySaRU1tyhljHAEkZfO4Mfpk21/9SU88yNNMS75I0leExGFlkF4Y+K8sWpAqmQFB3MYxkKzsmZMWXxnmNz5vyQRvmzSGFMFOwbCNPBiucWBrTbHM18+sOFqOm20+dZFAwhK5bCUFmtHfGxPuaMYK3h08x2ovOrGOSymJm2dld/frP39aKz16+jh+5egOqFUWMt3zqxaKks9/24cemKc9gN9aJbb4ZYE5IHZM6Fc1WkvIA0mjHPXuCmCyBw1umbtkOwBa8lWbOfq+qKl6/eIiffPweKJziyoN1tgbfdnL0tGtBSsNcncPYksOIyJjVS1fFPswfIBvmv2L0EYlWtknSnLPfJ+OEaP2qdLgZgqkkrzVCa3D1s/Gby3DHQDROJXc9yCT6DzqxThOuGAb+AZPNupnfKHv7K6St0hDgIXlxcGPm6PKqyecOB2BS34ij/FW2LsigJmicDedOpXh2V3uEYoJw67yQ7BbcBJ3rkeLZCYK7go/rNfYehjLkDTNVic5094T6IIMWaiYrSea455KXZGbAtEiyU1+KQlwDPTgL1WmHSLFYRte7s5lFaGJxGg422eElxJjHNTtsMewRFGJIe5AnjV+AVDr5DLX2xHJFFYQjLnQmjyWkeQSuz52aCqJNLqI5EPPYAykkR3l/G0cIaxjLKhEcM+czYUumMkiQ1pDwhzENkDFOudtSO0yqnJK6zJdNVStPNGSDGqtJvoQ4m6SE63qLNy+f4Mcev9lQluJFG/IIiOHgDz7fMz30hMGLIdPddNdbv8fk+yilQnpSlA+GShhT2FYOjku4NuyLkQJL4N1KtvRFROJoTPmjKt568BA/prfxlY+/Ae73QGNrlOinrpOlbz4Uo1+JcwKS5a3vQ3Sr8LT5qsubfTLYMjVsrwvn+RCtYo2HoiOdZhbhbc7c9zRngffnIEmWGdU3UE4DNUQQHua13v0alUZiGr/Id71JaI2NSBmlpI0XVgw1gs3UZcmAVLBw5rCE04jDigU16bFaSl9vUHzvWnlVpaNIyWonXrdlHZeu12+KD6WYZedVeeFBBg6Ik76DmkH9GWKMUrC9bFThEMKeBS+Oh0Uymrcdh+wsuQhCyJ53iMKd5glO/dhp2vn4MCLKzlyVKg2OdVsJZ5EwxtavZWvVsGAXKIeBpMRE2tpWWnl+QBDMKHW/5hYWuBWKleYKWQXToiRjg6Uc+qLhxNQiD0M1mzOblXMMEtK0Rp8dVQyOwRrY4qc1UifG6jl0JDHGA3yl8eKnuW0g/1iXGf69PRwuvZO6M4VHIK+lcV0d/LTq1S/xk4/exm7R9RZwYlR15pyd/IwmMb4xbAdD8uF90ynuFhieRyKmLza4U43IhbLBUiCMC2e8jae8iaOOeO/qFfzwo7dwrMeIpC2NAQYDlfxsxECaqAyx+7OsoaqoGoH6QZh/b2K5mNIpFf0etRXkpFE1iV74js+Sop1vKuyzJ3ZM9cvhYQgkYhk3y197MChK3h+ap6MYnywT39AktqFQQ09f7cZQscmJ+5GG9NEgWZVy+LyBuKPqJbZrCdembLQdNMMhbn12GAckJyFWXvTH9cBgRTToIzQxLXJp5OJFchSw9wvQIIpwyHjFslRDQbOfdb9MGQBRZ0JzDqSZDQUEwvyuG/xROr2YbukG12/K0sHs5RS7CzlkuowtmrFLpRFbEC5zpp8E9rRMEdC6Vq/QGUg5zDJJ0nqVZA8axuapeyRCBdvRkpPFsBFpo9UmRxJfTPLL8aXx+G8sYTFp7KPGPxNnSA6Sv9YhVru3fmhYad0P7vWamaqAKU1MGoJ8aKS19YEsq520FOz9Bx21raeCgp989C4e7S5xrDWY+zi8mp0wPaIYppMnxsAUzjp5cpT4WfVFcMMbIxszzX0ENEkDBMYR2FB0TwJ/Mprmox+lzwrn/qQcQ+SI6wUJ+NKjN/HieIOv336ES170mfLybIfo3GLqCGeDmxFUrXms6GlnLhn29aBR892QGTd4EdxLyPPhTwYIbDPinOQmSyleo2BDB2nBBv1ZRk+Jsb0iStgwmHvRYnIjkXfijcGI7HmrKrqCjON6VErgAyYx55FbheYaOsm2MIVRPx44eV0mhUbf23q2CAcFh6cnanYNmtQ0nmUNQ1J2GMXEB8MD1HKqXx4NcQzZstyL9d6HtWZ1UFHBkUeUE7SxaKibP7W7ES1foNbI0F+lZNQQ6drn1p0gQ0uLYvCZV3OqgpaHAPHhWeV2bA6CCg8ymedUfaZcQ0hDQWycBVTixOUzRrPPaAYr0riAT7DjOtOrTWa42OSfIlGJ1JEkPbv3EcrztS4H4biGU4Smos1mgUHnCjCZPLTJisUqjf79Do6GAKf1IS/9PVq3lDoPr9aV8AgpmhQNrlbR/neVZgbcZSUtLgRILUTM6HEQffNZT4dEXdY22MmFER2orfuXhNt6xOcfvI63Lh6d5tDB8jmy5NPEbtoFzZpql245U5+JKJdlV6p1jPHF3JPivoFDW3/vG5ImfA1gYgDTIGfG3PZpYIAGsgYD0lLxI4/fwpNyiQNO5MtqzUtNHXEnACbHucW0bFV5+AxZAFROzb7a/Gjdg0t3UF0PUvohqOaWWYxQ3UYGcFe7JOMzd74Sus46IA2CB1l5e1E7zN7GfgzPGhOpM4D4pmaijYCjY54SqsTgrhdGABwNmuiud6keZehk/dm1EaiRCgGdxrp2zoSie/m+pCYeEau514LsDF5ZPtZg8k7rTeta2Fo0m/1fGr+ehnZrjgq3qUFpXjd59wg8J8Tv6q6yAQTRunSJfQyXYDCRGPWSGmZsY2iVhraVlDm85RnvqK9321IJgW8wTR9EQUyJyFVpjiW1So5JvsiJeQkjzKaQeKfRdVn51Ock0pMBHOmdFFt3TUTv/BBe4UMXbURPksY2TlG6SVqYO69BFpgkOavzVdB8271bMwI0wYpbkJLi5JqDIVH81C7TdEe+9f3rFJ1mIPA1z+wmN+oz18plihyC/qIE6rYe8cb+Mb74sMv9Yuffo0iHIB6HY4JHOs+M47XdoduzpvTnOdGWY6Rw6tLnWv9thCDOipXCuoxI6+M3P+TUD8sQfYqe5uesSno4mYAH5QI/+ugd/Pyzb6CiBg4M6E5wauMltzSXhYTV5ZoUcvEZSYQ29Xl5k3blYc6ampr5JUZIK0CK41UG/oyfgnAQC9FTRAnl6lI5DAEbbaRaulMfDaHs+gXjBBiXANlBVTPeSPRUCUl3YSQRsuRjlK4NtNv35MY+h9jxx7U8vl+fu8dmS+KcjCgNxMQVYWqOsuQwpxHdcaIjK0hnQ3zWTN6nZI08EPPt/iS7+OBpAGu4fT0t13V/uq41mBZodXlC16EH0xylhMCWxpZM9t3ohEwkwETSKv5gMnyh+JkQ9KXBBCFEHylYvQYSZ3WiRRRw0lhosqpvNvZUS6dKG7HfoMybU560WYWYCqhuaTyZL7L7dfsB3GFhdL/+lHAV3X1c8+uKBw4GKUwGPtHzmiGfPMKZuWA06DNJzwq6vO9YT+KuYp9pjx0uscO+EIWnXnBfCnalGMHyFLC4mvOsUr1DPXXyRwlHVRxVmyyvlGyzavdl+dxHVOy5w488fhN7AgdhwX9oEbcR2lTyqiARyIf5UM6OYzOui8ydU+kQxxmnwMHhbJJZTztBNSkcAvt68O+YQf6ZvKQE7SPkEUSC5Mji959dU+zeunyEz9++hl++/gAXZddknGswCtWh8grhiArpZOy0E7DDDhckLnYFF9xjVwoKiD0LLvf7ZIh2Kg6kiltVHGvFrY441iNuVHGtA25rXdb/CvvvsCMtbGhGADQE0EiAQRy1uHete2QN0bAceEm5QBaW9E4Zc169EAbj+qczizkxgrLRXCll3GsH0ivieZHGc2vMc0DrmNIfnWNkZFY6D82voV9EeePiEkiGUd+KOE/HgMGNJdoGM+xvIbgl2s0HzlY3ndM64DFzoYGZYeeoQmQxLa8gq+TYR5wo7ToUFuwH849EppuMGQJZgsk9cDOj3GVbjBaLZKygoTF5jbP81EyzUSJEaIu4RIwvypB2dd5afTmaNTKXOCM9eSFC5iyp5HTJJF2J3uebhC9nbTOTQhS6rThDiLa6NEvSnHegIGGywyFfT2ew5vcwF61i0dJ10fAeeQQF7Eg83F3gouxwVXa4Khe4LBd4wB2udhe4LDuDgq1gsatUk9HfrQ64rUccVHF9POJlvcWz4y1eHK9xfTzgVsfTQ1iIgt0g2zroiC8+fB2v7R/gqNoZ/xvs/WxYojxYmcjxZgf5OQ4e0s/Ovd41GAhtEmkz8fLMv5+RcDnJgQj7CTlNBZwTCDkkd2aYb32GvvjwNXzv8AzP6gF7FkPpTjr5NeK7lB0elQs83F3i4e4CV+UCD3mBq90eF6Vgx92wknAvOqdwUyuu6wHX9RYv1vV1eImXx1vc1iPqggztWthYQuXS1xzSKLa02hA0zIqza6HvOLG5yumIoeNNc+TwUZQzB7b36BGRIjQbM01iDRTk28nnJa2vUGBGuDJijYpkzLgsGRrcnFgYHEzcu4WM56XzPmz/H89VGT9OwZ5eKSsjjP04rpOhaR0cXhWaLv71D7+WPNo47zxyzCxynnyfJw/nrWKIxkjaZOtmmUIgBtcrYZjrRHkSJ5adwS04bcYxsFrByzwuysycP/2fAovISmmB8VhqQwxmH81BJzFSTQO2mQcS3S4yPlolICEOIxaOD1/QVMPIQoNMJRKKo840xYeGr+KWpdbBSLgoOzwql3i03+Ph7gIPyyUuywUuWE7dU5pSyg1Dsh/FCrwt1XWs9eLGXnGa6d8cb/FRvcFHty/x/HCNF/UWt6sNK4mDDnjCB/gDr38OF9wnm22G/AQmNUBJKZkzRz9twfQ44++vkVlEjhtrfs2QLklO3Rm3ioRse+t/V5I+elbUjJklnEZ853ALKkZ3B5IqhMKCb918jK98/O2VtYEjgD2Iq90er+4f4pX96dB/VC5TAYnhQKi4w8wB7g3Rn+9inZsAHHTE7fGIl8dbPD28wNPbl3h+vMFLHSEKhTsUloXaF5vwYPXLJKGbDbqa9HjMjO/rkiEYDWbhTSdpo5PBu+X3+uwzIpjEktPAYRTmbqAQo3Er581ZSD2ksfaJkbVvxPNsTd9GqIioGxbEeXaYxseA5ma5SgeXI7rY+bTuxORMVDFn/6fEaFaOZxk6IqLJmIFMzA31HIaZpCZ/PJHYcxGzMGFS9ICDYT47q+I1HUFSmGqKxyQri/oMnswz/d0oSgusSkZfgDwNS5rE85ojbf21GU0EkTGHHpBDZHWW5CnTg7N/0vDanjMNZElftAjNjjncSNPT8EqYVJ0M7GSf+eXKWGMMHY4L5Lcn8Wh3gSflCq9cXOGV/RWu1k2Z/XBeK+eYCKHg5pc7azkEF1i8MUVpLUUuWPDg4iFewUPowas4SHh2vMbTmxf46PASHx5vcAviS4/exINycRodgFPi0ogAMM1rI/R+39n/bAQg8twyPfsa3FjqeQxx7jNmyH+rb+Z9ummOoSzTV8s/t/hOVAlvXz7Cty6v8L3b53i8u8Sruyu8efEIr+wf4LLsbX2cyHHHZEbrMCs1BuSc6/9X4ldd3SOX771DwX5f8Gh/iTcvH6NCuNYB718/x4c3z/HR8RrPj7c4LshAiFF2N8QBGVidDV3txQT42EzZu8yk82PajzzYJkD1mS1EDKMspA49DIGISYZAPqGs6It2VpNRqqc+5Dw1jiqCAYRIfvwbD4mcR9KKilHNxQm7fw0U20rgbPtnVmVZakVsUlODmz6LuFVpJBvjldj41z/8ZQX3udzlDr7ethB6KF5IIwpWzm52k/WmikajHjSjRPqpihBjP+SsojULyugTnQM/NMwUS0GKe6TJqqrNymZ8O8WwhkyQMimiyPQ4MRi0bMutGfIQZtldHXGJLFXKk/rmnZy8diqeeY8UWLJKHJclVGuIiw4B0ksXUCEcJexEPCoXeOPyEV7fX+HJ/hIXZT/RP58/J6BzUOlYsMzGJhOj1PaZyyIbW4uQZ8dbvKi3eOviIYq4fYhPAjhmHX0+ZLeg8dm/Cx39HWircwU4GQHMUAal67iFSOTXkyEASgcLskd7GFkw2rKGkRQHAuOIpHTOSEHB83qLl7rFq7sHuODOUKh6CnZKR1nQs2vj2nMj2OYMV0OTQrA5k9gG+fJ4iw8OL/Ddm+d4evMcNzgCpWDH0orhhuwVK7SaBbnS2DDS6J0XE7LiVxFD8H/zw8XURf4+5ia2FtRUXg/RTOhsMRpd5AI0wGR/zMRkD+x3RcMmc+yaAKqJIa+oJquOVljYFmOsXkREnTDYws1iMmaqEMLJiC3EL5Ovw54Ti4L4jES0iIouj1pUaqEACBa6zchAwdzHu6veiZi2PBBElkO45DkNg+tT6CfZSS3diM2CFYoRZGy2w6Q8yIfv6FGV3c4ZQmmcydnkbz7jXhdbI5vE5MEx/lUTgxyziDB3u+Y411j2Pj6J7NhOZDSTpSkPYB1/aOLZmzS6nKWJRZWGl/E+r10LlbqQ5iThqlzgjYuHePvBY7xSHuCi7NrvVcRiLVffTL7X48yZ97PNnTnSIevCR+sKAK0zczMnl+p4Ap/7k7svBSaQOSdEuruKg01i3my+H2Dl7ffYIvOd+zzcgPm33nPrsCTmjonzQkrRyU9mq00Ea9/T2qoNoM+jt0AmnBQ4cgVTck8gz0gkbR9yiePgydDd99tu+Px4g+/dPMf3FmTgCGFXTj9RmLMNknSPHHT0qwe/J9N5UmfIMbF84Nh5IujJaWfAwMz34J7kXDmuT26OVoIp0Hq2QAEGz00aJus0Eu88x8ECc2jpoPQ0V1+jio6Q1mTlEQfyPUheCZTJQKoCqT1yIxS9EgLXophJHNNhr+j/EEiieYRM8K8//WVJSb6HsVqRyQcQOnXEKpUKKW40y1Wf3WcVgBNXCpg25Dzx4TxG1IIrGucgLJp48GYJxrSTcsJLWrjuENXlXl124aYdmbjFACFE6ka0tmSA+wbNtXMrGOWLgtJMLiyJnPw9TmHJFKXYF1q1MlzwAIyKIyoo4tX9A7x1+RhvXjzCw91FW0g1hXRyg9gYvK01OIYMB9LUaOQshpxJRNpwIJxD2q7LXkNxqmqs0BWJkpvJi2c6//sUNRlF4Z3b7GS0Rk4Lihlx8CxHYaZAOPM5MoQ9K0qZvebv6L45MxSaHMZbBcev6z93zIYGCtQK9S915lHA09sX+M7Nx/jO9TPcooKL6mVqwEjrxjFGP2hi0JR2rnBgUQMBafzM2VaNkU+1YaI65cnkUQombphIMeGDsG8gnWocbWzYFA+z9Gku9nLNSlQdjPuV5kCuczMKUh5CGicMHyPmUzTp8sAtikh44PM5l8PzL/76h7+sSDxjNDNpZI7RszirAGgfnkJy12YKzUnz+SFDPOY3T6TPrQqqwsjHdnlLhr+Y50mKIwqOC9k1mcpzjuA3MM7VmIPY0zWQubhBWSKI7q/vV1L9pgZKTi7OkOVViHCToh59eJCccJbY5kpM1kOt2JWC1/ZXeO/Bq3h9/wB77gBpmbdOOv2NLnxr9jx8/o0dVsExMu4npXCyv2jqIKDNuoHTkc195+bnYPj7dOKDfDDQRZJC446i464i4a7vtDlOaPKobOsamwFOlDjxmTWkhdEQ6s7raM6Ym5Q+ZdQpKloGw+D0LDEdWANilThQJIfvIOMnEKWNUz4+XOMbLz/Ed26e4VrHxbylYByKjzwegptkbh9HBp1++g4Iz7vGBEnkpFRtmAtzgq6kObtSgpMiaZyY+MckpREyOdDuJYdx14gG+1qRo8khgEvRSpzpCDf0B83SuEQrmFVqaOo1m6dnlWWyWmbyBHBDrtExdHCOsfu4JzO3TiEJaprhN2OBOx8tGRQwV6KzGa4SEURZOB81qcTWYe7Q0EDdT9AJ0rjiPBs6kiRnfu6aygLBSd2vMS9hhnfkzmjWjQYvc3GyoY8STHD8SNM6WNse8eutOuiUz/7WxRO8d/Uq3ry4apr41Ymx85zvuK4bUPRZCeSG/E7BNXvkptxlbj+tD7B9+I/dyvZhel+Dn/u46w0ErjMIwBRxuIt3wU8iiduIGg6zawUI//6Ku08oz1Nkyytbtd+psdyaVfMsX+cuwmV2MUVQFJTFx+JEe32yu8SPPXkXnz/e4psvnuIb10/xQrfYNxUDQ85ALqYCitdmjAozQmav/CHgg9Oi6z7fnlM2Oqdhm5pEUXvh6BhujHOf7F1h65/BIOMDPq6PWSbJTEZ7huDn5xy1cT11Fki6qzjHhu/H9mFrn//fWkYAsyynaJTHQdrVJiQco3iDx7dme6bNUgb9PScZag7lpUPUwopCkpOSwmHtIOrqODUJxEjaT6nP+ZHtWM0xa0wR2zi2mfXNSYQf4KI8d4oa/cn2Hti39eRxbDWVpRImKq5Hb8qrX4O4kTSqx0Vb/eruET7/8FW8uX/URjPVKuucYjd0lG681MI+xkCcqQPd1msmIhxLGQhA3TApcKE2CXfakmPfiQjrXnwElzbOxgafFHZmiIw97+w3cwe8b/GBu+7vlivgmdnBedQh3gRHhc7yJvwwmd2TofO19ykTKBdb/g/3XRsKBN+BM9HW72IlzILnhxt848VTfOPmKW5RT54Czbo3w/yWXjlkZLiDnXOM3KBLUy+YoaM3UxtMDKAi0yqnqCKNKDlpcDR6IqSdUNmHxQl4nnGzcKwqQujt2Hg5QiACZTRuXwuN6p4A5KRezKNmRtSTAYMxQvbc2ZM5h2aQd6S/R+TF+dm6D1nRprn0w0qbag3XHiIyP/PZlJKGk+EayETa4BhjORh0MFXknMR+poaqLw5taDIN0qsJwhyqTE3bvoEQlWCrfKBme0/6E0d3qjKJHcc8++w4NbS8w+gmxskGcp25/TVewUIbFiqOAh6VS3z+wat49/IJCrkUBB6Jm1K87jWjx8b8j59I3qZsEqKYFDY1lJJFa84MeaQBLfkk3T/vIivecXhoC6XZ6GqFe0hd8wF+poCZkRbvUi3kICHdA1076x+wloppU7/nF9x0RxzSFicJqZjwRLZyEwYYm9NeOOylszXXDpnFsfXR/hI/+srb+MzhVXzt2ffw7cMzHKBOrA3ZGoxdqDTsoppUv5ErdF7SqfQ3w96zuTInPijqIVGDm1sgZmcfA8bigOM+zWRuxpC7YqRC5bxmJ/ulaHNGDb7Iselr90J23vX0WUauo51lnTA+WGwzohSR0KqAfDHY048WNPxrH/6yGqu+WA4CkwhNyQCGMclrSGYyVCBY+qZNsisJ4mHd0YXRZUzqN7EtgmRA4VpeIZZ6pdnV9oVefT7s87vmz4j4UC1krxjHqHlyWy4zfXSVCHYrkSemU9n1HjVvzYRFzLGXtcVn5qjk4D1g0hmWlcWvGCO5LK5DPeICO3z24Wt47/IJHpT9RL6nM/rpqB7IpjjjvJJ3S4nOFQJDQESEzDjpnGds98CYv0dkLs8cDjPm+cDT8BntxKFzxotgtgrVtvPgnZ971pF+QtXFXYXB9kx+dGAbXl/YiNT6JFy9kWyZmetNpUILqC9lGsrECXFUG7Ut6Sl281EIg2FVGhUsxcz3bp7ha88/wNPDC5TdaSxQLcyGpQwGozSdvdx5lS6NNjXRcnqUoACqKbsBcR8UoZKzSuK+Go1Ykyafyc0vGKr14LG+/stYXkiuZ0jeKy6r6H5uk+ohEtYnRf6sqAsZFy53tbXdDueQbcL7reR0bsgCjkIjGB790aNmvwpFqTWONesOu5/wKv2o6NpPuYZSHcadsXw12HwiZS0rEN+6p8/M6iUekt0xaWFstovPIbq2xT1aIETM6bbPXiKjXhb2osGgj81TQEaMmZPJnKSyxpeagqKBEGNsqlssrodEdRJO7tSkYIQTXBetGKlcstQtjGk1sjjogIqKt/ZP8ENXb+LJxeXJTGW1xE0BHj3JMemDU/GoPLf2kUuG9JIbYt54q1LiFFMalnLXxoaCcDhgtAGeMCahnBtD2OhId7jsaWrINMKoebwUWP/k+eMwEIzmiEruYDeLlI1RxjnJYk4vVCYqbowdMLs3bY7a/UQGeaLfo9n3I6fkNs7yGlP+QuguZ929NLVqzmgkkSNxXd7Y98fiRfxCqiWAty4f4/WLh/i1Zx/gV67fxy0qyuJ/AIs5j9vHeuCXJmH23LNsmhY6cvW0PHogWkBSYoMx2rnbPux5eU3yjJjDwUTETqTS9aAPA3e4/5G1Z0xseRuZKhcbzl9LiTAhMI4cEOzo5MdEdmdzq+SawYKJ5exkTBnHaAyOpPLG2zxvoq9/bDT2sWvukjclCEoMg5qUgFd7FZIVVjPoPpN0yvoFTGkQFok1uzYzaUYgCS0irWSmfwI7+KTRB6BZOm7PIpsURdmAdpYvUMeRvjBJ4WMwaUBghm7wV5jgN46e7ELv5pXejyHpTilX3rKlKdyo4rLs8cWr1/G5B6+CAI4S1jDUTl8YDWDOwvUT3e7UWhhjoMZ0tp7Y2ecoSmPG14bfvTQ6e96DLFdrnXIZtjT/58YgwjmTqcTyN/dOJE26vg/M/k9DAoxRt9vFzZ0IxUTRMBzAGeGZsdk/wZxeNh7Kn69Kc/JuSmabBSuFQ4K8W4Kowfx7GQ0cQRBffPImXr96iK9+/F18+/Y5drsdSoCcSyKhds5RP/fs9SeprtIkT8Wg85og8GGGHWLAHXHoTdqMWh1DukakuBUK6TUw7KtpFO3j85ptezcIhm6Jn6MFsp+Ip39yMpcf3X23n6FBMWK5jeFZiFgJrBHGkOtD8K998FW1ApxqG3qG4Xr8YSTZhW49GOd4NROTZkZKxzCdASfEtuDwN40V1mAsEoUeGgBqBc8ADNBXJC/5RU2cvglLWKNYcrSsnPjr6xyAODGB8mmAbFSyroYWW8vprxt/hKmsqzhIeHv/Cn740Rt4vLtYWP0RqtrSVUdy54b0bCvC9syhqyz/IEYb602D4+2hRDhU/RVqnULSPDMLvg8EfufPemdMTiWQ98le8d8/+z09kDxJCLcQgBl6cBdH4JzaQ07Wm8maJuMJTmxstzMItjX6m6Mmv35nCJVT9UZylvNfn32+swoFJcMkRmOhHXeoEn71xfv46vP3cQthvysDEbd7U0wyJJjtxyMcT41QenR0zRA10u43hsMNLHuZ/BnObWLo9NzMyFMts8Sx+eIgdcfqyX/Bji64DKbGqhniTch2qvcYAKUGVikmeJCVI/noml/DzNOCHEbOcjSX8fwtG4Kxc6svOAZ6UEcm0+jsht5jJxAy3zV46A1z9Mnmx42Nv3cZPUKx2UANNpr98ZrNd8hzwhcNhhr3F1pNlInY0qin76dEXspEldUlLeF602htdvvMWx1BFPz4w3fw5Sfv4lHZ46iY4ncfjjNd7PtJ5XzSXIY1ZYVz2trpflf/7s7z0/y7DeMenjl8OMvN+DQyvE/Bm8CQyIlPnFdw1/e8E2XY8FbAJzAd+vXcz3OHP+4px5qxtvPwcv4dP2mOgqW6gUtGBfDFR2/i97/2ebxx+RC39dgy6aN+O45I+iEupCCEu4toTpr1s7+jjWdTmCamcOSkBcQ8w/RM+Qma7AfzSNVNVce2JE/xWm4uEFqcaoxdY07OA6eyzJGYqk2gSJgFv44SYf61D74q/4xM8DynlQRCNrLuLhvi2ZiMd4IvFVOinUbzhUCeMPWcp9Y5njC4KiV7y8B5VQy82aJ1y+AdMn63OnhZx0hHbMDKEVmLs+puwqQUeKPBlEjJm388+OPP92t1+vkbHfBKucJPPH4Hr+wfmNc6k6FHvRch7i6JGO7oXLPL4xCBzLFjkQVAcHbNybHjvYPGvyIWpZTpYXHOmfA+qMPQBc+Cxc4V1hsdffvcGPMstsyVuFFU5nt4l7yv8TPWzIiJpPAu1v9wzXzMI21GDp97vbskiy4bxFaBnUiA03u/6I7dLVK42w0y7JdbBGBEIqFPGU+qHOGrz76Lr738cDEQ2vVSgFEpkzyc4+6cZuPkJO9hxm0aXFCZ2PcIoTZRFOCWy2a+pijVI5nOAedWRY4HMMuVSGiiBu/0oB/oZ09HJspE+q7BG07BvG3uCaO072cCn0YPhSC48DEJMTvXFYz42dStiInKkeSS86qZ3qR1LdnJjdyyVenxkJOwIeZ5vzTdFLkiCMozprmUxZ2hlFK2GFMdmqyRG2ZFnCIQW/x3mgGH5p1amolpcN3ThFip9rPBetbkMpFlj7E0XHSsa5N1W4949+JV/P5XP4dX9g9wlHmWkxMYfuxRMht6Bh2fhb9n0HqTKRj3O5fl3EoOmlj7nrG5Peet78Sj9t9PkMQ3Iz8OtrtDRvsn57g7YYi56j8jt/wEmNWQxZDzBWYH5DmS3ww18O+QeRGaFNKz0ULmUPC+IyfyXggSye0STcYv0ic0XNL5tRSQWDfAWci5hPCjT97Gl5+8i4coOOoQu0PjXjSlUTI742CiO1+3wVJc6imCpBEuFSzijYab7YuG2RbP4SdCt0q3fS/Lt2cmXyOCmg0WlZIio01+7qwdy2bINGZwGxyCbSeQBEOAuiZgaEYRopW7MtKTQYuTDPCrfS+iDM5XrBzEwfWIE3ms0gd0roDnd4cQg0zWUyTuISWB0XIDqDEPj82sPqbiRV5DtqdEStcafy8f3EyaFloC3hBvGchQHmYxoi7bGm2NmwLNwEcbToRuxaxoMrJewyOOqCR+5MEb+OLV6yiNQTz3GtrqUPKmNDvcdUbqtTW3pW/GLdCEQ3DP5hz3zAgh2kCMh5h3/OficpUkeUPi4sxO+cyMfGu2PZvTz9CBoAxwLkGyd8ZEikn2pEfcM6nwkxAMP4nHQ7Y55laI+xmTJU5MdpCugbb4CRtEzlmoVLaDzc8tlxg2YRvyV4pM+yQcEucJrHX+jgXPD9f4Ox9/G+/Xa1yUXUwSt1htLlJgGhG82NYxJKByQnJDCgezfBi6TXtAEUZynYf/xM55sstRG2Txs2P4kEPDZFvkvixS9AKYIkhb5950lUSkpJjNvDlfdw8c3lf8bDbLikqzJvWy19rn+i4kMQUdox1syQ1TU799hbJOspAcR5zSvhzoelTKV2Z3HtSq/5/NeSIbUumuaxCjIiXhJc7DJKRC+XfXbG524qGSjGTG6O7Sya7JHQh5tokIsxKdcybykApoG8q6LipwwAE77vATj97Fe5ePT05+nhrmITf5fmSyz2BejYmZjkKHxTO+97MRA624ai/nErBJ90cjk2U4mmcO4RnEe07Xzg03yfuw2rdUEZqhAS75MwMqZTMkJ8Ule27vcDkj9OXQpY2Ev7sCirayDc4pDfJIZKrQcJRoS37o73fXLH+2zqSzhVoc54ww82CV46YyOejKJMY+1tu6RiHwRjERzujYOEp4tH+A3/fq5/CLH38H3zg8xZ77brwjBJc4JzL7ePA03GQnX3Oi6Bi8/Qe4IajFFGTgGAuBRQkmiwNOFiW2pzCZfeXXdlBG0VHHYfhEAtyy9A6jWif24Yx1MrviLasNwqg2JBFiyFIIJM6J1N7PNiF6vjBYTy8XL9JJ5uAjJ4Q6z29wBrofH3U5aaSJ8/Ly/nIC3goNJbkJDZYPtrUJ5J9xWGia/HBwaMu/m0FyEg1aJhOu/HdKi1q+DZRwZHNNDkxZ2CfpDjGAdoqd/zqPVwrxydByO8zsAbvFEVe7S/z+Vz6L9y4fL4oBDBLFKepm947h7m3M822tgSdjEZ7pIuVaas5MLpLufUIm4wY0vHUwb0HW50YFSPGnWyl6nwRm130PKmkg3W4Z62wdyuUexD2m0d59CY/+n7XwmiEt57p1bPEWzowOtt39tvkUPKeq+BREzECAJYa5uEePxz1EofPfIgMWlvS5FFRSpxnvKV2gStiR+MlX38UPXb6Jgw6n57W6H0EnNNUaw8+Ejg6v41I145X+LDeSm9xSnoZnbASRIBnmNNQhnUepSJW2CL8cVWEyzwBwyhImshZf3XiOE34e+5lDNwqbzFFWDpdCJs1yb6uC7l95fHzOTDrQJ9J15uRlfHTwb374VQ35OI4WT2JwYcQT5izoGRtW8WK53r2ThGwcUCKUNjwAqbKZ24Fq0z9cQ4SOGVJYoIYmEqyM1QvuK7CRJZesJWcPPTCXdWTqns5Kxt0ic+KDl6S9Nzriye4KP/PkM3i0u8Bx0a5zCuVuY2rRaXAj1c8kbdywZP0kngF3wslJ7nXXTP7XG3xzTmI2yPZm3I475Gr3gtUnY4JN+2Dy7u58BjDOPucZ6P3TjgV+vVLD+/otbCEYDU2ZPP/D/VyLsA0+zBapa+ZjcR7NuB8hZBsx6MXwr7z4AL/0/DtAKSgq0R47IPvjvj/Yz097hDQGGzTz65hh5nMfO1iXAs5S7oaMBmZnvhwVnnXUMalUbkk8MPTTvp8ient0/IIIb3p3avT9ccO6Mzpf943gVDrGJHnE6IrbmrDzMVqT83R04/OCQRPobu6UZW+lEdi6WxAug+fPWYxsW6c6XMR7dWCbTuGTBx+TuMONuZAmsh+vEAWbT42M1Wk90RynGGG75c8HVLx68Qi/98ln8ajscVA9VfHMOn4jJuo+XSk/VUb6J7Vt/USpdfp1CwHvRfLTPTvhYWV6kTSJWj373bz7vY/PwH2LmHsl2pnH/QRx+jQyxJni4Bwys3VPPu37/3pkhLz3xb9rOH2/tMv7xw1lSpPwhYev4yeevANWLY50trc48TKTA7mBsDikmkmnk1gAKnt3yEybNFU/59dkfnRmNDrFkch4KzUUJzrfPw5x6Ay8QEEYw+Cm791U6Gyig5ytMFwDcn5WcEPvOMRZpE/21z78qhRyojnI8FwiFxUcnjaFNFtnMHVo0pHFHrWG6pKjOZAT8IxgFwhtZlGc3SqDyQItcWviPSFjO1IYZ3MTlQOMZENN+nOeC2ey7ztkKY/JVNoks3W7TJ/rZwlKe1AWac2NbvHG/hX81JN3cIHS7ELLlsfJhLA37Wzukys/6aTu6gw1YZufM6S564DYIvVtpdfhLt/3CX/hk4YXYYvEh0yYuh9DP3A1c1e5kYEwTSScuOvd1c3PkhunhdD3CfX5NGjCrPMf+CjZEfXMGa2N0cY5kuv0+w0IgKGnwla7fUZRw2G/XveuQuJb1x/j7378LdxS2HN3snnnzLFljEF2WXN2S21z8AmCHL53PuzdtMTghdjE5KVrFuopl76NYWhJtneaj+X0POPDCeGczAq2OJIYO3kF5VKUvjskQMsu0aA0SZ48Sc05uAcm0q+MnL6XQ7JJh9kgjGQz6z7y/YDIDtqKpBY7/Ht8ZGeZMwXZjDiAgjDCLSQVxBJ20NsuuEI6PXgjuRCok2Yo01y6zS2tIPJEwQRrwVQKkWiyBaRzkl+e0sviuh41wOafH+4p+tilQLg5HvHGxRP89HL4H3CaDTrUn/EThUo7EmMyK5sbwTpKxD/M4n1nevSUzhdg2o0I3/vA0efiee974GQ1wFlN+RYBLpHVkLzqA6HTTXruONA04WS3z5iv0ZlRyFYoj+4gT95VqG1djyn5MkHrZ5UYW99jI7o4FGuzaznznUhk3nOy0vsUSNO/D5InRn4QOD9UNjgIdEMw21trFd598ASXLPjbH3/rFC+87G/iiAJrmLAb2TBcyw5v98RROwfMx7fF5bqUTs4msoGtWcOvzPwVdo9jWFk2yejjP8u5QEihZVAYt+un3B5H74LeENIMeaLuPlxL9rNnHPX2cQYT0lDNxVAe0b5cayHYGXYQgSnrgVpVAFlK0TvLyjG7vnEyvaNrhDCClgafM3rlnsQmn1glePLgoWQKIbo/g0UwaiSJNITB4i5XRYMSDLMensFvmWv0boqbXG2Pxf57RoA8jUBqTNdSRCFalS3z/G+JTmgmQ7LfUfDNqJPIEqWQnf7gVAA7AC/rLd6+fBU//eRd7EAccZIIBX2PoS5Atw0Vxup7cMfaCuKZBKbMDGmwlTu/QRZk1oJnxvbk4PgkkP5mp7gBNfuGsmYBzFj1ecM/21Gng/DeB01b05MiIP/cude4I5o5Fx2cIBVbBMxZ8TVVg0wCoKYBRvcYG/G+nIqZC+X6uy6PTOtvFqRUNqKINwug0XEskp01HjRZHtwt3L1jjfNy8uQX8PrlI3z5lffwCx99Hbes2GG3uNr2WXYEHlxRIcsysYPLQr16A1GX7Bbz/mcehLv0MdLcNbGd80AoMRqzOXIRTLoUi94Qp9v4H2rJqEI8XMnEH9BaMNRBlhzeh4oJ9u3amVqsxg22ZvsBwnITOKghKgCa9bsXRQCXZNu+jorPBiKTWMGdSWbJKCY7R89qZjLQWKoUZIdD9ohdhThK851eoBAG176YktQ6YHsQwz/Zze6w2BYEZMI3IdWfSm5bGrKjlY0xNOOquLsUWmEjKjkdaXgJmmWoV32BbGyVtUNFL4+3S+d/OvyrVdsczC2WoirLWzSytptRiz08gfFvlrI8k1bnc+wt//ZgvmOkoM2u/czBsEUWO6fd3wx0mckXZ4fk7JrdZz7vaMAdenlOVBBO0JVb/J67do6IOPR/zs44hTjd10p4dg9mnf25uf45e+Wt7jivyRm3wo2U6CQ9u3Y5eXAIbjJCMbc+y5aVOtNnIQd+cS7hwhqkpq60LblUwFFHvHZxhZ9+8hnsQRxRI3GZvseaCVdKmYtugIpmeoOL44bbMBOLYNmcgsRSmChfzNt/hc4ppzVMLcIbihHGXRqzdKnwebia2KXtvp0U6z69fCYfV3AtZvJo2d0PcyaIn7jsDqeiGzQoG78OdWmy9Tvx7UOHOjEsGA7eiewiOjVycFbNsg+O6toOsVhSn5YueXaYsl3MLC6Mh6AaFMVO3DCdKt0yNnS0DABGs8mmV6Xxc5EBeI9xjahgSqKSm02rqUHsWqDNhKp12X0mhzD/clFYXaV+OuLVi0f48pP3lrzwEyJwyvf2yhtz1k3qRmfWp9ODT3dLArPBCs1/gBMDn7zp0uHgyfz7Pt3/fQ6MT0JAmxUx3Dh8kGfO+UDO3Ws+FGdKApNnanJPdMaF8C5ppO7zO/dUXOBTkC5naw9nkIb7FFlnJY7nxiSDBzs3/50mRVooMFIEdV6//fsgepIEO3qFWbGG0Xqa6S+fpIgNCfipR59pHSZZWrPCEJJ32kcrPGWuwk/nU6NTBwE5WFLMMuaz/dYAdg5Ya8WcgQfZeMNietk9BgPHf3E+HdcHB3eFBrBzLNR8PNGVawVgaeTrMf1GwY02jgSykLoX24UmLZRx4OyTrkUS11js8O7WxmZPkX/zw6+qyxhmyBdjBz8NSbd5NGMJcnqJEvycueGsF4UnihKQkN+ogK1rSDzr34VJiNHkNozpTv2gnRGlEAmQGhUJMoJOyCaY5dnEEU3YzKOpA1talaAAiXrnog17VEI4VOHR7gK//5XPnQJ9mqf/PEmNG8QwTORJ3Jil3ZWQ9klDgb4fkrJznv13kcPO+chjS+ky4wKkbAN+Spb8tEM+Q+w7d08GgxxzC5wV/EwGPPdZB1smT78R/9ma+WdE4i7y4VkuyadQtGzKMe9BmJ25Ed4tUmAMBLvHvagAdiS+8eIpvvLiO116uGxoVVr0/uZoQoR8+plCYUUtotdA9vQYd6QhuZRjiOBGQOqciJfsahlbxkBE98nTlmvj6FccrcuV7Jr96M4BegEtYcyzwYYcdzhHZ028O8ZiLLZKhGHYIH4O9gxj8AOJxJI0a14p2V5weiCETmi05YvQAr3rls8RUgLD6DaYC2ao23Rq64kMgxfaNeIko5oxeWFL8acR1p39We5ciBqcumT61gEWNqjsoIoL7vDlx+9NDn+N8/vgtsR7d3T36iC3iGL3NOS5T3d3X9j30xwq369DK2wQueObHFq6I7PAu8i8AXJmkDSJtOWGPHbL8GhrdHMvn/2J6ZA+4T2YhTDdad70Cayhz3JAeAZuv8Mt8Bx3BRs/zxlqZuO4s0IzjRCEIuQR3qMsn+u9h6/iRx6+gUM9Tuzb+9yeiUzZ9PREGj1ocnCb1XzWTGscWWX5dcyIiCjB4PUb0KvoXjpTcQRyrjsY9plMiF7XoExTzFsz4F0TbVe3ptfS8A3xAeMaDLN9Py/HdS64jDwGIfDf+OCrPRQqrxI6G5Y2A79XDdtJekmmENQBs0S89sHlFj3G+owBDUqVJVNnk9mkblzDiVnCYLVJhYJhYFbJf5Zmy6mBzDuAKBrlfhrS6izpcBYWKiMJLT9yRAVqwZefvId3HzzCodZTtY5tKRZnsKPuVh3P2LSllM05NSYM8CFJLROqNlzdZrP6uzo4TpQGM2LZwBC/j7Qvd9Bpw+csDTDNjpkc/ngGARnY9Z9A+68Z4rOB2HwSH4Zz3f4WAuAZEaeEt26Mc1/J4ZYaIKyNmdwyyKPuUC9suQSmkCdfn9W+11bGwjmEgvfwcGCaX2qzVU6y7JA2GmfPf/ejb+OrN9/DRblYEPcTudn9QuJWmO10ZY2KRo07cMaozLk3SM1PQp21EPacya8xixCDpTD7OAEaGtFxvNv3YVWiFASyouiFPaP0nbOAJzbLYjdaIlcr9rK8Rm3KO5fe9/yVbofeiLR0d0eEa+iKshK0i1ZFMZHQBE2ynGXUOOepLmYIjLbBFoSZ/LNH3X23p1zJNzYnk42ADApxaZoXf1R32WOCZJXSnnwW6zHFfbNmtASO3BB70GMd365Fe+11c1uqPqOuciqjyySpSNDKjosC8JNP3sG7l49wrMd2+J+NrN2STN1BosI9PQJmXe30gPDNcDLzD93zjEh2j+5wJvs7axc8GX/kazBzweQdXZ0jIZxky/Oec3TvXJohF3C/TIKQIMbQbU7tmLdClbTtWTE7UIfxgnd7g+WrpvfyHImTkwTIsI5SlzRbg/47Q6eeXkvmdOmhS85TwZkC6C50I3MG+p87cz2cd0aEawfe6h/iBa4TydZxgIQfffIW3t0/wXW9HV17LTytI1k1MuvTjt9IlB5rrqR1T45/jestjU9Q/r2U+wCXmrs8kEpBYy798/UPy2axe7GgrLUiXPsZysORjTGMGZw33mvJ/vmdhI0mgfRyimE03A75BownpBZ9H9133wU1B17vcseO0RjmltGuJUGqazw7qY1GFF3NNQpHv3yl+frJj7rnKLtaoMnenJkXUgStA7fuSq7LK255HJwU2hopLMNCbw+2FwGr8oLOftVggqQ1VGeVlShmApw+S10+aw0JjCHzwuCnoCMncaMDfuTh2/jsg1eWzp8TUYLJI6Gxi59BxxsQsD4B6UvW4ZYsr3JuQ+qgz81Vm8FPZszaBqEN7fwWB2DLyCZsOJlsk7vyrejd/L0nP5NlhJ+YRLfRAWc5on/GYuFMmrCQqXHOOcD4iVPAM+tm+E8po+Il+x9soSL5cJU2CDiaSlCD/S+5+R7DLN+LB1q+enomeReqkpqfGUeHbk4Urr2m5AKPaw8Watm4J0HD6+S1sOCnnryHl0+/hqe6wUXZxY5yJRrbvibjehWfg3oCYD6Y0GXYDOmCtAksY9eV+AMyEiB5yjJYz4mea7Dun2W5for260Q8cIPUzxAA24Or1iKPQOmvJ4bWPCADMSo4SierJntf4MB1xsIpt6UE1CZcQ1RAZY6YLVL14lpKkIPdIX2GYTMeMma0O1OjkdxCLXC6SMzkpzA6X2GOhJuvWtRMROrtTsqU5qQb6ZsZndVv7nwhYSmyASedlBAsq81VsI0Thv1rfPAau8KvvSMg9kRq5hKmU7Wuhet5Uw94e/8KfuTBGyconv31s0d2MMnwDHq/R6njvo/L3TCfTrwC3eXENSMhMmWLp2wBptefMeDPdZL3VgKYFIx3EQRn7zPKY7YLnMmhOc27v+M7Da8xcStkImZhwlx3V7yzDPwN5cNd3AqdUZnMCpYZ8WsIkUrFw4ycKVtjOYVQwVGUZ7konDD4eVcCYVKOzHggQYETrGeTJDfFB28trhkKkwd96+tf7Hb46SefxaV2OK6oaFWYFDuGSmYKnpvjGjoiR9BMIq4O7dP4aB3h0EAujJ6Fab7a1s8MpUzkQx81cIWOPXHR4nmdC2HS6763uTdLVMblorHFRIfny4KhiPD5pZmfMJsaQiEPOQ9eTsVa1VrkDROmEUaCBc003b0DEMEcaIWQaFp1k+YhVn+d6MaYoMWcAuez8ppcCRmrSkbyE+FFSIpQbGz8FVYpodOulJE9YBrgvDkUg2x6MdCLkXRIWaUcihHRIH626EoF86BuIHCsQK0npKXWIx7xAj/x6O3g+OVkzXPytPvYy34Sm9t7vZ93mHeoBc4VCwPMPXEOvJNgdq+89ft14dMCIHv+p06PZwhv55QLs5nxcPimUQO3iGsTQtqYM8Ht+3IPKeUWsXE4/IFPnSNwl+TvPuRD3ZH3cSdZcjbKO0eqPSN51B1x0tgyBAI/lcXyemAfVfHk4gF+/NE7QK2oJ9MS1MV0JkTCClBVSqQDUBUbjcUUx3ttqXu5VtVmrhYIZFVNJh4OcGLogtfrU5UMaHjqjHuhUSeRgCn3RNmjhdb4GafA9mla4ixNzk5Xc9GQy3VoUuJIpuX0GjqBZGrken9V950wOh/7+etjlX3rVl3Kkdj0CM57Gjz5Q3Z45DME496Yx0yDeCK0FTT8cALIapvIbn9rHWVV7aOCEJWr5pzliMXqDNjRikgw9GovXHw7UJtLnXDi2NN9A6vxFJwGwyANCV6NTVVgczvH5rjaeNbUxZzGKj/x+F083F20a4GcPWBwoiYku61NjXdY255jaW9uQDlG99yGnRAdTcYA3hnNOmWeySC4S/43wLJbevTJpj3Vyd8VSXwPlvlWB66N5EEkV70pcW/Lke6OECQmGP3TkPWcwxBkvTPb6Ht8xswn0JngoNCpeydOBpvtT+si6dwC3bOQOBdxPH0mNrwa7pRIpmaMCSM8quK9q1fx0eE5vvryA1yWi/ZJVqfYFljG5AaIIQZwjH8nwriWXgjOLK4ZlVvdUj6O/LqJkAZHTuZzq40fvbX1VFpDNcwa2CV2VeYOaTLDlcAXbOSCYRztMyWj5TByWQokRsk2zY+BSVbfRxwcTPAIoLCXAzG3AQpue576x3BRCIVxvo0FmGUntsgSnJ4teOG+e5QhBW4/6X/fZ+Kw4qMbIDDhk4ocB7POJJLvPjs1EnTP6Nhu0fAbhbsRP2ckoUQnQDUjh5huxBwCsvxsXV77Vkd86eoNvHX5yKreEdWR4V5MXfgsrCVstJ8WNr+vx/7kocdZv8YJduUErtCg8N6fnWfIancVB3cVO/k7csN4Bmf84u9btEyLDPJOOHjTFOeMrPNcJ39O5jkliyYkgpP1eVcaIzfWxn2RnUa2c8KgNJifaVa0nfmO2riPM2fNc88jAjFutL7iGYnt1nPZB5JJXrgceD/y5F28sX+IWx3iOwojCRG0bBum3Sg6+uVE2K40oPGomBBjpeKOQfXlsL8cBjanWeXIYEyKUQtZO11/Ren4wIGJwT65KJIFJfXjVWGk20EHxbRNJj8R57axyy+FyIVqM38fgyzXdw87NHtXp5YVXOtaEdWUrdwtern42K8Dm16/lGCfGyUnJ7SgtEwBN5MI4r9llh1Rr2BSZJFLCxLfYRX1C1PV5YzRydp0pyFYKB7cbhu5ftay3JSKTMqJc7mYThWTo9awnhbLaYoCmaxHipGVa/TyQQe8sXuELz58cyGGuHNDCvlpFe+2Fno2t85z+3qX7jrLLTcMcIILXpa+JilnhqBLcry7jxHRVje55cl/zvLWv+9K2iPnkYrMjPzJdcI9pW/n5HAzJ8HpZ7rje8409Jpp/88UF+fCgbY63tzdT4mpW/wLJ5lupS2ekTNmsieSdfVgs3zGdChwaTJKUutmVsInQRkiN4Ixx3ZmTHWfAlspgaaRQ4U9C37iyXv4/z39Go4QdiqoLVmwNGZ8oVGxS9SdV1duJac/5zlF6azCoR7QvGyn688SE19roOCwjSMQeOQx+6a288kyWEo8K4f1K3clNHdBy0agcU8CAXUlvdP69iDZVNiPq6KqjivyjOgmq8UG0fflEnSPsnhc2AdBZjK6rz1jJqKQfs/tR73byGQ9DcYLwcZQ/qfYyUbTE38PBpOjxlQgTb6I8M99JZiET5kXkVCS6Nxii9h8A2y8onCwR/8IYPoc93FJugcVwiUv8FNP3sVu8mzLiCKcENAwmVUP3ccE1mWWUp3pFM/NXpUNiLK3+tZYYOPg10bnmrXg3LA2Dl70QwZ5yjy4rwPdRB0wnTffM/M+jzPOeeQHKV/y9ccd13l2+J7LAvhEdskzCeMWaz59zulaSgce75EBMHAh1nvrqMNknSub0ViRFTvqiTtdkgluSU+3kKeB62HPTbOBDV1jJHfKiHF08xw5vyvxTZafO6rilYsH+PFH7+Kg2kaoPRpgo/jithKjIwDVCG0dfQ7FmBJy0ZQRPTfG9+zQvVszJEVJX7OCV+eCOeWwnxfjmuuKweRT00jXSjbt/3/a/jvekuwq78afteuce89NHad7RiNpFEcBIRBZYBASIgkbg/2zX2z8Gt4XbAyvwRGDA7YJNiI5kMHGJhvbYBmwjCwUjFCWUEIIlJBG0ihMnp7pvn3vPaf2+v1RVXuvtfbaVXVbePiIkbpvOKdO1d5rr/U838ceZEi/196dkJwOhiCa8cSCDlsUtiQQzdpqyeKgCwYWLFsV1RBeEq1wFlRjCdRRpOO8+RI70Js8HwrUqUqjYBtT0JhRFrOMoTJi22IZLgDnuXsa08hYSBVNLHOuc4dDxVSmjVvEJ7G8BsP7C2knz6l/ZoExnle9EUY1MYjsHGCH18zZjdFyxO17N+FgsULsYT8QbTuNtBSnVwsvGZk1s7Vf2RAVJ152LOK3iuSVhYawnrENmvHCd0w0sVowT5E5PwYQ4pH0PDfCtpIUOAdtPPVnVr9hlerk6SRGgD+jEckmwZFG5shj12i2jVE8I0V2u1HpFyp/q+CvxEkXHQ4555fJhjILoPK5uWApZn8kYZ0JNS5CJSLZFvEFeMjTMVRFh8IRBaqSBUkgzpkZj9g5g7tPHsZd66vY6vVGYVjrAikQkDx0mRQ49T+776NsF0/jWD0ezhovGTtsHGX97w1pBBHyiIJk9LxQ2LOHbrefY98NGFrqlN1d3ZzfgdURqRO47EDLw2/Sd0krotyfLLRYLMhaXwOF3R8yZZgIgYE4BD3193aQvnCmQdWoRQpsyjnZ1GeymF9h+0hqRhIzERsHq6s0gNx4TBZ2C3UytuZcYftgcWG7i2tvGuESkDYNQEEYYJL1FJNA4SdJqzShbWl602cLtzQCkdL2YiES67jBxcUOHrV9tmvJF46JOriFKsE11dPHSFyt1/rkkXQ0b9buzl+975ftekckVG2pVgoBntAXwPHy8xQLQUYhexG8M5PsRtvlFh40Qo2jMaulAyKao9FwOwATtjeqIMDHZvpsCh62xVhNQ6FQsSNgqNomOVE01giTY8I9dn4fn8ZVAt9pgilQk4f3FoJrNUolTIZBMYAn7N2EFQIitwgUMiqeRcgJmfl23w7Xay2p1j4nQaFuBvMQ3sZKSZ6/v9xOVEFg9xg1Tx1cCYyS4W4xxTBcFm+FZj2zzyd1UrZBFQRFDuGVyo5w6jRE0cGCjAm3McGic0GWs9BHVctIXV1FsKoo0mmQM/RHZSgRKdhBbtOYNDfKTZnBKpfb/GW7lqE1ADmeU2U26WQnaaYElX4EdbLV8/sYjShDtNCZuVfYI0Uf55aT2TY45spTzIvIkLG4SIWS8ZCkPbD990fuuP5P2L2EBQXYZjuJzg2xmV17G/uEuMxu6GxOIWxS01z7nz2pTTD9yQKciMpgokoCWw2nCgcuo64FUWHJg5PCV9vEbPFCI2OUmpVxlEWPmXZNGLuf8R7TSDHIXm6BIwSlEQFe4ZGfIcIsik/p3XeKKFUk9l0trolYHX2ELQTY4JnZdBJqm7wqfKzVUxx4eMr2Z8YERYEk1lyqcAQKmiH5NlBduLPaPYnKTzZtwGC0MWJ/sY0n7N3UdR2dyKMEJ2fRKVZicj0O1oU1J5sgCzu1JrTmeT0TmzWdsmrLcQfIjZvS66OsnE/jBHbkRCwcatLKzUrEJxMa1XpoWCVdp4YKcJnu8rHCwifA0xBJLGi1EG4EGjrVqZMhu1ndnbDI+2VIYggbqVuIlIRIgjUQUGyzmeLEstJTyWjaxkZkLVI9UaoQT2t4P7F/riMZrScGFKRYzcMsPaacZxYiC81bZiHSMOhhSGEFpZtPZVGlgjvoYsCBFnHkcvafihJGyy0eu3cRF5Y72HCLIHCR5QIllP9mhu2dTiftcVKp7kXW2qATB3wh21BjbHuP+Md2g3Uig73igyoxqy4S+ZRhMZ5wkkzwDtUASCNkQq/AYAdGNBrHLAiLbO1ZtbyGwjaFUesiFbPReel/YyApVaBVxjBcoQ3STIcGm4PMVGE1lgEx6jRQti24uRDEXIKOnIwHG3tdOHRsN5D8sCelrGd5KGOnoTIcJggNdYegW1fncPfxw7i/Pe6sgRyT4A2sY3XV+FIofbP6ngz1jpwcGGWQU9q0tMsUUaxDO12LoKXwDn2WgP8sc6VoI0ejFYseHJG+U/X7Z0OhFG1/s7lqYSqLkR4pCwIbnDAxiwOnJXYCQfGgoZnJpDC2wr9vcyZYW+Dkiw3Qp4rIlpXFImCP+xADnVXHMvTPCf/jMmcKyjJisgLSyZ2p4OzDzjvFvEha8hg6oIeEYjM1ILgCTCFtM2ETxsRFcZTfd0A39z9YrPDY1QXlYlBtIq+PhpLsN0cVbTfoGkjGFbk5aFaekQtg+f/siAPdDob3EIv7cY7KnyVhz7ESut55+/eV1+MxAaqbylRHoNJ+rl5fI3ysgWY8wp2H3eVBzOVlItRwxM4GxxViIkFHXPOcZEanuPHyHgrxXW2UMJJNUJD+nDETO5s9RpwlKu3Nc3NUTv0M7Q6SWh8pJGOBOU6CTvF/bptCrIWaSU94/O4lLJSDSxJRhZiOuZpqJFvi3bMqxzjQeXpmv2IBxJFJe5KkKjVUbG5oTc8bXienzgNDTzXAMm7ZzKFrWSpCLFimmuVxBMkNTo0XqDibMLRVn8kexvS9EgjlT+tEgOIWJRJQA1beyBhN6pC00ik1pdAA9KxkiMCKofAJvXcRkXQylVBRMgCKLC5+BiykTTyWIaj6gZSYxxIawTaCkgYbIWdlqwQxKMEhC65Q93MD5bZWENev+3MqVlPRwelqyBgt8Di95iAetMfu3IRlL24JSqdAKshI8+srsbO2G2AWS5nsNwXRmRPQI+NH5d9J/r0F69QwruSMJNRCP8LEJyeVkMzGozokMariVt1nITO5eXgf4utrfHmbXulCayY+E3JS5bygm0n8schp0H5qPf4JRCam1ZzWWafrRWfsA0dQWB0XTIhIUZ3SYhKlPCa69Ao9NyHQ5FdMZWS4lkwDCao5ReAIDtl75jyssC3MFPiMlCWJKnoCFujfyIyzWzu4dfss7jy6gmVo+uwXOQqgHnNrOoQsugMs7ynq0/DK1M/y8yWRcU8qC6CLuevXVAX/EWMIZ10IssObkgOHJEHPmipGyyzM5Wxes+hq5z1BUmc5WQsJmpcjEdAqGbG3XEqY39DdDhBMADFqlimCTNyPAJhUXrGyrIg8P6lwJLJCONluEWxosKigSC+qDNX2Z5YZ00K5Lm46YkGCEl5JiQAuOhNgHTfJhpMs2mXyw4R433DCZQaEsIYjcQF4yM+QJT0Z9SqzSO0Sb0DwGTYccXnrAJe398o2uQjMUJ+RQFuyY6UriH82nEdulk7b3i4UVEHEkm1ROjNbVL7PLr4qLGdElMdOCE9tseexEYJN6rNjG09bYBXchmvApi1cZF043AHvMxnTbHAFOsSGRlhQ/JhBfVHDBS1tRORnRz7WEXKKiFtXQzJDQMkWszwjfppGoEfV+Gw7z61hmJ0CpcqqYK5il6VzoChcncTK8Ytpg428tYj8Ik8c9BjAo3fO4b71IY761FFWWvysA2ODjgeoSIXNEcIoFPjZPSBZKsIywBnUo8SAov1NJhjN7ZrlE5mC8hDKgDwJQCqWQ/ke2YkbFpo7lgJz0mu0mubY28HEKeu1SR5qc3EgP+fArO0FaU7Ts5k9BGqmdZm4T8qo3YF4lyokEkxizpUfi5So4edGoYIn4f1XdMDM802oxUxhohQiJMcIcpwx5DATCZ+vuekSn5qlilKSAHPsMbM+zTN5IpLhCB4zmErBeiSZEFmLIKKLA4BH7Z5D6BMR2MpELWTC0BbJhOdMMfLZy6U3JDiPKOgJkmqb+hg1z9rXXB+8w7f3QojUGKISAaw4ANbnPdgnjZfeawnLOF5W7VbTrahkJYz52V1WvNPaZ+Fhty16KwbzcKlsTuxkxySVQo8rbg+esIHSiJZDKaadkYwdv3hx1WNdhGoRZQKnXE2ME1Vd3D8jZEq2o5CKLoJGoErW8SDtu+UzRsLyTHoESWWWhX3vgz0zoMOvr5olbt0+g8itcHlxDp1hh5cCsQZDj9z8yrBktbCc8zMp2JkGMAmrenIalOJfJTCmUnfhkEEEF6Mm/2AlYNYBU7bA8aO95TiEKymjTDldlgv0skzbjcpaGWykpGplsQhGUBsGiXQj1nYOe6ORweqqk3xtJiT/V9SzTnOOpUywEGAL4V4objoNGWLkRb0YEJH1lZQJWAQH0ws9K1O2FdLiGzJ4ZS+JZBAUrtsNLi33cW6xSnoAGvGu0cy58uTpy6ixvbt9jHFes4yNnej4lCfE2e/t44nYhR8WeaPXeMwux1POAUwH2UxBcTDxGbjiSGdTOi0WedTWVvHcFxa/G7gmNNKiL8BXM7QatdjeKjrZZCbMsRzyx+kKYX9p0IcDPv1zAHGaZWbcujqD/WYLG26Val3uK1wQCGyHxwyoKxFFxuvsdumSQE7+NuISb+6J/Bij7Ac4+LhM3TO6Ey+eunh9lU+LUIyzR9d0hjou63EFaWx//9tCtrkNG9kQ0MCaXsRUBCNkzKA4GStxRX4pJJIFibI+FJSTkjLAh1IyXlehWm88ktozJfmpakgdVdTvyVhf4Qdl6d0c/KuUN+jk6SRVobMgRA2/MpKGKrG0Qwp1piQZ8pCApTKjpZUE2MSIBTV41M75VD2qm1mkCIJZQ4C9041zKuSKx11Wr9VF3ISp1JjmRbvU+f3kYFjH8gTk10tOvQp5IRq3co2I8ezPsm6I4j3WWrxOnO4cUSKc62pP/FQJ06l2GWTXbcLPbi1oFv5ktSPsjFwmI4rta6ygi10xYaWT4M3qa8hjK+YriH4C4gV7WpWnyEohwU73yfPXk4m9HqNMFrwMhxNhNTRuSiBr0Fi9q2Svcz6CLUKD23bOoY0xvZfY/4youqod9I05IueZDUJwTTtl2WmSegvKNup0EE3zblLsltQdhrbpsUk90Kh6zjkQ4oQv95wkUCZNTJSjPWnhlsmAlJzlkkjZFQVM8pkWIk7YZFtrhx30X+IATFyMKQaR5XA9A5NsC5kWC+WNX4eZsAjk6eMhhQeRE/yH06YZkypV+DCTyE7aN3T5w+qo7C+yLAsTQ7VSl26Ih+ROPBjFrCe5EMRchpR6PncY8i+OKipZxyUDwlOpWvHMUXEHmLRvWxY7cRiVxIjL22dwdrlKbOpKbF6x0VaT0hwcLI0BfyzdjKajdse+dizHvuYyGG3lnkJNP4qInSDZqU3IQ9bWAm4ctTrPcAGMJd951jCS83jP914pVsbierny9bJt7WF5qQYn8hwfYx0Le4KyhdYE8RGGllgl7znX0rV2OvcIeSMcmhdDXWMsBIdU6Yo6R0YH7Ngk5VonoTQyy7QsmCy1MP99ZMal7QOcW65wEjfmeaSM+00bmL0HOyJsmnmb+5ckJE0F5WSxdgK+iQOiTHJVIUA81rInI3iEHpsAldGOCOEZikF5oKW8DzFZL5zGysl9ALZbQCPNEoLQ7NgOdv8qRTxwgEzIJbmlStytUICS0yOhMdkqC6a/yIImKIAAs/E0MqlCAaqxIU72YsaQLZcCmkAC5StcCEUXifNcRrVSRIRwbgZQWX9ZTyejsLTk7oO2VJIZm5TCoYhFaPConbMlTIKdQATh9ffm5dWT5UixwGMpdoYRb08OxcllIthEwnioECtVFPQVe5w7Z7YEtRFWfAGL8VjsE4WI6ko4VLipAopr8JfaZ1m5XjWlOFfAM8XfTRSHngd/jEhYw+DC2dx5LGa3klA4ZXGlWkHqpEmiZoP1AoOkdsbRUI218b1IX3YEpuxZaj2LoBu9Xcn/EJ1HsveREKN5+RARjIYCHrk6J7oIbKIJfU6Ebu2b7x2KS7Jj0dydZZjdlKxwUKbEDkdxRuYOc+VZdCyWtrQlKp95Kpruxc8ZuuLkbfCAGV2TF0ThZvEQ6fCjfF7npO2Ta+sC0WbXybbl0Alg1QnI17dQvqUKQz1oTApJqC0AQrU7CAIhPPdiM2c5ei642NAhQL2tAtAWG8p3eG/1E7jgYdRB2dLRvbSgyZnpnQTFf/YsH1JzoBwFso/DOn9YK3AZJ9ziEVtncWax6iiEAp2pT4jj7WR3titPH0YJTo79qPgZNbhNBWwDx7rnWf88t4KLiDZzNnIsgTyibZij9vY6CbbwYK87UbFXVpn7M+2ZKtXRFirm86hx+6kCYLLzS3IEnDaDAdaiVbHN1a4D7GjF2Swl7Me9blQW4bVgq9q1Z2dEMmrt8yBF5kxUUC8Nn0Hd6yMaCa8LNJb0R/0GQc6YTCFpIUPOWMJfVHwvEal2ugSfMYCmPwRd3j7Ahw4fxJX2GE0IuuMZ8gw6KIZ9LhRiIVwkQaUl9czL0J3Bpk2wATzi84kwuQJiLC3Oo2RG8YNNT32CJs5+4B6A5B7CCsSTC5B84CYJB2KhIxBhVOrOHGB9LOL2khFCHPyQ03kF0U/BiAYdGXz9BencZUivv/aUpRAnyUiW82z5ItJ8mhTzmchqK51XxiY1T4wj1NJB7AjpBh2Cj61k1sz/lPss3Q/DrIn8jGs2LTeyczQxxGEXIG3zxbvOxYICHrVzrigPtaCFqjz+sahXcuaZ3omPKpYmVdnOSKYba8fzCJN/KlUQNXuVbc3brHkTpjK24buFVaUdjBErISmLD01GMXtAI6u7GPOd17QYmODkk2dDQ1Wr6rb5a24Qu7mPJSJ6EB2aoj/OTCt0WQojwVi1cZj3OqmCXnbb/xPXblLEaVGzlZyOmgDX9FiKzb8qbDS6r4YCbt05AxaOgKLrStm+l3VL+nCXrxuLxrifSsrCJZUOicpix6ZpPcDFysN1oRgfoo2ZDKadRfIg5SA74U4jltopVs45JvNMsATfUaXjyUKLZw7ULEbOUjApOuVkuuMAOg5ADsmxwwQToEPml0HMjVj6MllwlU2MLuS4gXNLnbUOQH/gMgtZVjgQSN/sB82JS5wqL++0xCpLm5PYAyzxlXpu6AmbmFhtwNZTrfIR0sPNRfIUM0MGTwYQjmPEpdU+zvanf5v+ZKUbhDIhyouPdZG7UwufdxqxMb4m5axIXDOpctWTr7V1Wfvg8HnKk9WIP9+eFslZCMlw4CHy29nBKLO1psn37TEWLPfAAf1gBIxj/epUOZVzxQNPlYQ4m+zIY4FKlaKOHYgRVboOMN0MbwbOZjREI19bS8ur3f8SpFS1/xVpnVxQA8naJmcUumTzJ4b7uOIo8Iq22n0jo2i9IqqG3Oa0sZSEvEzTowrygkQTovu9l7YOsNPchyOOWFIi8vSQoMHrzuIgzYq2KhvE6dokkNrYNbCAKi5SXYcfPBzoGGUKoEqDFDx+2I6uYs9QKhQyMt/Q/5R7ilVKLQTal0ir2+pQMJP8V/AiytIuAxFyuG35bNPU2WukajIJe3mjFm7tamFLyj5Sbv7whhXuWURF/9iBiOPlKscJlGMwJTyIPXMNqZlV8fAFsshm4/GEUMqSiLJkNER4xPZZNBTA3qXjivdwQk1+I7bA4nQ/U7zH3kmlog/gGV0Dcj4BPoXoj8bm1xUYkedvLzoM3uscs0tO+N7nWLzmWgtrGznVAoH4Rg2II69TLs4TKYQ1muFYap993Twy4hm1qs4ILioCfuZmRow9k878/1TX+TTvscyem/3nY89VBGO7WeARW2fQ9hHrcibO0nLoUNvc4nN2UIMl7eqCTnWiQYnKx6e4rpzm6SpQVp3iC1mWo6BVBZfgDhBk55mcT4FLnYPdr/VmroONzMK5kKK+oRKUpgAyksBEySM7KzGnENl2GChN4qeQsulZuhGLly2/nhRKMdkW1YhEmOtlVYbcekrCwKHKEm9Ezf7BJlVpIBsKwpLsEgy/I4oSJJWZUbf7UggR64dj4DZzwAYbHDQrXFjuilaRQScjB2q4uFzvVO3oNinlNFQWpZFT+uhc1UsRrMB4ZOgRWY3CGO7WEevVSH9VGxhK6p7Nnicvu4C5TIOTKOuR3PipWFiqdASigNPABHVZIqHdBKmGlXVOyfbrC0qkbcXb3+fN1J1ktJojgYgKyx3Ze7LaLvXHYK41sFYg1b7fvkcZKmS6IV4apWufZTbcFsZpWBZjuRzqWaJK2UzQE/QRfYoN/MpJrvloecvqDD5y8hBaZuVkUA1p1sJzdRAj4/JiqI4uS0FkAvLo07DSLrHmtwS18bMKrGMxWnBpkcy5W82yQNUnNAIjQnZIJOVQwg055RtkkK+Y4bMQmnIW0LOwKqYMCIHO90ZzQVFsO+S9OCQHIe7g7IeXOcpSIa1mF4wQqLQGMIF73ABDEwDL6RMr6wSL0orB4Bh7JUffKqccFZnV+UJnwCK1aQgnCoLaJ1vHQv2vWkIxpkYMcVRzfILMKuiTlWOGDA03aOwrYRqYAIwUKyyLNpaWQmIgEi6vDrCFgNaCLzzxlrnp2QjV3EhcUxhghmp78pThRZeajYYqwTDVDHP7Myvq/TkxuZg6jXlY1RqvvuK1H2PK106vIYhg1cEkLX5ulAFJlTz7OEJkHBa36IxneESNz3MhQs6mZ7kJEbnbZf9TpRNaXYoBUsWKkG4qhtjjU/AUdrj27PQceRrparibsNIH1S14Y6d7dd+YzzDMuD+rWgCicbARoxgdE7rPY3+5woXFHlpEAcihNNrkaNZ9NkJmWcxqbrx2CAjhdLQiOLEXQGWucMqnSf8nraFyTFrEvAs43mAth7Av9l8fU2tejhryPuXjfUPCuCMhgaVNPKcqooCzDedscUgwACFyutfBE6J1v0QkzLGjYE9hA2xhd2Ubns0YgdgSFZ1WTFb8Sf+kADJ3VdiAzFWLiSMwEtUWlO0PSojPJFz9vb80aTfSwy4WTLLqW04eSyl6YO/sLSDQ9h6LMWI7LHDz1hmA+sAf07CtLRBcme8WX2PJVJVFZyyut0DlWvuTRw90fPRZ0UujLfpikZvZJvWIduRZwRyx2timXVgfi7AvZyP2vPuVdrLnj6dTLOioZAtwDfM80sKvOX35FO1ndS0clwaPvH7yRkeVEz2NFMk1GynZzd+mHFostd2sDU6WPEHthPWzBtCqpRhOiT+9TiCzP9ZVG3naaMa0QGKqKoLXhqfnltWBI7xGNT8kC7JtJ4SLFFUwq/hbkIkIYlK6sRxS56cCSn4KirWidEwUSa1ECqWsj+HD/WVs8E6KLcEyY5BAdloxT+JrhIaDtURBQvksQ7cbASQVv8xxNjP0IndbuyFUwpIa7wgcJBsutxkHMMGw+zWeVwUCiSFAnkPopYxjb/WTisv0OnR2MmxSkqJCSbuL/poEShJWQCYTzCBNEyaYR/sbRUoUA5vY4vLqDHaaxmxISDckqWKHSptYTSFuw1IcQZltL47l1I+1s90wkYrFylrc4ITLuLYqcwK0G8RA9bIqenKClKygi0zyHTu6hMJVMaE9UMmXFXGeaiVbAZpMB6uJLr1xiWljYiT9jqxeY2ZRVbPLcWUU427+XjfH2uYci5tawIWwrrAt2nu1Vtza4CcjeLQjIFuUFPdxJeFwbEREjsizNvaCkwdgx2ueGNa7Dvaspz9XA7ZhTX0dNqXzyz3sN1u41q6xoFCAc/UmmU+uQfn8Zb4LtONr2LdYxB8PpL2hO0xInVb9+jmJEqXtO4+JoaisLEV5ZDD05vRLJMfOw2eXRxVpDRc5CAN9kOX+yGXS4OAoICbdJKE8vmfR6dBjOKhcm9QBYILa7GmOIISFSCG1NnIjTy0ZTIVDllxBF1sCQt3GkkBBlJHEDN3fNwIkSC8mcq5BTq1iFcaDoiDwcsvlYj7B1Sbja2AIIUo+gURmNNTg8vb+SKvaC+ShagLZlJqbR5jpc2xUp8HZoiIKrIkGeSpNzWkfu0r5uV2FMYa8OblyBX+LkdOybcnWRh82ZMk9kY9oCFw64ggxb5Tjfwph4dipmz1I0IwuTtFZudHsBWHh47n3gEd7rCCKq7ZBz845M954lhjQjqTmZAc49EYF9rKdgRTXOybfzOtbEwiXtw/QcqsqCZlhX2bn2W6Fdz3kKZeyXsvI0JUIV9Qbyh0mPp68L7DqQLOk89n1t+gMqeF+H76WGTLZTi4UDmTBQkLfJooTVvR6zoWCcK6x5PfAgYJpt3s/AhgqGu4RhaK1r94YkUqwS+126v8DEi192wbNs/ahGcJUhp+qsCHxgu04iInFiYs896qIdhwsY0aCSFChQMXHzWxYpprARZxfb26nsvrv0aXCceF9zq+UsOGIg2Yb55arHp9p0b9ZRyA51CpoyCSC2Xakal+PIUadcQCPeK+pwsf36GkF3MejnnkzUyO6s/NhVwA4M3RG87nLOTZXig0vmpgmcMfeOINGMt65FjnmnHRtQcUO6W7MK2+vg8syqLWrx4qNGiipRhK0z5zFNTsMB65YCVkKJx2thErjczIlaox8b/xQ/QxM0l6mk3LVKTDn3iFn469ZPotsAvPaWaxTg10v0QHJOwzJ9FV9n9y0tY9lCNgYlHFKVIVkuXByVpA5MA3aAtns5GSnFpuhjCommUyYXzODUx4NF24dzlRE1X0We4TBXycwW9qwOaGAWVgRxS+rUBEzNniYSbPi6JQ45+F9p+KA0KsuWH80YMdWDwRVmVG5KhKrQb2CFLixSVXXINng4kwOHLTwLLoDImgHNCjjBzUnJaQhUz1WVln+ivhFo7oVL1zDKblMZxIIR1bxUZp9XZ3xuSlX+VGIHHFhaxcLatCaoUcte4xOYf25kSQ1/Emk8k2d1Lz5f+Vn8IQlrha2MzV/nbLZTV1HruBrqyJMO9/1NnDT/p66RlT5764dc8bcnyuo2bn2PzrFfUpTzIGaw2UOxXEkU2HOKfs02RentaOScw1qY7mqtqHWhXE+89kpjuZDZPNgsBkUywIoMmNvsYWDxS42gyVQLpdRe+BZEGiZoCLi2XW8cXKk5fm+WbIViMbM0JGZ+KNbFguBuRxEEymHWd5zs2uBiIoHigvIMMQ+wkW2C4Hq+huZJCsKNBLjBnI7NNyDgLgW1WoqRyZwYCXqoKIo6cgCaZMm1mxFzidxZjawH8rznEDooqKGGb4WIErErsQMEzwgC0rrRRQzQjHPYRaJTywDhsSYAZpkJV8PpzQm8edGN5GDKUzTirsqp+WIQIRzW3tJMQuTVOXOlc3WUIP3eCeammVuCkpT/V1WUCdT0irAGwnxIQ9xW9MSOGJFiSnmGYp8V6VvgTNeh8KZV6tTnP0dg2XUARYVmFwPyMPsbuRj+F35ummET+BpPizwiGsY2kpsLhlSIUxEKnmn9JpeohawI66bBf8wc1LIF/N5L9zJvi6pzvc0K8zVlrrtGNXGbmTgVupZMImNVahSZRTEIkyoYFWQ3tIG7Qolm5TstFHpEGDWrBSj1icC2shYhIALixXuPbmK6MP8dfAaGW1Y8vCz2UBlN4LKg5yiupLSEpDU0LAOgyNZK7CAt7GApZHMmpFrRLbuDaRB8sA+fde6c83JwqAI5em3UJbcISS2EosURDUO5nydZCObha2ehjjg1G4xdg57AA4yjof7iBo906Q+DpCZQZG7jVYNbqzqkwVkJW+kMUbD/CVzD5OumJhEJSfEix5zfjDaEyuPKUMXDLmoctrFLB4JNbii4gbs2AowrVTWsaFEgxoDEYzdZhtnFzsiCKp0Og+2Q5npjYqKXLU255y+Ku3d0+JVvTjZ6qx1RvJcTRFeC3opxI4zNn/3WlGtSKZi07ejA09kWfNye2mCYzG9qrCwUKFKpDI5DHrXnz4CC6IpFLB4TWxHPl7gzUhQVc1Wx3ZM4ST8jZ3Ua7HXdlZvY4KrHSMvpni43gaAVBTTKCxAxSy+KgCsjYUqQVmj3RopeCWz+TMbtEwoPx3SHbrQn7ou7exjO4RunMmS6Eiio4rk0O82aYj4uEEIP9xP0Ap5NXLSojepeg+pnU/6+1nY+hRKN3ceYrLjiUMwSRqg9fhT8dBQEemtO+MEkc6X3kjQHQJiHfAHKYal7MagstfDZCz93FlXobsP7OAJzfUVG35OyAM4UPpgZbVD0nYlso4hso7JxPjqTZ3tsUAkNxQj/VyoeKMJIVBgOeJgDRuCVIeKiypnLVDdpUxOYmK7CmilqeVNi7yCtm//NxULGnOpXC9yyGue+CnboJPkV80QcJwBnsLZs6xRxadeFSpZ1fhEyA8qVDc3DreiYyBH6AfHNeAVHW6uwinGJ7XZ+ixSXYW9LzdkqQAvtBSO+Kz4nCVMZHimK0l2MAUVjSn8lSWXigKDJqKfXe7BhAZDCd9M16imS6gx/RU10tpChbOgmijpdN6mIqM9yJJNvbTFF9sNweCvVTcVHhuCk8qKKoXgsARGBvaabRw0q44MSF5skugiyG2fTD5KOkyRmibY0a4uRLIwOwX/iFN20jWojpmj/xKHvCKMnW3EcD5+6/EdFel+MmUx1f8FRIu1vZzgjrJNZZBHI5Rx9zbEZ+GjVLONjkSMopf8S2rTlpWXzTU28B3Bn+bsqcvBEGQrvJBAOrmVCn0DD6KQod3BzmWSqbOcYQvJmJhof3nmlBjUBbs5jzdIWIVyCzq3nkgCL6jsiHT/NaJhwoXlXqo6A5MGSYiWFIsH3bPbeadbVE5LYwEpRNR1ZZw2qRfQ4rH8J6NvpZXIFjM1m9pI0eBZotxAmpo9zYwV5syIXdZAJZxlTJ/BlTY7j4jseASHW5xU7WszKWvkWSOd5DxlrfSEiBOjF65RGytJijyVVTDiWqmmUo5YHd0Zu7XkmRjr6jjKjn1M69+exMmwMVxrn33ebOer4jagUTURSsGpoQQ6QQ8q0laub4Oc+/zWLu5ZXytyQABDZVUx6UamT5rmzqStcspeKF63ckr1jBuIzBR1Wh4E5oXDkmxavYow0PY40uMHCToiFG4IwN5LpFxoQ8Ez/Hfp71cDGoZIR2QTP8AqjXAQdQYuNmZxGlbSe/JR3B4noCaicttfpHKba01gUnN+LT5kNbMjY36QyRJSrJI9+9mhkMcBJE7mpJQbI++QxwlbigDl9DQjR+w2Sxw0W5qXPSaUm6KV4UZ1fD54pMrCn/nPXOsXVea+o0x1AzfyRiGzcw7+pP8Zs9iNgGpOmwUwJ8xpSszIjq//432PU1Clua/v/9CnMy2OZf/Efiox4FjAUkXrQJWCsvZ7+BTXiEYgTzTrQpFF2RVe3SGB9+LWPraoScfkOIiyPfE4G6i/wublCoCkWJtmrGdOBoz6PczOiT9vxKxJWv7YTdgXyfRTCF6hZzpxSQfBrq6HmUtRoyy12I7ZadTOv1Ahf4ZPqK4BZwhC0Uol6jC5UpxHJN6EvnlTG0zI+FOIILNGLRYFhrBvOMIyHQxgMqWN8CU5/TjP5YeWP5M5vZH8oMVkiY0wTScy6naQup628AJaROwvtrHVNIiRs71EeUuR7Jj2NEUT9L5JNXzlxDEmFhvdDBw4So1QGBxSnVW9S1ujEjGZGfzorNQRQsmOCFX4+GMJc1J0qApdU3RYqNKYZsLjF5Azb+aZG70HdLIWTKtjYE+sORbe5GguipZ25QQ7NlJiTyFf6XTYa1cL2ClElx58Ry7uJFDhCBoaVkngm4opZgfyU3XteL/DQIhsPkX1QGDXTQeq5EKeWOfXs9iI4XBiZLDbTlhif7GFK+sjNH0hILuhAyJXrbUkVWcZokbFcy3Q66lHmukuiSjbH/pYFBhDcqxkwFjYHYgdbLqk9JGI/BUQISOGz90ge5YkcUiNKrpXvm/VLYDO7MmfiTz+ktapFXY2xQEoyU8M3R7XLg5yLEYe6BQqFlh+oFawSfaaUA5o8JTDdUtLIX8QrRLbaNC5ykTS3uC7I+QMCjTmz4bpHLBtqKj5EzFwbrGL0C8wftpivcTnG0wJGzuhsGe3qqjRx37vWLFAYxuJ/TfRKJq2Oh+fYX+kEZtU9WvHRhrmWs09SZ9KM3CDyXF/Ep0LvoHXVONEjLbxbzRpr5ZWOQd1PEBcCvxr5SOfY0Ws6FNOZdWdcjHUQrvGYEZT17O2tk282qHjGQEsmwYHzTbY+wzIbD7FAq8PdQpXx9DR6lx2aInM+ZtG8MSM4jMfNvUySKlXQhBDjOfVmsZSPyatjETOLIbLaHWFSGZlhSTPGUOOAFH2IFgXHwv7+1W6lXDyaRtlVjsSpLXNICblHCeySigiziAgEnSjlLonbXZ2HGAEgQwx+4/CWihmacV9QZzTAyHnJZkSmD88YeljD2XJRdqShFjYMYWc/cW+OIqIWFCDvcW2sNj4RzJyTrM1JO4U6GU2AW5KWFeJenVn6Eb1wj2yGWOCN2nLq8ym3ex0aQOzXa0R+5/XVSCP/MbC0WFbtpWgpeq1sOl+U5Y4my3vCTU9hb3TxThV56aysY91hex9N1Yc8kjE72hxOUK2sxZGqV8gC6NyYpGV8MzDNjvXc9I1YzoIVNEjSCthoV+x2GanA8BOEe3FYntpj7DuAMHHt2sTm0NKxr1HEANnFisEvuIEbWmdCxmle7G5k7yfNGhHHSaddVNa5ThFr4p0QnUw7bo9IeGBVV5iLj6EpZBIJsr2G2gUoXZMgpVLyhoOuYc4zxWD1Ri7eyshXwMZPiv0BKknYroQ3btjRyTPov3sqHG1LpOLMJOE1TUilcgSlStMDyJeke3sBTl5rxhTsPx9A5xBKJzF30AFBJFFhSk+EZmkKRioQqIgegERKuzE8y5xoegfsgtWzQIHy+3+w2QNlnAoeh4e1i6wBeVsZGHy5uSesrooHsyJooCaODZAmJRCNT8bBIdyrunwC2onSnaSy2CphxW3Q7H5y6+rFUuVeNgx4l6BXfW0HV7ozwhy2B0vOJuZJ8gsshQqVje+QZ3B2Kl/aixi1fxcc6QQFcp5tnhl5x4pAoqU2JGLIkAy1WgGetcdvfBIS2GOc0VaLStdqdq9UO2YOEUnSdiLtQI6jABvnRnibc8sV1iEJkWgy6Nd3qCymE3P0nMKq8WfkyKL5nVY6qjyRpqZLXZdtPdVoIBAIteFNdqeetdbQFD2dCLZHxjWMFIt+aGvnlT/krBLcJkWiaXDMvZYXCOyXSEda04Sh9z/4uCmP8r7KOYje+LVKaANmYdp+MiDWcR7nB/1pzLqXO+x/wXdBxIyBJj6jYD6SUUkNVbP6k/KXn7OBCqpxMw/v/+zIE75SeUvKYQC1quuGjKakTuUlRLr9e+JXWIKC/YAJ2gSREzjfrONFTUOsVCmPVU86lMzeWfhjjG6/mseCbSZw2svFpVA7gZHIQAmyhQTowAZFlSFE9kTVYxVZsCs022FvsfSpy0jeSviyDGM8mhOQy2mdySMx73ec0cQIaiTJlVoc7VNe6wLYK+BjWBlB5BUIKZnCOg8MWkqxkLwFfJFq7y8oUlyzm0xGkLqOMn7wO1W2ETEsXvDPYRVhLojVtv02pxRgZvQKA4yOkTLHAdN/LB9PX0PDnuLLewulmiZ3evL8ATY0uMubeeUWSg5rrVb2ynLD/N11cOH4dMPFLrfF+uiYepn85EYzFEgeCUbJ6cGSo0BRw0/SkF0ELbH1JmMPV2HCkt10gSQ0/Jn3W1nw0NQ2kaWnX5gwcQCG1i2WDISn5JF0hvVSJ6xTtXLLOXUbh+KBwkZYuFZlDADWcXxUB1pXk+2Sgytmu6DGirUHLTTezhZhliReo8y7Wqoypii/vBYtoNtZAaJ0QaL0YYPX+luVUYE9e3/rtYJ6cOkVCCw6QnWTlNjlD6MtZPNjJArM0XyhGnFz5anHhFJaaxjZIiBXsCKqvitDWzk/XKFS1AVm83ZnGUa3MgmXBsW08hpr2bt82AzbASS5BUOZpxRIzx6VkEZi8wjXSYe8/dPWR4r7gebqDg26imIed4YyHSYCtaBZSDohLKc2oYsWJOnJI/2J0cLtTQ/2IyCkbk+q9fnRwsX73eMTCjTDuXzYX+m2NgKK6N0V6V1IWe4yJFJBBCowcFiG1fWx4KkChUelzPt9cg4A3DsMyZHb4PdjrVGjUx3Afm0bmmXsK1yaWtXHv50ZUTqpA66S/k4nKPr1ecuqbi9PZHhpfhRmYSqMY4iHZdAlrpsBJYkKIxDD14znk0alGryyCrdUq5UqpL26clZO1haOTjNwhVsSJQppMQgnMYCarbjtPqHVkk+KHChCeDhFM9sQociSAgjWLRepIJ/aBPK2SLJVo+suApYTr5KDQgHyx0ngvN09P7TiMHoNClqld9RV6GzzrWubIo8hnmd6kxUQn7mJqZNQohu0JJHpvioRubeIEOeRzb901gtPx6rIf4P5UaQ0VJMFrOO0t+9b72wnYorgxSdjUz227zibSome+49P1VQzv3MRjsMlef5tHcIs5dWqb/0YLkSKCE5TnHgXrUYUM7jAIJOgSUWmHbzeeYode1QsIsuEY9ilrPPnnU0PUrRKNnbRIa4ueFnJYwqkRLMvlZcmGGvIokClpHVpVdqMfjeWSPmVBtDQRJSG0y02VMRQBlWoNoksmVKKh2Yhb1N1j1M+ffIysVSyblo25QuchvHKImDya5obH7E1Av0SBREZOyX9gPTs3+OrEUzSh2aW2sxMrYoYLfZSje11tlwqoplwVObN7In6KnARKqt8IraX928DtO8mi8gZ+Ly1O88364Vr1DFYhJt7IkYaURkVgPHFD/POhIcS6ArSHTEfcRsMJ3ODLOGnnWuh/1MakRHGhMC1kZKlRwH72dWRZZjAkwrqDT2ihEtaQABAABJREFUNhoJmbKdqXSq41IQPLtgFn6wwmrnnZblOE7cc9HexxMYbfLgPzdQ7HsjmernVIxRvMKVjYBXfC2VccAELVzjAOwvVlhQQFu8HlbkPrWfDJ1cZs+SpQVyAuRW3mOlJZRKu1Xm+avbnnOqbbJic+8ACDrrJYkStb0u2x6NcF7k0KRRgt2fkGF0RKa7gwzCEyDdDMuTcDspgCTu1AssBRWS+M/Cfkca26NcAJAzdDKjAxEdKVZ/knNxNiKdtNl74gTdTudZwWGkRCultmpIFyTj2HPo52ROCZINLLVtWQGGoNpCVHCrIxjLsMASmg9NHnnR2EeqauobALm4SN8JBO6UtcuLk+Up3cAMMNBUBPGotco5qU22/2sCNiN8LFj4NTtjra/jCf8m7GBkg2tOkdMwdW94n+eNWg7HRiujIsuZSY7sZCvwzMRDezfySBZFTcWP2kjDfkYzPpupe3mOTuQ0Z3hfuOwDZ8mzygmM+hgsbicssQpNSnZl2y1k2xn0hNZQB6r85/mIIcfEss2vKIVCxJiDf3jSBkxph6X0HlgvBHknTPsB5Y4SG++76pazSveDCCiC1J9VSaB6PEWcNWbleI2xSKl4MvhGVDwsfgCrFj+pqsKG64KlVUFUmcRKkTl8cCRhQMZClqERDroVpPG+oqJL1SQ5oolesBJFW0dGRGbsooY4ZMFGfsHSpqFS11iqhsvFLnU+OGK7WWBJIVtnGNXT/dTpYc4pfyxelCvaAJoCm4ydbuzPqWyixcne4mptctoEYW9wFCSxoXNSnEpGLPQbRmRIxuLp8RMsZ98qvIlHTidjECbRHSELOpp4f1SJ1B2zg9lkOWVTGrHvueAk59oUUB+H7V8VHMoEuwnGgOsoATm5A2IGXnSiSXm3PZulmt8qqxv51sOROGN2rvmUxmKUxWHubc1oya1xYlI4Wl10sftMlb+3+7pFaLDdLHG13XSCQUV7zRt6IGETL/QuUj+RW6U2uIhC7gTkZk5nm4sxS7jyyHZA37MOhBvWY6VrY9Viz7oxUu3bpFnrhYqd2ktnFWT9GgQYSbKGc9LgwBxgh+onP0fLPCBIxHfWJixg1YUszP9qQSPQYAkgMhMPrlKlUyqU8EcwCeCBSvArD9t6U9PdhUDBzFCyMITNRs3wol41M4EV3ZLAcYjndChxaTzBRa5FbuM54GB2sCME7C620AjSlXtW4fGNt1h0R6huoyr4KSKgaXXyDPBLde5vqWS12NSR2fZoy9m0a9n440+DS5307kuxlsMRYI+6R6fXdxTqe4cHIP+8hixFZRwjhWFSyKYyJpzNvmbD/Hh1FnMjnL3ipsa6Jwcsxo7+wIaU2XRO/3k1WQcOwIpqBffIc8kmF0ONR06pI6nqFE4jLrCnURUNbIuU7osbBOw0W2AcujNpmceTsmKkTVuxVrRoGwYCK4XdMpJc1sgs2HnpcDucvJmE2Fra6oaiSC6wnFNiWfBshNIfsafN5sG3GmlnyRnpAw7lDgJyJI3x+xvEPZsm9lA86Nb84NUTrRBiFcJAsHAS/bUpqIcduhPBwCRk0FIvoWBKVkNSucXaIy8jC6Xwg3Q3vZ+pd9/DLOlRUqg3xDtKhoEGQgxuDLY2L5kzWQj0qKRPsApg9Oo2EAP7zbbWN1Ry4EkMakZTAUjCKCbS5Wa2Dr3FJk4sHF4iGiqs83gDjHZyonBtJ6F68vYsao7IjjCSx+DEFI+JsIZQpa4pEYrWv/yc5oxHLIKYJ8RnLlmPjR/bgp0kDryWxFihKI6dxK2boJixT6Q2jv38mBw29UQ9GsmSKL+WElGOlEGJJjts7CQkFhwIcYKLY8l/DlejGB1VPiOu2VMrv8zz+Y9/HxcptN6z1q11PpseVLL2GLLNnv8k82TywTJtchR0umx6nsUmQywwwLJTzOZhkFNoUnNn5h5yN/wkjpoBIPJ1cgFtyYNkQHtCsGfuORLjZgFPsJnDqsOcVqVoMmgIWEi+/2BDkO86STNIthFY5eEScTmzYQlu0LmJJaCCdbJS/6JSQ0OmIgnBRLLJqaxezupQPeQS1VO+cVipK+3pQVIF5WyFFS9auRbIVtN24TKgCwBEAauwcHnv8ueEPqugti1MnZCq/u1a233q9CZOu24UrfP1yv5XSVtzW72nPBWT1w4z7PRqO1h+fpWUQuVqcE7JXCkYuNLqdj+nkeLKtY3ZAo95FkDIK2jQj08sZY4nyINjlMA59+PYGKlI2JtIH/SspV63i6FttR7MJtulyTGV0KS1Von72NiCHSZ/zbpJNm56hDBIzvOsPOVekBDn98lk0gDFyBXGNi7UbWX30Jzyt0MDsWqrgDax5BvkPCk9GcnUyl6MB3kqd2yhqmtLpA6tbFxlRRFD+v3J8yBLKyiRu9YpOr9ImoU0qbMtpfLnxQUJVr8+Eqm6ZHHJ0unAoiAZOgByc9XrBmVZBFNZtTHcaa6tPuxZhoqKUQswip9LsuWlLXbyrRJMhrN8WNlCE+xiXHMXkbD2wUT5jYuMyF10yzDOwMBigFqgJrIj9X4Z46I1rp3wK8jeudYvj5w3JZSzJ2RPtT67CzHCMqA57ftTith46ppYut6ckUJlw/94ef50g9Y/qsQvT+VEnEZAOEevMRf9OzvlsHJ/+2JOmk+58nJCmOe34IfNq9ZNwf+5DIfJEQyhTJvjuQkZtcRD/Z0LatD4EUIVe7AIx2Hv5TpGPGLLyVH7AjGqu5IX3ibXTUsgJNKNfDb4ZhYWcxZCd+4PreUhh0tbJdcsoeSuU1QI19mNoV3oBCkyXW3W3+ve5OTAcfLvIWvHgRQRyrSmviIjLerL6kDP3kWWzphaKpLrz8TmeE8KJJGpiqYPg1JZDcVh1uEGEueoygPxAUdT5ERmLEPTFQBsa2XZ9C9bkmOnWDapd2wgMmMCIRqLGR5b1Eey2seEhbVTINey4msLhneCcqyKowAbk6NeS5+rAmdGxJXVz8n5HXIMQBM2zeLEW7F/eSf9QlA5zJrlSUcugE6XRj8Tvogvxji6yfOYpqBmq6z8nAKjaoA7Vq8whiEuOgFCEIhYF26SY1EsBKIj5EQ6TcFltShGNIiaGNN9xjP4Rgmc1T3idFFIr1nMmqcgT+DLEBBCwAaxX6tZK/KtrF2ui6qjLGb0KbsmD3uJdKcunbWZwYFUWGvhzpHMmAH7K4V0srE8IIZ5ELSTRpCLLnoefg+6jpxwPFgY5b5GbDosqisluuqO+CXN+6VNXQgcOcUBSz++VT0PvsO0yecWNul91E3aE8HNBuAkfxeVgTdDzKIQ8JF9lwwtzpCWezGiYNNw6nz+YistYAl+HSrbMRJEnDZ+YoNI5kJ5TkxihtUzABYLLJvGWeicB5Uwa9ZKVjUvNg6PYFdrYxY0OW8DdHzjBSlu4ndNtYrHvMzD1wYvlGfGKYidbg2NtcxtJ0NuuoWtiupWsqnYZSModBPdrBLc2bhr4xu33S5dBeZn+N0X+4wYX36F4jfWbp/738cKWTv75dHRESlolbx7WGiiqBqMxEUR4Cn9bdLenGvhRp7XRg4mKGuKlVGsNw6B2yssvdRAMkUg2WJJfA7LsMCCAo7btt9YxalV2MGUbojKUlgh0l1kZel9Z7lHkD1592h4sJn/k7J1k+rAihG1fvlmvCIj3XOvggU/gGoR29Bi1CROFYAcNaVQ+r0i/lAtXotC0KdM7IKLz7lASN8fxYmO2DXlp82WytlZZNbneNbjB1vJcOT8fsg2PnQ8pLQCEotoIB7ab2aBsAuntGoGKI0CCUVlygaQWgHW3lfZTkoyRsoPzYICltSFZFDayNjpdnDGOhbdAoxvIN5i5KTNFadc610mmmwG1pLa5raxvZP/7ES42iJZVORQJ9NRJXatUBkKj+QxdmBDUq1cKSrsz7Ksfw8zi0rCW+3kV4189cAz5rPmkbl2dVJANJsFQCPpjmOQpjkiQeXMMGCgMjbWdvXys64EW6T5/xm8NWLL9d5zxQFDI5RHr+tT61h5Gnt7PX1YUEkgVXN388sokBabqVMyi7TX7p+GAhoQIreqfRsRO3W9mNcWyHW2YxtBcCUlykrWcQsRSkPU2KcBisMjjTBPdPdEdytYbuJsBOOihzvg7Hng0Qh8semnFbbL4jZwqaqswogUo2G4qpFFB4Aq+c7FjSHaPCQuso1yFm6BVOXQSD43G7OaeT1KvS/fCOuFSRv9ZLEitQ3a1OhlQnNlEbH0KTnckjAJ4lIZoA5qhrDIfSZiACH2FZV0LxRtZfPZ1Ch/kycjaw2bEeRyo+4BzD3x2k26NjdmdtuutSCfAo878mBzhUdATgxxIfjzcK02otZ8PXkxrt7mXeHIu3wFx5fOFW7CnEhol8YquwRDMyJQNfZ4TANAlY7B2GulkZhiW6B5M9LiOWGxXhSxv3oEYOexntaEa5oMG3BV0V8UIxunE0OVMVyBi67xArzRwURBxc6bTHY9cCVpVH9LQyFF3g4naLICbKo4WyqKoNLUKex2FgqXDuKsijqZ+qgO/SCNDnaKEH/uXrFQK4cN5a6yicIlMTYo0UqCUEve/WWrtP6KRB3lHKTAg+Bw29jZ96DFn7q9IgllVBCc5O05VOO5W0/6JCFYzzzgcIcNV44ghgdaqPmjiFv0lWDQ2c5kU5TkiY6MHYS191WKEOGkWKXGinYPZAogFeOT4bUUNQprx8VpRFPVzXHkdEVji0etqPMsWpXwHjvvrrU7h9MHOSf6WVanSgQyjSjnK7eNw+/WxL8iItm4BCyXnYxyuCoosxkGY7qNmquhNg4xyXxjyN3ytFk5ohglNjn2zzm0O6/I9ah5YxyIIkuC/HRNNoo1aedyY7Nr98vYfWTvdRlXPJEhMVlEe06AEetnrdtQvE8q9GPF2qhJpYwSyU6pjb4VFr0NHAWFV6UPsrEEFqdek9rKUOs2s2EUGFKeNPOTWMXZmLflmIiNQF3a/DjtYeSe7MHydUmCoX5JJSeA65ZLI7HWDka5XpaFxEIiGJmMtT2Xsd0LDmS6A1qlmdvSUmxADiWtjPZMTgSmYraadQc2hbNvFyXAgrgERksgpv+idUTi60lkTZNuC1p7iGg9DR0M9XGQUOwrMW3+HTJ9cpE0sTa0sgQ6sLaHVgWasyh5zqnQ82GTlzFesS7RFIp2rB1tT1QSomJ+31Dw8VgbeKR97W46zCqeuIZ2HW2rG3EZ9aMuMvoA75rXkhbnOCXYOxFKHUiFJ+8Ck0wHhgyR0c0JIGfWnnQvuk09ZvWrpeLNHjWZ1rh3r7PZeAtHEPL8lEDV18e1MYwl/BVpc1zkNVR1K7VCoJZUaTsLtRGcN/t32t85x0LMsgU0Tp2alTbLnLjFvhEAbIWmuy+ChtuQPXySdHvZU+hwms/dYykWlPq2zFrIwU7pT8ng2qjUfMnTJtnRiNjnymYKVU9fEhdMjodf5TFKi6NwMZAsWtl26sjt6ktrZ2ARxJMuDFdc7OwZ+SBO5tCWgyl4BGlSEfrYSHWImFx1ySN6OLYNe9NLuSRpzSKj7BwE+/Ohcqv1682bQBxyqSWQBJz/jRz9W84fPR42VwgD9VP+FBZVAWkw09oz0iGoMc073Uis/l3hv59jG6v9eQijufK1joYM4QjOcDsQudeLrPBuRMRGEz+DRgA1p7b3mShRa5dUYCIzfvFa0/b72Zszz/kM59wrc8YSFceI7ZKcjkBIBv4z7/6r/XeewbFQau2KIJQrggtyMePm3q8847ECSKLKyEJmkaQVTD5Gsd6FlGt7g6A6Ch6siU3SoBr1kjkZcz6EJZqe49xiNQ2Hu65Sn/IHlVArHE5Udzhx0RmjXtNF+nAACTWSOgEqEjENK9cS9py7N9vhHamL+pYFW34+yROxksjkdhHpNjoLEZ3V0ZTVJxUnawixoYKfpNF60DKHyBoWYeAR0lDizexYjBoyNIJUt4d0rJJRplIGEdVSzYZWUc/6hxRmcJ5DBRAayg9nsAANdiyqFeW9d7KqUd2mgCtzT13eSTYx+KcALY74iR1sLY2Ry2x2vBHh8UhmgMejdy1BNXeCACCp31MB/4yr6R33BJF7wleWNrvByD+v2SlrVkHUXR3spDR6G/9UfLSFJ00J+WpdpanPs3Z/UK2Yte4XkU8/dHFsoqAtAlzIkyNsHc8jEMmQno5HjTpZAWjYs9XaEcdUXogJNiIpYg1BkVrVzJ88Yal1BlA6EDWB8sGHhFgQHkhN0ly1PVH2dWUGLxV6HNMFJh3Ik4TZgjWTUx/FPpDccFQUFxYxzqTzcoYWgW7vlwm1Kp8IVMCHrB2w6AKnhohp+xOZzZKxKBT/rHvPqjUztFzZ7ODyBdIAzikXU4ZWkapAJNI3Qyeo46K1ojcPEcoAPTca3Ae5RWKDNrJVj2mgMBmvJeegIk0KzLN8pcwXMYvSKqxbn/n3bjhiza2YY1mKMDtCEyhV82QAiNvAockZ61zh1qxoWDOfLRjojm3Nipi8zAGqnOR5JtJ4TOBk2/LVIsL46E87y56CuXgJf+RxGwyDocqLrIT2jFoyrTfau/cchwhXKI+oEPrmZknMsYbWQoKmArSq72mko+NFZKMSD+1aI73ns5JYSZPQHJRdNEdzgdo9ZLo97BRJjJGQMhPu47nPAKAFsAFjKUiL0iLOrNdyGE2AvjGlYDoLwGWonXt4hq/tVlY+sutTXYzIXH4eNPItyfefMmBYoYPl+MHjAJWFvTdCsbRGwR0AsMiS+pyClBc1gxY0FQ3VEJdqzi/SBZmFh35AN+Y/S0UCWYkDq1kLSNsqyImYldY8eUtLJ0NO+hNfyzKZidJNxUWmba4kh5m+FAhG5txeoy6fYPjWllowAweLJW5ansOjd850RMDhg3eUn+n6kImenRJQORZZmjhhzSG4jVn1ig11alMeswpWZseFl3oylqr0SltwClXcEBZig4kOg1d0Ff5wG05kZ64jE8Ta+57CJpMRwtEESZLM55eK+/59hJpS33sdjp6kdnKXRe5cl0IhJhQWWB75OaNamdpzJU7H6j4YoyvK9zg285ezZ6dYLoq8movHFG9cCcAiE2xVc9+QBxhTnx9XZAkkjE+M0OvOLyx3ca7ZxrV2DYTuXiIO3VoJ81pt6I89UFFG02s32FAsy+KClHZI/lyZzAeWoTqp1Z2VA8U18K4p0L0lkVzLdmRAuavO+odFw1CQmgMPauUTdEW3IWWd5K9Z6KqK/P/PWe1v05/0jZEtM6qaIZOwqGhE/dcqTrvoGCTCUzk6KHJ5PJ9kGh7VxTSF55llBwAq2lHbH3XOgYQ6aCRCdwHWcQMAOLdY4ZE753Hzch+rZlksIMyVdK9ai/8UpyPUQCNmHjwnTnTMOshjYULGeuXNPcl57zQF5akIE9mCiDxXgnNK9NT67AggC6pg0U52Pg+zWbr5ATO6GaM6hJFRicdnqPmePTeHR0akEacHV1rl1d8vW88Tsbe1zZOd1npR1FTCh1Cxj8p7gEdgUTxi/2NPoGotYpVxkUuLnBJ4WpytJ2Ss2Vhr61DRFSP46H090qV+Yby0vY8zi23cdXwVH75+Px7cHIGowbJZaOu2XMNFJD0MfIgKzQDrFnsBuBMZEALmJnm1xBoMwKACZT4nSjSn/7Fu8BiROHnPhhWpkuEKjLheBotdBgQVQ4HeBUA6tS7NdljMZ0S2cY4mZKMuJAE6LOekEnNIbKAMwgeZSX0y1zFbJ0jeHGImajN7UgVKNsRIdCIoq/mJSMMkUr7zINzT1WG/ayr0MEdK9UbTFzgn3KKNG5xr9vDo3fO4eXsf22GBAQVMlRk2kWFYO0SxKQHenDhWb3Y4N0+9xhqYand7pxIe29wdr7JtU9tAnprozG2VnoJrP4koNuhlr0BJJ3+F6ixPylL/4F2DsVm6pyOYU1zZsJixOOHJDApTNHGFYVDETI8Q6GiEYuiGP6luMSkdAjudC69zRRUth9e9qRXNErFcCyoiFRJWFmlV3cDU6EQWwsUJGK6YUBW0nrPAXXdYcfK1Vz/brSMztsISt+2ex83bB7jv+Co+fHgFD2yuIzSEQIsh100MxIdRC6VDptz85e/Mo8f+QBVZpdIWOlfOgnYypMEUBJUi7E1Hh0i1+3O3ukIvFHHzasjrgJYGQb7tbUDh+5W5PnXMlU2TDEJeFgBgr32u0/lYqwsK3wib4IGisJSiDoJB9PrM42HjrakuC8y07YKQhwLl8lO3qYGQ3YxBACST/FhhhC0TvbsZAlq0WMcN9pst3LZzCbesznb+V2JEREdMIvwDsjHDXqogTSJUTwP24Qo7fkp5fZp5uQvycRL8PEyvFba5G4SZf6vCxv5O49OmGXNomnFyHA1nqnARavNmKyxERYMwCt8pMK/12T2cDsQYhIZrUbW1tn9lE6meVj3I0WkDbsYKWtMN4hnhPtXT1lTRWLl3RrtetcTGkcAqGoFbwQEUkSMe5DlxwfKQwhpfTlRZXuV6NbigImMrNLh15xwurw7w0etX8KHrD+JqXKMJjTiwdSNSgrZ3l50kFnN/djIJBCiI7Z/JvcwmIgoWzJB9wCNdWpGnoMXNQ4SEGPKTzRfIokCHX5hhcIr9C51tAG2vhCAlyqbKwroG9TRH84pJO9pNM2EyT0u8sOGFx/7CUBELyVbkoTC4OiFKK7aljgHKq58RwKTGBKoqF6d7EsoKFjnO+fPTJ4Qo6I/ruEaDBk/YvYxH75zBNhowR7QckzUkTND63A2+psoemU+rU4Vph8nTSRhLEazNaysdgdPYrsjZJFNlbSpuKVrz5r1u0FAFCmR5/+rUbnjuU+S3IvtgTCRHDuvCxog6p06uzJdl2xsjiYg0NeuviUUrbeLidG5dHd78eiz8yY6gPGudo7fgOTPtCS98IbqbgbwO3r1YKc7HugPs8C7Ivucajc/RmqDm2KitIyMCQesmqj25JWG0PLnq3jAh9BtU7P2DDREevXcBl1YH+MDh/bjz6CG0xGjESDnN4kUXeoAHDSRV5S8c9q1A0vXdf262643U5i6LJIutJwVkYTJR2nDCcai88hTM4Zo9TLXBDoMdG50tUryuI6msCwb3WQCUITW5ZSCyg1PVQ8YmI2cyJm6Qc1uGDOg/3SOB5GHaPMwSOOFV88NYomxxwMhBlD6VkeETjv87U5lYEJ50OM9gG2RwKi5iX2m2vEHLjEvLfTx+9wLOLXcQmdHGVlhjdF7ApJXJaf9SRc09lps+JnKyrHRvcRpNEKy4CKoZBQaSgt42SBXePU8lwzmEM65saGnhdgh1xfy+ECI5Hl05u3X53CNY4xGFPmYkIVJtLi9at+okWEnCUyAv8/WoWAjHTsY0oj+YVPzbe8PGPpvRjzvmKgRSTnZGpYOk9TgiaKo2ehixIFbpe5bWN0X0HCkqYGyso/eZ1QIJp4lr6R39ebndDwdWqxJXHbfFsB4H0b2NHLFqlnjywc24sL2H9x3ejysn19E0ASGd2kXBK7oJEhWfML9sdQRihyAWwjhpa4fWjbEGDUJl+g2dakvpC2ofG/YpkUkoRhgCLFfcB6RP+gS1BylaJctuFhkXgkDMifHywp7neRqmrmE1NrBGzq4tTrNoY1K26LEh+KlTEvuwbaeycvn+RCro0GEzll0k2VFgLSzpPqSo5jQE4IRPEEB40t4l3LZzHg2oP/EDFBpRzIzPnN0NdMIiNTcshw2VjidgQbX241T7eyzOdA6hcIreN2rLE/N1rsz+JwONrI1HbI40wiLwFuc5BLfquOUGriGc0yMq7WGyGhqiSTdBLSQo4biJqrwBrmgWFBXUiS2eGrEUtj8i9+Rf3UQrP2ssc8BNd6y16mvchYngJva+327U8JNBXcuhpGfatUDC0yqf19Qz7hcBE60/mXFCSF3SS1v7OLfcxR1X78Md1+8HB6TQNKWd6k/u0vImO7n5GsNstJItQNB6OCky7COLUQKGJGcmNQWSbkw6RjQkLn/+pPbHmiYjf1CkIEIuNEwDe2UcQEIPDa95wYrpRKLwod7CYKC5nNvoxFSGE6R2lVwUOeELrQgnfSgkKiFR3SRvZ+/HZ7PpE8nEwcwKKFTZSiwQdf5AcpHYUijrN3PXhRPtKtlPmHHCG+w2W3ja/i24sNxF5A55EexHRKxejqc6H4sJPY0ff2yBROXUapP/VFRybZFyfv9YS1wu+FF6/SstUJ7IQrfJajU3gKf6lx0Jb2au8siNKIo9jKzXBq+o+amSWkjOaXPOZ21nrB7vnmxcrFcAUhk45Z2uvZO1mmXK3znn/ciNa2QEVetEFahfr8AYoVpiqiuhBM0okdjWtmU7MvY1Vk726veHoO5prugkxkZSXrRwxtyW+OJBOF0rXj0RZq5jSdvVUHFZmOsjDdvUn+hbjmgo4Pb9SzhYbuM9V+/Bcdxg2QTluMpz7fz8BiKFp6YhJZYFkl0ZxXqmjITlmAhfNpqzpE8X0ICCjGgFqtTvPyJCfhAB5C60GLSzCRoSmg3ynEuD9xA2vMiC/WTy7Eh1xkpZxxXepW24Wh4f6QkKmTCGmnqvTNYpSmOGd/ofP0tlyAwp2B8UN1rafSj5R3NEZX6/R3GDm7b28RlnbsOF5S7aPubSPzVTFUgyd3Z+OqwpZln0an5sV119itChwkY2w9qImZYmpfqfEZ1q5/6eba8myHKxwWNJaR/nZ4SxoKNTfM5z8hi4ElhDcwV7NsdBtuc9NPWM90M3kDg55XjxbI7MXCVl8tSoY/xQOxksNYfzPye/ASOuAPJ0DpZZMAdH7RZb06tK9ZpjQgSZnASMlhm3rM7gU84+EgfNEsdx021cYt6du7diDKoOfixQ7TJN1AkJEodaqbMnhXTXvBkQCcaNEcWbjbfISIDe+L1t0D5LbPa+6WeUnQeSuhFAsvwxyzhlpeZP1HrihOZl8fWhyxasAjFIM2wH7I1Su+eqKCp8ZOhDiJIQT6keuw8pitZ/beGyCn7ZUmHiUjrOpOY/KQBjyJgmxkls8aidC3jy3k1YUMAmtl20T8WOVqAqKtGmczLQ7ULlkdBcOpoJQaEa4MeLsq0l+ZmT2RjC1RMOUsUaFWsxtp633c7yJZp3LB/d4HU9gd3Qmi5IfEZHYW1fYwp+eL59G541ck1HrMd5I5Z6ENPZsCr/aDMEKiJJVEiCwQEfFUJFR+NhizPVlK1QI737xnIL+BTFAka6W1YQysO1ksWkBSxJJoE97XuhT7KzNGcNkF/nRVXHTmAdaiML+Tw7uhWqdCDJE6hJgTTzaICSniKX9xGhyy0YOr+hz1PZMGN/ucIzzj0a77zyMdy1voplWKa1e3AfFB0Wdkh+vWJ7KDAodQSo7xTI8QBAIXenKeYEW1K0vgE0J1NAteYrU2u7vZJS2pHcUyCAeVCpb93fRRmXKPQFolNAUejVRB+bWHB6ul8dyhpOzOPVR0m9b71UzBLLE4CeSMlKidngHsFOBarDhJl0RGlNo0DK/gEV7MiCMJhTCGVcY0yjj9Qm4qwB6H5/zJ7MvuhYty0ev7qEp+1f7uf93HH9SYse2eFh8kQEJ89ot7NExY4I8qpUL2NNqrHh5eYmF9ipuSDPjAqeinqdZauzowKDNHUpfXPEUk5bd66VjYwOoNoNmRHreprOD83tLJhiJ70+onlgmUrXwN4jPAIAsvcbz0xfnAT4DJvpiFDPFgv2dVtolfq+GorbOcB5n7uKXSY3iH08DnmsU2Tv/xpvwYxmaGbAmB+4RNXZf9lNgU5bNbbVNFIQd0RApw3YDgs8/ewjcdv2eWziWrzoaAoV8dKsiJQ1STA9osryzsYLzxVce+2G1d3tLEHI4+zh8KoRQ13qLhkfOFvML4nCg6MomDN8r+g+DEUS55N3YHZsPsgn7sH/LiHCkmKUKgpBv2PlxIilF5XEpJ3zFUpV1qCWJxKqDM5zEql4BZe55MMNFidaVJw5A+l55GxrKTpcfbUWEdHGiCfsXMLtexcRY0REdwIa2vy528aTXvy5rd3a19OEOHBMocwTs/raJlWbPZ9GpDZntEGOoryYqc5YcGvFEItwFbsRjbHXi4GXhFKNFD9qYxm7TmKWTaYAm5OQSCY8aLLVLDc/WRhaO1TFeZI+B/keDVgGEy16ll0TrwAdafWP3XtTDhWv6By7h2wRQOIzZw8D7KB0eUJ06B0EaOSZruU5wOgwID4njBSjY7qeYoxQPKP+ocZftCitmRZ+wkLYPsQNt8ygADz57M14zO5FnLSbrPaXB0Umk+6bF/gB8KMKBRYpsuo9s6oBWBxQk+ZA8AGkdVwTC3sSHxu5vXSZiQ1MUgylyp/NmmOFgJwqg9pYR2f4LFgo0pNlQmQB5JtaVBASojBc+ECgKFL9RELS8MU8tDaoq+k4AwaqcIWu+x+E7XDID+jffCRwIEhxfSovhpZHuvhSmRk7BjVri4hKQkynbBI8gIgWLZ6wdwmP3bmIGLvX0qQFvUTETi1IXlzsLKGXsLSRaTmqNvgMeh2PhKakRWuEiX+aOW0xKpBtYkewpISLIRR0QHKYBnNnx+QIBclrdzut/Jr4zeOwj57uK7PiRAebEnU6ojHr/+YRVX015c8JcgohuPe1l1pnN3KemA2nP+vfAxl63hT5cCzoqabmH3sPtXt7QGZLR4h7yh+EWsM9K1X2w+fk3FOYuH9pJKnSFRcPyZxTGQ3FKZwnc0ZcrHLa0Fi14C2q2o4TrJBQOgkZrLQHBMbt+5dAAO44vA9NaNKeFEh0aknaFaFEh12RECUcwMTDs9HOU1bth/5bOScVDgh36kcSstijoeudDpuEMITGpa+R4uTcGwi2COTBMilBYUNlEB0Ru2AZsEbsB5J5xyRb5yWKg6TwohAr5EpJ5gdka2Kef1hdYd5wy5hF7e+nMmqYStEas4IulnZchaZkUVV1N2HsX2uUD3f/jS0Yj9+9jMftXOwvPJvWHc8TwM0I1/HU9DckIhs7yXsit1OKDsdmhXPGGWPXhKtpWnkWT7V5unfC804k3tjDzORHN3HZIq7NU6dGPHbTclrjU9fRm32fRsjnuUButMjz1OryFDo1wlA6FOfETDM6GWNZFLOFqhO6HPIEovbULU7MNIe1b/+3dZKIazgVj8xjeRF21n8KwSfPGQcpIbgz+ijWjLEbwsa8d9f69v1LeMzOeazjRqzT2TGWOP9pc2UTFkeSHzjIvqSKFqxIs5IEkK2HZBV7KtmWM1yu7yIPB2UoNC9XwFxUNKJzVzzPF5h0dk0pqBVOu/51LySQQGclSoEE1IfEPcEvC+JyC0aKORA6HWVM3kjKfOV+cw9izq4FPRDWQu47Bv1CGvLFjAyFW5Rz2m48wgnnO8z0cxESM/kpRv0AcDSADMaaGY9Zncfjdi50SX8pwY+1n3QQasjNVdz06gThIHQ9T/acbsCsGalBf8r/Hj3AzcgYwnYrpmyI9gRpo2vl36UEvqGKltx86UqwYToGn8usi0i2YjPHqlUQCVW+t8apWgEfHNFikQFgT9cyG8COHiyj3umgeDZS7k+ZkqgIB/XsJUO6M2dHcOedHL37L3gpiOZz8joxMELGMfeK15mQr0EmOt4QKnvM4poOX1GL7BwtReq0yfu7Agtyi9laAqQRbvIIWpk9NkSFdWHtvxprq8exIY0XMn21OzTnBDv5LqJpt/PImheEzoB6K/pwYHvi/mUcxTU+cvIwtsNCHuSLoCBd7GjiKFHoX6sOdgN3IvfcNYAiA6YSIAz6MZEoq0iy8jks4T/5teV9N7kR0pvKXQMqOj8kEMiU0nbl75fhv1oEqFLtStVufiMypCDb5/y5rFIqGFKfuJnY8TxYOj7H/o2zEpsEyiETQ6XFzOLiag4ESdofl3hTfVrsugEAcMwtLm8d4Pa9m7psgMH5wLlVo+wmI2r5P3Fb3ylP2C5t75TCr9OOAGrOhDHhWvH3E7AidVIn8ob6Be6aJwAsZE9cc0R2nsvgRj9jWazMvHfYCbVxN7O5ZL4RDQrfoBBRie3GwoRm3PMf73M11U2gqTRCB3n8f+ofwsdpmbTBTt5n6aCWeUJMWmoAHGAOaJYllVwWNLn6gQHh+5SDR+D8chfHsRVNex1AlRoB5H32VKTzuSMQsoJP4aCz12rIjwEXjAqG7gD4kc4woyPhojBWSjZMBiU4h+Pe6f9yYYUSHLOwgBVBSdrwSNjZhg5CP2NJO24HzOmgiPK00X1tZ+3rN8ueBJgo/kP6Ul+5DySmVGuxFSNBABz6CxjFFQx6c1ZAnr5EjEzqBDaIGQMIa7Q41+ziE/YvpTmSnmdRqkqLllpf6bNz4q/pAYpT8EgCmkt1m2pdeqdSuznOaM8XC/lEUTBFKxxdjI1Fjh1bYtX+lYK5aFRlTc4iyAZPzN41NAWHjFWmCjefQqiz2ythLkMXJFbY87XPoIDSOEI0j/XvLYDshMi4scDyPh7Jq7AnGfn5BXMStSdjGuEkUEW7MAamqoVbjeF/i78fRIFjmREeeCm1rivdJgfKajHdxb3jQZqcMC1VEHquE6u/qECS4KTpyaqIKLux1NjasSiSMMYPIWxKk8b5lNwlCzb4xP1H4M0P3okTbLBEg1ZY44b3GkVCDsHC5CgRCVM2QN+ZjHGwBLKkk6lQnhg5uclyt5qUHVF2AElZ7knI0IZsgdi/7pB+jew8y083deZFXkKyFfZfG3MWb8ouCNLpwCroh1W2PbFQ4pMkHuWWgG7JDhMgf6oRBy/t0HKBEEAIRWegAKKsjEw/MTkFrGoaSWwIQmfwS3NapDHEINjoxBTZc67JTYQWLRYgPHn/ErZDAEdO7Sg55UrVI6O0jU2o0Guq3rEZul3gukKJC7KX+zudOfPcmfzk7HcOotaxi43+DLvROqEm5QmbS6+Oo0Sv/Qy7uBUzU6uqdubMNMH2n30q5VKdPAdZSyOYZy9oRy6+nue/KJoqtsJJK6fRpFgnBTkCVTIboVd4eiOpG72nq5kXdkP2NDUhVAlrrrNExO3yQOGb0UkpchzMqIatm8M8PwT/5CqV5pjQVFQPCi60jUfzA8pHl4tkWY3P7ldh7twBe4stPGX/cq/VikIsLNZURfFBygOA/NrU3g4q9RDK+TZokuXBU4fKZjSwdBUxtII+28+T0N3m5vRj8Ni/jkA5vKhXIphroq+j1/EjEcikzYJCcFGTfLCNBCbdQvG7N1wiBjkXFrJtzraTRCIUQZ0ghs2cs48TjsdT/v/+6wYvJDv2FxaAgza2eOLuTbiwXGETo9j8K9YWzwI0cqKaWnjmxOvWfL5zc9trlf7HM5I4zVhjjqCI53rcax3PuW1R0+53KWtO/PAs+lxF/DTVCUkb4xxKZM1+Vss7MJ0PqoX+nCZHwbGFzmX709iY6hRjhVEL7MzR3FQBXox2pj4fi6CeIQKkkcTC2ljMFZjOYPmTsWPOWQvYS2StPnB8w1TL6WETY8MtLq328djdC9ik8LVB0C3gTeIwC3lEJS7dENIuLhTozOT6dphsXA7DngxZdR9sR8II5GWokCPOHxD2LEfsLNcKs58YqbpQTEDZ94aAHioGMiyiHvXLCkTJ+iFVj1kMwSK3h0QrN7MGSDCVSSokSSAkWcYSdxc9CHoSM5Q9QhYDafsmaPUlQ3U1iBkncYNH7pzFbTvnEWNMXH+SBQvpqGK3hTvCQK8tYsG0iKcWWfLoarLVawRrRQtQCtAq5D0yQityTsC19qIbbWxFaTM6HVxJ/Cuph6EQXNp2pbUaythhrizKLMYPsotSsx5O3QOeIFKKttjzkNfIgIYOx4YLYDdEO/Jg0lGoc4pVck7/NY89GSFkca9Zyp/pSIwJFOeEUFV1DCNRvfCEdo6IETIIyRnTWNuqa2OsIIk9/oU9KFXTGL3rIbsCwqIIJ3djEDfSCDeAvfdC5aZN8qDJDpXT0FqldY289SWdC/Pz2HLE43Yv4KGT67i3PcQCC1Bi0fTDbUHCA6ISruswINZ7FISgEf1oerCJJzJgFrpLXDJBPndBq/UpZ9kMmQVs3W5sEPWIYrkZBO9Dyq58LyKnII0dBtcAaxKghw6u5gPYcz7538TKZEEyN1BJTLiwHKp4hQqH3oQBsuN3Zk1GIZvCJWyD6R1Fwia22Gu2cfvu5aSkdKtbRhHW8PHa6SZFR551ydlouML6Ho3TtRa7kd//8bDZqwv3FInOWYy995i7quQS72pWK69NTrajVVFaTyrKvcS9in+ccUrb1czP4jSBOPxxZlG4xetcsqH3ej6OztSUr50roT5z0hlp5LraLsjHJfgd+9wqzwgZMBPVQo/GRIZja8Do+5m2e4o5VVKwFy7wNBapjRs4WdS5Hxs/cf8ylhTQUgvD0BMj2zKIyufFicIsAYYUatAk5ApbO3EG6cn3LDQH5AkcOdsZbbVHXKYKchmQk/dZEr1usykECWzQ7z4qIERMukpWOcWj6NfeJphmMEINykwmgCFDd7hvi3SYhqGiMjEOJIl/wp7BtjLIrotUbhCbYiOf/JmBSF0p9cT9y1iFRS8modxC6d93Spxy6GdjJz/vP97JsPa97mbqfb+0UVWIgUW7dEQV7/qoZyi1x05tVsSoZtHeTNmxKpIb/SoJk9NecUvNU/9bvscQ8jUedBc2hVA+RSOxwGP4ZZmIl36PtEX1rwPe/SOLXHsv2HvOmW+PqfwVanlmUlyxrvXvp1Zoyfk0VRT5Y9jemp5mTIhKBoXskSXJ6iPGWvdDB89xjhTPuOxoic+Pzf09BrGymzyNjdJksWu7UHOskrU1wLm/fF2BGe2iQkJEJyRPzH2GAQ6RyrEhIjQUEDniYLmN21bn0Q72bmhLYMpuYDIxuuLfQkQ5cHJyiqDE9QpioDwo0zAqoOTRHwB2kMwBNtdCRAcnJ8NgeyRW8cEkBXyUuwhpHyTtu0u7OMsCgEX2kQoByq0IssIEa3+2gX4wcJ9aoZq0AKQKh1ztCHHd4G2kPOsYWjqQZjy5GaTI3uHFRYNty1CH4SKt2xaXt8/g5q39Dj2ZIcVJczDG8Z/KuudTtIpredxjOOBaotdUZ8Eu/FVBnj3RVpT1p0m1G4OzcOXEov4jXQxSEDViZ/PcA2w5AKc8gXufC4/MvUdf2xyHhFikvAWcRNuXJua6/HEKQsfw0JNJkjOu99zXZIuAuRkbEiQjT36TWgrRXbAYZhph7E8KXq3rYuBhOCMd9zp6QKaRe5lH9Co1THUJ/5mn7clF1ZwuU9Z5YUyPIV5HZMajd87j7GKFtVDHs83qECMLNntSdDUcOWDH5PEpCB4rEeNw2pcn+OFgJuYh/eiIYWb6tvvIw4Cc/PwBB2GvdAdpPwdC9g3qAB8SaXtQKnykSmSYy+cXo7n9MgJXljpEQyUjBX4MCiQAD0PFlROPmFjlLnMPmWDKLzjTkEjJBTq1v+T15Q8ncsYMb+IGW7TA43dvSrnUEn88zP4l1MLldldO6lN2pblK+zHwTtHmN8jQ0QXcYGPZwkHk77cPeu2E5oCCpvjtxclFnJbYEeLZZD+v1T6aoGhETW7Q0ox4WW+2X5D9rFrbKLjhqLrJScLzWAHyNZNQlFfDaNjH9dKMdvZpHA5ul8uO4uw9LoOEHE3JlFNm9Hd7z6B9tszvH3Ijxu5b2XVT2pspkZ4VbnIZJkZe3LA3SrKWT+/+ts+g6QpMjk9kR8vpaMriqezC5Q2d2UefkwDpK0gdOQUw23jvrvO2DA0ev3MRoe9fByLhOpOUxl6rFlmv8XLtpF5vP0DslPVRIOoTu5+znmHYp1iq2zIkKXUW+n9Hue95eg8y9Uj6frFvMqvsgEFXQCa4KWR2sg49Ypmyx5rHDKIiJ1B1dKCjCJM6ofie7sJFoapM3XiQOg4Qc+YPDB+a0BUYLWaO+pURnHKziiIfOt14nZ3u1tVZnFlsITKjcWY02hYU0odpaWa12dkg8EPiHDDGLE1zsKUfj4XPG0VwRa3MtQha0W6uEQhroSeDUE9t8lY85hVMMnbXvG5y7Hw0Bnhx/k0V6+HUP0N7vjYeCyGoe2DqcynQyDUqpPlPzd/Nlfc793WgwpuXgsup9xd6qxzPQF1799SYlfRGHSo8NcU2J1/7mmOMPrhJ/DlGxn/W8VJLkGQnM2IyPExEGE9pO+a4FMbCtiR1ThYJhVeAo1HIizVBhg6pcDvncCMsf8PN3fT31aXVPi5v72PDUYv/pdjdWoX74iA4qB0KyEF1aVBOChIMgyFO9sP+B+RY4AGkx2InC123QHWtIY7YpJRxbESW5Fp6ZCaOEisgKEsBC+XFcBokPYuoLoQpK4FycB7KgkJaCaWiIBH8SM/32dqtrFaD9MxlqKRIaQ78xDf7pG9ii51mC4/ZPa9AEDqaASnwglVBQ39igqk5IsDRiGDm/yP0MfZoXTPb4zQzLtizKJKdcY5tyCPpejeS0TD2c3hkYzntpnQapv3oz6+kEZ6GUjfrtdciZk/53unjGEPcmI6OqiOI0XTGCrhnkmw3MaqjGdfzT+SfiQTRsfcrxzg1IeNp1gBt9+bkj6cJ26dE5RbvQrTyJYiIQLhtdR4LENq+qR9tdGxC1JtkY6UjpyLrpRAOsvf35F4IMhuxybZXscSJXEukEMRy7K0SaUQgU14qtbYk2wCRgwow2BaE5QGJ9y+VjdmuQZB2O6Q4X4g/G9KHsk1P2KgGSUR/d8VIyfbXvaaY1f2kW6KS5JfEmEIUEmiY2wvVJ5EBAmVy0oYZj989j92wxCa2aCg4rSllvFDRyFRJ3hub39t2Ys0iOMXZP5V/eYJANzab9t4LzXifY3Q1Ny3Ms0/ZtqsB9KiTonfamQi4YUcIJxe94n0Z8eUYIW6uNXIUHiOCj8Z0DG74k7ROeUEzzj0riYaTnAMva2BE3zL297OKxBGB7NipnytpiHoeTHVehhl9kWeFlKd/02Vy7/vKyXyK/8EjmQF2XMSmHV/w5yuCXRoZJ1idREEplFZZI+S1dr6U6cKVkCJlB5TWcRqll0aOOLe1h8tbB7jz5EEsaaFTMikLvBmW4CiOkewVfcM9F/u/56RRSwUIkfG85a8ZsiNYwuRUeLAgK5JI1x2+xyLukWF3KW9nIO2SduEN13VR+v5IsfKV6l5szJQZRHBUdUapaLLySP9vKhmE4k2T3G7LB9NJtaEkhSR59FStmK5oiam2W8cWu80St672xUdi58jeyUGf/8cWObmonsbyN4fHT6dYfE9j15Mz09O81hpGlkY2L4ycXMlh8bPnZ7c+eBNxzBMgGtA0y2HKSmYXTapE6I7F1dYsmmREXu7c18EZe1CZKTHirPtRKL9r7/FGTvJTm9/conjOfUuV9nbtXgRzERiVTsmiaOKRDk1xj0zoS6pUzJG0Q5czMSI6rY3v0n8fYoXn3iPy+njFUEFZ1PHBgI5lt+FhMj6YzWtLB1AAgYFHr87hoycPo+0PhgX9ivU+lz+fDmWflPspoM7a3ll3FUxkkLLhEfcFjwNUIq1Sg8kukHsyQx/ISUYXpyIAhRZAdvQX4gBcQEdISvzNG2TipNzvqhRWYjMJIcnKVU6VC4S9j5PFjrNFLwlVRFZ0hgZnvvkQ6aza8xn1C2bdWuFsMZFRwRuOuG1rH3vNVgf9SSAeTLLahxMEVzY7K0abY0tCJTsAp2ilYyahriaWG1XMjyQWTi04rkDS+nStHW8i+lSVoc4JfWrmSSObLZziYkpUKQVuNNHSHOuweClu5ABRauOZahATzMJaSeNzT4oea2IiP2DUWz8jI6L2ekatfZVCgoiKU3rxbNdS95Rry3y2QoTKFrVrhH5eNoeXiFc8o7Ukxspp/rSC5DG3SbF517oEUlRp8eMW5DX8zmS1hs9yKYoeVgdNlpA3cMqXoT5I7uxyhYuLHdx9chVN0/Q8/WHmLn9nhtmR9Pjbg6yxwHFKLJSHEtIxvwxhcS/vPXXNiETHnHWMb4Tef4t7RgOqChgcZV1f8E9Bec5tV7UYqQtGiNb6R5oaqCJMowAImg+OSM/7lXGWZWPC2C7yuMLaO2J66ITSohdeKNdA/0/LEdthgUfsnOujHPtbiUW7DFydaXsn0NGHaYbQas7J3VO2jwJmeB569jSz06k5/pycg6JTMmIDZJOLLpGs3iY3luZWBJBID/1E1v0kVKYyJphKl9NplDPmtsK5wcwaZyxcAFPjJxrJpCiU80QuYpZnFDqT2RATmoJqC9/b3CY0NVxzPYjrOZZW5yVFelAr60yxglTF569QODEHYjTT/eA+b5Xn0vvc2SnM3fEdUXUs5FE9yQuCZS289q2TJfqWBAcm9pTaR63OpvCbYJH0ROIlm242a2FfEW0hdW1RPKeD+JMZPVqm27Qp32NRMPzZ6ZLkF2Wtfv2/A3zaIsm9MbsVKL2Gbr8OYN1K1YhfyjjE9HdZJJB8j6mlIedNlHyOqYrpPXqpQkp/z7k9TxJLLFGQhp0u6HxDOlIa8w+vQ6oRWQhOzByl5RYXtvZxplmh5dbMfjy6Uhl8wo4Cfo5SuWb7miMKm4tArbXwvYJhzjhgLMTotH7/9PuNvVC9X/s6nZyF6sYycqq3XQaeQZ9T77kCkvGibr2/m+vOqFEduaLiZ2NHkza30RO5dHJMbTAjGpGxmf6ou0X+e6QjNWaBdb9ugkjobYhzQ5rYaB9qn3OxWXqOn5HNv2qTG+GQ0BwgmSmma/RGNhjnMnKbZ+G9pb3OLXS9fJURbVMGRpEJkxq6yN0xt2XGhe09nFvsCKx7FszpZyJ/Fiw0B4U1t9fMDd1r4k5Wj8LmK0E+w1qDZMVMhYERvSuAm9xfRbdheN8Jf08srgeng2zK7WVNQQxkRCHl5yFvFBKeeBZmhJ6OHOVkn9MLiyJuuPtzeYEomTiGYkEQGdIbiaCi0hk+oJBGA8M8IKbXHCWyoS8OUrRjX0Q0CLh1+wANdbWh6JKML9JeDOopxUunPYlPZqtPbORT3Ymp+NOx321bWXPmmrVT96y58VxwyYwRQIyxq9inCG+nDampnU5tGNDIKZ9HWrFTKX9z5+tsZ+A3qEfBKaBJYxCq0wCsThMjU+tUuMLVKZ2L99mxfwVu1M/Ap/z+034OPIIwnnJ4cKXjN5sHMRd3PPKMSGIeG4ywNtIztmiBm7f3wGgzhCdxYPK+MHSs7S8leORCaR3UotvI3JFDg4TTdVvU0F3mOFg0haDRw7MPJ3mZjQFKVM0hKjkJ+IeMAu5+YbBt8v6f4J8GtIcvx0KyQh0OL0rd+JzDdhR3SHjtldJRyhiTUC9a8JJu0zLrUEFhH1Td1yElSb4X6cfu86EPtla4sNwB9/0baauQ5D8L6WDY7smNW6z4lDa1yZbuyFx/zuJ6o8KtKd929cF30KRW/U4T6WbSC08TGQhFuqV61scV9TRDSDdr7ipmc/YkRt4hqKLCdhcMrzAwpDsPMuOhfuf47W3HZqrL4Y54vMJjBCw1q3MyM3ugRpsshIHIXjFWCxS5exl79/VpmAs16t5U0Wk/e8etM2c9qI5WnKTTMR0CpmKp5yRemg4wi0ShokwnFRWQDoyXV2ewG5Z5A2W2CrvsZuMsKGdms4+R6hCnnvKAszexu3mO37MD5GibZVIti5O+7MpB6OG4NCUyK8EfyCHuqs5199ksuEDiCt2fEGVkWqD8oEUV04su0oiDpQayJowbigCBAmZoUhJ3eoNAmQxGJEUzLBSQMEyD4RXH9MK6Dz0mDUFkxk3LA2yHBWLkXKBQORtS4gpnbja1idYEfXPDc8ZSzOZGBs/tTHy8Eb9joT8849Ri09bYC+RxopcLoIpzqteflXGYsC4DCupghXA2Zd+cLeB0NokibGbCZgknYXAU/uLkFLhqdSeVziY1khEtVv3yI+MINWm2c3jKwDDPtldDb9eEci4i1/D5Ib+XtbbbVJk6boanLYk1u6jneIHzvTTi/lCW0Yp4dRY7wBFLspNWWbzmoeio/N4Cy+s8/56Flu2sexgHsyl7SIf0tIjYXWzjwnIPHzu52oGoeOgAsrAFGtcbI2sGxL4FUIboYRCeD+MACEGoFEXmzrTC1g+E3MHeyFQUCQknTCjur/QIByoLhP6gK233wz8Lcjyl0vYm1fQsXQA8tNBJiCE5xyEam8YQP5jvRS42BJZpSkIcQawT++SiTTIwAazFuCYxinW1g8iMbVrgpq3dpLAMBWlIugX4VAKn2gy0uil4AidHYFjbjD0leU1Id1qlttfO55mFQe211tj05GxGrjfb+932GtKc/HopYmUz2SGfFz+SxV69tuYz9tqhLAOIHALc1LWqFnpmIy02DykerPz+sdjfsQ3ntKhruQYwO555Imk0Hh9xmIWAK8+YmwZZBExJ7RGpIoALC5v8+TTq+Bjt7DldMz5NrkOFAOk+K9Z55DzrxfoyAnYqbHsVrcDYfTo2JdC6FrgZw1QAdAg3be/j7pOH+/cjrOGJxcfKPAZ5GCXqWvo8nHYF2jdZDylpmvIhmpXK3+s+8NBtkObBXrgXpE5BCYvlfpdD9LzxUfmZUs8BUFnHQVfMQgCScoxS+6MXCYYcvWpbKyzSiqRFL01uxEledgVydrb48ERRkAV/UGOB3I3TbXopAhzquZZb7C92cGax3c1/PPSqZ7utnIKmTjaTG/RMwtZUQcEwd0fFpTAlpuIJ7jlVUuGsUGasI2DthKrqrxAHa5Y5pQRmGwJaW3S0qpfsw+4EAvKINsAr0OzmVVvk7b3lFTdV1PLUnL9iVa3S7ci3GCnrYYU3oU6rI4CgemyyBbGYjYygNuEx2yKE5bfKfWBtUyMnB2BSj8C+/VAVCgIOU3v2anZhb6RHtXuo8nOkgNaeynnKGlwptnmEqWC7pdWisqJ+r/EMsn1QH85YeO3TQVTkAww/9+xyB9thieuxTRsrK21Zf+occuOCdGxAwePAOZcmhL5Qiho4xkazlq5jlM96PxxgC4ZiQSLII3addpqvBZGY/ffXO1C2u0M65LKJQCr3kRSGELN89G1zSC9+UWp4lCtWrRpmmwggTu5RK+4ljCeEHMHI6AIT1GI9snPqVl1INUQE4+zWCgsKerNRCz5NMrEHnv2oIt5s8jyiKr8hlDCyK0Qm5E2hP7024hjH3ps3T6Wt2fCg2ozc8uNruGGqfNASMqUKPx5/nVbMpHGZ5EOgrH2pslgXc7oRRXptzMMVShxmePBti5WEgriwvXknx7G2beU+HhPETtogHamXFCVG/UFX1XLM+hOk2u9nAPVeglnLaNZ4zkcxD0Kv6bAl79mwVEZ3lFZ7xofoaMlpqcCPbhTzO9Ze4xvFOnOlyFRZLqw2fxLQ3rJD1b33VbPEQbONDbfu1UthcgFJ1Z8/iAFQq0/2ZLQ2w90XAIR0gsipfx0wSmhehrgI6n4phz64SHYvUjAeNIqedECQmX+LbJX+8w59Zz0Ai7QnCaEBT1SSZTtD2ALJxAkrkE5f6cQs2qPkNIBB8/YXMNj1iNOFld0EhVjkklahnAtMaMFoiHBxa19ZLXXnQggVh1aOrGpH5mlF69i0T93F0YFmTGFM3fZrJdyDZswi3VOA9TGb8QTP5QSwyR23FXEFtgIrvlTQGkqLvaKLGX8vg6vXU3UKyEHcVjZachasTJqWFtayczCKVq7Mqb3XMFZ4kAGAUAVvW7OfutoS0UZkwcAge9qbYyO0a4tzo6oCdQDv6L6nOgiwuOBZDJxPsEV3jFjMk3Uiqg3+SqlxxHUeAQZ8uiGisryXSWBiSx+3XPBr40IrJKWJyGiyiZpDsTHS7agVqORcT6oUu7ZNbydhtah4hZgvntI8q7cjmSKXhcx+yN3c/sxyhQ8fX0EbQ9f5Fs9VEBx/MiMcydoYRsp65IXsS2MNxyOSg2sIYJ0O//U+f8qggHxgF6N1e5BnsQlmu36aWqTPKeSFi+qh1zYUx1SRLOyCA/tfLqQpyWh4SIWHMm3gQiARBrcAdQlWUdxAHQFJf333AQV9Q0qsoii+Yv+6W2asaAt7zdJV8dKMPI66wpXcjR01T7I5fc6l8c0JaeFTCPSqv2tGaE/5+gwAmitzc+ekzGMz+0Kl7HSipO4DPMsGiBuKR5oIMgKNB8rMzHU4jRPkNGE7c/QaY6jk6u+YAZyiWtu3ugjZAfD4OmV/V3FiToWMfz8SQafETQhJJFuk1hKniXujlG1wWZCOBAzRmCagpgWYcb+5HZtap6AiSNStX5q8KWUhR2Us42QIW7Gqmg90b7GNgAYtYt/BFcWjmftpIXDX6pcCeZ0CK2yEljFgDlOcfkbmDkTBRYHc/A0MD0KG4B2e0lhh2GtDX3qwHh8tMhCHQZIepKpz2erQ1bcLhxz+ulAKW6qeFtdJUSGI1ZuRLT19VB6uQkYCDlYKhQpUJwPGSdvi8tYelj2nnZiMiMQoxUkLlGRLrpx1S2GJ5CdwddY/Jt6y8zR25p3eXJFHVN/sEOqmXAKeWp8M2jT/LBY5WnDV0p7K3Krd2V2IOLUHybC7UwhGoSf3T13lCRdqdMWu6E8LfKRWpeiiiJ2KZ8TvzgEEQWa6O5tpUSBYWiXzaDwzmc+mCFnyxGmCSFhkBBh/thWZyZON/vFkQlX0mu4Wd/Z+UBGirE9U0GtM6SpgsX+I0xbrsBcynQMrToYIOwNR177uj1+UgmJYh84QFCAGBuTkjSHlSbTW2XHFwDasZwY63G74bGb/xZpIjkDQOioqHVOdseuAlRLZjgVwXgfmJJItdZvsXrONVVjg6uYEi4bkuTzfN6kLxMUokMApVTDp3kRaXt5TxPOvwrzyITWJ6qm035MpeLPYNL8/VkJHEhBdmYdDquM+/I4FqW5YELG8WWk3fBMbnj+JqjVb8/SS26UeSavEcEGDPfciWw7lx5HzlyXrPQX+CDSibqEPtQGlfw8bSiRGxAZnlys0CNhwi5D0BU6OUBJ2jCvES5GKqV7HTi81Zbhpw/PMDaQGK7L42+Jk4ol/Rg5b5HYtROFFKFnNlbOq9IMo0UqFvclaqqvaiXoBZvVjxlLXcuoliZhpsVmok1QEIpmH1HNp6PxugtlsmF1G/NioB4YSSDWLnWcH9Gh9TstYzYztmGjMrlh0akLZRhbruXXxEExbG1rwZQ+DakZazMyzkwhsUal50VQnVc+B4dkAhSAZ9n0UX0f6JCwEZGREzSzXM/H1DG11S4WGLPRGRkJe52UK7jW3EzUKFzMdDi3SrLkrtKurROKyLhBLD4KcI+YTMgMtGFtNg51miSvtERosktBPvf8gDoViTRuue6Cho9xz+9NnJezmIaiWPNuDpVyXiPRYVSxDrETZQ/HJSZonSSmSAJpSBPvnIKprL1wAEPG/slUjHpH8wsQNn+9rckTE+uSe1w15IUxSoMpLpjSzl7eFygx0WsghBMQYBadfwzQ2iCAE7IYtoVo2i7U8wUQuGk40ogPgKlVPWM1mKrftbJhmZqeTY8cqInZt8I61T00ko5GbAzkUkxnpbIZwTjectIZjRjqfntN7VYmBhKifE0cV3bKLQOSf2an6uth9TSSKoGHmSAaqMnU/jLk/uNIuL4oACaYZocZRjZNf4TVYe1L5+VBusbLThmbnlC/sdVUWHJVtYDatUxKkNlvoVe293q9kvV5pq1aOYPVEg94vkEWF73xh81ZLwI0OadPdNVe5P5HmNwawmrLcjglRR0eNGnZge0Egw6opni3ngKB4NlbQyoxAAfvNllqLg3uwIpU+OPzySDmxPkjyHli45WA0S6yem0CCHmhCpAYQEEkoH8nnNsOCiO0uLTtWplwkJA4OhjjgRB0S7YPhxmaZQmSwhKn7Lu0HEC35IY6Q/OQoklYe8yGToC9psZhOSSqIagbakeKLO1cHmLvwny1aYBWWaDkWqvIi9YkmFkJhkayBemyXUefMT0Nhagx58rjwIzQ1bU1B1ZI3pS5XfmymIgw6ldROe12Og6DSrrSy1UKkapYvKxrL4pvSu2692ySgU2qsVKxxNgdc3xtKuGMyJKR7xc70yJlBU0VJjpnJiIr9r06eNFqkqsQ7I3b1wo6sgJPN72EzZydRBGhxE+siiOt45+FUA6H2trZdJQhjMqnglChoBNEBcypZeV/wwJUv8qhRtvsnrK8k28ks2rdiwc9rW+pD5zECVxItTwHvcj38Eyf/0ZwSmTAJGagzAh6S3IShu2p4M/Z5teM6WWTmsRwVwnHINL7+le0uthAgOP5ixJ3G3dBhdGmTHzZ8CQ9KCOHhIBPyTxhsdwwV0EWQ3ekORM9w2pWD5V6IiwseDkfRnaM08+fUtc9OgJyho31qRTuuqLpqQx3B8ifiamVt5/gC++/rfVgvrNZKwzIVsHhBLKyLfQHQtwd3miW2FwtdxHqC1BkaE7LXiMuHlCq+cUhuwWkFW2JzCzN45zeC+J0WgWm61OCJ5WqfY+p1cvbEnJJO6KU21nPZgTBoYIkxnyZfFjDeaa/YnIahFk1/wDwjCKq2WM9FqZ524a+hcnnqRDghTuTq97JzPWnmQyk7XVzMJ0gq9HlsjjGh1r3Bf7hM+ym7DWTmhyPRuHwDz/lY3sONpjp6n7IfQuTPEYn9z5ZPdbHZ3Wuo9K3iYLmNhpp+c83CPyJZULBKph06i+zoRPx7nEXfuuxYDhszhPDd72qawln9ORXx4TzMFkh06WHZGMBCzZetto9VU0HptAdKoG7oW3ISks2GRXuHBP7QIBgGg76OfHXV+WTsfqxUsDmPQAAVuGt/MDN2mgW2qOlmIjJSmFCgO1ATZpFsM8GcZk07Rm4ErE8WiszgPQMTFflofvjM+Z03+3cXfcNtZwGsKGd40O1N1ouvVNaObZ6AtKOx0z0ovcNyLk/VjdYkdhe2UfmZs0KM5lNy0N/P5fvIYqtSFDil2p5KgKy1cVXKokXzOp0VGoHBVC2H8C2OmjCYY0hZzxV8MpyZ25IYH6jXrMNDFZFUpogCvktE2TTFoidXMqbyXG3HC8lCxphEDhedT5p2TcguigyD8eyUo7kcHmnUAVh5Yt8acMslPMqwGqo7JdImS9ohRB5zQ4rgmP3OmQeGKoSimhWw22xjJyxwFDdoiMQdRpVSwqanQrAIxGYuRkuUNChsQDO6viPb6R60BXb+DqlPYjFWJqcdLESlYNMlz6iDShSZaetS7eRrj87kfGiypaZ93VnHx+UCQFQpt8m068XPJlIwB92J4PS7DpptNKiJ3Cr8WNL/SRu9s3gQTZyGeMrvdoomxA0kCtJYSM4EY71uR3JmnyT1Ijx5ciLQSB1EqsVXgnYk0ve0kWjehWb3ZwwitU0b0bZtB/WII8LOWUfK8dP43JyBsWS90yc5nKJzZC86ebSgsglIE+lvXHkQ2tiija0LSZr7hkmmyIk0Ne8H0ER3Z85zNxoJTlNvQZxEx+yrVOlEOTogspCyObkAM8E/SRc26aWubipaXCveD53yTpa7hYQtLShgRYveeh509C75omEyB3kSi5zk4RTEPtGJ1rbJss/B5jwIY4CTen+yvAO51bFGonsBY4syD62vWKLXPqHUPlAnvSwG6Df0XJ4Pp3C5WXbChaj9ikk8ZqiBBbWL1Clbz4TEPIyF7joyEHrVJoAlBewvll24AsE5nbOyj7kPPmNC1EJFJZs6F/K0KYIlcmeEHeUnzU43G4PM1DC/xclfQkLkKdDCRUxSGpn3p+dxXMChFKkPM7gKnlpeulagr7E3e7ctf+05MYu68AYPXuHYbroFZLEAYsR6s0HTNCqQKoViKfgMCrusdSjYgnQqZGr0NGapfMJeVSQunpaLUAhS2Tk8OK4O2QkhRxFOLGaepBfC/p/Ydq6d0DSIMWLTRhAYIYRMk+R5xYs8/RcnKCHLz248I+YU4r8xMmPxOZJvZZR6GPuiGCZx1vsdFp9OvjBUzp/H0hVtkUAj+RDVTod5D7UsZarhmtkZoZH/GRP0ekPy5/ddn2Ey34SAncUCD7dB4XLlKLH7syiKLr37s2ltWQfL+GxPoXtU2J688G7YknhW1P2QHEvlNWf59f2YfpG7muoWVhtRKXrTBWUmCYoUrAJ8IJWRUBQvXXzImQYJYQfrk7nHJO09nkr5zLLSCghgLMMCO81W1wLh0HObhlazaC+CygeVvBFT+YesPsCSKqLVzbmyJCOCosnatq7E9dr7VvGvvqaYLZICUrguAtvuVQAPKnzdLCiRqqU1cmKzm32x1ZCqowqmfxUZTaWVyoqKEqgDDOaIdtNie3sbIODqtWtYLpfY3trCZrPJql10KmPJs5B8e7JphI7HW1H2RpTZc06ZZEWjTsqb1/0ZC7MqiiZv9MryAEM5GAzmlES6tT/EiZIRecU+3bHptTsPX72Kg/19hAAcHR0jNIzlWHZFhbxXnP5li5md8U5h+DC6Jlu023XUCEeZy7lvUbxL95UzOvPb3uyCxcZGAPO7PPUsCH1QqHWiSjCTvaeY2dhRDAuEzOFABM7p0jQUoKnuTwP2lyvcfXytEBRCub9YjLhkUBAnGx+LvYwCCdGhofdJHoT6HGXuhSAFus4eZHccQe2gSviq1sN+f5auNwIWXp8/ZRKPsPW5UDOwcWTqggIsccEkiot+Nq+TfIq84wHBKY8ECfwg59CcCwnd0ssLYEMBq2ZZJniqAoOr1ahr83LsYuyMVcoHxlfm8ixKF0/O9kf58F4wTQ6Flsbx7KaA9i7Ln5M3vcKYnjZHMlYwO5sbf7cONATlWMG1ZrqCQVRPiyzokyebNdpNi53tbSxWC9xz3/340Z/5Obz6DW/BahHw57/iy/D1X/1VODo+QRMITdM4Vtjs4c5VOpsRkgbssD1l87jSfEoLwswu92Fqoa/yErxrRyXQx/1ciQsCZ7Hpmbbl+ugEq51tvPf978d3fv8P44MfvQuf/IlPxjd+7VfjaU96EiIzjo6PsWgaNCHMsr3Bg5+B3K4QyO8ojQpUuaYw5rq4b0IXQ1SL0jYbKIr9syr+HAMGzZmoeLwBdQArDpdWPly/z4YNdezVSKW/FrGVBEbJB90OSwQKwrVQ6oFYXVPR1jc0WvWVbN6j2ZAVolq48GSlad0U6hVQ5bMVG7wO0CV1Gw6H9UXF7loeCOxYnnSnDCT3TSHtS+l+1u5p5vtK/COY6uwpOkmEvkjRhXgRvfiJ5bCFO6vEghZYhIXCUwZnoWDn4dSq5Qy3JvajO2tUu9pBnh0bgoxarpL5RmAcXjFAFewwrAVyEL0ZYAfYFzDJDVmim7PqJ6KgA4eQWpfeoppZ8WXHQyVkBWfBdLsRlmKXT/yRWdxCMf3vvd0dnKw3+I3fejGe/2M/jd//o/dgtbOD9ugIL3/Dm3Drzbfgec/9fBweHaFZLFTktexCqIhpK6+d0IRMJUxObf7FydizSdrEOEEZY2aV91HOyEnDmQwq1U3AYy5CweQ1G37vpm2xWDZ48KGH8HV/5x/ila/7PRxcOI/XvfVt+M0Xvxx/6+u/Bl//V/4vnDtzBuuTNU7Wm34k4IfrWEod2DvFajtYcVq3HS+PH+FZ+/qfM8CKuBCqEqgleeTXep3BdmzDchwnCjub0hz6p6/er4hNDVUUJu6WHA6K5b64NM4Zllep8bK/L4ndAhwWSD8Dp0ZZ6xjlximfUwtWS1o2aL0Dp/2LlBBZ4c5VUBKZFFN5sNYA/8zzL58lNsTEHJ0t6Lqie7/wmkJkN06UCgKPc1ZRTAkQCIwvkn2FAixtWE9KiihX9g7oVm2t8Y1BYXpLcYzKH+g3Ao6dDbFrDbFqF3WJhaELWur/u2JEV/R1RL6DsTiEg27ckuPNfGcLBRlsqmDyHKLMaNuIdWzBbaeIa0KDZtGY6xAQY4vNphNxEQU0i4BFs6hasKqBI2akQh+HonK452OMaDcbxDZie7WF7WaJGBkvfsWr8BM//8t4+atej2Z7gVtuuRnt+gSLM7t44MGH8Pe++wfxiU99Mh55yyVsNuvu/Sjgw5wXMf5ST/OZ1zZ/VzmuRQjFlbRiJUg9j2rpRuczIMyaYlHF4saM45N1Z93dWeGf/cCP4FVveTtufcxt4M0xzuyscP3oBN/xff8Gv/bCF+PvfMP/gz/3ZV+M1WobJ8drnByfoFk0WDQLUKB515DmucsKzQCNfXi5yNy0Ldp2gzb2RLlA6fWl9SdGbNq2KxKYQf3XNE2nc+DqQ0JOxkaJJp4cJd2A03ESgESVn85GrGg+/xhjp7GNsUtdjTr6V48HCE0gUAh9pox2JqWuwuAmKNTyFtzNswTLQ3eaTBN5cMAkXRhPdW9Ft5RRWAdpph4zKwHY9L9ZlYX0snvezXKj1dWu3xVkdcezImSx498dMIlMmlMsAQ/pgzEouJxvrGclxB2NSQqpsniQtT0j3TABa97goNnCZ194HJYUMk+5P/1Fjqkb0P1ZH+nYdEIRMpG1nkApsmlyMYOaJhGj6idUcjG60o44mQgohV+DBczbCIQ1je38S7WgoE8aLP6276jEvqnWIGCxXJjr0YnkNrHtF7KARWiwtbVU72HdtqDY3/xDQWXmqIjemqcBKt0UYmShT+JQEbXbUyOH17Jcdq/t2uF1vOK1b8TP/PJ/xctf81qsGTh//jzQRqxPjrv7ijdYLha4594H8Ge/6PPxSz/5b9E0i74ACqqFWbRYSZ+U5og856T3TdkJWSFmUUJ4RGeA2DmZi4x1t4XrnOg9zYkSeDmpg5EZbYw4PjrBwcEefuaX/jO++R9/D/YvXgC1G3BsgchomgaLZYMrDz6EuGnx3M99Jr7lG/5ffN5nfxZ2trfAYKzXGzQUEBG7hbohBKaiKJgqlOUpv2ZjzZVxRORMngwhgDs9MkI/JgKANjI2m3WeOQfCsmnSKEmuLZs2pkNDd+AgN2iLpDjN6SAqKJkU9M7oMGJEoiiTHe0JlYoTeF4LY++xb7kFRxZ6kW6daZowufaqaxWj0IPlTlLX7u825kVocPfRNbztoTs7JsgQ40tlkmggu9+R6WKJ51mFCVHJ1Bk2wch61CvSA0l118XggnO+BkkJlZwmcnlYYkUiEBbWrgAQGxUZ7jZZ/K/09trIXFSWA7YEjrIAkBeVHZiPzZJkpNwCfYjIs/8h+S/2jgNmxgm3ONus8KcuPg4LBAwJge1mk26Q7e2leqojR1x56CquHx3h4WuHODw6AmJEoIDQEJZbW9hb7eKmC+exs9oqHtrj9TotACGQbnUn7ysV7TD14Jg5ZTGmEG0mNwiIfXKbfjhZ7Qtyg8rxzvn3rzctCIzVapV+zR133ok7PvRhvPO978cfv/+DuOf++3Hloas4Pj5GjC2WiyXOHuzjMY98BB7/+Mfg8bc9Gp/w5Ntx800XAQCbzQabTZuuV9M0oEB9fnYtYkfHSuciwKzOMRH8O0Ff22LTn7BWq+2kYXjvHR/AS175Wvzqr78Qb3jT27DhiAsXLiAsljg5WaMJGSjFHDthGjHuvutefOu3fAN+4J/+Qxxev46t5TJ3goT31k5pZcy2nK2R+XtLFJw66deKCS5yCJyZPqGYh9eU7q6qnirURhuzy2XYz1AoxBhxdHyM/b09vOI1r8dX/j/fhLYJ2N5ageOme+0xpnns1mIBBvDAAw9iERb4gud8Hv7Kn/9yfMHnfQ4uXTgPADhZr7HZdOOBRbPonscQ1ManOQM2BIZSMRohTnfm5BqZEVtGjC0YjK3lMm3oMTLe8773430f+hDe9Z478MfvvwP3P/gADq8fI4KxWCxwdv8Mbrl0EY961CPwuEfdisc95tF4wmNvw3LRFadHx8eI/XsmAbKX4VhZXMuqKPDcGQXa3JIjx7REzghZbfDWqeLUTG3sn8dNBAXG9mKpiiRmxv0PPIiHrl7DlYcewgMPPYST4xM1etjZ2cHFc2dw7sxZnD93Frs7K/U7jk9O0LaxS/MLAavFAncdP4w3P3hndw17R9pQVOWiiHXIWa9ZC5THAiws6KTw8gyf2ZrF1azW5Azv6dbeLAjMRVXI2TsqGlnClDSPQGaQpP2BGPSye9/NBAlloDK220CWmco5DVSQBStXeAICVdNYzM+zQX5OAZGvWcwnWKIE+ukFw4joTvUtdyruNbc402zjs88/DrRhNIE6VXf/z8lmg7vuewB/8K734o/e9V58+GMfwfvu+BDuve8+HB5ex8OHhzi8ftwvDg2ahrDcWmJneweXL17AIy5fwOWLF/CkJz4Bn/b0T8DjH/MonD1zBovQDR2OjroHN4QGTSCE0Ihq1285kQlCqnrXZTFGedO0Cn8SlCsWG4s5s9lMnK49HmPqcuz0G/8ff/BO/PbvvBIvf83r8Ad/9G7cdf/9uHp0gkD9AtvNVLrv26zBbYvYbtCCcPZgH0983KPw7Gc+E1/6BZ+PT3/GJ+LcmTPqTa03Lbhtsenfe9cZCOkhKVHg+XQ6nL5YnAaahvpTfv7Gex+4gle/8c34Hy/933jFq16L93/wTiwWDc6cOcAiNNi0bdfBCkHP99vYnUT733PfvffjJ77vu/FNX/d/4+Gr17C9tYWt5ULHvaYMei5xpUWGOc2LoT0lNdGFKA0FBmfIORn2ek1noPUlNBnDXEKFdBrberPBZr3Gzs4O3vuBD+BL/sLX4MP33IeDMweIse/Scd97ip3Oe9AwLBcLRGY89NDDiMx4xlNvxxc/9zn4ii/9Ijz9KbdjJZ73oZCNbatm/sM6FMzmykSgyGgZALe9M4GTuyWEgEUIWCwbdX9deehhvPUP34XXvunNeO2b3oa3/+E78dF77sHR9etoiLqTaWjAYYHQBICarrPGLVbLJW6+cA5PeMyj8OzP/iz8mS96Dp765CdiERqcrDuBatM0/XiAVHeWHOcUo1TcW3uot7nLPJLCdTNYhr0ljC3QsPs5MTLadgNGZ8lbLBZ5s7/yEP7g3e/FH77rPXjvBz6I995xJ+66+248/PA1PHT1YVw7vNYdFAZtUACWyy2cOdjD2YMDXDh3Drc96lY8/jG34ROffDs+5ROfgkfefBlbfXePmcEt487jK3jzlQ9i0Wz1m3x3L3W5ACGDpkLQ2FzOWoxSZs7q1MymEEgBWNF8TdKisEofTBjfkS5KIRswLyW7mVmn6bzsnnclkjsnlatJopI3hww9UFXj0OZnJYjTkaw5vEC9OOoZySlTQCkSRIAOJfHEmHVlEKOl0z1HtP0c/2h9gr1miWddvB0HW90Gdne/4b/qjW/B7/3B7+OP3vN+3H3XfTi8fgiOLRYhoFl2yuJmsUATlkBous0gdDdyjC02627R4rZFE4Dd1RKPvOVmfMYzPhnPeuZn4DM/7Rl40uMekyp4BrBsms67TF1FWcvKZiuC5IoSl8b8zqpKK7b7olAT1WqM3dl5vd6kk+3b3vlu/If/9Kv49Rf9Nj76sXtAiwZ7+wfYXu2mFn83w4zgGLtTW9v2907XDm1jxPHJBifrNXZWS9z+2NvwnM99Jv7Up30Knnz7E/GYR97abaD9P5t2g7aNIs+ASgMHZCRF7OesDZbi51w7PsYdH7wTb3/nu/HK1/8eXvl7b8Idd3wYxycn2NtZYWd7GzG2ODlZdz+j/6y79kIW9gwjhLbdoCFgvW7Rrlv88k//W3zFlz4XV69ew87OjhKjSSEpMxsZXVndaRW0SaT0OZzVxLeiYBACJvYQvETlyLsmGqOyYKhxJ8a6E5EZJycn2Fmt8NF77sWf++qvw+vf9nZcvHgRm7gBhYXI0egVKiYGOhBha7UFQsC1w+s4Plnj7Jk9PP0pT8aXPPtz8Vmf+kl4yhOfiEsXz6vR5mbTom1bJQzkWlBRb30Ogfv5fD6xHh6f4MMf/Rj+8D3vxSte+wa85vfeivd+4IM4vHYdaBqsFkssFgFNVx33lrEApgBaBISwSO+zjS3Wx0e4dvUq2pMTnN/fw7Of9Tn4G3/1L+HzP/szEULA9evXsdzaSu4H8mhYTMXYYrRj5PE/rOK8ED6XuGvZ4Uq2bgDrzQZEwNZW1zX94Efvxqvf+Gb8zmvegDe/4x143wfuxOH1I0RmLBZLbC0WCKEfyYauaGLELsW2F3W1MWITuQNFbboezfZWgwtnz+CpT3wcPvtTno5nftqn4BlPewounj+PuzfX8Mq73gNCg0UTukMZdR2hQIOOoO8scshkWzVqMeNFGarHXIbxoLT9kmScKBgRlfkaJCJ9rXuFtLB2LLBMFwAk04Ql55h1TGEBtOguR5+WC6qImVgK80j4JKWlxlhapDpf59eLWYixNrEIJYn9T9nEiHW7ATgiLBuc3z6D25vzeOtb3oYXvvQVePXr3oL3feBDXdt2a4HtrSWWzUKI17hLfxqCRLpzJELo5z1i8wmDOjd2xcD160c4OrwOIsbjbrsNz/6cz8KXf8lz8ZzP+xzsrrax3mywXq+xWCywXCwm4T6uyp3LzZ+tcpi5Iu8zaXWOEC/GiOOTNQIB29vbuPeBB/FjP/Pz+Klf+M+47957sXf2DHZ2ViBqevVryLfYoHTuW+3ctn0TvhMzNYsGYbFEaLr27eHRMY4ODxEIuPXSJTz5cbfhKbc/Hk+5/Ql4wmNuw6Mf9QjcfOkm7K5Wyrkxdfq9eu0a/vgDd+IP3vPHePsf/RHe8vt/gHe+9w7cdd8DIAA7+7vYWe0gEKHdrNGerLvRUTRhUX1LnwdJaey7ULEbBSy3tnD96AS7W0v853/3w3jO5342rl69iu3VCsvFogiu0ahjC1CkjJp1wnjgiEw9B8o05Q2qlWiV2EzaHqowu04BUroeai1kG97C/Qhog52dHdxz3/34K9/wzXjp774W5y+ex2azBoWmO58FKowMuZ0dUkctNA2W20s0iyU2Ebh2eIj10XXs7uzhyU94DD75KU/AU2+/HU964hPwxMc+GpdvuojdnVW2Ec745+j4BHfdex/++AMfxh133ok/fPd78fvvfA/e94EP4mP33oe2bbGzWmFnteqK/dhivV73YtM2FandAtKp0il0XYBBCxNCdyqN3OLk6BhXHryC3e0VvvLLvhDf+s1/HU9/ypOx2WzQxogmdGvTAEVSrAtnJ7cxyoodIkavHKO655SYDGRBHAbbPIx1Ol1H1yVZoI0Rr/m9t+IFL3oZXvaq1+ADd34E67bFzvYWVjvbXYd0EGK3nT4gcieOHPQ1jF70F0L32Tf9v/v/gCKOj09w/fA6jo8OsbO1hac88XH40i98Fj7z8z8T4RFnELYWOFlvsGk3WIQGi/45DzR0A0hZBQcpfjrQKgdcnp2n/W2wwZsRt0YG21ZJDqtiQnJ+2JlvHq2R6k4CpevHRnl3BYDA55KYfeUbQM+OyE1XyCIZC73Rs38ZFkRKyEAO+W341igdmURKeEiwrZhMLNz0LevVzgqLxQIf+vBH8bqXvwFvevnr8Ed/+F5cvX4dq+UW9nZ20DRdjHCUiFcS9DJq8vtWbfPhQ+1nwn3lHJgRqGtvtQCOrl/H4eExdrdX+KzP/FR8y9f9VTzvuc9CCAHHx8dY9AXAJPjFFV0aEc6IsNnSotwNQsRTbjZrEAUsFwv8z5f+Dv75D/0I3vbOd+PM/h62l0vE9QaxPyVzWKQ2eRa69M4JcT91GP3QtdYCdbCO3kM/gF6Or13Dw9eu4fjoOpZEONjdwdmzZ/CIW27GI265GWfPnsGlSzfh8sWbsLe7g+3lAg01uH5yjHsfuIKHHn4YH73nLtx///249577cefH7sZ9Dz2E4+NjbIWA1c4Odnd2ASK0mxYt59fIGLoW0QXmMMLQAsjPSX83Lra3cf36Ic7t7OIXfuxf4zmf91m4dniI7e3ttLHIAkCyvEl3D2eJ6KvIX1cQaLIUtJzXV/CQCDRhOaaY1gTUqJTe98UYcXKyxu7uDu6693781b/xzXjJq16HCzfdhM3RkVJ66+dQx/RSv3iD+hFbf58RdZtOs1iCY8Th4WEHEGLG7u4Ozp3Zw8ULZ3HzxUs4f+4sDg72cdP58zh75gCr7SUCNWBmHB6v8eDDV3HvfffiI3fdhXvuuRcfu+c+3Hv/A7h2eIhNG7G9tcTe7h5WOysAhNhusNlEMDrhIqeuGOs8+8HmlzYwyl1VjoixBTFjEQjrNuL+B67glptuwt///74e3/LXvgbLxQKbnkzJzLkIkCdRFtqPGbhv/2t8ukDRTR6EtszYtN17Xq22wQBe9qrX4qd+8Vfwyje8GVcPj7G3u4u9nRWod0ps2o0S6jLLNYRUQY7+WlEgbQkf6qpeU0QEbE5O8PDVQxwfH+PcuT18wmc8HV/0Fc/Fp3zGJ+Hg3FkcXTtCu95g2WtEdJptyTAx+606rDJXiIyqjij5M3BsqrpyoAIoBZvD4iKfjAX5VAUAadueYwdWKF1jODfvjcWEgQqbiAK8KMKWAAsb7UAW0xG4t6Ntb29hudrG+9//Ibzkf/4Ofvelr8ZH3/9hLJsG21s7WDSEtt10M15TIbNnX1GqSKGZEFVWt2kANGwifTXXLLrNLbaMa9eugQLhT3/B5+PvfuNfw2d+6id11p/NBs1ioRXwNciLLACGE+GfQAEgP9Kj4xOstpY4WW/wPT/8U/iRn/k5hOUS+3v72Bwfod1s8qIcKL2GNGUaHgYh4mPZpqZB3TvwBrIFNYS+/d1rBjabNdbrNdYn3QmKwUBoujntoIgedCF9MRSa0J0Cl1tYbi27cQ4Dbdz0quo2qYzREDhm6p/sXEwhcrP/tlu4t7aXuH54HQdbW/j3//b5eN5zn43D60dYLBosm6ZXKJcCKSInJ4L+JAuAkgngiQsL15b0co8VAA6YybYfWeWDdG90OH3t7+3ijg/dif/3m/4efvfNb8HZmy5jc3QI4pjmzG7UNYRHvh+pdQp/cRIEgXoBZ0MBi+US1Cs6I0ecrE9wfHgd6+NjbNbr7nSOPDul0PRz+u45pv6eX4QGi0VXvC5C02Fl+7FZHESKwyhtWGM4Cm4GFwljg8bFUhq7zbBFjC1CICwX21ifbPDQlSv48ud9EX70X/5T3HrLZazXmw700h8qYjSR5CpeGZNuE39d4UoBIETig5Xz+BjMwM7OCu9+3wfwAz/+7/Brv/UibNqIswdnsbVcIjI6t1BkES08bP4xWyJFmNSw+af7oNdAUK8LSNe2H2HGtgURY9ksQWBsjje4engNWC7wlE/5BDzvz30hnv1Fn4MzB2dwePU62sidA4F8/gkTdynABD/G20ST2+RYVfyhEk1rxgxWnGW4R0aVQFWgWuoAQCw+6eYgS+LTCEulGk5tSoHulXWJxP8iI4O94CBrAvA4+mkuJ5pQoW/XdHOgFtvLJfb3DvDBOz+KX//V38LLXvS7uHLXA9hZ7WBre4nYtp2Vq91ky2AvKGFilbkMZUU0+YgDK1qUgZ2tDClhESaPPIQGy60tMBEefPBhHBzs45u+9i/jH3zj12F3Z4X1pu28rEJ5yjZ3nN1wbXcG7AGdrLYgF5gxFYEn6w1Wq2187J778C3/+LvwP17+u7h8+RIQGSdHR0lwSQJRKdtMKvFvmNkPYiERSTq01Em2tpjA3KaHH23bLcTDLL0vHLr/LICmEdck9h2HNrtZuBOEgiN4E7v2PaHAc1qM6DBesdamwk9FvWgoDIsRYblocHz9EMQtfuCf/yP89f/7LyeXw2AVzC1VSiYXTcGsZ7BbkA4MXZTB44JBqcA3YzTZUpwdQMU+nlbbHPUYg4mxWbdgBnZ3V3jl616Pr/9b/wDv//DHcP7SzTi5fh2IcSB4dAWDhWop4R6lDkAIjb7PMDhEQlLOdwt7EJG0DOq7eJFbQZEBQmiARdP9XAq9bqnvXqzXiP2JFTGCC3uhpouyuLcy/53E2C4UmQtpTRLPHaNzIS2XS9x13/148mNuw0//wHfhcz7jU3F8coJF0+T8FPV5krICOzrrabEpl2FI9l6NsRN0LprO0fMLv/bf8V3/6sfw4Y9+DDddvICGAk426/65D2ktif377PRH/ecRY1l+pMODfo4c5SOGqHFOKZOMQB2rBEQ4PDxBRMQTn347vuprvwLPec7ngULAww9fQ1gATSCBM5ej5vwYqnAq/TC6XfOEDx74/NYtYAPUPDIrZWV+5g84nT2S4uh+rZEFgJonm5kEqQhCJzKyplbvzdkkCEWDr1xpD2RvRQKQpGLRetvFawq9AwCRcf7MGRwdr/Gbv/ES/Oov/ibuv/Ne7B/sY7FcYhPXiOu26xDEVovUBJlJin/isMAzlfz4FJ6TMVJpDpOymZHCJiidUDrV79Zqhc1mgyv3P4gveOan4Sd+8HvwmEc9Eut113bvqk/BpSZnzmpxx0S9bkPejOSqzHNcc1+scARxi5OTDbZ3d/HBj92Fr/mmv4fX/f7bcfMtj+isN7ELX4mpa2LaSlIwOpykofMm0qYvNRSyS5ROi7kVT9LDPwCdiICwSIsH9x0YGhbiQUuSBHyCnR3ZtaOqFrnw9OYTUf6a4Z5JzgSBoGWOWDQB6+NjPHT/A/i73/h1+Jff8e1YrVY4PDzsOz2hsEqRcsPU1PVURh2TKLSg/erFWImd2WBVDFZ24twoVvbRunL0kE//3Z+drNdYLhbY2trCz/2n/4q//R3fhevrFmfPncPJ8Un/+2OOlx0+h/5zU/fMcPIfNqIwaLlF4d7bcCW22lopuR3WByOYC6HrOIUGaIKGwA7FauzRroZVP3RG1e8Rp/ok7CIUY0CWGg1x7WhQojcNmAjb2ys8dOUhnF1t49//6+/F8577LBwdHQmnUVfMhJ68mbzukkdBukh3syLYidWueP1P1utuBBpb/OPv/df4yZ//T9g92MXe9gonxyeI3HajQzDAQQTxyPjvmD4L6V5SvI90zTTBUsXwJjyz6L5RHhcttrawaJY4PLyOTTzBM5/9afjab/hqPP1pT8WVqw/jZH2CxWKRXkNEtprDFAMZeS73NxrS7sXcv79ukUVsNul9RACElARgOChRFvMO94gFCCYHi32+X5pcAF5Cla40LDhMt4mCDhUSUIMAUsCCMiGU83JlmfrqVCFa4YJAxyC0scVq2eDswXm8+c3vwH/8kZ/D29/4DpzZO4PtnRU27SZZfTi2vaikn9fH3F6SjGcJhJAJSglq1M+KB+7jEHnLUbzW/tgRxGYd+pMr923JpglYbi1x79334jG3XMav/Lsfxqc8/Wk4Pj7plevd9bWLejo1elhZL7WtEF06qubee71abeODH70bX/XXvhm//65349Itt+Lk6FhEXvbzS+7n/CJECbH/PDl/7eCdld0TakJ/XXtrXYxiQR3GPRHcsvDfsrpHuo5AowVvw+cYk+tfoWoHVX0qooasAuoPHRaD6821WW8eg1uFxcmSwOA29p3IiAc+dhee94XPwQ9933fjE578JFw/OkLbRiyXCzTp+7otaxD/pYW7EuWiAnQKEA8UJtUjXmqEK2utjx81PxHhy4UOKG/8sXPMcFc8EoDVzgr3XbmC7/7eH8KP/czPYufgDLZXK6zXm84HrnzMZtPsZ8AqO2FYaOXmH0h5riltgjq3JN0LaZNhY63NhTsFmTzXdauG9SUb4cU6FbnMTNCmedW5y7N0UgyW7l5gnVFKBIQGzMDWVoPDwyNsEfALP/YD+NIveDauHR52AlQB2EqpiSDNqO+7Mijy5MiJm++7pcwuYOhkvcZyucTVq4f469/6HfhvL34Zbr7lMqiN2JwcqZA4GQwV5f6BoRPIfuofQVkTc0HIKuRtOCww99FAwwEkDIVRQKAG1AQstzot0YMPPYydg2181V/9c/i//sqXY2t7Gw9debjrGISuwG9FDg0P+wazIP9poSBRL5gHgYKwAKoQLPL5AayZAeU0zIzhWB+wWRZww+HipYMGQFB/WL4IC8Bg+GSxwpIuPAUkrJMC2MISRIEerJHeoEG92AjR/s8igPV6jbNnzmB9vMF/+o//DS/4xf+OeNTi7NmznQUwtn2F27eSMLSUGBgyxeOwqAz0LnawqQKYhMwhGEYkUZY1TL24TVenZFrfaeOKwHK1xAP3349bzp/DC3/l5/GJT35iEgcGo0ouVP6S8FZoAjSxqwMeka7ye/vVZr1GIMJDh9fx577mG/G6t70dl265jPXhdVDvjLDtfe7nnKq1LPz3JXRELFwkCwNKwkEJXM/tU7FxD9cWovJXC0eqRpwZK1zhqje/9pwpzCW4iiUJrB9DUK99iG0L4haLxQL333MfbrnlFvyLf/Lt+Ktf/RfQIOD4+AhNs0gaBgo6t1zN68170EE/QlA0tELNrJ5FymQqAonUyItMG39OBPXY3w/q7wRf6kVyi8UCr3zNG/B3/+l34k2v/z2cvfkyqLdyUdNAha97tkJFvoToKAnUFpFb7OT5umbtSyV8yUnoxwGBEjkurQHDjLnX/6gjDpfxznDcObYucK/t8NqF0E2eJGOMWCwbXLt6DXuB8Ou//B/wOZ/56Xj48Dq2los0Kh1w5d5Yi5ywbD9vQMf7yjWh7buDoWnwtd/y7fgvL/xt3ProR+L4+Ho3zostIsciDImd1M8oinqZNg84+StEbrgYmVCgkA5gXWen0xE1+boQYWt7G5vNGg9deRif9OlPwd/+B9+AT3jaE3H/Aw+jRYeIbeU4R6d6GVCZaecbTUzSQJnsBBaut8IOrkBPJApZGbVnoQADbKj72+Zrvu1bvlNZ8EhXYyRtHmxPlsY4yFo5pBLviPUNq4WagltMJpkJSuUbheCnE9lscOnsRbzvvR/Ed3778/E7/+2l2N/Zw9ZqiZP1cSbIcezFYTG3Pwchjqz6WZ4wTJZ34d9gcRNnVK8aWziY7ijHJOn3t1gfHWFvZ4WPfvQuvOMP34mv/DNfmj3wDIUtVS1jy/9WOy1pDYeLDe3++3qzRsudcOj/+7Z/hhe+9OW4dPkyTq4dmvarsaMhphMe5EyzgM1wmTvPWStByhsvWllDl0UlDUpRKquTlKRfcP/60jWULXJB0LLainzvCmuNKIZVsIy5n5PFtb/Hhvex2bQ4ONjFw4eHeMFv/Bbe/e734pOf/gl4xC03gzniZL3uWtQpJjioCF377HirdhF65OULEPQGSdbJXYEPkR86MxZElex9bZvU6Turbdx17334ru//N/j73/4d+MCdH8X5yzeh7d0kIQxJHSHZbMlkkiSxF5UA/vL1x/J4IsRhEIE2anTpkbbEvcbDmjKMupiLlL8yTdQ8ozM02/rUzWXAYM+7GN5Hu95ge2uBB688hFe++nX4M8/7Epw7cxZty1g2YbqIG/1fjvhMdCxivxG2bYvVaoXv++GfxI/8x1/EIx51K9bHR6AhRyUKFK5aT1lrJURH2UK04DBTUgdWcS766xZZbCama5CK7fzj2k03njjY28fH3n8XXvaSV2B1sMKnfvLTseYW10/WGR8szbvB9E5YszzYjLbldSU3YkvujRCkHnJgBGPJsSRSB7vva7722/7Wd1aVxmpBIzVfI1HFSusHxBwrn1LZuEaVAVnEnpIjShOCRJJhPd2c99LZC3jZy16Df/6t34+73/MRXLh4oWv3bza9QjOKE34UwT6dXiCmk2o0cBQumd/qOY4i89lvrepwjHIBGlruaVYeIzbrDfZ3V/ijt78D5y9cwOf/qWfi5OQEQT24NJrSBTlDTES/sm0N0xrarFvs7qzwoz/7S/ihn/qPuHzzJWyOj7V4hUXqVFI4D+MDfWqXWebZYTGy+CT1bzQADT9jCrIV6eU1M4zoVEZaWpE9u9nlbCT5KthQIEKLAO04jIf0+SpuNlgsG+zs7eJNb3orfuOFL8LWcgtPfepTcLC/hza2iCm1S3d5qFwhSi+/pb+h7CSkFj1lzCjJCFdH4S//zxMXksmw5xjR9p7vtm3RUMD29jY2mxa/8mu/jr/xLX8fv/E//ie2Dvaxt7OLdb+Yyq4YHIti7rqIr02aF0cs5ThcdH6IOL0xw73Z7E8QG9Mg+tN2UC7S/+oCygnHDtg9YasiIkYhVO2K8bheY39vBx+880788Yc+ir/05/9s59hBDivz3UKko3RtJ4pYWtTF/Z8LtHazwfb2Nt72B3+Ib/y2f4rtnV1Q29E8u0IpJlR7X4EZLoYQSholPTkVEpsWAts1gCqZTgL3y+QE4PQF4qZdY7W7A6wjXvHiV+Mj99yNT/v0T8Nqd4WrR4e9+4lNoq32/6cJMGVcL5sNvBzfIl3zBMRjaUunVL+rsZ8BAVmEtwzka772277lO3VGN/kFgGVikw39KFuPOo/Ii+K0gTeiLktzr4wG5qHtEiOWzQL7+wf4pZ/5r/jRf/ETCC1hd28Hx8fDnDoLvfSm0KlJWWzCMG1OWSUij2bEwpiFOxYHScXsnWySkj4lpEJgqFJ7YSIB73nvHfiqP/9ncXCw18XSViI56yEdRsVNteCM7oS2Wm3jjW/+fXzzt/0zLHZ3El6VlH1A4p6hN3g18+UylUy9Bz+AJZHdUGKLtNKcxNzXc8NWj69q5pk+JWmFNWjBgnVGWvxWXH/OhUzhKug7V8wRe2cOcPXaIf7HC/8XXvW6N+LgzFk85fYnYHu5hcgddZGotyjKth/V08nKIkGSEtlPZaPeNlXrLlQu5SDs1EVQDndqNxuEPviJmoDfevkr8A/+4T/FD/3YT+L+q4c4d9MFxLa799AM7IjgCLugFPKQn5kaUeYRW0+fVlolm8g4fhCmkZOU/Wu2oiZ39JXWDzZFujh9EplRnie2JM8JYtwV3I0D9g728ba3vA2Xzp3H5372p/dW1IUiU0LoYtRzYJ8Nc/Kkgk7XrbcxdrqWf/IvfxCvfcNbcLC/i9iedGMgUSylQ0lkhcLN+gs23ZtYjT5W2AzWdvUsEoUC6aRak0g5MkgKVfuObowbcCDs7uzhrW94O97whrfi6Z/yCbjl1pvw0PVrvQAV2YJYbOQieM7ez8LpVjZpqbDK1ztuVB7W5HoruvaJpfOye96dZTZCNckGTcpsNjW57as9m+0KoQGnJs+wyHwWIjAWc/7hBllzi53FEjvLFf7tD/4UfvMXfgMXz98EIKI92fSCn5iFGdE8+EaFm+fXI1W6UupyBcNKprNOxWKp1w9RsQ+vK3JyJzTEuHr1GP/lZ/89/sJXfKkKlyk3dqomrBYLw3CmFaKk2BdJGwa+4mu/Aa9909txcOZMEurIkw2zKACca2Ztf3aBsie80i7GKuuhsM0YQVzCa8rWob3P2I/3lAscF9DyXBQznA6LitFl5WtXbWS24wh93Zo+8OjqlYcAEJ77rM/B3/6mr8cXPOtzsVxuiYCkTadUDk3qBskFPDJXU0Y1tbPWFiytSdkuhbIblt571sWs2xahF7UOXPdN2+Ilv/sq/PjP/hJe+vJXYLNZ48zZcx2DYX0CO36kYu5PGouqdklTzTmdHKrs5TQSne3KJHX6t3vCkkmnaSQlAlkkAbWkyzhgGdONIHHysweKXN9EoZlhhMUC7abFamsbL3vBr+BpT35CZ8tbLNSiZImhSrluo9vBBWVyKLI2mxYhBNz7wAN49p/5C3jvBz+MM/s73WhA/jwiPyeAZVqBSadVXT+z9iTdmuhQ9vdJzkfIvzcItw5Ed42EgJTC8Nv7jIX+vW5tbeHK/Q9i96YDfMfz/x6e8cxPxt0PPoBls90lPWbZewH5hpParP+7wwMobj5Oo0k/j1OC9thrTKTf03zNt33zd0pFZabshaINOSgPWclB2SSGyYjT4QPPHORcJpgUPFuVU1bhx/5/r9sNVlvbAAd83z/7V/jtX/lfuOmmS2hjC95EcVTXs+TkmTWzfmlHsgmpXlGQtwmh+hYRjV7rTCYfkvRusm51UT8GiH1LsQnA0dVruPnWW/FlX/hsHB2fKFSwassZelRqLnFp7FWbbb9QbDYbrFYr/PjP/zJ+5pd+FecuXkDbbvQMTSWlZV6C5KXrn63ji2twGjhRGjIOmexmQNnqxaIDQ5UiTJLsdeiSyLOg3GxmeY+TAFuJyj2k+5PUhk9lf7EQoqWWfH8C4z4kaXdvD1t7O/jDd78Pv/brL8Rr3/AWNMsGt95yM/b3drFYLLoMhCHW01xz9Zl6WJH+d0K+fZJzR5NS2W/+rDZUMY8Vu1TsCxACYXt7CyEE3Pfgg3jhi1+Gb/2u5+MHf/Sn8M733YGDM2ew2t1DezJYSYXGIXnfSWn/ErRKjAdYbCIsM9jJSJAp247mhib5tDtbB4zJ5FCo4rs0uZzxzuQUAFZ7wJYNIZhj1vHD+TkdirnEZQGwvVrh/isP4WMfuxd/8Sue141PbRltxpUkngki2ePNc2Qy7WbuxX/L5QJvfvs78NP/4Rd6xwWpAweKe8gJt+E66MpQzbQnXo6yVIKsEV/bDpOQzZUZBmJMy8D65ASrnW1cv3INv/OSV+Ixj3sUnvLU2/Hw4WFH+uydG5bpQZypmkqc2hcvfQNMCwNtyqNZ59hJ99S2Yek6EWr8/v5b6Nm68OkRqx/GwhKV3CvJt8gpaELy+VUFTBEx6lqIHfRhsoIwg7jL7yYinMQ1thYLoCV8zz96Pt7wotfh8i034/j4KD2ASXRFA3guy7sGqleyfCk4B6sEOVg/+vA1+Y3r0QWpLMbEPFCbiKieI2elMMmbTWgPODLQtrjv3nsVKpUcQmDR3RisQ6b66076eVOOffjJansL77rjA/jhn/wP2Nld9T7oTi9BohqX9k7mmE6Agx7CtqKUat3RU5B4CAZrjLKkWT/JAAdR4SQxLUpJfy+urSTXlQorKngKmf8ARb+zul4SUCP5PIB1IEbsn2mWXQYxOhgW83XbIhDh/E0XwNTg5W98C17y+t/Dpzz1SfjTX/QF+PNf9oX4pKc9VR2XDq8fg7kFNT27vD/VBAao7bUtTYDN55ze9vK1H9wtw2ffti3aGMFtRLNosL29wkI4Et7y9nfgBS/6bfzWb78Mb/ujd4OaJc6cvYA9RKxPTjqULRnxoeEZMAvoF0PTJdNnk21VQzRrthiTiu8F63uQxCyZBeW01lYuTqCk9zBJJ4Uhu6VnQLSFKc3zyYiLTSw0dOZCdmhJcJBc9DnPl9NIocGmjTh34Rz+18tejhe86KX4i3/6i1NH0cIVqQBisUCrm3lz4gVkBsoA67nvvvtw9dpV7Ozvd2svESjmEzejJ/WpYBwIOy17TUal6cyn2qFIickqR8n+mQ+lQ5HKHNOJPg7ianS0RJJNpd5jz0aTAgZOjo+wu7/C8fUTfPfffz7+8fd/G571pc/CfQ9cQbPo3l9gIIT+gCjkJSx1+kQILF0c+VBCImxJ2SL7PTH2BzEKpCL/ckxwCikV7omhC9XRUhe2yuDBB5zAG2WLzOSwlfxiUX1l7y6JliOrVEUJaZCSq6HSbGOLZQjY2drFv/iOH8Lr/tdrcPPlyzg6upYtXLKVLkU+MAp/NaMt2yxpjCFY+FQaIAwyUwqu5MLCpX5IhTHa0QBJ2R5AwPb21uSCbe2RNXBtgfPs/dhNs4Mf/qmfxR0f+ghuvuUy2s2JP1tUbTjKAKQKUpgcroOnVmB4sBsqgnHKIoOLz07mnhe3ZNEWFgmTpoKWfAp9fh+8vqUIN6VxifxuORsvPhX59/2/1+sNqIk4e/4MQAF/+L478LZ/+xP4yZ/7RTzzGZ+IL/+SL8RnfPqn4UlPeAJ2d1c5pjkFpXTiu0UEOPSjnh52EguFu6MakWOuOARh5Se+CQFbW9vpuj748FW87/134BWvfT1e9LL/jbe8/R2478GHsLW9g3PnL3RZEsfH3YLjuBjSKYU8Y0O5IaNIuaMUkkKiWINkhRAKq5+wXWtltD2pMQoBMnPZlKYkChXsiILqaPVO7DYbvERI+fuV0YD0elLs5gPFkAKOEfFjP/Uf8CWf/6ewvbXsYpVTboe+V9N/F+NP2c1U64ElGgJYLLp44pTaKdG1PFTF4pqN4KSVc8eMrojZrJ96ekIWXW8S9JAgaxm2EKnVXd1h4yRKokUAODk+7jgtRwt83z/8Qax2dvAZn/eZuPvKA1j1aGPp6Q+k45DJtvVVkUtqH5UH6mSNFM/r0FVO5FgxJjBDeLUuLzTml22Twc+FNrN+PeISdaKDBba/I43DIrT3W5zSiYBzO2fwb77/p/CK33gZLl+6jONhPt2flkkS25wZvlaUsxEojs/P7XGAKt9jW3pk5scs2kxkZ+YkTtKU75az585XtQleVCnLKQicEal4vZtNxM7OCq9/y+/jP7/gN3Hm7Jku+GfASlawzAUVbpi/qYwETfWqWYkMm0KNY6xLLeOmZfgRg6PbpzXCIEs98nZl7aJlZyNiO6ZQ81e9OCoamSmcyEBMsjWJgMhYHx+DgC4cZW8Xx0fHeNHvvBq/+eKX4eL5C/jMT346PvMzPxXP+KSn4ROe/CQ87rZHY0vE0aauUTt47zvfdep6Kdx3B5oKfSR1CAFhscBiqynKhGtHR3jnO9+Dd7zrnXjT296Bt/3em/GWd78bD125isVqhb29PVy4eAncttgcH4tOEXIHR22LrE/uXbtEdMX9opLlZkwlJc0kX+siDZnj7j7RfddOR3DLYaHy5WUaW7V/QO56Qw7d1cV5kT4gQQXtkCbGkfFP9D9qs97gzP4eXvO6N+CFL3oJvvovfiUOr1/HkkSGRlp2hg2KXbAUS8KnHGVy7Ao9Zpw/dx57qxWuty2asNQFDEHMsTkTEBXqmcpafzQ0G1pM4IcTppFtcvCwDcjV3RfqLamRg4wcSL97fbLGYrVEPNzgX3779+F7f/x78ORPfgrue/gKVsutrlnB2QmXxJbM+sqqMVBIQCZFv6Xy/mAzlh6KMRJY5QAq9prhXwuVTcCiNWrmu2Du7w4r3GATFVoCfOQDoFSjgfJ+IbLJh5YMA8DmBBcv3ISf/elfxG/+/Atw6cJFrI+PFNSma99EI3Yrvbgylzp1CZxskeHhJ3uRmQx51xEzivkPs4NiYC5wjFmEGdLJIxID2wt8+jM+OaNsTTaC3meyEtsKc1RgUj8K4J6vHhYL/NjP/BweuHIFF2+62I9KqG+R5RkTW3+ugFpIypWyfjKVOQU15Kw8sVkxJZUzwmQs5dxCjrAKf31OtL0IhhT6wbXxyL+nRPbKvOoCt2FGAMmpIDd/Sc2VWgHJLOifpSH0iEA4OHMGRGdwdP06XvSKV+JFL3s5dnZWuHTTBdz22Mfiqbc/CU954uPw1Cc9EY961K04d+YAO6sVVjs72NlZoZnR/m+ZcXR8jMOHHsbR8XXcd/+DeM973493vPPdeO8H7sAfvfu9+MgdH8Td9z+IuDkBbW1hZ/8A5y/dlIA/6+MjhayFQDjbE4jgj5n6OeNxS82bFAwLfLfIkSByBIHDLLiL6crtZhvnRto2C7bjPlY5DWlUUYStiIJSVObMmmehhJZiFKVDpsgAnVhQM2V3z3RyhuwAAE1D4AXhJ37+l/GVf+Z5iSoINVYkcf2lJTRXKJnJn8ccPDirABwfH+EJj70Nl2+5jPd+4E5sb2/nETLp4o6ZDP2O/UObt+axzLYjYTcvCbJsOoNyFKrCsexYOsb+eyM4UtKkyKVifbLG1s4K169cxXf/g+fj+3/6X+Lmx9yMh69dx2q51Dwd9WZER0MFvkkKotxMqIxwtwc0koQDrTm2HWBmYJF3KzO+tDzvVEF7ElsR8WoeHIakpmW7R7HWStgKd2z19eYEly9cxG+98GX4pR/+BVw4d7GPiIwiV7k8+dNIaInkiJcdicwqyMGHXApyh0XAsqaLvAfSqnYpQDQKV2HyBC2XOD46xKMf/Rg851nPxHqzUfnkan5YOd2XilNSN8lmE7G7s4M3/f478L9e+rs42N8DYh9mQkGz7s3mD7JkSLbeuJEmc/nec1GUF24SD1qe60kjEqv5qz1h1cVDpApde0wgod0AW0OiBCnnUQA5yZGuRUtNLkjpUUo11PBAcSIrrjedNiMAOHf2LEJDaFvGPQ9fx51vfCte9eo3gngDagJ2dvdw4fxZ3HT+HB558y14xE03Yf/sPm66fBMO9nbQhCa5fWKMePjhQ9x77724eu0a7r7rHtz50Y/h7vvvwz0PPIDjwx6o1TQIiwW2t7dw5txZEHUanRgZJ8fHCltMBg3M5PjMZQJY6gSQ2iiTIJNLgJS1G6eNxI7s2BfQ1Vt/XLaRxWavNiMqO2+59cClcZ0nvAjelIbIDXcafg9VY3t5kMx0h4rNBrv7e3jjm9+KV7329fiiZ38ujk9OOrTtSHSsbFVrT7k22nDvuzw+PsYjLl/GZ336p+E97/pj0MEZMLca4Q2BVpd6CRLHSZOkN+w/7Fg7SMGiRYkvinfm0s6YC47YrzGUnYdKZJfFkEUJRuhirM/s4b4P3YXn/6MfwA/+9Pdie7XVxQovF+mQpK2USR4uUMLDexT3GusN3hOoeN3Z0n5ddq8WEqIiq2Z2hgBEmgoti5OhkovyRjS2IxbDfXKyhOUs6PhkjbNnz+D3/+Dd+PHn/wT2VgfgEMCbfiGI3Ke7cR+tykapLFs+7GdWi6dchm5A8RZIiOm5QHYWV1UNh7UFjNTQTFb8wwkhdBtCs8T66iG+/C/9Zdx682UcXjtEs2iKGzeIsBE/8CULGokklLILGQoh4Nd+/X/i3vsfxKXLF3K0LwsADmeRHsR8U46NIpMSMkmXg1y0WQZyVJkFWqgoNwCWUKOinc5uIjY5mQgM52FhfeJSViXnwZF0WGZSvS+yCNj+BgoBKm2yC6VxgrgGslu/qFo3DseIzeYE1HaWpeWiwersQdqg2rbFZr3BXXffi498+CN461t/v9vAk6Q8dN28vML1MJvYdSACoQkLNMsuSvvg/A5C03T3QezHCimpkbXjRepQiDUZkRxPjXxUEpTK6DcGMRaL2SlJe7JwI8lCm0Q2vaK/seK1a1aC2fgJxtlkUMRJxxFFl0hsRKxn8eToQNS2QqKQNWMG38/IytsOMiTT4e/752exXODh9mH83H95Ab74C56F0OdxEDiJSBlGDEtUzuX7vx+YKlLfRBQQY8Rf/so/i1/6lV9FJAKoAYcgOr6cN3RpHWaR/ErlmER+SKqOF7koxFDR9dIdosp3zsr4SPpQYVEMaTzLRicxHIgC4ej4BOfOn8W73/xH+LHn/wT+8fP/Ia62V9FESt1zgtaIDEJEaa7n4uAgNS5lJo6X301UardKYfswAkg3KetYSDaLbbp0nJlgUnjAWtnNBT9AyH6YS87+UKnGiO3tLTz88CH+zb/4ERxdOcH+2QOcHF8XlXcf9sJZVa+qU/Y1C2RHHgVzczwIpRSWsZ4hcV0noJK0nKPjkBR4sjnB/tkz+Mtf9f8TegUY0SUlAY287rLiY4scFTfD9tYWPnrXPfj1F78UOwcH/UsjVaDotqPemPWhqSBAlKI7TGXZs7HiWXuotMZQ4eYg0yK2MA2ZRVFM/MUioaUCZHz7JrNA2lv768ccdYLeEJQlRDnElfxrQkGQI+O9Z3XC7JM1YyYnct+ybELAYmcHtLMSEcpNf/8HEQM7fF/bE+XalArZ9o9pXG86LCoFUdCFlEgmx1q5HWtHHvWWv32/sFHHwgpYwE/EZiIbOuyICVXEirk/a+mJUuAnxcqklPEyPZUl5FQISrPgLbW7mRVinRXfvdTxkGM/lOs1i0KB7E0lYrd39g/w6je8Ae/84zvwlCc8FsfHJ1gsGgS7uaQODkagXbKI6RX2TYPDw+v4/Gf9KTzr8z4Xr3z9G3Hm4kW0vROLqU9NJP8eT+JxIUQsND2KBFjmxxTtCdIMloxI1+12gsn1EDZmGUCrU03zvXq8PsH5my7ixb/2Yjz5E5+Er/2Gr8Zdd92H5day30tZu9bEvcfFQVmQQFUibtZBJWU/6SwPiy5nZnctDiXIX7eKwWImzjmykocKm6QYpUd09jc1pdCRHsE7xCf2/l2OWdwgV0GOEXu7+/jlf/8reNeb3on9s2dwMsz9+8jNrt3Eucjg3EyR44BhUdKjChZeUfHwUd9yJat+58LqpgiHLBZky0yXHU7ZTretxkGl3QQcP/QwvvJ5X4LP/vRn4PDwOpqmSRnnPG6lze8nmsCe/j13gT8dVOalv/tqvP+DH8Hu3k53fhEBTUxD/rZ879zP2Uwcp7KXU6mrY/NiGZqbToaSZq+0KF1Z2GcUAJhJpzJCkyqHn62KCEfPQUzCVREFy4dLD3mUbUpKoKKBhJg7NkJUlcYZXVwtcxa1pYcapFrPcuENZGiK3NnCUghNH2xCGBgDEe1Ji/XxGpujE5ycHOPk+AgnR4c4uX4NJ0fXcXJ0hPXxCdbrNdbrFptNi03bP2NskN/CljZYIQOlkkDdhBGaqCknRSkMTFjPyCKa+4KDAOWHt6Eo0nY6rIXkcOIjoiEkkoLODADRgkqKzJMfuk0sUMqmmZAteMJqrFJTSAaP5s8zmLFYsfmS0CcYda8gzgrBICugGlEAOGBndx8fuuse/M4rX9sJ2dYnyvoaY0w24CEvpXQEyYNJftADBTShS/Db21nh2/7W38B2E3LnL3WARQchduLBZPHtC1rq/5MAQtIpJcFQnAPIuI/kzW1ao1tKXIicCzBce8WvEYU1p/FBDkIbIHMxxUYTAjUAE2IbcfbcRfzcj/4i3vHmd+LixfNo2xYh5A5Rp+SnHPgj4HQ5d8XsxWIURrI7Snl8FghKHJ9uakuk7f93cIMqQKpizYIYuUhq7o7SyHJ+EJi45LQPL7B/I2E4/SJgs9ng/NlzeMPr3oL//isvxNnz57HenPQbUauFdTLrOG34pooSqUrMpHy5zGz1JgUgSImErAhHbQjSOik3X9s6s6EiWSiGELA5PsH5vV38/W/+JpXaVZrpqOrhZmYNcBEVdOxTupgZv/6i3wY3S1BoMipyEP7Esg0G9mhd9pRTGJjyyp+ENk4Ij0dRFEMFWZ5K3Cmz59MmkZeNJHMpTlYix8K+epbZFGRtrqxTCJXoEho8Q3ok5moFpP9ZYezzIgBLxyebCMgpHyN9MtTH5YZOWMthuB4xPSuyWBnuQf0fMgmPhgsxrEImK0RtT8R+aA+pqDF1jRJ3XpzTufe3S5GdsviS6f7IZwJcLqZSqzMC+lFH+mEBVxAxMatlSfrrOldyTSjU/V6kKxnyoYXZM1Qbmhw3dupisM286MdRTYMXv+R/4+joBIvlUoWisXSIiOKXjZVSYtMlqIkoYLFc4tq1a3jec5+DL/viL8SVBx5As1gWAgd7V1DqGIn1hfMs38WNiywKOSLK4CJWnzWb/ABV3JNzD7BIO+2JrdpqLg53FNDGiMXOFq5fvY4f/r4fw+ZojZ3tbXALreanfNOoVEUVMSzRbqTEoszO+Mq0KNJ4Hjqeevj5wT2pkfwSKsi2EjMIKoidRegVM6lWp2yrUKpcCMRdTOi1a9fwsz/+8+AjRrMIiO1GnPTbtBDF2HbpUvLGZTlnr7PNnb3ZzOZIVFrkxpHCOaGVlr2M4FUqTC4TwWi5xPH99+Mbv/5r8IynfwKuHx1ja2vZe3XJBK+U3tlSAImcfTAotNcbLJdLvPPd78Gb3voObO/uuDd/AmckaA0XIR02QS+f9CdEiVUTjyvdQ9EkUuEoKNqQYI8i0C/GkNAlM4/WjSK35FKnYNuKln5p0ulfDO15ZjOL08Vr9JPrkhPF4lFZuTCooPdp+6t3klOZ7OmrgkAvD+1RmXon2rT95uwtoAwq2t356oa0WabmaDq92meUi7wedrGw0KAt+f9JF7EFYyCd7MkRfGl9AJtqjqWq28wCc5CS9nODdIFSJi7aQbhkqPA8tDELR0+vEdnZ28Wr3/xW3HHnR7Da2uojfDvLaIysOoxsxoHkDZ6pu1codAeWMBwqmPFPvvXv4MKZMzg5XicmPvc0QgZ7bEOTC2DF1Zza4DyW/cEjo0f2DzSZDyJ0Fzxg0/oguT7IKIqxW9Ki9Rqa9ckaZy5cwO+94e34tf/yQpw9OINNbE2hG5ODIsY4xCJVXjM7aHMB9+FaaeWxNLJ2JKSTlEQBO3wqTm8wFwgZ0yk/l/w1hfoQhiqIvFAGBHDLOHNwBr/5ay/CH7zxD3Bw9gCbkzXAEbHtWkXDB9Cl+7HeBKB1N5rNKi6lSUMjhZA1bWMqFzI1I+Qi3jmjOUm+Rs5WRVM4DLnZ1x54AM94+tPw9/7mN2K9XufELkayAtrNn508bYk8jiqfu7vFmibgtW96C+669z6sthZC4KL6CHl21Ht1h9eSonTZinG4X2tYHWXFuqoTrVSzNRm6nFs2T1plpgHELJVJt4RZjmNIB0LJg5XCy1OOFIWi5ZJ4f7odl09qKBK30sycpThMbga5SyZFptauk06CgTSKW+KRbdIsidMahbRAJwqbzQigPNqDUSYnBC9ppLLqbFDuykjpMvVBQ8PzyDKlchDLkabAFeFN4mKTTGxiKTbO11feHyw+axbdS07aD9G1YFateUUJTRY2oSwXLVjZQmchgpT/fehlZVvo0J0iK3VXCz+xBQmlWUDeOIkKjnwaP9DwDPdiz9hisVjigSv34dWveT1AJNYHMQaweG97rrKpjamV3ivMlwscHR/jU5/+VHzr3/wGHN5/Tyd0Hn5Ol+euElFlcqjdqIlZuvgyQMfbNOXX9iS+VACKDhBBjwII+d8MVkFH+TUJzQ2ML3H4TLkbVe/v7uE//8f/gvff8QGc2d9Du2n79n+UMWcSLqsfbSvsI10NdWRIJDS6diqgvKdYdBbtCIBGkjCJdH6ypl0Jmw67Lpai3aXUiehuwL29XXzoAx/BC37pN7G72ula/ukGiUV6X+fnrcUhDBoELufX4mEcFqaM16xhUaGALuUJTY9N5OmzjMWVTP2uEl6fHGNJjO//F/8cFy+cx3q9EYAOM2QEivjVmu1RFhxt22IRAtabFi9/1euw3mwQ+lhfD/gj1d36RC/0Fs4DqDZEyvTHrC+QWRDKrut2R3W7jlQ0KFlrEev44fRvlVZJmvZHOvK6SAIkidAkdbomULJiqY2R9YlaJqyxAqyw8nJrroSJY1XBOTaem8oLZ35GrnpM2xaak67aqSIrXY49VKhTSqkjyKZ+kbDojCHLBM48opNFSR5726RIL3kNeXQpOOyDE4GdIkPpfnrnAJP7G/LUgAxbgu2YifQ4VHIGoJuVVOSPUHLTsJlYmBzOfCgjuAmEtiuHyAiR0UbgJa98dSLLdZt+LaaYTKFbJteTvI/6ru5iscDR0XX8zb/2tXjO530OHnrgfjTNImkM1OgB5biVFCQpP2f6JM86plme7MWckBIuXBxeiOUdmzVAbk7J8C6D4taY/R9At6a36w1Wu7u468678Cs//wJsbW91eQnMUGckSL0Cq6wOEjP+/FdUyaiAsWabkQaXM91gZ69cICajwKRST3BklRaVInvVTRPS6q5O7Mpm0Zlnuu5Ci+3VDv7nC16Mj7z/I9jd20O7PulukthvlCa6N4n5RMCKOoAMixf3XmSDAh7GEzLiUrY39QmfkujRW3FSZ0DMSlUPjdnMsHNhA2IcPfgA/tHf+Vv44md/Hq5eu9ZhNKFHB2xvcPlgYkSpy71gpd2gaQLuuvc+vOXtf9jdkLHtH8SY4zCDjGAmDaSg/L9ZnL50nMwgcoMOwmY71Xd8z+QEhHCm/ZEq41WZ5VsLRTeAh7YhZ+GopROSaP8xa5JcYBIMBJuSB+UOoECKPidDs/IMkJMy2wU7BSpPferz1h21HKZDufsgA5AodwxIRoQ6G7Ge6Q7sdiqUz+lVBRFyJHIJWJU5JPQNsb/XhkGAAbQk+1oGbNluX3G/KR2PQZWTZG1wERw2sEeCOJ1DdkaV4lzCe6SQmJNo2j4TSh6VRmtqqpvL6khFQaMLJhZT4f5dRimGk8XTcHWp1370guwYsdha4A/e+S7cd/8VNKFBjG1/0IopIVTXmyXOu2v3h9zRLeLjO8b+/u4O/tX3fjcun9nF0dWHECgCvR4J8nlk20Xp788gMHMx7/A6XpxSF0mdQUiw/eUozyTbscD8lqwF0SHqiy0Z8ZKOlLEbtUZmRERsNhvs7O3i5S/8Hbzrne/Dzt4O1usNInVdlsg5awEiCbeIOdZJYzlsyABYvTVULS4kU0pS9pAhUUluPTvc8oGIxsL/aYQhBGfWLTRTQkuJdWyx2lnhzjs/it9+wYuxs7NCu9l0YguhZldtqAGVWGlFsfHdyrb0gIBkODGtrD5RVV2SSrmD2vSlnUWJaVQuOOvNP27QBMLVu+/GFz/3C/D/5+y94y7JqnL/Z+2qc86bOofJmYFhCEMYMoKIigElKYqKIAqoV7nKvXhVVAQDKohiuKCoCF4VELmoFxQEkSAgIjkODJNDp7f7jSdV7fX7o6r2XmvtXafb3/gZ6el++33PqVO199prPc/3+V///cextbUlWv8svNWUhT0Q9cTxmu5FN7MqyhK33Xk3br3jTgyHw4b8J34Os9nM5AOdEVjJeGmJlpViRJat1NBJEdHEnPp8ORHlsVDWmwKCtGeKpApIhmAxEvGguMzt5ysSAMkKryhxELAVNbabJXfqYYrFR7fhE5PARLPAGhvbDnM2G962y1V8NiBwyem8NtawJBZtMm4KqNZyDsNrKZvKemu7MrYYDSEywoKZM8iTGO0wp6ycrrUNOZohxVkn4U6yi5A6UHD6/CRTKCvi4yhwDQRQ5QbmrNKPjaoEsFMl1gTNbj1TCXMUWsedZ567trcqFOxkuDsQ1BiWBW659XZ86vNfwnA4QFX7yKEkY9yxBy+iJIhMMT/EtS2KAtvb23jgfe6Fl/7yizHbON2IkbvuoywCaAHlzoj1Oo4AoT8CW7b05XhQirzF7ZZvg6tbh3Vhp8YUrJNomVHPZxiOhjh5591451v/EYWjFp7loysBloNAqhnQ7UkU9h37CuUeJl8XZUxVWnbrYOb8YN8sTu1CFSEQ3gjZ2uCEIIRgHYYSUt4Yvjs9B/yuCAVioKorjJaX8d5/fD/uuPV2LC0voZ5P25aUD2MA9nWcaYnWKaQ4xZTvUUWpTw3Jhh3GAUj43VLVH202sTrt4hzD92r8jkbMRcFSx+0cqSgctk+v45JLL8Xv/tbLAXjUvtYbgPzZpNtwcuanWlFESTRvV4mDHP7jE5/AzuY2XFnEa9wm/ymhoZPBEgwx4Mq7DqAFbdJ612ws0v2gDV1M0con402ITJeDzTpOWsPCQkWr7EokTk2kFzgFFCFKhYBiEe7arSQ8/UluAGuleypQiS+WWUOmCNoKQFJQKAqaEL3QqvWdc3BkCHVSfOFixCuZSGKpdSCjbafMyEkVFG12esiEgOlkZvQRnQ6HTfZ7MkxiUur/uDlwUlBEy2+OlUOKOkcS9CQ3UMRiQqJRqLt/DEwIbNk0umIkYw3oHAGhtS8LHIm3Jp0ewGwgFlJAIMciRNrcwNbmSuE59L4ZB25vnManPv/5Zn2ovdi89FCauT/NE919KIFbbYHnPbehQwXWT5/Gjzzje/DjP/Y87Bw73tBNfR2s3bEHYuygbO4/6bQyBWO4FswKrQyhbye2iTRkckZs8Re5/CS72qyRybrj22gtUNeo5zOMRkO87x3vw2233IFyVKIK4V0Sq05KTBy72yn9zzqp457QF7usO4fdfuxyQDQ2sAWSIhPmNHyp/QveqPHUoiD2ZYqTGMx9jXJQYuPMJt7/zvfAsQPXVXsyrVvBRQ21xXAEEyXBNDLRS+VHcspyoX4sZ0IWtJw51lY+hs++Fg6zKTFn9zWcc9jZ2cHetb144+v+CFdefAF2tndQuEIXDqTnqbaIsbM5NdPlMPILhZBnxsf+85NxfhmiiW0nIVU5q2qXTGmshM8EC2AxO2qicCXmRNuu+f/cY+XIbK7RXqIHBAlFBKAMQFgtHGwWdA4Zz2ki4AINTRZIIgFZ8sEmvZAmKhdKT4/K8aDY46Q6H9bwExXJpHUFokNgtQK2EJVjBjYzcmYkehLKizzyDhBDVrTi7sVkXc4LomUFhRyLmbJUXIXEYkpuOZjoWOZ82p+eL6TPT7LaCD97+uYlWjydqpGcBQeHSNNZbUYHFW748g1C7MZm3clx5BfESjOnguLAsCBsnTmD33zpL+CJT3kyto6dgCvLtiPok4MWG4tl0CYZol20y/Z1W5DMxclcckmUzJPfCJm+fEwGFWtv1FM0I956PsNwWODOr92Mj3zw3zEYDTCv6+iaUUR1UlCtbBMKLEb0Pep/koWhJaDHd+44UbLL6lza4EhHO3JH/NIQE3n641bdr4RFst1FhKqusLSyjC986su44bNfwcpohGo2DdYI9m3eu5eiEBOawYQ+Xj+YF67JSJ8n5WKQp18i3cokMbuK4A4OWFC0Fo9YKLTWi6LArJpj5IE//oNX45EPexDWz5zBYDBAJkEXuaTP/KKXX3y6Wtm19pQbb7sDNBw0MzjP+dYmW9hPBt9Ldl0VStrc3+W+hV8o80VnhwU2VIFUpMGrOwGxlumQDQruuwmIo48YQtSaVRXohzLrFifJIUj/jIUiTpFe5Sk3qHlZtC3To4k6CUuND4vN37b9JRo5qJ6jQwDdf4u/x5lCi0lJQowWgYy9igzPgNJUSBYpfJRpvWY+QuIowLTm0pw2XJ0oTXqm0hLJUpBZyVfiwZtT/7MMA2BKZbjcN1pI80JVWFDglvQ8+nL9E3KPZFoByQdpbG0oB/jqV2/C1vYOyqJIvP5s0e6UYmbtJ5vEr3eCM+eauOrZHH/y+7+Nhz7qEdg+cRLFcBDuX+91QRPHiaK2IGQC1WxyYX4UmrVWZjH6adot7D1MogvLlpDRFQE1fF017ovK46P/8mFMplMd1Ma6zui0+RFxb4kWZHRIKX7VTIIC7lmopJs9QTfhKFQeRKI9y7qdHU8oLIR4ph8m87QFOEGeAhqKmINzhP/8yMexu7mNcuDaVpRXs5RQXXlv5i1I2vPiyCsUwCTeEytdg7ZzswjwIUUXtDhSVt0FClWqXDzUbNE3D8G88pjvjvHbv/0beMqTvh3r6+tYXhqFBShmmusgCOaURw5zCo1YZknramZ+g7LAydPruPvYSQzKgX5Q2ZzZBbBIomZDN4JNipmc6hs9gN7gNYudRaqL/D3tDqA4XiJWusKw+bctVllo6dk9p+stRREXB5SvUKNTKnZgypws1czdQqWMUImg7Dsc1PNIYU8i3TEUOB0dT6jzYxHcCgddei/rsQCpRrWEqgQIC7FIDU4JdegoZkxKXAXVFmXNag72WxaLkeg8MAmxFqWye9KiP7b6CYEw0c6H3ugHbReDEaTJboHsyJDN24hCFlKKfErhTSYePOlzI9OmYQgbpd5mSDLwoRHnXZoivGlnI9p+y+EIX73lFpxcP43BYCCIo6kllXqYJ2zsqh23pLMwyk+gLEtU1RxroxH++k9fg/s/4P7YOrGOshwIh5k5AKiUu5ZtAg/LIwoj1hCHS1oTRqSYDaG0Jg6occ5Wn5QInpQanyIfg70HtWmrAIPrxupY13MMBgN87bNfwt23H8fy0hLquhnJdjHcGo7qdNeF5L2XUo7J6GIgnEUhiC+4HOK1cKnbOoqYbO2k4Ddq1Mk62IsiPCIWw5w6fgAMygEm21N84dNfQCEeanny5kTtJi1aKXFeenhJTjSZFcgmVvSi2mVOwHBE2imgT0WdENCrgXKYXgoVpSsKVMyod7bxqt/8NTz/Oc/C+vpJLI2GjfrYURKKFDQYlM5hFfFP2QKRVOm+LQBuv+NOrK+voywLeJtkEE6THFDOVlxpRrqRYJcroiwsTX4UpMFNnON2i/l/7LqY8Ytt34hQplD1csz+ZuVEIFWg5eacsp/Qna51u9FEAGVOUFLMR1JXKniedC7dKdO2J9IgAzIWRolIV3bC5F9oglr43qw25Ii4zf99lojWpGPFRvxmSdDqxap5qAzZ6WvzctJ6Jn1vyW4SsUI1k0wTVboU0nn0LB0FJinPKnNJdCdZ57/ZlrHCB4drybCSWzLfCz0WaJLdGPVIsaKfMhPKUYm7Tp3CqdNnUIYOJJnugTn8mHx5NZC06wAhsZUOBiXGkzHOO3IYb/6rN+J+9783Nk+tYzgcRReL6PDFTAkBuWIkYDKY1FIiPZIIQmqxzjOJsYjoqsnFitR4hY3tLx9hrOiPnsF1jXLgcGp9A8fuPI7hcNgwWQSEhORsQ/xautdIydoNzIQh1qZFzeJYCDj14HjhlySXRk3KeGDpHXcEL1sSjEwiYDxNu45X7gmj0RAn7j6Bm75yCwbDUUTVem2h4xaiQ21iXvcwey95/5psJkcRGrFoaV2ipU8SIsTm5IdgqYOxr4SZT5hlacW0KwpUdYXpmXX8+q+8BD/1o8/FqVPrGA6GzfUoXGuh0v7s7to7Spl6DSJYKD6VNcYp7r33BHIFjp1ax2R30lh3Mr5Qjegl5UnlNrnKG14Cm9GZFFMpv5MQTpI5CckADsdOtcmlkInFJkpCQKgFS4J2RazgQ4FmJ1UlZDFxUGOttPi1i4S28SVuDNPFIpW/0dhAvdrk4/1Icn7evifPnNGDRDuuJR0pDY+9++UsU3QyuAMZQWc9pNZBThLISJ4+rWGRZWiN/BS8cFSwNBtnjPa51jMp94bS8FjcatKlEs4KaSMTNkfNMImujkSwalNFKaOXEgJCMnwNG7jFpJ/FhMIrhdBSn8tdPG8EFbEZh3pmFEWJ+XSGO++6uxUK+94KNCRTqjwUc72VldUp22mwDIIwGA6xu7uDyy84gre95f/ggQ+4PzaOH8dwNALDheJLgqM6e51sYxO0k0McYcVrancno60KfAFOwlsTOZHUAYVDFYSwtNPRsIYcUTiAMYqyQL2xg1u+fCPKwQAFu3ifKeMRi9fQRG53a2+wuFIu0UQeYO2aRHqK0f5lRzJpS7SPQztWYSBlOAGJlpCdo3ASO4gMrtCzx2BQ4q677sbWsVMYDIsmZlTYxLyxlITkL0mLSkH1OjQ8KEJl60b693UrT0NkZGqXZorLjgH1qd8BuMEAs+kUvLOD3/mNX8OLfvLHcGr9NAaDEoVzojp2WtCXUb/36YrsnNGyABgeIIfjJ0+i8jVcMuNmAR1hOQFIpEUWOhNmuSysV0yihhK8eHAW36rGOYbHoDbC0KYXugBZKwbkLwXFt0avtsS4MBaK9q2OoiU3A9kJViRDpRESm1bvoBYKV03iunDSUXEhAMWGJeWsoLFDzsqCFTHUyM6g+zoCEMEobASZ3DPAtqd91Y0J3YEY9xsCdcLrpQTaaAgdShDJChMdA7bYWMbU8y4U7mRjq8R4MOgorLLbnAoX6eFYnh6JbcWVKOzDmIcT8LTCF6SqR0mIY51waETb9mzIzA2yt/a4/fY7syJWFvZvCHiWtCZaeI++RykcYAJGxxHIAUtLI+zu7uKy8y/A37/5L/C4xzwSp+++C8XAgQqKHZgM7Eex+TtrNbMZWws2i7HM5QKOOCIH9edNbISwCAI/KDaNOFjIg6e4P1FX2Dy1jm5S53zT/ifBWWGZcUNC9UTS2UQJ/EnF+CrnGfd0SjsOgJi7qsR5KYKzeFIRcydzo/WCEy8GhRTAZo5fd/xjZszmc8BXzd+ttaVHB5doWl+Y/bd/1llOug9Hhkvotjqn6Fw5a+XASWjtElLM1+ohSLeLwuiiw1m2/w6GQ2zv7GCZgNe/9g/wUz/+PJxaP4VBWYTNv3DNot/Mzpw68aWKbH2cSEYCrAu40AZr389NN94CX1VwhYtVukI1mAwFuepL7C0btoLSD5AQlEULVHfd48ZCBuXTEdjMXBYmwIWEH5rZNhi0F5o0QjjGjUYCJBKLIQnNikT0QrUoWSBZpe2P1UYhtCd619Js+S51k0i19tjMHy0FjLNRQaTEelqkBAEeknP+7iNzZgMTlw2sGyWmuIlIXR1eAlFcRSSuLjZ6HRPicw6pesS6qBNMfZBF7JrDCVOiBdBkSJiuGonTEyn6n7WkqtwraY0VawQxhyQ6Bf+J59bs91TyRhOCRdbhwqbToTi2Wgjq2gCou0+cVFUei65mDBaSeGcOAfFoY8zDAUsdYhAOj13cORWuSTglwnA4wvbONo4e3I//+1dvwPd+99OwceedIABFUQrUNNrZevO6OoF4TC40o2MZx0yk9WSQDAgkVtIQa82sUL0cDg8ceBnETeJmg6pvAusQHF9iD23jwFE4jJZHMQOn06hRhCkRtFUYQqejRuwSosLWBpiOxkmJyiA4AEwJloJhwMks3UfSV0D6Xsu5rcj4bMWEq6prLC2N4IoCta+VAIcRRwucCTGhkD8eP1i5oMhKMQVJRJaAJSGqKoltS9Li5Rk5OgM5QjkcYePkKVx89DD+9q/eiO99+lNwan0dg7KEaxdaajd9WSHrRLCUlipZ9TaUyHLkrcNqc7wrxjK9BrsMmYX6JMii2MvwfLOcvn7cqD1j5sOEUjdA/jiWt1N0hYaNEFd88ExYkT19E2cE3/aUZb1kiWNAQ111O42VN5By/ej80dCM32RwDPW4CcnkIMJ0evQGni1AWOYQsEWMaVvSgrCoJLAFGTokZeypNtjnnP6h/Mm3z/JyrsEzlIrIqP9WUN0IOpfXi8WdwOyzawqDsDk64Mav3dQI2OQJUgi2WYklhYBWttFlPIOwJwd9U+gGOOE+IQwHA+xOJhgUBf7PH70aP/uiF2J7/SRm0zHccGgOad50ZOyISav3Q/6BgfSwJbUmaCYj9PRQHeBYxLH+2aqhRGDXkRjbcVo5wL4DB9vYXg8mUl1umXfAaYxsZtHK5ezkg8xYhUIh2gA1EZMDsxwiylL5iLtgIBWMk4FwSIseNy3/cMBuv8d8PseBwwextH8N1awKN0rO9hJy7oUTIJD1IOFALLK62Vg7Bb3QzBljxedFG9/rG0eAjzqtQhwFNK+rbOf5m8eP4esf9Qi8621vwuO+7pE4eWod5aBsqz1NWusWXOdM2huT8PBKohuL00DPJtBuHJ4bC2Dta9x97GSTQ9+lvBFnZkm5XAFOKH82fChRYbAWr7HJEZCiQh28Q/ozC20xNtGeMMI1zYCwfQZJqSRhWRWWgij2I9kJoEwLXJ7Q5GyftcaBKQtOieY+xqImcrxTY0Gu0Kdyts+UWoAMLFfOGG0aoSRsQlANydDXIPIcIBDZMg1QSKpCd4OQ81NTwsYnzYlU/0cC/xpdDKKTwJSu5EJAFfQA4RCxQHDZLvQkQMYkiI9oT8KMfnsfcw7Kk0t9geI+UHIdMh0NBQqjgD8mknG5lnNgZ1oACof1zc2A/2W5eZLIf2GL4+bEbRLhhRw3+xYS5AQsyJELpPBODF7VFXa2d/HyX/pZvP5/vxr7lkfYOH4cVDT9Nu+rlqJatyFC5uTu22fA+7Qb2jqhwhrmoz4g6opSkJk6RHZwN2alU2scAFoErlxvcHBlCV8zlvau4tKrLkdVVQB5MOrW1ZDcIGHvYch7Q45mjQiToZ8DRVHqOhI6H9MFsp7wj5BvGf1C5OFjjkRK9eoIgTC9Kd9872az96EIaP5t/s5kOsXRC4/i6vvdA/PdMVxRhmxydhrqHNv7bXtK2HZChzlkN/uE/6xCXMIcGJHcxL7hYQteOXU3iQRPeE5bLO37HgxLTHbG2Flfxwt+7Pl4+5v/AldddilOnz6NpeGwqQO7xcPFxbUTQDHbZTsSxNjYWELOM3XNHEpu4u7mdYXDeDrFsbuOoSgHcIVkzWfIV+y1orXvAC9gKiRmsiRPtKL6JlIudl00GLsRmbhPMgQbzlgQreSUAjRD2N/CYqlSqo3zgZKTc7CwGusokckU4FRrliKbjc0pKRLIgJBSXoJuB1MUkZFmCihmhiQacCy2KIE7iO2abAmhg5woeb1nAW2oa5TCepK431znh5OEdDHCMnIgjqMl1dUA9bcglCVQqPdZpRoIpwD1tBEMsY4zp/huQyGRm+DjJpXwXWxyHKcVseE0Na1+6RiBsGKXJY6dPIWd8QTkHGrPOrqdo9haxlYnnIDQgUSwLAcIUCv+c+TasVvb/UQEzDWZAozTp0/jB7/nu/Gut70Zj3/0w7F5xx2oxmOUzoHrObiu4es6ZBeo21wC16yIvEUga2F5HN2G/zXiaH0OktkuXhz+RLHahio141XXdoOHmEwnuMe198B9rrs3drd34YoS3msSqeXoeGE2144MaM55m+FCYsSqXHRZj5ZvMzhYq7k1AtRY32x72Rx06CzCrs6m3+3a1bzC8miIx3/nE4Cha7JxXKlFUInHOn6AqiUkgDvx5mTd3VAluUnms4xvQAsAOXcKbv51ZQkqCmwcP4Hz9u/Fn//RH+J3Xv5SkK+ws7OD4WikFN0k5mVqyxKRlOEUxk5T486hLajshCAUrsDueIydyS5cUajRegIYM0ddnZVgIliINH7SZChERoOYJ/fQ3giUfTcq456hQCEyeQ8iu1xmibNtvbLmRIQKUrRG+6YUcnaeY+xHnkAcLzHriN5s9GGGYy5jXkOxTbn0R848JAaPQtYlAHVyZ2Xdo+xggTjTJ2JtSrOqDhLsBLmJxriNdpTHsTMjBZ8Q9j82QkpmNra81J4l3SW6H0qq48FGOEoMUXgjCSKLQk4hAiZttTMWA3GZZJ5FhL2Q0UzbjV4FcKlURjNoI2SLEjk0kzLIoiixfmYdm1ubKIoiBjVJ/gLlDwLdyJEow+GX9MhWXqISM1WkdEQKl2WJU+vruOYeV+Dv3/xG/Mov/xKGADaOHwOD2vZ5bWJ57RpmMeWpRkrqgux/W6Z/x8KJIu+IL7bYddhMg6IAk0ONGt/yPd+JPXvXMJ3NACL4XCYK2wKZLSRAT50ozSWB0gqwYmPIp9jF/HMOKUHyv7MBEMZOJ5XY3Q3p2Ys2vPQ9RwogwCiLAltb2/j6b3kcrn/8w7F5+jTKpSWhwm7sH11yHoUgHWEX9HXbYfDxAwkZ0zBz/tbA0X4/zyJqWOZSe05Qlpo/3iCKnWsiL7e2tzDe2MIPPuN78N53vh3PfPpTcWb9FNhzA9gI836hiiUhjKHuEK+tgN1YgDl9wHRx4rNBJl2rtCwKbG5tY2Nrq3nIvWhbWbSkhZ2ophEb0Io+QUvbSVh2RYudmAzHyrwv62NlMUay8V4Sk0z5TEArwmOjdQnq/4zCnTn1POeKJE4cGOals2YmSMIbQfu+w0gpRxMk6YCimPpmZ82d6FJArGyRS+qUa2xUoqOmuugq7SblZUCJ5+ypnoxpUXQOGEo1Lfn8KvPc2Phk4l7k+UscLyWZ6lpZEgfXJLIZZOHE0r6qTrhaMMht4ijZIJrmDCgkfqyirdWHzHnRq7azs87ACpogo3NRsCdZ7GqrJ5hQOIfJeByCyDorICvlOWUPGNLyLQXKCpjGoovkHKgotNg540wZDQfY2dnFfDLBL7zoBXj3P/4dvv3bvg3j9VPY2TyN0lEbmiaKbhlTLxDsaPePzpqHkCvjI23Ps+lGSWE3x5REjntNl1PTiRIlcp5DF50xHI2wsb6Ohz/+EfiWJz0BmxtnUBau/T5inI721yIPohNYx+kJCfFobOuHfVkwbawQMT438Wl0UCcE6QlGAuIJ35KsNQeKut8tBjrNzMTrtg+Ma72nZUF4wS/8FM6//Dxsnz6DwfKSSUtr2zu+Rndpu6RAb6s4NXqVylCNKvZynKDEJbLiJt3DbT94B6AoHMY729g4dhwPvu/98JY3/hn+9LW/j0suOh+n1tdRlINMJ4USkEonGrTMfwgUa6z4LR3MLOlsCpb2CjjnsL2zg+2dMYqySNqPxMhG3DLbNnT+FEDCp8xi1m4ZKUwWliS96Dm4CWtxKZmCzjrOsp4n0g1km/eKBd2V3JTEtNYo8T/DJOSxSpiM8CSdrKeDZTjbD2fhLJAOBZ1u1ieSRBbnrLbkRXD9rAXVSHTlNecMw9dU47kSUzlMkIiZzXWxawv1xEbo7A4l8LKaC6HSl+NtUAayZCxXKQ1DnuqEViL7aVBaVJlOHSWJGeYiJUEPprOW+UidI8xmc2xubcdQH8R8l7T1L9Q8pMfBSYKoBZvZ+GgFCXIK3FOUBUAOJ0+exP3vdTXe/Bd/gte99g9x73vdG1snTmK8s4NiOACVJZhc1Mp0XTrPIfioO9z59r/1xq6dayGm18cusxc2QwjtV9pFaPcSagqMwWiEjZMncOk9L8YLX/YiuAKo5z7qIRJxu9DjgKK7RRybOhdGeL5JHAZJhqjplFHOCL+dtL+EypGgIhpJRYGysNKw+sAYPSclMnMCseg6JgzLEjs7u7jsqkvxy3/4Mhy6cD/OnDyFskNThs3fh24Ay6TAsInrVklWoSzHB3Uz84/fx+uWlJx9tptwURQoiLC7vY3Nu4/h4gsvxCt/6+V419vfjCc/8QnY3NjA7mSKYTlo09lSEVh383fIzA7o41o3gNpUrSCPU/W9SjukfHoXOYf5fI7ZvGpDgXwocALCuBOuKMdctHapU6URjkkxkzk2tveLbmHZTUclH5oNLUs7YxH41CWtsUxc04Kx0HmgVCHWIWiVNU4Cosh2XaA2YP3ZCBiTjMomK5okFT2tctwIIjYZQesRHnIgOXF1HRcrfKJWTxOdO6QEj9FjzFH0q5O72hGBhPSQblPKRTfDwM+BH2TEd5LkKOeqrCf90hYbfNOC5hd0JuFZj8JJMqLkcA1UayjDcmA71CAFwTHwAmEPQeImITGG0cFKglViJ5pndQVI0SupzYwMNTIeOmI3hxxhNp3hzJlNFM7F7ifns3FiuI+e+8vdPs+XQBIqBch1sNUIdPCg9nktywG2trcx3tnBD33/9+Ld//B2/OZvvwJXXXoZtk6cwM7ODqhwAWWs2/TdvlG3hUAd9gwWmzoZ8BInSbQ+YH5hDoysxubNz3VUoCxKnD5+Ny6++iK87A9ejvMvPh872zsYFINozzUuIM7Vr5ySGcOBUMyMmsNVh+hPi/84fo33jJMnLJtJLHn/LLCMGQ1LqNhd0tKBeDHRm+5aYUrhGoPEYDjA1uYG7v+A++BVr38l7vvge+HMsdvhZ1MUZRnVn1w3MYu+acFTOxYghf8VZDKJOO3+rBV/hALGWEukDYQdgYsCblgCBGyeXsfW+jquuvxy/Ppv/Cre/09/h//x356LQUk4ffo0BmWJQVG0ACyn2/k9LS97GnKiCrdfr3BrmXOeXbzCfeYctnd2MZnN4BylRmIBaekNuuGzBd7x2S1VwIKk9Lz1ivr0hwoDTdkp9ILklVhoECeiliAqpbObFxe0RrQLN+NGia2cjEAOlPAHUkiLZBTkJe2UZTL3gWQ5L1FQe5w9lpL+M1oQtJn9deqlzFsDKSmATXB3JkaQTb+CE54JG9dM8r4X2BXVJsxY4OjQaaZGb286Rmf7Z9GDyL0Xn0yCYPfljgiz+RzHT51IQ34yMdC88JYnw86grDZAigOTTmhbDJDrrILAYDBA4QqcWl/H3pUhfuYnn48P/vM78OpXvhwPuvfVqHc2sHHyblTzGcpBiWJQNM+Gr8C+Atd1829Y632eLyL/syUIkhCJR+GgucSOwOTgigHKwQDT7S1snDyGR377o/Bbf/47uOyqi7He7g81cZpkKtX8fdpsm5KaoiQTGFS073Z8ClLPZ8kq897AfOShhEVIi4DHdD/Ee9N+VYuUpgfGNoYeXRXFAKdPb+Diyy7GK1//SvzV6/4ab3/9W7F57G4M11YxKIpgu/DeCy1BvFkCerK5mwQbIFZ23YcJAKhb3QBRa4pguKJEUTTtJ8+MyXiM+dYWBstLeNzXPRpPfcqT8JQnfisuOHoYW1tbOHHyJAZlieFg0HBUWGSvi+uVbPzi4WjmWZyMDGTIj6qyRXcmZdG3rgzWWM/NrR1MZ3MMRqMw8yKSnAdWyyIZJ750FVltSCgeQ4Z5Jzozm5ptzcs8cxVcQ2pkSxzZ16oTIaX8QvrMyMyvOYvDi6dBMlEtEskFe9oJJjf13jgzmiGwJjmS3VQ48e128+d0OMHJSIbIPGeIgSJK6E5krLCkwDw2TU9Sf2x8KtkcZMNRZZF7n1ACCUrXkawbJvwl5gEg3F+kAn1EQAqJrkvGZABDr1OFE4tTusgg6DitXbQyZzY3Wwhp61akLbEqZFjctvKmiOsVGYuy/AxlQaRDvJA5JJjEQYL6nKqqwsbmtl63HQmRXyYOt8+JTi5Ze6hx50XRroCJ2YNRt3Y5OHjyUZfggOFwiNp7rJ9ax761Zbzg+T+CH3nm9+Fd7/8g/vb/vgP//L5/xfG77waKAoOlYQNcK5quhudWA9B1cmQKpov6FzlCaJT+TTHgNUO3udxFgcIVcI5Q1R7T7R3M51Nccc0VeNpzn4FvevITUFUVzmxsYFAOUMvOnnLldD+XAmOgmThTsFTK/CymuLmGtbFdJ323/3hu2zRRtxVot63otYw0NaE2ITIADlYfVBQEcgggIJOP3n2NDBnSFAIWwoX4tcWgxNbOLoqyxA/99HPwmG97LP7vG/4GH/iH92HzzhOAIywtL6EcDoGC0iCZ7ue1thMQJWHevm5iGiWy2LmisSAWBarKYzbeQT2dYWk4xBWXXoRveMzT8JTvfCIedv0DsXd1FVubmzh54hTKbuMP/l0nnFSm9WWCVKDSrzixl0WoUDMbc2qR0+QvSdtiNmFF7fvc3h235Cwz3CRty5bEL7XuSExl5uGVwWgQ6GW9fMv1ljUdRfrphTcmBMaBE0ESd/Mwu9gxFpyENEY4C6YRRQGzoS7arydzcmOZHig0DKSTMlmGFhnRFIENmEqe9jmMBbwnZdVM/dp5cr7SGMhFWZ6JQ8pi7IqwTHlMmgBiIi4z6plUR1xvXJwB1cQbnBFbMZqEGemWsXWWcnByIrZQMKkRkBaAKYmIAcVIMSqZmCPI+4GMf9vAgHhhjLcsAgTbHTpxFcFxQpLOr07ZnFZhia4GAHZ2d0NGQMevl5IAFlTVhdZgcJtFIguleCgJxY6L/jZLNKW2iCiKojnsiQMNM4HKAvPaY7a5heFggKd86xPwlG99Ar701Rvx7ve+H//wrnfhk5/6LE4duxuoa6BwKEZDDIcjlGUBbomEoFKh7rnbOFsTnm+7BkG83XUmXAFmoJrNManGqKs5llaWcdWDr8E3P/Vb8XVP+DrsO7gXG2e2QJ4xKMqGxyLHMjJRQeQYwH42jhSSWTov2PuWdOgDn0Pm98j/VXqQ9v4so22Kw49n76MYhA1RjPOt5uQGJludhrOhmdFBRcHCM6hwmFVz7Jwa47yLz8NP/MpP44nPfDI++t6P4D/f/1Hc+OkvYXt9vQEsDIcYjpYwGA3gygFQNOCJhrQXedVgD9QOjAo12jmRr1F7j3peo57M4GdzoHBY27sXD7z3NXjY9Q/CEx7/WDzyEQ/BoX37UdU1dna2cfLkCZRFidFwGIN6zAPRtfH1zCvTkgtKnLwULXRKQAl+9VxYZ3IBu+22O4GqgisIXInTEhvLJaUdc2ZkUtcXjB1It5hZRCajI/HlnGskl7EUoqJP6EYRGO45b/y7oltCqeiPs9dLdgQyMw3Kf45yRGZfu+6gkFGzL9oAYiHApLs+VnnNFpErX5sj4wZgFVpjwWOBkyF2U9u8iVGtXeFGBuiTExCynocnx+YcxTGTxkZQjiR1WjaSCkZPRkPQV2ieQxL9rOJO7T0YCxwKiyunBn7ZVcgrKgWsyFxDo79JrxEnlzDeD2R9DzpTth2L3nHXMbVhJ8FumXFgdlTJqUWQRVc0tznpeGX9e/F/XfycupFqQajZY3NzE4Uj3POKy3DN85+D5z/nB3DjTbfg/f/2EfzbRz+Or3z+i7jppq/hxPopoK6AsgSGIwyXljFcWmoyEVx7mHIEqoG6m3R5hq9r1LWH91UTV+8BLJU4eOQgLrrHPXCfhz8AD3/MI3DPa6/BcGmInZ1tnD61gcI5uKKAB1AQGQ8IpRpZgmbyyA6X1XYA4lpBOTds992Gy3X/lPpDFjGYItObxeLKHVRC5jTL1CESWQKJQ5jDIqFOvaLqlBuWI8L2ZAq/O8bRiy7A9zz/+/Ed3/9U3HbjLfjypz+Lr3zmBtz6tdtw/La7sHNmC74ei0jSok2haipZ+Bpc1Q1NqlWBFuRQjEbYt38/Lr7wPNz/2vvgodc/GNc94H6499X3wKH9+wAA48kEZzY2UNcezhGGg1EzR+/eiyPl0+8ucFcExEW7zcsWm0Qu+U91WQAdVcoS8qHFf2yiL31bYHXXdlZNVSEmW9+xG2A2I3MzRT1n23rqsR7KG5mEmpXFyV4mykmrEAyJLQMqiK8HLoqcZHs2uERkmhoF1j1Z25QSglG0dRELgJC8pzVgisk2qUVbWZGMREpeuynbwtoKDrt2XdiQZZ4MJB2M9elQnmCJxMJBBv9J2kcvCJTqJC5OwizgQpL8qDcDVjbKRMjfuU8oLa7IFAoqdY502l6y8UGKldmwDHRGhCzCktGKDhGIU1rKKknMe+FIWhTrI4nQJpiMg75CB31oY5X/otv6+rNgPV4Soy1mbnGwhO3xruqapO3/7vl1oiOlxY0xRC5dyzhVaqjOhhMd4ZC9wGyKCRY/X6w3ZQlmxvbOLuqqAjPj0osuwPOe+f34kR/4Ppw+s4Fbbr8Dn//iF3HTTTfj2PHjOHbsBG45dhduO3ES1WSKqpqhrmvU89Y1EPYKghsMsffwXuw/cghHLz4P5190Ie51v2twr/vfE0cvPB9796xhNqsx3h1jezIGQBiVZVTbQ6ZftpkCJG8aNgctWZhLFwArIZ9ykXLsxFHouukurBO2zFAABHqWwlDKgSartp8kF8XTiU4A5D52N+u5o7RgxDzjbh12KAC4AphM59jdmcGVBS6715W45/3vCfbAdGeCM6dO4fhdx7B5agObG1s4c2od452mLeMZIWPAlQUwcDg4XMaDL7s3zjtwCBddeCEuOP8oDuzfh71796B0jUVuOplgc3OzuenaGEvnxMItRCsgUwDYtp+Z6ytiHeVPSDa6Fbb9CHEkTEpzDVHtboC77j6mg1kSQLl8bbyQbt/rflqcQq1PtKbspcz7TVBFiULbA1S0PAUKnt5G4VuLWasDCtfyEkmx2pnrnlYE55JpMtx58Zix8I5zen1lk52zcKf0hiCmHB0pOY3mzoEkCnrkRhhE2c8zPdClHzT12CA5ITJQ/3eR4xNTEJLRBCjConWHWKBZBI7oVjqZ+N0cJlcumWYDZdtpkDoP6skOyJAWSV2pVGlIxoCQUYLozZR0SJx0YAZ3j9S5shl3EWF7a7vl0euCJaOs1Ldh5oNNZvrI2BPN6BDm8Kk7A12xzKZYNp1XIqAsUNe+2Yy3tkGuwKAsce3VV+GB97sWRVmiZoYDcPvJu/GBOz6H3XmF6e4Y4+kM1bxSs/JyNMTK6ipW965iZXUNK8srGAwHKJhQVxWqWYWTJ0+DQSgKQlG4QMwl060K9xYho+HIyKRZxlabzhlr4JPkBiTFM/SEv/uNsgd1FglaHAUIpDWz0aPI6cKkTqNEukXBgisgFn8fMT3hBimYUMOhdAAPGhHfdDzGdLcZFQxcgfMuOA+XXnZJkx7lWpa/b76TZ4aHh2eCd8CknuFCrOD6/ZeD6661U8PXHjtb2yK1ihpinmAyy1arI6f43X1q1z4lbNI2I2R9uwydVidnw5Tp5JE66cXPdF7VOH7ypIrTk616WUgkalNR7cttmklvTpxxTlG2g869QSx9fIk4s24EoM4RinII5wrUDMx88yDW1bxxh3hGUTgMyrLhMZAL9xecE55zzjpbJFhABlTJKAJmUdkLzgFlT4pIMidyolk14+4sfHLeToLLwXp8LzssJH3aQkipABNqZCea02Hj9EowJlWOioFPgOSV6lWCzUBDbphijCM6KWTbihY6ZsY7EEjyREdAEd8LZY1iUwDL8YbojsnOFImN1xRf/RnXpNn7SmdiVAAKhkR5nUp3jVhXTo0lllV3Ro+PWEGjkprSEc5sbGA6mzWFNDhxdNn3JU+c2QVJIqhlF9MIPEnjDpusErOGRYxztMQ6mfSp2iGdfbAVc7dr+O5kjMl00nRhC4fl4RB7V1Zx+Oj58CWhIEINj7rjBbR4Zg9ubYQMXwM74zHczm5zOHUODg4FObBr1oPmtbuk0FbwTJFPQU7faxFd3kFKZcHAcVShqjgKhEk24zrrNGNRUJeA9v2ToimRSM1Lv2Fo7VB+MCRPrImSNHyFj1ZHDxN92ohBipbrz2jnM+RiuIhnzCZzTCczwDebPbfftqMqdQVABcZkPsV5ayXOYBP1vMKgKOGKRsVZFqViacewIyeEcRCugzzFKl8IcObrtHo/hpxwDyvvLIdACW1SyVTUFE7TiQZ9JFQn9EJNcn9yTnlr3O8dyt8TSgwgvtgBaISbg2GJel41pMXaY7CyhiMHD+LwRQexNBhgzoydnR2cObmOza0tbG1sAUWBtX37sby83ERR14IxwLTQfCZPHSo7ACTU9Xqjs+oByukSYzdTydh1HACr9q5VvOcKCO4LWVzQrVGPsFZhRpyv+DNOTuSkIE9nvykoc9KJG55yUjClg9B0OxJl0IKUQCWjYxP8g8X2uhCeSiacJY44uC+VkWTRhXyWs6E99qvtNSO42/wthZJM1GUyCiElWsJkPMFsXmm8NuUR47KtTJTJdoDOYrBrTrekOoro7A66RhmqFikNDWXECCT4Gy0l0MzMJYK4K6CHKFBUjM3pLhwIdesWqMgr9ZrjZs0vnENBCB1hJzZ6Z4sgNkRVyp72MhdW7MmypUMsmordCNbc00QmxlyMDsRhvrv7S3lEY3Q2Am5OuKxPFyGj3AtmOsdWvhWeRGsYq5u0eUPthfNiju0ahDB5Us1r14o/nIyodE1CEREFqwM7oGhP/RW8GGu68DaHhcPBlT0YlUN4V8C1udRkxNDypnUtyDrOwUnM+akpXCgtAJAVVsnqOa7MzjkTdMM94z8b6GJ83ZxC/ouW9HXs5DrcYBA0AUGRboIcOBcna4sNorRZLeFqHItGyaimpIXIKgMhLphdEdCtFB5FMcR8OsbG8ZNYXtmDxz3iUXjYw6/Hg+53P1x91WW47JKLsTwagRnYGu/i1lvvwB133YkbvnYTPvyRT+Cjn/wkjq+fwsraGpaXllHXjKqeNzOmVp3cdXtIsy1TAmMiI6TIlpACMVnK2QVAhD/p9jcpF6QsAmLBIiyUrB0hseMv6W1yxs3JKZoyTXv5aZGQDqshEbNotVN4T5wUxhxOa7Z13SGXSVEo2eIU1abr2+c7SV0UKui0mIzOl6AVaseSNlw2aqJIfQvXhZQFgVZzMkSC4m5Pga4h/3mB/26IsbXQRZHKA0CmiAvCMSKx3urXZrUYqjdPJgzNsCUKV2B7ewvj8RhrayuNU6qFk3W3jRO2wIQPQIb7wgpWK6h/Tp38VbOADcNFjGE8N9x6FuFz1FJku66xIxcE7KpDZQSFYc9gYOgKrJRLOFU3YUOeGI4JAzjlumiUW03XwYnOGhmIHsm0VjGDl+O3RM7ZddVIj/DiAdqJZ1lfNGJdQAe3gNTryOsIH/dtIpSyqm9iCc2sWm7oAlFIrVtAHdSk4lB2Ezyr2TK3F5fCiYdD0iDBNaf4dnbngkCk/d7eAa5dsJxVyrao57aaZJLNZgdwhaEbYLVYavnKBYqOwy9aaLKQCWr+dnHrwBVRJCPU1abJSdJB0T5I3Y0tv0fHAIi56VD2Kat0VqoM1ZkQHz7HRb6pbCvs7E5ioRFuLj0rouwREuqBlPY8KxZMRliUHvrIiEA1+ribobcxogy4ogTBY/3UKexbXcYP/+AP4tnf/z247j7XYM/qcvjrs9m8GQEQsG9lCQ++373x4PvdGwBQP4/xtVtuxTv++V/xp3/5Jtxw081YXtuD4XAJs9k0Wh5ZeMA7kSPJ4tDM1KAtX8yU5N7HSF1WJ01mMdDRRzflIiAxbiMjjgwtVCbVuYpdgujjp4SWS5EUqMYJrBgOFIRdlKDhSFo1ZYJoouPP4HoClETc3SwEfzJiNjnjiyk6p6sx6ViB+Fxx16kw83dL9zOjkmDHpa5Yj5bUoutKSiEkGEwFUDjAlQAV8K0mhV1zACLEWHMSkdfgXDoiq/RVGREuTYAqn0J192LaYLzupAKGdncnmEwm2Lt3DXXlDU3w7D2/xG5mUyjJRfuoHBMrvQoLPVAsOJxI2+p+T96JRWs7JEeN1a5D2rcarqQrK/RIK8UAtWfUQpxJ1G35LA6IRTzlt6FEod0PG6jXCb6hEenheWIVMC0bbCzzM1gXV9ENwdHhIdgFBFMESGGmoNoqEWD3OTiDkQRlqhf1gkglezmQKMRJ20GM0CXmCrC2aXWpURwfdSdLWtKWEfXQhm4utZZgagoasYiOygGWiyGcI3jqhCXyNKCjZeVpL2Aqs7Q+ApEVUVEyfyGrcNYxWnnrOlEi0zMdyAwoRs9Ip9M5qro2CNwM5CYjNLKAmT4qmO7yLLAJkXKiJeIpaluSDMJwNMR0OsF0MsZ3P+mJ+J8/9lxcf919AADVvMLueNIwOVwzDgrFa82Y1XOg43wUDldfcRl+6nnPwg9971PxJ3/5Fvzhn70Bdxw7jX2HD2I+ncgZlDlBQEdKG1GODCHWO47uBtpRAxEnaXrp+Jt0z58yHSHOC8Wa05Y8GvR04UUb3o62I+yIUyW9ZlBaTdJZxlec6O4UwMdio1mzHtmccONYM+P358wJ2cyuSbRLYXQ9YebvXMMLcU2oDXyNajbDZDbDfDpFPa/AdRXfU1GAigJwDmU5xNrevSiKAlVdNc4hRpsln/Id1BVmI7YmyzNQptlQ6OS6hmnKZ8dBcZjVNWZVpWmIlAtT67MGys2Z4eAMrdM43Tt7YFjjRHa9j4FY6jPOwJckXMh8innNVXvQ7e6hUTFATR7eFcol0uyJLaY4/CxO1nW2AjtpxKEkPKLd5G2Akn6PyfRPz9OFeJZVF01pL6Q9WB4yxDMSSIDRGULpgyj+LMzGiYwQkVKPKWmEpzxpR5ubFq0xcai8VGXbPfhO6181uUw+wE3pQCyS0TxhuRxgVBSxche0NN2dpUTEsUjUp/Y3RwsfFiaRDNfjo+eMA4jNXE5S6axMuvuW3nuUgwG2d3awtbODoijUjE1W6klFTlaRTdkoX2QWbfSJq0EKUqRnem2B17bky+VlbGxs4siePfi9X3kJnvm0J4IATCdT+LayH8hgo0IKKFs+Q2vXrOoa09kYXHvs27uG//FjP4wnfcvj8T9/6Vfxjn/5N+w/fBDVfB6CpXKjmOj3ZuX5J2mhNDNMNkAeayHUoTSkrZKmMBBAOQND0jdH7FKwGe0YGBJzai0xHUE2eoBA8BPfuzttqkWX2MxgSXnc1UYkQUPKlsfq3pDwoSjKg9k804k3iwU13GPogRR0Lre2e+VQoCgLuMKh9oz5fIrJdAY/r1ASY3lpiAsPH8SRo+fh/CNHcPmll+DoeUdwaP9+7F1dw9JoiI3tbbz7fR/Au977rxjXMyyvrmA+n5nRhiEImeALa4SIz27sllr3UPd5kZgrsBrdxc/YOYfxeIzxuNEJ6dRBHfRD1C84UfAfEnhlG2Nt0PEsFa1tPoF2IpCKdk9cAt6HMOkoxO0pPNtntNOILZWDNqSJw4av1hCKZ3wSAuquw8Yk3RY6U4AyhzqW4Xuq496OucO5QBxwhcai07h1Og9OBONRo0NW9cJ62FUuhPqo2X087ZO4mfLTUE4oIKTztoCEoSWakiw8tIlQwsGxtugw91jmRAQrcaMDGLoBhsWgVVa6tlNgNzWnVDISEJJu/il2lK2YS1mbxLSTF9p7zVynFzdvSGIZHQ4RZvPG3uIcnZtOSwp2iP9rDPwcpMQIRfOgPt8kVDNjuLSE06fP4D6XXYLX/e4rcf1112I6aRanQYsD5YxKPGgxOlxnd6MXDq5oEMh17VFVFe5xxeX4m9e/Fi9++Svwe699PVb37QczUPvKpArSWYVYnOXt6c+SenR55yaWW6yV5H4HeUJ8TMRmSUOA9cmBKFV+cs5+2MOLJysU4UTNSkRZK5nGXS/oLnDPM2H9dPL4QFrnEfhBTKCigBsMQFRgOh5jd3cHS+UAFx09gssuvwQPvN99cO29rsY197gSV152KVZWlho4WKCC6n+e9d1Pxoc/9gn89It/GZ+76VYsry5jPpklWQOMBZS9bMIAxDzankrJNHi0j0uta44wnVeYTmcoyKUhg5yCp9AXP8682LKI9PUCZxGyJpHbtmhzYc+gjJHZ/p0ufd17j1FRonRl1KK0Gz6xTBFNi+S+AxyLzh0pEkk6FDOGIz0GMNx+dR2JjT6YldsCZCWp+bWkREIVY9VoTrZoNpWmPBUzZ4JMYpUpIQcsWovqFCln66Y7Gvj0HTxIiJcUelQIgbj7MB3BscPQlShdERCKlL0wpEsIE8pO1t4RkKkuKQ709zGueOp7SExaV7C7QFWUcsarn8dOzMYtQpgwn9eoa874ePPzfuWm0mQR3dCjzOtnmI2Dco+HHgdxxwuvMVgeYf3MGVx/z3vir//493H5ZRdhOp3AgzAsyuazBHWZTuq01wk2U6wyoWi7BJ4ZriyxO55gUJT4rV/8OexZ3YNf/o1XYW3//qhvCfdg5IVTEpikkbhgTnMIegzwlB3ZkIIuMacceO7l5FmrLqvnSBPExEGfNP8emXFHTiEvW+4S2MTmWsj72bZYA7RECfrYaFS0bkBqIEgk+8mOVVY7r2a83XLVUt1aEZ8bDFCUJWbzOcZb2yiKEve84jI85mEPxTc+9lG4/73vhYsvvhCjQam+u/ce83qO6XSK2rOw9bUpomWJRz70QXj9H/42vv0Zz8GJzS0MygF8pYtN2cECa5eKtQRnu4vq0EQachXSDLv+kFPplZX3mFV1e504ofnFe5PTIiMjnlZ211wBnemSksgqoB63ELeCRObevGgI7D1Sz5kYbzJh5EqUzoHJB7kfiZGukwURWYhZEoKsEjVDF1uOk8xeK1UckLk5RncjhbcBxS/vd9JavXBohxyn6E5imZRcrOcGSfWW3S9JwWfsTeFtF5WjQK/XBOZaxgvHU0gjm/GGCEeJSlaK9rpZErWijaVB82HPlXgqf36RkZUJBMWw/BP4irD7BCIg52Ao2kpDyaSTEr48pAjGp623oBhtr50rHDa3tjAdj+FalTwUp4aTdMEFn0zccDny7hfuTEKVTpkNkdtBLVeM4XCIrY0zuOfFF+MvXvM7uPyyizCZTJrMhdax4ZkzWGIfNueWAr3g0EwonUO5tIT5fI6dnR384gt/AuOdMV7+qt/D/qOHMJ9WbTfKRQU88jn22ehrEhm32XuIe0/6i+1oJhWvL5RFigDDswEt0mKbEidFgSmpno2FrG8UR4vAP+i3vhkNpFFXkPHu9/Vdemx1ys7SgqE622LLjHAEbG1tYT6b48ILLsITv/Eb8Ywnfwcefv0DcPTQAXRK5elshnFdadx3+yy4ooHBOHLKKlzVNc5sbuLae16NF/7oc/DfX/wyHDp8BDPvRaeKkghlyozdsm1XE/LT7xvOJWUBhXOYjMfY3Nxox4SLLMeUzuO71nRuBTGj0yjg4178uQUGyQ6EdreIEAiSLfqmxa/GzqrdTqHbO0DDk5nLsGc59uwydeT704t82OS1LZgTaA8TkkMntUJ5ysDjdFEvS+4MO7JzD1GGncXy8BIt0GVMcNMCLl1Vi6APishGWY3KuN9YJVKollIeumvmNupE6yPSNUP74tY+SC3cp3EMSNSma0e+sbPArrU+tOlPA1cCzrW2L8us7mtTNS+mC8ew1ipZqYUmYy76NyO065ILmYWqXwk/YpFDFt6SOerENMBWZd7as3Z3d1HXFUpaioszG3UvSaqjmMUqfnXKMtMJMKRFSCSSqJTqW8y22rmFcw6T6QT7lpfxule/Ave48jJMZzOUg0EUYLJQzXdinhYOFCxA3scquW0NupbmaFvEZVmgqpuf+8s/+9O48aab8Ja3vR0Hjh7BbDpRJDL4dpEjM5cjStqOUqQmN0xV+nHPLi4dFGyxCKbFynYUwLrJyFEb43MwAGOxZ6swgw1rYr1JExv6AZksAyhKHhvlKkGnOFKSspR2NaTYNPm5JtFR8xQSDCKG5QBc1Njc2EA1m+G6e1+Lpz75iXjqd34b7nvPe6jPqqoqVHXd2KeogCtI5JiYLqGj0E7uRMOOmlS7x3zdI3H40MGmsB00VDq1v7B5v3LNyPAf2J4k1XiH0yRERZRr3VZwqHyNnfFYkOU4BPHYsB7XE1MuU2p1GFD/qDlHkCWZX5CszUK0jda5FjbmGEBFMsBIOAq8tCg6oECBgStQs0fRkOSaz0+EOzA74e6gMBoNa33bBXKuoQASSbc7qXA023XvDrhRS+MQGU8sVl1O0fLgUBDF/ZI07VXSIBU0ixoQUKTHiUqjoxEFAYdXtowupCZP/IJCHqrWv+jLNBfLK5GhhBWEn0EtH1oUE127nXxb+zrdNnOiRnEtB4AAFFSI9meGFR7gLtGlQNImJdo/JFpyzumgC8W5ZgPj4HREqUcvpBLplGDS5spSaqvpdADNNWm+rqprQ3OUnzGLMYqMXLUOARNSQto/zhyFK0HwxTonXheWpBG/BIy3t/HKl74Ej3zwA7A7HjckP+c0TMNHp4avPWZ1heXRCGWZtmUn4wlcWWDonEa3CjXvaDjEbDZDOXD4zZf9Aj7zmU/ja7fdheW1FcyrGo4cnGH/K8FcYnmUEZyshnuSmaG0g0n+QrTfaZM6G50JC3tikmwr5oLSp09J9LQU2OU0iLA2U1kfmMIixhnL8YjkmKdH9FxiWZxzcsa1oK8fCwEkEZCcnzmSTbsWclEOsLW9DV/N8bCHXI8f/v7vxRO+4bG48MghAMBkMmnjwQuUZYlyMMBgMFAbYUyq0899ju45KEsQMVaXV7B/zxpu3bob5WgIVHXDCxD5Bf0zdGOTzERbhUOIMJkEy5/QC1Bm7CczWXx7nXrUYWfVtOTGE6FAyXUqiNQIjRfpChSnhbKQmz7IWMBjUyf0cyiLAq4dx4S/5xAzOExhHJ47Fw9INgAuxfVSFjCmLdg6TE3yefTzbPgdJLt4SELYWIREkFgLyuQ579SXqjXc7X60oM2WISMg1X8Fl4eGggpYSrfZOvEh6shTThCLrKNkMylWBDJ6LllMkEYndv/fISMY0huiveEJTszPehBfZB8KpJGxSWY967lYVxzxAvtAdzp1DhubW6jrKsRd6qrcHCuCb9Qs0kKlnOOXJ0eARIeWWTbaMU05KHD65Cl8+zd/M575XU/CZDJFUUSUp52GVLVHXVVYWV7CiEa46dZb8eWvfg2bW1uo6hr79uzBPa+6EldfeQUAYD6v2iwg19hKW7BT0yxoNoPd8RiXX3whfvHFP4Mffu4LGgtqIe4LZn0KkEWjFNRLJXd3zQipFc+K66RFyKrlTbdGKrFJbbI+dt46NXDq1zT+Gnlr2v8PGy2WWG/T/MboZiDJQViQZJl0+rT4J+N60KNL6u1Xi7GG9/DwGAyGmMyn2D1zGg+97gF4wfN+GE/5jidgZTRC7T0mk2nghLjg8V8sx+xGgY5cFgPt2aOqKzAPcWZrCyc2NlAOSrCvjcRhEU2RlG36rIpSpf63vCmJbOcWngNMZ/PMBt6nkcoo9xYolhOHgkmOoJwVOpNsiJYMK22wOk7bJAmG2HozYgidgZYsSyTQnFB5LWzW6KS3yyZKOsrJzeigtUdKnYeJY2f2oqtFmg9j8jDkvhgKXAURUe1kkyjLmgNghhtCgEBpO56NhYk06JhbQhknqdcy01ioKVkDVCP72aJKdUBEt9hKRWY2saud43iRNAhjo1j4cJuvCoI8IZKyaWIJHRGGJS6TwEwqYDIPI2vjaR9gr09E2dEDAac3zrStqYZKRoLD0ImwmGRSGreLNim1MKfm7dRtzLKwYj3PJMCi4pwjzGcz7F1ewQv/249idXkJW9vbWF5abh5OCb1pZ3u+9lhZWcGnv/AFvO4v3ox//tcP4Jbbb8N0OgeYMVpawmUXXYTrH3Q/POcZT8fjv+7R7d+rgaIAM6P23ORBdIrYcoDpdIbv/o5vx1uf8Hd4+7veiwOHD2E+mynHS4KCFfabaA/kTLwwJTYchYkmnRRobYBa5xJxz+reY1JRzGTAcJwL2VFDHT0+sy2rINw1+k6GJQ6mVjydxscaCMGU4f4jwfpSRvKv4Ftm5hy6G943yO+iwPqpdZx/+Che8oL/juc9+/uxf+8qvPfY2R2DCBgMBlEN7lLVO7ejpy6VMrSZZcKg8dv7ukZV1XDO4T3v+wDOHDuB/Rech3peNcml5jBhw4Q064SSPZYMkjPpsCHnTBKQY9fgwjc2N1PLaAetURsr5/MthD7Jap+Sg2GS97HYCEM5SxQr9KXmIKQoBLWJd51k3wqmg+3PdONch4A2B1XVmGpPl07N6ym7h3RrLosul3PxIMukyZ1iepowFDQSWoyNiZOHk1mOBsIIwDq1OGGTy2NdTuSHzAZOfYZ2tiJ3TgpZNpPnEDCcSYzTfngtICHjZfDJI5aRiuZOJpk/1q2xxVInbX88ix2OOWmmGvKJiBJN09u81wVI9/CNx2MdMZzh+xK0It9GAS9KDJAJbOHmtsdXSn2aDKAYlNhYP4VnPPUpeMwjH4rxZILhaAgGUHtGUUT9xGxWAWAsLY/wu3/85/jVV7wap86cwmA4xNJoCctLq6CiUe3fceIUvvr378Lf/dN78cPf81146f96Ifbv34d5XTVVOMfciE7bMpvNsDpcwX97/nPwrvd9AFXtI8EsE1BkTULUF9kq/lOL+jmj+mOzY+tWezJzXnAazDvm5EneJAaq09zZVXwySofP7QuF343zf9Zzis2Q/s2JRolt4roBYDAaYTadYOPUJr7zG78Rv/riF+F+196rUftPJhgMBhgOBzJMullIvS7mullv9zJr3+lPWHU99Gro4T1wYP8+/OfnPo9Xv+ZPMdqzBl9VGbahORPzAmNoNlyCstJNhXPPHXLaz2Q6myW2u2zRwD0wINnKT9T7nD2cJLqWvmGDunc0KTCRKVNfFhepXUym9LmMdVSOOMnEo1vYGlGS9hMF3qSR+VZsHsF7LO5bTrrSZBMk+z/RnpGJ/v1Sp1KJDG3K2zuSh08ocw2kNlZhJus8ZhXnAiRk2x86xECzMWO7SCwmCnHKlPjo+SytqdzN1DdLkjx/608lbeDsnWVpkhSnASe8wBdOkubHKQdaFDeT8TQggjmV58dTq/D968x1k4fOotuTK3jI5KtnqnG4pkVW1R57VlbxI8/+AZSOMPMMVxbtA9rOrOHh66ZSHw6H+PlffQVe/ruvweq+PTh05Ai4qhvUqm82dSpKLC0tYWVtDb72+P3X/wW+euNN+ONXvwIXnn8U09k8Wom4K7GbQKjZbI5HPewh+IbHPRrvfPe/Yv+RI5hNp+3pgNQtaIABOqUunBRMZDYhHbkgF4XL5o8pE4IisdCpgFUhgWSgEEyKI5twG4U0a/8Oi+YNQ4WO8KKOmTyRcPr8qJVGQakoyS6gJE2SUzR2Z8dlgBxjNBjizJnTOLi2il/79V/Fjz7rGRiUDrut4K1sx0yd5kh+e2/BGgDmdQ2ua4AIg7LAYDAIyaF9/8znFd7+T/+Mn3npr+HE6XWsra3CV74RDxkmA0LAGhsfP+ePs4klRI7oSAkCtRfeWHKJUVW1WRNbxqtl/+cyPUhrxJAJS5PBPMkeIjsI4vtlokn7tQaU4cgk9wmFUZta342Gh0wEeAK/M50WQtodCVMRmC6Oge3pcYDQ41B/WJlkAEgbqRz3sPlZFEa4igOQVoexc2sgBqrlbQhhpEd2bJObiBVASEYBs60IhRWAErgOK7GPz40jmLLzw7oLexEiEJwDcENy/RNdB2faXD0nmt5iAprjnAW5ZOac8oFJWQCx8pnMpkZwlwl+NxV5FCVpfjyysKc4v7SYTFnMhBq25VkXgwG2Tp/G4x72EDz8wQ/EZDrNHjnq2mM+r7C8vITfes2f4eW/98c4eMF54LrCfD5vCz5hdak9am64As45HD16Ht75nvfj+S/8OfzV634Po+EA3rOa8wFAUZbwXGNpOMJTn/gteOc/vy84FOTmxuaoEIU6i1olnOSgKyWbavFzjrrTeyJnNt0skr/P6S0U6j0tQFL6Fdb7Cyd0vXh/KE0AIT3BiDorf8o3zQCb/Mc9dCWx6KgsC98qvIsBTh0/hkc9+EF41a+9BNc/4H6Yz+eYTisMyoGyOzvTrewWVt+6TKq6cZesriyBRiMAwOmtbWxubOD0xgZuv/MunDp9BnXVILeLolGU33nyJN7/oQ/j/R/6MOa1x57V5eb074qU1c/ICud03BTH3AlhaMsSnmyjiK0+KXIAwIzJeHwWsNfZIVX2oEOURhKfzRmQAwdxLmKdEZMEwSb2OH3tZMZG6BIAzXxcHu7IFFRyL5BEypBuKCzAFmoULIUgFcuru102w4lj+1666kjv3WQTsjNaBl0XdmmAnB24mMXczJ5N+AFcCjSJGgBdmQbutudoK0KE3XRMdhW00r5xLzMK2qheR1Z+ZDrOnQqaHKb1HDUzChEYJFszfS3/EA4j54osYB8K5ZSjk+VveCLKCiatSCwsphk1rGRwS8EI+1gY7OzsxhufcpYzMasPanU5miUFXZIzsiQNWnwRwS5SojPUMgp8XeE7v/WbsLK8hJ3d3aDmZ8Gj995jeWmED/37f+Llr/oD7Dl8GEQOlTf54Z1tp+nVAtQUD9VshgNHD+Id7/hHvPLVr8HLXvwibO/sYlgOms2dBHCjvRSPfeQjcOUlF+HO05sYLi2Da6/y5dWJjG3Qz6LN2jLtKW3oqXtMugXimV6PvjgTHdl1YqQrQRQtJDYYIShipcI3HHcHgTrWM0jYTA6ZTtYtzrlhCVM+bppyJDhWpxyVWeC7w0WNohigBmH9+HE879nPxMtf/D9xcN9eTGczFK5AOaAAAbTODo+mpe9rj8rXGJQFhqMRllor8Ge//GV88jOfx6c+/yV8/FOfxu133YX1M5uYzObwrRCwS8TkukZdVWBirC0tYXm5aAsEp6xzyKRgh8WehYshWSsIWibEKhYWbBAWlJnrdQcIZkynk97OJwtiYxYnwJy70VWmDDPn6XmsnSDJ/m80YSpLos8iS1kYidqf4IDduslJIdeK04WljlpnhOvs2hQdVNym9EV/vG61cYcnIJHfYuBcUq9BttMjSZgE5fqCKBYTABticmAsvMyBo31Gy/557oKE+Ew4OrM5mdps+qSu0wkmYRvtQC9kRWaxpU8mgYEghU9dUiFn4k2BSV2h8jUKVyiCIDK+1UVBJuHkYDzZuVmobsvrQoBFhjWbZL5EDIjFeoVFhL/ZdNKIVIiUFoJIbtNsFqI4WlAtSeNp1+NjyhDppAugK7I8iqLAdDrD+UeP4jGPfHiL7C00eQvcFGzOYV5V+J0/+jOc2RnjyPl7MZuOmyRFbzo9oW3bngy9R+1rwAPL+1bx+699Hb7lGx+HRz70euxOJlgaFPrUSoT5fI5LL74Y19zrXrjxfR/G8upezP1MEMby03U13xdaCM3CEMTKvo+VYTzRnMzykoJbPOSBA5FBVWfnttLmClvAiZM5p5Ye9XSzFPCK1MdEhp4ZD8gipTt98dmwSZFp35z8a7iyRFVNMdmd4jd+8Wfxv37y+ajrCtu7u1gajULLv/OQd6dIH9LUGNP5HMNygLXlFYwnE3ziM1/AP733ffjQxz6Oz3z6c7jr+HFgXgGjIUZLyxguL2Nt7yrIFW1qIMB1DV/PQb4G6hq+rlF733mG88FfUoeTSfmgLFmSYDzZyYYL1oRU6kGPV/NqgZhFC9UoA+9RIXLZzsOCeT8vsO4ZIrXUUHVBbZzpMPRDuqIQdVrPUKPR+nRi8bA+t2tmXKcN7Cq0tHwjFhSagmjpY0XWJLa5CGnKitbwaVcQkx7u2cLIjiVYvF+rUSkTFY0IHUFuvISIhiQj4LXFWxQpdm05L7ikgKc4++iGb16Q87qcZxaiPsoykyVII6or5cm+u0hzrlBxjRHK7Aa2aOPOYS5Vi6UHb8k9p/acZ1S6LTTdj9TDxFk9htQ/mPdd+URvEGAaZIlTAsfJ+ialLGM9d2LL+wbkYuOKAuOdbVx/7YNx1RVXhBY8N8PX5su8x7SaY21lBe/70Efw3vd9EHv27cF8Nk0U4WxET4TOUtP4duuqxvJohPVjx/Enb3gjrn/Q/VGWRTf+VwKi+WyO1ZUVPOQB1+Ed7/1gk94WhGW18iwjS9wmdTKxIs++8jpG+ca/H1XYohA2qm4iCxnKNT9TYZbS+mKBBVU1dmwZ7xUhjZjyDlES3ALWo4SsljFZhFiXIwEC2RZ7vkJRlphXc/Csxh++4tfxvGd+LyaTCUAOS0tLKEhvpx3Yy/tm/u3rGqPhEHtWV3HnyVP4p//7r/ibv307PvQf/4ntM2cAchguLWNtzz6Uw7LZ8LuCxfvmfqvFa/Yevq4bu59UzYdTsRyqyUMAJ1HnUonDBs9FizpOlHFXkGj/h1/6UAB40dnsPOTKEYGs8T+9v3PjwAVFQPbPZSehZ+3ThS5nX5/NJOzu+2ldo46CuBDlq6bbHXaVtFiQ0rlB2OOcHYFmxFAKwtt+DxeZ49FayKSRRyS7g6wTEbt6UAZBOdbzt/b+K2NVaKMG9SBBwT9MAIoMLidhC6EeJKSaq4PVnFGCRkLyV7Bs6LYzJ/a/VFlJAnnhiDD3NSrvgVIIjc7C1e5rhVFGFX424lX2e8pYx7OANBg4S4BGLGo8M6hovsd0Pg+M/MRryzDdB0mP6jYin+oFmFKFKUVffLZSYFaJiNW8wsUXnYe11eWGpEVi9NC+3y6l9x3veS82NzdwcHUF1XzW0tYQqBJqjh1inaHyJqq6wmBtFe/54Idx2x1348rLL8V8PkfpisDAILjw+h9w3X2xNCjQxCg4FYyl0xDb+ZxUfyfjHkEHltCnTKeHKJ/gpdMA05+VV22z1i/Irpny5wsGvxAeUYJ7tRt1hjhnxFLyVJC09k00b/oskXUZC4FUt3fVKIqG4U+1x2t+97fxg09/MsbjJuZ5OBqgcC45lXJnCfbN9ru6uoKTp8/gz9/8t3jDX74Fn/vc5wEClldXsPfgAThuowPIo67moILDqZ9Qm7l8mykhN22J3BZCudAiZo1mTGNmOBVtyjhn6SHg9GTOCT5Yh0PMZrPmlvBx83N9OdLUL6jOWprl4YVo4RqrGxyU5gwkMetpDgHZ3ASTUdF99ZSrUPDIIj3FvMvYb84cnqR+hfXg05ySZVeuE+aREp6mCX9y1UAmU0OPI/V+krNFEjobYGghsT0SZDZsShxIHWhDLUnMulUl2nphpiVmeQnJibUF0FkOgVjA2NgRTR82vH4HwqyuMPZz7ONl0y4RSF9w78bN59CCz4lg+v5ueiKjrE6gD//bP62IpY+vPHZ2JkDhEk2stAayAVuwtKqlQAY9p8yOgpNMSlGo+DZ1j3Hfa68FAZhXFQaDgYqgZjCGgxKT+Qyf+9yXmtvUN2r/kM6jIFTtKYEA8vFMxe1Ajr3HaDTEyeMn8eUbvoKrLr8UdVWhGLoW0NG86s4PfNEF52N5dQ1VXavWIJJDc24kwkkEsKJ7JcYvyb43HG/JCFAbfzrqNFV3j5AwqoHJ2sWMM5Fz952cLwa9SGaIyDD8gx62QE7lLC3AiQI6FnvMjMIVqOsafjzDa3/vVfjBpz8Z27s7KIsSg3LUjJXMZfLc2YOBclCiHJT4m//3T/j13/kDfPazX0BZEg4f2g9PDtV8jrquUbXzYJALdtO4DsW4mSAKFcwLJhYkTEq49NlQG1bd6t5QKb0GchorSD0xjSY8aD6btSfKnNj43JIKZTT8WWIt0vVOHYn5bIvcQis2Z6KhbfekZo+N+QTWt85GDyUtfcyiyOrGXD5uuOFwzj5yBWyMpcWKqsM1m7yCuL/G753ikaO+rj8sk8zPcVZAqk/SpimnwhzYhMqwUYTHWNZGaRwLC1mYRRGbVNaLUAaymQCiEpMnEtIPFrUbAZkWfcUVNuY7SYBJxo0YXpvdzKXdZVEFnBsZ5CretHKND09fMSFnztKppBwB3Xt3QMVeJ7BlPl8ylXKXNkWqpW7qw3CibXQMQcvAXTo31FxXIiyreYXVpSVce/XVAd2LFsYRu6oeg0GBW26/C1+5+RYUwwG4mjdtAfbtCYtD6iRaipaysnXfzzULd1kWGM+meP+/faRt/4osgfYadxbB848ewZGjhzGfzZqF33NY2Fk8JvL+ZJ3SpCQJYDlKEIWwPKYQtahS7VDowpSSCXj85tk8WYvs7UBUrCQTUfgnHQDh2Q6dI9LAm4QmSaElq9qklJH+M0TzW3VPVauaqcmHJ+fiv9092zo5PAjj7R385q+9FM96xtOwuzvGoChRFmV4X/J57hC+hWv4/P/8gQ/jW7/7mXj69z0Hn/rkZ0DDAeAIW7u7GE924ZlRliVGowGKgVPBL9SmRXZuAvZNodndUx3ZLSaLksUkqc2cTP2mH3lSnYMo/uSQSy/vHbVIM1LLm/naqk3B7Aei0Tl1NhPGS2a9y66tZudhZF5n1j6eJhOquXtXcEXtJxwRxtUMm/OxCMMQ7X15cAsbEUVNDolRSghga5UlouPCcpGWDAwzPiDZtVFjtkh9Zbm/5EiRHItKNteSrDWXhQhQtue0ZlGcXRoJcGytdxY0JS7JtcWdSCiSfnVDz6JO6JfyA/rC1lm1YTNGBiOmqUHYrmaBVGjTtIIHnnR7lXpIfbkb3OIoc92DlPaHRDx19o5DPqWQTahGVdXY3NqJ/uiAjNVtRNUlIttOInFzwgT9ZFNb05Q7ef+DweyxNBhg79498UbvDvOuC4tqNCEnThzH8eMnMChdO0+VYCgy8bOZ9yGO681pkHHL7XfC+7o5CZpOUtfGGw0GWBkMwFUFWhppYqJJWWMxNJQi2AXpJ2LjJYWMyjHhSZ0i0+9NYmbYp8NIoFMkC0ebBc0REmT5BeHDJJWJkXjahYtHtuyRy3vP/FzKPSuIVEimJtp58+RJvPjnX4QXPO/Z2NkdoyhcxEi30dFiAhCez8lkij9+/Rvxhre8DUujEZ74pCeiZo/Jzi7ObG9j8/RJ7JzewJnNbWxPxoBjDFdWsLyyB8XSCEwOXNfNtXMyb7ZdJ43YlynVDGUxUMJGEroGomOSTIEML4SEgpxtc1e21uVYkRqwEZ/d6de7/rE+QSnCae7UbzVWOQtxViCoUMZCpBdseRw0YzpSV3dFJr7CrK4D05/kfc5W2S/GdmE2r4w7WRJt6JQ56u1LyPVXFuPMgOvSc9lCt1gdwBI3aAqYUEUng1ASUhtgo4aMMQKezfyQhII2YA07BX88RXlmBcqJN0k7s3X6IWCOfvGgsxQfvO8WhlYg1s2A2azKYbHxMf3JhxqDsDmbYM5t+4MtXjP6Le3N7b1PbtZeH+s5Wl6SitwUDLlgoZxSVs67SIpxWnZ2Vc/j/F+zlNTGyTY61KQF6qJGrECOBRdeMtsoQ7RrK11u1bOU4RtwFwHdZPvOZnNUddUAV9rNipxOpusEZboZ1W1eLsRMu6IAXIHZfN6ioSkIwRTPhaLCmFgs6gE4Y2eDWntA0NnepFp7rENGgvJbhPywxvVyMoKQ/mfJqSAFfSEZ2SxpghYDytpdY3n7nINTSReJQrFC2HEpSfFLF0hS713Pbkl097oQzebkPloe4eTxE/i+p383fumFP4nJZAzXwn1ItP21WDJ28ibTCR776EfiB773u3DwwIH2Pmg29FlV4czGJu48fhw333Y7vnjDV3HDF7+Mz3/hy/jCzTdjevoMhqt7sLxnDYPhCLWvUdeztjPFrXiFA/TKmwAm23amENbDGfmmjl4HmzOdAsiQYTek4yI7M+8ejvl83qSyOjrnzV+tbWKN7IWrGXG1/O+uM5MUe5n1kjnyRHQ4NKmRmzrMtb/r2mdvaz7F3NftWEdLncm196ODNr2Jw4IXI7CIg+bWXsqxE951QFkaBdoRbdudJQ5JHm3Uu3SbtQk63hQcQdDowz3FTCHmPXJAOLqChF6rzCPy2CAqRatGYQvNLJ5lMJBWEFNiSYktiwA4EM6BLrVLpw+SAKVoOqHqEoTwB2EFo+gw2Kgm2K2m2FuMWjADaWAm5x0AllJlf+9s1fHZLC85KFHsPpxLsLpcz2OVWHvfeo+VlgimKZzmr0AHzqTMN5gCjBM4bO8iQmh89a7QlhN7Tdpj22g4xGA4bFINc0JTVVzo8AxW81bX0tdEK5mEl1xqd7u34mTBk4rfEr9y2koxBEZOFdpqvs+5bNx2kyTVTidhl2VuUjF1MJY9ZVIiNgyLDSiNnFUOA7l8UEolC7oeSuOJ7SjLWpdyDgYSpxaVeNK8msFgiM2tTTzg2mvxWy97MQoGZrXHcDCIeRah7c5GJNt8v/379mH//fa1sKkade1Di3dUFjj/8CFceN4RXH+/+wDf9gQAwJ0nTuGrN92Mj/37f+Lv3vNefPHzX8KpM5tYXl3ByvIS6ukUVV0BFFv/jYaWTOeGMoRbKfKL4BfVHWEdF8FGC8ASumXGSJZFYZ/mumo2GcYCbsCCA489wdMiG/WChL9z+jtS+R4E3wmXOPx5YtklYH223cYAF6A2RdYGbzFTe0gRQWicgkA5sfCR1qslUeGs0MkQuhaS2SEkD1SssjhstoFKoGVxIBJ2EgnoKi3fvlNce2kPkXGS6oTWZiaGVkQk9ClgR+vFpuB/ja1lBwM7sO1N1/y/cOonkqYDYWTh1K0g/jcs/44wrStszCbYv7LczMZNTEGKLOVzOvX3bfC5SvbcGvo5FFY+PcMWISyqqXlVYzaZNdfai5Q21V1gDU80BxEVU6w23CTKyppYs2+yu699VWPeeY8zi0pnCd2/fx8O7j+Au46dAI0KoE1R45CARUrAFmZmLs68m/vBwVMBOIfzjh6FK4p0vCg0FXXtMauq2D+Ws1MvHQ1C1pcT5YX5XWwban5C9NRKGh9nqWQ5xKS8rmlQSyoW1P4jsjIpTqlkqpgIi5Lw+GeGDdR3g0umCfKI7diSdZq4SA7kgArAymCEV/7qS3DReUewvdP4/NV8lHoImuraxKK/KAp4z60S24O5hp/HrokjwtEDe3HhkQfjMQ99MH7iec/GZ794A97y9n/AP7zrPfjyjV/DyvISVpaXMJ/PGwtgmzIX482ltgLKnsVZNoMA03TdVmGJZJCCayXCP7KhUdpNwl1qZEHwqE2Mt9DT9GqR0Ms5sXjfs1qqM+jfbrIiBeYgQjZvJpOBkM1TcIRZXWNjNmnixlWgFOm8KoE27z4zub4mXSZRpBLLjAix/ssODokCkKA0NJzL/KB2f2anQG1mJq6Irzr3Jv7aBYtIVzsSqzYHUzMCYGHHkEKFxMOrRGgs0gFJsOg5wAwgUrRY+BiZu9YQtXAGUq2tRsTkgnAk6r1IDxlJi0KoVX6uT7fjdbCbfybWJHdDnyuMJ9ch6Iv9tRHGcSMVSXpi/tMrxuGu4HGofY15NRPq19RfHdv1FKgbYaYWBC1SzCKEXe2vKfhRKe0ocRzBdN+zcA7b413cfeKEgnlY9oGvaxw8eBCHDh1Axb5RX3Ns9jc7PhgAAQAASURBVEQsBgcUMAvRWjz5OhSuABgYlAUe+ZAHt4JD1xS/aBLRGvRrDXIOd584ibuPn8RgaQmefaQGKokOC4++jIcl5aiQNrtwUqOYvNm162LaHxnAEMWPKEnWiXixTtSn7ztKYwEVLp0UkrZ5vkQAQEeLpJRIF9gRZmREqXlN22dJ5idIFLJ9frsPu+naMDPK0RCbZ87gBc99Dh7/dY/E7niM4WDQFgukkt3YGnXbNch7H/UyXZqbIxSuKTydK1AUJQblAIOyxHAwQFE4VJXHZDJBXddYGg7wkAfcF6/45Z/Du976f/Cbv/TzuPjIEZy8+27U8wpuMBTptQSmor0GrtXkiHkuQwCTOA29E6JAJl2tM3GWEkpsI8s5SX6Vljf7WLPRCIDQO4K0Oqic1W+hTTCs5XrkGDp4QqujKKiKWtiNzmQYlOzCMRgeBML2fIrteopBUaAg1+4xlpoo9p1Ww6EEnUyR+ihppGZNJ2vX7QKL5FhXFOoyS4GEnoHEzJ9VN6DrFLNYzckUYPFZDImNWrNhZCbMCRCogxCEb8JxfkXmg02sqtBeS12Bs6iMxIwqCAfZQHLE9FV6hY0bQVoQ28BHgAin57uYsc+WiNGJkLHxnaXd//+n9W9VnaoKtSlypuKkXCCYfFhbIm6ncE/dHWnnOQmmkThfq4DvW+hxtli8pjiZTSb4wg03mG6jVveOJ1Ocf/gQrrvPNfDzGkSlQnrYox4nJV/csZrKf44D+/bi/ve9V6APdoO+boPoQhXvuOtu7GxuY1iWSUcExquuUrFzKXgkyIsCZ704xStX4LGCF2Gh8UfaB82mwUYlbsO25M+zFiZzv2TjaGSvmikfcQteOGpm8Rq6wqgcDLC7uYUH3PNq/MTzng32HmVZouigPNCaRN0kF+4jcOJmkEFaZJxFZeEwGJRYWhpiNBrBOYfKe0ymE+zs7ODSC8/Dz/zEc/G+d7wVv/izL8ISETZOnsJoaRgLRxe7ARAjDhU1y33PD+VvLI5jATJqeKa+JC6DgMihdMU41FrObNesr53f56Tqbf3LVnYPWyDuJKx1IiQyKmwCK6dpnKdmO6jYNzz8lncgFf52YSTWgV8sqqUwbbaJXKwhQMqh2bO/sr75E76LFHhm4UKdDomQZMTYsDIn7XMKUkCx4kgwxBCKcNUepNCqd64hJnmh7g58YrvoMLcXX1qWOmuhDwJDZh3eQuKm8Rw7FSymaSxboO3fLpzD1nyM7fkYjhxqWSV3czembLXLPUS/RRjhRWhh9WCECjcuTlKeF2e6Bu2qhCamjd1a6Xw721SiR5mfTpohLU8IKVGOVOdEzrBJnkhMVrZydqDp4KBw+OLnvojpbBaEXczc2qc45GQTgK9/9CMxKAtUdQV2rROQWWCT28+ss2e79ro4F4Q6rhxgZ2cHD3vgA3DV5ZehqioMihKu7QIQfLTtAPjqzbdiNp2190UdrIaQGyMbq5JKlYvVeBSzCUugWExjgcuZU78sOATchfUYQc3PicRizTLhy3xN18foTjiRIU/iFNR1b7rOoLzvnMwCZdGWVk8iop6FcmH25hAQGw7qy11ZYryzjR/5/qfjyMH9mM7nGJRlvFfCvS1eO4l72nOjefAAeQ+qa7i6gqs8UPvwrDlycEXXDXAiITF+P+cIZTnAaDTCbF5hNpvhgiOH8bKffSHe8fdvwnd809fjzPFTDWtgOApFqAp/ajdwFiPM/GhPrgyyODKdICngtSduBYYS02CWZ02dmpcxm2UPDHazl+4pK4rOdQXkIQtyDRTzfWXzlq0osocBUpu/Pg4QajBOzXeb9j8RHMv0U5MuKDt2YJWjxgaF3Iy7ZTeHWy1ozMIgjvukirkWIUXMvhX2hbteFfN92goIqyBy4kloAJ5T9SLBnGRIjZE0F5ZErGhsZapKhywjD9ofaQhlSZAO2QS+WJGQOIn5DDUS4ubW6zNhQAWmXOPkdEe0U8WJ2gi49M0KdSP+lzf5Bb5+a6GJ1R6nIBSmDOZT+3zDzV7X8LVv9fR66ERMiZWOBKVRd3DEwxw2hHi4U79WLSw1zIjfwwODpSV87gtfwu133oVBUaCqKnDNisNQliU8M57wDY/F1VddgcnONgaFa2e0aR6DCqk012buKxRw+P6nfxdWl1dQVVXrMYcqeIvSofaMf//4J1E1cwhw7c3s0oizkEKVSN039koAsGLrdhQguw26JWvPhSRGBrHFq/YRG0vNeZJk8lpk24KNh51JMwVAWjNgaJJkq9KehGNVxMoGbns/FoXD7ngXV158Cb75Gx4Hz4y6ri3qTRSFtlXRblJe/usba2mr3ldbrPyQRYEeNCrkUBbNqGA4GMIVBabzCtvbO3joddfhrX/9Brzi5S9FycBkMsZoeaklCQbZPAymwTrZxazeHrvTITcbXgOYjEI+hTVxjznt7L2lxQK+s62JveFB6onS7U+yvb12VCU7j91/x7/Gka+BRsexOR/jzHwXBRVmZCWeUjKkfuZ03s+kiiyyikvuuaLt6ZyJdTaDoqrpFD9JBIVLuxuk1nBddFFc8NVrcI0ozAfVYHODe6uZUbjVcIFJWq6EGqC7qbuNTIon5IGwfWdezCeissC3NkNS7RaGbzGVHXTDnDCctCpHu4ZrTymu7QAUzuH4ZBOV9yhcVFwyW/E2J2dfayWijJ0lO97oscRIqIg6RZpoVM7dgD3VNwSkpPY1Kl+36ncyLTEOopNOHBPaPbnihORNJLQIxKoQ0DTAMMUKpx8qHDx7LK+s4Gu334Yv3fAVgNpihbkRYtUt5a0oMJtOcd6hQ/iJ5/0QZju7gV3O7WmcO+gKfDzFi1OPZ49iUGLj2HF862Mehe/8lm/CbDYLXvFQsLgCIMJoNMLtd92FT33iUxiNCvhqHvMszE6c449FX67TGe0sccisLIOU8E6kZoDytEeCoZeJbkJ3kupeMsjktLOK2aZkImAU6ZCJkTG7I47GYlehY/6zgEQEYiCzqtQ40D6dWht0F4xD+ud8OsOVl1yCSy88vylsVVQzAujHiwKx+7fyNabzCuP5DJPpFJP5HNN5hUnlMalrTKs5xuMpdnfH2BlPMJnOMJvPUPta6Ws4ee468A+joAKjYgnbW2P4usYLf/Q5eNsb/xgXHzyI7c0tDIajtsMViXHcjiMpdFWa9+wo7fKRmmxRdoDEwsrJQlzKGbCbTAMkcmYZomT0wwal23fQUePgDPFU/quj5uPvd1Cw2M6mTLaG0f9zmq6quxqEE5MtjOuZyoaIexMrSGI86CIUvmFNIw4wMll4yq5NJ7gOXy+teOzCgdh317Y7YMmcCCHsJQkdYql96nQfosAiU7iyHiU6O/6LhS9BFxiyGyDEgGD9QJCobkkrU7MRk5nAikAZlOKKLvrUdp8odgD034uNE0mn6j660jmcnu9go9qNDocFxKpsRKUQpSwiBmZtMbYdZpF+SE+veU3BghztzlvLXsdDEkzHhtu4ZWtIQk8uJBnVuG64qlEyCS2IHDfBAXAYlAPM53O89wMfbAu+xvHRFXndP01y4BTPe+Yz8IynPw2n77gDo+UlEHenNwb7Ohaz8HEEwh7D4RDbG6dx4aHD+JWffxGWl0ZNzGdhIjt8jP/8xKc/g6/dcQeWl5bg6yq2/mWmOmWCSUS2A5lWLYueNjEpgJ9s/4eOAS08d2WsuxS6CIDNh9CfOXNKEyRi1eWRrg7KiExIdAHCa2doWyiJ96HsfDmnAPWeQ8MprHNfuDYowrQ8rX7AM6OqKsyqORiM0WiAtdUVrO5ZxerqClbW1rCyuorllWWsrK5gbW0Ve9bWsLa6guGwbBI0W4ug5yadMoyqxPPLvo5XxxFGwyGYGZPpFF//qIfjLa9/DS49cgi729tN5HV732pRhnTmkOkF5OTBOXgOpR4M0gNwMhz9cCJ0pDbUtFtJKfRHHlR6Tvh94r+8hVquiakEItX45HVMQYPLutCec427p9vhdJ42L6jXupLQlcWYjHVcWjLelS1JL9NAyfiYWQ0cREqmiIlOiqwOJJdzDpAYX+l/Si0WYs16l+klXdgEae6/Ih2RAByIBYghscDdbD/mXeV50ZQNj4i4JMPQDulpjIRLb+A1xEBJDlM/xx27Z3BouLYwitKatqPVkHtDLbJMf2uxFhRFCE+7jf6MYUiUdAGStjAluTtBhexc64H3XtDJTCuRSW8M8nRIllVPqYBMtLfUeMfkmBIR4By8rzFcW8U//fP78T9+4m6cf+QI/LRhaNeF3LxcUDS++tdfgrvvvgPve++/4uBFF4Jrj3lVNRAqbmd6rgAVHuQGGA1H2Nk4jREI//vVr8B1970WO7u7GI1GBuLRtJPZe1Se8c5/+QAm4wlW1/ZiPp8AVBjWgV20BD+T8gEqnEp2IvmNTFhILqiTcpZsihAt0TZlssr6lLKPJEJYK8XJBhCpXHZOTFfx78eZEJFEmkpLmWAbSBJlAFnpNhd5hq/nGAxL3HjbbbjtzrtxxSUXo57NgOHQaEwa7UtdNx2+0aiZv1eeceMtt+KuY8dx8vQGTpw8ic2NbczmU6AdN60uL+PQwf244ILzcd55R3D5xRdjZTQM12Q8nqKuKwyHQwwK13IUmuLQUWPNYtf8ekRD1HWN8WSK6+57b/zR7/4GnvZDP4r5dNbczq3moHM5xKjxJJ0D0jVI3E94DCdCImOStrHlooQnieHosXH2xAtkSYA9a2JWEB3es7bBdUA3mXvPMkZe2PQoUyKxaWl5eJTkcHy6jdPTHQxc0XRiKJkgZXkUUpweQukkF4f19ZevS9vT414anARqbCa6l5x2fNnSblW0NvWIcinuN+IZKXOFDwlBHpn85LC4JLeVyR4X7U6yRNZIaDE3nCgMyOxLntMRY8cSkGIWaKuEBQbJ29qRw/HxFsZrUyyVQ9TtBmJcUeLswwvpVmebiRmEftz8rS+bZLdF215yp3/t7zVK5jYAx1P0zlJAgJLJtrZzaUGsy4bMcD4dzKAnSQgK9SyS4JmwsrqGr9x0M979Lx/AD33f0zHjOVzh2tk8dUmrGBQF5lWFI4cP4k1veB1e+KIX4y1veSvqUYm1tT0oizJYpKgoQXCYVTOcOXESl553GL//O6/Ad37T47A7GTcnMOjr1g26RqMRPvmFL+Hv3vlurO3fj9pXbStfPNKsbcCSHCk/V4allGVOtTlmAmu7ntRkUia6t0OekmTwCwSyLlZlemdUFcuY4cQyBlaQL8oAoeR8kU1csUpCY5k4KO8L8frYZKB3WOu6xvLSEr522+1429+9Az/z338czIzpdNaKAJu1qfY1SuewsryEyWSCj3ziU3j/v/07/uMzn8cXbrgRJ06exNb2FmazOeCrdgPvWoYOVJTYt38/jh4+jMsvvRj3vvJyPPy6++Exj3oYjh4+hOXlEaqqxmReNbbBwJzw7aCxm7hF1f90MsNjH/Ew/ORzfhC//Bu/gwNHD6GuWj4KaciZLf5Zxs+wPjrlInJz/8UJEoqSbmrQdpio8HNgASGbrX4WIqBU/pNNoCKk62Eu8jfJNRRR3OLnd7DS23ZOo/a+iQJPdAep7bErauNhQRbt8uDLKlMlcVWwiQQnJ8bmBjbMJmAt5y4KXTDxOpnzOw7nbeMl91K6jGiEdJeFrMk+0YrrdHal72urOrX5M+sQkCQzmdXrYks7MwlNJJ0ALEVxnRCYUFCBzfkYt++ewdV7z9M8ftYRj+omo9hZoLOJYihv1rDq3BzHniwlqocQmHzmSeaKuAakk/pInF71CZCQtHlEFaBhQawaxOphSeKAkXhlCyrARYG/fMvb8PSnfCcGwwKVrzEsBmFzcq55D0VZYDab4eiBA/jzP/4DfNMTvhGvec2f4JOf/gxmk52ge2BXAOUSLjy8H097+lPwsz/1E7jm6quwuztGOSxRUNGIsdqH0bfFaumaTsNr/+SNOHnqDA4dOYTZZBJm0mTIfKEoFsjbAA6R4TwqYrurxvWCntRQzP8lGqsGAPUkT5psBlBu/Y4jCJ0FIgVJFFLKVHuSNK3OprLpgjAt1vV7IYW47dZYX1XYt28PXvmaP8FDr38Qvv5RD8fOeIzZtELhCgyHA4yWlrA7HePtf/9O/Olf/Q0+8dnPY2NzCyCHpdEShsMS+/bsaWbvvtaLpStArkDtGXcdP4mbb78D//z+D+HPRkNccOQQHvqg6/BdT/xWfN0jHoaD+/dhdzxpsMTDgQpP6srFxkHgUc0qlHWBH3zGd+Ev/vpvcMfxExgtL8N7Fpm2SDMsOAafUVIbWmyjPK9xkg8gN7mwpHgOE8FOT8FZLyIDC0y+UgSX7aiKdSw7CpbwtNz4IlPmJJhgihZTMiJg5wgbswmOTzYb6y80dS8coNpr72KSjRCSW6w9BeG0PQTrNZ1MZDapMTCQCgiJSFTLYqsk8eymQgxhERYlBVOCMUaMA9Y1oUK7kiKO67aL0DTJzYrNJpnsSWzbxBCtC1FFGZsFq+Q0M0AwhvnuASACilAftC22LlwBADuHW3fWcenaQQzbTUHoniAYEOpAJlteLLyeqqqVPP4QCOHy6YAm9YpsUEam0E4jYuNGFISVTEIMRYntO6JlWZzSI9Y1ojSFvcvEPEf/si6ZnBS0MinxW/f3GISqmmPf/r340Mc+jr/7h3/C9z39ydgZ72KIAWwNVBDBuQHmVQVmxrO++6l40hO+Ge/9wIfwHx//BI7feTdqzzhw8ADudc3VePhDHowH3u9aAMBkOsVoNIy5AOIBresas9kca6sreN+H/x1vefs7sP/wQVRV3YKHhKdEhXUQLJaHcqcdeRoHG2cNpeg3sG1DJeSxNLKZNAraLLhdseayGCgSXYOYaaA9e0Y3QAKzm1hz7XYhu4exW8CJ1YxAOV0DRbFvXVUoygLbO2M86yf/J178Uz+Bp37Ht+LA3rVG4HX6DN73bx/F/3nr2/Du938Ivmasra5i3/59zQbH1Ir2GmeHrz0ihR0g8nAFwxUFlkZDLC+P4ECoqgp3nd7AX//9P+LNb38nrr/vNXjWM74L3/ddT8WetVVs7+5gWJRAh5hmF2sKEAaDAaq6xmUXX4xHPfTBeONb3oaVPXvAVSXEouJjVsdA0QDP0ECJ8uKgSB6U9NYMdrydJQZeQdBeuXNKAyTTrVLzSSI17pRtc2lQ50Xx6cQLWSsyC8XDhw0vFDttbsDNO+uY1BVGZdky+AXfhaQdXvRGKR4+Yzc0cilUzL089ROrcDYVrKUCudosEpII5+7bkjo42xhyQopHTlxIJoNDkjvLtD3ZD6SV8ycWnkVKUd0avpKXteXnSQq6g4hgTeYinHQWYPEwQXFpTsrCV1W4AuvzHdw53sAVK4fBXEe9glRxcvq6lYBFPDS2yiXRGu6DCEneOeXEM6y97jJlPqc0oCRk1Myck+xmNsy02JVRD77cryh3MKCUWWIpF0xJl9uB4IZDvOJ/vw6Pe8yjcOTIAcxmMwwGw3YMQPoduAK1r7G7u4u1lSU87Ynfgqc98VtCh8qJK1JXTeLXoCga1T/rpgr7GvP5DGVZ4vTGJn7pV1+BcVVhb1FgVlUx0zuIKWG0KxzCepIrzlAJf0zZo36KGZZyp6z1CyqDI3IEyHD12cBxdFa7zTOQxQAvOoCRnm3mRGPyPqQcJlmAauzPIAFckfEHHXVxPptheXkJJ0+fwU+++GV4zRv/GhdfdB5qALffcQw33nwzJpMJ9u3di7JwDee/mqMmSj655sI5Zf/lzl7ofSiCnCMMhyOMRiPU8xk+8qnP4CP//nH89Zveipf8ws/gcY9+FCbTSbOugBRiGK37qGrvp9W9e9ugmQIgrzYwfdFFsdl3D+RcKJw7s5v8BzP2k1oR7osj7rX1pb9BEuxDWhxHST4GevRUrGRe6EEOa8ub3RE8iFzo9jpKk/iwSAfYpQIKxoWToxpD87HXlogSTzL3BYSS7dhZ0SOyY7Wk6M7+rHQA6ez6rDZvwwtnSiMnlTgvJA4J9KBUTYsqKJCKLKaTjCcqo7nSAhcLezC2OuigH6sO7tqYN2zcjSlXgpXC6kQjATlWdGdnWdI1QNJTAzLK/wwUQyEuJZI5s4AyidhdswAQKcaYcqRpDbEOzRFnWTKeUQJ1tgpxwmCTPZ2xwrC+LpKC121QdVVhz549+NxXbsQv/carmhY9MyazqVbliEV1UBRYWloCAEwnU4wnE8wmU8wmU4wnU0wm02bG2yqyQzwsMcgxivZ1dBnoS6MRfunlv40P/cfHsf/gflTTaQO4kYJWRoJTJglo4cRNbLYbCWyJnn/KLOhdfGwO+5/7DebMbN6EWmk/O6LdkwxFU/lMhXYk50jpMSgQBBbaehRFYFBwHamiSajRObVxOXKNHmB5CXv2rOGLN92Mf3r/R/CeD34UX731ViwvL+Pw4cMgR6jmVfD8S7dNB2NR9y93JEhhI2xZAd5XqKsK1XQKrmscPLgf+48cwgc++jE86SnPwG+88vfgqICv6taeqrkR86oGiDCZzXD77Xc0mOCOWNWevJk4k8alx3dRkK1o0+DMiFHNxgmK5im1FRLhTblOAuEsoWcpCZCNIl05Js4JjY4AneLOfdbrhmJly5aHT9cKg2/ZWcduPcOgKNo9SHNpEniSVOq3X9DYyeX19cKuGu178XsKi26rvTLIHGEqJNVxgbBbyrVHws8S4jprEBSrIjs1b7r8UV/MhkkjFHmBVUJ5F0W8LlM8WzAowY9KIKjkClgkpZxxgI1oxGA9iUgRoCzKVArrCuewPt/FLdunUBRFYyWzalg6N+yvLooybSwz7+y7oXPtOeuC5dxC0WefgoWYRJGgihUzHGzl/0Vfah+niwDlzIN9iwXAVGA2q7D/4AG88W1/j9/6gz/C8tISwBxDVWxWVBsWVJQlBqMhyqII1LbSNXnwro2MdqS7CMzUpCS2kKTV1VW86rV/hj/407/AwcOHMZ+Mg82VVbIYCfiO1XhQvjVqT20s2nIZW1G/DTP//dMDAfUIsEzACMNAQjRgq29z57MiYshAeI01KSH06zm/7XDk86+axXhe1fDssWdlBQf278X+fXuwtrzc3DezeSseFi4az4YN0HrwhRWS5Zri6/hvJfQC7DGfzlDXFfYfOQQ/GuHnfv6X8do/eyNWVpYxm81RM6OqasyrCnVdo6prjIZDfO5LN+DDH/80VvftayLG5ewf+fuJOL0XmHWcM2XGJ4QefW5iS27+XV1dS9vKAtKkrX6ZHkM+dvD/1z/M2TZGL3RI2rJh2CYb813ctLOOYavxIXUYhOajcNQFUCbSRN21CQiME2YH9zzPis0vp4DQkDd7Hs41cPMbFKXTE7OJuNwiIiNHuxlnSIhiuZcJ2AAlOnnDNI5I3k4BHMA7kYihkv6an+PDJtWRk8B9JhWO6U2c8aaaNEG0qGKCg3Mlbto6jnE1a3y/rNnLRPaskNnzqKdCDUAkE4Yh6XCUZxHoOE4j9mCcHdnVXmcvPMeylMgVdDpGVs/ShPjVRi2EeRURZwVmoDT1LLzUhsUJ7z32HdiHl7zqD/EHr3sDVpaXMZtXmExn6gH3rFGa1LICXOFQtA4Cew3s4jKZTTCv5lhdWcYf/cWb8fO/8pvYd3BfS4QTMBxu/N9MhmiYYVh0sdWszgUavENGVBReK1EmS4/MgtLdm5x04WTniYkyehEWHYuo+gnMe5mbwDqWmIMaPbLGJZwmBJN0v+/0RSKTXcQwRSVFIFC2hylDVFqgFHciWO9RzeeYT6eYT6eo2oIxrBsiYIjRzP49183/eq+S9bpANHBjO0RbJDRciQY21Zq4QVSAmTCbVhguD7F29BBe+vJX4L3/+kGsra1iPpthMplgd3eM3fEYayvL2B1P8Buv/H2c3tpCORyg9nX7WHih/cjDEqlv1s9ROJCOCVIPU+hw2mXM1xgUJqNgwTpjGRXZk3mSwtjvmsrhgRVYTe43LBHBZFgR8WfX7YP81a2TGPtZI8gUhEeWehs5zYWJvBAhddy60iSfpgv2Yit7ZTJFrfaiEafx7DEDxzyTxkIOMfLQSHYSXaKIG899jE752xXy0lp0jKpcSSzZzKQZkjAe4hMpip44qHzZ2D04QyKjoCzvbHr6lm5vGMnYJM5lljQLuZmbMxgD57BRTXHT1slAJNM50pFIlavS+Wz7sGJJm7ZYhvOWzRQwnG55H8SHhgxu0mNpOMRotAT2dVjU1EqsA8eVv5+NbJ9NLnnnWeaAt+AM/pKT6lZhNTv4iKO2dQrsWVvFi37lN/Gbv/9HWF1ZwXA4xHQ2R+09fF0nBllJSSPTXepaubX3qL3HbD7HeDrB0nCIleVl/O6fvB4//Ysvw2htD4pygNozumBwVjhOVq1yNqVAJCpyWoULpr68D1i2S+1MlCNAJGoyOWv7lKwqSeZjU6DGDVkqnzUSlqXACXqMJ3GiUlNOUq9nXo8+4LKORGa5KcSxE4kEUlFhwhErsaXUZ8A3LH9uWQ7ee4Dr5nt1CzZrFnv4DILrIYfdiQtrM1FuCsIGnOPgygLVrMJgNMT2ZIIfeO6P4/V/+Sa4wmHv3j3Yt3cPlpeX8eUbb8QP/bf/gbe9673Yu38/qtmsuQ7ep885cyZdNWMNk5u8Jd8p+AwlCF0ZbNUJPofLS01BehYHisRCJ6NNIIU8SUxu5oBDKn20DxWst5sctI3MZjlwBU7MtnDr+DSGrmyLCANbSi4ehbwbTizXLQGXOjeZF4m2pAp3Usmdve3QpNtNJjfFpkAQd1kqpIi7WufDcZxEUqQtOw+CA8DIFdxsQEiUjarKwQpgIATWFMiGbBQzqymJVQ32JemDDsEH0aZBIp+giy7Nha11bUG04rMOi1MWA3xt5yTOX92Pg8MV1Oyb720WREljCFGMSjKob3w2Xm7KOWqY85o6cXFt7DXlSICk4UsgwBUFXAe9EEIWmM4XZTq5JK6ttKapa6Jee/QQh5kVqXvQxD10Wo5Y2FV1jbIssLJnDT//66/EzTffgpf8zE/h/POOYnc8BsAYDUdRKErBzdQ4INCMcMLn3D443nvU1RzeM1ZXVnDX8eP4lVf9If70TW/F6t49KOCaRblwgI/RscbCqxY3FoJTCMBVnF3zIl1t7BZwCsrLzYKDmt/4spPWvR1NSbuR6JJxTgtG0FanXMuV+xr5lE+AlNdCKJFtoEu2OyQLAjEChApPyfaK1cMm0w8pIFd1foYSHVFKdesAyG2QSnRKuRLzymN1zx6cHk/w3J/+Obzp796BxzzyEXCO8KWv3oj3fejDuOOu49h7YD+4qnJyXAO2YxFrQyZ3QtbtnGn6c68Pn3LizvZ3VldW1Pq0aDyZWJB7vojkM2QcTsjqUzIBP9Q3jjL8EtlJZUINj89u3ompr7FcDOA795rQCsjI84iR72xMHKN2xT1shYrBZaHErpSKbLk7XMj8G87qfMLm7lI4UX6eI1wbbCIFjNmoe35KaS8I2EQ1++RQKbGg/ZHiE1sWOZnWilDsdxdPUK+IoiybOrEEsQgVIkUEZJYiQJNX7/TPaxKVSB6J2wpX4C+7YoAIU1/jMxt34NGHr4QDoWZuedH5CR1DLERMFlKlva+dYI7TD5xJPwSp8yHXZuvfWViKKrk5CYFIV5LRjxlBMqw7MmHhociYtp2P6P2N1WkCi5GbQJC8sAZm+NiqreZzOCLsP7Afr/3zv8THPvkZvPiFP4knfds3omiLmel0hsrXKMiBCtekt1E71mlFnvW8avMEaiyNhhgsLcN7j7f+v3/Eb/7eH+HTX74RBw4datrIs3nTIuTawJfSlCpFAJOWVFLDPIlZks5JU0ySkapqKJaNuFXFNkX6XrSWUg89jFKdALP2FSs0h8ACM1TXgmDYBWK0RjpRWDAD4vtjAXshDREwsd+RKRF5Cl0UhDenSBN/2gIeNEwnjhvkGI6hZ78QnUwLi2r+khe6kKaXSuRQ+Rorq6vwK4T3fOjf8e5//UjDpSgLrKwsYf+hQ6imsxg5q2LTKROxzVmSKGSHJKzZscCWvAYNaDIo8q6AYXPqJy2GPqfwnxz/JOeUslGmtmzt5tPkxAZPqVsGeTF21/ofuAI3bB3DXZMtrBRD1KjhRGopt4mPFq/MThI9xeff/dqzKGxE/5bStT1aEEV+ghgDkvA4S2skC11HTGqM34dYu+CYoFYahoX6xodSlp1lH2aIybVVsv4mbEPPKeYkywcQFJnFFtEprW46GEGjHRm6raNaKQoxmnMQx44CG5BOp3HQv938YuhKnJhs44bN47h23wVN+9i2rEkvYCkoQFqkBOSIYltJ2q36KnTOlNjW1sW2TcSc0BxHwxGGyyvwFjnOkqZAgmLH6eyZU4uaPJXIEyPZm9+Q7EAZmp2igNUAU0vgAw6fdxif/tKX8YM//tN44jc9Ds9+5vfgoQ+4Pw7u3992DCowA3VdoRa8gtIVGCxF9f/xU+v4t49/Am/467/F+z78UdTscOToYUwn0yZ/oEMOssQXs2p1S24VDAyErbK1bxHnnDmHMsU0Z/tpCTRb6GJ8tqlo4RZQuebqPmQ5mKQkDAsqkEV3fsK1YkoLBNFSpbTV0ROnJKoJsjZXFmiJJuHNbtQ5JjuTCfRSegwSXQIyHUQ2tEUh4iRS5sq6quEGAxw4dACgomF/MMFXM9TzWRbYxD1+fm0PTGmoqT0+s5ky9RwhzeftCGtra0mnrm/4rztQlnon9ExZhT8ZwBj0bJ9IC715AVWQdOfYo9n812fb+MLmnRi6UmuPLAtBV+YWKaPGlpLhISn5JAtrMr9JBtrLiCNw65k2qbtsiD9KF2lP9UmNRKqQRqJI6goANkhSWNKQqaqZ4Sk+dNIXT6I8JcnLJ9bjiK4KIt1u8+3Xt9mDIQ2Lu7l8t8Sx9iuzxGTKk5l4zSzYjrGJQBLOBgJh5Ap8Zes4Do5Wcf7SXsy9h6MGJSlb+rLIoExbStGtLFXVEK8YPb18oh7iAZLkQatS7WaJg8EAw9EIvlOokqDPiZacqiAptkk74zwTqVMtZdXAsFi4mCBnno9EGS5OHfBRIDqrZziwfw3zqsZb3/FuvPNf3o8HPfD++I5vfjyuu/YaXHrRhTj/6FHs3bMavlUN4PTGBm6+9U7ceexufOpzX8T/e8/78Lkvfhk1CPv27kNBhOl4gk7xF9Xgvrn/mNvxEutOByhVBjMJ94woflUaWAo/gVX8MmX2xnQTQHIq1SM0XXS3YxmW8aSaXy4adaGY954TsWN85sydxlDWquyIky3lUo4bSVl605EjqY4aQ7Pr2bzX1CLJ7aHDJafFRLDOMfPA23gdiqI7lnoKuPb6ND/Dew+eVyBXh+lQ1I7ouDpa4KtXzUuT4UCCRElmJhhpcJlrKlxFMcDVA+Rw4MD+zAjTzP055QPIEYldD3Uglln7KO0QxhwMgYZfALnsvp/ndv8AYe5rfPL0HahqxshFUTcoE2ogN3lBFUw63oZMG0F3HDUkZr1XB6tOI0RkujgsoGrieSA9imfJ9BfCPnmWkjk9lKEThPfRPltlMseTUaGiPUMmXYhMaIIq1JgVf1y3gDRMx/Ksk0KiQ8oGxKEJeGTXtPlVsIkMNqI4N/SGkx4gJizS05rCZuY9Pr1+G/YevQpLxVI7V6azoll50WCMenJkcvN87jsh5j3hyWhIzHfLssBwUIJrr8qNxKwg60O2rcJMCgX6Dem8yNqYgTeS3E3D2Cmq5mezCs4VOHToAGoGPvbJz+HDH/8U9u7bgyMHDuLo4cM4cuggBg6ofI3ZdIYT66dx8+13YP3MGUwnY4yWlrG2Zy/KosR8NkPFvuWDe4EPZWTDd3MgdEYCvemh/JuHBXnQN9JwM+p12/XcSFndFIs2Ip/Vz0cL5tK6gGXNqEdWU5p9qZlyFmd7NSn9lPMBR+jpqnVQMZKt2cxPFj5u6isSckTGTldNQpQi/15bYCoyG+TCxUrXoD1bafoK/1ccd7T4Q+4e7dFw0DuGPKd/FmkGbMwFtLYrS8WhLOYks/mL5FDn8MXTd+DkbAejYiA0OeIZNbkrau2z8cTJ6ISy8mxmU0mz7njLEYC6v1jHeuuxiIghJu6/xpTrE6Z4f90NpCYLIPBLSCSKccR9ypkEQHDtDexJt9kJBO+7k6LQRApNQKvlFVVUzA4nFSnq2lMim4vswoPSVHs+JkrBctm7iqtFuZJX3YRkUwtqbKB0DmfmY3xi/VY84sg9wknQKm6ToB4SeQe5h5JgKfyxi0BaCZ5oAjKgDbvYKoZc2w0ZjUbYs7qqhD2xshRAEJjhrYBaJK9D0ANDU1aij5mz5DdjNhefrDcqZmHPcvFhms/nKAYl9u7bC3IF5nWF24+fxNduvwPzyRRczQE0bgcqHEbDIZaGQ+w9eAhMBXxVYTqbtw++R+31iYzNRFAdnNQax+rkGmAbLIE/5qgbTt2U7NmUaY2SOmmx0FjEzHhmHUbkulml3JQpdfOEKWTX0lZcDTJnAbYACiNgonj6VWsJKRaGbWeH8CG2lkFShwkWQjIIqhpLXU97n8gxhbVnqs2nW4BZaA4oJk9yslmZ3V8EpMGLe51IlEItRCjcDV7nnjVSKNU16q4j5XzvFHVEkoWhNDodI8GgpxI+rPH0MjcdgMFwqBMmHf2X9vmszY9NTK3UNlEfMtsYhjMTMEmf7P6vdAVu2zmNG7aPY0RO62w63VinA+tGQRyjsrt7kokEPwLBnRR0VBw74M7YK8P92ogMRN4K661Y5oKEE7/4+SrKW3foumgyx0KLZwT0Wp8Q12h5rUv14DGZkyC3baaY0EXEbXs0kso4iRIlMxcV6kzRmpcKSjVjRfQVO4gPgk0VY8RUjDQVidpQBwhufpcK5URrVp4dfPv6hsUAt43PYPXM7XjggUtRe9/my9u0PE5QnrQAIJS0zM1s/2zWfhjxDyPvDSZymFVzrJYljh45CFR1qxLlMEpRm5EqctjWxSqTgFX4jRWfsGi+SK28HmBFLjbrooL7tR0ANVhXPwG5BvSzNBpgZWkIXl2F5xqoa8DXzR3lfePVnreFQdG+Ru9bBgQnx1LKBD8p21C3chvUrfTiJtjT3AnYsRDkUTY7kpgzn0/fEYsjzU3Y21RmgxANQjzbklZK9mjcg/RmIeWU53Ri6r95aUHRk+PbL+i6yfaqeg2SCGfm0XagxsFl6BodiMkvkBo0EptC6B5KoWaGvhfElGq9yGETSXf7kjRobefrC/6SQi/Vy/WsAFByHSFqcg5GwyGOHDqkCmJK8u1JHZCtzVRmnCSwLO5BW+cyXc7S0rAnf+Zm8z8x3cbHz9wSXjmjHeORCMRpRY8kxnLEUf6v12Ef3EXB7iqG0Y7i2CEK12Ph5aRmCDGDRvUdXEum9Qhk2vCn6rAWiwLf/RmJAgHeCP7IaJYAMmtImeP8W3hGOB0oKAQl3Uw2TzonbOhchrqOQ7VDBzZOBgmUCKdOl/i0QkVLPRY5CHsFZfp53Lafy6LElzaOYbkY4pq956PyNRwoAeYsukk5aaPnN/wsZpP7l3z1wGUVX9x4oQEMymHTgqRM+DVRspBzLnHLXiPY/AftEuAekgEnymHDCm/fm/e6ixIYE76p3tjXqH0bE8vtI+k9uK5a7Ks4lVE8kUWYTirQk5uefF0WFhY1KGJQxjYsSjgeOD7AXXcoMf3ba0VsCigZo2uCoDLdUkrs0yKqlMm0zW16BNtjB1hlA7HWMPWNTvqsZEyik5HeumnjX3vyTaxE8kxxJpJW6oFIEPS6z4dMCiOLU3c8/ZnEDYqxrNSQrAJ9TrdcreYGii3BSFM1FYCy66bI7ATWs2MgP/MnY8dL69rmfQ2LEmsry6hrrwQ+Orac80j0HhwwzmHt0uLU/MgoWUs53vOeGSUVODMb46Mnv4a5rzFyJXy76asOFiNrf1Z5OAFW53UEirKkExyzOMkj//z24Bej67DD57OR3LEKQePs9Wfzc/J6MmbpNtKffslK0qVbgVEJKr2TbBZkG17S/rp7EDrqH4kIVZZJasKqJxL/Ah0vrKq6xayCEryJNApeYdZWH4YSGjZtnQ7uwYo0Rdz8HrUhIJ8+fTtKKnGPtcPwdQUqihAVmRVlUeYBMJu/LQJyzPZFc7gkLMPoDAL7HMDy0hAhEMA1PnfVjpQK/Y5soKxf0ZmhM2soA7xhNbpR4gwRYWx1JHJjilkI7YzepNKBa932Dptw29txvhESyvtOJL6xyHqImhOZ3EUqUU+F3QjPPUkrWFc0c7q1hmWGZFGX2t6IycpldMwoi7Ypk4795DQJzGrpYkuYlQ6GZSohi7O9cLxItkPaFmAz4uEEYEU9+Oogz2WJuyMFH1JFQhh9sEpLlUUXRJdRtlaJJbW0HR9wRMbKBdlaHLUtzviURDyyKmo5GgoZeoTDbFQGTFltTlhtdQ5Yf0SvQnwjEU9KJ0r3t733GAwGGAzKFqAkcnAE4TRJxTvLgT1XlCkaqiyAoEmzfWaFMDpoCZ8FOWzVE3zo1I3Y8TMsu2G0ZYcCJq63BCOyE4mvbILeOkhZ1E2134ehTupMJMT/opvMkttgkzVJ7xO2S9GhhbvvLRbNWIxoFwGDI8NELEaR+KlN2g65rHt5E8mzF2u7l8XSUgaWwoo33j81SoJMiA3xjhVprPuwug3eG9GGa3UGicqWEgFosE6pxUe86sI5sCN8cv1W3LJzCq4oxQmyB3na94guIGydUy7AuepwWIOELjh6RHlyJenQ5rWzWHQpYzBKXFm5LIAWlZWHXnHWj655iRAxsBLr6wX9qglc8b6lwHmBU2VbmHJguKPDS59t8VqUeNaT2WJF+1JBzzbravETYTiSyKSdSdKXZkRS7iNBrpVPYbyn2/1ssKTx96lXX3Z2ARhyp0ZWNPD+fIlAR7SM40wrGbI4IlOM2qJUM1AgDwOxZRgtrazzTsJJLteEM9kbEJ1VIuqB6SRs9v6ry9QDmVvk40s/m6qqcOjAfhw6dAj1vBL++HMTHp+tC5r/b+6xBnJC4EtSbxA3/516ho+cvBHb1RRLNAqHORIjjk7bQW34kuVo5K6w6wo4YfNWXTC2wUtiLMuNiil9AGPXQEW+SxFhV7yCtNXadH+IcjZyWnBY1O+lGQGw9l8qm4NMfSONRpQWOzaKSlml6GhDJ1j9pGd8zGEuE+eforoSrgAKcxdRaatZJ4yCUlR8hooWrSbxRNWx1qmlDIKBAREqqvGxkzfBEeOSlcMNZ1rmr1OcmVm2dUg4y7SU0hChPP0vFctyLwkw4Chb5fOetT1tAppv1cialkasQR0k/dqkBqGJMIXZOEiEFoRU1DHb9ErBtLdQFHFol5oE1famUBQkC5PZGHKEPJJwKcltEDwFOAubSAJ3TUxyO4MXLV85QuGMB55htSyUZj/AMBS4mydS0tbUygpWJx+bARACsznLIRPSAhK0QymMJHW6YdExtBZH3ZlmpMZsfe11d4MTFwKLRZMyeegyabD7eWwQVtKamuSqk+xOkMktMMJJoakIvzQYXxLQq5j0SEk3NeidSKvJw9UVNkVNLxRqG8sPESdfVoFpre3aeywVJYblIIx/E85+uI+FC4z61yLXrj35cWdGjW+V8iqnQnbemu5tQQV26yk+euJrOF2N25O/FOtRyHJRn6sZRBKxFiSLHJkI2RIZOd3nTHFfUwwWMh00sU+y6uKJZ5CNnkTSckM3SZtS5bMkD+ZerOV2bZMsHyJq97dMR4+S0lTMXDqkrAg3SYQdTMrVJTd/Kfigjh+PyD1X7VIS0CDlpCL1RqUgz24wkessb1xS4QnSdSIRxk6k+pVUoHbAR0/ejJt3TqBwjbvAt3xwnLuET11nOkf3Dp9DFrfEtseuDWPf3j1whYtqVpMUk08W7EmE48UvlMw9058Cx4nfjJLY506WiRg206NGtv2DHjSKzp4QnAUyg/mkkCbORHCbTFbTaZLeXTL22fTDgw6EsU0T0ulvyj62oClMuY+JjJSOeOG9ZzsWanM2MkVSB9BMVDWgT+LnMDNedO9Rr1uRMlZMnYjZZ9okzmV9UJ7F0VgQknAotuspZYBmFlDDSD360GMjFTKdHAAYfLYrZJ//VruwvLKC0dKoaaT1MEf6PyPqD0PL/n3OZ6ZIaBppMagXy1HhCuzWM3zk5NdwqtrFshvGYN4+ZlaP3ToVUuvPJMKAWAk0WQgFQ8eAJOkyDFN1pDuMlT5x/EjZNClKIInnlShvU20CsqDH5ubPu0N32VRn8eZiEwQhRQ9sf58kB8yJVCQh/GuDFVhG4XYiKC8WCiJBD9SzNFa4WrGxyCrHxyLAt+2eoMAVTIDOaqPSqTjaHX14vy4ceByhMaUxY0AFamZ8/NQtmNceV+87r6VPxXStYAEkGBtUJisAC5jrZn5GsoKDSWwTnZtYmTYgpaqa4/JLLsLSyhLqao7SFdF26VKKnfxcJd2KMg4EqGjcGCJFpHkDQQXbVfYujublSSaKXuTgOs7mndMYoogy5aQxAGXdo2RWE+06kTHBrANsIn9COCaC2ld2mFhtFRyw0CxOeqaFz6wDRCjCj2JGO1TqGAx/j3PpzEKhb0I8lR6GIclMMSGOKboGFDedM/ONhJQHDZMSpns2hTYT22+RYfqz+qxJ2exiV88pp6Wxs6oTHqvc9kYdzub7R6omiVQ8abtjTbQymlpORHhKSyLvLYiOaBIPQrqbErpKbGiV+hSozrdWRW3hYd2zWlU4/5KLsWd1FTvbWyiKUtU7RJSOIygtCGVHM1s0kLaGc4b/qLbIoPFoNnffqv3PzHbxsVM3YaOaNJs/11pcJ7DyofPa2SWhU2lll0AmjiqNlQCr2QOKZygrcNirhKCQZC5KN3kn327UTnXqgt6BdPdHOlfCtSYojVzUM8joeQZ3J9mQFcAxCwCy5djd9K3XreMxd//tkQvmidWLB6cRtzLoh7W6lznS/ry0J3XeznYjNjoy1Qr0nhOkb7QjRQEbCeEWLwKtWHsPAMeMmhq/elk0xc6nTt+GnXqK+x+4BAW5xibY2U5gFKesqZB8TvnqC+ZqzKpVHGsaCgIdJoZzDlXtcfjwISwtL2N3d4rCFXnxEDJhkcTZdrTaeMhQLxVLoqfWT0REnPErU7CeSowyiRYwSfh5m61OlEzJM2I51sVZ+32dtXIx2WxKsYFKBrtse7Nwk7T3nRObghNLHLOKXk5YPjbkR4iNuLMecSbMiQwWWLoQMmMkgqEEiu9JCekrgy0NhEQF99a4WHHfeOGe4CSMgExAilciVSmlZjsqk2wSMZOVFi1AE/mSTHjjQtJCNPG3OKaZsmEPBLms0uOY8Sjr7c66K6SQj8UGFtIkFfjfdG2Jexa4+ILCiNV7wNc4eGAfBoVrPe4Zh5TiHBgAXHi9rEacdhTQ72AUhQGxYJI0aYl1+zZLV+D28Wn85+lbMfcVltwAdXd/aMCBidUWbAyiwGTQQCuoiG02ozLPOomz65w6cookGmPeW4sq2zaETvgMPA9Gu5dRIiLvWDZhJKQOZE7RYCMHw5BqORyPw7stNZVM878pxzXjHAUrw6xXYl7b9heqSzSna0dQ6Vgxbtjyr+PMkqQE2J5+zAgjqL5JPrusAjW6aFqWGGPxZl2ME0RBBFcW+NLW3diqpnjwwUuxUo5QeS8IV9TrnVZ3kjVR5EhmphOQy9jOdPabToj32LO2htWVZezsjJMgqrOJjUjkg9sQj7xnR4eyEOVbx/mxgD5lS7EVk4Fhc48+gvXJhcKJj5OiNR6ACTpTLYJKiPs4/Zm+ujxVJSl7MSGwG5sx8iFTMqinT1JKotMANmFCLCg3iEFOqS5HtxxBSB03MsJ3YdHK6MlrS42hTEkMtpWzWWuWIrX5DD6Y0kMvSI/F5JxUsyqQQLm19bjvnJqjxFEW7c1sEwozZlkiI4M1FjGkOEDZWVRPUVIP6BGMJ1bC4KNHDodkZR0X3I12XCoHWiiaXcA2yTABKANxA4CKGUXRXL8vbNyJz23dBQfCEjWbf0jVJCnIk6+PE4aZRMCTCh0SLgUbkWltuRL7S5JTQzpnhSls2CRcPGz6wbEk9srSRzJK2a59ZvlV1nzVbUJ2VFimAUtCOKC8o6TgLUo4IKoaYi0+glroOH5QcO0mL/2OFIlcsoXKsdWXeNDbr2dV2UboUBPyolPSOjqTtIpoq6CG+xBnoljbm26lGOHYeAMfvPsG3P/AJbhgdT88e1TsUQSimI2JjLhkGHuT3eyTRVuEUrBo+7MJf+9+z7kmnGTf2iouOO8o7jp2Cq5w8DWrJLhOlERyBinJkGIRUUmQ8iScvE4YQJSECWUqYznr7B40ofEgMULyYsIbx04OssbVmQqsA62cC7NUpkTqovNTkp63DVxi0+btUsXEc8KkIoCF/ESRAmV3jUlYkbO+bD32CEmaMpbULjMLmO1Wo0L2NEycwH7IivTkqESkqZHQ9IisTjHTdgmmWMK1KMEyR4yqfO67rpW1VdqNQKbvRcdD9OYHwIoYU8V8DJ3LrjYsIRPvxpxsIWWKhhhP9YSclkQmxxlFZQ6aQ4nR3GwMIk6566CyhysHuOaqK6P7J5xCfTtOJXUyzhX9CMmtmiJpp/6UgQSxOJShzWDwaFw9A1diazbGJzduxW27GxgVQ5QgzMV4xIuiOtznzumRmmSNtfcLGeoldad50iJx9WwKFQareGohXifTfjfc/9juZyPyJOXCYnM/RD4PCcWTj0Jd7kbgJsqH2HQCICKtM60YZMPISGfUGxVimgWucbE2I9yGQVgoC0lPfULCk7xUa4sx82B28aSkWlEu5a9TBqtOlJjkunafZ49hUWCzmuDDJ76Kz6zfhrmvMXBFW137nnPRgt8555kAq5ONqqZJEqsYy8vLuNcVV6CezUGuzMnG48YXZt4sxe/IkTm5/+B3FmzoWZSFuSxw0nupDeXJZAuFDikZtTmdTWfGOWEc917/dCFeoOqkHFece6luOWWfPQQAPTHRGQywjW7Ni/sozsrP5bbsgxlmYu7IcpD5LALATHBPotbjBcx7OgddYUqojh2innQ8TiF9Yl2ipKTinNiSzgLTySTfpbcJL4CH9dP3Yu6Wx3A0wEXnH4VnhivERtobNpJ/2WSfdzoXk2jsynkwavaNxQ8OZVHi9t3TeN+JG3BLu/kDjAqsiHvowaZTRpWr2ucL/bzGHkucafpR+p4lApt7Ahxk3hGn91vSaSR5Rsog9QjpwTg4rFLAVPdPSUrQQSaQp4Ni6FMsC/Z+/tkj1XpMH0YWtjgJGoHBdCoQZUQjSuB4OJHojHt5wFYtbIpe8njS1gI6tBoICjAHVqMMOYr0zPAMDIpGHPj5jTtxbLyB++y/CBeu7AeDULNvFKIQsx1G0gKVuy2zJmalpzVKktCktz5an5prURYFLr7owjb1iyIFUR1s9XJCAmRCZk6p2qaZyEoyDw2rI5AmTIgoPIXWFapKKR1Q1k85pul+32VgBd1cMYxNM7RKyugUvFz4WY/ANJ6+a7u6fGqM4gCQhgmZlp1s/5NRpkfYD+dH8raJzfYaGL0I9EGHRZSvJDOTxIiygaOIFmyw09nRscwvVwW3KE5Ypp1lInDE7JBzxDnSWdek2uGaYkpJSmASvadTEDkd1SdDDsp0stTYJ66NwWIo1jESQknObWRmXKsGCMQ5+4zAPadRvd3JeD6vcGD/flxy8UWo5k3oFkT7OhUp00LgT06vpETkQjjEJtm1E9QVrsB2NcMXtu7CjTsnUHtguRgGsbUjI6qWJ3Fo9LWjjB3RpNVqdLG4hyiOuUlC8pKgHTmiZ1Okk75XpPhcWmLVCd1onFSkvNRLpXHZRKzNwD3UQ+6yAPxCGrlVZ+uTeRJERjaEMHo4ycbEZsVgSIhFaoGEYRUYhrt8mNJTHYvZck/J50Wr2rOazMDJNOJ2MXWi7QLCsBjg+HwHJ4/fiCvXDuPaA+djT7kUxZBWp5CpoLlv/t83SmOhWtYANcUjuOrKy0DDAly3mQCdaIVTm5bNW8gJeHLhhjrvnc1BVDY6O+cFJQl4ATOdibZN4VGUFzw5ZNC8EA8xad+uDLQRm7azgnfSHH11gmSkc3ibP54roKCfB+m/T64NZXC/vCC2T8737azDCgNZqFRIi+oMQT9Z2nQxS/nXrmLFxexUBndlFqz0wTA0v57jKGcPhtQbophiw1nZsuQaw2HDZiPe5Kg5UbkZOVAXmZeUhaVnf1fL3Eh3dSh9H2mvvqX8OUI1r3HlJZfikosuxGw2a+zNQovDoFYcS2cL/Ev8ZmqUuuhWba9BSQ4V17hh+wS+tH0nNuYTDN2gESfCp8LJ7hI4ivN10l0XSvgbxuGWAIooja/gtLxWliEVC0lilGiivA2tM5JrCTqVhpU9l8X37BOEhGeUIUaefQmanQgQKYubWYN4FI4UGlEaFIfwUDlYUg2rZvki4pfiLCaQ/ziFzJNNqJOeWCOUIkrPRQpwFB4K4+tsh60S4YkOOBTGHyTEiRLX2LyOmppuwNCV8ABu2DqO26bruH7/pbh87TC89xqDmUAvSC/MGcEcmzhKh05RTcpjS9RaOluxlK9rXH35ZVgaDOGrGlQUKv8aLBGRUd2cFmnpwDwVxZGZNWccSZyKQiWKWHZmSCKhTaufM0FhTJIiqA22BJ3UF7tPAfmSQo1g9Brd65KPrGasmgW0nTeSae0RacGeMYLlNoNQeII0h5z1CUPpMER3BRmBWxq6xOG5VLV6d7pQ8EYWjlxSNAapDwjXykR0KywL6X6fDapKoTOksKiWcpnqTGx71SzCYDEHZn0rEAv7n3i/xBo2JjzaLNoHJFu/LG2+Ok6YSXeNKOU2quvvCCn9oi8QgjJ9fEdgX+HKyy7BytIStra3Gwsgx7WhS1Fu/pf6xX32kGDi4CkzfrKFzsnJNv7z9C04VY1ROGDVjRpqefvanSrqhMaEXNBLUPiMSNmpWWi4HAlGDceDnIVXs7XxSQMIZebTZEPFdLaEIsX6qKsjczAm4SQjs14R6yRQPSlNq2eJfWbznDsYuZByBIgb0JlzMzMCc1i2Kpk0UIcUZaxJPGp0/z5NS+1sE93mFyxonMwimz/2liXSLgTax05EcBSDMjX6kVVV7lpxWPd9nYwG7UgUhcwLFzdJ90etFXClHGJzNsGx6ZaQ5kPYRBR3OU5qO/tMdIzqWSBZEQ2ljG0h4iMHVPM5jhw6hMMH9mM2nzY3kDcCKzIVpnxjssNDVigRaXCKry3Txzxlx9zy9MnGhkBGwGSlaVYUENuB8d84qPICKCTfXzyZk81n70taTJYzUnoKD4DJg8kjA76HhLhI4AzB2CozLW5SxCoyr4ITc0KaM07Goknt80GwmkQWQkdJ2DME3bYLSebTaazD3nMGwW3atSn7CJriK59TNn14ec+TADOFXM8kk4B7QFYkyxGZqWGdEhZoJMRnDNN+Z6Nf4bR1DKagUaHMM0BJVC4p/gbnhvD255EeQYBaSmgL5Lj3Nfds7HpKUxQtfPE+bITFeYSxsh8lhxy/QP3Twjxx13gDt403sORKDFCiFlRCByd0PfGaO3QWPKMrAyeUNDUCMwpTzrDsiPJQpZyKiNRnxoZEqmPFbVSKFIJ7M1znpNueW1Mkvl0HregRu24nujzcWRkS8rOocyF2GRg6970hLYkO9SAn7bnUWy6Kc8MR5zRoJmNLk1N96hFzxf2OorJY6BOiQ8GFJAIiQk2M5WKAC5b39qtncpuMzSSQJ3QiZLK/FqprHDlM53NcfNF5uMcVl2I2nSqjTerJFeEkrMWA6o6jXtZeZBSRNbhx9GL3RLxSvwo1VvFMaqOM0cJGG5KI9Ti7f0t3hZmh6KeUspINsXHGsRElAkoW5C/KyvdUMieyilRdPPDZnsm0Vc8Bp9qX1WDSV1jQAlm/FTW94JwBkPOplpy7/3vCOxLjqcFpWZ4D0ggIXfRF+xtzmkOvIp6jykyhj0OnpSOeilqZc+JOtguy+BzQgzzWt0zfwpm1xea2rES8RoTa11heXcOjHvYQhW/nBSLdhXrNXMFsnADataR1ZAeGK9hTDFFz4/Rx7fUu2iKpoe25jN4s5Qko4CQ0w5+IM41xCuRUefIm3boUb4v0mJVFmJa0x3OPjZfseqsPg7lnCplvJ/kLgjvcr9CWSBIW8B9ypHjL5jCUqOtzuE/7vPlQCLNIJKLQSpP2m24hDRGObOJZieOptrP5hbZIZ/Vi8ZyLB91TsEzEBCoOLU2peJZo4/BBUyc8ESlMLq6+xJQ0bok8Cgcsu2FLGYSxznESEkRqzGEEeQtQm1kkb/vQFM6hqivsWV7Ffe59DXxVtdeJWzSwIM2R9o8mzWHNGk5dIxxTw6ilboUOTNBfGN0Ha60Fi2KQbYAGJ5xdJbzuTqOdJ5jFIiGbGmy7UywLVW1SC9bUaBwWYw9WSvTOWkTs2h6O5tTH00bMsoi3Ord5RpHIF3IwSBQ3lJusR2yo2uyEfZWVqI6FSFNuSGJcEeofjtx9JRhgJWi1cUdkHQTMaiyh5IxdQAu1AG4qRAC03UMjbTImKXbjCXPmV352HzYE1oKN6N0mSV5j0zGxlD3WJZWKSucYtS1zCyTID+L6Ur4clPsHq+KZDUnPrD9kxadkRK8EcgXm8wpH9x3ApRdeiKqq4JzTm7TZaJktsTEzogxJnjrnhLJo867z1fzXUlmidI01kcJxqm1Xtx0LonQq5NqgH5nHknZDTRy1EJTGz6vValFMROXO5dam2jLFNiOLwt+rjV+LcbuX0bDiWitpSCmUlgAEu7MF5gVqodjfWOxRsvtFRCocj8y4sXtW3GKxCcV1D8mhT7eDu9a9reZFacwiCpMSsWBu1kdacyRbwUR6BpON/pOtS59px5Ce3ckmpsD32qLAESXKITIhIg4E7wnLboSlcqiUzqlPTZ/yKJX1/xfcgZQsAuQokMrvc+97wZVlAKEQcrhOgWw2zHhFriNKo+3sHNw89RZzmrOnUcLjJ+HlsyEylN4nWOwMS3U0ovQjG8Gqca+JParnVMSysyXb57Idy3E0gZDRoLG19nAXtQfqwJCxxkatABTLXAgxOSJeWO34QlyZ8XvmyY6cnBxZ0Q45YNNjl8WnocAGPKkHZbyg1cEiicDwnFl35GXLNMKWtDobsLbaXKYyMkmWqeBOdR2zNjT05m4QZWMaEgEomcVequ0l64LEiMA5h/l0iqsuvRiHDx/EdDZLLQ7QPAb0dQtN+19DpjL5J8lBpvlwltygsVCLTqssJp3YUCnjO5TrlbP+YPHjvMi2ybcD9XGZSAZYkVgvUhhaYC2kKt3EGGqZGJBMCoNlTwpsiuM5dU+4BbkZpGv4MoUnamCFYhCL06ud2EnQhMIrinkIU4aulUnQ8gEoJAOBILKSRVuONUJBnoIYkaQSWv1J4Lakt7VdBdntFAAJ6bsNs/9EwCWEKMxYGYywXA46Sm02IlP5LQSYpEPgsvFsc0Yj7JWCnzUpkAiuKFHXFR50//vgwN49mNR1izT2CcxFJhsm5x4yMzAWXnOSKtd42s/HwbCye6IFNnX3DiXvRlg7xTVnkRwZ6wDxOqRzJegS5PekRCCnlOmKMCdgIkIvIwFVYXMmM/Pr5qJg0fnkhDSnZpgiMZPVPJqTWkuKlJT1lZHoeaxKKYh7Sc9KEXI5hLVU+IrZ3DO2Ra85Dhw3vwTk1bA6YlhOXEes+4RkWiJYOU5UV6Z7ntUnR6JZQ2JBV6tHdr4tY1ulPTEY8oyjgky2hVR/R9cXaxEwIveejHKWhUhR3SvSJyXFslY1nqCAm0Q9X83xkIdfj31ra9jYOINyMDSAHpNLAW46xbnBtykaEs5Ejr8hLIkejFFRYsmNsOt3Q5Kp/jHmuRRuoQj1ESmCLPNCpCtDaNZgaJ+ywyciTzuxd8isoYj7luRSltRXhjhAxMwZEq4jSfNkE/bVuNG8SInUXWE2cC9Nj+S0myu6cMEynYYvR5FHphgSqWbCQyvatPmRB6nWESkPf8Yj0m4Grm2vSyRpd3AgMeMhW2kKm1As0PNUELkpUOv2I0cBfann/bGt2D0INsCCu+RDAkauRAm30MInj3FkREdYmB8fVdmOenK4uxu8cJhOprjmqitx2WWXYD6v2nxs1wtvjdWyt0fQLAaX4JLWvpkYZLPXaMFZnWVxwsgLpEg6QXo+Y8sdYKRJetSfYigGFKnqXgKriNNUSYrjAMChKEsUZdGS4uqOxtI+nD5J34R2zfXYlTiDK9ZSEt8Hb+mKkzCloSCk9eL070i7G9BuBt3oMBbJTlbtcdzUiXo9N1ZUZhSFg3MDkCvaMaRrZ7wuozkijYfO+RrYZBzI+GLuG5WTbb4YEIuY+9rWLKLglbMnvi4bXl//HJeHiW0soBqnxktP2lXQ14pv7yZuBcxym3AA6vkcw8EI1193XfMamXr5SbEAoWQJSGK2lRouXyCEMQP0qXzgSqyUw+Y5IUrlUD1tEKImYMy5VJNCcAlwiuRDweY6sg+sGKgwvDhi7O4vPYLxKsCNTKOS5diUYqnsFEGSxWgyPmPyOBTJo+nwh4QgEmZtp8we6LLq+dxnRsi0SDlUOV3VRZ4T0RgzZUQIrCATELhfMtmN1CGDw2SOQ1uxm30wG5o3A+TYbNqdfSLOdIiinkAFRrSbWZcSJ2/s+GsRJ0ukZpPdJ1527SxkYhnFBxoWScTMAsrA5ZKOewZuovQCoIbuRYSqrrG2soz73vNqVLMZqHAxOUsWH1Z/oeZNrDWWLL+eowZA0ASp+/2uq8NGXCdhI11io9AIdZ9xU4GnxviwcYXzGIfWHHH87zhvZ6XyJXQWIQqftyp4RKHafT9VPxAEPpVUGEgoFgkoBiUGgyHqWY3p7hTsGYOybNwsvqGfwWshDwvRmnLAiMVVfQ1rTzhLsZsqosSogCOeNSQnyN1SaAqCBZH1qbBbcbuMDjtKCdoeNO6IwaAAMWOyM8ZsdwwHwmA4jK16Iv1yJXqVtYiOOD5fKse+C2NqDw9h3WjvyeY+o3iQobimINxD2v/OMW5OpEJy5pRKOdgmZB9BgqFCdLcQXloBJFlmirXR5CJ/mQXPgIXTizGbTXHk0EHc55p7YTabBMU/KZZH1DMQUdhgOelkckYjJNZfcS+q6Hdmk/QKLLmy2fy7vPouuRPa1kcM3QoX6y+rtVlPirvwLu3w4Kg9a+9BJwKrgj7AwNJC4J3noD0KVl2xrnn2ZkxEQaMVHBMCDxyexJxmWbwvAgsrrPjZIeJcjC/N2COMVKxLk/Ks0Xh6ki1K1bKUVCzRhiFrAifBwmY1I1WJWG0F6zltm/vg4WTdlmKR1AbXFkEU0ppYtYh82OzjQk5qT5NtSYjUNCWEpIZF3Rx8mlZWjYYLMOiwuz0x3AuNFMwLQbSOpK2JjFedxde5UBk6cnjsox4GIq8kNkAOT4sEPkFn5XryYnHigjGuCnBKlV9JBhFnCJPZJL3MRgI5flCDigwEhJB545wSemwXhboTLaEsB5juTHBm/RSGy0s4dN4hzKsZ1k+cBJjhyIN83WyQvk1o67uMdi5IpgjsIZsquyMbj3vSYmAd1UxpA817KJZ5egd0bf1W1Nc6UgoUOHPqNHZ3xzhw/mEcOP8Qdsc72Fg/g6Io2ywPn8WXpJ+nMtBroqnTin5kprUQxaDOzRUDUzB6lXk9VjD1nDpjYCXOzvqT3+c0fpeFLZe4X0fgCEm8sP2EpuMJ7n+fe+Oqyy7G7niKwi1CZOvvlgCGOINrPye9UrrslK4Q91x82L0ZQ0YdmJbPhJju9gb3IYLc6Q4Om9M5xc3YtTd8J/iLdY1XgKgwgqDIxYAAD8mixxJMYzaGvaYURIWNdV4ij52OUzZx3ESUBuRRv4ugDKIBH+kILKAmRCYPm/uS4EQ0p2xVkV0gXJzjifAZeSxm28/3rGwLXlJinY79ViOEzKzR5pfLNigrSEv6rHLbTqIcsZtI2Bd9+wE2I4D8/MssRZL6xz3eSyIDbklVAZRLImsjvhwRfDXD9Q+4Dvv37cV0OkU5HAK1OBnIubCYQ6kAIhuQy5SB8acxm4GuJ5G+IX4zkyaY4YuzxQqruYlPYSuSZNHRsWwuvQ4A0JBdkwmeenDSSj0ofNuHtCxLbG9u4vzLzsf3/fAz8dCHPAh7lpdx61134K1v+Vu862/fgeXhUpNEKd5wL4PACGhJAXhMlKo2dmQSP0RrWNASe3P9cuh9FWTEyh4L14b8eAfnGIDD1uYZPPY7vgHf/axn4IpLL4Mj4Mtf/Sre9Odvxr9/8ONYW10FvIdviyByZNLeWMzypbMkI5skKYSMRDU2UcaU5BameF/mYJvX3gvSYj+iFAHok+TDSA9trllL5mx1NNwV6La7RQaNDMrbXBfY8jwYBTugmuMxD30IhmWJbaCBg5l7LEdp7UBYzlGGPBjn0uSc6l5JLgBBk/JkMTFsQUQNdyXqPSTLv3s2nR0oMiw8RLktlCODdMyzb19zDAPjTEpoe8ikqA8gwVzJ7Ii6+GbAk+xuS4BW7FB49bnakDXKJJ8a1LbQDIROIek1LKCAO9FXRAmyWohJZm4TJ5sm5WbPkiDIrGbtYZOzTGMxZ6MuXz3DkQ7taqHIjn/OSsUOH0VMkv+siQydxay1nxApdSazed1qk4pixwZ2w6mYKrfsMpT9CrlgXDFe4BwmmGhh0EcUzNTtichhPJ3gogvPx9WXX4qPf+rz2DsaoU5Y66Jt78T8j0jQqCK+0urq2ZDwwDbElpKTiwhRSyN27UMuNypCKswJD48eK7HNaUfMtJCUSyt8t2trFH2lySpe5AIw1yjLATY3NnGv6+6J3/uD38bVV1yJjXobla9x9KoL8OhHPBJ/fL9743de9jtYXVqNojJD84MkaHIdWqIGyJlGobIUwwtjY0fgFBROtX2yzhuTSnrJPSDRMuXkVMsBZ8WOgbLE1sYZPOsFz8bPvPCFqEbAeDaGI8IlV16Exzzqkfit3/pdvPlP34TV5eWWDkNNgSoS9ki1PKMVkEwseRfDChu7SmlITgwzY00AMgpzTrR0lOGMaMeABF2RqS0pSSBjIZQURDhKITRKFKjcOd0cmESRHTU5RMB0PsPy2hoe/aiHY17NUXTpmI6U44lMu1I6GsI9wmmsLy9u9mXDe7qvHRVFI1Dkpjsbrd4qvBXUQnOi4FfkKEjGP4wNk0jllbCcuvnG3s0KQk/6+kmUNzWdZuTQDypllttxRqS2krKcNq8/AOu8eA1BPMyG8CnWPVlvSvGsXQClsYcZzsuRjWclQGOjINQtB3F2EME+MQWJ2rAcO6+KXtYwXw+Kf+NWlS4e2YkQVZt6TURBtBR+P8RTssmIjwubnA3LeNcI0jEwFZJxsKQWYDYqVZvC1BeYQfapokxQjeiU9LEA5AhGGWbb1zubVTi0bx+uf+B1qKbTDFRCtLGI1cw/1R9wkjstGQwcVPHaYicFtkSZXAPzs6TWgFm72Qky/CgHjYcSEQZ3BZt5mggVUeASGaBDRvSn/LgGZe09iBnT8QT7Du3BS1/+i7j8iotx68Yd2JnsYjwdY31jHcd2j+OHn/tsPP7bHo/trV2U5ag5OTkXW5yhG8XaOaAKWKgwExuQQyp7gkKaJbLTBDb3ORIluP6gxIsMgkbNKC0HQ+xub+Ohj/n/SPvzuNuyqrwXf8Zca+/9Nqc/1VdB0TcFQiEoIioGBMVgL0ZMjKYx+RmNxi4aryZq1BtjgiTGRNNHo1FzY0O8hhg7DDYIIp30FAVVdapOnf7td7PmuH+steZ8xphzv1X5/IpPQXHqbfZee605xxzjeb7Pp+Bbv+2bcKj7uHr9MhaLOQ7nh7h04zKOZI5v/bvfhHtfci/2rt/omfQVaJQc13MXMdQ/a4C0+p2q/Ut9x1RNvPY49hRS9YhU2TdFIJl4cJbRpGihEfCzfqVnIN3PFQZwOjnTn0WCXAUJmB/s497nPQ/PffYzMT86GrRK6xCJpfZrfSvfzvlZ7Gf0G6pmnRWxFdZoEo3jgTNSe59p+Zo5HN6BnA5PQgUvXHx3ErLnuYoavRKvO6PgNWPFlcRA6jrG2VmraUzMGSHCePm0yYvFsovrrqvNysgFcL4ns7VdTFovmKwwRDwHsylL/rASbEfFVBRp0yXQTErj8yu35KADUDXDD5MOLSnTEeDZvoTcYnUb5QhMEdqwhAsVzaI6KG/2mkVMyR6kZAdk4pNmQYkq6QQ0C4tc3Kcysc7hCI1Ihjsaa4qDqrDG5wk4pUgOvslzoaz47z+Tz3jxp2A6nWC5XJAQ0T/AOQfepGjRiWU8ZZlWrI7iO5cqqGKETu5MZxY2z8gcvzeNZdT0aLIqV0HVuRRFBnv6zRGSXpFSK5nFYTWNQIl0yOK/IAEH+3v47M95Ge553rPx0PWL2JjO0AjQBMHGpEVEhyM9xCu/+PMQ2gAdHAP1Ca49zXIrk087oFx7PhlqEr/B0PBMccEjMs14LDHXk7LhRz2MOjiNy/QIEtB1HV79Ra/CdNpifnSErckUTRA0EtBOptg7OkDYAj7viz+3j9qOERJg2/pqF10xn78FGuURoxSFYDF2MgWnJUmaWFcq9gT5mbFFBYnFKiFg+V73sgI1HU4RyRAm06FRKhqsN9w2pJQgY3kthwh0ucKrXv4ynDl5AquuSyf/Mn69jFuyUwJZiyE0n4fq2ipJKgTXOOwLajIaCG0tpk1lom8ZfpQ2Q+W0D817BfKp3kDY1IpghYsvZCGw8GGHixo6AHHa4Hg/cH5FWjOH1xsHGNkofmcxLx9eGb2efoeqESrzoalmgAoZdrLur2h9w7wByzHijvFBC3RKi/3pQNSCeEUdNnSIhUxhdaou/U8dE51U2pWKUrUaem4kzjqIlczsT5yVIoQS2iGVeajU5m9itQTiKchS+GdLdLPYWOBB3W8jLtd3GESAdtLi6OgQn/EpL8Rdd92Oo8PDfkwSIz1EUjmVq7kjqkQd0apnUTn3gb6P6PwGQHNs2phB7+tjB42v/RlC4i8KApJK7J5KqcZaBzoSGaxx/SLWzlq84MX3YqkrSBB0ukKHVT+W0YhmEOCcPXcK09lsCKWqDSO8VJeDrMQIZ0MtrlYjJGqO8R66FAN60Do6Ih7T561GB6JOq+n56xHdaoWmmeDM2bNYYgUFsNKYN9W4gjSC+fIIT7/n6Th15hRWyw4SGvrAxSK8h7lrkMfCH9dP9evo5R5RLpASklYTyzooTHpk4jro9ZpGBnnHC3oRuxyMFUid1kmLpMjR3rxYLXHq9Gn8uZe8mO43PpNKjac2ZACwI4rbzFKxID+20lmHVBg/Rh5S26EuXK6WrXH8B8iNjBpaO1iMNxugjnn56d7n7oPwQVFcE0bSvmVuE/56QpdDYABIYnz8VpskKPLLDGiIdXG2v5Ik4M5eYRSzQt1Gydx1yRnMkqodF4kI77HMIkEzLhBKRoOlcukY+GPiLrnla3GkXA1lxb9aKpdqioBNm6pm2BD7gtkHWgS6iPjzP1mp+m/v1in71Vr1TEiIm+EI0bW4lcljAqXXlCpDt3mJCJqmwdFijjvvuB2f+ZJPw+rggIQxatr38Fx7hbPwqeVCK9kxNUNJxLQ5ySaqpjdbCbpQUre6RdFI2kjbq3CnXqRuj5BgL9ktXYAN4zbHzTVV36P/WmgWnjzZvDAGIDS9yKad4ubbbkY3znUHsVE3/G+MHUQEi6NFn9IIgWjsW54aU5cLBldKi5TSiXO0xBqLILPJ+6IDMSIIBg/+aIMbipLorL2csyAw79PgRlN3jMZIsQNiB+06AB20W+HgYB8dFCsoOo2I2iEOZaAIEKPi1KlT2NraHKy4zVAEBLJZ5vesIkXyZ4r00fxevBXZWCSHIx53i8Z2s2EYVHy41sYniRgnwnjtUvwm8J2lfFIdM995tCNsTTIiazEpcsr3iXI65GClCwFHBwe493nPxYte8Hzs7R2gDa1dJ0UqOqIyrCulhlKXg9cuAy86tgSwKXtBJAntrDhay9Adyfh2k+6ZTt1c9KqNTQcsqEd51q5GiJy73swY4AAqOxXLCYBqUxyVazpy8CtIa0ZdJ6H9YuwMpI4OTPBd+nqzLyqtYSg0W8HkFJJoRV07zCiD2W+svtoQhwZFEQZjAydoHkvH9bRJiBRtENsRyIuUpUNZW4URczCbYLgpokbE2Bn5isKT2dQRaLSqrA4YbTiKqJ1pJ4rHwq4LxZHHYM2iFFzZlo9YsaJJPOuztb/sNa+GNC26GCnEREtmnxJlTGBGJLDNc9chkWM6RBXcsztFrlM2w3HTPXnPUXjM86GlceKx0zYej+Ex+BFMA2lbQBUH+wdoCvBn3+KMQ39kEVeI3QpRI7rYb8YMQ5DC3eCI+3JM9nx6zuLQcgdW8yMc7e1jfngE0YgQBgW4drn1ZljYUmkGo9CbKHXzokZo7Dd+rFZYLRaYL47QAehiv+13sf97dPjMQovuqMNKI2TSAKGxo7+1FGIhROtas039xK9l5JDA6xvkcaWeFUaNNSd+r/ExNHOtPTryeG7JvKqQXRBGI9W3///8q16B7c0NrFZxUPOPFh2Yg0x1DaLi0KvvVR+/CfC4xy/Zt21Unk1vrQSGidM9pQOh0UfBWPnUvQ1xf5hF41p0e8W5DAo31LG+aSWRruYsDK3QV8V5sNV1gyvmBzGR6I7gP2pzxhl+jKRaqHlMa202KVnXfAI3Cn4RM09SdWdnshwK4TPVZErnFzYibBNHQL1OXuoPkFPpjxc8ze/T05dtTeoKpHpME9LrYE3Jai1XW4l1ffzmrw4CU3/QpHdxqpiNKM19E6sqomlbLA7neNELno+nPvVJuP8TD2JraxPaRWvHNNG1dJ1FCvZIjmjW7BZhfK/pCHF4rFpFbpHXKuV9WEmng/Pqlz5xLUJSsvOxxCwXOFixQd/Jlla02GzcaqeKKxevokWDGCM67RkRGvt7rdOI+XKFc+fOoN2cYrU46k/C6ZYLud2o9IiKa4ejRAWPJ/NOFaIRTWhwuH+Ao/kcp86fxanTJ7E46lkEAuDEiRPoVqvhOQyGia/sTFEgBPt6ooq51mMHKaoiQLFarTDbnODW2+/EsltiiQho4DASdDGibVpcfuQSDg4WmMx6QaTE4PITnAzU01KccbdKE1BLDK1vqlY5bjqlZkKu5vNRrWQI+HhlrSMkRNeM19S1cdWJ5tSKhZUTLsfCPwjmiznOnzuH17zqlTicLxCavpsahNckCmhj+JlzIfBsuzb/Pz60rMbN6P94OYSVNcVUWawyRrII0OwFw/xATRYEMTJ8LDVP+lTcCNdnHTDN1qLsIz0f+Z4KuQgnAF7BazEgIGvuEKkQJpUEvz5VV9npZFHcHpbXclawFlno9IIohSikjZHa+oT0zQs6c6c1t2m0cqGEZ/0W7MFWjgRnGFufg6+c24L+JmRSl5KDwM5PLO9gtBSNQkQj9knRxvnaRaixZozt+GXsaOatfYCgCNkIOVLYOQH4TF05WjCnW7ma1HIWJ5T01gTBfLnEbTffhC945cvxYz/+kwgnthG7zrTjhT8r8Vo4FtLlzTBhmaU6fF1zhlb6TEeVvi24zHpnapJxrMMWxYySNqMUdw3T2CNx43MbVH34DDG/RfPcc3QVyDhlpWseQgONAZcevYKIiA4RohGd9npgjf0c/ODoALc/4Q488SlPwEfe8X5snj4BXXXQ0OsDshDO5m6AcglYce5JgOg6SAjY3bmBk7ecwVf/tb+Jl7z803Hy3CmsDpZ4/zvei5//6Z/Fh//0Azh14iRi1/WFcBgmtNqY0YMwEU0d4J7EuRr7joI0gsPDQzzpOU/FU+55Cg6PjnqRH82fe/FThDQtHnr4YRwerbC5eRKxW/UAl3FB5wBdtUWZUZaLXdfEddDFdaLU0h/S5iE2BIU+d7IFsx1a4RgCbIXOB4qUD+A6dFqAnBxPf7Rt0utKECGiH+aNP+dEiAjme3v4oi98DZ7+lCdjb3cXzaQd6IzBWf+AmnRKXVfRC5H9nwsVzn7MaUei+ZcsBwtjkFEjJJUYd9jPR0gcTLP1tJRImUqmqXgAjZRB160WP6XpAADYw56oEA9A1nQyxcKpspeZCjbKrWFxqBJCn5T9qTxnUWBNpObwyyqjAiK4WNaEL5U1p07XdlFUqNx2gRC1/mLfQk4jg2ilRdlyo8n7aR0jg3IyRpjo2KIlRX5dtQ3kMf5xbI/7NnZSidZO6wWqVEx068oR3TgG2Lx3zmZnBKeL1FzHhkFhNzTIQMd+1x7Qoh2+9DWfj9NnzuDoaD6AaGzGeioCVMiiZE/UWpFWSS09ci1pvJbPYPPrx1mjaGlHBaWdpU1ZpbjFahBz20az2gctcDlaHAhAUCseO4wEMYHgg+//IPa7w174FjushlN5NzxHR8sFNk5v40Wf+UIsjw4RKKY5K3bFnfp55FMJYkzvp0MQweHeDm572p34J//5x/FXvvVrcdez7sL2+W2cf+LNePVf+Hy8/qf/OV748k/Bzu4OQtOYU6ua+OfKR0YJhbm4GiSeGiEhYHl0hBd85qfizLlTOJwfJYplVMWgEEBUYKkRD3z8E70eItil1IC+9JgWv9jnwfJBXDJgjcmPCoyLu3WF37u61ppfIMOGxiJnB3QnV4pWnwc11kZJYWHWoeCKMDpOrpZLTNoGr3vtF6NtetqiGd/AaxvsMxIfr8ZWxFhsVcsCwf9FPLd+/JPm3h7uLwXXUTymdHj/AbZgSVZILgMHHSyG+0/FbbwMjTPXntQLw8iMU+ylqv1yfn21owoUXB1BMfsT781Q292OjhpZaJbtnwU4nrlWTpvqKjx1Ssc0pRQWjuXFdMQeFjadQeSU2zagr2NxnM+KJxsEieLMYYTi09JcUh26kdTEueOhhrWebRd2Vp3EP2KTsYTS6hoAi26FZYxF+8zDIgph0jEPjM3qVpvyVJUMiLFwqQJt02B/dx8v/uTn4zM//cU42ttHGDFnKbkuzwZ1FNII28PUaQCsL18d6SsJqmgTt6chZtBrrtDHFt/YaZLMm+cCSF3qucArDdWJC0uOeD5hEyuCThD8GzIjXckpkYWO0A7NtMFHP/ARPHLhImQywbzrevGfDjPyYeFZLI7w8j//cpy97Rzmh4s+l93EKo9Cw2BHWKoJm6uk8M82JkVcRYRpg2/+ge/GPS94Hj5+6SHs7u9huZhj/2gPD125gK0TM3zHP/wu3Hr37VjM5xkmQ8KpLJgjUdRYmAafldHbd0PbYr5Y4uRNZ/GFr30NDudHva+I2PSdxl4H0AYc7M3xgfd8CBPTveFxlo+ulkpRXSmKk9aYlNrI70dg2oPpvmORoCmsRUj4pqYLUzEtwAM+xYBikJPihMTHtGmU8dy+3eo5K1zA9xv9we4OXvj85+GzXvJp2NvbQztpGYZoord9qI9WdEhiLN1q+CTqrH52zWLuRJmSeBRXWUydPhuxsp7xe4lQqiTeHAVzI62QiaRckCDdD3YaZO93PjyiiKwebZ1C7sSM+VU7DhFH2vLpgU4rNIozJYvaMtSuyKfNCZepUwe1tEaBET8H2wZz2urioVLPhMzzlXXgYW5XOEyxMr+cLS4i5fylJLQfo6/QEoG61p5X/5Nxcc6Lfx6LRK6FTZyVndGICPa7Iyy6lSHu18iJuva9Pj6BYG0BtItd+Y47VbRB8Lov+6JeFjikSMWohTO6ZqPzrmlUKZxqhZTHWWrWjGO1sPjoelGNNdM8fuVRrciCFIEs1VltTSwVI3TVYTZp8eiFi3jfO9+PdtZguVoOQJAsSwpBsH9wgGc/51n40r/2Ohzu3EAzndlFwwQNZbyzyU5Qi37W2GHStjjcO8DTX/A83PvSF+Chyw9ju93EZjPBVBpshhYnNjZxY38PT7z7dnz2q1+Gw50dTCeT/j2oJYNKLSxRLVlPBsW+hAaTdorD69fxur/1NXjmc5+NvcOD4fSvxnW4ihHtdIqP3/8JfODdH8DG5gy6WllSnDwGXe64j9foyZQ48+uKxJp9bI3fVx9PTkCpTZKi5aVFxIQY06dU14+KHChvTrFPtutiBywW+Iov/WKcO30Ky9UKIQTTFCssZ/UHei3QDMd2SB9DDzysVStEHHXLXJhrJSWV5/hVDRUqDgs9dlkVkWpn6/GkG4jLkEn7neaI8JrDE2tSKWVNvoOFunGoUqKC0Iqr5Ryn0tgKYwtc3QvNYju22blELjFDpuJkl2Iyqb3N3y8iFtwDS2DLuetOiOfn+QbjUImQlUx/swL0DOuAQ2yAQR7ISk2euih71kkgohQGc9QtMdeV0VJUnqbqbcZ0xRIrjKJT4RcFRmIKMQREBDFGNE3Azu4uPvfln4V7nvMsHOzuD4lgFjSijC1WR/pXOI4EC6XUTLyoxUR9U02qVx4zpP8o/fmawJYxdRDKD5iyHo/SAPk0wpCVmtY7n/xSQp1kQiYhvUkbGtPJOXYrBAGO9g7w+7/1e4jdqHyPfTtSs74lSMD1gz189f/vL+MzvvAVuH7xIiabmwhtCx2CdHjcMm7O/e/q0u/V2FsLESMmTYOjvQN0OscXffWXAa3muGsd9ChRgU7RhgYH8zk+8/M+B1vnTmLn2nW008nQpYuUAqiOoMaF+xB5HALCZIJ2NsPVS4/ilV/xBfgrf/Ov4MbejayTiH2h2Q3hKstuhY3pBv73b70FNx69gsm0QdctehfB4ExIti5im6vYtEojQhTralOydglMGJ3lZcBBXUBQHnfSrdrdxc4JRDTpF4zQTqwowSN4xbTPNQG0FHbRt7Nx6hxSnsLR7i6e+tSn4C984Z/H3t4uJpNJYUWuoj2IACkQc6jQ48iklVM/dxWUOkvj72xCQKcRi65zxY46pmP+Z1UL9GELZzobJ8sq6TBQF46OVkBeg1RsaivMP4uF7YxncclhP55+rmQHjkVXRTP0TBS512pjtVPHQ8RSe8XqmEqhpRajl0TrMY2SaC0NKuu4C7k4SC0PcZnkY5RiYSEZ2yuhfq5TNeLFTDrjLGY1xL3IuF6BaVeWLXWS2ojYEBVuL5OqUohJnjKjmdBHLZ4AwSKucNAtaOjoQiLEDgfqlbV7QRV+tsh6DUAuPnolMAt1Vqslzp46ha/5yteimx+aB57Z4R7wVMsu8AlrpX1HTe/p2IQwm6pCNsqylcp+4px0GwB9DBtVLeitBsUSv07o+pMcp5trROyW2NqY4Y9+56146L4HsDGboIsdFYmagE5d7CBTwff+0x/Ap77iJbj26KNAaDCZbSA0k35iF8e4ck2nfF3Fwb7HVj/BtStXgM0Gf/cN34+Xf+ErsLu7jwkHvtDrb0LA/uERnn3vM/Fdr/8+bJzYwPVLl9E0AW3TmmdWYQlvjJ9uJhO00ymWixWuXrmCz/9LX4offv0PoZMVlqsO7ZhMOTy3UbU//Tctrly5ht98429gNpn0xUwXMziMvNu107aYbSvUWhTGCuojtmsZFAL7HMBrEApNgla6Q8RiqLrASjvA2iXAbKhSOGhtAJTtMnWHh/jqr3od7rjtFiyWywEgtv7xkMqhYnxmfUexT9mrHovXJgSuG9scrhY4Wi1IeJv1W2q4/DAj3iImdAzkqhx7lcKfVPl/YQPPfDOHr1nI46dRB2fCw1SqCSnGLqsO8qY25Kk21bKYk8LgRwJ+2O6DosCIpQKAuyXqvF3C2MXKxoOqmAWZb5zEfdlzj1oIA+EWmeWv1GoOSeXK89Zg2yRaSiSMbUvcgzuc6mBmQsGMQZS7CU7978V8WY3e/9EqRuwsD+2c0atmlaMcsfYaq9Q2RxR0QNZHjAlz4tn9w19N0+Dg4ABf+prPxVOf/hQcHBwhNK15UMyJX9wWn+yaYgUw3pJWnLKk2v5CLa5VuetiT27pARZyJkhO/vLgIHUbuVDDTMEjKCHdAVt/1GUsZJFozk6I/RhF+07LdHMDlz/xCH77134H2xvb6JbdaMsfThyCBsAkTDA/nOPU6S38yL9+Pb78674cy+U+dq9f7zs2k7b/uwmQ0NO8RBQhAK1IH+25WmHv6jVcu3IFz37J8/FPfuEn8Jqv/mJcPbiRUQUiZuY4XovQNtjZ38Vnf/7L8Yaf/0l80kvvxY1rV7G3t9u7f8zv7zMyQugLhHYyQWgazA/nuHH1CrbPzPAt3/938IOv/36sJhH7y6M+GVMZ/9w/v8vFEqdObOPN/+P38LH3fQTb21uIy5g/qEjbSCp+tKgE1+PqxYrTCiGfwCsE/f0wwiZGVjuf+Ayl0xML1TW8ktWYcenZ6u0FrtxehhutJX1xBbM7ChlDCDja28MTn/Z0fPVf+DIc7O+jCQ0t1/Q8UpiMqO8mloeN2gHEwMt8h5I7Ko43OL6D/eUC86FzZrQuhnqXtURxPM1Hu2lqwsnCRGSnLA8Ra60TsfoJp29ymcGmQzHm2IDC43IXWZLGacQbjvH1BkxIgWZj51Fq6Hg3rhDJID3xRbKoXVsNbLd/Pc3rvu3rv09cXK4y3VEZIDMWBKFAESqcgISS2DItiUkXFvvqXWNJ/AEfGFHOQ2DdQFaOJgwrErKoiRFcpHSkEIobevyzIhXWbJBig3KHf7HUiBMywV1b59ixbXyfvu9WPhzMCBeH2mQQC1tmpEjtQsW3Kwg4OjrAnXfcjitXr+N3fvfN2Dx5MhUzieMvNAaqnTyEO/QMs7Bd+5paRAg2Y99LeZ1Hm43FX0qFpWqLJfGlzxhCJTatRVQKuI2YSOIyfjnfz0Q5lLx5yaA2fvDBh/Dyz38FNre3seqWaIeFN1DruQkBi+UCG5stXv6qP4enPe+ZuHH1Ki4+8BB2rlzD8vAQ3XKB2K2gq4i4WmFxNMfBzj4Ob+xgIR2e/vxn4S/9nb+Gb/j734Sb77oFF29cQdu0aGgUFyhC1xR1ErB3tIc7n3gHPu8LPh8333Ebdnau4dLFy9i/uoPl4RG6xRJxsUBcrrBazHG4t4+D3X3M50e49a6b8AVf+YX4zh/4drzi816O6wc3sFgsMGladCMSWvOCuIoRbdviYOcQP/YP/ikOLu9gtjHtW6PcMk4RwGrsr6JazOmlNmJT6uBJfTHlUDEj5DPWWPp8RU1xwZZWqemh0mYvduYuQmd2dZgndkSL9WNz8a9q3VSJsArMr9/At3/z38YXfd7nYGd3txf/QQYNAP3vYAVMmzZLT9a4kGSNQLBUMcAIoc04YFx7RXBpvoeHDq6jaUJxEgqOfW+SM0kfJ2Ztdc8qvwphlFaWEI8tdEl5AZU1D75TnMXEymvdKFZ2ArQikEooatMNIwMyiEuKTgGMINAgzb3t1IxPhn/9xoffo2AbxRihqdnzrK7Fpnyy93AWL8gaq0mxLQ9hxoCWWcrFgm5aZJxDD6egrJrKeAcixLEWNyHTAkFKZ9/6UjixBzehYqa8zVdL3Nxu4RW3PavnvouLGFUrTuLN37TJxI4IfPtMWV+Rdn2bGKaDvSyOs+oO0NhhGTu0IeDq3h5e8QWvxYOXr2FjYwNxtaxQwKzlLSloU455Vu4qAZbqWQVa2l1gJcGqLoubTzm0MOo6CEktuUvEWFVFUJ6wfFypIUhqfV46HOuV40Nj38ZuQoPrN67iq77xL+Nbvufb8Mjli5hNp0MbQCzaVPo/DgqcPnUGi8US737bu/GW//0WfPCdH8AjH38I1x69guXRESQEnDx/Frc+8Q7c/fQn4YWf+WJ8ystegpPnTuDq9euYrxaYTSaD1kLM5h+GRbVP3B2ImMNriKuIjTDF+dNnsHdjD3/69nfibW95Kz7wzvfj0qOPYr5/iMV8gc3tLdz+lCfgzrvvxAteeC9e/NKX4AlPuhOHR4fY2d/pF3LpLWdKHbX+8C84nB/h3Jnz+PF/9C/wC//yZ3Hu7Dl0q+WwNuTiRDx734nEMgNFKV0UidkwzooL3zoV5cpalTRSohhxiAveUqKywQF/1kyM1AZr+U1UXXC2UuyyaNHbJHhWtImtGiFBcLC7h6c96Yn47V/7ZZzcmiFqRBPafjMNYWC6IBUBXJCPHTSR3DCua/+c0JjIeTimMFMb84RGgLdf/QQ+vHcFG02LiGiAYYFsckaLgBzQZgE64uX6aaRgD5xqR5WceiliZHVK8Dh7+tEiulwK8WcuLNR5Lsd6Mo7FiMCRbfkeWTN2pIUs77u2AGCtn4pC3vjwe7UIDjdwDasrtEUBn9C08KVL0Sq2hAkxWfHi2qu5PVnMmY0qHxasMLZjzOvW8uYTsuJAqHJ3dDoniFG1gRvqonHz6KJ3Eiy1w6QTvPL2e3Cq3SAGvTvhr8nUripcFQU90UyfR9uhlP7bLIKLvSgt9r6G+dEc5286jzf8q3+Lb/nuH8DZ229DXC17Yh3nXNJtksiDwcWvlmZX14LXIiipKhlw8MXic3b7tMk+p9HPOumuFuOJcp4q5r80x1A7R4A6xbRwSzH2nSWNHRahwz/6yR/Bp7/sxbh0+So2NiZEysy/azy9LJcrhNDgxMkTkEmDxe4S125cw5Ubl3B4cIR2OsG50+dw5vRZTE9sIqLD7u4ejhYLTNuAIIJYCEhzIRBCttuOB/MgfVeidzJGbM1m2NjeAkKDwxuH2N3fx3wxx+HqENPpDGfPnMPW9gYmQXC0P8fh4T4aadC2gUS1vmsXMJ8f4ez58/iNN/02fvgbvx9bk01AIgn6xM7KXVcgUxnhFNA2qrzUcMB2mXSNf0lM/5IgZMjtXBPaosX9o75zpLbtbzgloo5ZTfcD8qiQoWTKzH9YcJYCOLh4ET/+hh/F1//1r8XVq5cxm20MJ+nQxy1TlzOf/mGhQI6EWKX8FejMuo5Ba26b4fNZxYjfffTDuLo6wjQ0g71VCJGrtPYEe2ggfr6kZFgpO6AJqy2VA0GFGDpuuMHqPMxoSfNhlzdfLX72cEgYgRBRqWvOs3AprN3iiy1DW3M8FFUD4lNX4HDUcF8AMBtZy9WXmcQ5BpEXYZs7xNZANTKQ4IhIarCebPMRSJkwllDBdMFVHVkJRr2bKiHrBM1hRM4dIOyrpAutNQkkV5aR/NE6wj569OuyW+HTzz8ZTzlxU8/dr87A+TSra3ngAi3IgL4CjwMmOS8WETkALqabr+fO9wtujBGNAPvzJV71JV+J9913P06cOo3VcplCn7wla2xzqbAIUcyMyTBX1UeMlrhAlTWLhvorVD+owxWcHnyRQ5PsounNGWXkaSXamelvzt/LGObxi9u2xeH8CLc84Va84T+8AbfceR47u3vYmE5TtyeC/MPDwrfq+jS92HsGIZOAZtIiSAOFYrlYYrlYQWPvApi2DZqmSYCSqJZZ38sU+hCiJrRoJGDMwVTR1AoOQ5sYGrFYdVihP6ZpCIOgFIhdRLdYAl3vKJi0AdN2mgmNjtEyugUWiyVOnz2F973/I/jOv/Z3Mb9+iNlkgtVqadr8YOcB1IRg5XvciXnVbsS6rgBQWHFyDU3LzXxfAEDNIm/uTNcws10AClNbx6FXNUGUou5kzV1PciyMry+0LXYuP4qXvfSleOPP/yfM53NMmoAQGoTQf64h5HAr7gDksadWGPs41pq8DvRj1iizx/VdpwDBjdUhfvuRD6ODogniOrKSYWxiRc98OhamygaKEBfYVcc8r+JAWkpjR+0x14EPjM7locyFyNRbj8gfP/OkUY2UIMiHbOXiRQmdTgeLSueFD6p5AdOibuG9MdhqTEw7OoNYaB6lTNZirrAYMaF4RrFIhseMVgvNFsEsBJSUAZBsWl58yIWAZBgPf60aBK7N52YhCQhEAwJPeAEebwRJRe+QxUbkNiCTm+F9XznapyCY0jusXoQpjnbgKnuQuKZQ5fo4Uq5Aqcpn4VLTNFisVrjlpvP4lr/1dYiLVd+OEhjaFYM9SjKdZNsTLB5N1WpEQOI9f+Cpqa/z3JAEf84loDQTFOWTrZoNfRTrCTIcRkd4kQo5MhwURDMIy/AXKHGM4VT5PgxDLgCwefIULnz8UfyDb/9+7O8e4NTJE1gsFjmFUnub4Cr2xdmq6/oNvG2ABogSsVgusL93gJ0bu9jb2cdysUQTBJO2xeZ0grbp77kAQdB+Ix/v1ajAcrXExnSGk9vbWMUOS+0QQxiyYEL6PsEwwhBB07aDeCxitVxicXSEo4M5lotF/7taQTtte+pf7OFXHYb3MTI1hs9/vljg9Nkz+PB9D+AH/s4/xOLaHFtbW+iGXHoYq1mkoBxn760pyZUHabYLJURsNChvF6ySigtKguSQI0bs5XuZbMJsr6OURk6ThHMmuXzNwXLq4DSwGHC48eP4X6ENWCznOHPqJH7oe74TG9PeVZF8/zSm41a/eU/c2ViTTVKDk3nnG2uPfBoqmA4rgmvzA8zjEg2J4kQy+MsHfKWiR7P9TolXnFNA7QBCCY9cWrLp5Jzw4C74FE6LTZ2YcadXWgc5lZAj6tXfz6MgnHaKoltMjjQPkRO/+RMUyY+VxkIjcBaA22sceKBEZzJnUmDjQDnuJQuu8vyfLYJj5cSxuDzj95HzfBaW4iVpNShHiNpl5uQmWESdpUwK1bhRxpIlUdi6QafMMHi8r833sIxdOYpQah3VrKlU7a/z1BYPofg/8xZ9S0Uaf850NsPOzg7+4mu/DJ/z2Z+FG5d78ZjxvTKZUbU0wsNida2CeNgkdR1w3BMyhPzm6twePt4vS2BGBKYWylE12RPGtkPVq7pjWS5cHbmssnBw6838+yCQRtB1EafPncH73/5B/F/f+Pexv3eAm86exWK16OfwIugwoIIj0Dvhej/3eJIP0uc5tG3ApAlDkZlfZ1BBo4JmmPS3EtAOkbpx1eHms2dx4SMP4o0/80ac3z7Th0MtlwACmtAMJUCmOfa/O0IlpkKnCUA/3s/FUBxyDtLfcYg9lt7D02lE13W45aab8Wd/9iF899/6Hlx74Aq2T53EarnqN/9S+J380GMmhdF0IDtQHLrBFsTuGbBsCbXzdrAAVIz7x96JOZUN/hFQGkoYIwqdUsWYzki7w/eyWgGr8d8jUydphKRNi6Pr1/HX/8rX4qUvfhF2dncwm0xtXHix8WnpPzTwHTWK9FrhtZb8579H6KhDaXWXh0OSh93Ai4Wd5kqKkZ2Y62VHkZr3AhrLMFFWvMAXdGhMiL8SR86EQDEHhmxjtQ0igvmoOuu7GEhSAU0j952uCY4DcXZSt0ysBbV53bf/re8zymype1El95NdW0jsnFSFHyc6EVFzn8l/QYz6kbUjYwU3+pekSMYqF1qRQGAObv+TkCfdTKEgBgozAcQnXklJZRqLHvUJdNbLs+pWuH3zFLYnG87ZwOI+NdnSEJvI5Z0D/vQvwbG8pD5o8IXD+FVB+gS4yXSCZzztKfhvv/yrmHcdmhCgXcytKskz6hHQFJw7QZzPuEYDDM766NvwArupFkl3wlZFxzMTPyK0LUNe3Md2r8Oi5Zkd3bdpfGQ1zfa+JuR0KJwavTXwxKmT+PhHHsBb//BteM4Lnou7n/xEHB4d4XC5QDfEsqrz3OfcYylQCuO1DNLP/Zv0z/1Xd6uIjabFTWfP4L3veB9++Jt/AL/xX/8nAMGLP/1Tsbk1xXy+6C2JoW95jgtnRwt6pNOWEK52vG5x7OwNs9C+gABit8LWbIaT26fwpv/5Zvzwd/0I9i/tYPvkCSzmR07JTjNKdx8IpRPyEBEOta1C2eiE/zb3BP8vUVtUtELrFMPqELEZKAUK24yeKmMrrdzjKs5gJlaX5or7DNKShBJuJi32d3bx/Oc8C//iH/8QoDFpOvqRT+g7AcZF1I8D7NogBLWxtr7gDh9FLeBO/yyUtHTLMaUwYKErvG/nIlaxQyO2G8tdQzAiOJB234UOJWeAuHGy54gFi3cWl/xqCbxSakiE43VpT6K2fhIvSg4mkiGaGap94qXBnAvZ34UszaSBEc+OkD5BdNTpsRiRX6urWfoCgH2FWvrMPUQhb/pSRAMXuEsRw64SlOrb1HbneVeywPhIUo+69fAbIQeEtXjVNkDLL7c2IOZpw1n8hNrEhRJdrJYniGDRdTg93cBNs5M2Zsa/ljVwDpD61aYA1il2ppI1RZ1ULVPjn4UQcHR4hKc++W7s7uzit//Xb2F28uSAFFWzkeVFNZB1SEzbSrzAn212hqYNkzrJpz1byLjFuJK5LW4yIzA5ItRZyg9r5kZRnoMXj4oDdhhML9KpuUxD8/ZNoIuK7RPbuPTQo3jTr/8G2s0N3PPsZ2Hj5CYOl0dYdMsUXqIlx8MG49DC3FARoMOpvAmCs2fOQjTgl37+V/D67/5R7FzZwakzp/GHv/v7+MAHP4x7PukePOmJd/XW1dWyD9eSLH2MGMNU3Ew/kRjziSUO+pdV7AmFk0mLs2fO4tKl6/ipN/xb/Id/8u8gXcDm5gaWRwsIIgGFlLLVYTZ7r+9JTgCCm6fOYEpoFKdREuPlNkwCccLRGslNinkVcevFZLcbUWxFO5SeGZZ7axkPzLjf1B42seSa5vhRI7Ba4id/7J/ghZ/0HBzsH/S2P7L7+Q29+jeLH0VskIy7n61NsDyEmA4xp+TR+nhpvoeP7l0aXCnOjQBJs/JClChqH3g6lCHRRdXqMcb7gdaxpCdjt1pu1WRr3zjrV49EpyA4GYF09vVGqC38VApGRXZRsS0QVPywVs3t0+5wmPY0oaJU7Mi6+apv/4bvw9qF1qn93YZXlkje7pBDg4KxaZSq9yQwVJrdUVtWnCKYHzhBWVqbmjtV2B7aR/hE3jQczKM4adeY25Bj1K/5prlr62x/LSoPVXECXZOtbToAQwspLRJsKx1UtHDZCkWUZ6WwWi2XeMELnoff+O0346GHLmC2MUOMHYVOkC9VxJysbW+uXnxZtHLZAbB3ojjj3WNlQaBqs/QVgxSfgZRFGcq2hKzJOBBa8E20qMC1Xfs+VOwiNrY20c1XePP/eDPe9afvwcmTJ/HkpzwBG5ubWCFiueqw0s4cjoPVptvPdUD7CoDpdIpTJ09iMp3hHX/ybrz+h96AX/mPv4xpM8NscxOxW+HkqRP42Ac+ht/9X7+H/cND3H33Xbj1lpvRTFt0scNiuRpeQ0RnEsXE0PJiavn3G780DTY2N3By6ySODo7w67/0Jvyz73sD3v47f4wzp84ghIBu0A9oJJ0GnXLXEfG08jnZrpyuZwK4P5Eqpt/5s2HtwAUJUjyJqFzXanB8cRhzM4L2q7B6SzQfvfv/bSYtdi5dwdf/1a/FN/+Nv4KdGzcwmU5TQR2aYAr+wJv2Wr+/rOUArBMGSi0fQMprzq6Tj+5dxsWjXUykzaMSscmqwtcsIbr1MQXV/gBlOsniniHYQ7DJo6wUcmlvGMPM1MXNVzgv9gZw+5eHtbl9ABz1zIJQXQMKYoKiEzGIAPLGR96rIDWqDBwAVRTpd+o3axvMTrW0mFZe4rAb1b5WH06zgYtWLTogm5Cs+bCNot7NTkSCayU7D6kpNmpxyM7lUEEN9yeaSLaf/od99m3PxPnJFlYxpvYsHiuj5vGknxSS00FnEy0EIhJVLUab2Mivf7E4wqmTp/DGN/0Gvuyr/ipmJ0+gCWFQxPaiNtu5sIuJVh+w0rYy5l8H42pZ89C5OFqlYlLX+Y0KOxVMNc+ZBqZoMVAWHmNIz+F3yXBFJSXOeiPidBchtRRD07fqd6/cgCLik15yL179ulfik178Ipy96VzfIl0tsOxW6JargTJIbY0gaCVgMmkwbWfYms0QmhY713bxZ+/6M7zpV/4X/ui3/gDLwyVOnT6F2HW9cr/P5cNkNsNyGbG3t487774dL/u8z8JLX/npePLT78aJUycw71aYL+dYLFdYdUvEmLsmYRSeDQrzpplAJg2ODuZ45BMX8NY3vxW/+8bfwsff/zFsbW1j88QJLBcLoxvpnSnqaJuUZse6EeVOpN/Src2ulrQ2fm0kgZWaOCpBEW3hZCMFzhtrUoqq0bDHEUs0O4C42zdCgmKktSiamXuYBOze2MMnPfse/Nav/gK2NqfQSCfCMI6jqGs4jAKEx3bjKEDlMdcdOwZQL6EsLOBeszUeJ1Ya8eZHP4yr8wPMmtZ+H48JxR8EaUrixG9ihHm1vC51h6P8QzNxdbwfSKtRiK6FPPZiHSyVfeq4bD0fBqTqDsZC1kLR3G1kXo1HJo/x7+y5Y9fbGx95r6r1SvTtCnr4xtlUWQnbykRoI2LMqMMjG9WmdyF4laU68EGGPygBOMpmshD8Q41tJxcAqRNQKwBI35b5+Wq40zLmenNwCPl0FZGiZYF5XOE5J2/H887eiVXsUqsWzrZkvW+2halG9Sv1AmBt7oEN8YgjqCbZBylONEYczfdx+sxN+Bvf9vfw73/q3+D07bdjtYq2AEinXQcSgdgYSuMhBmr8RxvTWvJdRWtOLs0t22T5Mp+m24StHUigJu46bfJaKQCSWjqadqJZ4YrWg1hmDI1R8v3Sq93bpgWWit3r19DpEnc880n45E//ZNzzwnvx1Gc/BadvPo3t7RPYnG30Hu5BPxOhWC4X2N/fx86NfTx8/8N475++D3/yB2/H/R+4H3ERceLkCTRNg9ViMYTrKGRQ2CuAdjpF284wP5zj4GAPk80pnvqsJ+HeFz0Xz7z3Obj97ttw6uxJbJ84gclsgiY0KZej6zrc2N3B9as7uPTwZXzk/ffhPW99Fz7wjj/DzqOXsbG5ia0Tp9CJolt1TqmshcDMwE4EVhyXFi8pBcoG0S3Gy89CqJEcywVAjubN9sA8A6H1THijUAqxyhko4lDA1qyipFtRh7iy7hr/zxpj3gTGZ3X4s9Gu+2u/8J/xspe+GHu7u5jOZkQFlexld8FDfQ0ZzAjSFwBFpC2/ahM/LPbwZTZM2xmOUDQS8PDRdbzl0Y+hdYRZeD0a00354CkW2y6MJSjOG2r0S0IR6JLWRUluofROYi5AmGuhKuiXQlsAwBVw6XeSdZWXx3E5jQzqUXUaNMrDCY6+T+uqJROq6cQbi2HqAFAognhPNvOBohu3rKsKNcN4TH61lkM0GTYe/r4gNdIdoWaGixmH1kvgJV9I6JUushIqsi6gq87cJRh7iweTeB8uQ33GDZWby8u4wsl2Ay+/7VmYSQPlRcgkJNYgNX5DdSAgB50Y0ZqjcMs/iGUyHlIIVIwdVBWr1RKhbbF3cIhXfuGX4/0f/AhOnjuLrlNI07hnVSz9i326hcrZ2yzFgHt8sKVxL9DIzzICfDtebegLe4fHWR3LCr1VIiVRilGwGJiRP40AleKGgSFIiXKeBqdj2p3GwW4nONzfw2I+BzamOHv2DE6fPYUzt92EW+68DdunthEkIKpifniEqxcv49LFS9i9tovdaztYHC6xsbGJrZMngaZBt1r2YUPjxoFsXeyVUGGw+036Ts98if3dHRwdHmK6OcGp0ydw8swpnL/1Zpy++Qwms+lwTwnmRwtcvHARVy9exe6N6zjc2UeIwObWFqab00H9Hw0jIj8n0Z7WrdW9Sngr0LsGx1wYlCpovporBqXeo9IJgJSsGFGpdhtqyehqoBGVSYZnUvDmquwGGjb/2CG2goMHL+B7vv8f4Ae++ztw+fJlbG7MBnFfMPoeFgyHYX0z0eHDmwwkwvRFgJQRN4+P+lPpqgQR/PHV+/HR3SvYbCaUY+9E0cV4hWf4tKGmTT4ULyBtnkztM1NscTRHxzYo5onlFfAneC/qdg15k0ViNn5j9aOVR/3rVzdmZjaGJDu+sIiZ9Dryqw+/R228Y9717aaj2f6anrfMGi5m01xpJPSvrU7G35fDVPJEzET6Om+1VEKzxd2kynQqtXhHH0uJcREcWz3pdBZStd1vqCFdnkjVeo5HzpuUtdppiopddhEvPnc3nnLq5qGVWj4sBVRDYZjUCsDLmqqdJWrvq5kXaWEdHN9LjAqNXS8CA3A0P8TpU6fxO2/5Q3zBa78azcYGprPZALGiKF4WabrPi3MZ8n2hZpbrQ3bU0euYalgjUTKR0dZqdB5kQRmDSJUfRys+A3UYzCnR+XCZIGmUt4wlNdYuP8YdvPIDOhgAwrRB27TQDui6gQswpOeNhEYhPUzbBLRtg8l0gqadQiFD8iDjR6MJpEoz1bRR9COOYbKAoIrVcoHVcoXVqsOqiz0uOARIaBCaHivbthM0jfT2QBFE7bBcrvooYQnZfcPPs9o4WKa08XVTKUE9qdMo9LlTB4lbCIKMhM0izbyZZpgT0eL9IUQs8Gl0DvCiqqLlZjmGl9F4wVDhHB+TI2y5YE9kOVqztFtB2gZ7Dz+MV37OK/D//NxPY7mco23CAPppqgUAh/8YzHiRBKhujOdHwuthZEWrnQtmorMe6gK/eeGDmOsSE2mN8JRPvyzaszoRCm5StQFOvB5br595/rhot890/kziOEtVLZ/vNLYh4bpKoYv3OjIVu0Ome4jIhTBra/48UjHICim635JtkZ1jDj4lKpBffeQ9WnhXByCIrWiRNmg2E6Zt3jCZPbIQxi4koBGDeiU93/ySu3HQ6o0hIonCB7cppBOOir9USUSRN/Fo+NKmvRhJ8FG00znWWGmWmRO5+EOdr1a4Y+MkPuOWp+UHE/YB8iK9cg7NaYhivNhg8AZ9JjEqWUTE5FBzEdBTAbshqrWfMx4eHuLmm2/Bj/yzn8B3fc8/xKnbb09z8P712yKDLTlM8jLzU2dhKYt7qc4WDcSD2moMMVGz2KiLC81MCCWPtyisBYxafR7bbGdtPo5ZE9THVOJuzssbcCo8KZo06XYDAGnQthNI0yfxITQGbdi3hzvEroNq13dxtMf8GlVZuh/COLvKi8iYgimUtBfjoGMZnrUQ0DQtJDQ9kXAoAhAHtHSMiN2qfx1dZ/aOSGtBKuJo1CKwKn5zH6R2O/lFskU7zWyFsadkD2VRls8ULmb5BbA6t4fVKVWFNxZPR/UoFfUKAKXEPbbSR+Pu8WOSJPbViNAE7F29grtuvR1veuP/gztvuwmL+QLT6SQVAE3TpDU2BHoWixAjK/jzXVJV27UFYdwNl5/WZWNfpSUgKtAhYhIafHD3Iv702oOYNq1zMmXgVhY4S9b8jO2g0dJoqjQdik41AmyPBbbgKKI/shUwjQpsMZI6lVygRHu/jK36RBM0bhktUL8WNS9W+c/7p+Yio2hvsQbWHHrLSHMVQetnI0LLgg3IsLGtNXW0F6hKYe0tW7rGmqaWjGVwmEwndptXTWEhaqtqDh5SlyAwXmhuJ5s2jNhK2BQtomuugT3n6rAITpoGF492cXm+h9s2T2M1nLYej7q2IrGt5lxb+5RrM6pURzj8sIcQEKMioLcVzWYbuHb1Gr7lb/1NvOOd78Ev/tIbcfbOO7FaLm1gkvvcsobEi7SlAI0wtc9vsPk+ye0npaxI4bZUxekg46FWXMuOOivgjpTfEARVwRcDZkyypKAQp2qlHSxuAyptY7mY7qJC0HdmRCJFmw7dg6HYHTUdmbTpRIpiBWRqICORAEtpd80xz12E6gqKDpBmmBqEtPGN4w1wvjmdF4RAKTokJaoHt9ToceKBXlKfKFZyJYTTOZ2ieKRFRoa9QAxkxQdPGR+kWPhL1gDA5dOLE5n5ojatEG4p0QJANt7nTdvicH8fG9MN/Ot/9c/x1LvvwrVr1zCbzYaOVigOStaG662q47MX6t1cP6dQccWLFt1L4UAaV1o1CFhoh/v3rpYia5H1gl7JmQlFYec3ZLEdCE4PVeesUOaBSen0KDJVzFhKjfvEiOxSpzS374v9U2p5PlrLwbMkRS+Koocla5SIqwEUrrqgZDL2kjFl/K1HAQNO+e7bZizIUPMzVbWA6Yxe4zKJxT/o9Ya3VMnyhjpp+O92Gqmu+CChCFCZE1dsLm7ebxYc4ysOWIniw3uX+rECSob2cVkB68SkunYq5ebVLITReiEwttDG9mHTNGjbFqvFAv/0h78Pn/RJ92Dn6hVMJtNUeBicafGwkNMg2k4G2+VQSPNsCBDkmNB3oc3XBG2XCM91ngT8H1xzo1+QYwo1QSEmBCUlZoFQKC2QBAMxXZrY9Wlv8DnpjFEeHB+O0IauLxJS+A/5ybXrLXlIYihQp0hccTQWC7HvOmiXfq6NcnYsBq3y9ErIlq4RTdudOAHsjh05a4WYSf8p7gLPAqgDUcxIUqufMipkQ7VcWS7IWPhMWg011BogNC2WnUKXK/zEj/1TvOplL8WVa9cw25gNnZpmDcdFqhwUC7aqMfge78NQ+TOpWKSHbsSFg2u4ujhAO/ALVNaE99K3x4rtrfohKSn6tcwZEQNv1kohjvUDVi3Hm54yxLl3ajrmWUyuLgrdWwT969BKeQtHse1R6VK8KqTnXfJnkrIABI62RmyNBDfKRhqvjRHa3YXll8qigZGLzeO5YWGLI7OYYDHjzS8DbUwlJzgVrXrH2Fd+iOzJzfhZVR0QhES+3MJXlw/PrW4TTJQfqsAEK1qg4sDkfuDgBi7N9xBCr+JWZ8WzHRh63YrCB5yIbMSSVr9YFQRBFGmBJgt8uL5jEdBOJlh1K9x566346Z/8cdx89ix29nbRTKfDZyoGU5o3q2heV2pnurQ2EEecw3ZU1HaVaFY7nv7VUBrFFIoqPIMlHJeSQkDKe56e0KJVbLcN0rE4Ba9CC+tS2Wp1pes4166Y4cfrOaKB+6jhOIQAxSQkTP+hrxv/fQR93dg1GNXkA1a2//9qwldM4TIy+mOEDrAfTa+ny12I4f6KGstsDxXX7chphMqjFsv5IfhN5rWzY8OAbNQFNTF0hTCDOTdCzCK5bn/TpBDX7F4ipCvnB+STcr4XktB3/AxMcTfkbozXU627RJsGnQgOrl3DD3zvd+NrX/eluHT5MjZns/7UHwJCYOW/tc9lPYAUYzYR56XSCn6cYVl8UNGab51RMdl+CQCdRty3cznpIkRrB7x8vzHjOXV9UzAU4d2pG6oFDbSU6qWDoBKJXPN9arDLSh0U5eKdiQ60ASvtmJrBRFAxoktRSRoCe4wU0w0fQ9lyjoXm8RzEUic59n7gzgjKaPVQq/iMstoAKLScKRb2szJazXTpdX29CBaJCYVoSNm6sCpUNbWGIR6xEG8dP3/dmbo48WuRPV4odzlMaPRIg3G5/cx/BcVHdh/NFSEsFlfhOyXHFNxaXldxxYSBQ0hJMDSYzrGI4YhQKCbTKXZ2d3Hvc5+Nf/cvXo8ZIhZHR2ibMbrTfx4siCxHAzmbWjPRqzIbM3m75ijJrXV1gRz22oiZOZARsNIaroVMuMT4TA3zC1J5oLSkOHX3YoGldUhlWOuseb9KSn5XMFbtoGYeZ69lWlhE1o+aBJQ5MPD/h8KifGayT9lAv8S5Plxgj72XS9au7xmIye4o0zxYgJqIoyoZ+0o6g0QP9F0bsUWD6PG9IjWbZx4v5Fm55c4r+L6P+ZkxmRdD+zgE7D9yAX/nr38Nvv0bvg7Xr1/DxnSGEJpe2Z+SGpnLQd02xpoLqUDISlcTCnOnV0XsqX7dTquoKvGDBDx8tINLi31MggxZETYw3CTtVZAoHuekBWdfzKHBO7TyPSlFyh7E1l35+bb3QyVyJrkY3APj+eblAm4ssPn6ZsChkj6pyJKzEwCpRBYzGpseslATwoybgka3cLtwinxi6SXD+aJkHGREX4Wqy9WGwRmOrUTrswx+nmZeR67004xYYCM+KdIy8nt3M9FUnUMs3lFYdJgfkBijsStJ0brM4jy2JabFB4JJEFw4uoEr8z47XSLMGMLfXUXIkeSTjdKpVMRVjfS5cUyltQPZu9QjQ9P/B7Cx0QcGff4rXoY3/PD3Y7lzHfPlEjIWAYNC3VwQLVukBhqqoARIKVqGYhCo6nQNPn2P1P3mNbAxWMizi3IhEyVRVj7JqcJpHiil0GY12pESiUOFTpx8mhoTAzXd25bXnrokfMocQ3r4BAnb+fLQEnPqTsploa5ZdNeFT7SRgFIxxUz7U2++ZtEU/yLiTvKjRiYPTZN6m7oFmsBHJM50FJWU30FIYYfTp6VMjetEfY/YCK5y5zKFCEnuYoij6PHqbBJE+Rnkjh0VTrmJFwc9QCTBlgKTCfYvXMBXvfZL8YPf/704PDhA004QmmYQ/YVE+AvInQYBpRFVFf1SYXGsifI1S6RalLvpp2ZCKK9djfT6oo/ceBRJI2cSRHlI4jZQIuAp79TQsosOgpyldSN3eJTjqukwF/iKcAR1oifaMVI0GwBFsHMnMMKlojL6WpKkgqOhxI83Kd1UDBrfqvaExM1CxaeOQkS17qjgN/iSoworuuH4SkPL1KJNmg7yRgwlKeKR4SpZiJVFMulswzefwG0sLqhIrCWPWya8QFpIiJhkQKECRUxWtBZjJojvXFXUCBW+f5CAhUZ8ePcSjRhQ5XPzol5spVLBRTpCHxz/u5bmVVP+imOGj983m82wc+MG/vpf+kp8/3d/Bw4uPwrtVoObLdoZpmq1Y5HGSkVaYY7OFDr9GF2a/z7lDUINAWxsLwqd4tQpdYSLKOUyGPB+FykCobTe1hKhk9zYqqPxB3ey1+gImOUtJnTNp4epi8lFHSnt/iXP4sW36Og5YaHXY/6NUgOklU6buo2XSWgpotedmtTZ43mj4Ja+q+qMEFdMd6CKa3DcEhpdjKcwE4mutuPlckVEjrfeclEJYvvnMcsSEiPQNNj9xIP4ws97Ff7l6/9x0h00w8l/HDsGd8N4EbBfA8waVwn48d+XCzMkdgznKBhBkqs1Rh7JA4fXcHGxi1aC1XUUDc9apLzzbLDQOGlg1HRnjUVbRhaHmC4rR/P6rra5/9e4eUDcmUTqc8+C6dGZWGDYghvsLkOhUigGxAIna1crP5cRsc8pNJqx4haqQQ8yeSyVvaKE47RkPi2V1sP/jeTTHetbHb3PI72t8PDShzP8HXnB5Rk8rFde0nwzpopsvAlzO5XGC6aI4KQ1f0qAsbzkIsXjYWlOZPzukuZvk2aCh452cOHwOiTIEAdbCejgdh379iku2ac18uYP+AJATFiEVFCVAimCQ7IQJ6KdTnD9+nV8xzd9I771W74RexcegnbdkB43dALMWIBuTI1I0VXpfUUTjmF6937kxLcATeRlyMiTYWHRchtKbTRzYufTdVo0hJCgdpPOxax9XvjEJVDHiZcUJdo3eqPp8NoDbT5dJG2B6Uq56FN2fAzZFkr3m42dHgpsGe2ntluktEWKcZV4tTIF3zhLpVK3g4NIrA86DIpzSa/XnmNcwM74o2KlBaxqPPhmtDHOTh2LlmPF2X6Y1jqlFErxy3gWzZUtczWaoxhzt0B5jGqiX2HgTBoHh8SoARBg74EH8JpXvwr/7l/9c0zbBqvVKkV1h7FL14wdO/98M/8kr1+hQlgdL1+g6ZhZB9JF0qpocyyS1J2eRyjaUjt8YPciWcaV7hG1Ikl3EhaK3uvHNQO0KAQ7O/fFCoAISTqtFBZFWg4pwEJ5Jq+xHKlFQt8Hp9cRIv5hEOWNxaImSio5FwyjgJ1tkl25kt1EiqxBkzGie2xNxNxJT+wT4uyk7vjwvgMlBZIAUCrw5GxUEedBFpSCCBO0oXTMIvGC1rT84n6OKezVRQGTXcgnsKgdE9RijF2n0N7kzlvP9i+FFayJKWIluyfEndZVXVBJ74f9s91HMNcu3Ui1Oa6sSfHz16KqhvWClhoOzRUdHMhRJNsNlWPTNtjb3cUPf+/fw9d9/d/E/oULUAWaoUhQPtnA5gPwpCsjWs3OXi68gmJ2bjeK3HUw5D/XyUJhweHo0Ap4TCtWizULDqTSHXKbqO8v2GhW27Wp6BrXuj2qSZ1Ciya5UoTR1kq/A1o4MWyDxufqSeJ8+A4KiuA8+1yrU2xzcqTAcLWNat+46JRV+breSeCdAIQK5kwP8/s4NnqkVNIIwWz+DKqCVjpsCufqG4cpOZ9emSLXQTRCQoPdhy/ii774C/Gf/s1PYGPWYrFaoW3bIvWtLNrzEzaiflWJk+G7AcetI+WHWdeaKLlRHJQ7hICPHlzB1cU+pgPFkguh2g9V38Hi8ZaIjUn2ynkD1PG2WzEYcTVLhNjRDGy3BumAaS2sYwcidXVUaJoknCBs1wtHrcwcFU2hcfmonyOLx4OKZVuIceCok/WIiBmFBa/e5AA3T54yEwe2FvG2JOJsSSxiiWR9QT4VMCyFFKHqIn9FbfCBt/wlLr/0FVpBn6QOhe1YubhNsZtldTmj318NNiLqoRFpjJXx8L5bCbiyOMBHdi/lakythe44wVF1P1rz3NZUveVnrCkbnNuE/GfjkxYkQAJwuLuLN/yjH8Df/Dt/GweXHkWMEU3TFBYv8bomgjSmhzqqW0BgBJXC9lSphKTxzeO9tIqyLwm249TEOShOJY/V/YdUxh3u/pFEvRQKoBET/csLObf8ObwFbkQGsGvHWsrEmbyMVsDut3Ad6ULcqCgT6VIxxz56RSVpUSgwptSF+Na8qLdDlWmOUhMUexGnCNxVduYvdX+iazS4xAxxB6Aepe1U6f590DwrdTU0g4V0IIRqCNh76CF8yWu/DP/uJ/85JgFYLpa96DbGYn0IEhDczedP7yLl5mq1RWti4L2WROphXbW/4uA62F3N8cEbD2MSGjeIEQMaUnXXeN14E1ZorKz/Yn0YFWVSSWdMQCpyVdVso9Y1Bus8A4lxhef9GSKlQ2JgpDWexwjsKh61Ysk9kApEtQh2bzmk9UKdu6jAoCjQvO7bv/77vN3MY2jtgMfaQGrQhkxVEhPiwB9sxu1S7GJqlZCFg9roSradAtZhcLK59BkVvywvSa0kQjr6A2jGQmZbhQkxMUGIlh64znufPmCyi42inRtH+7h96zQ2m56dHjj/milzfrkT37GRcq5fgHHEVZtw7UGeY0pRSaZObAqOilguF/jCP/+5WEiLN/+v34S0LdrpNKFgM2AExWx9DXvDnJGzWC4XaekhIUJWzenB71VqiFc6s6oX64q63HjulrCyvKJax5q0x8p83mTLjzZSL1I8JvkMIkWAvelqmQAiQiILAXa0jHKVbMgxcwCp+JSLD5c7GVKedlRc6LjZU4SzeMh2lT+X4kRqBteSnvOMQR3fu81gd4ERRjzoNR+iYqLEfRgUB7BAGXitECPXLQl5OgTJN01AlICDhx7GX/zLX4Wf+onXI8QO3WqFdjJNG1gIIXUNe+qjWKth7Vlg77mu/xovYVr7cwq2lpKlmgXdAe+8/iAuz/cxDQ2i00vZWHEChlHXL8cAi8U8pz1JixTGJNA11nE16TKeDDjusKJWwM3boM9EEHadqKZwtN6X7/APSW8stovmlCogoqoYYQVdDwM5tRqJnpRo9W2g4KvsAqjkWNu2vtrxrPh2vds8NUvUNdmfxKjvRazrAOSb9CWz2VvZo2tw++pSxmBFIkBFX8n4WFKt+lMi4xit38+eHcwMuSyIq+Cm4T0faYf3Xn9wmJXVQRwFmW5dp04tV6BGGBRfKFAhwTezUGodW30CFQxN2yKEgL2dHfzgd3873vCGH0WYH+Jwbx/NZJrbWC48JwlZolodifJMtKTlmdOVaOneUynHJzWbZ1J5czqXWKsMzwXYNjhoMPzP1jXnRvXRZGwTI11CWlhMc8219rXi0vXOCKn/rVRpKaetaV046kWkeaEW8lvbzVDdM6Zmwp+1E8b+KXY0OFrT1HA+PE9OjSeaizFh+5dzZ4qT/MBoN2xQlXmO3Geo7ohvcyTUMvzVdk0ZkCZ0og7TKZZQHFy6gm/85r+Nf/UT/xzdcoVVjGgnU8eiz3Zd+KKmIiY2xX4FnVSEg/kOr9S7AiyQ5Nb2OBJqQsCDR9fxicMrmIYGWsPfebVrAaWTwl6eu7m2q+y5B8XRjMKbcjIn2e7EdQYdWtcv6KKuFTkUvCl/Qz07UGynwwhExaDlJYnmqfAE7GhTxZy+1TUveX9NxYCOJECfH++EU/wiOJp2XIjHfPmUDqsClZgDEaBDkIKmVL4QSKOoY7AJzAYso9JU8iYxtvcNjoCS90b72RiRmV4/7KIlFCMXow4WQTU5TanyC77XK4yJTienfDymzO4YTWpg/ozEnoBV0YaABw9u4P69R/s0NkQCqLiTu2MOGAsYXNt7WByDOelLtSBIts8CuTwwDIZRwBhhHEbLkQS0bYtJO8GN69fwzV/3tfiFn/1pnD9xCjtXrmEy3QCkcdjT4frEPgEPjKcd/lmjmiyIRLbrXwmd6tSQwhTqClJWa5MPGjZ6ONk61c5+84OdFeBjVoKqlsZG9nGnE+FYb4thEHDscellhvn9GokV7nDbQoWsV1Sz9Ka3m4ppg4O6AqXO2es3iGPOLgtwW1sNkTCp+tVBY5QgLFpBKKhxZZL+hvtCAYZOwMJSMzNWR2d02pTE2K/iDwxNTrV/NkuIm1iH0qjkH+8TA1+KZmNQAdrZDAdHR1jsHeIf/eA/xOt/9AexODoAoJi2E7Lk2pS/8Z5OcB8u1FynyCQC1ix/puYUA9uxnaj6Ts2sgzHv5bBb4p3XH0Q3PseUu1J0KpQOkM5lBmdB79cHy+RP2vFhL4hRs7UyjTOtporv+yDBaFVUbYEOOnkr5SIoY5yHyxYpKyZF3ZNiXwKMeJg70RqtQJVncYYWaapdMWNwIzJ0MdojmjiM1YBq4a0xvnxxgSvss0yBCeMGzQ1V4xSwnTv+yqRWVDhNgOs+FGkF7AW2vmbOns4fpCT7imFBe4xjYXdxbglD3FNrV2L0sboBoJQxoaM7ASHg3Tcu4PriAC0aRF1TmZeOLdNNSf9xNLtaYIeH//iOqO8mcF6AEQ8OatzZdIrLV67hC179Svz3X/o5PONJT8T1iw+jmbaQpk2boEHGmsWyJlhUAu+Uc+/ycM0na7WgKFQ+BvGYTmVXYXYF8OfNnYeMAXSaBLZI0eakTtVMlBv1LhfYBDVGLsM4bxynS2ALERORzAFAYixs/Np40xYtWWpm4qBZOV9oxMSezCS10gVVXoyykDe7Flg8YlkKrGso5yqSjdY23tsJU4QtWEpW1DFMRZx42dyr6pgJLhjMW2PJaSVBMJ3OcOPadZze2sTP/ZufxHd+69dj58Z1hBAwmbQJ8jNu9LVRY7E8qJYIbB8Y5q1vtbHIqE8gvQN/yExZtfj1Pk/kXdcfxLX5AVoJg/dFHB2OWzPrBYbMBhhFmtnSLabrmjth1kA67hHqLLXibIBJiEcdN/O5weWOiBTWXBExhxN1GGyOk88djHyvcdaIdQyxMN0jtL3M0e2WBlKkgw2wYm5PABwKaoGJ0BTz0I3WiJRb7e0xVDlJqt7GdpEaJbEQYSeIpMACdeKLbI+wgiAtrphdlP0JCvxgihqMsKgLIRZng7R7iGn5iLNhQdSFwOROSxy+fi+u8LZrH8cSHRqUp7Kan98AP9xkzBxTVEuHLd8PIVDLaYDTGOvguLkM4BUCBo0gkhACNjc3ce3qdbzo+ffgTb/6C3jlyz8L1y8+gk4BadtB8xT7omfkBsTx72geJBTCRSXDhxpgDJyvmT8nG84CK7ZTsSdN3qnVJtWZz50WHSWwi7j5KPMsjGBPy1FMGmWzAn2thMBqcERrNipYOxvpdlQtJdPbC8avV3UtR4P6Igvd4DfOHFK/MUmVXsmBX6K242Jim0e7sMDYd1RZJ6BGwyICsvvCjQzs4qCjVcuQVqk4TZ2w/HuqEKaYQ5qgsf9cIqGTY8yagSZAphNcffQSnv/Mp+H//S8/g7/wJZ+PK1euYjKZoGkaCAICgoFyJY0QhfekZ3HIDCiKe9b8MBq8GEtxoabGyGUmo5VEz0zHjGhDg4/sXcKHdh/FLDSUzgcHeyq5FzCprvQcj3ZaFUdM1cKmmq2zUkTMe9RvzdGhHKnrRz0VFIuEQL9PUkfBE6lGN4ZEjqrXYiqCQedkRuCmo2gSE/r7jUQGjLI3qHpa60K68c2IN9ON7MFbXLBpeRT14hihB5svrgxBBFlg5BK3RhGIi5S07gMOLnG5z2ssdUYwxwwAHzxkkL98Ekfhqa8pZ/P31Vps/P25NaVDWuAjhzt4z/UHe2+nrmm3oQybsbYtqVkSbMt/PMlK7fpI9oKLjRHlxSSEMIBIrCVpc2sTe/uHuOv2W/FLP/vv8Z3f/A04unYJR3s30DTomQGxS5HDyQrm1NVe5i8u50GGglNsKAX5n2sK9qw1sNUxFRmeR6hw2EdxnQSpcyOqINPj7B2WzwBUQqL0eNW1sdoZH30JW6WEruJlShHoZEcW3D6VAh5Wf4G1hEVDCBbbVfQCfR4AcINr3FisNkKKcDGpFBxMT8NIanNKhsHUT1Y3J4oetQdJl6KmfT3mLPSuqAjtIkIb0GmHnQsX8CWf/yr82n/9OXzqvffg+vXr2NzYGOJ8A5omJNiPz+vwbf2yRS8FFR3e8i1SDS9SN//QdTpWz/+HopUGVxcH+JPrn0AjwYaWqVqN0RrngZh+OSOyXZFbMyQYyqKY0CszNxeP8aWu13iNU6HginIlF1ktEbZS8Of9j7IqlYPzYCmkznlWiO1NV0pMCm0BLhLbABjSANUyHbgVwix2agmLFy44+bA6q02KQBTqAYg48xCJ7UgVXBqw6MIJz+Y9BKdM8BOj7CdWtpvVeB+zIbiZm8heryJbe/z4VKyjwXMrGagSFZOmxftuPIwP713sw4JUK4QuKTsbyp0Gd20qCYaphURCOOiIAqbPW5zwhmKc09yMTllhQDDPZhMczedoouIf/f2/h5/5qX+Bc5ubuHHxUYTQDAl0+UQkvpAxRzGWb9ouk4nQYL/ueHfVcM3cwxaS5nrGOIHBnV3XpWXx3F5qoWjGc86CNlOoUIFa5lSImV8XYkMpaYTMdPARrkbYKOv8pVoI8KTCa6p+vzqxVu3erUeLwatFK3TsYs5gTkPIM31jL3YnNFQ6eMJiKdcd1TG+W9y4Bp4KGHPrn0eKXf/n7WSC/d09HFy5hu/8tm/BL/yHf43zp09iZ+8A0+ls0EqFNFrjE3btHtNKgZ83f3nsmPE1lEYtqBNSQYiI1WgoMO9WeOuV+3HUrdAiOOubGzVR5zbpRELBi3S5MsaqQQfNMi1CKeuCYUdSAYmDOonVO9QE75TPqMdOe7RV4sNwjokw8U9sh9vtrYwaUikTQESIiEuQJeGUWq6Jf/nhd6tzPxQfrvLiUW0fS8FIr55uTOQlZ03DoArFtFss0QhDbKS4YkVY4OcKFPJdGHVU0iAIQxS1Qm9h1HHdYpZHJBwNLCaTXFAGTIyVXtS+Ja4Doa1TRYiKP3fL03Hb1hmsYkyiO34ZVfwr5dpbdLIDzhSTH636btcHg6hRrqprIY7/3MUOi+UCZ0+fxTve+35807f9Pfz+7/4uNs6fxWQyga46qARIaIbNMAziSzE20fJ4SiIatVQxUGKjYSpUnRCZepk2iXEBiuW9MFbSRkimDrQhhCdNJ1StQ0qwPuba+uZQZJEXWF/1JyVSFsNmGbBNCwSqMRYjU9JrqR4nOy7HG2uJiEP5rTkzXk0RrfVCl6216qy4FEduFN1qdn9zeBEfhwy2wSqDQZ06iCJMPFfBHEaY2glAu0GABuxcvYbb73gCfvSHvh9/8Su+BLu7e1AoJu2k6Pr4XIGc6BeKU38h7BXOuC9R30YE7mbhnFqYx6tadRX14j4kcfBbrtyHj+xewmYzMWCukWopIWThqhmhu3xnIa4EhDYwtdRtdXuPKq0RbKNT4+RWsRBdQQnmsReQxO6kBTOOuKjVuHbTraiwyXIQnnOxeYuf+mA6MY6XcTwF2l/hAH7j14YaG3xsKxToC3GDIAsoRxHgrt7HbMIBUAsfMw+aSKXatrQqLehU1uvJggeFneuJCUyRApKgBROdWj/qmfxShiGmoKHS4lK+bwJMKPr5vwj+4Mp9uLrcRxuCxTQf95e4YkftplhNLRMbZVvLDa8tSNymrrbzhsV52k5w5cpVPOdpT8Gv/defxbd+x7egO9jH7o0dyKQZ7KrdsIlHaw1XO+c314FtNtTJySMENf5udd0UHWZ8XEmrULCN6ZKPJDrbmUhuENO1sOOSQqZZoMu09P1Ti54TycSd1BRqI5C5RHB7klZJ63nhEbHzb5juyjERuf7nkrUyha+4/9QGJDxmM6guCm2xkceaEbSpkCOa2DjiSoLGfF8Y8R7jtJEV5yJqiJ5lKzk7V3g8me8fTaO+0ATM5wvsPPIoXv25n4vf+h+/iq/68i/ClcuXAY1omyaxjgvbngT7Z7VTKZxtURy4zcV+q/P41zQDVd1Q5TAwXpcmBLxn52Hct38Jm01rPOdrOw0mVMiFtmklo6E2bxVYFDXshljwaiSH7Hjhu2dWqNsXatZkI2ZOtsgMJxOxcKw14MNqXoeI1ZxA1IgZuctejM7G4DOtxJgrEJSd71o5kSiBdzTP2ovEs2JCYoM5eRamPNtxjgFTYabEJbs4C70p75iP5gJTfKeK3WxFMBwzDRxBTVgMCjV6qmRDBRs8WskM/S9DbJRbsJQyljrJQSAa0nttQoNFF/EHFz+M/dUcDULP2T++d+cAQc4Lz0wDXV9IqEMn8+mAY0ZVOT3Qx9naYKfZbIr9g31It8CP/sD34r/+ws/h2c94OnYfeRRd7NC2TV5Mgkt2U5oJ8uY+2D5TpTt+/8AWiOOCHCNEkSyMWVBIvZrhuCRm7JCVxJlqqQYGklMec1cnCZrJHSDwsJ6ylR68tYyeCbOB80ZTLQjpRA+1aXVi3fkG+EIwG0Mu9MJFpmnr4GkSam+SZkMq+gSLFlPbyi1OeEKJjO6eHkVw6ZG1HHlzRuV4ahcTLRRkhcHe3NuTo7P02YRNYeEf5V+A/OWhbSBNwO6Vy9icTPF//8j/jV/8z/8BT7ztZly+cgWT6dTAxKygz6J9rQYAg/WPoV/OAkh4ubVuokpH0GsyrLfcFhQKoNOIRgI+tnsZ77nxIDZDm6NxaWQqhV3SvY4QBotvSNAlNc+BlA4Tca18zQeUoNlWxxu40A1NVIvhJgoWUibcac3iQDC90+wTktDUY/d8SCnxtDx6ji3NHkWRTMJulUKYnLk7ml0zYom33MVPe8QvPfxuZaXz+MK5raFmBqqlEEKOx9V6rn71plM15/9ExuLcdy2JR3lGL6YtV083FNeidxzswher7uLb1Or1FEytaAIs0UhgTwnqhIzj9Q8QzOMCt0y38LJbn91TtKImNTLP0ryYbR3V61j9WOW6qGoValNWxtGOOIbYWGD0Tiu0U3RxhdVyhTNnzuDy9R388D9+PX7q3/47LFRx6qabekJ1jNYr7hvSru1ccnddQIc7AZh5oyfQMULUtTlNu9CJVo31X9ar949jOtv5IupdAdQoUxWmOzL+NachqwnD4bhRGBqoDNn0UuJ5OUK1aGWqURunTuxaoRfrL/iUTad1QYGMzRHM6y6lGq6CFAI0lHP+tcE+5cksdwKjS4ykpurg2T/Y20W3v4/PfdUr8IPf+114wfOfh2tXrwIAppPpUPyHBPSRZigcHMwmuDGWUd6rmFavwup01lP8bHdzbF9zZ487GX7NHkNqGgl44OAqfv/SfWiHr+ncwIphV3AZBvwQConjDAXVxRKzWFxFCx63GNa3dS9ocIcJSunzQLnSGr0O+60FMCjLerK9MjImX+yqzA6mnHEgdq0ibUDx3gvJBr07zUF5qTvyyxfe3e+dKdRG7OJnQ/Jyip6qoRZVKLnZEz+23lSKGGGFS+Nbq2oirXHC/PJ4gOMhKZSBF5FxHiT0HerKmkFjYLjUZmCTzCxm3WIrYh/jzdjh4XuUMqOH+bK3nYypeKMDQIfEpqPVHHdsnMZLb3kapmGC2HUICH1HxKu8x0W+YP2XIhafEeABIkURYJLWpKoPMKlZqQDIJ6g4WKIWiyWmkylOnj6N//k7v4vv/6EfwR/9yTswO3UKW5snsBqcAuDkrBjTohGTfsQ5aUZ7FD9cw8wxauy7LEJz3oKBWVfvEyLKqgpzDB9JTSz3QXRdzBMK/QprQ+yiIMNRplZ8sOBW7OmWAF95bi1pBuo1PbkA0LLt78J6uAVvugNURIHy0QVqlNIi7uBBwBJRddsH339ScSxYBGwq31MAjhrrb1R70grj8xwlFa3cQjedGeXnzPkBRCCTCRbzBQ5vXMcTnvBE/F/f9k34mq96LRAjdnZ2ksUP0nf6PKhnnJGPf6U/r3I73AjObeo18R+rOqyN1P3MYQ3Xim0wam9fbkODS4c7ePPlD0MBtAhYDcVjnVbpqYRMb5fy5MLFSjU8h8KgGOg0noBHK1+alauFkadCQjOCmg+ZqoUAUY1mxuq6/MGCUfXqxs4ecGjDovI+Z/Qa1IkrNn+FWZ/MmgVrUVcF5JcvvEvNlVQ6EUipvmQBkmpdkSoeFmJaP1poLxMy0as6+HeLKwAM6tdJosRiFYXwfzbnmgqAUWhGIQrK8b98ghc1l4szAQoIh7vgPtCc+QrcYvMCQ0GvrL114yReesvTsRladIMwkLnZ3AnIAs6SGfBYBQB0TWO5pI0MUc+WrmgATCPxUZFhP0NsZRcVXdfh/Pmz2N07wE/9x5/BP/tX/xoPPnQBW2fPop1MoMuOwjjq8aXmsXYe4LKmrISlu7K+NNbQ5+EXKRKZas1sJ4E8+ja72ywYJnc9dwBMA83pNcoCgAriSrcs/VuCfJmoXDfEE11/6WpzfyZeerEib/BGG0iRpVbnpF6e5Y8CdYCVW1CNqJgDoghlK8a/RdjvBDDTteZnoXUrtP3ce/fqNZzY2sJf/Iovx3d92zfhSXfdgRvXr/VI33YyFBO924Z9++nvIE4oKgNt9RjbnGFPHKPLqXD7PQPGS9s5OS+J/obN/6GD6/iDyx+GIKDVgC4oYtogbZqdj90tNA211yriPpM1jy13sSsQJNshzrx/M5Gmq2KzA6wYTx0p195//pBQEcCaEWvRBCvkDdCay8fbI8S3SAt4l9FFqUJ+6cK7cqd9bCmwQlLFINDNEpcqJi2Y6+oAE7WQFqug9WnaBP9RJaWjwrxgWOWoEJlJFOb7rAsgz+XN8CGpt4Wy2XOiE8QXLyQidKXY2J4RzfnQcaz8CDQB0jZgqKpZZQoo4qDuPlwtcct0G59169NxYjLDMvbAIN4U+IYUuA1CbQ63UCIjp+KJO/3ne6akQbKQEEkr0p/Ue9dULqY67VLxE2MPV5Eg6FYrTCctNre28cH77sc/+5c/hZ/5hV/C3v4etk+fRBtadKtVpm7RTWlbdpIdBGlWHbIjYMzShgXEoCjkuCgKGUKj4tLUclhUFv6xKFDsczmcYvwJ2nx2bBEaYR6iFpJDwCvzparms00nBXMacJswnc8t054AMFKfH6mpDJx9yrl+IFrkNHCyoxhHgaaiNhcX7vNh5mhKdIMJ+Mpx4SigUiM7xayVFCfdP3cEKXNxanz4ats+4GZ3Zw+IEa955efgO77p6/FZL/00zI8OcXB4iKbpMzNs2BaI7kcFgO9wOLzvOnsfi+74nlJ3cNJaEc1fp27jkjznUgU6UUxCgwcOruH3L38EosBUWoxDQA2ZOGlOpEOXLIjYCJ2kH3EhQT03PtnexJSDFLkLdeM6AtX5bZAS9oydl9MA/TU1SaR57MKaj1EjpImZ4xwNLDgXzobRMlhpDBIahz/kGktUVLF6hnyfW/unX0+Euwi/dOHdyjMztgapa09a7vkAWDChFkwXg1nQCviEGwFkGIeavT2j9nWtJ9VWe5IWWqE0wgKhCMtKFoQ822bVs7hUQIiJlczjEB6ZqKnEhSwtSgIybj9lTrinVQFxeKzGm2G+WuFcO8Vn3fYMnJ1so9OuP004u5AWxVrFysPXvbjOqGoZioXddxFGJr8LFtHKfDXdZ6F/pd2qw8ZshmYywR/9yTvxD//xj+FNv/GbiIg4dfoUVCTlT7CWhr3ENoWS5uDGY2yLOtNV4KpestiUyWTpoTPfT2x7r6XV9ZKY+qg2L55S9Ro7Glnq9pTtcVWfxaTGy6bULQCcDoWLcilzlG1Xy2t71C56NuC5sEGJ9zekw8fAUnf3j7i2sXqgoSYlgykYikV9fIdMJ1W14g7iX0TqLPaJfMDOzg3oMuJTXvjJ+NZv/kZ88ee/EtO2xY3dPbRNQBNCcWRNtL2AQSKWCaw27MfyEYpuXUVFbjZ/1ToqopYqSWtPrZgbv7oJAR/ZvYQ/vHIfGgFmMiFaJFn7XFpdfoTsJpiQ81T8jM9uFC0cX6IwnUqGrlmLq7U8Cm2SPi7aNl55U3b7BW3w6ngzwo8WxD3v5Ykc0D6QZyR1ur3B5MjwoYxH6sgHcaERADtDcueSDhIiowjQRVjyh+jbnEzjV7swiEP/+shNrfgWU3PQs5TXCQSFg0xCziGQ6gAit95p9s6LgDh6U57NZC9l6kA4FJGkWSXxoH2b0HlchdPcyG/MaYPjfFsHUV0kZOaYFrjsFtgMDT7j5qfjzu1z/aa4Jr7T+3sLdoKho6nNuhZZg3QgPYPTGVgbWCw0a4Vi1u2Mq9UKcdlhe3sLnSr++//8TfzYv/xJ/P5b/gCYTrF96iQa9DHEGsu2Yn5ISJcBKYQxhcCx8l61snDmjSd4HhQ9Q8dpCXQNuQcmLEmcn53HVuqO4an4jFoXBhZecCdylTXVCuriXztmOM6WAmrv27m8ERPCdmN4/MaVhtUlWDKHSs2qOBxURIuixs94bWqSFyaPeoZ+oW6a/iR/eHCA1f4+7rnnHvyNr/ur+Nqv/HKcPLGFGzd2oAJM22lOKRQr2GP+iJ/tiwvvEthuiKoWhcFaIJTrwo56o7Dm/tfKqI2dXgrg3TcewjuvfwITadFgwIC7zb4+eih1AazZkEonMxIiXtUKgosxQDqswYxtiwN27QeYUbmfm8PxLWDXSR5tm9GdGKFt/7mF4r6TZGMJhaPNJU6bsXnqMlvfp4HqHacD6EWAfESg6l/FzUr8BTchOXQKps0wWd7EepPTqVosWZBbzclDCXGVvlJbUag1q6aShDLsBxWBS+lBhjtNsFeU4yNTW5IfIh9GkdqS+fWqSxEcC6SoatTESUQ3tCGTY0CGtiSAZVyhBfCS80/G00/dDlVFh4iGlMji4pM5yyGJTAoAvHq1V93V4IsLs/HrMQAhFNZCJV92jL1QcLlcIsaIM6fPYO/wAP/tjb+OH/+pf4t3vus9QBtw8tQpSNsgLjtkzZEUBMNa/KhpDyunc0nmldN4oSgmWFk7FqYshpVaROhoqa0rreHPpGK08EY5o1ISOT3ohnvUWsTIZgFU6vyp69opCZHgcah2RsnOA04LNB2L2sYkprtsPejE7xCzSKvppHHLPo8srMTNjrDooEOOFjEnMHpmZCQAShLu7e3tIR7N8cxnPANf91e/Bq/70i/CbbfchBs717Farnp1fxMSJTMQoCoMs/9a4VkEdfnkPfG58XUdAIce6Rqrn9Wc0L3sNruxC9miwTKu8NarH8f79x7GhsyG0yvQkHYo2YKLUZlQOipyVDwXAarFc5SswaI2sdM958J59+vWATF5nJU1qNK58HoIFkbTXjBajCMEQVwHy8CI3F5mxPWsm+jXegnjxQjUpVUTBGSEqDw2M1AhMSJDgUJ++cJ7NI5sYlmzoFTo8qlJOYQOiGjVfiC16o/ab2Yh0jXErcIL6YqAAvgn6ythP1rgqsZ1Hso2GHGpSQKqqsfB3SuvlYVYMHNaFh6Nrbgu5hNfJBBOGL45xg7PPn0n7j17F1pp0MUuWQjlMZChfFmiH5G4KvyxUaJK1jUtbGzctrZOA9sujrGPW0UcKIKLBdqmwelTp3Bj7wD/9Y2/hv/4n/8L3von70AU4OSp05AQELts+LVLZKk9Ybqg+va1SN1KKiXlQtZw1UGEu+Na//5UgUp3SmuxQKlLVy8AvFCObUBGw8HPlduAkwbFCWSFrU6iRcaGgkOc+CRS6w8IZN3JjP37gOkkiirW+ipUqxbYGu1SmGMivrgZ/v/A/IhdxP7uLnTV4QXPfy6++iu/Aq977Zfg1vPnsbNzA0eLBSbtBKHpn71AYVns64dT+Nc1b+z9r1mn1xQADvIlNTs2fJ6FO8Bh1D/03ccwWBL3Fkf4wyv34ROHVzEL07SlhRSjO46DiQvCegMGLUGq1xxu/S7WDkGZIOV/jlYwxiJr7bh8GDA0wsoeYruXgdYTNboeYb43de5ESj+2kCdDnVze63O8AEVNGuOaQ5t43VveTeVXLrxbo88Bp1a0j5Dl1VIoIU80oyfNLMq0TyonB269r/GAsgCCN3nzmkQtBZLbZklXkO0+CSs59g2jU/WPJ8AEpUFBIuTFwwtvQBAIi3hUkxWf38e4qEZKcRpASDFrAHKU8Zhf3T+ci26F2zdO40Xn78aZ6Ra64cQSUJsTo6o6N3Qz195HBQa07gRP9VQx89fidxM7Hb2oZuwAZI6AIq5WWC47TKZTnD5zGjs7e3jTb78Z/+Y//Qx+7w//GIvVClsntjGdTPsCoutKoahf/mrzeeZfeCLoOFsMmjPsjZBQrBPBkyq5SK0l5InlgxghoZ/djhuvyhpdRgX44k+TaW4oJe9AXfFKm6s4z7YfX7Dos/zstVx4CcGc58C0JpE1WVWNPdDGn9bu4/Xa/ZBAi5KeJT54NKEBJGA+n+No/wCTpsFLP/WF+Mtf9RX4gle/CjedPYO9vT0cHh6haQJCaAYFf87HGHn+I9u/QPgqC4ArfP2kjylFaX7zKyJpxzY/KpoT+KKHUcr9T+6gaAZL8gP71/C2qx/D7mrei/2GRytQRykkgVkOKVKf5D4StkWMZim5PsThKGlMEjWaxFOz05juM43KkssmO7hEs2jUxN07mFCGkaGw4KkbkRTdPLE0Q9bPcPcAXMySkDUEopCrtf2J0ZLlpF2QwFhrtmXVvhOl1Gn5lYffrdGJ1lIrlWeSxaYgxuYGkaKCTPPzNU0rrbKNK8QanpMbRrJQLGy5WFdP4jCqsTKHXOzpv7DK2CFwqbwl34Y6uxG3ZspnIr+XGNWc5JKFrob1HF5dkIBVXGEztHj+2SfgqaduAQZCV5YYrQGn+MKgJhhcUwDYr1Oz4bNCtz6zy2MHdjzoSGKjUcJYEADAquswm02xvbWNw6M5/vcf/DH+/c/+PH7jt38X165dw9bJk5jMptBUCFihme9oKQtn6PTlF68889c1xEUpr2sVwkRCUJH11p7qSF2QY8C1UgBINa+hZpPl5qSxkLHoysE9RG1nzI5ZStsfP99aZbgLaQ8fb5dJDc1SDTnUa3BquQUo9AYynlobAUIDiOJw9wDL/X3cetMteOXnfDb+6td8FV78yc/H1uYm5kdHOJzP+6S+AQTItPMc2xuGtr9YXRQXNcfY4CRIUszXunc1bPe6P7eiUwvRGguANG8fCJ+rGPGe6w/iA7sPD2tIg46AX541EOg5GoXJzBMoikVvoTPtDs3jY+UMDufRZ5th4ZmTQkdm8wfWsGdohBEr1he+esYNpHA8GlRMrHCZFtzN49EJ6eycADA1FgJS/ocSAdN0EsiKny23w1LyKw+/WyMhThVSnsTLnqoDz0Sz4In4xU8zUhhq24/OWJxFcTmvM81lHcVMhYkilY6/H2erVfTbKtzZw8w9Y5W5pi01jj/UCrhQpUllpX0Wc2XleH5AOJOc6Hoxpvcco2Y1e9RUgXcaEbuIJ588j086+wScnGz0YjnAqEYZ5ypm4KyFl5ir5cfzF2/kcCMUC+5Rh5aLpssRuyGadQhLYs2EDoK3yaTFbLYBAHjLH74NP//ffhW//r9+Ex/7+McR2gk2tzfRNG1fDKQiojIfxlDxox6+0jsJpeB1i4vZ8u1sEUF0RaQ5+WINmVHqfygcSFR4j7OjgyV38PxyN8ooZqiSxXP5LrciMP4sbCxwPsFZiqjTgDjtvylgKkRP9bKrUeEflTolqAgk1UT/GnL3+DubplfpA1isljg6OIJ2HZ75jGfgtV/0BfjyL34Nnn/PM/t/P59jvlwiSBgsfcM9G0nkG0IO7iLAj7p1xIO2/L8za44JU6sIesVmfeQ/46wMB5ACr/f5cDGCiR4+vIF3XX8AV+a72Gymvf1v+Lr+kNIDtvgQmN9zIMgNHaUEBdZa3Gk52VjT6ElMOmEeBWX0dJBgXFc82o18r6qJfUuH1JhElRQNbay15Dpwe4iajpi1E2c9GoXeSQ7tUhI4Gtsw2041B14pW2klA4wUwUDa2MUk9PnYfXQYAShnyqsT/Xu6oZklqIUVmNkcIQyFcL3mRpRsxKWLG4I7JSrsGyQ7g3KXQXKbPIjbYKUiWAMnTnEXgypUVSMuA20C6eKKknVSqPPh/NX04VjCnlDBq0Xkcj8C0CqOVjXmG4zsnPPVCtvNFPecvgNPP3UrJqHBKsXuSqrU4cBIhizlbvx10cfHn0LUjAJq32fUxi42FCM4iOZzeTbaLzKrrmcLbG9vAwDuf+BB/Mr/+yb87C/8Et753ndjdXiIZnOr//cyaCpI6D1+BCEVleVCnCTOSWzqPen9vRHEuSfUIUbhk8Ni4hOIa8FCi3KDFlMnNJQaTluLDdactMwhxBaEiiFPQdw09ThaJ29CnJandrE1IjVxC2E6LbJ9kzuOWnSQkhebx2vj2U35IKNGrT2e+LtVh4O9faDrcO78OXzGS16Mv/gVr8VnfcZLcNvNNwHoRX8ioU+vHF4nUy69oE/c5s+wdy944zazrLP3kXC33oUjvYiWs22fNjfqH3UQIsWB5S8i2Fke4d03LuDj+5cQAGyE6dAZiIiGuCjoo0tI0GzcXzb6XEzoktiuEV8H42VnWp8U6GhOuvRIcEP2U2/fEyP8Nu4SZUBV5RBn9od8mMiPYzD7TU6z1SIJ16eWmv91IKvUqaSxXO4k5RRLHl+CrZVDocA2R/mVh9+Ts7XUG5XqsZ+FqGo4fY5JacoiKBGTh25EEtZjYcY+RkPgQ9O4AOCgEsZ2Sg5NUA8m92FHbmM11bTaytWvfVqqyKx6xdMT6/7AjArmWMxUo8QEEEpJZRIyqMS8ht73HESw6jp0XcRNmyfw3NN34AnbZxEkoPOWQdcGrEUAF37iYwqAGkErJs1Ctpiuo5KpDxsZRiCW+SBu80CyHM5mU4TQYH//AL/1lt/HG3/tf+B33vwW3Pfx+wEIplubmM5mCAiIseu7C+lGHhauIDbAR8oQ4ePCFRijXYwIxJ6EOIUPxp2glQ5AwRg1uOzo5rxl+1yqwDX1eOHK5FyMOLGMVoXUBZJ8KJCqmKqEmdUihPzPsvcnjZ9iolERP6Off8owk++0w9HBHN3eHpqtTbzo3hfgC17zarzm816F593zzJ5J0a2wmM+B4bRvRXlKHYe6qGy8j9bF+dpNRaoWXjxGfIQaqqnLunCaAYXS3Js6cCJoJOBgtcAHdy/iA7sXsYhLbIYJAgJprEx0HAotqPB8RXJeCc37eXPzbXvbvSrb6PBYdtL42FHteqdRLQNBede3vd1CcKvMd0EN0ydWl6ZUtEg5jsg8f7iCF5VcAS1dQiplkR1INyAkVxxZKEKw31++8B4TbligPk1LyQZ1mE1Dq+Nx0zwUStwzd2twGemwF05Rb/V79r1f6GxFSG3EgpZlfUhWEOURyGIKilwnCI0+tK49kFLQZHQEBm6hZtF18t70GjTSZoloF6Ph25baQRS4a/M07jl9J27eOoUwiGqi9kEeNSmyuJNa3UFQFkd8/Xh2zycxCywq2dHqTorVjoFLLhs7DavVCl3XoQmCre0TEBF89IFP4Pfe8lb891//Dfz+W/8Yjz78CCCKydYmNjY2IQGIXUQXNc8vSdciDq1piIKlls+hiQMJHrO9yxC4Ky45rZDbDG+vmDJpqTrkRDNQx0ot/12lTuLmppvyCd6RgApHjogdUygcgkqN714NYcB4l5BcUDxOXNdJGrHTY7If8jx+tVrg4OAIOFogtA2e9JQn4wtf/Xl49ee+Ai96wb04d/okVssljuZzxKho2gZN2w5umvUhWlVtvYjJYngsC62dfcuxSZ3r3AvGCSIoAFKcfDC6iIIEzLsVPrZ3Ge+9cQHXlgeYhQlmoc0FQxA7JpSadoQIrTwaG0ONeAmTvNlyR9YhZIoEHx7cqiOAVp1oTqMijsTHuhE1I1D3JNaKcx7/DgeacT0P4rHBai2AkDXcmEqUulBNi7KYSXuJA//wyMPwP9JnH9BBexCQqG0asve+VG/TSbnqQ3VKPZNNruSx9iQIohhZYqOF5JAYBOI7FWLaRcVDRKpLlZL2JzQKcAKBzMOucJ+V5iDHtY1kTTKiwiWr5fNcOew162fMdkHNNkHrLx1PIYpF7DDVgNu3zuApJ2/BHZunMBnmfXGcs1PlXmOE+/b/em+xD76o2QUr38fAqMrGXy2uiPwVaeHvug6L5QqAYmtzAxsbm+ii4oGHHsGv/8/fwJt+53fxp3/yp3jwwkNAVEy2tzHd3OjV3EASIoq7HnpMpqI4u6sOAk1bHQfYmkuqdESsgxSZuTAL+9TxBOASIqXEwdY+HxfmIQ4vTp/QY0UbrvkyslupFgueFtYFizLh+bYQoz2p+weeg8YOy+USR3v7wPwImydO4ilPehJe+umfhle94rPx6Z/2qbj95vOpxb9YLtA0LSZN0yNok/4juJN5Vtj7Ithcf6mf9osNW+RYG/H6039VolxAgyLZjiHoOSEC7HcL3L9/FR/aeQSXF3sICJhJO8Tx5jhlbueb9jJrg8bxJUbmAepdDXXHR6KxauHYszC4qmOpItyrsUYKiu0x+R9+PzbbGaHTTRCUitE01BgDQtoyJV3AuNeOQB8T5kV2P11j0S4ZDjxOwjASD0MiaP8ZNSKYawf5xYfeqY1rUdpwHj8zpxl8pWIpuaAlPcycnNLw1bLkUc1bsVx/L0oyHQy11D4QfVBrQIYUDOHUmUO6nwOGF/ee+ohkkgR6O535EIcHFGQBUZZpmvAlVoH2LyxSpoA63C63l4UUq4suIqjgltk2nnryPJ6wfR4bzSRzBlybF1oGE4HEQzLwzeGwlUWxMnaAoljVthD8RcpTki8AzMalVonPBcDYfeiiQmOHqIq2abGxMUPbtgCAD3z4PvzBH78Nv/M7/xu//7a34f4HH4AuV2g2ZpjONjCZTBGCQGO2Y3o1uogg+iYUFUHjw5cvG0XGsgjSOES0Yk+EnRccF55JX5NvaYd+HevWqNlyRAtHNOJIFPcBKoDi2pk4kwdrlEB11mJnuSLugF3IBy1LCP0G3fRft1x1WCzmmB/Ngag4tb2N5z7rGXjVy1+Oz3jpp+J599yDm8+fBQDM54eYL1bQ2AvAeqV+j/YdhXzpegwoX1ELNUrq9wAz2qpu8gRWKkLNzOmtzq6Q6ijWnfIrmHUdXUDDv9tdzvHR/Sv46N5FXF3sI4SAmUzsoUGyNS6MNj8JBvxWZFW4Lsa4VQTvICoGVFpN1K11lqojEHfPiJZhzixmdnD+ZAqlMqR4Zf4zYWARx/fy+E9qIzcloS2yGNA87+b5Fqfv0ELwLuC2e3SEXjETzDh2JoLgqFtC/stD79BpaLLyXurgcq14a/kDVfIIK2yMmC8A+t8VbWALCrxgCXYYExBcGh9rDRIPeZi/GDGUWAuHqb619gDpMUikcoYP12YSCjbhskyK2Xouz7tOCW1ro5JZ7JjfR39yj9G2di04Q5KZpRcA9orkZbcCEHGymeGurbO488R5nJtuYaOdpnfdxc6qaIdCSUgoY0Un9UjPHGoUUxEYhs9HgxTpbraKpxRBV93bAIzBL2wiiLWYtfbz3f5rTmxvjjB2XLx8FW99+5/gTb/12/jjP3knPnbf/bh6rc9tn2xtYWO2idA2qcUco5ImQwzgQmnEJL7Fzmp+ON9QQbbSNSCXsh1ceMLdV3nbmT1J1RLvxbX1bFdIa+CddSfWhD/1+x91rCg5km2BQqmKyRoXmj5EKiqW8zmOjg6BLuLkiW3ccftteM49z8bnfPbL8JkveTGefPdd2N7YGFT8CywWC4C8+uvGV2OsdJByExdHk1yXulcT7JnrFtUApLzIzwtBHWQj3XJK2GjVXurV0M+dxxUuHe3i47uX8dDRdRx2SzQhoA0BUclyPKwvgdRBIk7g52ycnl2gbukJlM6axiGqiRghrtnq8daCdamm+R7WSsJrLWhDdc0+o2RlhiMYKor0VD+6sWtTWRDbAiBTKNk144tHpdGHEKLfBvxkKF1ZSFiglgy77qh1OuwWkP/84Nt1s5lUW4dFZVojbkkwYdzFi/AtKY76JOai2WwJTqJJzUu0Mbb6JGsDFR0+N7p6SpI6PazgwdOVEHFCQtgMeJSzTOFp/iDeS/HGjv0/btRKvs5Rt5m8n7QAsWoeUHRaI6fZ7G9/b0aNWMYOS12hRcC5yRZu3zqDO7fO4vzGCcyaSXoAxu5ApibCLoTUZsSa7q8OhL9x3wuhV3xzS3UEYdjucETsABltkeSHHW9DTneLo7reIKbH69kMxU0cOhNAEwTTyRSh6f/d/uEc7/vAB/CHb/tT/OEfvxVvf+e7cP8nHsTq6AhoGrTTKSazKdqmMXZYVUFEJLCIGCy0j0RNn1VASqFM90yqx6Vy/5JXuRCh1jZwjrS1n040vizKVXCLVzQQH00nCon0b4U9ikQKDI1hKRhnTLLSxf41agQ0IoTcftehaF2tOiyWS3SLBdApJic28YTb78Jzn/MsfMoLno8Xf/K9eN5z7sGtQ2sfAFarJRaLZTq99qf9kJ6fwLNlDJYyd0gQShWUdI+GoqUfQl9ij/cAC8UiHZJkCLVKhU8QShtcT60zGhn+OEPODBi/57Bb4sp8H48c7uLhw2u4Nj+ASOz5/aGBDp9aREyuAC5Eequj1eoE026XATSUDzJq4tLtISZwweBO4mMbXdZMkmqBP4VI2T8LtZGrwVtXHE1Ud3P6oJJFvOh0aknH9WJqRnAXIWAVpL7XQrCSIRaETbLdimfSUxhYOnYLugDMl3PIT3/ibbrVTMh24xK4inCfSiwwWcfEBSgwhCD7yh2i1WSO1kQcJabS54tZ7rU/art8tXSzKrWLxNkm1MxY1ccN03wysf3p4egfbMm833HzDGLcCypKo1ASVEU1AkTPjlbN8Zjp3o5jeqBmKIWPnnVzXLZfRe03xagRbQg41Wzi3GwLN89O4ubNk9iezDCRBs2wyIHaWGM+eImmpUATlWK0s9LVgBGViqtMrAhwHBuMo5L0eWkO56E/1wL+Ea3lUfNn0O87EV3X9V7opsVsNkEIDaIqHrl4Ce//0IfwR3/8J3jrO96BP3v/h/DIIxdxsL/Xb1iTCaazGSazDTRtk+/LYfxgOv40p1MnaMujroymLrLqGeJbSd8sJgODXZL54Oq7DYk2yZu0Y4lTOmLGWav7jGiUJjQaC6NtM9hTGXvQ+20eEiNWyyVWywVWyyW6+QKIQJhu4MSJbdx+x+147j3Pwic/77l44b334tnPejpuu/kWTCd98bZcLrBYLNP8vhmY/J5JUFXjB26rWvH5eD8akh+NOc1p343OxgK6QRiK7hWmzWSNODBa+hx9EDW8N6BYasQqRuyujnD5cA+X5ru4NN/D/nKOTiMmocU0NEOxEzMBkURxxUYqQ4HuciTGzTO47oaSKE1EKg5RKUmGTl3praGmc+eitC0l1kOACDHvDnpGGEjd5dwDyDbErLa38/V88haTbWCBVG50TbRXOHs66GvsKKFO300BW9RNSePepMegKPCYD2kBAQvpoMsl5Gc+/nadTXqlqxoEsr2JxdntbM+X06LcnMcseC7wx3jpohGFmJxzY8dYc7KE3YzWVWjgc7kXnDBIguJjzSBBHKedTjvGE74mccoPRrS6abI1pRJEQWpecWI5VafXoEAmVgFz24rjn8egkqhjFnr/SEwkYKuZ4lS7ie3pDCcnGzjVbmHaNP0MsWkwDe0gIMz/iegXpi4qOu1wuFrisFvgYDXHfrfApaMdnGxnePEtT8U0tFjFCBFkZ8Koa4jRCNmi6tq0PXOyKEYGkexcebwwTklGCE7X9YVQt1qhaQJmsxkmk+nQOQAuXr6CP/vAB/Bnf/Z+vO8DH8Z73vd+PPjQQ7h45RKWBweANJDZFJPpDO20zXHN3JnRSKpk1sZIeZBXywVIOGglcalUQmOkLFS1V4ZZSmMx2iufo6widh58uk9gorEHAerQSoeEvsMilnm8Wq0wP5pjNT8ClksgRoTpDOfOnMat58/j7ic/Cfc+/7l45jOejqc/+Sl42lPuxvmzZwZwS8RyscBi0ds5JQzJdIPdL4RAUBmX/CdYG3Nd2Dq0ZPUnAA2FNomUkdxjqlsTAnYXc/zRIx/B/uoIp2fbODXdxJnZJrabDUybBm1oMAlN8uRnwibQqWKhKyy7Dl3sO3d7qzmuL/exs5xjf7XA3vIIC10hDP+ZhIDGi+d45ObzLYp2vQXbjBcgEGrd5SVmRQttXnmmT5HqAEp7hd1HKuxDs0YK1kGutEAgFwh770jx+mwhzn0Ueh+w6bVrujR8NRQRsk7kKXb2IV5Eu0ahm2f9LOC3kdv5sJ5/ehDBUVxgO7aQn/v4nyhawUxaakNnBah6NrXLV4aWLQebzFSG+hQqS+odi9obpYC4cvSpSdpz7HonRitDUqRaLYr74BMkpSp4EsPx5g6EAT6sR7tVRT5aqHy1tDoW1DM1qZa+OBA3oIgkGkxwFSlxqWEMvJDYU8A009cCAhoESANMQ9t3B6T/0zz2iehi189qtcMyLrGMsUcUa0SQFlDFE7ZO4yW3PQ1bzQwrjWh85kLMjofSaVFYSooCoIz2os89osI/0F5XgVwI9a+5bx9PJhNMp236rdd2dnHp8mXc/8ADeM973o8PfPDD+Oj99+OjH38AFy8+isX+Yd8JaALQNmjaBu1kgjYENJMWITTpvUZlABYVYpHYCgMcKnUAglEZWuEanej7hVeH2ODMsNXSyF5aLsUunmJCUMbTR97wdBizxKjoug7LZQfErq+gJKBtGsxmGzh95iRuu/km3Hn77XjKE+7Gk5/6JDzjmU/FXXfcjnNnz+Lm8+cwbYexzSpisZhj2XWARjQyjNWkQQgN+rdM6vwg4Cy60rNq7cQ+KtkQ8+Bm/eqvj2bNB/Ui+45ag0cPd/H7j3wYV1cHaKUZOgL9SboNDRppEIJgEhq0Q4ctSi9A7aCI2mER+4I6DgLgDl1qqQYJaNNAQ6xnRXJuhFByZRFzW8Faq2cbSGWJNQI7OCCUmARLtgKSSZzGnhRZCybaqWvF86neZgqAaHpiuCNq8N9CnvpiD2Pht7sPamjtLEeqxnfZU3uabGthmqniwbUUI3I2jg8dQiEQzMJMSMBed4i75RTkjQ+8W2/IAlsD7QmsAuWoUCFBXuWimtO05BZazd9ZbDYe6uPSwKreSAHR4RjOIeU8lIoDDm5IlaYoeZVpfmOKEi16CCOjQCo7eO5kWAHYsaxXdWJwbtc7JjsUlrIndtRR5RCkUa+aMZxVt1syHohwx4jnfn4Y+7EBLA6V8aKjGIkd7CMhPCBjQxerBc5ON/Dptz4d52Ynhijk/sQaNBSdkhr7PsdBs6hnfRJiZTxI6E0tEawUEzwWQuPhugkBk8nUtGdXqw5Xrt/Ax+67Hx/92P148MIFfPT++/Ghj9yHRx+5iGtXr+HG/j4Ojw6BVTf8oAahnaCZTBCGQiEwVIZEYILYb+RqNRGjYl5C6BfOMPLqByCO9ptSmreT5VeHGXm/eYbkWBgGPOm6dt2qj2xerdAtV9BVhHZLYNllIUbToJm2OLV1AqdPncS58zfh9ttuxZOfcjfuvutO3HH77bjz9jvwxCfciVtvuxmbs2kRerNarbBaLXt4FSnyky1tdFnTidUL+UItVpeLy2Mwu7WYXRPilTZQcQCofNgIEvCRnUfx1ksfw1JXmDWTrMwfZ7PU3YwDareDYkUQLITxe3phInfb4EZ6Y1ErdOodv1IIdpXtbOLyztYLGs0hT2A7AVp2PVn0J6LGJcAzfe58qgmdoo19bQEgRmtlwTJCwkT+Guq01lD3PhYa6roHbjyeHj81YwS7PWgF7lPmQYjJ/tDCHWHs2aJVATWLANJ9OTwxh8s5PnnjVshbHv6Q3re6gRPNzEYf+9COCvRF1M7cc0Ai2V1YHUltdA/8NvnrztM/hh6IilWKVqNAK9qDgn/tkYolaKj4kQXoz7bR/BcdF7xD/BTr7VFrs+TZUK6MbZVgPdk2jnV881qxXKn7bBT1A7WIBTSlGRR9UTQtLPtXkCxAUaP2tjNggWClK7TS4FPOP7kPM/LvW/vFyztSjss7ZyCRwHL0a6LhmuWwSulxn3PsYooxbkLoc+MVaNoWTWNnxvPlCpevXcflS5dx+fJlXLp0GZ946GE8+NAFXL58FZcuX8Llq1exs7eLK9euYb5YousilkeHQKSWuwwS6xCGAJswFAnDKGewyDVtO8zAqcWkXRLg9emLHRHjegYCYnS/D0DTb0HbW5toJxOcOnEC587dhO3NDdx+6y249ZZbceLENp5w1x04e+YMzp45hXPnzuL82XM4f+4sTp88iRDKhzYOWQ2qPb9h1XV9K394j4HDcKSmE5KqQMwAeYbNr9bKP45w6fUoUqE+CXUMx9fS2+YUb7/8Cbzr+ifQom/vK7mfOZuei5cxijfyWM84S2zSnKrDOKsdEwpZKsPYxSAffxl+5TQQPmuekMJWH2ADbmp+eHaVSIa6VEPixPFkasdCNRosPhD5zRYlK1mZoSHZl++P4AKjC+PMG2cosE4Xj2d0pyxTY4x7ILUWTGooMQH8YdDoxDww0Tj2Aha6AhYrfMapJ6K9qdnUB5a7ogIEHSpRVZvdrM4Hryi54WKT7xjtC04WFLikY58VKAWa12gDvUgihYOIjWT1WF2ey3BQkQkysBdZKkAhdYpMmKpQxhGb2ZMzUU6NFU0Li5aUoUbuMqgw01upa+HgOqOoxXzNOvdtvyjEUaEccrEQ/MJgbko4362JoLHeEee+4VldTBkQDVaq+IOLH8X1+QFecNMTB3Rxl1ur7j3WTmplIt6o2Lbd8ryYrw86Mjx1QYXZ3b+ntm0g0pogJBXBqltiuYyD4ru/ACEE3HruNO64+TxEnuUKFcV82VvVFssFrl3bweHhAa7v7OLBhx7G3v4+buzu4uKjF7Gzu4+Do0Ncv3od+wf76LoO88USy9VyEPUplosl5vMj6CpvJmHEhQ6nrtnGBrZObEEkYNa22NrawvbWNjY2N3D+/FmcO3cO03aCW26+GWfOnsbmdIbbb70VW1ubOHVyGydObKNpGmxsbKANoXodu67DarXC4eF+HvmJJEFpE0L67Nq27Zn7rhjrBWmu08Oq6lHol/Ibsu7CZ0DrUGyMI4PjrHzrCJgJ9Srm9oYOLf/D1RJ/cOk+fHT/EmZhgqB9OieDq9gVMnbzejW3tXMxpl3oxMnFx7g+BM0nZOcEy7Yz4dO1VEa3DomeLM10RbXm06d13Gif1BQhWT+17hBH53V2F1TRWWo5CX4cOIp81a5XsIaa4fsp0t7jWFiVL+ra2W5s4XADlTNigvJwvoEBAYlzlY2sf7VR9uYQqFK8aH9QXcaIM2GGzTBRuXD1YvfHew+HeavYkAlWcLNFVDjehAT17XrVAolVVm21Nr0XP2gBB69We6jQmywZTEnFqu5bqOmkTuRoqGo0dzAENk3M+ApKIE/dOd+6InzhGyOIC+Th2WSM6WFNinbNflVQu3C00ZlxC5WGXYwlqIh9zpRWNboSOOFReEFgKiFM9HbfuYE4UacmLK0afYNC0PTUwtUST9w6ixfd8mScnm5h2a0gPlNPXGEiKNW1lRMIzzQ1xoGT7TCjBi4i64JpKyeVnNzoQGZpgddxBi/j1+XiVETQNAFNM0mt+MfzV6e9jW656hC7mMBLy+UCh0eL4YSf7zEZPxcJ2JjNMJ31AscmNGibBpNh5v5Yf8Uhcnm08UXDnRfjyOFDWZ5DiwtWslbc8nkvld7MRzO2Lrc72UTPSMWiG/3xmVPFxVw7rgkJbuKgR2hEcPFgB3946T5cWu1hI0xcihzR8dQGMwXkEJjeOTBkSQ7PfsbyZmW+UY+LXXQlqf77YQ6TKXXE/KIELjFu3GPe1WghxJH91DEMeA8RF0KdXwPbGoW4BubwIiAKn9coqDlMQRjC4y3TnOBKi6iJFdZKgWA5B2PRlTRiwXaGtZCoayqahIh13MEcp2e8DyUrMMVZSqUTUNuSTYCUCBoEXJvv48nTU3jB1u1Rru1c+7t/uvPIjzyke/FkuyFxyAbM11+OqYLdXMJkNisKaamsQafqGCiU1ZU09mLNGymeQYpjru6Ibc5zFiESGrf62b8+EJpMFKkHMPjMAIoizZnXlmpnrNGqDjxRhlb4ky1fT/XCPqHXvibEBTXUMEXhqWvPjQl1Ummp5VOWEtUQObK3KKYoOlOtRoKhRQboM2zg826F7WaCF5x/Ep526uZeMR67tICJ466zen7dib6eD2/dE1IM7qpwykFEx7HQxyUlYhBPSilAVy0ig0d9S0qCTJcvkvUHlDg3nqQlgXdGD7cYAmX58OoQIR2JoJha8iSgNdYuyUl3YcxOCDbQa12YVK3lXgOrSA2Og/UtV1UtPyhn0eMinLsFPllPUQKLqgFWQ8x5FxTtYBl93/WH8afXH8AydphKawhzQp3LVBibLPfcnlcXbaxKmydtWlIdgZHsV7yLv4wg7gV2WTRp2BEiLktAHeNAnK+e4XDsZNM66KsgrEodke3cVEKRwH4nTFodV4ykM7dDy6e+hdrERdD1Tp2IQhtkhaC5Vc2jbSvCpkR4+n1l7LogA944nIxtvfAoaUVFWJhoh7o7P9AXbt0Wnr5103e2Z8KJ95ydbOATR7uJeKsVAZWU3ZlS3cjtDH8SdFGk6nC6Ahcd6nPOqE2jFYaPiJtdqeUIG7eV17kUPssad3/cyGJdKCAWPrnOVztuoJFOfECxYlp7H82ZSn44KthgoVyAnBCXPgvhY3yNWtYk0RcY1Uv86tFHbzptpD+WAl8qzhPNvz7k6FbJPv9J2+AgrvB7Fz+MC/vX8Mk3PxGnJpu9AjydaUxgBOoKjjVFrFSK2HX/Hm6MQoNcgdTFYm5RDkHq7p5h/OY/C0UvLowuMtUPwbUgn/Unx7hS1NykbIsr+3OSbHRFFHGfM5m45YHeSZAa1RNOdd4HUAXDGZDC/40ax8CtasF8XxaRIZQhSoZe6LLc1zly6rFOaoJvdBAKNyGglYCriwO87crH8dDRNbRoMQ2TAQhE7XsX1mQcCy7V1ELUbLwzB/OIj3m2K9GaoBk1owR1gj5fBXFDWegEmkXQFepdPC7khiylUvO7yrqNxmS41DguZUu4chWSRptG3SI265Dig62QLEcK56REm3EhFTW/0GtRqYepcbyvQXhD66f7kLskahd5Gi3kr593S2xLi5umW4jAe9r58nD7XLOJDQR02mEqzaBI9Ww7MRY308lXhSYioJ2ReYwjxKop1eVEV1s8Wpn5qPd7O3ywW7qKfHt6mDmyslCOi9TxqIBpM5llQiz7IKvHxdgQfda5TcaymdB5xKMGeGGth7WoS7/YKXngcy52uSeFAkG6rglrfNC1687MA2qBprkgZXJz0mIckKbSCD64dwmPHu3ihTc9EU89eUuvRI8xxSJrxXYDouj5EynW8NNxbACLoMIrMu3gopvzuP6SY4KFRrGY9/rbkYf1sLs8iMpdIMXJLVoxF/KYKV+uxoyX/Nevf8/5tY62UosR1zopzbzXY5C9a4BhrAXKEapiUbO1kB7VUitGsSAsbp40LSIU77/xCN51/QHsDzG6hscxPk8ut4K7V9TdNSOAQfm6xhIu9gAkoBGh3UTsWuquAY9cxtN9eiatWsEieynlzo2Beayh5lgw4tozJC0lv1JHIW8BWrgvzHhU1GYsDD8r47f5nnChZiSuELhkQWPFcmFDKXynHBmbrrJRobNXPw4Tg5DrE7E29xqnRnxGiE8TNe42LcahKoplXOGWdhubYYL9o/3t9vr8oNuYNHo6THE9LjFpm2ylU1RPu2r1cqYlX+6EWj2tK4slaCZjTrySSw+z4Wi+WGAxFldqHF2aBHhWYJguKFWSnDyWKz2ustT5odVxwit5iWJxytxSTPM2tUs0W2ByZKXncCsJRlw17SOXXbhEoWb2ZEdQIsw6z4WU+CLV6tG6Fm1vw+D41KbOZqqKzXaCA13h9x75EB46uIpPPv8knJhsoItxTTKlPq5NV3zI0DEbtwEZeltZZYSgjxXpui5ieTxMR3tSWFcqWLFc2d7yISw1pr/wAu1sr2W2g6UFrrWLrXmfJr1Rc0ZF8uyz2PKYysyMtWR9LLNtk67lANVTZnyCneRm+iQ0uLLYwzuuPYALRzcwQZvs1ExqlGL2xlkDWHvgYMW8ugLU1wHmOODz49VtwKn7WJ4whaN9NVvapCh2OaWRN3Rvd6vptVxXQbLAbV1Xu9ogYEWBGANVyZuh3dSMeL1omUftlTXF6MvEZmmgOCBk1oGDsafuURrjjIcxEm2nA1HkayT1xohLCFWTOTMElvWWLZzf3Aaiqq60a1chzE7PNuX8fEOvLucSG/tQiSF/q1VF+wAHlxZoyxSXJFfLuTd+TB96YJov/WlaCW069pQpBlCFfd2miWU6C8J55KrFKckEVo7ZBam7IcYXIspCDS1aU/lkT6d3Hywytu/phhcjjiGBi6opiljYMr5nIZveGNmZHwLTPCrHKIWiZQ2lyjkevOx17IAEQZl7rjY7O+sEQsojx9AOD2GK+/Yu49LRPp5/9i485fQtCAg9118jhWv4zai2oVHH6ZgNzGdh1LQWtdnmY3UBrJtAikWumAu7TgMq06OCGhmkENc+VofCjkNkbdVnZ+Q1FGu9OBDBMQWJPXipb1dLfUxTs+z58Jy6NkOIJ6LFa0xWUJp9NxJwFDt8+PpDeO/eBaxUMQszYBBBlsLUUF6D6iVW23qWGtURpfrcHkVA0iQ6gMj6zgFi7jKMG9HYATAdOxjmBPvxdSS5qti0RF7ng1DHmPcUS7OTQkwuBuSmxSXL1yFq7liPmTJKs/hi3KI8dpYsqlarHbN7vRJGXpxF3vI4csOCOhXkHOGDbPodjkHCeSBKgs/gQ47EHpLzYUIhGrDUDjMVOdPMtJ1MZLVYzdq2aT6+WC4u3Lp58o6PLXdjpwhtivYowxls5g6d0JmZX8/OSy2pXtEYh1CiYBW1NeeAkjXNVX2FWyDSTMZZdMZTc+KC+6qRwlfEpMf5WSqfOEngZGqfrH5JQhPVnCFOcZlFLrtaWmGkRdDztBUlzjh3QwiEUZkhodIeNzY/KefnIhYR2/v6rRc/LQ9CNzdX4MLtWXGqa08mQ5FCttHOcKQr/NHlj+G+vSu458wduHP7TB8HGzsEHZuuNNQR5k+UAj3LAsjVvTg4Xk3IBneCrhUbFkJVzkML8MI694GWeRvHNjn+T5oiFVvd4/l6WxStHwn4sUQpoanbudZ1PGrODhErpFLa0KTCjFBFVVPBRUQc9DCTAVV93+6jeP/OI7i+OsQ0tNgMDVbaDbHeVn3NoDAuYoROkFrtcriDlFhbspKGo2gVU4dV0kHAi1TVAWJd4zgEwxyo4spT8iq7O4bFLrIOyh4cmLcPZta7dFRV1yFJkCt1ojBevAWFx0sq63RwYrK080sS3rFXX9V68S0xVew4uJpl4w6fXmvAwxIT5W3txulqBUmW3rSXUVKsB1dBgMVqiVsmG/HUZCMczRcXmtns4wIAj1y5/C9Onz7xDW9+6MOrK2HZbrWTvjVnVSlZYDSctlNbAuLUoTX4jZLPXFIsbHAdBsPfFzvT4w/Q2CcgrgNANg/h2QnNswJVlUIbboqphAlCSojTkelOCyVnQxd2OrCdzvKbc5FiYo1SvoCpFqlbktTAPCstXs9YEXNYEda2ecPQdZB0c2lK2aMxql20DH+AtCEqxrKjRgcQye6UHw4bVISCxheGMY2k2WM/P1t2HYJGPGHzLO45dydu3jwFAFjFrr+/JHufWWBaE56ph18pjncScIdGHAJW7Gd/3AZW6yLU+AYM1KpppI5FTBdkSLGF1rjYEjEzsRPYy40y6a/UITx+/YOumw3544dg7XilNmIorrVrscONTfxLjgOJMoxCTI14YP863nf9Ah6d30DbTDANEwC9t38kV+aNJFIkuM1TMLhxeO//ENciI20TgzGWjVR0YtZ+pmwtb9wxLFXl6kd2wjbkYDd0eq0mTGqUhQ4jnOTMoa5rpNfbR2QPBcNorXQaltwGd2p/gSl61H1w7AxBkldnx5LRNxShajB7mcETV0ZfoD0o5cZQ19FYQ/kgXuTRhH7tTJbASAFxFCpUoM/z+hw8tnm8Ht4BN5Amd+dHuHfrltXzb3pie+Xa9Z+47fxN39iqqly4clEkCm5uN3FldYSobRK8CFOotNIUFbXjgGPaonCn11xMkafVBASKmUHlSl8NvjTNniTbXsbCQbhqYl2C87mqDysw9F17Q9jNQe17GuIaU/qdH0ORPce2yMR2N3i2772sHDPrCYiqxoHgFxuYa+EUAMXJWIe2vSDGWNhUhFIM2QrKJ2UjHlSYz71ADrKVk5CqYwIanxLHcI02NNAo+MjeFXzi4BqeevIm3HP2LpyZbUEHfn9whbtZOIq8AJt4WWolKu1YqRkIypN/TSDoN6/aJsqiUN8tE8ix3yuVzbI4HbDuXEuEtB4TEPZ4iprj9A7i3C+Vrq6dRK0J8ylthmItoqp1uJM6pPeYkwEdqH2Khw9v4L3XHsKDB9cAEWy2UwSEPkhXnU12jAdnIIsvXkQJ4KtGGM1aImiOKi67lDAoZDN3pjXNWt5su1rpmTIbGPvgTRpd7ihwNyEDjHwnSAuv93i8KtL3XH6JzVJxKaaBNGLF/pRDe0xOCjh+W0h8ankPzCAo8kYqoW7ZWq5mf0sHgmEsmYV9iuAgwEqRw4XVUWyKq5DAk9d4ExEvzpgmwFI7bEiDm9qtAastoqrSiog+fPnSFCHgpsk2ZosdLAc3gDkxQovNStI8aDjNixhKnZJ532wwERXgh1Jme64QhdK6888WOpWKI7kpatofGSAdeUHNm00mK9EiqHUusEFhqu2EKEVG8uKbWzSkK+BTMjOqYTdwL9YqZr60kLH31oojxXwW9sGksYai8hCzxyhz8o0iXsXhKiWTGN3JcYRmqLeejUhhek/qMa8iNgSafNIbk749+2c3HsZH9y7h6SdvxTPP3I6zs+2eH8BiM2FxptrRznFK9sIlMmDXqIVZE9nVWuZF/eMf+GModFWrqmulw5+U5TFGAFLfmNVb9Y753Y85J1iLxtZikm0JnVqsQ77YtAWTrG2QrHslY5R1Iz0MKULx0MF1fHD3Iu7fvYQIxUaYomlCH3KEOIg0BytWVIvNDq5tbV5EoJPvUPAGFpGigOgUaWpOdC3iLMRjsR5q95ozipMfPgHOBJQzIkAinJJrRMRGvUek1rSxMKo65K04MNDYfZfUvdUa12B8LdEKNVUVEnPXlAmxNtxJUC6iWjOvGXYDj3LNTJ9QyKily9YTFey6qNaxMboZwtAJNj4Saj1rrwzMInViACvZAvt9N2C5jLij3cZW6HMomkamIqLtQP+6Ml8u4vZkJmfCBi50+5hOGoLg8AGO+0Naps0R2KGYvycCaBaoKVyULgskRr5AGH3jHCrBXnIPlrAnhqoq2+UoQ52StmZDFLcIGj+xGFGPOHvc+GBF0IetWsBGROyDU4iSxcaQRorVTMmF6ZdHUq0qiQ3XzIalOIxXLX/rN6fcOVC2d6nbQKWu2Retsd2QyFlK/1yReaORgI12hqV2ePeNC/jY3mU86cRNeMaZ23Buut0rYccUPXECQHE2Gy38KykYC84nbKmAamhqqLHlPeCCAViPsfmv4w3Yolce8+uO+yx9BKxW4oKLdMrjTv+VHvvaZ5L1AJq1KnrMWMCKa2HCu2pQIhZYjR2NNvRxxasY8Yn9K/jg7kU8dHADyxix0UwwTac4IvGxuyLkvHqlMZgYGJbpJxI8rCzsRSpNe7YwOp2XEYe6OHbWAPK5W6ijp5a6bmbfYj5zMaJiKQ59PpiHRYO5f+t1G0IGf+Wigvd/EZceSO4s8YW4PRlDUWDY2Wk0diXU6H7EwMzYL6NixbZm3RROwrUj3GIMrDDpiNwDLjJHxMaipzURmf1hqJjoxwQrdFDtcMfkJFoEWa2WUSRcSY/Qg3rjfHN18UcnJptPu3/vSnzH4tGwPZ3mlCrNgCAoL/K5QI8jccu5AixWcrjhKGtApOKj55ZMUtyXrg678Y9fawMolE/GiFk4gdI7iWKmHo2wLhUTzmrFtEDzYfPvULKQ6Aikt+1UvvlAqXMsyFLUA0p8voDRR5LVMT8QLrOB/lxp4dYinUFMmBC7NExhpdzeCixtr1YeBr/LM0S/8Kf2YzQpYf11iKYCW2mHVYzYDBM8aes8nnrqZtyyeRJN6Ltbq65LQtRQVaOXowGBQ0Um4pfaJEjnS1fVKpioJpQ7btNeJ6wrvkbKMcTj/Tk1T/16HYQUSXq107a6Vvy6WX6291llu8m9qOgCUoGgNXCKmI1fh7S9AEET+kJ6bznHg4fX8eGdi7h4uIMIwaRp0dL7C0GG1j9ssBDBtTSd3NQE2cCp6dPc2PHg82utW3Rr7H01TgwC7o5r7BCAIbQGZS0NE+uwJkyJSXRsebbjRHUZAnYdjn3S5PCsR+/uYEeU5oImMwOy5z+kk20u4tUctuy9KeKTZpkaOWqD1LICTF06vH+xGGYWm9cAcKZz664nUONd+EC3IckSWt3P0nM+LD1xvFapmAHaINjt5tjWgM86eXfcbDbCYrX4yKxpP+306dNXWgCQC3uHOpvOV4g4N93C9qIZKt/WCMvybEYLSLSQZU8KpbUQO57tDWIU1yM8KlC1GVUL1jRv/sZS5Daw8R/i+AAquStpIxEmSpGIJcC5BRjDKJr9+QSSUFeFmmsQXEHg231jpax+hu5U/ASzUFLsMozfJktZrE8uZNR8PurtgCFk4ZzLus4nVzd+M2ZNMTCPwqSt9dOiUt6EhWJwm294R1Gpug4pkhgKtNKgbfqAng/vXcbH9q7g5s0TeML2OTzx5E042UzT64jQYtZWBB+59MDSkyvHYk/NzE5Z+QzzUHuLWnVjrSGF1xYw9c3ZdB3MrPcxxHxFS7texPjOwWNyFnyXAahYL0tSXmmjtJt9KmSHYjhIQNMEdBpx4WgH9+9ewkMHV3FteYQgAZMwGQ4JfUohBGgkpPtEBH3bn9TwbK0zsC/ubPCCXRRb4yLjkzJtXJya8DWtQKzEWYvL4ZXQ4M3oX4Q7oOzwEQvsMnoKtSNDocOLUBKnOwgGsleKclaEn9xLAZTKgVv+4GKtePmknn+3Sh4XcMKf1TSosxYOT2dk5xh3qymW1yeLihtHVWF0cD8XFl7F4s5h3UtrA1Mc1Yomw3C/LGOHO2ZnsSGT/r4Vme/t7R0CQAsAs9kd7VIun+7nXA1un57ER1fXMWkaWphdi0cddUzqdinOx7Z2jdzyVrV/BuXZ0bh4BhNLzLdISP0RSg6TkFS1lXxBi/dSOw+uQ4zUWUTsqcYwDrhQEqn32Zlf7vC5Kpa/5W0dtRmsOsvK2GRQrZz6+GQ/LjpattSr80vV8sY0lavTPqXram1AqR1Ioj8jYKHPZGyTmhNItYKmkxhrK0QwbQKiCB452sWj81287/oF3LZ5Ck84cR43z05gezIDRHpFd9J/oyCkmTChSsW/TvGvLuo6KbSVaWTlPbW2ba5awZvWHQeGSeC+T9dY+lLQi/u81nyxfZ8oNSpyjJXPWytz0p8UITy21WvFTzUHxPh59S1+QQdgZ3GABw+v4/79K7gy38ey69AA2AwTQAVReusfXB4Ji3vE461pXMpaAC5MChuqkzhwx07IJw+frwIb++vHegqXsCu2i7V2tCAuVKkyBOQmtXkSRIosXwNCU/+eOA7Yj8fExB8X4XLCXBcQnM05lIoNVq0jTCpSHfVNeAurM8VteXltkctwOlEToZwzCqygUlwBOLI8Sr20t636za3/uiNdYYqAO6YnoRoRek/J6TtmsxYAWu2v5MEjV/EfV7H7nhAVt09O6APLXVnFiGlo+0QqcQhJJk5VVP3GpgbvTXQe/0pOAPvzlU7+zKHO9kKbv5xa3FyhKbXIjbtgZJSrG67FYTEmW834G2KO37RuMGJEG52o8N7ZK9grwR0ZLynOr5sLMD9fwtDONGrQIDYO2xVXIvlkz4VSSNqGYINHeJEXkOBzqDRDIOdG6rnYREVRssuNn5kWm1DmQriNR8VxHzT7ldVqUSJGeNAoUM3/bto0iBpxGJf40O5FfHj3Is5MNnHH1lncsXkat2yexkY7sXYw7SwHvVAJq+W4wmKv0/v2IUM110zhljmmTe42S/ivF+8CkGO4AGziVbMzOY257XZ5yM7jQgPDpCaKJ8apFyC6DUhtapxyoNRwIAgQNAJAekHflcUBHj7cxcOH1/DIfAeH3RINBC0CNppJ9mqLGj1KCA585NC9yvccOXjSeGDo/LGnPPLayW1hFdMOHsvfkMahmgt7WAG11Jj5XsMsaiJx+wAnPq0rFSHD8z4Q3qPqWrslB/MIbUJhLPCda0vGHBGxdD3WiIEcRqafEinBz0Wzi7HVKSXzaYFRDUqZN0NBIUO0boLusD17RBaPiX9suQ5i3SsKUx4p6ZZUPJZ+sGpLvi7eqjh+KNxFUfDXw6HA8702Xy3whOYkToeprrqIpuugwH/E+fMHqiqiqo2IdA9de/STQ4e3QUXaRvCu/UflIg6x0UyzWMafKPmGkcdmbDIEoXZqKmYh/sgu7vzPtCYXPMTZ4OphlyMhygF9FL49L6jKMnz17wVej8eUrXlB8YFEWliXxAGGkYoM1TJZWV1ZK9JbljiFz3SgxM4a80m89M4/fpy9Vsb9VkXOToyoZvqVVawK03WxDAWau0Yl8IvtIFiyZKQX1AftdBrRxQ4NBKfaTdy2eRJ3nDyHm2cnsR2m6QGPGjMrwSSemXbY8ZS9Ij57vbjv/yRTwF7X9dS7ddCfdT76dT4IqYxw9DGwx1hzL9WU0kUmh1vIR+cOb/wNbbyLuMKN1RwXD3dw4eAGrhztYj8uIEPkcTPO41z3igMXLRWwf/c5YVHg2TA+J0IqGQYQLUZIWpiN5DHNGp6bMm4gcFFA6vQ+mT4rNsXOHdiYxe/F0ZyYp05LBNcGN+PLggmitqtr6lR/CCz1Hx7ZDqP4d6NV1WontiKhJQdTBcRUBOKV3ApmR/KrrnaqCFkPIaeUOCFsgZwnLQCkeAYDevHf4fIIn3biCbi93dZl7CAIihA+5ZazZ9+hqk2bTl6ryZnJBGGxWGjQFndOT+DRo0Noq3215HpPHLFYZA8j2+qsMk0NWITwUZXAClLDj6zkRI6yeFkfGaiJpKaDPUdgib2eja7rmfWOAQ61KQDiVY+VDV+pijRWv2oWmwse8vF67jxkBYdW4OfnsHy53Z41nKaFMypN+04dMlH8oTeWRMLcsUChgM4u+vrHAAB27klEQVTttb7dnhabomXufbs2oChtbkHSvHYUefb8AruYjIXh+NkFFQRp0DYNIiJudEe4vnOID+49iu1mgptnp3Dz5kmcm2zhzGwL25MN8/mOEJiMyc73bg3upvLYoUOPR/HvrXnj/RxNd8mPRrDeq/0YRYU9zpS2yXoLXv1TZgValULC94T4dJ9+ZxQ0YQxTGQWfEdcXh7i22scjh3u4PN/FjeURVjFCEBGkwUYzzRkaMS/gItQVJKZ9YNtuGmmFTEEN1KKHJbYxhtWFzVEnSNJGZkej65SU3kEijqitxVoMtuCpw2Aj5nm3H4GKt9/BIKWtKLFyqHDWP/htUgjnvjbN1vIJPZrXeIVs0ruxlIs7CLLeJevQPJZVCru0ma948SLtcaKMiufNWg1/AC7vQVzMNChxUEoBDwUglQRJiYLDuMRNzTbOt1vDcxDQTtrQdYszpLnqHZiPPvrolrbtT2xszL56fnjUSUD7jr1HcKVZYUta6NAGVSdy8ieOx+MTZr63VZwLqawr0aKKyhnRWvDqvulaXCQcDEJQ/LdadK1NhdE1DHM+qfqQGKxVgHs7Yxn0oKW/VFBkMtifq1URlbiTcdG9UFa41k/3vvPtQykAC7PIwkaxhEdmratWFzuthf0IKCxDjYvAB03BzSut24Q7Wz0zexSHrjSi0w4agWlocHKygZtmJ3DT5CTObGzh9Gwbm02bToXjRYg+0losJ0BkrUMYj907q4wB3MxwXdepmnGw5nnhRVJr2GKpiA39qagypNbqCUzNczoS0MaWchh4IPyMd6rYXR3h2vwAVxf7uHy0h+vLQxx0C8SoaCSgDS2CsKDKnkaN1a2W0UwnZSt/CEOAtZqRZGmBcmJRH0Nb65tInQ9xXFaRd/gHsSNSX3jyKFa8iHMUulWWuDzDZnyxmCS840pKtTF+xHyxh0UW7hUCR8nMEtvyzZtTPigUsbVWH6D+ZyvKIDWvdapU8ZUPKH29I/LxGFBp5Gxm/1jbUrJ7i1mH82sOCIiq2F0d4kXbd+CJk1NYdt1qe2urOZof/kxcrL7hlltuOQCgrYjo29/+9vZFL3rR3sVrV+7f3NiQg4MDbKLBXdOTuDy/Ap2ogbhkKA2x5s2JjSlilBqlHEVb0sCLeYkTyplZGSFzvUDJxDXy95lFLbe0xnl33vtsepOmmacWhLZxvGcwlcnxMI4biKglFqpkTmuVCNcsoGDfqlo5ulaIaG5ly+1G69Vlj69RrTIDQgetAG8mhkdOW2qVd89uCQ7XUIMWNvazIGZzVnIzGN2HZi6IqQVdh2IkNJp2tDqrFt87EjCRgKk2iEEQobi+muPa8hAfipfQhIDtdoozkw2c3tjG+Y0TONNuYKOZYqOZ9KIzWiBGnrwOnawg9lTFVxLmdYlNGVRmFVDHS2S9qA41vKo4QaDUC4jiRK5VmlGOVxXSC2n1BDiSHOFymMLQvel1Hf2vjlAcrBaYr1bYW81xdbGP64tD7C7n2F0dYd6t0A33cSMBE2n6e4fmslbwKgUGOGluAh1fEomUeCciRN/jdqzY+brHLWs96lyFAF7mdWVlvCEZEghNTNufEeowvy+/H7HaEiHGPacuVvn9UlXlq7HpOoLH6KySNbkZoiVVNmnLpDx0GYeHwsFbKsGnkh0MTD4Qm1iqoj5UvcijEwfk4TMq17xJ78O5BkV2TNUTZXQnpVmqTKgttTvWJ3aoC5xtNnDbbAvdqtdBzTY35Gg+v//WW2/de/vb3z550YtetByEkxoA6KPXrz8fiL8YJDwtrjrVEMOf7j2CnabDtGmT5UpFraVbyoP6WACIu+mKE6hLK1etzLs8bpZP1g4cxrNCEaeg59Q+V/lmtgen6Ln2tVjOs5Xzm26ZwXtWZ7FS+lXXzhCkkgXtNnl18SPqvaYVJLB6rjgPMx3VsKxyuSjKq4fUUh6JiaCkaLYLBBd0VtPBKYw8VogDUyKq26DUh774WbskexjlRxURqmbGaxL4+t/ZSUSn+ZrPpMGsmWCrneL8dBun201stVOcmG7g1HQTUwk2ma+ikdABcmzcHmpBLsX6+djuymqqql2MZM303UHp6vlEBk+a7gbJNlZJheGaGYgCSyj2uwX2lkfYX8yxuzjCteU+ri8OcLRaYqldT+CTYWwjo0+acj1GGprk/AdxolrfH/P3iM1gz4cWbo1LOibn4C01YsYRsDMWrdShS6NNKQBLomoOoWLa82o3HEVO0nNR6iiCiaiVz10LZ1EDI6vpYVQXIpY2NsMXQCV+vAzZElLkK32tGlstHfTIf68V52nhYqVRC/ME7GauBsJUfWoUFeiX1jK/KlAtcRovrT+djEA3e5BNCPTuDWPt5D1TQ8/9Xxzh3u2b8ZTZWSxXXZxMp6LQj3SdfsUtZ868q7/dJLZ8D9x69uw7L169fH22MZW95UGcSYM7pydxY34NGrQQV0hFtKPulOXbO0kLYIQf6nzk7mcaMZ6fzWvaetTHcKqlZBnmt8slyK9LqjnwcNnjFQWdJ0xCjpMGuLmaPgafNc+FqGhSJwiCPVF6q6ahZAkRJCqkUXXzz+iS8+zBWdZG3ZZjDoUJmgAlS6ZRTLSxwjZ7sdCrJ7CTgVIdB72pzND9sy1OtzBYw8Y9YGxLT/p/QFRgpYr56gjXVod46OAaGgloIJg0E2w3E2yFCTabKTbbKbaHomA7TDAJAW3oW9ZtaNCsweeyqHUkh6nLK9DHoT+Nx7Rnq2uaor7okVA2DJCXmqZn/J2L2CU40yKusLuc48biCPvdAoerOQ66OQ66FRbdEquo6LQbFPVAg4C2aTDppX7uhJijyFTUoLg5CQ6VYBzrf69dACkU72DHkLehFfqL3AlMHR1WsJfzBRReP6ZFgiA27C4Sgr8mMZw4rgQ5LMYIddjRgJLt2Oi1WBxtOm1e2Fd2qLCGLK4ssBJLcPSwNfUqET2mc6Vix6l+BEUBQkZPISysg7EiZh1X1bxVqemVii6bcQPqjgtqe5RPqdLCxmkcdPQlQQR7cY5TzRS3T0+h6zoIoLPZLBwdHFy/9ey5d44HfmDgAIiIqip+8Rd/sRHgZ+dH8+cBOl10nd7Sbsknjnawu1phY2Bk23jCXsillTkX+EbknOVYEz54gQxHxSoJZijJzvRphIpxhjvYBSwEcbAOR9tyClClND17npeiWhtVm9nKZ33s4wOoZQ6wSavj1MJcv0sRTKSsWjX3siQUcE75kqQC9mOI8dpFZbuqrPG5W2hGFhsN9r7cuXSWTNTbbCblwkQhpQIkOOuU1VVIIZoJjvqgENeiGwAfqRMTUy4l1IIaeUyUwG/pXosmlrkVQStN//9DXghXqri2PMIVPSBokaCJ/cY2CQ2mTYNZM8NWM8F00mKrmWErtJiE/t+3ocUkNJg0zVAkNAO3Hmil/T8WFv7/+1c3rAOr2KGLEUvtsNSIReyw6FboYsRR1+EgzjHvOhzGJQ6Xc8y7JVaxw6Lrv76TkRXZ2/YaBEjouQ0iDUACOtb7xvTMkM5EtAgASielwIcEydH05pkKdv6tRPszdlwUyOHAdkziuK8T5/o7FCoVJ5K6rPcwrG9iFfoiRXKoDOCitETGjKIdHTdsvxThLqp7PSbASxKdjwsb5lqoOfHWWgCOqEUjWaGLmzu/YvYIcwgcR6xK+gCBKxLKX580CyyedJkwHi7FLBAGQGXVfiww5uCzI7E+fIkIskKymBAVMbEvfhKALwKr0GG5XOHu7XPYkBZLXakIwvzoaA6NP/uLv/iLDYAoIvbopqpBROInLl582iTIhyQE6WKns9DKA0fX8d7lVWxNp5BB+VxrZxQtnLSZwaZNGG23FfYlkUnR03HdFKd6XRuB6nIvypO/uhQ4ddGxdjMGgUj4vao6RKbjduNx2CRNESG2KDJaCFRjAGlWx+rU+tiBK3Vx3lRUeetiP9pK5GSmDw7+e3Oy0rXzIvXp5OqdJeM+7cR1xc85rn2tdTGVEhmSCWJQqyXgpEU3+UHFCMKFYliTp6Cxf5aiRnQjOyEqxmUkUCejGbC1ASH9b5D+z6bSYiJh0EgIGhG0EtBIHyvbF2oBYYjA9h4Yuw3CjOZWiOjiCl3Mup9l7HCky6Hr0Z/ql4NFcqVxKNYUnYuPHbsmYXxdsL76stOaiwNdr2wsT0v+FC7lJxMkd0Kk0hEwokfq1qXTOydaFqNNm5pYBuOIu+Lr5XNjvgAfdsRlzJqWfSGyVHI5PJa9wHU+zFswg9q1GhExPRmYTl3O5EOm61VyT/wEYXzdcQhOEpHKmkF6MA8KQ413ARculTNblBw9pTtNHaRKiqhzKcBRVvgnNTQwFwAVca9UVxYO3RM0AK53h9juGnzW2SdhogFRVWV8sU37jFvPnPnIuNenDkCuAVTuu3jf7iyc/rVmMnlNXERdxii3z07hwdUudmOHLWnR0YWL5Ds0s3jlsHQfZuMRWGpSksxGxQWEF1JIOeRWwmCJC2pJFWJB98v0OBVb7Vrec4aEqKhlkMNafby11ZPqqvMiVMJ4HBLSvD9/rbxIxMzZYBCfynAd3/bWbCFSdWldZsXkZrzTSqCOixXDwifbnJZRpMZyNCSbMfcAHPs8IDutX9Yvs5JOQPZnC1EjbavVfi+Fexg5iqaORYyuA86/bywwYn68GxE00mIyQFd6eo3SaafPOFD0VjfVDjogabvB9qgRZoyVul0R9jQmhU27rih3q5+QBTYEvlGyPU5G9MuAzRUBJsPvDG5DyUtlbjtF5Tm40LIgJoY6QcJSV43mw2TzFBfFqwwwo89RWJGuWYCnoRC/24uVNlUxRWFhD+NprfrNWlwdQ9GysCJAc2D2G1PUnMLHp2bqiqb1cSQbCjEEjrGpmmKYoDko/swP4NecWGncqyrF78IxShR+NnldWD+fUjPlzPuLEhDOiii5slceN4hLeYV/q1qK+M0tw1dRMhyNuy3KdFt1SMeKTZRGRA0EnUQsuxWeunVzf/qPHSDQdjJB13W/Fo+OdlWtxaGlWZ6qavvU25568eLVS/9je3vrC+bzow6CMJUGT5yexjuPHsVqFph+SQx9NbOdJPhR3rRKA5+6YAUxIWs0ZNFS2AbUhDQc0FId5tfVpeklUrU/fhhc0ap9WeZxJyWw0+FUYj2o2HGzRYGUmhMH6fDEslrCXuYAcFsPBc0xg0HEULb4Bg4ssjLJeGoaeHBaBTiwUpHIBrtosZI2dwM1MR+EHmBxtirxeRHmz/L1D7B0TnDgiOlyiCuOgvE4G52EaS2rs27ae53Hjixw7QE0DjU8xHl6LoZC0Y5fFOwg0uMYjoPJiMEiOZzy+I4TyjuPshgog2PtvmO73olC+RCgYjgZWbQXbKIbHEYZwUSopnGQwY+jeiqrWXDDKC51YiyvL7K3R/aaKxUqXFxHU0AqmJUpfrPgsDVdc75WLS2VqjR6kxIKRsLsWBO+kY9P9XgAjohWtWzGPjda21T/v/beNfay6zzve961z/nf5kLOkHMjNaQs2bKtyrYcXxL0S5wvrdMbUhRWEMBAUxSxZTc1+iEwkKQAWSAJkLYfGtSXKkJjGzVghErhoIWdtB8iIwGKAHELu5HtyhdZIi2KEimRHM78L+fsvZ5+OHuv9bzvWmdIW5RE2ZmAsTic+Z9z9tl7rXe97/P8no7yPRxaoq4uuiXIIMqE03TVrqMwYKAtdR/GJDaPJmOgkgulYDfvGGmCzUJXiMaQ2Ejv7AIdV8Yt8mpUMe4R5ETt1S6W/N54gevDEe4eXsE4TUtxmC9furS6d+/1f3L79u3Pk1yZ2dhgrrULkAyfvPfaa6+sVqsBQN7mjDvry7hpRzidNqVVolUq94iQPMfGnKhqOeFT3R3OWFJ1AM0JWIpldhp5bBY7E/uHFYHasuBSNrVSCNC3fn00vZ/1lcrOZaqwbJpUmqLOeqgZ0fHBstruYlXRQ0SJlPCcyuhWz6xvdJGKvQzfW69bb6KAhoryqsDPzcpkTl7/ruAtkeosd3nP86aWi3XSHPHXR7tI3C7UpoXwQJvEoNbrXoNHzFnEyknWTMSL5v59eW+lsBKLl3kAfBsxLD70ch8sYj7I9zr/Xl7+m0nE7LxxZPpie7FYZvn+nE4s/LNc76KDmv93Xn6GHOuz6WssLoU5PAk7YWQmF5NjpfNF/33IsKjng3bdcIWxwV1v6OFA8zZCS1Zvxt53CXEp6WGEcXZo9C1xqzG/XBTqwVOhLhi1yuZZM8VwTy3qf9WHEPEeTN6SZ+G+g3/uIMFd9Z6jPkV1bZK12QdCseTNMzhGluea1su5lzULHjy1QIMgz2f5WVKoUN737u9Yx3lSP7OmcZYmyuIucoX8/HlM3osWGRJYZ6XTpCiikABobIxh+/xcqhl3JYaILx0ojn59Zvzccvi6mDLG7RbvO7qONYYZTY28Xq+G119//RXQPhlP/00BYGYTALtx7cY/I/DLhwcHi9QJBsM3HF5D2uzmfkuISaUvMSSV9UNrltOd9Srz6O0QAdCsaanFIwlrPXnNXLtkcy+Vq1F8oSiz30juo3/DTbnrzmkaPCN/xVm+dOPU30ooIj/Tza/pOErVKdnS3mtfF6C8GOTngWdS6pm2QBVeEuPqLbRQTcV5lNAjODAlUnIoXzUZ704hqQXKYOf/Lu3mFBXlVrMZXBsR5eeZY5HPrHNIngND61DbpJomuSQMznnaUBqXUhJdup/w1wusZClWht17MR+OZdzFy9b3vrvRDcuCXxflUqSkeZY/L/5pvquS1RMsZIOx7pa43+5kcsMaKWjt5fV2HPV6H0s+goQ3FRGdFmKM9sP52qXZ++/nCUuveue9SHNAT/LdoaIVYgjrmf81zdczJavpjvQClNSQJdUCnOoPTOXfajIbrWx4y1VJErJlixbGkntuADrdURkKqNCV0lktqZG5aQUnq+z6WigKGc/ikM7c/1LRLllvYu3ixlFeiORorqtFkik86tSluHYol+W1Z7xzDOAJ2WRV+V8+kzWvSYNstH6E4kY4Cm31AZnyAejUhVq0aJZFY4922jIrm7CJi6VCU+oIY/d3c234mPA2zPDGeI47wyU8sb6KcczLM8LDw0MY7JdvXLv2z2br36SffdW7ps8880xarQ//7tnZ2X8wpHR9miaOzHZ9fYI7q0t4YbqP1bASdXxn1ktzm6m1prY6ERGGM+FT0fr8cHM4/p6WLtoOjWikTwBjV9yZ6gzWmvtjbrMFC5aOOxjDUdjO8diSFbvWLAukfO0GIKYzB3AH0Yh3rAtE0Wsi3l4LGQik5xy4UYgCooCO29hzAlxKYWDDCjGwDd4J8CjVnUgioNqhEGSdxl7FHnURhlRO74A1wlFrxy4MymWLvai3Gphje4iA7Y1vVsWGb8aL62J+OqS4Vr+xBwcRP5uqnIP1zBoSYnst4qy3zo0tjHPg7z/zz4o5ZDZC5LXtHZv5Z6SrFKyf19oRxX41cuRx+PRAh7YWOI6L5o2ZSyoc6wpdLTBS0MCfBM7hWvjskFvda4hfn1FZYt7FaBbBUW312SV+qh2PqKjmyK0wk/m+udl9vC5ubCzIQ0YNaRzTWFyndWRKF5nu2Aodi6e9SccA1iYdsrGb7zqaZ9xgmIhvuvI4Eg3jjF0dhmE4Oz390tHq4O8+88wzCdg7/XYzADMzvvTSS7ewTr9qNjwxTaNhd47BKbf4l/c/i3ww4HBO2lKxlctIX8Ry9Ooj5W2r4pEBmUh6OMc+JjolRz6SzNs7XxMCPe2u4fE4i8ey2Xsxi8ffCh0wtJcR6Xp790fzsZkM+eBkG4Vrqgmp17pbWJgnWdUKNqCAXftF5mwCKrGAcA3aY4ntXKxIKK06Ui188n2bl9XryM2pmt01oEvFimrd/sTbwNnNUoR7VM0ZK2zIxaSijVHtxQDLA5ZF+aKFLmiwVG1MZn1MLhlRqmx4YA0srRt84r8ltHDUKui1PZSy3mhvEbKmTmgL4wYpPmxHkBS3i3QKdU1hWAfawlKeeRX4qQI/md/8UDdXpH1gsAVF3IaYlVa+hudQdOHBNtu9JqK0ZYjmpth4q2BYCqKO39mCR8YsWuvQdL0akTKjPsqcN94CUTIeFkydEPJgscz1kowYLOCgQ+PVtPkZeQ79oqc+YzGfwepTGdIXG/eUIXABgh0U9Fo1PenDJ87SzMGNFIZXgtdKgiHdSNkxVKTbtRxQX714gPeur+KDl25jnDLSkJYCgMx8Ma+33337yu3PL3v73hHAIgZ87rnnhlu3br1isL93cnKS5pUSIzKuDGu89/BRjJttA6eJNie9UXSG07LQrRtVamH1J/gQ1v+eviY79SRlg2xiRq059Hq/mkkUb7+dSicb9iEVfoglbS6Lt+6+dEHbE+tKn5iGHssbbYBFkxS33KBwAIsw23BsArJJGA+/z7bd77Ij5IFz4TbhmTWEViBLkWEi/rG0W8zbyOWojquWsN6lde3T+Fl8/7H5PXPAlFaMWKiGy0k0hTnfmyT/7bsr6K6XlYKvPQXS2bIYNQJu4snm/0Fm/jAL4Z10rXxLqn2wMC+mux+aTqu29a3fsSkjKPncNXJW3ltYoHQtYSd73ppIYg3eCWuE1SvqfP7SIVhw2zQvBu25LopQw5YxSK2GGaFFwY6GxkWkPkvrJoZKdlG7TgWSvpMqsZOTwrABaDaJaTJoTSjsBarFzjvVdbDPrUzfZys7yExl9I5LltGpb9Zokeq7IOrTp1nDadHRKWV4a9IFbp9aRdu3+TYeo21Fz2YwnE4bXMKAbzy+jpxZPxOZT46Okxn+3q3Lt1557rnnhrj5dwsA1QPktPpH9++/8cnDw+MBwAQYNlPGuw4v47od4CxvSxG62OIgyvMCmShih7bdyDj3k3m2U/QWjrqoU80662+jPHH3pM5h6rNhtU3IZRYDUZzXG0IXQLeQkAKFUZU6Xcy5NT17PWlLzv18ijWaGxt6W5r3BrGJmKUIn2QjKg4AVsGMS+qCE08VVjjrhlEdBtZ2GtwM2n/vC3HE0fds6a5QTkuiQCbDILsmr1XrngqjZLppcDkKVGhIwLsuJzxNWEyBraAbTJu0ZL5NrcCkEGRvwmYo79n8/NJ5qWXOvgPWJEdaJDredxUv6oTG6uhLrxta/LsXD6IK4BzsypZkPD+XM6vxvCbIXnPFlYo55bMWsZ3J78mGERcNmd2rYNOvMcL7sJBaF9I2YyrcYhPtBZNR8hnMCcTr97UwBChgqrLOWXQZWDuSirG7y3PJusSYiInLyZXmJH3uqhm9VstanYAWBfrzVUBYMkaaDMc404cbh1pT2UkF2hnga0FdBI3mwUylk9eI+WSEpJknWK4hO+J6PyYq1uki5AwHLnffwt3DTr/lz5PlflY9nI7Lmqjo2Vo72oSLaYv3nVzHlbRGznlZr6bDw6Ph/oM3PrlC+kdx7v+WAsgWu8Dnv/jys+uDw//6/PwcAIc8E89eG8/xf599HulgwAGS4EUVT+pTllyjRAUuoR3mUK3Kjo9YTraxWbGFA/Fvx8q+7SCEXGeDg8PAzRNVu9CZawdrIwTeEbn0YWDlqHvQtlAH5GGRotWZn1lsx7iGF0KMRCfjIRSlTksagUrmhZ3aDiuchqAToIaRqKWqhJaGPDyNX4VYBy0CkSkcCU+mLnnibFvMlGtOR5wLzUBrBBS+/W4BrmTaHg4WolhLiPWxcTkwhMS4zYL9WInQkaETL1rH0hUZAKKbDOMCaj47NdkypMxGA7UsmtQ8MwXGOTbknll9KLqbP2+pnLwsGN09utwKuJgxOa8bzxyte4ZuOg0Z4GCMLtMOXzaIJSMsB97myofBxM2CZ7vNDTB9DWXQqz1Txp5NummLEGvpruZb2G03l5JEunTIIITDPbN4B27rgJTKoYSOPbCPIFD1wX7ER4fwDVTTAD2jhjWxCsfdlVQLNyubwUx+tjm3bNE0DQa8Pl7gBo/wZ648AUxZD6nTyfExNpvN37px7bFno/XvLXUAAEwkbVof/uTF+flnV6tVMrNsc/b29dUJnl5fwcV2W5SXDIZ1mhclaUtEvZKicRcRDzu2uF67nc3FrOpx6zdNY8KNdQSEYgc0BlZYr7OsSm4FPlBme81IXmAkod0U06cQFuJSZXf6ouGjzyeM2n4si1FvmmD9mFkvzlK6l/nSWxcp0pMUGU4HkshXZuJu1rt4rC1AedrN2DkVKOlf0rB2Mgii+Wk6HlJ9gzkZRkUgQ5GqpegNJ0rTboD8PT2pEq3aUgE3YhO2OanQqexRLa0t98xDaBwqV2a4ZpU3oJa5CtTSk7k4LoqtTs6NNLfh0/znRkPw9MFbVQ3fciWaKOSF4yD2TH/fzic+1iLOkSbNgk6kPlOm64gbnovOhAxFUfUnU9ThEEz5vrFesQvTGquYX8W8WNKdveV11dJWbKjU3AzffSzvlR32gLEjroS8Vj2oUZ+FztBG15juYIlhnCrzcBOxnbtXwqhOT+6l68T6nHq7pHz3pATTaWfXi9PJqI1RiFO4PtKZJuFG0Lpn6miHenAt98futdcGnHHEagLef/IYhuzGDXm1XqXzs/PPbof1T87Wv70dgIeNAAjA7ly58kpKw08cHhxYibiEYeKEbzi6hqs4wDlHDCkQkGmSgCVCM9cZ0LaMoEHlg5u06+sDQpkZi61rSYajzl47XGZVUYYjLmFNMg7Vy+xa/XVHT+rbnVuGRq841wAHkxYU1dIosaE68iDM+0iXhzWHs48t14DF915JhzW6WK0r0X6EIJwz1SjMCXzqbzYkNEuDWviErFW/Ox9dlGYLoMZLZ7YLBNymVAU5ZSMjwZRKWy9HAE9pu2ZJGJPcdPEGl00gWVkw9GeYzAltseFZalRy5O79Dku7P1kzmvXjLXOjlNR6ALxVKnAHzFKxTjWtW4s2r92MPsGkuNkfilYWMCUZLQUEa/HtPOxBLBV9+c5/TTT2T0upEbIu33fOlbMRTbblf6UqyCtzWFpo9c4vmWyOJBbhVkB7u43B7cm5auisjkDigSF3cLsQt4qC0EzSFutIRMrqHIvpNnaWOQszROfY8v3QXB3qtCHCHFFbJ/eE47h70hXgcg2NgtxtR2KL6NhKJHgOufe+PW8uMt73dB3Pc/lOdL/IdX3UooqsxMpCiV0q7+RHdZbrtc0FKJSk60kpDGM1BBdQkJcHLbdR6isasgEPxg3ee/gorg/HO+JfEZ1OOFgdGIb0E3euXHlltv7xD10AaCGQN+ljp2env7deH9icVoqJxJoJ33p8HTZOGJHLNtABKDvVOMmQTV7XEgt0bO/TBhr9S5ineDkcS0XJUu0yKKtDVk3zoBiaKasqOLVMUIynVNpgnQsX2QLpTma9XpTOjp3D1fy1NTaHx8qYtuAYaKg/6vE3twFQImpJNLYgBIEUAs/fiS4b6xGavHN28kKKzUtsoVHxTGnlL5s5k8lLmCMY6hNlJhS6JVDGItUoWORk4XSnWfP2LAdMCtooisjN/yMzV/Oz/FpkBASvyQYMbek+5B8BzCxEvfLv+mc6PydJJ6BeC9V8mX//LkmthUZZuFbte/UndQsFkg+t0vohcOZNFElGQXfTMReoauue3VPayAkht0I0PC1VKxTb6ucweS9GXwfGNEivMJWDk7muhtpn2RMN08/2epqqZnQtXYKlUxZdwgiAId8tqKFBRdOiVsc9+Sh15IeOgr7F8CjLxCn9HTxOIEQx3DV+f+bXSxcfzk4XWfYRXR8YkixNDjxNNkHgDCw5CK+P57iRTvDew2sYp2kukHfl4MH6wE5PT38vn28+9rCN/y0VAGaWSa7u3Ln2acv4ufX6wLArQJAsYZMn3Bgu4anhMs62mzorZUilk9hCBu2OKbrJlJqHSmxSActCn3LiJR+tq7NmuopdcsMXYc+ytVKFPtR9vFbBUsCQvq1MJ6pjFeioahUKEDJp9QmAQzjhpR1bblo21axGgbL8noVuidUKHjLbJhaDR/3MjG1WUXuzpiN6UmJtJ9PoBHXOaaB2LV24dWHBQpvzQjsd9dTPlb0VS4smyTaHbAwO8mFte9HT1ViLArJ0eUxV5vJdUrCe1T0pxElG3RoFPCOzBmk9L5viAvqxGeq0ZM3vCoa5g7YQ5OgttMoJSLJp7T7TkmS3gGgYOl8spx4typfYXROnQSTT1Y0o1eIm+eKiiELN9mxiXYF4hyGxXGN6AWtD1WR4buufW7pFJSa3tMWtmfOrsj9nyojKHD2ujN4EPWuCSG8stCqSFVhViEJ1DBALttFW9CFWZtBZFSmbi8KsXMsd9V52VNMyzvWjkboeBStCeS1zByDobN4qRdJ1QBcLpxEuwn3uOmX6ZMSm3e9ilNtuWzlgScfUXKokq4aAct3m/UjR0CYdVsiIlKZ5IpopIvctBXAV1ohE4MF0gWEEvv3kBg52YT8FdGWwfHBwYGb4uTt37nx6nv3nP3IBAADPPvvsLlCI/OjZ6emnDg8OBs69Lku7jO93H13H1bzC/eliJplBbh42p/pOTbzf3qYLksTCulFa87Brd6Fyom1PlakJUjF/3rG3Y7XJVkBgPSUV2HWsmog6VHXFwPqOFiYtbmpBozd2k5UlHyWD7GuODGHEohM09q5tawG0DjFFRw5lcSClLSbADtUYsKYLmirvHRp2BuQaG3aEigapC0QpXLK3TsYMdCn2tFtXOi/JgmjIbyj+NkgydqpUPYuCDfiuSx2ZUQrR3f9NCI4YWMd6iAZS408/YofSwE4tbvSnSWGCJk0QvhUiqvvqWukr1WL+gXbhjAGHSk3B06JPT/lodAa+0xcMkQ6Ba61uQv+enK7Z9Z+zk7CFDiGuCR/0dpMQwR3td4h8CHUhdcSdqqcwh/H1WhHHtrFOZz9AySA6AG2XN+8PXvAZfJCejR9jgDys1WkGGoJp5Gfk7O53KvmU6PrYTT+HWNnN6FH26KVEeYT6st4kbQGxgp4qE0WigpUWOY+YtynjbNzgW48ex3UcYMyjPtv58PBwOD89/ZQd8aMk7dlnn81v2uHHW/i1xAd+4Uuv/I00DH97s9lmGBLzjgO+tgFfymf4f86+gGG9xspVZJB2jYmwq2YYR0XoorLXxcgK29pCVCxd5C7pwx9AuAgiBtaFxbQw8ykqVDudiIjKiUdUqyaf06nSxRqZihreOnSwGHWsn086B9bBCToMsYVIQd/Po3MjzAE29IAkF3O6VLxGyT2SUJZ57u3fsxdyFqW90eVxx2gtOhaC9dMVZRNs3CKBWteo5HUspaI/p3TmnrBca4iLUcmciaJepugQHLXQrGnrVpWzX1RNTjUGz8+PdwAkpU2hU/GeblJf6Uc+tbPUgf6YP2+aU6BbwwOpNE/z8KlA5HOFuXnLa5oT/lQI6+yZ1GRIf6oj1bJIN3LSTdCkAFyKw92Lp/LFRqBPEbDOXZiq/q6phB5KJa4GIdoZrBxsTH7PBxpRSHV9AJVJwp5/frylg3ooKh0B88LIQPAjZ3kLq1OAzjrTEj9LwZeWPY8CA4rPq6Y8ap80CErjyEHHhvRrhAtFIpFS8ocb0QuUhEYzF7ZWYVDmu7nFvhwU/EXgviv4M7OMIWN738p1SSn5tXIJypRk29fHMzwxXMZ3X7oNm/LcJQVSMpCWDw7WaRqnv3nz+vW/o5G/X1YHAACenQmB54f4ue3F9vkhpd0TYkBKCVtmXFsd4z3rq7jYXmCymkxV561K6zK5cPPDFvRjGtdo1i6cYO0GwGSRNW//oAWCUwiBqSOAAqGXTdLPaPKy0adUgUASZZqhGeN+4S8sBJqjyTVW5uUGMvNURJ+bOzPHWSvF5fcslW/Vec9F+b98LzMvp9zweRbalNbuvPjk+Q+bVSU3E91YYzlL55yB3Bot/MJuwti30lKuAtCqIK4BSnU8qnNhigizcLy543trNk9arIg2R6cWe9ggXm2U33cPqZ7cqW4P+kofVaVcilZ433zTrjVPq0ycpUNmGIYEG+T9zfP6pOI+JwyUGNi0uxdSmfHL+CJ5NX+acxdS2okxl7+/nPaTvP9kXpNROQXJdW40CTALNS2ZBac5/YlUTvBpzj1QwWXSe0eDqpzuTKKsLe02cRkHlc2fhGUZWxIufXAJ6dnNXtWerIK7Oc9BSxqa6BE4x2PUeybN3IS60PsRaAmxydmNopIlTxNkgCgVNHsV69GNETya2WomYalz3HsymWO70YiI9HYPfdWg62lX0gQ1OHwRRlJHZWX6kd3GVIrv7FNEWQpuDdbS8XHaAb6kW5TnkeHu/l6+syzaChZS4bJZa4ZKSSSl7GViZy/XnnNJN48Ny2au0Cp60FSehZpRGL5QKh9M57g8DXj/8eNIUyVMzgVeHgbDdrN5/vzw8OdIvqWD/VsuAP4bs/wrwHD35LEXk9lPXbl6JeWMrB7H7Tbj7uFV3EzHOJs2uxteIhs9mYk9BnHTUlSUp0VuthyXKdG2XrBBL/CBtf53gUaUDcWN28w5CkxwtJq9Rw30IRuvKNR2xla24luQPlmMnXa0njYg4SweXqKnBN/VaBiLzpffySNQZDPhgEfOww2P0o2Appp8hpZuF1wPNY9bG+syX563hNi8LcAiqiCLIvKE+31Dcq3deZn2ZWPHtF0WgABTAiIu2LyG1WkoQrqAQVgBXtPuBXbmZuzzTAKK22lEfzpK0ZTMpnnNEGyYwuimBRKbI9PSXXtHueSymcmAadHMwLsqwoDZnbyjI8drV+CJfGrHMws58h7Mo/dipldulzt+3ojV4kXnYFK8eJLXg/w9HdchODaqtkfHEDoPZwgTqroUGaeRfqQYLLp+fNcZ0Qhylp2OlzHggBVi5fDEIZelG6RWI6ctSHwV384wgq14cj+SURQ4yYaMSsb3ZV60bOiMVs3bqJsOIpp7q4rJAnNEx9hEg9Bf7sxEw5ZbbLcbfOvJ47iS1pgatwfz1UceScMKP3X35ORFAMNbOf2/5QIAAL4PyGbGcTP8wuuv3/vn6/WQct7BBzG3h20ivvXoOi6PA844YiiVIv0LZS/kaNSgclPuHpQ8i89EnFda0+Za40Wksi94gRX0UYQicS7tWmqBiGJSpZnBmOYqV9vkFoQqMVDbFw/FmlYww/DxlcxyQmZDJqslkgVBn/DwKZx88cHSieXqjCrTWwtqC1/n9ZKp0FQOFNGhtIclUL4I4GJynFvszVlllgIiUwRq859N0prU95nVgqgAIXl/VPWyFAZJEwoVlbtU/lYlqnG2v5yydydxE886/NEnzLjrKKYmChbyWRF1mhO5LtdFr70WOyoKdRQ+Q+v/pomKvjoj6nxSOAa7o6wfZczWSRX2JUuhwJLkSw3+0veLKlBr2t2ET7GD3MsqFivFhSSrYen4zN9fCdpZ/nyuyZOlo5JKymXjgHHjRLGCqk6gdKdMoEO2OMpKoRjbwEv7hQqj0THX/JkX65nTu4i1E7EYEMFmJpoNSil2upGarG150d00I7h6CFL7YFnjdO4UhkxJum3V+jvvL5bETuyF4FR8r4B4slqrQxS0h0DNoUZOT+JzKtSSR+k81ERBa10aaWnTJ6FiLmMRepxQ8nqPIe86rfc353jvwXU8cXAZ23F0qZIk8zCs02tfeu2fbx5sfmFW/ue3uq+/5VaBBgX9wct/8M0DDn4NhqNxmmr+HYmDNOC16Ry/evYShsM11pZKi9yLnOK/hcAFxnAZccWahAoFWtXy4CfzJ20zH+SC3hRVwS0y6CE7OQfw4VlNx1tjJfvKv0DgCzPEUvzEUy+DbdSakEIN2nHMQNK15r2jIIqr6OeQQBss06XRKSGsQ74LTPUoDqrWGk9bgxNCh+QmEc7QvO7DjyVZVPl+MeskqIEdIZl1uzPWY6ARnZltS1KzhyWCOQvZnrQL6ydW883CMgzuPbaxd10keQPW4r7cjCY3Ed3nWTc8kg9R+6dOGptvaXt8IUPdbt3vEO7QwU6Kos510YVPOYGejkaUCCdFVe0AoOEu5NgxkWAv25vkLM+ZVd2DDykSCJEq9RmTGM2tISYOJwTaq09MbNKD5GewzV+Iuo+gBGWLjwxx7z5YKcSCStegt4do+Btdeiqoa2HkwbS6A0jH2B1o94RveQE1SzEdO7Npfl+vjmd4HMf405efxJBnKmotAJnSYAaebzM++K4bNz7ZC/x5WzoAGhT05ONP/j7An+KuzTDHLO/mh2POuL46xrccXcPmYoPJsOsEoIJatA2V3UlfKnSNRLSokqxUJI0jVmJWBWcEfC88EU3Vs5rsBfNRlnTjRSvFhya1KcOkzg1D20797pS0sqWjYCaCmaiglhaZSzmrp8e5JyNEO+H1WyB7Se+gl2ym4UtkkAeL5TPiUp0H2MSrzOCHFTJkbwOuc0HK6Qy1va92ufk0yiI2Tc7vXgFQdCcSDyoKGQrO90xnXVrmy2apsuZ7G7DRfffFJ2AMsm719ntaoPV4AUGTAHi4Tt/zL//wIf9tHwegvKa6KvxzUmyJCM4SRbKU7gG9Mjy8PgSmQ/cM0mcgWIjaji1xJ3enV62rCLK0uhNUxFROrmZzN5Kuu6ZCNWPoWqCSQEnvlKguDBUVsmkYknGhFoumqu+d1dTq7N6d7i2I/Hzrn+7EKyJE7QhQMwosxFvTte0LCTV0WHvz/EpLZZMZU0c/5hIIKYhnhzK2YG+ESUQ4nYV6sYQ79xFqR8gEPBTkVE7lZWozXw5QJRVRR0lKmLXazaw2FwxmuJ83uMQVPnjpNlYTkc0UWLRc2Qzip558/PHf3xf487Z1AJYuwFIMvPjyS//08uUr/+7r9+6NBlvp7Gs9DPits5fx+9MbuHJ0Ak4osjg9mNEx8DWqlQXrCs1YZwN/bY4i7fnEt66ikhemGoNgvYFGzboI7CZyVStHl5MeefKdE0q9KNl3HSyw0dljnUt7Sk7uHfQ6pBsoljZzLO5MSnJV8AlKG87HvhJ+GEwfyxyvj1qLlockZHfbvHDqnM9k/PCQSrWeQiMWmJX8p8VhxYzqawS1vtV8dZ+PoKdXxngA7IPzOyLmQx5IEh6GJWMXho9s7nRvIXOhFWeysWS0h2mgdwJdZqKCQE0pQJranoDigastzRq9SVKPjHWyD8IcFPBjCAjVzSP6FZ/t48vdoS7I4GO7mGjb417BnWs7HQATgZxk/Nc/1evmVFXmuoFTmPAQV4s5Qb57n/qzwlGzxrX7FNYi0p6TOPTcrzZS5sUFlP03PY8lzGWSmCN9sXGRyOuj7X6pDc+IoDUIzhy5bjulc8/tp4VPbiO2rTq7zHaSyTZSQYtNBlxwcIw4Ky1dB6OOwYkVDWccsd1u8T1Xn8DNdIztlJGGQT/reOXyldWD+/f/jzs3bn6/7st/mP08/WELgPkF0jye+sjZxfmrqx2FgOo2GqeM9x0/htvpGPc357AkgBjQU5pMDClUrz6DR5pe4KLiPvFwk6Fdp4xw0nG362ZlTvUKtceEtpPLA3QZAL5dVOb1pT1NmcvpAiLe0FKo0D8QZUblq/E6w65CKQqQAzGe1dlalITmetZldygzZwuBBJ0URMj7MZ3HMSinXdtOkbn0kEJP/SyLV7bA52YQhonQjuY3WxNORTmxmEd0Er3iyIssnZCOHtHkO0FLNwJNMiNcezXw4+mizSq4il68qf9WuzY1sKTcIyqUdRQzAp0Y2OWe7EWsFECXxSxoeqWjpKItCnbKQmf0u7VyC3LpPniWiNORROGk+dFGhka++oIpSYRvgROJaNgxrAJfYPlgdKFAtVLKTphY8oV2CndmEY9xnh23+iNVojs2gnRYorOz5lPQ37vWin0Lc4rmORLqopJcAnegMXNJlxUmZhL7znI9W2YLEVmIHvEMhEQVf6Bh0NBAky/l87n1WfMCZNgYCmrfJatFbmYVjCMmd0qHVUc/sYvWBkZBLNMosJ8tJmw2G3zg0k3cTCfYTtPOnVMLCiYzu9icv5otf2S5pf+wm/8fqQBYooJJptuP3/7Fzfn2rx8dnwwZnHbGx933MhmBiXj/yQ1cHVe4v93sbD0zdXy5QXYUs+Tm1cvJLDnPf3l22tBM7i6cYlIlTUBSdoXsVvotucKaKEIdGJb7uu04mCOoKW+7tp6rgC1Z9OVX9TrEOrR0CaIaN+csqYQmYibOVakEbwgdMc8fwLItmDOhZOWZYGal8aC+6gp4C/Guy3ejHIDQyKeINVswvkSBUqw8VNto9W8aZvvO3JLLqFCPRQS6/LxUHtzcNCa0DW9mGFIq1ESPnFWUcuBZEG484k/Kvn1NuZi7105yUVPJF4i0PP1ZOWchYC7fS67ul4hRUUY7s59catiDxAFnBMAOmxSIYv+L4xxziOQk+361HwJJbIEe/ER18mSvV0mBALq80WU0mJT7TxTblcUUuuXkWwRYadddMOzWomVs5JjrtTvksoA04jXEY+fCcaezwXG20VL4zznDOx7y3DXI9OJZM4HYRD7sYomEi5R25a7wEtDkfVSbdRJhXASt27zw5pwlzICwXFvfi3V00SyCQK6Ng1nHaL6actYZijsoa1JXcHzltigPCm+r3PlSoGUpQihdIXXLxXChRrcSYh80EbYUqNRnnwEy5SUsS9FkNfMcKQNjmvDa9gzvPb6Opw6vYhwzBhuqvXl3f0xHx8fDdnP+1598/PYvzp7/6Y+yl/+RCgAFBB2vtr90enb6iUsnl1Yks8mNMIFY54QPXr6J44sdxjBp9yMsyi6zWS1H0lb06Vs+XjEqn+vcNouFjo6+BNocacpwgo5qfoL0Ag7ILBDmcb2lwEHHDueEjx764kR8rFAaUhV+vi2t6VJOvMV6amDAiJVeBL0wTo/lRGhf0UeugghiLz2Zt+EkDfbYfFZZne9LGqD5Y3lF3waE57KZy0K7s+nRiZ8UhcpFsK3AHef7pZwYcnmws+o6NOBDMNBFAR4iqAkf8pRFY1Bmt3oa0bQ4mXlzHsdo25KsFjVdO7Pil60SFiL7v7UvhudI2g9Vp0Gn4LfYjcnVklnz6UW0Rp/SpnbDZIbEMEpTr7QmgYrvvWxqLglO2CRO3BY+M811FBwvX6NtZL5cEy3rDcyGTc8aEiZdsKUD6tMHw1rhMMPVhkx6UmdPr9MX6IYAspiD60YRtbXiExglX2Pp5oA+GhrWBF1pB8tCbK8nCfq/4xP/2N6rzurs0xDLZpwZ7NR07xmCba5rBkU8TZ8rokL1YOnzotba4tfvmtpSm11sr56f4an1FXzz8XWMm1EDP5bPki+fXFqdnZ5+YrLpl0h+WXu4fbkFgJnlz3/+89+Yh+EfAvzgNI0LBmvXhiNxgAGvTxf4V6cvIh+vcGIHmHJ2nnu4qaGQoqKtf1aIK+LVw66qbx8hCMPBPGjRzCobFkURal6XIJGztc/AUsm1eF9rmLnGjii7gwA2+labB26JkC0qYoWoZWE+GvOzlX3gWG5cJmO+NduGVvgEROdM0P67fv6ekjmC8lW30YS3eRV/mSNKSxMSMAKn9tW2poVNIDVOBTeWCbPVqi+hy3VQUFBp8SkjnwGda/Qx8GERKYurfleiS4nK51aWYQ2Hu2YQaJHnbQ+9OO6onYnzVwhFzXrPgOceOU2HCV9CN2OHn2ZHSW0pfG6P662ZI+ZAQ6W4djoTdGa5Oi/OfvzgWsrOo1NscXX8l6oaxcLojEI6Fa1Qk3PfXHN5vlUL0Ibbe1aKpvA1CPKIPIZoZmRSSMj35mf3VXCrb8FkHGoxTd1ZWindnuLPiFx/cTJ4HZFSSXsbHpt490CCdmNhi8+ddt+kKMnL9ZQJtMKjzDlGvAUzpYRXNw9wG8f4rqtPYDUaJnDXPUkz9o3Mw2qAwX4N2/Ev3rp163ffKvHvK9IBmMOChlu3bv3uxcXFj6WdaXrxKpSLu+GER1dH+PaTG8gPNjidNiGuVGyTC9XNKU0DZUZ6NL1oUesKr7SpadIqVSywNXYR3cwtYqtEoV2LBFO0RiMCs47qHY1cThP++oAezQRwNjC+eWmnnRbn/XXxlPTtXs0g6JiRiFaEtiBx42SK4R8TBbz+BXK/FU0fSrpoVRayob5aYwNznAjVnDBsoOY6BBDgC8zPn3Vu6bzYFr0OEmVqcApinReWtqup4Egog2y/h3aOr2B3GXu5zxMQuubdJ75D4DPWG3fd/P5SbRCXoqdreaRa+Xx7vbR8tSh2Y76YRhm/WjZ+RhOmgrOcMuyxPU0pQoSow2AZGkhzjPMTr1LR1ggHBPT3hBues44z9z/TvUdfNSAxd4WNgJJNyFIdJ7WT0Npts966hHa9KpsnGQp6+OIwZp/E3JXAF6GFkVzntrS9B1k48JX1tAph2XBQr+atWWMJ1DwBjXtLNAwwvL45xTUc4juv3MZqmgWUZuLiIszAZCmN2/Mfmzf/4cvZ/L/sAqDSGDkcr1a/Pk3Tz56cnAyWLPthouFiGnFzdQXffnwT+XSLTR5hClYJS7BJ3PjSxlwsGXQPhDnJtcH7/RkFMlar5Qa7CIYZjyjXKX/PfJtT+oXhpN3tmjQxubXgpFfp6jmKaqSSdDGGVrNa+aJuOyYklg0FDujhW5iS0CUt36JZ2PNkFUuPtvEDAtZb5SwQzHymjDmIjD/he7IaQqrknNRnPnfI4thFxzxKeHNuvQUow0YqT2nh61xQ7xMTfqIMdwTn7KOEdNM1U6tf/e4WwE3dpCvWeoE+QQN1KAJQ3VTUokm/Uehmy0CNLLYyRsrgMqoIcCLrh1Y5+JHTRtRRRSq4YHqbaRSk0rPsjRFQ1UvY1LAgf68xghRcwibcvVKveYVEcS6EKIVhKQllc3OWPXdoCOl4KuR0GQReM2WES7ZcbIaubR9GB1YQtCImlBGrc0IVBksFMWmHkGJNhbNse1EcpTu4uA+MdV/QHArP2oivx5CY6kN5anHbK2g1/8rv9kuCoTu8mU/5pDvVUISFGnwWdiQaVgbcHy/wCNf4riu3sc4JI/O8M9fxrQH55ORkyHn82RVWv05y+MMAf75iBcBCHrp169b9O48//0NnZ2f/YFityAJhqpXsxTjizsEVfODSDVxcbHDBaf6cVRJXinFpdWV5EF2+dFmAk7DjfaUdCWN5GT3MF9ecutQcshLoeMbDJg7ztitzmbPch3gpQqlC5Zp5187yJ5tS5yAhTXhzc1I6Hk2Iw40gE/rQEWNFF9c/ltz837WCm8dIIo27kB2ZijHkq7uRQSfaVIKW4kxzT23fUpvYAj0oj4NPk/NI5eXvZmPTzijaF+cOQJth79o52c1El40kBwR0N7lMu0QNg4gdOVeWUwuDHbdN92PUOYSTjW+tSwHcTb5kda+EjQrJ3HprFk5RSxCQuGkgOQ+9k9zyqRMWUXJq2gNZHQURmKTtaHTAambSIQukS/gis/5ebp4BCxhg17pPFsYgUehZb4osiA73yKWQghjb3rToW/L9MsZN1xzDoNXzN22dpivR3K7knha9iouXa5D3YtxUHPnQBuje8xmxp43kDjTWPJI6A+m1GvQECyekHAC8MW5wzAHfeeUOLnHB/CborUwwD6sVT0/P/8Gt68//0K1bt+5jJvN+2fs33qZfJTHwC1+4s2H+/4bVcHUcx2xmSQVPyMR6tcJnNq/hNy++hMPDQxwuGfa9VGuzGW7DgGj0Ah2LZK9Y+SuHX3O596HYdJZv3EtL60LWOl74Zj4Z7zHCC/xUmBgfVI1V0whL+srX0Q0Dk9/vHuxw3oLX3sWm+VNxa++pFppgmO/3f81T4eAdnM1fMSe63BMEXdCrTm7ZzCMYuBC6A8Q2sLMGzqf1rAubda6nCKseSrvTjSeIRNout7n3U2a4oagxMNDduGco5oE4KHPl7Mhxip81ndWHsYwyIsrPzv0CtOMEbzZkU44DVPxGPx4pcCwB4RplJqzQncWmq0CKDmjQqrWvzrHpWtIuZRAh7TLuT828O6nyqdIs9+QfNDqM2Cl6yIan4mGz2sVjE0nM9mRMOVA5H3sBHTSZIu39GwOJ6NeP6A5wEApJHGE7zuzd23EvN/agkQLq2bMduvXBOuOHZaQWtD7lOchaxxkGAmkw3Nue4WAa8Keu3MGjOMA4TbvkSxWKkvngYJWmMd/bwr7l3Tdvfu7Lnfu/3SMA1QOkGzduvJwSfjznnIdh0DVyd20Gw3aa8PTho/iWw2u4uLjAheXCwyYsXGDOYV4mMJleeJC2q1nwwIRpnoiLVa3pW1UTQLTzUtJ7npTBr7+nLoSd4tS8tDEgvlolqjlh4cJ8p8nrWyBrESHtz8NiHHDZWVPM21Tc+MLb9nRIRnpPUZ2bST/CJTEaGhjb/B0t1j5HHHN59la59xQ5sDzJJthTuECOeDCo6v/iYxb6CxmOTwYn3HH2SNauiyrOd58jOw853awsN7qV5TujsCoSfXof6T9bgboUop4WUfqlmCP1uVghdyQzNSHMGykD40La0lrQmEmuRETFamu93xuAJEmaiz1CLeCcNXSOgDIHgfAF6vzfMnwSJgNnpFA9zVyUuFq3SDRRvpVupyjYsJG5BE8LHThrnRYqhGXU1+Tap7HI3Np/4tXSt4Wo2WxFFWYGvZ7HDSEX6/Tix6YfZ5gxzMqrpiU+B8pCcb1DsqMRYhsfJ218wiOFDaGNL7YwH6pGL3SlH7P6nr6Fw6bcpcXKbg3WubiVkj57u/f22vYC62z4riu3cc0OMeU8p5RS1i/m1TAYJ+Zh4I8/fePGy2/n5v+2FgCyc0xP3Lj9EZAfHlarbdrlTOYKJDEwAdtxxLsPH8X7Dx/D5nyDc2SvMnXWjBZ+3j9IaQIemlY4Q54z97SKuRDOdEENLWoKItTNaW0/r1vhM/4kgCAokjmt2sDI/d1uVXJrItcc1+nao51rxKBoXmhbvSGGS96Ta1mKCgs4tqZjg+4CyIh1N3j2mAQEuUU6MsYNrRhL0hirAIuqtuw6M2Cxta4hJR1xpgTmPFwHwgC8Wt5/7p/qFoW3BU992bz8vWcdWSA9tNpDmcq8sfN8mQfdwNnbIvpYoTlyIjIL27/eG9Y5rDoMjNe9mH+9uPCrZozqIFGEYyAfsveZWmm4u8eg+PnC/PedFMWck2E9M3jwVllvLIw1LLQSokW6vyyooFSDx0rhpdHDYPh2ImAdgdi6ZzrFt7JJEFHXxzfZVPxQ1wRFHTZ3KRx7mS29xYwyZi7/v2k4lwQwaZHQ0FD3JWZUMFJKxL18jsvZ8L1XnsAjPCgBP+a0o8xDSlithm0mPnz7sdsfATC9tSv81n+t3s4ftswkPv7xj6+evHn7oy+89GKylH46WbIpT7S0u4yJhmwZ4zTh3YePwgz4rfMvgocHOLTVPAcVap8TtOSuKpORMdzm07ooXovQu4I2FZGYemwRGfhL8l/1qFaKGX2VYZJvFR9ut9l5prauP+osrOhIJfh6KxNMw0jUsiOqWWmnF8uhWgyNYs2qVXvxcxv8OKG8ZwttvjAWaUI+6KUXS+s2YkT1dCn+oyp4ZFDNh+5I4RNURT1l1mAijtTFjjozZRBwddqMraWy2r24Dw0sKW0lPMaF9Nqelj/raINolm3GACbde2kzIwM1jbPcowzhKtUW5yh0YaHVnHNK0V4z4RXhKlCozs8qmGRKoaaIbqt2SHPaBFHkmye1NfugYmXd36NMorXVbc6+CCGCqthL7/em9jYfREWyRzTf0+anR12rJTPYkp3U1mVOVLuhhmQ1bXXlNyx/jyYFJBrdkXNu2r4PJRZBhGRDdQXI+yXp4qeLhkgJXU3r35w7yBM9PZHUmuI5HiRC458VGkXH34bvttjS1dsdt1/bXOAyE77z8m1c5QE2OftIZwNyzlwNq0RmXlxc/Njd20989OP8+MrMxrf5wP72aQA6p5yVmY2ffemlv7I6XP/EOI2raZowA8Prsk5gtRrw0sUb+MT5y5gOE47twLVcljCM3fqb5XTlq7KehsO1rGmO7d8UEA+ZAyFk60HZ8BpAUgoAv2kpNW9fcpw1aXMPHRc3IhUnaNLHX8OyqArduYJm56IJQ90nKraMdwhBzSMuo+1QibG9FaLj+2M8JSkXqsOACA6qHsWxCEMtxnO1DWqXpObLDJ/maK3rwinP3fGcbgbZ9zyagyuxdxo3T+CdtUWhsG07PzVjXgoANaGadXP+IiYKHXac7Rs9R71GR+9piJmgIbsqaGz8PRa4CiFkCR1dKdRaiRDhLd2eslku7ytZ4Dm0Ple1FOMhzI94ARm0QW7cKA4XFSBq5LD1vDbNlxO4ydJx7DZ6rBYAZAwn8aNNBtgS1OEUBY1aAIRC0z3y7N1/3i7JbgFQC4W2AKCMxfwN9mYFQAz7cGOQRqi7s8TCMr40nuEaD/DBy7dxmQPGvNsNA/cjD2nAajWM2+35X33y5pMfXfbSr8Q+vfpKFQAGm57jc8OTdvujn3nphbRaHf5ksmGY8sSUUlHiMBk244g7B5cxJMOvnb6CB6sLnKwPYLnS2IiqUG9FM0qpW+ZkuU7grQZJeGGZkKMaSZ+1M2FJoXI58nJCVYhIQ7myHv9ZN1qGEB9veex64uXmdlniRh3+1lCUmAUrgTuwWDyYp3rRW3nU6mJBxGlmAeASTkvNVkFUfkQHa0iKUp+uHd/CaVRUWAs1Ld0ZGOaGSAvUuFRJTDNPlmPz/Zmbzea2CSEbtqSFeVxgE76igCYLIHjrtT7ZAZ8El0VzkpN5qtmummB8OmQMEw1ysemmHSBKtrpCadwia+GeAkCKr2LpSMkptJ62hfDZFNK60fmNWE/uRcQoOhHoWItW34P42aMYEi7Rj23iHjsKeKseEkpqpF8z4MKqfOeTMeVL9CD6TMtaZXSjKgcACo8eK4azWvMoEUCaGcCSaet/z9CwVdyKbjUxlr2x0BLQ5QrqXvRvRxDsWJzeRuxIBhqL3sDiZA9QuI/ML3fXtCrRE4hsE17dnOFWOsF3XL6FIyaME2FDEo2wIefMIQ0JsOni4vTH7t6++9HnnntusF3r/yu0T3+Ffy3VywtfeOmvrFern8p5StOUYSUeKCPbbrqxGhJey+f4f+9/Hm+sMi4fHiFNaXfT5WpSWawXRkOOp0DXaW4V6hZaQqTAR5pzi2IgzcfUqhvBJGtgWSSUZuU2PnoxvaQEuta+I4P5z1zdANachI1eUetGAgY3Q0cMgTNrQB/mEK3mZ7iCIHUtTZuZ4IJudt9PqGLoKnyhyQXHR80mkFGDKwDq7lq7PJQ2Yv38NWvdyrjEAUVcwRm7Cst3QS9+s2B/LOI4uvQ6XSxdIJChUaUv3QOzWmT5/HA/HnAYaBU+OmKlhylEm2tbXMo4hKG17Gh1dYOka0HbXqW/GZqUOD9/7/VVwhgrtNtNICKliJUWfinapV+tB4LyfZvw5UUEq3HjmlJpgaCoqnmXXx+FzM7Jg8oQYIcAaF5Coadl575gPWDVdj9rsW4x5VI3MAtNuN1rpyUECp4wykb7Mt9zyZzPyDr5HN72SXfYKS12mqPDImh+4NZGVuF34btUkSLZHxlWmqk+fxYUEOYKMhO4UWxXWTYMZthwi1c3p3h6dRXfdnILw7S4a0zG2AlG5rQaMCTL0zj96JM3b39FT/5fzQJgzmmx6YWXX/qh9bD6iXEcV1POGJLZ0rLM80azTgkP8hb/+sEX8MqwxSOHxzul4sRmDl6rcj8GaD6Uhda0s5N4FSmxJxm1SZXskKJc+1UamuZDKtSKCIZIXGf3CwWEbtwKMDBKh6QTxCrpcAgZwTVshvNpi8765QqWgAu1joAq3l0mGM+H+iZDnoHOPOmsjAzOBoER5dDqM7r/q1HAfjWxrovZrGc2oYgDa6VP6wk2+pHAbjNoXAfmBJkeO9uOV2JPPdq56tpJydmAkArDCVGwrVm9/g1bjc2IzVwPO4zMgj7C4XZVR+Kir/3pTn9aptzPvaqCcDkdcBhv645wtABlvDesFUO6jd78prJ3mqju3DDeokqcrGl4d8cBkVppe+RzaLQbLtDW+e0dFtrCSbgRUPdwzea/fWvVstRwtkaU2QLZvM6EngwprwvskLyYoUcV7KT5M3uYABZdFuY0NSYJkObWEr03dlb3lSWcY4P7F+f4pvU1fPPx47DJMOa8cw2lObcDQJ7I9ZCQVsO42W7/6tO3n/j7C+jn7fD6f00LACkCBjMbX3jxpR9Ka/tpAJaniYClLDdQJrBGwgYjfuPBy/gsznD56BAHWIETZyYNC4zFVOXWm487h5BWq95y4/LeXUaBOctesbZ0AnbqAuPfk2PjB2QlNU9asaDwJ3YL9hz1nNfDjU9DKydVmKMjFj8z96ydvpqY52ghE1wETewUQ7uccGvXCGtH0s7rDM96gChxa3AMxOsNF1LCDgrVqXak70xHY7TWIR8WS1KwvtJloGQvRH852eJqTSyI5RSk8aOq61DpkTACalCROWsUgoWtnn69RZIBl7sPu8yQnx7nqdqyhxbkKiyzFl1h8Ap9yk1RbVBiL3OCsH1sfI/4LsFDRm8thNp+l8jmXoZC1daUZ0s2s2pxYyfiOeJs2czgLQbwNF9E4HiQPgzPRc34Qp8eudWJEaDvKlC7HHXdKB039gtmOm2QX2trM8uH+DiOv1oitSASqEXJ3zCXuespqmFt154T4SvIiDHQWl01OXQjWoqtVrpe+mzN4WOWgPvTBtM44gNHj+Pd66sYR3maBi0kc96NxI3M+Ufu7jb/FYDpK735fyVsgA9zB0wkh7tP3P77mfzwalhtLQ2WkbPDXhqx5YQVBnzH5dv45uERbE4vcD5tdz5JwXUuWc2whyPwTQsFtFxplyPeuypEmwhGPqSisr1woWiKNV+Sh9+XFhOSz6Rv+6iuRRXZ4/uuDtmT4dGLptSmaOpSoCssun5BZ52BF9407bygGgsjGbXf+Kqi/tnkcXIdaJG9hbJX56V0RzbJegy3En1bPX6UhzuRauuya7KrfvCWChkwt67y6FHN2Dmb9++W5nt8aKfHF1uM790C0RG1xV5e9y1QbDIRYFdSUgRZCZsIXc3Ty34MxgDa0m/ZgpmSDDkSDFe2c5XMGzO1qNoHh3Kppj6BwdNAOzdbrb2tOXXTtbojqGw5ICT/LQjDIFrvesLKtwDi85LoJnNAOrRKgVTFq8sJ6In1zEVgo3m6/OjGGvuQFml7ngdLMyl1iYgfcH97gdWW+K6T23h6fRXbMZexMAZn7c0JyVar1ZZ5+vDdevL/qmz+X7UOQE8T8JkXX/rhNOCnzWDTThSQvPJ5V42tLOGl7Rv4xPkruDgwXF0dwqalU+YTyTwk2JXxcsNLGtdcyZlGsKpVT2e3ZDQAzA9gCotwrdyTdSJajF7U1sx96TauYPjx2SmxvSWbEGGehGgIIskgkjK2jH5oFkKX4+mT0qxV2ltTC1mwbHkNwmyB7TAYGkSRNoQbQp55+q8IjdhSwHrJd9L6NLeJiTjQH3l8Ap6zC7JVozv4jWo8dGFkY5RgRRAJ/6ZjZdPxTVFCt0lwcPNoug3JongkAKUiYdIlYwq5s57MG2iCz7xgf/zlkZRxz+9T4HzjQLtFXgxmDWpSuyuxyLYCe0IJOmKzwStDo4n51YjvlkDsHOblJC2dF6fXoDYKrHk29yk0e+RI7ayUwCVxv9ADsyvQK3uaZx0h+A6alkY2H9ysOWhI6mnP+VQE33GeEgr75VrnatX2VlTzhMyY4AjfwY2jqeU+StJ2HMwwpgn3Ls5xPa/xgZObuGJrTHnaFVMWxn+ZOaUhAeQ0jT/y9BN3P/LVmPl/TToAoRswfvzjH189/cTtj4D44WG12qwP1gmW8vKGdnS13de+nSbcXl/G91y6jUc2Ca9dnGFKxLDcCDnMzRtztjVna7/07ghtVKhj7pzwk3Xm09Y5/fpZMt+k5jKG5L+9zOroUwiEv7CZ6kPO8GWrwGr+aM30MKKKG34bPUrWd7npc8Trn6qhQxL403jhYRVSwvZa9M1n5iyCjON48z4lL3yjg6bE9ge7QJ0Ov15f3wIAyvb1AKQ0yj71jw1gPHDnTViT6qyIkbDxtG625/4012Jmp6PU7Kt7+0f+ESoC1YeeQ+jnRASiF8uMDvKGDkMg3ijOGKEbwpu1DiPcnS0Ex6O63uKZixbQ8OaLhHq+dcJAV6ywY211c/dOgqHtX5EazQJzKNDrf8wgMtlzrnpH1N6OQFDj02J8ZWU3BPZFpCSahY6h0iEf5pYqUd2RBxFtsAbz1hxxDc82djNcYIt7Z6d4V7qEP3X5Di5jhe2Ud1kWeofsKLF5tVqn1Wq1Ie2Hn37i7kc+/vGv/ub/NekARGHgZ1566YfX6+Fvk3xsHLeNudjMMOWMtSVMRvzG6ct4Pt/H8dEhjrDaVaA9O7nLs6FLfIsKtlY3wDZ5J/YWlVJorfjAGLnRaBOmVCjH2BnX0EhxPzgL2YI7ZdMa3P1HC5HCMnd2kDxraIJBiN4nG+pIgj6bAeAu8lmEi9qpjXNc5uznbyJ+28vQ7/ELXBCJNdx0jV3dJ2dEE+5Kr3CfP3RigLSpOMi4R4YVFeI1Y7wLMrEqboozbiCeoti4B1wngX5xI9tnxx0a2QoEvUCtw9yK4VUWtqc4c0KHCxU5/6wiu55AspsuHO5RwltxEZ0t1OCacM8SbXZISKWMQxaXWfIQskjjcbBenLl1hZ+qW+qzGASZbVWT4Q/KhkbFwzbbY99BQK+L83p0pAyFqW9vEtbT7PMtc8IU6V6cTR74bwggNHFaMMT+1jOYwqdqCZBF3L0UZCtbwRJxf7wAxgnfcnQd7xoeAXLeCWhtDsFIps8wV6vBktkXx3H8m3dvP/GRXdvfshn41d6L09eiADAzmtlE0p6+ffsj0+n5B/M4/sylk0tmsJww6wJL1Z0wghhywrdduoVvP3gM49kF3pjOwUE53HA88IiAND8yL/+SQuKVpcpLp4jFGO7MkgoawjPazUOa33RlCSTczKvIm9NVyOxmtPZ1TujWx17qo5xdPjl9kc2eCjcUHEtMaTgjm8F53H12gZXF18xEUMW9Jaq2z0v0qjEYOlxtLxGtdB2Lyp/PoksIkCZDiU71glJzs9RqtaQTNS2UMxfkRO9ooIivuG8IzOXMVV+vihJ3C00W+6W3okhUq2oNtHvDqM62aB0PjgH2JZPuAGvh7My9+G16ZBVa0LB1bTl0sdZoRhJea2OBjciHnE4R7GjmKI4uLwTmg7yWNjZjXFj/GQX9PereOqtepgVPMeSK+CWj/jyTlFTrcPCVfOi/zIX66Z47+ILD9g73RSTdZrEJmj1IZ8j6DNPFO7r70LcozXEzfACT9Y1HKXRurC3Q265ZbAgPmGzEvYtTXM0DvvfkDp5e7TZ/ArC05NikGQSEbGb50qUTy9P0M+PZxQfnzd/MbPpabP5fsw5AL0Xw+eefP7aD1U8Nq9VfJolpnCYYhlyKugzm3a23TgNe5Sl+88EX8ZptcXK4xoGtwAklZGapRrNslPV0y25oZFGsLjPo3sGyI3hbxv666bWVbsCrhhjOBjrEMGogfadBmxEONLSodr3QhU0aYCfhLzwsLi/Q5a7XADBFvNJ12vcoq60TkqSnQwubMPd70333Yjmd+8ivJjkNAgAK6X0WT8eiEyh2Q4f47HwZIY2wl7RmYU7p5i2kO5312I8MOOAKM4HjRcSk23hyXUiAHl1gASzj75O+0FRP93S4XH1/0U24wLnaDlx4PcEQLzuj61AFrGB71ayiuxv3iXk/esf9Fyf0DqilNlz4iF2l3rlce4fvjimPFUZkUOU5W7plYUtY5YjQw8XUpaNWQXOzeitOmwbo0z35t2JktYCW2kSuN+ETJGvOSMSaM8wwaiu3cAFi8M/8fnK02nYCjQI5Q+zOToFWGSPLjJS795yQgIE4nTbgZsTd1VV809E1HDBhzHnOWFostKUAm9IwDGYJmflneb750aeeeurs7Q72+brpAPRSBJ966qmzs3v3Pzxuxj87TdOvH50cD8wcOa8exQpmwDZnXEsn+N6rd/BNwxVszja4P53P9orkNXWpow5lPJ+0+Nw8+zmZJVikOT9rQVk3X/RO3kGoUyvxfhCKH3flNoAm2AJ7ZxuDd0j0550+Lzx3FvbcpZb5lq1Ka9jzI5vvCrAMLxiizk1S6TrpwX6cVufC7e7mnAOKLIZLDvQlPmlNlr0XWNNlCrALjBbKGftYXLggFn/C8ojTTofUlFgW1EnWP9l28dG93w3dEMbZfO+YSnqlTUnj61QdjcA0iv0eltLORsdDBXA43YduKlnU9+bGvOzIMnTzZxTDONmPaC/0+Ta2dkzs1xhYzBzQLBAVkXZkJAo8sxAtRUFDo5FJxxyUqGfc/+abx1+aloxJWBZk89YmFTZ6Ed300bHTNE6C1tvfPO9OJqD9SmvuSYuahMlgGRgsYUwTXru4j6NNxgePbuL9R49hyIZtzh4SVOc449HJyZCn/OvTdvyzZ6/d+/A7ZfN/R3QAgi4AZsYXvvCFb8oc/9fj4+NvO3twCpAjzFZwGuPdxrsaEl7ePsBvnb2Mezbi5PAIa0th4xbvJiOggkLpAzhXcTqnpsWxI10egZsdFWLVHje1eYW4j+mkvwG17aY+XT2yhdMWes4vp3WIUkmGE5fQEa1y+xkMDHVEoi6MFvKxDNzMnazV7RAyA5z6v74gKy3VUfq0q7A72NMR0pppsEYcWugkON9jUol0KCyWzyIafqs+ffdddQwU3Dd0V6RsaMNoCBMaBoU1YT96eu5NnEm6FEELG4npnWLebdKOo+VnKVJ5Pum1SOOII5azkrMGIoBi1PNt0S7e4HMbWwDNQbMqGImtW0E4AKW176jU5o07MnZhL4dAvP8Nt0Izmy16cRiKa3+q3q0PqfYngibJpCPJeTyhseL1vkvu7szgrnXNGsxFyTvxnAkdtNMXsHJTmoVwLDcA0rFYA/rtpFE0BCf/sMmaHimwzUwxdPP0mdiF1+1anW/wApvtBZ4aruJbDh/Hka0w5SzAJMf7HmG2Ojk+xunp2b9Ow+o/uXvz5u/oPvdO2HfTO6UAWC7Ic3xuuHvz5u+cnm+//+zs7EdheHDl6iMrgLlow+bT5ATiYpzw+HAJf/ryXbw3XcH5+RnujxfVsiU+ds31rnYn4YFTQT+yGASlqWlecYkjj4sPRaGvyV9RvDyDShaf6PzA0apdyIR8yBk24Y7JplGpPYVrJZt5AAydFcF0nru0FM3Pb7WypiijXYGelrCZeR5qsW3HkKttTlOwey+smglJblpS8hhIgct1pP43JwS1Mh4iBMca2tcMegxaFRct83/9MzS6FmylVFo77jFzGRFodebeSa4pawq2Ya81IkyGEktL+Uf+XQoYfzSyTmzvUnRQtDB0SuoodGTEYy+2stB9qeN1SeH0Cc71NSivaQIE4hKr7Mc9+lnLJr4Uo5T5sNXPU585Nop5JddTdwei3Hd1Y7N+QBT1NG+lJ+HDfOgooRR9AZWhEKOiCWf59DkTQT+ENh1J483VSUN5vqzREbDYGinFR9HfWJjj11WlfGYK6rde+xAvHoQfFsSipuuFmRspmDqJFBa03B/yPfe0XIMlbNOEV8cHWI0ZHzy8jW8/uoVDDhg5LRaqGte9+yF5t2fhwemDsx893Wy//+7Nm7/zHJ8b3kmb/zuqA9DTBQDA8y+99BeYph82DN9vAMZxzGa2BCwV+lpCwmowvLy9j985+yJeTSPWB7t4YWPrDYdHPnsFu9Eplhnns5AHohn7auysNYK52IDSnABToprPZ+uQwtrAlWBiD+lbcCQ5DU+idbXqgSKoYwU/vjDraBjgZ/HsRJdaQx/00aJ6YleVgQXUDBuVujUxpT6JLTs7ICKlLOgX4ikju/mr6gQ0ZtpkpOlFV+7oJNx1hvqRIcionP6XObgLbQksBnqrq9L52AQ8SRob26zHJvbH2uXDNBsitnetMdpXkpsJTS8m3gWodVlkZYbcDAyWE6uQBAsONkZD68kb/no2+ZSm1lIGwKQ5yqh69iNZM97BkeHf8dn6sYaLVVbOfQRGBMxv7/CA+n1b56+bxc5heC7QOgXaYKygK5DQKkbToO1zIFAsqnMHJFlXV2Nuwrb7mQkhLKwc+BSRjTrnt12C32QZ96dz2DjhieEq3nt0fU7x2238S6iZLdoyMq9Wq+VQ/U9znj7y1O0n/3Hc095Jv96RBcBywUQjYC984cX/nkg/MqR0PI7jCGKooWX1lHqQEkZMeP7iNXx6+wYuBuBwvcY6DUh5nmcH2wsbt0nTR4M71riWbfJtI7Bjx2kjNMEoU3qL1yWUECny6hVIaj06eA0EcV2IXlSrxqTqWKBZpLxPmvtCYRUByj5PoUkkU4BMwHmyzMlbVjnCeCDPrTp7Sw+EfJ9mDTFdiwUL8+ZaGHauQQdmVBel+vZNgm38Ghg3gI7CWuxMZkoYZGRMlXHPvgMJXWZ8DL5h8D30bnFrctob/PNDxc/W6Bwcmqnx/lspzIqoK2xwkcDn4pQbY6gFwam3kcJpgyTIRzflUhywis2IptBp6R4WYsdRHCQk0UGMxbu0vI9qf9MiRXIiWB2iDOO45stVxPM+2GE34podqqoWxjk8tzGCXMYoVq3CNZArJDLqncmm4+9w0ctYNXFXLDAB59xis93iMR7gPUfX8PjqGJiAjFxx78tMkplmNg3DakXmMyD/9LtuPvHXzIy6j70T99n0Ti0AzCzPm/9gZrx784m/hrz5njzlf/Hoo4+uUkoGMudZ0r3MGi84Akx479Fj+J6T27jLY0xnG9zfnmODPFd3aW7CpdLSY0gNJNqNNVpm+kKSiCrrlBqltWcdktgehiwDy4N0h8kOM0YsZtyzzfVEhGgikR+OjFUNg+lsoKPiMh/QUuqI3DFMBj+6fk9oQT/WOAbo24Z7OgIuNdJDv2qnh8FhantsUF0isnU3f3e+Di199vC9RrTxjXu4COzV+A/BU3tNYvDi00NW4KNw38To7rEZ1hMhigwyaDYeflTx70dbHd7l45XhlPFVw94y2XzmsQQsCmmV/Mg2uEqKTD1BM+TaV59uF8Atp9NwX7MD9g62PjjEsSFqLB1Uhx5eTV23mogPhpGRLnP06M0GZxzXhSgbbrsI5oN6hdbng6PikWOxbJsTPcabMInOJ2GVrbT7720eYHU+4v2rR/Fdx7dw047BMZfNX4TP2YichsEeefTaKk/Tv8gZ3yOb/7DsY+/YfRZfB79m4YSZWX7hhRfelVf4QSJ9+GC9ftpgON9uRjIn486lsbT81nOL94vjKZ7f3MPL+Qx5lXC0OihCwVxaoTnot4W8ZZBs+N09kNHGZtZDrolgZ65vl7+b0NpTHG/cfBdPQ1Ispn5ZJ0QrAmNawG/H2NT1ZuuiaYz+bQmvMTY5CFkEdaaeQRE5OjEUO0r3Pda1kNfr3oMKpMoFp89vMOcPbo/Fpie9FGyMrMpisqXXla6JC2vMfmPSCFf6uFyL0XekE766jYUx9oBFoNnwHBo6C9wsVYsL2yfcB1zArysIQqBOxMRZYP+D7dGsnEjNBwn5KNmQhrm8tlPvs0PkkM+sWoGlRawpozq2UQEka7BQCYISXZCKiR3WltEdEtvtVnUvNJd6qgE8FtxILrRIYpFrh8+H+LiVQMab4e7yIwX62GlHiNpjm6+2XEMn6bkmi2paacGw+89qcPpI16AtND6EkaaDHHl/MrVDSMNqfo9bG3E+bbAaiSeGS3j64FGcpDVyzmLrLuOdbLB8cHi0omVsL7afIfA/rcb883fv3v2D+dTPd9Ks/+u6ANBCYLmoz7/y/JPcpL9Ms//s+Pj4vdvtFuO4nXLOyXa/kAGkbFgNhgkZr4yneH7zBr6EM6RhhYNhjQFphvFkN5YtXlCrVSctKljhM6N17mu1fVlT4xY6nqhjSW9LkvZSyb4wVRCLF8JMcux1Lrr7mTUyNbRiDZ2ZpUvlLQtxrXgq22AZCZQHttOaLa6LoEVwiXVUbr3E14JNqpyiN3XfsuhtkGQ+EEH57i2CyWoWghZ3O3e8VQGjSVFDzH8vhQjg+eKlVDsHy+daxg+ywSkroUVAeOKguexz1u+aPnHR8dLDxkD6wYE9tACoyXL7xlsN45J7ClGBx+hztbTFTeavtZCcxzZOFe/zJ5ZEy+oI8L4+BtCLquJREAwUIJXWJrkIBQ2+3cz5uzfNYShtcauRAVnEFaQbPHolf6obtDyqDDe6STIeNfmPPlmgxtWGICFTLUBL24xFfxFOmw9SU22QK24oIwdWEXBmFZEuP9eE66DjDMrnLLqoIhqMOgUileK+faZ2Py85fUA5cNBK0TeROOUFkCfcwDHevX4E19IhQGCaF8VUMzI4mOXVajWs1gc4PT/7PZA/Mxzkn33q8ac+G/eor4dfX1cFQIwWBoBPf+HTdzCu/nOz9J8eHR1943a7xWa7yZaM2CUrlRnfYAMmy3hlvI8/2L6BL+UNsE44HA4wIJVNsWycMRzFQt61obFxwZHiOsNZFxIEdyqlWMG4N1BcH7CgbDQr0cF+9lZdDgiAIqcHKAFJEPQlvQLYPCmu6RkwaAySzB5dkpiEvyiwhAznEQrf3sTipkCVGPWsl4U+atcPfXd/LqMB3ZSAlEafAG/VMy9EKgtQDt13EfTVAo8SHw0nvvM5576w09m6iY+8ujZM9Cpi0eu0TB10qYHx5NI6dfp22Ry9vhvOHosAvGHjV6ULaCnCMSlqF0gPG7GrxsZqMewdGFawvPDPhlW1fBNKFe1rCguar0t51gwuttex9bVosUgaj8E20SLpFetlA5eiliLSdXHhej5JdQxAU1vtrus5Z7DVbmWAY3khX7A4d5gmVPq4A0yJrsKAJARM3y2Ds2qqjokhQtn01CJ8gUQZ6RCu8LA5xGlCxnnewnLG9XSEd60u47odYyAw5jx3hopQeGLOtl6v03p9gPPz899Fsp/D+eZ/fve73/25JeQOX8UUv7fr1+rrrQCYL/D4zDPPpGeffRZm9jkAf+tTL774v5ydX/xFcPovjo6OniIzNpvNRM5H/GS2zRPMDDeHK7g+nODl7Sk+u7mHe3aOzXrA4bDGYAlDXjZAE1IUQx+qbU1WolZdcA0+u72QCp1anI7PT7IrcjJlpQSRmKq9ySayUB4gOta5pnLXBW156BUH6iAAjQ3P9gy6Pe9eRhjm3z/1lIConJdiJCoRZDZu0sJFyFhXuInpIhiS54oPWU9iRVRH9/2YC12rHAgS7rMma+fVKsbSYXFEOy97WZx0smHALyVAakAyyphAwOYyFEp1rMRamBEOrFQ9z7EgorSU0VhIi0hPhAE0LUThrGTeWUNJQxQI0uKBJ/24QOmWJu6e+Xssqvb5x2RQxt5V0KekQFKfbfkeNbkPJjHZbtTuS0mLiX3qPpLmiRQpNKFVUooroe9p5okWsCZhT3VcldxaUV0hysanF8HqPRHBpgH6s4w9UymEU7VFG8J41ZwA1zMtzAepAkh51t9RnD2Lpds8jTLlHe49J2LMIy7GC1gmHhuO8a6DK3hsOEKaDNOUsRWIz1xo54OD9ZDMsDnfPD/l/JP5yP7he64/8ZlFrD7vQyO+Dn8Zvs5/xY7A777xuZurB/wRZP6lS5cvffPZ2SmYgXEaJwAJySxPebYNJozI+OL2FC9u7+NLuADXCevVCmsMu7AXKnWPHYpWAH1YyN6mImYlgjYrgG5uMS9tdufdDfNVrYLLRhpO9UuLL6XCeqcbMwApnMrrgxQ8T+hsSEscptW2n8tOKTNaHwxjogyvGxhdCp1beKSH7RxbThhflfFsoEKqipbWoMJvtHugIT6qJSibTOw21Llxmlu5Ja53SXwjdwugWZuXR2vUye67p28jOzuqVVwPAjRF27fLgm30CvGaiCheejO/URjdd+UpyxpfXBHanLM0qkRDbWCShaCDYfNFJKNtKxgLGQK7LLg7qAwqB2ny9xwEKrTgb6ptTONyGcJ6zLVmlrHAktvgugvugCD6Iraqe32W/DhRIT+1o1Zm+s0P0ihof00orH8NR1OGk1mn2xLSMrs6hIjBnv9jqhWAQwZrpoFFQ1HJCfGtJ7pTzu5n1+cmFUCcFS2MISNjk0ds8oTVCDw+HOPJ9WVcG46QaPOJf74amTRYTkMakiUcnRzh/v37nxws/cJow09/4507X/h6PvH/sSsAerZBAPjc5z737otp+wMYhv+S5OWT46NrFxdbjHnc5t1owAywZGmHeOSE18YzvLi9jy/iApsBWKcVDoYBA3elZpakNzqvPyT9jT6a1hDEZ1KVR+8d+7G7zsoDXfSiodH2pKI5Q1NtdavXXKw0xor/tU6ynR5TnGZNZne6+VLJi0JxW+aXMV/ezUgtzLqVE2DWk1btv9HL+0tC7WtZD5rnbsk8+U4sZpnhW3GLMyQ4xFrkagwW6AW3uyImsFolW8E1EaxDoCwnc/HX2x6sa4BURY0IqJsB3XtrgzFtD8dZnwHRlRhd8qBZoMktn8MkTtrRMqhbqTArQspfeEtRMAmD745ZzY9QkRllV7XQ/lbxmzoOnK2QvijvKeqsZyy2wM+TATkjJ4AeVGN6fZMUmlA89h4MsekzHOKExHJqbLki3v9qjjzpmRHB1BFmI7EcNClIF3Jhmkcfo2VcTCOmcYvjnHBzdRm3Di7jkbTeFeg5Y2IGzJYB2TQMw/rg4BBnZ+evJuN9Zv6PNqw/9g137nwaAJ7hM+lZPIt3srL/T2QBoB2BX8GvDH/O/tw4FwI3N8ANYvpxwv79q1evPHZ2dobtZsPZ/5532rwhrWYP6P3pAp+fHuCl6T7u24Q0DDhMA9ZYlQdyyjn031lmaUVB4PuY4bQXeap6kg1K9FZGsNtULHqY21hQ3TxJ1r8HEWJpUTO/XmZbAHgXUmchC/7+6jFXLUJl95N7ok7Z4mIfVgAgeOqLCKsBNc3QqJLRzSZt1J28O1HEJsCdXE7NPlCGIQ0uxSwJxoynNykA2PFZB3eKuVEKYjtGClZfAOgovSHnwpMyzfUZrArErI5KTJPozEL5Qh+uBL/51Wto3ZNvUaimGmVsguA2pxY3p2jnkgnAlgNgKQkUp15PPYFS8g8sLfe2nmJ3FyMFIWyt9zSC2d8zyldoxn5ODGwhYtc/gw6HK9wBXR0S5PonNFTJ5TNlyVBcOpC+g8e5C6godd/KN6dunj9DgiMK9gKGSkgUA4RJunh60+4MfQPS7M664ISLvAXyiKs4wJ10BTfXl3DJ1gCAKU/IO9sXZ+YPDlYHdnzpGPdef/2LmfildVr/twfAy3eWE//HP77C933f1/2J/499AbCvIwAAL3zuc9+34fb9Bvx7yYZ/JzOn4+OTYbPZYNxutzt9nqVh1zq3C4x4ZTrF57cP8Bo3GBOR0oDVkLCy1e5h0njWIMpz9rroFdQzobW4UCphzyXj+JW7yfHubFqqwrHs5bQBG+IGbQysbji9vZ/lNh/Rkf/gRGBG5y9yAi+HKI/J7kSbx65nJFXedxjgDIRCtXZFx8Cy82bzf7+NqrGG+a6nM3Npg3BUNKCNmG75duHfFxV60FwQCpdpo3wM6KSsRa5AcKyEREOG6+lAlKZncQ8AYGdjbCKXGISP7lq2JgMlzpVcCradDX0eRObQsSLuql7CRVh0GA+7Ipqapuf4DHVjN9gu8qoUA1ZguE0RAAZNUL8QtB4BqheSox0iNfHJzHxX+CDkgSzXNTtHTb1VrBlXWZMtIk4c2wF22Ocddjak2hFqwD7z95vMHLWPRoyYsMkjxolY03A9HeH2cILHhxMcmmHK5LR8MLO8Wu1O+udnp5NZyjlP/ycNv5zW69/8hht3fuVh+8i/KQC+/jQCcyfWJgD4zGc+c20chhtm/PNm9pcI3Lh65cp7LjYXOD+/IHeZzhyQkNJOMfpG3qSXpwd4dTzDG3nEuMZOK2ADBlq7EEOjgTtO6kVMU2Z2QWgjlW8yeYDEe++9+mKdW04y0up3M3lZaFwSWTlcsmlTV1tftVvRdJRhfh5s7CfKOj6ChSTk6rclo8XPz0qd+anM72TeXfgFwQZklWxoM8Aks7ZSORv/FxGkGP/nkQG68ublJGoyT4+CdVeYWfCoq52ppBIiMO5bK3Yk7RUbaRFr1dO4Zw3I8YlAXhwY5u9bn0JtYV7vuxjLfbjb+GadydzyXTQnapEt16MTb636lKwZHWUDFTHnblYzn+alABe3jBaIqvxX7UNe0LFMZRPScCcvkrOiWN8tLqmE6FSLrAny1gcMFS/NoqBPbXCPWoqjXaDSOT1p0MjwWiiFRhxtpJQ8blrogE63wGi+969h5gFdVXCbSoegdFh0bGJ+ZFnWBLFKO+3s3LVYhLFTztgyI+cRKxqu4BCPpRM8Nhzhiq1z4q4AyzaBGWbJcHx8bAeHh7j32r1PJcPLmfwF0v7Jappefvrpp1+dP/ewBKP+cTvx/4krAPTXc889N7znB96Tvtu+e6u//6kXXvgOrvAf28T3pmH4wXGa8moYkg0rZBIDgZynyQBuOeGN8RyvjGfDazy3B9xyTIANK6xSspUNctrRWWWE8crCb2zdhI7hbiXwhMrfd6lws7qZdQK6iOgSqqcbirN16nNJ3TM9wNWNFCEh0WLut+oIrMuDKboDE8iK/v0aKra8wO4zZQtH2c5ijjIysVmzIYAlyuZlHtLE1NJKlmuu319pN7PllBu8YE/qBif48sh+C3Yr4ca77go9VZJAR+3YJDM2ypAgFpvNMbvDb/bYa7MZn4wqVDVxOlijO5BCaQ4CXkYtxpbzrpZO0udxaKFb+cjRGbBch7lgY3acdxNPRETGapHscLMWY3GTzwiRYCHTAn/JiwcdZAhi9VOHj/ILEHQk2XLtFTj0bZuMR+FzLK+nQj8v3l0k8wowW1r25jUIphOXnV1QIVF0wCk65YUeIhIW7VSuRUaErTlcMuroaH7JnaC0xnpvOWLMmZwyDmG4kg7sGg752OpoupyOsJpd+2k1DDtXUcI0ThinMadhSJimn+dgv2cjfvE9d+/+uq7Mv0quP/Wxj+UPfehD05+UPfFPVAEQyYJVSL5r73ziE584uPTYY/923m4fYLD/CMAPEngA8ujw6Oi96/V6bjslnJ+d4Xy6mO6PG3t1OsWr0znucWPTADMbMAwJgw0YbHBITs7EQQpjgDH/ohe8bZ7Cpr5dD9L0J0YT4EZBoTb6gDC7D1bBaFVywrSwoZi18BIGiFFEmtKJ0iy03/uhQn4EwmLbtCCArJY8FS2yVVM7ME1tzWZhGtRCJYlLworyuKHWKXWQOndmsADuu0+D9stFQjOgpHuPdMxcD0Ap6zEhzWcaRPJfqE2s077XuXkKxEt9DwB3zA2TXAVBKGgxuXyXyWRunZRSycCgNzeOs8CLb/63o/wmF++qLMZMvU/FetaxcMYark5g2Hu4pdiM2p894zTEz8LgXGjDyuL9oC4kZ3Eta5MVwWvScYAUdAaP6tO8IW9J9mMRTe9bnrE0u0hIYkLGRGLihImEIWM1Gh8d1ryWTnB9OMKltOZ6OBiOT46RmZEBjOMW5+fnv2dm5yAuAfh5TPzf8np96eKLX/y/PvCBD2ykvV8u2R/30z7+OHAA3kaWQDk2PvPMM+k/fPbZ4QNmGwDL/Odf/fZv//Z/d+nSpfHB6YNLFwn/1cX5+Q0axtnf9RcO1gd3HmHitYNj2+YJD7jFvekc96YL3B9HXGCLrW13ShPbsaZt+b9zdbxE/O5OTfPGUot1lxVbT0b1Ps0NIatG1pYmsnmRXCpCwopNriIsE2FV/f20eIajsldPnSHSLrO4vJoWIaVIMHYyCkJCHtlRAUv07k6PkaUoWE7ivu3NkiRGOdWL2p1+Lp1KK9i8510+S3JuJbFrhYV3f3pK3H6baPM6aW0CHAwdpo8r0tgJZGqDDKwRkS7vMTWjrXkO7uA+1sD1k7OE+qLDdQBCUmTSE77UOcmdgnf/kmAunY/sC0boxkCzJ13yq5euWAqXdJ4riUZEmQABkqTvryTRwSUbRs1PTNvsWwB9d7AI9GxHrKwFq2gM4GUj9ZmoBbBCuCq7ITlhoyqAMhkcDuaxy9K5s3msFEdYi4KFs2o/mRc/X2A3x88cARoOOOCqrXA5rfHocISrh4d2iGQrJJCkrVfpYnPxufM3Nv84JQATVpbSy/nB+f9w6dKlBw8ePFi9733vuxdP+v/7s89OMtcn/oT+MvybX7EzkD72sY/hQx/6UH7YjfHbL7zwZ3LOT68sb8xWCZNdHBwO/9bE6e9k0M4x4SJv7d60xev5Amd5i3NusZ195SntioFdnHQqD0LrzXKriBccuoNO9JlbWaR1nhZ1TfUkJiJi8yGIZn0zF9gyEdKei2adjCCLJ8VOLhI7tsYgW0QE7+nhNsvWlmNGfei+UFn+YOc47z83rMWoLlG7xsBKN8Cy5N5bjIaFQJq8I757WzRXqBUxGrofoU1F67hH4BLxBK7jow+6/oXKZpC8+mQNJ8o5MUKYo2t7u+9HCiXbk4TXeX+GhxRhpLe8JfMMfPasjR6lqyr+fRt3Q1uE4ptjlyA8b+Yjon0r3RrBZ0EZa/cObBM6rS1SHX1SCJ29TIPa4Wp/1vJnh2XMJILpaeZUZGbsNPm7h3UAcGgJV+wAjwxHeCQd4VJacW0Jlo2W7G+MF9vfwDAcksxMPFgxfeYb7t79lw/b55577rn0Az/wA7spy5/Ak/6+X/8/m/aeXy+gfLMAAAAASUVORK5CYII=";
  document.querySelectorAll("img.logo-image").forEach(img => {
    img.addEventListener("error", () => {
      if (img.dataset.logoFallbackApplied) return;
      img.dataset.logoFallbackApplied = "true";
      img.src = fallbackLogo;
    });
    if (img.complete && img.naturalWidth === 0) {
      img.dataset.logoFallbackApplied = "true";
      img.src = fallbackLogo;
    }
  });
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextDueDate(day) {
  const targetDay = Math.min(Number(day) || 1, 28);
  let due = new Date(today.getFullYear(), today.getMonth(), targetDay);
  if (due < dateOnly(today)) due = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
  return due;
}

function daysUntil(date) {
  return Math.ceil((dateOnly(date) - dateOnly(today)) / 86400000);
}

function formatDate(date) {
  const locale = interfaceLanguage === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function icsDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

function safeFileName(text) {
  return text.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
}

function cycleText(cycle) {
  return t(`cycle_${cycle}`) || cycle;
}

function cardLabel(card) {
  if (!card) return t("noCardSelected");
  const last4 = card.last4 ? ` • ${card.last4}` : "";
  return `${card.nickname || card.name}${last4}`;
}

function isCashCreditBenefit(benefit = {}) {
  const text = `${benefit.name || ""} ${benefit.notes || ""}`.toLowerCase();
  const value = Number(benefit.value || 0);
  if (value > 5000) return false;
  if (/welcome|bonus|points?|miles?|free night|night award|status|elite|priority pass|lounge|membership discount|companion fare|checked bag|tsa precheck|global entry/i.test(text)) {
    return /credit|statement credit|travelbank|cash|reimbursement|报销|抵扣/i.test(text);
  }
  return true;
}

function benefitCashValue(benefit = {}) {
  return isCashCreditBenefit(benefit) ? Math.max(0, Number(benefit.value || 0)) : 0;
}

function benefitCashUsed(benefit = {}) {
  if (!isCashCreditBenefit(benefit)) return 0;
  return Math.min(benefitCashValue(benefit), Math.max(0, Number(benefit.used || 0)));
}

function benefitCashRemaining(benefit = {}) {
  return Math.max(0, benefitCashValue(benefit) - benefitCashUsed(benefit));
}

function cycleDefaultEndDate(cycle = "") {
  const year = today.getFullYear();
  const month = today.getMonth();
  if (cycle === "monthly") return new Date(year, month + 1, 0);
  if (cycle === "quarterly") return new Date(year, Math.floor(month / 3) * 3 + 3, 0);
  if (cycle === "semiannual") return month < 6 ? new Date(year, 5, 30) : new Date(year, 11, 31);
  if (cycle === "calendar") return new Date(year, 11, 31);
  if (cycle === "anniversary") return new Date(year, month + 12, today.getDate());
  return null;
}

function benefitEffectiveDays(benefit = {}) {
  if (benefit.expires) return daysUntil(new Date(`${benefit.expires}T00:00:00`));
  const defaultDate = cycleDefaultEndDate(benefit.cycle);
  return defaultDate ? daysUntil(defaultDate) : 999;
}

function benefitEffectiveEndDate(benefit = {}) {
  if (benefit.expires) return new Date(`${benefit.expires}T00:00:00`);
  return cycleDefaultEndDate(benefit.cycle);
}

function isBenefitExpired(benefit = {}) {
  return benefitEffectiveDays(benefit) < 0;
}

function benefitDueLabel(benefit = {}) {
  const effectiveDate = benefitEffectiveEndDate(benefit);
  if (benefit.expires) return benefit.expires;
  if (effectiveDate) return `${formatDate(effectiveDate)} ${interfaceLanguage === "zh" ? "（系统按周期估算）" : "(estimated by cycle)"}`;
  return t("notSet");
}

function benefitInstallmentValue(benefit = {}) {
  const value = Number(benefit.value || 0);
  if (!value) return 0;
  if (benefit.cycle === "monthly") return Math.round(value / 12);
  if (benefit.cycle === "quarterly") return Math.round(value / 4);
  if (benefit.cycle === "semiannual") return Math.round(value / 2);
  return value;
}

function benefitDetailLines(benefit = {}) {
  const lines = [];
  const installment = benefitInstallmentValue(benefit);
  const cycleLabel = cycleText(benefit.cycle);
  if (benefit.cycle === "monthly") {
    lines.push(interfaceLanguage === "zh"
      ? `月度权益：总值 ${dollars(benefit.value)}，约 ${dollars(installment)}/月；未用额度通常不会滚存。`
      : `Monthly credit: total ${dollars(benefit.value)}, about ${dollars(installment)}/month; unused monthly value usually does not roll over.`);
  } else if (benefit.cycle === "quarterly") {
    lines.push(interfaceLanguage === "zh"
      ? `季度权益：总值 ${dollars(benefit.value)}，约 ${dollars(installment)}/季度；未用额度通常不会滚存。`
      : `Quarterly credit: total ${dollars(benefit.value)}, about ${dollars(installment)}/quarter; unused quarterly value usually does not roll over.`);
  } else if (benefit.cycle === "semiannual") {
    lines.push(interfaceLanguage === "zh"
      ? `半年度权益：总值 ${dollars(benefit.value)}，约 ${dollars(installment)}/半年；未用额度通常不会滚存。`
      : `Semiannual credit: total ${dollars(benefit.value)}, about ${dollars(installment)}/half-year; unused half-year value usually does not roll over.`);
  } else if (benefit.cycle === "calendar") {
    lines.push(interfaceLanguage === "zh"
      ? `自然年权益：总值 ${dollars(benefit.value)}；通常需要在 12 月 31 日前使用。`
      : `Calendar-year credit: total ${dollars(benefit.value)}; usually use by Dec 31.`);
  } else if (benefit.cycle === "anniversary") {
    lines.push(interfaceLanguage === "zh"
      ? `会员年权益：总值 ${dollars(benefit.value)}；按开卡/续卡周年重新计算。`
      : `Anniversary-year credit: total ${dollars(benefit.value)}; resets around the card anniversary.`);
  } else {
    lines.push(interfaceLanguage === "zh" ? `${cycleLabel}权益：请按账户条款确认使用窗口。` : `${cycleLabel} benefit: confirm the usage window in your account terms.`);
  }
  if (!benefit.expires) {
    const defaultDate = cycleDefaultEndDate(benefit.cycle);
    if (defaultDate) {
      lines.push(interfaceLanguage === "zh"
        ? `未设置到期日，系统按${cycleLabel}默认窗口估算到期优先级。`
        : `No expiration date set; priority is estimated from the ${cycleLabel.toLowerCase()} window.`);
    }
  }
  if (benefit.activation === "yes") {
    lines.push(interfaceLanguage === "zh" ? "需要先激活或选择偏好，否则可能无法触发报销。" : "Activation or benefit selection may be required before reimbursement triggers.");
  }
  if (benefit.tracking === "auto") {
    lines.push(interfaceLanguage === "zh" ? "追踪方式：可通过上传 statement 或交易识别自动匹配。" : "Tracking: can be matched from uploaded statements or transaction parsing.");
  } else if (benefit.tracking === "review") {
    lines.push(interfaceLanguage === "zh" ? "追踪方式：AI 可建议匹配，但建议人工确认。" : "Tracking: AI can suggest matches, but review is recommended.");
  } else {
    lines.push(interfaceLanguage === "zh" ? "追踪方式：建议手动记录使用情况。" : "Tracking: manual logging is recommended.");
  }
  if (benefit.notes) lines.push(benefit.notes);
  return lines;
}

function normalizeBenefitName(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/\$\s*\d[\d,]*(\.\d+)?/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function benefitDuplicateKey(benefit = {}) {
  return [
    benefit.cardId || "",
    normalizeBenefitName(benefit.name),
    benefit.cycle || "calendar"
  ].join("::");
}

function mergeDuplicateBenefit(base, incoming) {
  const baseUsed = Number(base.used || 0);
  const incomingUsed = Number(incoming.used || 0);
  const baseValue = Number(base.value || 0);
  const incomingValue = Number(incoming.value || 0);
  const notes = [base.notes, incoming.notes]
    .filter(Boolean)
    .filter((note, index, list) => list.indexOf(note) === index)
    .join("\n");
  return {
    ...base,
    name: base.name || incoming.name,
    value: Math.max(baseValue, incomingValue),
    used: Math.max(baseUsed, incomingUsed),
    expires: base.expires || incoming.expires || "",
    activation: base.activation === "yes" || incoming.activation === "yes" ? "yes" : (base.activation || incoming.activation || "no"),
    tracking: base.tracking === "auto" || incoming.tracking === "auto"
      ? "auto"
      : base.tracking === "review" || incoming.tracking === "review"
        ? "review"
        : (base.tracking || incoming.tracking || "manual"),
    notes
  };
}

function dedupeBenefits() {
  const seen = new Map();
  const removed = [];
  data.benefits.forEach(benefit => {
    const key = benefitDuplicateKey(benefit);
    if (!key.includes("::") || !normalizeBenefitName(benefit.name)) {
      seen.set(`${benefit.id || crypto.randomUUID()}::unique`, benefit);
      return;
    }
    if (!seen.has(key)) {
      seen.set(key, benefit);
      return;
    }
    const merged = mergeDuplicateBenefit(seen.get(key), benefit);
    seen.set(key, merged);
    removed.push(benefit);
  });
  if (removed.length) data.benefits = Array.from(seen.values());
  return removed;
}

function upsertLocalBenefit(benefit) {
  const existingIndex = data.benefits.findIndex(item => item.id === benefit.id);
  if (existingIndex >= 0) {
    data.benefits[existingIndex] = benefit;
    return { benefit, merged: false, removed: [] };
  }
  const duplicateIndex = data.benefits.findIndex(item => benefitDuplicateKey(item) === benefitDuplicateKey(benefit));
  if (duplicateIndex >= 0) {
    data.benefits[duplicateIndex] = mergeDuplicateBenefit(data.benefits[duplicateIndex], benefit);
    return { benefit: data.benefits[duplicateIndex], merged: true, removed: [benefit] };
  }
  data.benefits.push(benefit);
  return { benefit, merged: false, removed: [] };
}

function getBenefitOverlapInsights(limit = 3) {
  const groups = new Map();
  data.benefits.forEach(benefit => {
    const key = normalizeBenefitName(benefit.name);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(benefit);
  });
  return Array.from(groups.values())
    .map(items => {
      const cardIds = Array.from(new Set(items.map(item => item.cardId).filter(Boolean)));
      return {
        name: items[0]?.name || "",
        cardIds,
        remaining: items.reduce((sum, item) => sum + benefitCashRemaining(item), 0),
        used: items.reduce((sum, item) => sum + benefitCashUsed(item), 0)
      };
    })
    .filter(group => group.cardIds.length > 1)
    .sort((a, b) => b.remaining - a.remaining || b.used - a.used)
    .slice(0, limit);
}

function getTotals() {
  const annualFee = data.cards.reduce((sum, card) => sum + Number(card.annualFee || 0), 0);
  const usedValue = data.benefits.reduce((sum, benefit) => sum + benefitCashUsed(benefit), 0);
  const totalValue = data.benefits.reduce((sum, benefit) => sum + benefitCashValue(benefit), 0);
  const points = data.rewards.reduce((sum, reward) => sum + Number(reward.points || 0), 0);
  return { annualFee, usedValue, remainingValue: Math.max(0, totalValue - usedValue), totalValue, points };
}

function getAtRiskBenefits(daysWindow = 60) {
  return data.benefits
    .filter(benefit => benefitCashRemaining(benefit) > 0)
    .map(benefit => ({
      benefit,
      days: benefitEffectiveDays(benefit),
      remaining: benefitCashRemaining(benefit)
    }))
    .filter(item => item.days >= 0 && item.days <= daysWindow)
    .sort((a, b) => a.days - b.days || b.remaining - a.remaining);
}

function getRenewalReviewCards(daysWindow = 60) {
  return data.cards
    .map(card => ({ card, due: nextDueDate(card.dueDay), perf: cardPerformance(card) }))
    .filter(item => daysUntil(item.due) >= 0 && daysUntil(item.due) <= daysWindow && item.perf.recommendation !== "KEEP")
    .sort((a, b) => daysUntil(a.due) - daysUntil(b.due));
}

function recoveryPercent(usedValue, annualFee) {
  if (!annualFee) return usedValue > 0 ? 100 : 0;
  return Math.min(999, Math.round((Number(usedValue || 0) / Number(annualFee || 1)) * 100));
}

function cardPerformance(card) {
  const benefits = data.benefits.filter(benefit => benefit.cardId === card.id);
  const recovered = benefits.reduce((sum, benefit) => sum + benefitCashUsed(benefit), 0);
  const remaining = benefits.reduce((sum, benefit) => sum + benefitCashRemaining(benefit), 0);
  const annualFee = Number(card.annualFee || 0);
  const expected = recovered + remaining;
  const roi = recoveryPercent(recovered, annualFee);
  const net = expected - annualFee;
  let recommendation = "REVIEW";
  if (recovered <= 0 && annualFee > 0) recommendation = "REVIEW";
  else if (net >= annualFee * 0.2 || roi >= 100) recommendation = "KEEP";
  else if (expected < annualFee * 0.55) recommendation = "CANCEL";
  else if (expected < annualFee) recommendation = "DOWNGRADE";
  const reason = recommendation === "KEEP"
    ? "Expected value is likely to exceed the annual fee."
    : recommendation === "DOWNGRADE"
      ? "Expected value is below the annual fee unless remaining credits are used."
      : recommendation === "CANCEL"
        ? "Recorded benefits are far below the annual fee."
        : "More usage data is needed before renewal.";
  return { annualFee, recovered, remaining, expected, roi, net, recommendation, reason };
}

function cardRecommendationReason(card, perf = cardPerformance(card)) {
  if (interfaceLanguage === "zh") {
    if (perf.recommendation === "KEEP") {
      return `已追回 ${dollars(perf.recovered)}，年费 ${dollars(perf.annualFee)}，仍有 ${dollars(perf.remaining)} 可追回，预计全年净价值为正。`;
    }
    if (perf.recommendation === "DOWNGRADE") {
      return `除非继续使用剩余 ${dollars(perf.remaining)} 福利，否则预计价值低于年费。`;
    }
    if (perf.recommendation === "CANCEL") {
      return `已记录价值明显低于年费，除非非现金权益很重要，否则建议考虑关卡。`;
    }
    return `使用数据还不够充分，建议在续卡前继续追踪福利和消费。`;
  }
  if (perf.recommendation === "KEEP") {
    return `Recovered ${dollars(perf.recovered)} against a ${dollars(perf.annualFee)} fee, with ${dollars(perf.remaining)} still available. Expected full-year value is positive.`;
  }
  if (perf.recommendation === "DOWNGRADE") {
    return `Expected value is still below the annual fee unless the remaining ${dollars(perf.remaining)} is used before renewal.`;
  }
  if (perf.recommendation === "CANCEL") {
    return `Recorded value is far below the fee. Keep only if non-cash benefits are personally important.`;
  }
  return `More usage data is needed. Track credits and statement spend before the next renewal.`;
}

function getPriorityActions(limit = 5) {
  const benefitActions = data.benefits
    .filter(benefit => benefitCashRemaining(benefit) > 0)
    .map(benefit => {
      const effectiveDays = benefitEffectiveDays(benefit);
      const urgency = effectiveDays <= 14 ? 0 : effectiveDays <= 45 ? 1 : 2;
      return {
        type: "benefit",
        title: benefit.name,
        meta: interfaceLanguage === "zh"
          ? `${cardLabel(data.cards.find(card => card.id === benefit.cardId))} · 价值 ${dollars(benefitCashRemaining(benefit))}`
          : `${cardLabel(data.cards.find(card => card.id === benefit.cardId))} · ${dollars(benefitCashRemaining(benefit))} at risk`,
        tag: effectiveDays === 999 ? (interfaceLanguage === "zh" ? "未设置日期" : "Unused") : (interfaceLanguage === "zh" ? `${effectiveDays} 天后过期` : `${effectiveDays} days left`),
        days: effectiveDays === 999 ? null : effectiveDays,
        score: urgency * 1000 + effectiveDays - benefitCashRemaining(benefit)
      };
    });
  const renewalActions = data.cards.map(card => {
    const perf = cardPerformance(card);
    const due = nextDueDate(card.dueDay);
    const action = recommendationAction(perf.recommendation);
    return {
      type: "card",
      title: interfaceLanguage === "zh" ? `${cardLabel(card)} 续卡决策` : `${cardLabel(card)} renewal`,
      meta: interfaceLanguage === "zh" ? `${action.label} · ROI ${perf.roi}% · 预计价值 ${dollars(perf.expected)}` : `${action.label} · ROI ${perf.roi}% · expected ${dollars(perf.expected)}`,
      tag: interfaceLanguage === "zh" ? `${daysUntil(due)} 天后续费` : `renews in ${daysUntil(due)}d`,
      days: daysUntil(due),
      score: perf.recommendation === "CANCEL" ? 50 : perf.recommendation === "DOWNGRADE" ? 100 : 400
    };
  });
  return [...benefitActions, ...renewalActions].sort((a, b) => a.score - b.score).slice(0, limit);
}

function portfolioHealthScore() {
  const totals = getTotals();
  const roi = recoveryPercent(totals.usedValue, totals.annualFee);
  const atRisk = getAtRiskBenefits(60).reduce((sum, item) => sum + item.remaining, 0);
  const score = Math.max(0, Math.min(100, Math.round(Math.min(roi, 120) * 0.65 + (totals.remainingValue ? 20 : 10) - Math.min(atRisk / 50, 25))));
  return { score, atRisk, actions: getPriorityActions(10) };
}

// Qualitative band for the 0-100 portfolio health score.
function healthScoreBand(score) {
  const zh = interfaceLanguage === "zh";
  if (score >= 80) return zh ? "优秀" : "Excellent";
  if (score >= 60) return zh ? "良好" : "Good";
  if (score >= 40) return zh ? "一般" : "Fair";
  return zh ? "偏低" : "Low";
}

// Maps a card renewal recommendation to a clear action label + severity class.
function recommendationAction(rec = "") {
  const zh = interfaceLanguage === "zh";
  switch (String(rec).toUpperCase()) {
    case "KEEP": return { label: zh ? "建议保留" : "Keep", cls: "blue" };
    case "DOWNGRADE": return { label: zh ? "考虑降级" : "Downgrade", cls: "warn" };
    case "CANCEL": return { label: zh ? "考虑取消" : "Cancel", cls: "danger" };
    default: return { label: zh ? "继续观察" : "Review", cls: "warn" };
  }
}

function portfolioInsight() {
  const totals = getTotals();
  const health = portfolioHealthScore();
  const roi = recoveryPercent(totals.usedValue, totals.annualFee);
  const renewalReviews = getRenewalReviewCards(60);
  const net = totals.usedValue - totals.annualFee;
  const projectedNet = totals.usedValue + totals.remainingValue - totals.annualFee;
  return { totals, health, roi, renewalReviews, net, projectedNet };
}

function valueLabel(value) {
  return Number(value || 0) >= 0 ? `+${dollars(value)}` : `-${dollars(Math.abs(value))}`;
}

function estimatePointValue(program = "") {
  const text = String(program || "").toLowerCase();
  if (/amex|membership rewards|chase|ultimate rewards|capital one|miles/.test(text)) return 0.02;
  if (/hilton/.test(text)) return 0.005;
  return 0.01;
}

// Reward bonus categories the card rules actually carry rates for.
const REWARD_CATEGORIES = ["groceries", "dining", "gas_ev", "hotel", "flight", "travel", "services", "everyday"];

// Best-effort card-network inference (used for merchant acceptance checks).
// Prefers an explicit network from the AI reward rules / card; else guesses
// from the card/issuer name.
function cardNetwork(card = {}) {
  const explicit = card.network || card.rewardRules?.network;
  if (explicit) return String(explicit).toLowerCase().trim();
  const text = `${card.cardName || ""} ${card.issuer || ""} ${card.nickname || ""}`.toLowerCase();
  if (/amex|american express|membership reward|delta skymiles|platinum card|gold card|blue cash|hilton honors|bonvoy brilliant|business platinum|business gold|green card/.test(text)) return "amex";
  if (/discover/.test(text)) return "discover";
  if (/sapphire|venture|freedom|quicksilver|savorone|savor|\bink\b|united (explorer|club|quest)|southwest|aadvantage|world of hyatt|bonvoy (boundless|bountiful|bold)|\bvisa\b/.test(text)) return "visa";
  if (/mastercard|world elite|\bmc\b/.test(text)) return "mastercard";
  return "";
}

// Confident, hardcoded US merchant network rules (the AI insight covers the
// long tail). Returns { accepted, blocked } where either may be null.
function merchantNetworkRule(merchant = "") {
  const text = String(merchant).toLowerCase();
  if (/costco/.test(text)) return { accepted: ["visa"], blocked: null }; // Costco US: Visa only
  if (/restaurant depot|smart\s*&?\s*final|cash\s*&?\s*carry/.test(text)) return { accepted: null, blocked: ["amex"] };
  return { accepted: null, blocked: null };
}

// AI merchant insight cache (keyed by lowercased merchant) so we don't re-call.
const merchantInsightCache = new Map();

function optimizeWalletSpend(merchant = "", amount = 0, insight = null) {
  const category = (insight?.category && REWARD_CATEGORIES.includes(insight.category))
    ? insight.category
    : normalizeRewardCategory(merchant);
  const spend = Math.max(0, Number(amount || 0));
  const rule = merchantNetworkRule(merchant);
  const accepted = rule.accepted; // array or null
  const blocked = new Set([...(rule.blocked || []), ...((insight?.notAcceptedNetworks) || [])]);
  return data.cards
    .filter(card => getCardRewardRules(card).official)
    .map(card => {
      const rules = getCardRewardRules(card);
      const multiplier = Number(rules.rates?.[category] || rules.defaultRate || 1);
      const points = Math.round(spend * multiplier);
      const centsPerPoint = estimatePointValue(rules.program);
      const network = cardNetwork(card);
      // Only flag as not-accepted when we are confident about the card's network.
      let acceptedHere = true;
      if (network) {
        if (accepted && !accepted.includes(network)) acceptedHere = false;
        if (blocked.has(network)) acceptedHere = false;
      }
      return {
        card,
        category,
        multiplier,
        points,
        estimatedValue: points * centsPerPoint,
        program: rules.program || "Rewards",
        network,
        acceptedHere,
        condition: rules.conditions?.[category] || "",
        acceptNote: acceptedHere ? "" : `${merchant.trim()} 可能不接受 ${network.toUpperCase()} 卡`
      };
    })
    // Cards the merchant accepts come first, then by estimated value.
    .sort((a, b) =>
      (b.acceptedHere - a.acceptedHere) ||
      b.estimatedValue - a.estimatedValue ||
      b.multiplier - a.multiplier
    );
}

// Ask the Worker's AI to classify the merchant + acceptance + portal note.
// Returns null when AI is unavailable; results are cached per merchant.
async function fetchMerchantInsight(merchant) {
  const key = merchant.trim().toLowerCase();
  if (merchantInsightCache.has(key)) return merchantInsightCache.get(key);
  if (!automationSettings.workerUrl || !supabaseClient || !currentUser) return null;
  try {
    const token = (await supabaseClient.auth.getSession())?.data?.session?.access_token;
    if (!token) return null;
    const res = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/merchant-insight`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ merchant, ...aiRequestFields() })
    }, 20000);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.ok) return null;
    const insight = {
      category: String(payload.category || "").toLowerCase().trim(),
      notAcceptedNetworks: (payload.notAcceptedNetworks || []).map(n => String(n).toLowerCase().trim()),
      portalNote: String(payload.portalNote || "").trim()
    };
    merchantInsightCache.set(key, insight);
    return insight;
  } catch {
    return null;
  }
}

function render() {
  updateAuthVisibility();
  saveData();
  updateUserChrome();
  ensureDynamicButtons();
  applyLanguage();
  renderCardDrawer();
  renderBenefitDrawer();
  armTestButtonWatchdog();
  renderTemplateSelect();
  renderCardSelects();
  renderDashboard();
  renderCards();
  renderBenefits();
  renderRewards();
  renderAnalysis();
  renderReports();
  renderSettings();
}

function updateUserChrome() {
  const userLabel = currentUser?.user_metadata?.full_name || currentUser?.email || "未登录";
  const sidebarUserName = byId("sidebarUserName");
  if (sidebarUserName) sidebarUserName.textContent = userLabel;
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.toggle("menu-open", mobileMenuOpen);
  const mobileMenuButton = byId("mobileMenuButton");
  if (mobileMenuButton) {
    mobileMenuButton.textContent = interfaceLanguage === "zh" ? "菜单" : "Menu";
    mobileMenuButton.setAttribute("aria-expanded", String(mobileMenuOpen));
  }
}

function renderCardDrawer() {
  const drawer = byId("cardFormDrawer");
  if (!drawer) return;
  drawer.hidden = !cardFormOpen;
  document.querySelector(".cards-workspace")?.classList.toggle("drawer-open", cardFormOpen);
  const title = byId("cardDrawerTitle");
  if (title) title.textContent = byId("cardId").value ? t("editCard") : t("addEditCard");
}

function renderBenefitDrawer() {
  const drawer = byId("benefitFormDrawer");
  if (!drawer) return;
  drawer.hidden = !benefitFormOpen;
  document.querySelector(".benefits-workspace")?.classList.toggle("drawer-open", benefitFormOpen);
  const title = byId("benefitDrawerTitle");
  if (title) title.textContent = byId("benefitId").value ? t("editBenefit") : t("addBenefit");
}

const languageText = {
  zh: {
    brand: "薅卡管家",
    home: "首页",
    cards: "卡片",
    benefits: "福利",
    rewards: "积分",
    analysis: "AI 建议",
    wallet: "刷卡优化",
    reports: "总结",
    settings: "设置",
    account: "当前账户",
    signedOut: "未登录",
    signOut: "退出账户",
    today: "今天",
    test: "测试连接",
    reset: "恢复示例",
    eyebrow: "家庭信用卡福利管理",
    heroTitle: "今年有没有把年费薅回来？",
    portfolioQuestion: "年费回收进度",
    recoveryPositive: "今年已经覆盖年费，组合正在创造净价值。",
    recoveryGap: "还需要补用福利或优化消费，才能覆盖今年年费。",
    mostImportantActions: "最重要的行动",
    synced: "已同步",
    checkingLogin: "正在检查登录",
    totalAnnualFee: "总年费",
    usedBenefits: "已使用福利",
    remainingBenefits: "剩余可用报销",
    pointsBalance: "积分余额",
    upcomingReminders: "近期提醒",
    managePayments: "管理还款",
    expiringBenefits: "本月快到期福利",
    viewAll: "查看全部",
    portfolioOverview: "卡片投资组合",
    valueOverview: "组合价值概览",
    cardRetentionTitle: "每张卡是否值得保留",
    cardRetentionIntro: "按每张卡计算年费回收率、预计净价值，并给出 KEEP / REVIEW / DOWNGRADE / CANCEL 建议。",
    cardTitle: "我的信用卡",
    cardIntro: "添加卡片、设置账单日和还款提醒，也可以从常见卡模板开始。",
    addCard: "添加新卡",
    cardList: "卡片列表",
    done: "完成",
    editCard: "编辑信用卡",
    addEditCard: "添加信用卡",
    clear: "清空",
    saveCard: "保存卡片",
    expand: "展开",
    collapse: "收起",
    annualFee: "年费",
    holder: "持卡人",
    edit: "编辑",
    calendar: "日历提醒",
    emailDraft: "邮件草稿",
    reminderSettings: "提醒设置",
    delete: "删除"
    ,
    template: "卡片模板",
    issuer: "银行",
    cardName: "卡片名称",
    nickname: "昵称",
    last4: "尾号",
    dueDay: "还款到期日",
    remindDays: "提前提醒天数",
    reminderWay: "提醒方式",
    reminderEmail: "提醒邮箱",
    anniversary: "开卡 / 周年日期",
    notes: "备注",
    noCardSelected: "未选择卡片",
    benefitTitle: "福利追踪",
    benefitIntro: "按每月、半年、自然年或会员年追踪福利，新的周期会自动进入下一轮。",
    addBenefit: "添加福利",
    editBenefit: "编辑福利",
    benefitList: "福利清单",
    benefitStatusAll: "全部",
    benefitStatusOpen: "未薅完",
    benefitStatusDone: "已薅完",
    automationTitle: "自动化与 AI",
    automationIntro: "设置自动邮件提醒、AI API、模型质量、月度总结和 statement 解析。完整 API key 只发送到你的后端 Worker，不保存在浏览器里。",
    emailReminderTitle: "邮件提醒",
    aiApiTitle: "AI API Key",
    aiProvider: "AI Provider",
    aiMode: "AI Mode",
    apiKey: "API Key",
    workerUrl: "Cloudflare Worker URL",
    saveTestKey: "保存并测试 Key",
    testEmail: "发送测试邮件",
    sendRemindersNow: "测试：给我自己发一次",
    aiModeHelp: "当前默认模型：{model}。系统会按任务自动路由：Fast 处理解析，Balanced 处理日常分析，Advisor 处理续卡和高级顾问报告。",
    aiSummary: "AI 总结",
    generateSummary: "生成当前总结",
    advisorTitle: "AI 建议",
    advisorHeroTitle: "组合顾问中心",
    advisorRecommendations: "顾问建议",
    privacyFirst: "隐私优先",
    walletTitle: "刷卡优化",
    walletIntro: "输入商户或消费类别和金额，在付款前判断哪张卡最值得刷。",
    walletPanelTitle: "付款前选最佳卡",
    walletPrivacyPill: "无需连接银行",
    walletSubmit: "推荐最佳卡",
    filterByCard: "按卡筛选",
    allCards: "全部卡片",
    benefitCount: "项",
    remaining: "剩余",
    benefitCard: "所属卡片",
    benefitName: "福利名称",
    totalValue: "总价值",
    used: "已使用",
    cycle: "周期",
    expires: "到期日",
    activation: "是否需要激活",
    tracking: "追踪方式",
    instructions: "使用说明",
    saveBenefit: "保存福利",
    cycle_monthly: "每月",
    cycle_quarterly: "每季度",
    cycle_semiannual: "半年",
    cycle_calendar: "自然年",
    cycle_anniversary: "会员年",
    cycle_custom: "自定义",
    activationNo: "不需要",
    activationYes: "需要",
    trackingAuto: "自动交易识别",
    trackingReview: "自动建议 + 确认",
    trackingManual: "手动记录",
    trackingAutoShort: "自动追踪",
    trackingReviewShort: "建议确认",
    trackingManualShort: "手动",
    due: "到期",
    notSet: "未设置",
    requiresActivation: "需要激活",
    nonCashBenefit: "非现金权益",
    use: "使用",
    recordBenefitUse: "记录福利使用",
    usageAmount: "本次使用金额",
    cancel: "取消",
    saveUsage: "保存使用记录",
    noBenefitsFiltered: "当前筛选下没有福利。",
    noBenefits: "还没有福利。",
    expired: "已过期",
    expiredBenefitNote: "本周期已过期，未使用额度不能再记录；下一周期会重新开始追踪。",
    needOfficialRules: "需要 AI 获取官网规则",
    officialRulesOnly: "尚未保存官网/AI规则。请编辑卡片并点击“AI 获取福利模板”，系统会按当前官网资料生成福利和积分规则。",
    emailProviderMissing: "邮箱服务还没有配置：请在 Cloudflare Worker Variables 里添加 RESEND_API_KEY 和 FROM_EMAIL。",
    disclaimer: "Disclaimer：AI 总结、福利估值、优先级和续卡建议仅用于辅助管理，不构成财务、税务或法律建议。福利条款、年费、额度、适用商户和过期规则可能变化，请以银行官网、账户页面和 statement 实际入账为准。",
    aiQueueNote: "只显示前 6 项；按剩余价值、预计到期窗口和追踪难度排序。未显示的福利不是不重要，而是当前优先级较低。",
    aiQueueTitle: "AI 优先使用队列",
    benefitOverlapTitle: "重叠福利提醒",
    benefitOverlapNote: "同类权益出现在多张卡上，续卡时重点比较"
  },
  en: {
    brand: "Card Butler",
    home: "Dashboard",
    cards: "Cards",
    benefits: "Benefits",
    rewards: "Rewards",
    analysis: "AI Advisor",
    wallet: "Wallet Optimizer",
    reports: "Summary",
    settings: "Settings",
    account: "Signed in as",
    signedOut: "Not signed in",
    signOut: "Sign out",
    today: "Today",
    test: "Test connection",
    reset: "Restore demo",
    eyebrow: "Household credit card benefit management",
    heroTitle: "Are your annual fees paying for themselves?",
    portfolioQuestion: "Annual fee recovery",
    recoveryPositive: "Your portfolio has recovered its annual fees and is creating net value.",
    recoveryGap: "Use remaining credits or optimize spend to recover this year's annual fees.",
    mostImportantActions: "Most important actions",
    synced: "synced",
    checkingLogin: "Checking sign-in",
    totalAnnualFee: "Total annual fees",
    usedBenefits: "Used benefits",
    remainingBenefits: "Remaining credits",
    pointsBalance: "Points balance",
    upcomingReminders: "Upcoming reminders",
    managePayments: "Manage payments",
    expiringBenefits: "Benefits expiring this month",
    viewAll: "View all",
    portfolioOverview: "Card portfolio",
    valueOverview: "Portfolio value overview",
    cardRetentionTitle: "Should each card stay?",
    cardRetentionIntro: "Calculates annual fee recovery, projected net value, and KEEP / REVIEW / DOWNGRADE / CANCEL guidance for each card.",
    cardTitle: "My Cards",
    cardIntro: "Manage cards, statement dates, payment reminders, benefits, and reward rules.",
    addCard: "Add card",
    cardList: "Card list",
    done: "Done",
    editCard: "Edit card",
    addEditCard: "Add card",
    clear: "Clear",
    saveCard: "Save card",
    expand: "Expand",
    collapse: "Collapse",
    annualFee: "Annual fee",
    holder: "Holder",
    edit: "Edit",
    calendar: "Calendar",
    emailDraft: "Email draft",
    reminderSettings: "Reminder settings",
    delete: "Delete"
    ,
    template: "Card template",
    issuer: "Issuer",
    cardName: "Card name",
    nickname: "Nickname",
    last4: "Last 4",
    dueDay: "Payment due day",
    remindDays: "Reminder days before",
    reminderWay: "Reminder method",
    reminderEmail: "Reminder email",
    anniversary: "Opened / anniversary date",
    notes: "Notes",
    noCardSelected: "No card selected",
    benefitTitle: "Benefit tracking",
    benefitIntro: "Track monthly, semiannual, calendar-year, and anniversary-year credits. New cycles roll forward automatically.",
    addBenefit: "Add benefit",
    editBenefit: "Edit benefit",
    benefitList: "Benefit list",
    benefitStatusAll: "All",
    benefitStatusOpen: "Remaining",
    benefitStatusDone: "Used up",
    automationTitle: "Automation & AI",
    automationIntro: "Configure email reminders, AI API, model quality, monthly summaries, and statement parsing. Full API keys are sent only to your backend Worker and are not stored in the browser.",
    emailReminderTitle: "Email reminders",
    aiApiTitle: "AI API Key",
    aiProvider: "AI Provider",
    aiMode: "AI Mode",
    apiKey: "API Key",
    workerUrl: "Cloudflare Worker URL",
    saveTestKey: "Save and test key",
    testEmail: "Send test email",
    sendRemindersNow: "Test: send my reminders now",
    aiModeHelp: "Current default model: {model}. The system routes by task: Fast for parsing, Balanced for daily analysis, Advisor for renewal and advanced reports.",
    aiSummary: "AI Summary",
    generateSummary: "Generate summary",
    advisorTitle: "AI Advisor",
    advisorHeroTitle: "Advisor command center",
    advisorRecommendations: "Advisor recommendations",
    privacyFirst: "Privacy-first",
    walletTitle: "Wallet Optimizer",
    walletIntro: "Enter a merchant or category and amount to choose the best card before you pay.",
    walletPanelTitle: "Best card before purchase",
    walletPrivacyPill: "No bank login required",
    walletSubmit: "Find best card",
    filterByCard: "Filter by card",
    allCards: "All cards",
    benefitCount: "items",
    remaining: "remaining",
    benefitCard: "Card",
    benefitName: "Benefit name",
    totalValue: "Total value",
    used: "Used",
    cycle: "Cycle",
    expires: "Expiration date",
    activation: "Activation required",
    tracking: "Tracking method",
    instructions: "Notes",
    saveBenefit: "Save benefit",
    cycle_monthly: "Monthly",
    cycle_quarterly: "Quarterly",
    cycle_semiannual: "Semiannual",
    cycle_calendar: "Calendar year",
    cycle_anniversary: "Anniversary year",
    cycle_custom: "Custom",
    activationNo: "No",
    activationYes: "Yes",
    trackingAuto: "Automatic transaction matching",
    trackingReview: "AI suggestion + review",
    trackingManual: "Manual entry",
    trackingAutoShort: "Auto tracking",
    trackingReviewShort: "Review suggested",
    trackingManualShort: "Manual",
    due: "Due",
    notSet: "Not set",
    requiresActivation: "Activation required",
    nonCashBenefit: "Non-cash benefit",
    use: "Use",
    recordBenefitUse: "Record benefit use",
    usageAmount: "Amount used this time",
    cancel: "Cancel",
    saveUsage: "Save usage",
    noBenefitsFiltered: "No benefits match this filter.",
    noBenefits: "No benefits yet.",
    expired: "Expired",
    expiredBenefitNote: "This cycle has expired, so unused value cannot be logged. Tracking restarts in the next cycle.",
    needOfficialRules: "Needs AI official rules",
    officialRulesOnly: "No official/AI reward rules are saved yet. Edit the card and use AI Fetch Benefit Template so the system can use current issuer rules.",
    emailProviderMissing: "Email provider is not configured yet: add RESEND_API_KEY and FROM_EMAIL in Cloudflare Worker Variables.",
    disclaimer: "Disclaimer: AI summaries, benefit valuations, priority ranking, and renewal guidance are for organization only and are not financial, tax, or legal advice. Terms, fees, credits, eligible merchants, and expiration rules can change; verify against the issuer website, your account, and actual statement credits.",
    aiQueueNote: "Top 6 only; ranked by remaining value, estimated expiration window, and tracking effort. Hidden benefits are not ignored; they are simply lower priority right now.",
    aiQueueTitle: "AI Priority Queue",
    benefitOverlapTitle: "Overlapping benefits",
    benefitOverlapNote: "Compare cards that carry the same perk"
  }
};

function t(key) {
  return languageText[interfaceLanguage]?.[key] || languageText.zh[key] || key;
}

function applyLanguage() {
  const languageSelect = byId("languageSelect");
  if (languageSelect) languageSelect.value = interfaceLanguage;
  document.querySelectorAll(".brand strong").forEach(item => { item.textContent = t("brand"); });
  if (byId("mobileMenuButton")) byId("mobileMenuButton").textContent = interfaceLanguage === "zh" ? "菜单" : "Menu";
  const navMap = { dashboard: "home", cards: "cards", benefits: "benefits", rewards: "rewards", analysis: "analysis", wallet: "wallet", reports: "reports", settings: "settings" };
  Object.entries(navMap).forEach(([view, key]) => {
    const button = document.querySelector(`[data-view="${view}"]`);
    if (button) button.textContent = t(key);
  });
  const sidebarAccount = document.querySelector(".sidebar-account span");
  if (sidebarAccount) sidebarAccount.textContent = t("account");
  if (byId("sidebarUserName") && !currentUser) byId("sidebarUserName").textContent = t("signedOut");
  if (byId("signOutButton")) byId("signOutButton").textContent = t("signOut");
  const syncStatus = byId("syncStatus");
  if (syncStatus && currentUser && !syncStatus.classList.contains("warn")) {
    syncStatus.textContent = `${currentUser.email} ${t("synced")}`;
  } else if (syncStatus && !currentUser && !syncStatus.classList.contains("warn")) {
    syncStatus.textContent = t("checkingLogin");
  }
  const todayLabel = document.querySelector(".today-box span");
  if (todayLabel) todayLabel.textContent = t("today");
  const topEyebrow = document.querySelector(".topbar .eyebrow");
  if (topEyebrow) topEyebrow.textContent = t("eyebrow");
  const topTitle = document.querySelector(".topbar h1");
  if (topTitle) topTitle.textContent = t("heroTitle");
  const metricLabels = document.querySelectorAll(".metrics-grid .metric span");
  [t("totalAnnualFee"), t("usedBenefits"), t("remainingBenefits"), t("pointsBalance")].forEach((text, index) => {
    if (metricLabels[index]) metricLabels[index].textContent = text;
  });
  const reminderPanel = byId("reminderList")?.closest(".panel");
  const reminderTitle = reminderPanel?.querySelector(".panel-header h2");
  const reminderButton = reminderPanel?.querySelector(".panel-header button");
  if (reminderTitle) reminderTitle.textContent = t("upcomingReminders");
  if (reminderButton) reminderButton.textContent = t("managePayments");
  const expiringPanel = byId("expiringBenefits")?.closest(".panel");
  const expiringTitle = expiringPanel?.querySelector(".panel-header h2");
  const expiringButton = expiringPanel?.querySelector(".panel-header button");
  if (expiringTitle) expiringTitle.textContent = t("expiringBenefits");
  if (expiringButton) expiringButton.textContent = t("viewAll");
  const portfolioTitle = byId("cardOverview")?.closest(".panel")?.querySelector(".panel-header h2");
  if (portfolioTitle) portfolioTitle.textContent = t("cardRetentionTitle");
  if (byId("cardOverviewIntro")) byId("cardOverviewIntro").textContent = t("cardRetentionIntro");
  if (byId("valueFunnelTitle")) byId("valueFunnelTitle").textContent = t("valueOverview");
  const recoveryRingLabel = document.querySelector(".recovery-ring__inner span");
  if (recoveryRingLabel) recoveryRingLabel.textContent = interfaceLanguage === "zh" ? "年费回收率" : "Annual Fee Recovery";
  const advisorEyebrow = document.querySelector("#analysisView .advisor-hero .eyebrow");
  if (advisorEyebrow) advisorEyebrow.textContent = t("advisorTitle");
  const advisorHeroTitle = document.querySelector("#analysisView .advisor-hero h2");
  if (advisorHeroTitle) advisorHeroTitle.textContent = t("advisorHeroTitle");
  const advisorPanelTitle = document.querySelector("#advisorRecommendationList")?.closest(".panel")?.querySelector("h3");
  if (advisorPanelTitle) advisorPanelTitle.textContent = t("advisorRecommendations");
  const advisorPrivacy = document.querySelector("#advisorRecommendationList")?.closest(".panel")?.querySelector(".status-pill");
  if (advisorPrivacy) advisorPrivacy.textContent = t("privacyFirst");
  const zh = interfaceLanguage === "zh";
  if (byId("advisorRecoverableLabel")) byId("advisorRecoverableLabel").textContent = zh ? "可追回价值" : "Potential recoverable value";
  if (byId("advisorExpirationLabel")) byId("advisorExpirationLabel").textContent = zh ? "面临过期风险" : "At risk of expiring";
  if (byId("advisorActionLabel")) byId("advisorActionLabel").textContent = zh ? "待处理事项" : "Things to do";
  if (byId("walletTitle")) byId("walletTitle").textContent = t("walletTitle");
  if (byId("walletIntro")) byId("walletIntro").textContent = t("walletIntro");
  if (byId("walletPanelTitle")) byId("walletPanelTitle").textContent = t("walletPanelTitle");
  if (byId("walletPrivacyPill")) byId("walletPrivacyPill").textContent = t("walletPrivacyPill");
  if (byId("walletSubmitButton") && !byId("walletSubmitButton").disabled) byId("walletSubmitButton").textContent = t("walletSubmit");
  if (byId("testSyncButton")) byId("testSyncButton").textContent = t("test");
  if (byId("resetDemoButton")) byId("resetDemoButton").textContent = t("reset");
  if (byId("openCardFormButton")) byId("openCardFormButton").textContent = t("addCard");
  const cardTitle = document.querySelector("#cardsView .section-title h2");
  if (cardTitle) cardTitle.textContent = t("cardTitle");
  const cardIntro = document.querySelector("#cardsView .section-title p");
  if (cardIntro) cardIntro.textContent = t("cardIntro");
  const cardListTitle = document.querySelector(".cards-list-panel h3");
  if (cardListTitle) cardListTitle.textContent = t("cardList");
  if (byId("closeCardFormButton")) byId("closeCardFormButton").textContent = t("done");
  if (byId("clearCardFormButton")) byId("clearCardFormButton").textContent = t("clear");
  const saveButton = byId("cardForm")?.querySelector('button[type="submit"]');
  if (saveButton && !saveButton.disabled) saveButton.textContent = t("saveCard");
  const benefitTitle = document.querySelector("#benefitsView .section-title h2");
  if (benefitTitle) benefitTitle.textContent = t("benefitTitle");
  if (byId("openBenefitFormButton")) byId("openBenefitFormButton").textContent = t("addBenefit");
  const benefitIntro = document.querySelector("#benefitsView .section-title p");
  if (benefitIntro) benefitIntro.textContent = t("benefitIntro");
  const benefitListTitle = document.querySelector(".benefits-list-panel h3");
  if (benefitListTitle) benefitListTitle.textContent = t("benefitList");
  const benefitSegments = document.querySelectorAll("[data-benefit-status]");
  const benefitSegmentMap = { all: "benefitStatusAll", open: "benefitStatusOpen", done: "benefitStatusDone" };
  benefitSegments.forEach(button => { button.textContent = t(benefitSegmentMap[button.dataset.benefitStatus]); });
  setFieldLabel("benefitFilterCardSelect", t("filterByCard"));
  setFieldLabel("benefitFilterHolderSelect", interfaceLanguage === "zh" ? "按持卡人筛选" : "Filter by holder");
  setFieldLabel("cardHolderFilterSelect", interfaceLanguage === "zh" ? "按持卡人筛选" : "Filter by holder");
  if (byId("closeBenefitFormButton")) byId("closeBenefitFormButton").textContent = t("done");
  if (byId("clearBenefitFormButton")) byId("clearBenefitFormButton").textContent = t("clear");
  const benefitSaveButton = byId("benefitForm")?.querySelector('button[type="submit"]');
  if (benefitSaveButton && !benefitSaveButton.disabled) benefitSaveButton.textContent = t("saveBenefit");
  setFieldLabel("benefitCardSelect", t("benefitCard"));
  setFieldLabel("benefitNameInput", t("benefitName"));
  setFieldLabel("benefitValueInput", t("totalValue"));
  setFieldLabel("benefitCycleInput", t("cycle"));
  setFieldLabel("benefitExpiresInput", t("expires"));
  setFieldLabel("benefitActivationInput", t("activation"));
  setFieldLabel("benefitTrackingInput", t("tracking"));
  setFieldLabel("benefitNotesInput", t("instructions"));
  setSelectOptions("benefitCycleInput", {
    monthly: t("cycle_monthly"),
    quarterly: t("cycle_quarterly"),
    semiannual: t("cycle_semiannual"),
    calendar: t("cycle_calendar"),
    anniversary: t("cycle_anniversary"),
    custom: t("cycle_custom")
  });
  setSelectOptions("benefitActivationInput", { no: t("activationNo"), yes: t("activationYes") });
  setSelectOptions("benefitTrackingInput", {
    auto: t("trackingAuto"),
    review: t("trackingReview"),
    manual: t("trackingManual")
  });
  const benefitUseTitle = byId("benefitUseTitle");
  if (benefitUseTitle && !byId("benefitUseModal")?.hidden && byId("benefitUseId")?.value) {
    const benefit = data.benefits.find(item => item.id === byId("benefitUseId").value);
    benefitUseTitle.textContent = `${t("recordBenefitUse")}: ${benefit?.name || ""}`;
  } else if (benefitUseTitle) {
    benefitUseTitle.textContent = t("recordBenefitUse");
  }
  setFieldLabel("benefitUseAmountInput", t("usageAmount"));
  if (byId("cancelBenefitUseButton")) byId("cancelBenefitUseButton").textContent = t("cancel");
  const benefitUseSave = byId("benefitUseForm")?.querySelector('button[type="submit"]');
  if (benefitUseSave && !benefitUseSave.disabled) benefitUseSave.textContent = t("saveUsage");
  setFieldLabel("templateSelect", t("template"));
  setFieldLabel("issuerInput", t("issuer"));
  setFieldLabel("cardNameInput", t("cardName"));
  setFieldLabel("nicknameInput", t("nickname"));
  setFieldLabel("last4Input", t("last4"));
  setFieldLabel("holderInput", t("holder"));
  setFieldLabel("annualFeeInput", t("annualFee"));
  setFieldLabel("dueDayInput", t("dueDay"));
  setFieldLabel("remindDaysInput", t("remindDays"));
  setFieldLabel("reminderChannelInput", t("reminderWay"));
  setFieldLabel("reminderEmailInput", t("reminderEmail"));
  setFieldLabel("anniversaryInput", t("anniversary"));
  setFieldLabel("cardNotesInput", t("notes"));
  const settingsTitle = document.querySelector("#settingsView .section-title h2");
  if (settingsTitle) settingsTitle.textContent = t("automationTitle");
  const settingsIntro = document.querySelector("#settingsView .section-title p");
  if (settingsIntro) settingsIntro.textContent = t("automationIntro");
  const settingsPanels = document.querySelectorAll("#settingsView .panel h3");
  if (settingsPanels[0]) settingsPanels[0].textContent = t("emailReminderTitle");
  if (settingsPanels[1]) settingsPanels[1].textContent = t("aiApiTitle");
  if (settingsPanels[2]) settingsPanels[2].textContent = t("aiSummary");
  setFieldLabel("aiProviderInput", t("aiProvider"));
  setFieldLabel("aiModeInput", t("aiMode"));
  setFieldLabel("apiKeyInput", t("apiKey"));
  setFieldLabel("workerUrlInput", t("workerUrl"));
  const apiKeySaveButton = byId("apiKeyForm")?.querySelector('button[type="submit"]');
  if (apiKeySaveButton && !apiKeySaveButton.disabled) apiKeySaveButton.textContent = t("saveTestKey");
  if (byId("generateAiSummaryButton") && !byId("generateAiSummaryButton").disabled) byId("generateAiSummaryButton").textContent = t("generateSummary");
  if (byId("sendTestEmailButton") && !byId("sendTestEmailButton").disabled) byId("sendTestEmailButton").textContent = t("testEmail");
  if (byId("sendRemindersNowButton") && !byId("sendRemindersNowButton").disabled) byId("sendRemindersNowButton").textContent = t("sendRemindersNow");
  setSelectOptions("aiModeInput", {
    fast: interfaceLanguage === "zh" ? AI_ROUTER_MODES.fast.labelZh : AI_ROUTER_MODES.fast.labelEn,
    balanced: interfaceLanguage === "zh" ? AI_ROUTER_MODES.balanced.labelZh : AI_ROUTER_MODES.balanced.labelEn,
    advisor: interfaceLanguage === "zh" ? AI_ROUTER_MODES.advisor.labelZh : AI_ROUTER_MODES.advisor.labelEn
  });
  renderDisclaimers();
}

function renderDisclaimers() {
  document.querySelectorAll(".view").forEach(view => {
    let disclaimer = view.querySelector(":scope > .page-disclaimer");
    if (!disclaimer) {
      disclaimer = document.createElement("p");
      disclaimer.className = "page-disclaimer";
      view.appendChild(disclaimer);
    }
    disclaimer.textContent = t("disclaimer");
  });
}

function setFieldLabel(controlId, text) {
  const label = byId(controlId)?.closest("label");
  if (!label) return;
  const node = Array.from(label.childNodes).find(item => item.nodeType === Node.TEXT_NODE && item.textContent.trim());
  if (node) node.textContent = `${text}\n                `;
}

function setSelectOptions(controlId, labels = {}) {
  const select = byId(controlId);
  if (!select) return;
  Array.from(select.options).forEach(option => {
    if (Object.prototype.hasOwnProperty.call(labels, option.value)) {
      option.textContent = labels[option.value];
    }
  });
}

function renderTemplateSelect() {
  const select = byId("templateSelect");
  select.innerHTML = templates.map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.label)}</option>`).join("");
}

function ensureDynamicButtons() {
  if (!byId("fetchCardBenefitsButton")) {
    const clearButton = byId("clearCardFormButton");
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.id = "fetchCardBenefitsButton";
    button.textContent = "AI 获取福利模板";
    clearButton?.parentElement?.insertBefore(button, clearButton);
  }
  if (!byId("clearRewardFormButton")) {
    const rewardSubmit = byId("rewardForm")?.querySelector('button[type="submit"]');
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.id = "clearRewardFormButton";
    button.textContent = "清空";
    rewardSubmit?.parentElement?.insertBefore(button, rewardSubmit);
  }
  if (!byId("sendTestEmailButton")) {
    const reminderSubmit = byId("automationSettingsForm")?.querySelector('button[type="submit"]');
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.id = "sendTestEmailButton";
    button.textContent = t("testEmail");
    reminderSubmit?.parentElement?.insertBefore(button, reminderSubmit);
  }
  if (!byId("sendRemindersNowButton")) {
    const reminderSubmit = byId("automationSettingsForm")?.querySelector('button[type="submit"]');
    const button = document.createElement("button");
    button.className = "secondary-button";
    button.type = "button";
    button.id = "sendRemindersNowButton";
    button.textContent = t("sendRemindersNow");
    reminderSubmit?.parentElement?.insertBefore(button, reminderSubmit);
  }
  if (!byId("cardHolderFilterSelect")) {
    const panel = byId("cardsList")?.closest(".panel");
    const title = panel?.querySelector("h3");
    const filter = document.createElement("div");
    filter.className = "filter-strip holder-filter-strip";
    filter.innerHTML = `
      <label class="compact-field">${interfaceLanguage === "zh" ? "按持卡人筛选" : "Filter by holder"}
        <select id="cardHolderFilterSelect"></select>
      </label>
    `;
    title?.insertAdjacentElement("afterend", filter);
  }
  if (!byId("benefitFilterHolderSelect")) {
    const benefitFilter = byId("benefitFilterCardSelect")?.closest(".filter-strip");
    const label = document.createElement("label");
    label.className = "compact-field";
    label.innerHTML = `${interfaceLanguage === "zh" ? "按持卡人筛选" : "Filter by holder"}<select id="benefitFilterHolderSelect"></select>`;
    benefitFilter?.appendChild(label);
  }
}

function renderCardSelects() {
  const options = data.cards.map(card => `<option value="${escapeHtml(card.id)}">${escapeHtml(cardLabel(card))}</option>`).join("");
  const holders = Array.from(new Set(data.cards.map(card => (card.holder || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const holderOptions = `<option value="all">${escapeHtml(interfaceLanguage === "zh" ? "全部持卡人" : "All holders")}</option>${holders.map(holder => `<option value="${escapeHtml(holder)}">${escapeHtml(holder)}</option>`).join("")}`;
  byId("benefitCardSelect").innerHTML = options || "<option value=''>请先添加信用卡</option>";
  byId("rewardCardSelect").innerHTML = options || "<option value=''>请先添加信用卡</option>";
  byId("statementCardSelect").innerHTML = options || "<option value=''>请先添加信用卡</option>";
  byId("benefitFilterCardSelect").innerHTML = `<option value="all">${escapeHtml(t("allCards"))}</option>${options}`;
  byId("benefitFilterCardSelect").value = data.cards.some(card => card.id === benefitFilters.cardId) ? benefitFilters.cardId : "all";
  if (byId("benefitFilterCardSelect").value === "all") benefitFilters.cardId = "all";
  if (byId("cardHolderFilterSelect")) {
    byId("cardHolderFilterSelect").innerHTML = holderOptions;
    byId("cardHolderFilterSelect").value = holders.includes(cardFilters.holder) ? cardFilters.holder : "all";
    if (byId("cardHolderFilterSelect").value === "all") cardFilters.holder = "all";
  }
  if (byId("benefitFilterHolderSelect")) {
    byId("benefitFilterHolderSelect").innerHTML = holderOptions;
    byId("benefitFilterHolderSelect").value = holders.includes(benefitFilters.holder) ? benefitFilters.holder : "all";
    if (byId("benefitFilterHolderSelect").value === "all") benefitFilters.holder = "all";
  }
  const rewardCardFilter = byId("rewardFilterCardSelect");
  if (rewardCardFilter) {
    rewardCardFilter.innerHTML = `<option value="all">全部卡片</option>${options}`;
    rewardCardFilter.value = data.cards.some(card => card.id === rewardFilters.cardId) ? rewardFilters.cardId : "all";
    if (rewardCardFilter.value === "all") rewardFilters.cardId = "all";
  }
}

function renderSettings() {
  byId("emailReminderEnabledInput").value = automationSettings.emailReminderEnabled;
  // Default the reminder recipients to the signed-in account email until the
  // user sets their own (so reminders have somewhere to go out of the box).
  byId("defaultReminderEmailInput").value = automationSettings.defaultReminderEmail || currentUser?.email || "";
  if (byId("reminderChannelDefaultInput")) byId("reminderChannelDefaultInput").value = automationSettings.reminderChannel || "both";
  byId("paymentReminderDaysInput").value = automationSettings.paymentReminderDays;
  byId("benefitReminderDaysInput").value = automationSettings.benefitReminderDays;
  if (byId("benefitReminderDays2Input")) byId("benefitReminderDays2Input").value = automationSettings.benefitReminderDays2 ?? "";
  byId("weeklyDigestInput").value = automationSettings.weeklyDigest;
  byId("monthlyDigestInput").value = automationSettings.monthlyDigest;
  byId("aiProviderInput").value = automationSettings.aiProvider;
  if (byId("aiModeInput")) byId("aiModeInput").value = automationSettings.aiMode || automationSettings.aiQuality || "balanced";
  if (byId("aiModelInput")) byId("aiModelInput").value = automationSettings.aiModel || "";
  if (byId("aiBaseUrlInput")) byId("aiBaseUrlInput").value = automationSettings.aiBaseUrl || "";
  byId("workerUrlInput").value = automationSettings.workerUrl;
  let modeHelp = byId("aiModeHelp");
  if (!modeHelp && byId("apiKeyForm")) {
    modeHelp = document.createElement("div");
    modeHelp.id = "aiModeHelp";
    modeHelp.className = "form-help full-row";
    byId("apiKeyForm").insertBefore(modeHelp, byId("apiKeyForm").querySelector(".form-actions"));
  }
  if (modeHelp) {
    modeHelp.textContent = interfaceLanguage === "zh"
      ? `当前 Provider：${automationSettings.aiProvider}。系统按任务自动选模型：解析/检索用便宜档，高级建议才用强档。"模型名"留空＝用该 Provider 的默认；自定义 Provider 需填 Base URL。每个 Provider 各存一份 key。`
      : `Provider: ${automationSettings.aiProvider}. Models are auto-selected per task (cheap for parsing/lookup, strong only for advisor). Leave "Model" blank to use the provider default; custom providers need a Base URL. A key is stored per provider.`;
  }
  let router = byId("aiRouterPreview");
  if (!router && byId("apiKeyStatusList")) {
    router = document.createElement("div");
    router.id = "aiRouterPreview";
    router.className = "ai-router-grid";
    byId("apiKeyStatusList").insertAdjacentElement("beforebegin", router);
  }
  if (router) {
    router.innerHTML = Object.entries(AI_ROUTER_MODES).map(([id, item]) => {
      const active = (automationSettings.aiMode || "balanced") === id;
      const name = interfaceLanguage === "zh" ? item.labelZh : item.labelEn;
      const use = interfaceLanguage === "zh" ? item.descriptionZh : item.descriptionEn;
      return `
      <article class="${active ? "active" : ""}">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(use)}</small>
      </article>
    `; }).join("");
  }
  byId("apiKeyStatusList").innerHTML = apiKeyStatus.length ? apiKeyStatus.map(item => `
    <article class="list-item">
      <strong>${escapeHtml(item.provider)}</strong>
      <div class="item-meta">${escapeHtml(item.message)}</div>
    </article>
  `).join("") : empty("还没有保存 AI key。请先部署 Worker，再保存并测试。");
}

function buildLocalAiSummary() {
  const totals = getTotals();
  const unused = data.benefits
    .filter(benefit => benefitCashRemaining(benefit) > 0)
    .sort((a, b) => benefitCashRemaining(b) - benefitCashRemaining(a))
    .slice(0, 5);
  const weakCards = data.cards.map(card => {
    const benefits = data.benefits.filter(benefit => benefit.cardId === card.id);
    const used = benefits.reduce((sum, benefit) => sum + benefitCashUsed(benefit), 0);
    return { card, used, gap: Number(card.annualFee || 0) - used };
  }).filter(item => item.gap > 0).sort((a, b) => b.gap - a.gap);
  const rewardCategories = data.rewards.reduce((map, reward) => {
    map[reward.category || "未分类"] = (map[reward.category || "未分类"] || 0) + Number(reward.points || 0);
    return map;
  }, {});
  const text = [
    `今年已记录年费 ${dollars(totals.annualFee)}，已使用福利 ${dollars(totals.usedValue)}，剩余福利 ${dollars(totals.remainingValue)}。`,
    weakCards.length ? `最需要关注的卡：${weakCards.slice(0, 3).map(item => `${cardLabel(item.card)} 还差 ${dollars(item.gap)} 回本`).join("；")}。` : "目前记录内的卡都已经接近或超过年费价值。",
    unused.length ? `优先使用的福利：${unused.map(benefit => `${benefit.name} 剩余 ${dollars(benefitCashRemaining(benefit))}`).join("；")}。` : "当前没有未用完的已计价福利。",
    Object.keys(rewardCategories).length ? `点数来源集中在：${Object.entries(rewardCategories).map(([category, points]) => `${category} ${number(points)} 点`).join("；")}。` : "还没有足够的积分记录可归纳。"
  ].join("\n");
  return { text, totals, unusedCount: unused.length, generatedAt: new Date().toISOString() };
}

function renderAiSummary(summary) {
  byId("aiSummaryResult").innerHTML = `
    <div class="list-item">
      <strong>当前总结</strong>
      <div class="item-meta">${escapeHtml(summary.text).replace(/\n/g, "<br>")}</div>
    </div>
  `;
}

function renderDashboard() {
  const { totals, health, roi, renewalReviews, projectedNet } = portfolioInsight();
  const atRiskItems = getAtRiskBenefits(60);
  const recoveryGap = Math.max(0, totals.annualFee - totals.usedValue);
  const topActions = getPriorityActions(3);
  byId("todayText").textContent = formatDate(today);
  if (byId("portfolioQuestion")) byId("portfolioQuestion").textContent = interfaceLanguage === "zh" ? "AI 执行摘要" : "AI Executive Summary";
  if (byId("portfolioHeroTitle")) byId("portfolioHeroTitle").textContent = interfaceLanguage === "zh" ? `你的信用卡投资组合健康度：${health.score} / 100` : `Credit card portfolio health: ${health.score} / 100`;
  if (byId("portfolioHeroText")) {
    const summaryRows = interfaceLanguage === "zh"
      ? [
        ["今年已追回价值", dollars(totals.usedValue)],
        ["剩余可追回价值", dollars(totals.remainingValue)],
        ["存在过期风险价值", dollars(health.atRisk)],
        ["未来60天需要续卡评估", `${renewalReviews.length} 张`]
      ]
      : [
        ["Recovered this year", dollars(totals.usedValue)],
        ["Still recoverable", dollars(totals.remainingValue)],
        ["Expiration risk", dollars(health.atRisk)],
        ["Renewal reviews in 60 days", `${renewalReviews.length} cards`]
      ];
    const adviceTitle = interfaceLanguage === "zh" ? "AI 建议" : "AI recommendations";
    byId("portfolioHeroText").innerHTML = `
      <div class="executive-summary__grid">
        ${summaryRows.map(([label, value]) => `
          <span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>
        `).join("")}
      </div>
      <div class="executive-advice">
        <strong>${adviceTitle}</strong>
        <ol>
          ${topActions.map(action => `<li>${escapeHtml(action.title)} <span>${escapeHtml(action.meta)}</span></li>`).join("") || `<li>${interfaceLanguage === "zh" ? "目前没有紧急行动。" : "No urgent actions right now."}</li>`}
        </ol>
      </div>
    `;
  }
  if (byId("heroHealthScore")) byId("heroHealthScore").textContent = `${health.score} / 100`;
  if (byId("heroRecovered")) byId("heroRecovered").textContent = dollars(totals.usedValue);
  if (byId("heroRemaining")) byId("heroRemaining").textContent = dollars(totals.remainingValue);
  if (byId("heroAtRisk")) byId("heroAtRisk").textContent = dollars(health.atRisk);
  if (byId("heroRecoveryPercent")) byId("heroRecoveryPercent").textContent = `${roi}%`;
  document.querySelector(".recovery-ring")?.style.setProperty("--recovery", `${Math.min(roi, 100)}%`);
  byId("metricAnnualFee").textContent = dollars(totals.annualFee);
  byId("metricUsedValue").textContent = dollars(totals.usedValue);
  byId("metricRemainingValue").textContent = dollars(totals.remainingValue);
  byId("metricPoints").textContent = number(totals.points);
  byId("expiringBenefits")?.closest(".panel")?.setAttribute("hidden", "");
  byId("portfolioStatus").textContent = recoveryGap
    ? (interfaceLanguage === "zh" ? `还差 ${dollars(recoveryGap)} 回本` : `Recover ${dollars(recoveryGap)} more`)
    : (interfaceLanguage === "zh" ? `净回报 ${valueLabel(totals.usedValue - totals.annualFee)}` : `Net ROI ${valueLabel(totals.usedValue - totals.annualFee)}`);
  if (byId("cardPortfolioStatus")) byId("cardPortfolioStatus").textContent = interfaceLanguage === "zh" ? `预计净收益 ${valueLabel(projectedNet)}` : `Projected net ${valueLabel(projectedNet)}`;

  if (byId("valueFunnel")) {
    const funnelItems = interfaceLanguage === "zh"
      ? [
        ["总年费", totals.annualFee],
        ["总潜在价值", totals.totalValue],
        ["已追回", totals.usedValue],
        ["待追回", totals.remainingValue],
        ["存在风险", health.atRisk],
        ["积分余额", totals.points, "points"]
      ]
      : [
        ["Annual fees", totals.annualFee],
        ["Total potential value", totals.totalValue],
        ["Recovered", totals.usedValue],
        ["Still recoverable", totals.remainingValue],
        ["At expiration risk", health.atRisk],
        ["Points balance", totals.points, "points"]
      ];
    byId("valueFunnel").innerHTML = funnelItems.map(([label, value, type], index) => `
      <article>
        <span>${escapeHtml(label)}</span>
        <strong>${type === "points" ? number(value) : dollars(value)}</strong>
        ${index > 0 && index < funnelItems.length - 1 ? "<small>↓</small>" : ""}
      </article>
    `).join("");
  }

  if (byId("priorityTitle")) byId("priorityTitle").textContent = t("mostImportantActions");
  if (byId("priorityActions")) {
    const actions = getPriorityActions(5);
    byId("priorityActions").innerHTML = actions.length ? actions.map(action => `
      <article class="priority-item">
        <div>
          <strong>${escapeHtml(action.title)}</strong>
          <div class="item-meta">${escapeHtml(action.meta)}</div>
        </div>
        <span class="tag warn">${escapeHtml(action.tag)}</span>
      </article>
    `).join("") : empty("No priority actions right now.");
  }

  const reminders = data.cards
    .map(card => ({ card, due: nextDueDate(card.dueDay) }))
    .sort((a, b) => a.due - b.due);

  const reminderList = byId("reminderList");
  if (reminderList) reminderList.innerHTML = reminders.length ? reminders.map(({ card, due }) => {
    const days = daysUntil(due);
    const urgent = days <= Number(card.remindDays || 0);
    return `
      <article class="list-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(cardLabel(card))}</strong>
            <div class="item-meta">${escapeHtml(card.issuer)} • 到期日 ${formatDate(due)}</div>
          </div>
          <span class="tag ${urgent ? "warn" : "blue"}">${days === 0 ? "今天到期" : `${days} 天后`}</span>
        </div>
        <div class="item-meta">提前 ${card.remindDays || 0} 天提醒；逾期提醒将在下一版接入手机推送。</div>
      </article>`;
  }).join("") : empty("还没有还款提醒。");

  const expiring = data.benefits
    .map(benefit => ({ benefit, days: benefitEffectiveDays(benefit) }))
    .filter(item => item.days >= 0 && item.days <= 45)
    .sort((a, b) => a.days - b.days);

  byId("expiringBenefits").innerHTML = expiring.length ? expiring.map(({ benefit, days }) => {
    const card = data.cards.find(item => item.id === benefit.cardId);
    return `
      <article class="list-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(benefit.name)}</strong>
            <div class="item-meta">${escapeHtml(cardLabel(card))} • ${t("remaining")} ${isCashCreditBenefit(benefit) ? dollars(benefitCashRemaining(benefit)) : t("nonCashBenefit")}</div>
          </div>
          <span class="tag ${days <= 14 ? "danger" : "warn"}">${days} 天</span>
        </div>
      </article>`;
  }).join("") : empty("未来 45 天没有快到期福利。");

  byId("cardOverview").innerHTML = data.cards.length ? data.cards.map(card => {
    const perf = cardPerformance(card);
    return `
      <article class="credit-card">
        <div class="card-title">
          <span class="item-meta">${escapeHtml(card.issuer)}</span>
          <strong>${escapeHtml(card.nickname || card.name)}</strong>
          <span class="item-meta">${escapeHtml(card.name)}${card.last4 ? ` • ${escapeHtml(card.last4)}` : ""}</span>
        </div>
        <div>
          <div class="item-bottom">
            <span>${interfaceLanguage === "zh" ? "已追回" : "Recovered"} ${dollars(perf.recovered)}</span>
            <span>${perf.roi}% ${interfaceLanguage === "zh" ? "回收率" : "Recovery"}</span>
          </div>
          <div class="progress"><span style="width:${Math.min(perf.roi, 100)}%"></span></div>
        </div>
        <div class="item-bottom">
          <span>${interfaceLanguage === "zh" ? "年费" : "Fee"} ${dollars(perf.annualFee)}</span>
          <span>${interfaceLanguage === "zh" ? "预计净值" : "Net"} ${valueLabel(perf.net)}</span>
        </div>
        <div class="advisor-note">${escapeHtml(perf.recommendation)} · ${escapeHtml(cardRecommendationReason(card, perf))}</div>
      </article>`;
  }).join("") : empty("先添加一张信用卡。");
}

function renderCards() {
  const visibleCards = data.cards.filter(card => cardFilters.holder === "all" || (card.holder || "").trim() === cardFilters.holder);
  byId("cardsList").innerHTML = visibleCards.length ? visibleCards.map(card => {
    const due = nextDueDate(card.dueDay);
    const ruleSummary = formatCardRewardRuleSummary(card);
    const expanded = expandedCardIds.has(card.id);
    const perf = cardPerformance(card);
    return `
      <article class="list-item card-list-item ${expanded ? "expanded" : ""}">
        <button class="card-collapse-button" type="button" data-toggle-card="${card.id}" aria-expanded="${expanded}">
          <div>
            <strong>${escapeHtml(cardLabel(card))}</strong>
            <div class="item-meta">${escapeHtml(card.issuer)} • ${escapeHtml(card.name)} • ROI ${perf.roi}% • Expected ${dollars(perf.expected)}</div>
          </div>
          <div class="card-list-side">
            <span class="tag ${perf.recommendation === "KEEP" ? "blue" : "warn"}">${perf.recommendation}</span>
            <span class="chevron">${expanded ? t("collapse") : t("expand")}</span>
          </div>
        </button>
        ${expanded ? `
          <div class="card-expanded-body">
            <div class="asset-metrics">
              <span><b>${dollars(perf.annualFee)}</b><small>Annual fee</small></span>
              <span><b>${dollars(perf.recovered)}</b><small>Recovered</small></span>
              <span><b>${dollars(perf.remaining)}</b><small>Remaining</small></span>
              <span><b>${valueLabel(perf.net)}</b><small>Net value</small></span>
            </div>
            <div class="advisor-note">
              <strong>${escapeHtml(perf.recommendation)}</strong>
              <div>${escapeHtml(cardRecommendationReason(card, perf))}</div>
            </div>
            <div class="item-meta">还款到期：每月 ${card.dueDay} 日，下一次 ${formatDate(due)}；提前 ${effectiveCardReminder(card).remindDays} 天提醒。</div>
            <div class="item-meta">提醒方式：${reminderChannelText(effectiveCardReminder(card).channel)}${effectiveCardReminder(card).inherited ? "（跟随全局）" : (effectiveCardReminder(card).emails ? ` • ${escapeHtml(effectiveCardReminder(card).emails)}` : "")}</div>
            <div class="rule-summary">
              <strong>${escapeHtml(ruleSummary.program)}</strong>
              <div class="item-meta">${escapeHtml(ruleSummary.rates)}</div>
              <div class="item-meta">${ruleSummary.sourceUrl ? `来源：<a href="${escapeHtml(ruleSummary.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(ruleSummary.sourceLabel)}</a>` : escapeHtml(ruleSummary.sourceLabel)}</div>
              <div class="item-meta">🕒 ${escapeHtml(cardFreshnessText(card))}</div>
            </div>
            <div class="row-actions">
              <button class="small-button" data-refresh-card="${card.id}">🔄 ${interfaceLanguage === "zh" ? "刷新福利" : "Refresh"}</button>
              <button class="small-button" data-edit-card="${card.id}">${t("edit")}</button>
              <button class="small-button" data-calendar-card="${card.id}">${t("calendar")}</button>
              <button class="small-button" data-delete-card="${card.id}">${t("delete")}</button>
            </div>
          </div>
        ` : ""}
      </article>`;
  }).join("") : empty(data.cards.length ? (interfaceLanguage === "zh" ? "当前持卡人筛选下没有卡片。" : "No cards match this holder filter.") : "还没有信用卡。");
}

function renderBenefits() {
  const removedDuplicates = dedupeBenefits();
  if (removedDuplicates.length) {
    saveData();
    Promise.all(removedDuplicates.map(benefit => deleteRemoteRow("benefits", benefit.id))).catch(error => {
      setSyncStatus(`重复福利已本地合并，云端清理失败：${error.message || "请稍后重试"}`, "warn");
    });
  }
  const filteredBenefits = data.benefits.filter(benefit => {
    const value = benefitCashValue(benefit);
    const used = benefitCashUsed(benefit);
    const expired = isBenefitExpired(benefit);
    const isDone = expired || (value === 0 ? used > 0 : used >= value);
    const card = data.cards.find(item => item.id === benefit.cardId);
    const cardMatches = benefitFilters.cardId === "all" || benefit.cardId === benefitFilters.cardId;
    const holderMatches = benefitFilters.holder === "all" || (card?.holder || "").trim() === benefitFilters.holder;
    const statusMatches =
      benefitFilters.status === "all" ||
      (benefitFilters.status === "open" && !isDone) ||
      (benefitFilters.status === "done" && isDone);
    return cardMatches && holderMatches && statusMatches;
  });

  const totalRemaining = filteredBenefits.reduce((sum, benefit) => sum + benefitCashRemaining(benefit), 0);
  byId("benefitFilterCount").textContent = `${filteredBenefits.length} ${t("benefitCount")} • ${t("remaining")} ${dollars(totalRemaining)}`;
  if (byId("benefitPriorityQueue")) {
    const priority = data.benefits
      .filter(benefit => benefitCashRemaining(benefit) > 0)
      .map(benefit => {
        const days = benefitEffectiveDays(benefit);
        const difficulty = benefit.tracking === "manual" ? 30 : benefit.tracking === "review" ? 15 : 0;
        return { benefit, days, score: (days > 120 ? 120 : days) + difficulty - benefitCashRemaining(benefit) / 8 };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);
    byId("benefitPriorityQueue").innerHTML = priority.length ? `
      <div class="priority-band__header">
        <div>
          <strong>${t("aiQueueTitle")}</strong>
          <span>${t("aiQueueNote")}</span>
        </div>
        <button class="small-button priority-toggle" type="button" data-toggle-priority>${mobilePriorityOpen ? t("collapse") : t("expand")}</button>
      </div>
      <div class="priority-band__items ${mobilePriorityOpen ? "mobile-open" : "mobile-collapsed"}">
        ${priority.map(({ benefit, days }) => `
          <article>
            <strong>${escapeHtml(benefit.name)}</strong>
            <span>${dollars(benefitCashRemaining(benefit))}</span>
            <small>${escapeHtml(cardLabel(data.cards.find(card => card.id === benefit.cardId)))} · ${days === 999 ? (interfaceLanguage === "zh" ? "未设置窗口" : "No window") : (interfaceLanguage === "zh" ? `${days} 天` : `${days} days`)} · ${escapeHtml(benefit.tracking || "review")}</small>
            <small>${escapeHtml(benefit.cycle === "monthly" ? (interfaceLanguage === "zh" ? "月度额度通常不滚存，月底前优先检查" : "Monthly credits usually do not roll over") : benefit.cycle === "semiannual" ? (interfaceLanguage === "zh" ? "半年度额度，分段使用" : "Semiannual window") : benefit.cycle === "quarterly" ? (interfaceLanguage === "zh" ? "季度额度，分段使用" : "Quarterly window") : (interfaceLanguage === "zh" ? "按当前周期估算优先级" : "Priority estimated from current cycle"))}</small>
          </article>
        `).join("")}
      </div>
    ` : "";
  }

  const priorityQueue = byId("benefitPriorityQueue");
  if (priorityQueue) {
    let overlapPanel = byId("benefitOverlapInsights");
    if (!overlapPanel) {
      overlapPanel = document.createElement("div");
      overlapPanel.id = "benefitOverlapInsights";
      overlapPanel.className = "benefit-overlap-insights";
      priorityQueue.insertAdjacentElement("afterend", overlapPanel);
    }
    const overlapInsights = getBenefitOverlapInsights();
    overlapPanel.hidden = !overlapInsights.length;
    overlapPanel.innerHTML = overlapInsights.length ? `
      <div class="priority-band__header">
        <strong>${t("benefitOverlapTitle")}</strong>
        <span>${t("benefitOverlapNote")}</span>
      </div>
      <div class="overlap-grid">
        ${overlapInsights.map(group => `
          <article>
            <strong>${escapeHtml(group.name)}</strong>
            <span>${interfaceLanguage === "zh" ? "剩余" : "Remaining"} ${dollars(group.remaining)}</span>
            <small>${group.cardIds.map(cardId => escapeHtml(cardLabel(data.cards.find(card => card.id === cardId)))).join(" · ")}</small>
          </article>
        `).join("")}
      </div>
    ` : "";
  }

  byId("benefitsList").innerHTML = filteredBenefits.length ? filteredBenefits.map(benefit => {
    const card = data.cards.find(item => item.id === benefit.cardId);
    const cashBenefit = isCashCreditBenefit(benefit);
    const value = benefitCashValue(benefit);
    const used = benefitCashUsed(benefit);
    const pct = value ? Math.min(100, Math.round((used / value) * 100)) : 100;
    const detailLines = benefitDetailLines(benefit);
    const expired = isBenefitExpired(benefit);
    const expanded = expandedBenefitIds.has(benefit.id);
    return `
      <article class="list-item benefit-list-item ${expanded ? "expanded" : ""}">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(benefit.name)}</strong>
            <div class="item-meta">${escapeHtml(cardLabel(card))} • ${cycleText(benefit.cycle)} • ${escapeHtml(benefit.tracking === "auto" ? t("trackingAutoShort") : benefit.tracking === "review" ? t("trackingReviewShort") : t("trackingManualShort"))}</div>
          </div>
          <span class="tag ${expired ? "danger" : cashBenefit && pct >= 100 ? "blue" : "warn"}">${expired ? t("expired") : cashBenefit ? `${dollars(used)} / ${dollars(value)}` : t("nonCashBenefit")}</span>
        </div>
        ${cashBenefit ? `<div class="progress"><span style="width:${pct}%"></span></div>` : ""}
        <div class="item-bottom">
          <span class="item-meta">${t("due")}: ${escapeHtml(benefitDueLabel(benefit))}${benefit.activation === "yes" ? ` • ${t("requiresActivation")}` : ""}</span>
          <div class="row-actions">
            <button class="small-button" data-use-benefit="${benefit.id}" ${expired ? "disabled" : ""}>+ ${t("use")}</button>
            <button class="small-button benefit-toggle-button" type="button" data-toggle-benefit-details="${benefit.id}">${expanded ? t("collapse") : t("expand")}</button>
          </div>
        </div>
        <div class="benefit-collapsible-detail">
          <div class="benefit-detail-box">
            ${expired ? `<p><strong>${escapeHtml(t("expiredBenefitNote"))}</strong></p>` : ""}
            ${detailLines.slice(0, 5).map(line => `<p>${escapeHtml(line)}</p>`).join("")}
          </div>
          ${cashBenefit ? `
            <div class="quick-log">
              <span>Quick Log</span>
              ${[25, 50, 75, 100].map(target => `
                <button class="small-button" type="button" data-quick-benefit="${benefit.id}" data-quick-percent="${target}" ${expired ? "disabled" : ""}>${target}%</button>
              `).join("")}
            </div>
          ` : ""}
          <div class="row-actions benefit-secondary-actions">
            <button class="small-button" data-reminder-benefit="${benefit.id}">${t("reminderSettings")}</button>
            <button class="small-button" data-edit-benefit="${benefit.id}">${t("edit")}</button>
            <button class="small-button" data-delete-benefit="${benefit.id}">${t("delete")}</button>
          </div>
        </div>
      </article>`;
  }).join("") : empty(data.benefits.length ? t("noBenefitsFiltered") : t("noBenefits"));
}

function renderRewards() {
  const categorySelect = byId("rewardFilterCategorySelect");
  const statusSelect = byId("rewardFilterStatusSelect");
  if (categorySelect) categorySelect.value = rewardFilters.category;
  if (statusSelect) statusSelect.value = rewardFilters.status;

  const filteredRewards = data.rewards.filter(reward => {
    const category = normalizeRewardCategory(`${reward.category || ""} ${reward.merchant || ""}`);
    const multiplier = Number(reward.multiplier || 1);
    const status = multiplier >= 3 ? "optimized" : "optimize";
    if (rewardFilters.cardId !== "all" && reward.cardId !== rewardFilters.cardId) return false;
    if (rewardFilters.category !== "all" && category !== rewardFilters.category) return false;
    if (rewardFilters.status === "uploaded" && !reward.uploadName) return false;
    if (rewardFilters.status === "manual" && reward.uploadName) return false;
    if (["optimized", "optimize"].includes(rewardFilters.status) && status !== rewardFilters.status) return false;
    return true;
  });

  const totalPoints = filteredRewards.reduce((sum, reward) => sum + Number(reward.points || 0), 0);
  const uploadedCount = filteredRewards.filter(reward => reward.uploadName).length;
  const optimizeCount = filteredRewards.filter(reward => Number(reward.multiplier || 1) < 3).length;
  if (byId("rewardSummary")) {
    byId("rewardSummary").innerHTML = `
      <span>记录 ${number(filteredRewards.length)}</span>
      <span>点数 ${number(totalPoints)}</span>
      <span>上传导入 ${number(uploadedCount)}</span>
      <span>可优化 ${number(optimizeCount)}</span>
    `;
  }

  const grouped = filteredRewards.reduce((map, reward) => {
    const card = data.cards.find(item => item.id === reward.cardId);
    const key = reward.cardId || "unknown";
    if (!map[key]) map[key] = { card, rewards: [] };
    map[key].rewards.push(reward);
    return map;
  }, {});

  const groups = Object.values(grouped);
  byId("rewardList").innerHTML = groups.length ? groups.map(group => {
    const cardPoints = group.rewards.reduce((sum, reward) => sum + Number(reward.points || 0), 0);
    const categoryText = Object.entries(group.rewards.reduce((map, reward) => {
      const category = normalizeRewardCategory(`${reward.category || ""} ${reward.merchant || ""}`);
      map[category] = (map[category] || 0) + Number(reward.points || 0);
      return map;
    }, {})).map(([category, points]) => `${category} ${number(points)} 点`).join(" · ");
    return `
      <article class="reward-card-group">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(cardLabel(group.card))}</strong>
            <div class="item-meta">${escapeHtml(categoryText || "暂无分类")} · ${number(group.rewards.length)} 条记录</div>
          </div>
          <span class="tag blue">${number(cardPoints)} 点</span>
        </div>
        <div class="stack-list compact-stack">
          ${group.rewards.map(reward => {
            const card = data.cards.find(item => item.id === reward.cardId);
            const best = Number(reward.multiplier || 1) >= 3 ? "已接近最大化" : "可优化";
            return `
              <article class="list-item reward-entry">
                <div class="item-top">
                  <div>
                    <strong>${number(reward.points)} ${escapeHtml(reward.program || "Rewards")}</strong>
                    <div class="item-meta">${escapeHtml(reward.merchant || "未填商户")} · ${escapeHtml(reward.category || "未分类")} · ${escapeHtml(cardLabel(card))}</div>
                  </div>
                  <span class="tag ${best === "已接近最大化" ? "blue" : "warn"}">${best}</span>
                </div>
                <div class="item-bottom">
                  <span class="item-meta">倍率 ${reward.multiplier || 1}x${reward.uploadName ? ` · 已上传 ${escapeHtml(reward.uploadName)}` : " · 手动记录"}</span>
                  <div class="row-actions">
                    <button class="small-button" data-edit-reward="${reward.id}">编辑</button>
                    <button class="small-button" data-delete-reward="${reward.id}">删除</button>
                  </div>
                </div>
              </article>`;
          }).join("")}
        </div>
      </article>`;
  }).join("") : empty(data.rewards.length ? "当前筛选下没有积分记录。" : "还没有积分记录。");
}

function renderReports() {
  const totals = getTotals();
  const cardReports = data.cards.map(card => {
    const benefits = data.benefits.filter(benefit => benefit.cardId === card.id);
    const usedValue = benefits.reduce((sum, benefit) => sum + benefitCashUsed(benefit), 0);
    const remainingValue = benefits.reduce((sum, benefit) => sum + benefitCashRemaining(benefit), 0);
    const rewardPoints = data.rewards.filter(reward => reward.cardId === card.id).reduce((sum, reward) => sum + Number(reward.points || 0), 0);
    const annualFee = Number(card.annualFee || 0);
    const unused = benefits
      .filter(benefit => benefitCashRemaining(benefit) > 0)
      .map(benefit => `${escapeHtml(benefit.name)} 还剩 ${dollars(benefitCashRemaining(benefit))}`);
    const verdict = usedValue >= annualFee
      ? "已接近或超过年费价值"
      : remainingValue > 0
        ? "还有福利可补用"
        : "需要重新评估续卡价值";
    return `
      <article class="list-item card-report">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(cardLabel(card))}</strong>
            <div class="item-meta">${escapeHtml([card.issuer, card.holder ? `持卡人 ${card.holder}` : ""].filter(Boolean).join(" · "))}</div>
          </div>
          <span class="tag ${usedValue >= annualFee ? "blue" : "warn"}">${verdict}</span>
        </div>
        <div class="summary-strip">
          <span>年费 ${dollars(annualFee)}</span>
          <span>已用福利 ${dollars(usedValue)}</span>
          <span>剩余 ${dollars(remainingValue)}</span>
          <span>积分 ${number(rewardPoints)}</span>
        </div>
        <div class="item-meta"><strong>还没用完：</strong>${unused.length ? unused.join("；") : "目前没有未用完的福利。"}</div>
      </article>
    `;
  });

  byId("yearReport").innerHTML = `
    <div class="summary-strip report-total-strip">
      <span>总年费 ${dollars(totals.annualFee)}</span>
      <span>已使用福利 ${dollars(totals.usedValue)}</span>
      <span>剩余福利价值 ${dollars(totals.remainingValue)}</span>
      <span>${totals.usedValue >= totals.annualFee ? "整体接近回本" : "整体还需要补用福利"}</span>
    </div>
    <div class="stack-list">${cardReports.length ? cardReports.join("") : empty("还没有卡片，添加卡片后这里会按每张卡生成总结。")}</div>`;

  byId("historyList").innerHTML = data.history.length ? data.history.map(item => {
    const itemRoi = recoveryPercent(item.usedValue, item.annualFee);
    const itemNet = Number(item.usedValue || 0) - Number(item.annualFee || 0);
    const annualAdvice = itemRoi >= 120 ? "Keep current portfolio" : itemRoi >= 80 ? "Review unused credits" : "Consider downgrades or cancellations";
    const cardArchive = Array.isArray(item.cards) && item.cards.length
      ? `<div class="stack-list compact-stack">${item.cards.map(card => `
          <div class="mini-report-row">
            <strong>${escapeHtml(card.label || "Card")}</strong>
            <span>年费 ${dollars(card.annualFee)} · 已用 ${dollars(card.usedValue)} · 剩余 ${dollars(card.remainingValue)}</span>
          </div>
        `).join("")}</div>`
      : "";
    return `
      <article class="list-item">
        <div class="item-top">
          <div>
            <strong>${item.year} Portfolio Performance</strong>
            <div class="item-meta">Annual portfolio snapshot for renewal, downgrade, and cancellation decisions.</div>
          </div>
          <span class="tag ${itemNet >= 0 ? "blue" : "warn"}">${annualAdvice}</span>
        </div>
        <div class="summary-strip">
          <span>Annual fees ${dollars(item.annualFee)}</span>
          <span>Recovered ${dollars(item.usedValue)}</span>
          <span>ROI ${itemRoi}%</span>
          <span>Net ${valueLabel(itemNet)}</span>
          <span>Unused ${dollars(item.remainingValue)}</span>
        </div>
        ${cardArchive}
      </article>
    `;
  }).join("") : empty("No portfolio history yet. Save an annual snapshot to compare year-over-year performance.");
}

function empty(text) {
  return `<div class="empty">${text}</div>`;
}

function reminderChannelText(channel) {
  return {
    calendar: "手机/日历提醒",
    email: "邮件提醒",
    both: "手机/日历 + 邮件提醒"
  }[channel] || "手机/日历提醒";
}

// Resolves a card's effective reminder config, expanding 'inherit' into the
// current global Settings so every screen shows the same live values.
function effectiveCardReminder(card) {
  const inherited = !card.reminderChannel || card.reminderChannel === "inherit";
  const channel = inherited ? (automationSettings.reminderChannel || "both") : card.reminderChannel;
  const remindDays = card.remindDays == null ? Number(automationSettings.paymentReminderDays || 7) : card.remindDays;
  const emails = (inherited || !card.reminderEmail)
    ? (automationSettings.defaultReminderEmail || currentUser?.email || "")
    : card.reminderEmail;
  return { inherited, channel, remindDays, emails };
}

// Shows/hides the per-card override fields based on the method selector, and
// when switching away from 'inherit' seeds them from the live global defaults.
function syncReminderFieldVisibility() {
  const channel = byId("reminderChannelInput")?.value;
  if (!channel) return;
  const inherit = channel === "inherit";
  const needsEmail = channel === "email" || channel === "both";
  byId("remindDaysField")?.toggleAttribute("hidden", inherit);
  byId("reminderEmailField")?.toggleAttribute("hidden", inherit || !needsEmail);
  const hint = byId("reminderInheritHint");
  if (hint) {
    hint.hidden = !inherit;
    if (inherit) {
      const r = effectiveCardReminder({ reminderChannel: "inherit", remindDays: null, reminderEmail: "" });
      hint.textContent = `跟随全局设置：${reminderChannelText(r.channel)} · 提前 ${r.remindDays} 天${(r.channel === "email" || r.channel === "both") ? ` · 发往 ${r.emails || "（请在设置页填提醒邮箱）"}` : ""}。在「设置」里统一调整。`;
    }
  }
}

function clearCardForm() {
  byId("cardForm").reset();
  byId("cardId").value = "";
  byId("templateSelect").value = "custom";
  syncReminderFieldVisibility();
  renderCardDrawer();
}

function openCardDrawer(cardId = "") {
  cardFormOpen = true;
  if (!cardId) clearCardForm();
  renderCardDrawer();
}

function closeCardDrawer() {
  cardFormOpen = false;
  renderCardDrawer();
}

function clearBenefitForm() {
  byId("benefitForm").reset();
  byId("benefitId").value = "";
  renderBenefitDrawer();
}

function openBenefitDrawer(benefitId = "") {
  benefitFormOpen = true;
  if (!benefitId) clearBenefitForm();
  renderBenefitDrawer();
}

function closeBenefitDrawer() {
  benefitFormOpen = false;
  renderBenefitDrawer();
}

function validViewName(name) {
  return ["dashboard", "cards", "benefits", "rewards", "analysis", "wallet", "reports", "settings"].includes(name) ? name : "dashboard";
}

function switchView(name, updateHash = true) {
  const viewName = validViewName(name);
  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  byId(`${viewName}View`).classList.add("active");
  // Highlight the active item in every nav (sidebar + mobile bottom bar).
  document.querySelectorAll(`[data-view="${viewName}"]`).forEach(el => el.classList.add("active"));
  mobileMenuOpen = false;
  document.querySelector(".sidebar")?.classList.remove("menu-open");
  byId("mobileMenuButton")?.setAttribute("aria-expanded", "false");
  if (updateHash && window.location.hash !== `#${viewName}`) {
    window.location.hash = viewName;
  }
}

byId("mobileMenuButton")?.addEventListener("click", () => {
  mobileMenuOpen = !mobileMenuOpen;
  updateUserChrome();
});

// Mobile bottom-bar "更多" opens the full grouped nav (advanced views + settings).
byId("bottomMoreButton")?.addEventListener("click", () => {
  mobileMenuOpen = !mobileMenuOpen;
  updateUserChrome();
  if (mobileMenuOpen) window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelectorAll("[data-view-jump]").forEach(button => {
  button.addEventListener("click", () => switchView(button.dataset.viewJump));
});

document.querySelectorAll("[data-auth-mode]").forEach(button => {
  button.addEventListener("click", () => showAuthMode(button.dataset.authMode));
});

byId("languageSelect").addEventListener("change", event => {
  interfaceLanguage = event.target.value === "en" ? "en" : "zh";
  localStorage.setItem(`${storeKey}:language`, interfaceLanguage);
  render();
});

document.querySelectorAll("[data-benefit-status]").forEach(button => {
  button.addEventListener("click", () => {
    benefitFilters.status = button.dataset.benefitStatus;
    document.querySelectorAll("[data-benefit-status]").forEach(item => {
      item.classList.toggle("active", item === button);
    });
    renderBenefits();
  });
});

byId("openCardFormButton").addEventListener("click", () => {
  switchView("cards");
  openCardDrawer();
});
byId("openBenefitFormButton").addEventListener("click", () => {
  switchView("benefits");
  openBenefitDrawer();
});
byId("clearCardFormButton").addEventListener("click", clearCardForm);

byId("reminderChannelInput").addEventListener("change", () => {
  // Seed empty override fields from the live global defaults when leaving inherit.
  if (byId("reminderChannelInput").value !== "inherit") {
    if (!byId("remindDaysInput").value) byId("remindDaysInput").value = automationSettings.paymentReminderDays;
    if (!byId("reminderEmailInput").value) byId("reminderEmailInput").value = automationSettings.defaultReminderEmail || currentUser?.email || "";
  }
  syncReminderFieldVisibility();
});
byId("closeCardFormButton").addEventListener("click", closeCardDrawer);
byId("closeBenefitFormButton").addEventListener("click", closeBenefitDrawer);
byId("clearBenefitFormButton").addEventListener("click", clearBenefitForm);

byId("benefitFilterCardSelect").addEventListener("change", event => {
  benefitFilters.cardId = event.target.value;
  renderBenefits();
});

document.addEventListener("change", event => {
  if (event.target.id === "cardHolderFilterSelect") {
    cardFilters.holder = event.target.value;
    renderCards();
  }
  if (event.target.id === "benefitFilterHolderSelect") {
    benefitFilters.holder = event.target.value;
    renderBenefits();
  }
});

document.addEventListener("click", event => {
  const priorityButton = event.target.closest("[data-toggle-priority]");
  if (priorityButton) {
    mobilePriorityOpen = !mobilePriorityOpen;
    renderBenefits();
    return;
  }

  const benefitToggle = event.target.closest("[data-toggle-benefit-details]");
  if (benefitToggle) {
    const benefitId = benefitToggle.dataset.toggleBenefitDetails;
    if (expandedBenefitIds.has(benefitId)) expandedBenefitIds.delete(benefitId);
    else expandedBenefitIds.add(benefitId);
    renderBenefits();
  }
});

byId("rewardFilterCardSelect").addEventListener("change", event => {
  rewardFilters.cardId = event.target.value;
  renderRewards();
});

byId("rewardFilterCategorySelect").addEventListener("change", event => {
  rewardFilters.category = event.target.value;
  renderRewards();
});

byId("rewardFilterStatusSelect").addEventListener("change", event => {
  rewardFilters.status = event.target.value;
  renderRewards();
});

byId("automationSettingsForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  automationSettings = {
    ...automationSettings,
    emailReminderEnabled: byId("emailReminderEnabledInput").value,
    defaultReminderEmail: byId("defaultReminderEmailInput").value.trim(),
    reminderChannel: byId("reminderChannelDefaultInput").value,
    paymentReminderDays: Number(byId("paymentReminderDaysInput").value || 0),
    benefitReminderDays: Number(byId("benefitReminderDaysInput").value || 0),
    benefitReminderDays2: byId("benefitReminderDays2Input").value.trim() === "" ? "" : Number(byId("benefitReminderDays2Input").value || 0),
    weeklyDigest: byId("weeklyDigestInput").value,
    monthlyDigest: byId("monthlyDigestInput").value,
    aiMode: byId("aiModeInput")?.value || automationSettings.aiMode || "balanced"
  };
  const validationError = validateAutomationSettings(automationSettings);
  if (validationError) {
    setSyncStatus(validationError, "warn");
    return;
  }
  setFormBusy(form, true, "保存中...");
  saveData();
  saveAutomationPreferences();
  await saveRemoteAutomationSettings();
  setSyncStatus("提醒设置已保存");
  setFormBusy(form, false);
});

byId("apiKeyForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const provider = byId("aiProviderInput").value;
  const apiKey = byId("apiKeyInput").value.trim();
  const workerUrl = byId("workerUrlInput").value.trim();
  automationSettings.aiProvider = provider;
  automationSettings.aiMode = byId("aiModeInput")?.value || "balanced";
  automationSettings.aiModel = byId("aiModelInput")?.value.trim() || "";
  automationSettings.aiBaseUrl = byId("aiBaseUrlInput")?.value.trim() || "";
  automationSettings.workerUrl = workerUrl;
  saveAutomationPreferences();
  if (!workerUrl) {
    setSyncStatus("请先填写 Cloudflare Worker URL。", "warn");
    return;
  }
  if (!apiKey) {
    setSyncStatus("请填写 API key。", "warn");
    return;
  }
  setFormBusy(form, true, "测试中...");
  try {
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    const health = await fetchWithTimeout(`${workerUrl.replace(/\/$/, "")}/health`, { method: "GET" }, 8000);
    if (!health.ok) throw new Error(`Worker health check failed: ${await health.text()}`);
    const response = await fetchWithTimeout(`${workerUrl.replace(/\/$/, "")}/api-keys`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ provider, apiKey })
    }, 12000);
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    apiKeyStatus = [{ provider, message: `已保存，末四位 ${payload.lastFour || apiKey.slice(-4)}。正在验证可用性...` }];
    saveCachedApiKeyStatus();
    byId("apiKeyInput").value = "";
    saveAutomationPreferences();
    await saveRemoteAutomationSettings();
    renderSettings();
    // Real validation: a tiny live call confirms the key + provider + model work.
    try {
      const testRes = await fetchWithTimeout(`${workerUrl.replace(/\/$/, "")}/test-key`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...aiRequestFields() })
      }, 25000);
      const testPayload = await testRes.json().catch(() => ({}));
      if (testRes.ok && testPayload.ok) {
        apiKeyStatus = [{ provider, message: `已保存并验证可用（模型 ${testPayload.model}）。完整 key 只在 Worker 后端。` }];
        setSyncStatus("AI key 已保存并验证可用");
      } else {
        apiKeyStatus = [{ provider, message: `已保存，但测试调用失败：${testPayload.error || "请检查模型名 / Base URL / 网络"}` }];
        setSyncStatus("AI key 已保存，但测试未通过", "warn");
      }
    } catch (testError) {
      apiKeyStatus = [{ provider, message: '已保存（测试调用超时或失败，可稍后用"AI 获取福利"验证）。' }];
      setSyncStatus("AI key 已保存（测试超时）", "warn");
    }
    saveCachedApiKeyStatus();
    renderSettings();
  } catch (error) {
    apiKeyStatus = [{ provider, message: error.message || "Worker 测试失败。" }];
    renderSettings();
    setSyncStatus(error.name === "AbortError" ? "Worker 请求超时，请检查 Secrets 和部署状态" : "AI key 测试失败", "warn");
  }
  setFormBusy(form, false);
});

byId("aiModeInput")?.addEventListener("change", event => {
  automationSettings.aiMode = event.target.value || "balanced";
  saveAutomationPreferences();
  renderSettings();
  setSyncStatus(`AI model: ${getAiModel()}`);
});

byId("generateAiSummaryButton").addEventListener("click", async event => {
  setButtonBusy(event.currentTarget, true, "生成中...");
  let summary = buildLocalAiSummary();
  if (automationSettings.workerUrl) {
    try {
      const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
      const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/ai-summary`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          cards: data.cards,
          benefits: data.benefits,
          rewards: data.rewards,
          localSummary: summary,
          summaryType: "advisor",
          ...aiRequestFields()
        })
      }, 12000);
      if (response.ok) summary = await response.json();
    } catch {
      setSyncStatus("AI Worker 不可用，已生成本地规则总结。", "warn");
    }
  }
  renderAiSummary(summary);
  await saveRemoteAiSummary(summary);
  setButtonBusy(event.currentTarget, false);
});

byId("statementParseForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = byId("statementFileInput").files[0];
  const validationError = validateUpload(file);
  if (validationError) {
    setSyncStatus(validationError, "warn");
    return;
  }
  setFormBusy(form, true, "解析中...");
  const isPdfFile = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  setSyncStatus(isPdfFile ? "PDF 正在解析，可能需要 30-120 秒..." : "Statement 正在解析...");
  let uploaded = { documentId: "", uploadName: file.name };
  try {
    if (!automationSettings.workerUrl) {
      throw new Error("请先在设置里保存 Cloudflare Worker URL，再上传解析。");
    }
    uploaded = await uploadPrivateDocument(file, byId("statementCardSelect").value);
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    if (!token) {
      throw new Error("登录状态已过期，请重新登录后再解析。");
    }
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/parse-statement`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        documentId: uploaded.documentId,
        cardId: byId("statementCardSelect").value,
        cardRules: getCardRewardRules(data.cards.find(card => card.id === byId("statementCardSelect").value)),
        ...aiRequestFields()
      })
    }, 120000);
    const responseText = await response.text();
    let result = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(`Worker 返回的不是 JSON：${responseText.slice(0, 240)}`);
    }
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || responseText || `Worker 解析失败，状态码 ${response.status}`);
    }
    const selectedCard = data.cards.find(card => card.id === byId("statementCardSelect").value);
    result = enrichStatementRewards(result, selectedCard);
    const analysis = buildStatementAnalysis(uploaded, result, selectedCard);
    saveStatementAnalysis(analysis);
    const importedCount = importParsedRewardEntries(result, uploaded);
    renderStatementParseResult(uploaded.uploadName, result);
    renderAnalysis();
    if (importedCount) {
      renderDashboard();
      renderRewards();
      setSyncStatus(`已解析并导入 ${importedCount} 条积分估算`);
    } else {
      setSyncStatus("解析完成，没有可导入的积分交易");
    }
    form.reset();
  } catch (error) {
    byId("statementParseResult").innerHTML = `<article class="list-item"><strong>解析失败</strong><div class="item-meta">${escapeHtml(error.message || "上传或解析失败。")}</div></article>`;
    setSyncStatus(error.name === "AbortError" ? "解析超时，请换小一点的 PDF 或先用 CSV" : "解析失败", "warn");
  }
  setFormBusy(form, false);
});

document.addEventListener("click", async event => {
  if (event.target.id !== "sendTestEmailButton") return;
  const to = byId("defaultReminderEmailInput").value.trim() || currentUser?.email || "";
  if (!automationSettings.workerUrl) {
    setSyncStatus("请先保存 Cloudflare Worker URL。", "warn");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    setSyncStatus("请先填写有效的默认提醒邮箱。", "warn");
    return;
  }
  setButtonBusy(event.target, true, "发送中...");
  try {
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    if (!token) throw new Error("请先登录。");
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/test-email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ to })
    }, 15000);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload.ok === false) throw new Error(payload.error || text || "测试邮件发送失败。");
    setSyncStatus(`测试邮件已发送到 ${to}`);
  } catch (error) {
    setSyncStatus(error.message || t("emailProviderMissing"), "warn");
  } finally {
    setButtonBusy(event.target, false);
  }
});

// Test helper only: runs the real reminder logic for the SIGNED-IN USER ONLY so
// you can verify delivery without waiting for the daily cron. The actual product
// feature is the automatic scheduled run; this button never touches other users.
document.addEventListener("click", async event => {
  if (event.target.id !== "sendRemindersNowButton") return;
  if (!automationSettings.workerUrl) {
    setSyncStatus("请先保存 Cloudflare Worker URL。", "warn");
    return;
  }
  setButtonBusy(event.target, true, "发送中...");
  try {
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    if (!token) throw new Error("请先登录。");
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/send-reminders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: "{}"
    }, 20000);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload.ok === false) throw new Error(payload.error || text || "发送提醒失败。");
    const sent = Number(payload.sent || 0);
    setSyncStatus(
      payload.message ? payload.message
      : sent > 0 ? `测试：已给你自己发送 ${sent} 封提醒，请检查收件箱（含垃圾邮件）。`
      : "测试：你当前没有到期的卡片或福利需要提醒（这是正常的）。"
    );
  } catch (error) {
    setSyncStatus(error.message || t("emailProviderMissing"), "warn");
  } finally {
    setButtonBusy(event.target, false);
  }
});

function renderWalletResults(merchant, amount, insight, loadingAI = false) {
  const results = optimizeWalletSpend(merchant, amount, insight).slice(0, 3);
  const banner = loadingAI
    ? `<div class="item-meta wallet-ai-note">🤖 正在用 AI 核实商户类别与受理情况…</div>`
    : (insight?.portalNote ? `<div class="item-meta accept-warning">ℹ️ ${escapeHtml(insight.portalNote)}</div>` : "");
  const cards = results.length ? results.map((result, index) => {
    const isTop = index === 0 && result.acceptedHere;
    return `
    <article class="list-item wallet-result ${isTop ? "best" : ""} ${result.acceptedHere ? "" : "not-accepted"}">
      <div class="item-top">
        <div>
          <strong>${isTop ? "Recommended: " : ""}${escapeHtml(cardLabel(result.card))}</strong>
          <div class="item-meta">${escapeHtml(result.category)} · ${escapeHtml(result.program)} · ${result.multiplier}x${result.network ? " · " + result.network.toUpperCase() : ""}</div>
        </div>
        <span class="tag ${isTop ? "blue" : "warn"}">${number(result.points)} pts</span>
      </div>
      ${result.acceptNote ? `<div class="item-meta accept-warning">⚠️ ${escapeHtml(result.acceptNote)}</div>` : ""}
      ${result.condition ? `<div class="item-meta wallet-condition">📍 ${escapeHtml(result.condition)}</div>` : ""}
      <div class="summary-strip">
        <span>Spend ${dollars(amount)}</span>
        <span>Estimated value ${dollars(result.estimatedValue)}</span>
        <span>${result.multiplier}x multiplier</span>
      </div>
    </article>`;
  }).join("") : empty("Add reward rules to cards before using Wallet Optimizer.");
  byId("walletOptimizerResult").innerHTML = banner + cards;
}

byId("walletOptimizerForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const merchant = byId("walletMerchantInput").value.trim();
  const amount = Number(byId("walletAmountInput").value || 0);
  if (!merchant || amount <= 0) {
    byId("walletOptimizerResult").innerHTML = empty("Enter a merchant/category and amount.");
    return;
  }
  // Instant result from local rules, then refine with the AI insight (cached).
  const cached = merchantInsightCache.get(merchant.toLowerCase()) || null;
  renderWalletResults(merchant, amount, cached, !cached);
  if (!cached) {
    const insight = await fetchMerchantInsight(merchant);
    renderWalletResults(merchant, amount, insight, false);
  }
});

function normalizeRewardCategory(value = "") {
  const text = String(value).toLowerCase();
  if (/grocery|groceries|supermarket|超市|买菜|生鲜|market|whole foods|trader joe|safeway|kroger|publix|aldi|wegmans|sprouts/.test(text)) return "groceries";
  if (/dining|restaurant|food|cafe|coffee|餐厅|吃饭|外卖|panera|starbucks|doordash|ubereats|uber eats|grubhub|resy|bar|brewery/.test(text)) return "dining";
  if (/\bgas\b|fuel|\bev\b|加油|充电|gas station|shell|chevron|exxon|mobil|\bbp\b|costco gas|chargepoint|evgo|electrify|supercharger/.test(text)) return "gas_ev";
  if (/hotel|lodging|accommodation|酒店|住宿|民宿|airbnb|vrbo|marriott|hilton|hyatt|ihg|wyndham|resort|motel/.test(text)) return "hotel";
  if (/flight|airline|airfare|机票|航班|delta|united|american airlines|southwest|jetblue|alaska air|spirit|frontier/.test(text)) return "flight";
  if (/travel|transit|taxi|parking|地铁|公交|交通|旅行|出行|uber|lyft|amtrak|train|rail|rental car|avis|hertz|cruise|tours?/.test(text)) return "travel";
  if (/subscription|streaming|digital|entertainment|订阅|服务|流媒体|netflix|spotify|hulu|disney|youtube|google|icloud|adobe|claude|openai|software|phone|internet|utilit/.test(text)) return "services";
  // Categories most cards earn only the base/everyday rate on:
  if (/cloth|apparel|fashion|衣服|服装|鞋|shoe|nike|uniqlo|zara|h&m|nordstrom|macy|department store|百货/.test(text)) return "everyday";
  if (/furnitur|家具|家居|home improvement|home depot|lowe'?s|ikea|wayfair|hardware|建材/.test(text)) return "everyday";
  if (/pharmac|drugstore|药店|药房|cvs|walgreens|rite aid/.test(text)) return "everyday";
  if (/online|网购|电商|amazon|walmart|target|best buy|ebay|warehouse|wholesale|costco|sam'?s club|bj'?s/.test(text)) return "everyday";
  return "everyday";
}

function isNonRewardTransaction(transaction = {}) {
  const text = `${transaction.merchant || ""} ${transaction.description || ""} ${transaction.category || ""}`.toLowerCase();
  return /payment|mobile payment|credit|refund|interest|fee|finance charge|returned|cash advance|付款|还款|退款|利息/.test(text);
}

function getCardRewardRules(card = {}) {
  if (card.rewardRules?.program || card.rewardRules?.rates) {
    return {
      program: card.rewardRules.program || "Rewards",
      network: card.rewardRules.network || "",
      defaultRate: Number(card.rewardRules.defaultRate || 1),
      rates: card.rewardRules.rates || {},
      conditions: card.rewardRules.conditions || {},
      sourceUrl: card.sourceUrls?.[0] || card.sourceUrl || "",
      official: true
    };
  }
  return {
    program: t("needOfficialRules"),
    network: "",
    defaultRate: 1,
    rates: {},
    conditions: {},
    sourceUrl: "",
    official: false
  };
}

function formatCardRewardRuleSummary(card = {}) {
  const rules = getCardRewardRules(card);
  const rates = { everyday: rules.defaultRate || 1, ...(rules.rates || {}) };
  const rateText = Object.entries(rates)
    .filter(([, rate]) => Number(rate) > 0)
    .map(([category, rate]) => `${category} ${rate}x`)
    .join(" · ");
  return {
    program: rules.program || "General Rewards",
    rates: rules.official ? (rateText || "everyday 1x") : t("officialRulesOnly"),
    sourceUrl: rules.sourceUrl || card.sourceUrls?.[0] || card.sourceUrl || "",
    sourceLabel: rules.official ? (interfaceLanguage === "zh" ? "官网 / AI 资料库" : "Official / AI rules") : t("needOfficialRules")
  };
}

function estimateTransactionReward(transaction, card) {
  const rules = getCardRewardRules(card);
  const category = normalizeRewardCategory(`${transaction.category || ""} ${transaction.merchant || ""} ${transaction.description || ""}`);
  if (isNonRewardTransaction(transaction)) {
    return { ...transaction, points: 0, multiplier: 0, category, rewardProgram: rules.program, note: transaction.note || "非赚点交易：付款、退款、利息或费用" };
  }
  const amount = Math.abs(Number(transaction.amount || 0));
  const multiplier = Number(rules.rates[category] || rules.defaultRate || 1);
  const estimatedPoints = Number(transaction.points || 0) > 0 ? Number(transaction.points) : Math.round(amount * multiplier);
  return {
    ...transaction,
    category,
    multiplier,
    points: estimatedPoints,
    rewardProgram: rules.program,
    note: transaction.note || `按 ${multiplier}x 估算`
  };
}

function enrichStatementRewards(result, card) {
  const transactions = (result.transactions || []).map(transaction => estimateTransactionReward(transaction, card));
  return {
    ...result,
    transactions,
    summary: summarizeParsedTransactions(transactions)
  };
}

function summarizeParsedTransactions(transactions) {
  return {
    transactionCount: transactions.length,
    totalAmount: transactions.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0),
    totalPoints: transactions.reduce((sum, item) => sum + Number(item.points || 0), 0),
    byCategory: transactions.reduce((map, item) => {
      const category = item.category || "everyday";
      map[category] = (map[category] || 0) + Math.abs(Number(item.amount || 0));
      return map;
    }, {})
  };
}

function evaluateBestCardForTransaction(transaction, usedCard) {
  const category = transaction.category || normalizeRewardCategory(`${transaction.merchant || ""} ${transaction.description || ""}`);
  if (isNonRewardTransaction({ ...transaction, category })) {
    return {
      ...transaction,
      category,
      usedCardId: usedCard?.id || "",
      bestCardId: usedCard?.id || "",
      bestCardLabel: "不建议追求点数",
      bestMultiplier: 0,
      bestPoints: 0,
      missedPoints: 0,
      verdict: "non_reward",
      advice: "付款、退款、利息或费用通常不产生点数。"
    };
  }

  const amount = Math.abs(Number(transaction.amount || 0));
  const usedRules = getCardRewardRules(usedCard);
  const usedMultiplier = Number(transaction.multiplier || usedRules.rates?.[category] || usedRules.defaultRate || 1);
  const usedPoints = Number(transaction.points || Math.round(amount * usedMultiplier));
  const candidates = data.cards.filter(card => getCardRewardRules(card).official).map(card => {
    const rules = getCardRewardRules(card);
    const multiplier = Number(rules.rates?.[category] || rules.defaultRate || 1);
    return {
      card,
      multiplier,
      points: Math.round(amount * multiplier),
      program: rules.program
    };
  }).sort((a, b) => b.points - a.points);

  const best = candidates[0] || { card: usedCard, multiplier: usedMultiplier, points: usedPoints, program: transaction.rewardProgram };
  const missedPoints = Math.max(0, Number(best.points || 0) - usedPoints);
  const verdict = missedPoints > 0 ? "optimize" : "best";
  return {
    ...transaction,
    category,
    multiplier: usedMultiplier,
    points: usedPoints,
    usedCardId: usedCard?.id || "",
    bestCardId: best.card?.id || "",
    bestCardLabel: cardLabel(best.card),
    bestMultiplier: best.multiplier,
    bestPoints: best.points,
    missedPoints,
    rewardProgram: transaction.rewardProgram || best.program,
    verdict,
    advice: verdict === "best"
      ? "这笔消费已经接近当前资料库里的最高回报。"
      : `这笔更适合刷 ${cardLabel(best.card)}，预计多 ${number(missedPoints)} 点。`
  };
}

function buildStatementAnalysis(uploaded, result, selectedCard) {
  const transactions = (result.transactions || []).map(transaction => evaluateBestCardForTransaction(transaction, selectedCard));
  const missedPoints = transactions.reduce((sum, item) => sum + Number(item.missedPoints || 0), 0);
  const optimizedCount = transactions.filter(item => item.verdict === "best").length;
  const issueCount = transactions.filter(item => item.verdict === "optimize").length;
  return {
    id: crypto.randomUUID(),
    documentId: uploaded.documentId,
    uploadName: uploaded.uploadName,
    cardId: selectedCard?.id || "",
    cardLabel: cardLabel(selectedCard),
    createdAt: new Date().toISOString(),
    summary: {
      ...(result.summary || {}),
      missedPoints,
      optimizedCount,
      issueCount
    },
    transactions
  };
}

function saveStatementAnalysis(analysis) {
  data.statementAnalyses = [
    analysis,
    ...(Array.isArray(data.statementAnalyses) ? data.statementAnalyses : []).filter(item => item.documentId !== analysis.documentId)
  ].slice(0, 30);
  saveData();
}

function renderAnalysis() {
  const totals = getTotals();
  const health = portfolioHealthScore();
  if (byId("advisorHealthScore")) byId("advisorHealthScore").textContent = number(health.score);
  if (byId("advisorScoreCaption")) byId("advisorScoreCaption").textContent = interfaceLanguage === "zh"
    ? `健康度${healthScoreBand(health.score)}（综合年费回收率、待用价值与过期风险）`
    : `${healthScoreBand(health.score)} · recovery rate, unused value & expiry risk`;
  if (byId("advisorRecoverableValue")) byId("advisorRecoverableValue").textContent = dollars(totals.remainingValue);
  if (byId("advisorExpirationRisk")) byId("advisorExpirationRisk").textContent = dollars(health.atRisk);
  if (byId("advisorActionCount")) byId("advisorActionCount").textContent = number(health.actions.length);
  if (byId("advisorRecommendationList")) {
    const insight = portfolioInsight();
    const portfolioTitle = interfaceLanguage === "zh" ? "组合统计摘要" : "Portfolio summary";
    const recoveryLabel = interfaceLanguage === "zh" ? "整体年费回收率" : "Overall recovery";
    const netLabel = interfaceLanguage === "zh" ? "预计净收益" : "Projected net";
    const riskLabel = interfaceLanguage === "zh" ? "过期风险" : "Expiration risk";
    const actionLabel = interfaceLanguage === "zh" ? "建议行动" : "Suggested actions";
    const positiveLabel = interfaceLanguage === "zh" ? "整体为正" : "Positive";
    const needsActionLabel = interfaceLanguage === "zh" ? "需要处理" : "Needs action";
    const portfolioReport = `
      <article class="advisor-report portfolio-analysis-report">
        <div class="item-top">
          <div>
            <strong>${portfolioTitle}</strong>
            <div class="item-meta">${recoveryLabel} ${insight.roi}% · ${netLabel} ${valueLabel(insight.projectedNet)} · ${riskLabel} ${dollars(health.atRisk)}</div>
          </div>
          <span class="tag ${insight.projectedNet >= 0 ? "blue" : "warn"}">${insight.projectedNet >= 0 ? positiveLabel : needsActionLabel}</span>
        </div>
        <div class="advisor-stat-grid">
          <span><small>${interfaceLanguage === "zh" ? "已追回" : "Recovered"}</small><b>${dollars(totals.usedValue)}</b></span>
          <span><small>${interfaceLanguage === "zh" ? "待追回" : "Remaining"}</small><b>${dollars(totals.remainingValue)}</b></span>
          <span><small>${riskLabel}</small><b>${dollars(health.atRisk)}</b></span>
          <span><small>${actionLabel}</small><b>${number(health.actions.length)}</b></span>
        </div>
      </article>
    `;
    const zh = interfaceLanguage === "zh";
    const cardReports = data.cards.map(card => {
      const perf = cardPerformance(card);
      const action = recommendationAction(perf.recommendation);
      return `
        <article class="advisor-report rec-${action.cls}">
          <div class="item-top">
            <div>
              <strong>${escapeHtml(cardLabel(card))}</strong>
              <div class="item-meta">${escapeHtml(card.issuer || "")} · ROI ${perf.roi}%</div>
            </div>
            <span class="tag ${action.cls}">${escapeHtml(action.label)}</span>
          </div>
          <div class="summary-strip">
            <span>${zh ? "年费" : "Fee"} ${dollars(perf.annualFee)}</span>
            <span>${zh ? "已回收" : "Recovered"} ${dollars(perf.recovered)}</span>
            <span>${zh ? "待使用" : "Remaining"} ${dollars(perf.remaining)}</span>
            <span>${zh ? "净收益" : "Net"} ${valueLabel(perf.net)}</span>
          </div>
          <div class="item-meta advisor-reason"><strong>${zh ? "建议" : "Advice"}：</strong>${escapeHtml(cardRecommendationReason(card, perf))}</div>
        </article>
      `;
    }).join("");
    const actionRows = health.actions.slice(0, 5).map(action => {
      const urgent = action.days != null && action.days <= 14;
      const soon = action.days != null && action.days <= 45;
      const tagCls = urgent ? "danger" : soon ? "warn" : "blue";
      const isBenefit = action.type === "benefit";
      const verb = isBenefit ? (zh ? "去使用" : "Use it") : (zh ? "做决策" : "Decide");
      const icon = isBenefit ? "🎁" : "🔁";
      return `
        <article class="priority-item ${urgent ? "urgent" : ""}">
          <div class="priority-main">
            <span class="priority-verb">${icon} ${verb}</span>
            <strong>${escapeHtml(action.title)}</strong>
            <div class="item-meta">${escapeHtml(action.meta)}</div>
          </div>
          <span class="tag ${tagCls}">${escapeHtml(action.tag)}</span>
        </article>
      `;
    }).join("");
    const bandTitle = zh ? "现在该做什么（按优先级）" : "What to do now (by priority)";
    const cardsTitle = zh ? "每张卡的续卡建议" : "Per-card renewal advice";
    byId("advisorRecommendationList").innerHTML = data.cards.length
      ? `${portfolioReport}
         <div class="advisor-section-title">${bandTitle}</div>
         <div class="priority-band">${actionRows || empty(zh ? "暂无待处理事项，全部用好了。" : "Nothing pending — all caught up.")}</div>
         <div class="advisor-section-title">${cardsTitle}</div>
         ${cardReports}`
      : empty("Add cards and benefits to generate an advisor report.");
  }

  const analyses = (Array.isArray(data.statementAnalyses) ? data.statementAnalyses : []).map(analysis => {
    const selectedCard = data.cards.find(card => card.id === analysis.cardId);
    const transactions = Array.isArray(analysis.transactions)
      ? analysis.transactions.map(transaction => evaluateBestCardForTransaction(transaction, selectedCard))
      : [];
    const missedPoints = transactions.reduce((sum, item) => sum + Number(item.missedPoints || 0), 0);
    const optimizedCount = transactions.filter(item => item.verdict === "best").length;
    const issueCount = transactions.filter(item => item.verdict === "optimize").length;
    return {
      ...analysis,
      cardLabel: selectedCard ? cardLabel(selectedCard) : analysis.cardLabel,
      summary: {
        ...(analysis.summary || {}),
        missedPoints,
        optimizedCount,
        issueCount
      },
      transactions
    };
  });
  const latest = analyses[0];
  const score = latest?.summary
    ? `${number(latest.summary.optimizedCount || 0)} 笔用对 · 少拿 ${number(latest.summary.missedPoints || 0)} 点`
    : "等待解析";
  if (byId("statementAnalysisScore")) byId("statementAnalysisScore").textContent = score;
  if (byId("statementAnalysisCount")) byId("statementAnalysisCount").textContent = `${analyses.length} 份记录`;

  if (byId("statementOptimizationList")) {
    byId("statementOptimizationList").innerHTML = latest
      ? latest.transactions.slice(0, 12).map(transaction => renderOptimizationRow(transaction)).join("")
      : empty("上传 statement 后，这里会显示每笔消费是否用对了卡。");
  }

  if (byId("statementHistoryList")) {
    byId("statementHistoryList").innerHTML = analyses.length ? analyses.map(analysis => `
      <article class="list-item">
        <div class="item-top">
          <div>
            <strong>${escapeHtml(analysis.uploadName || "Statement")}</strong>
            <div class="item-meta">${escapeHtml(analysis.cardLabel || "未选择卡片")} · ${formatDate(new Date(analysis.createdAt))}</div>
          </div>
          <span class="tag ${Number(analysis.summary?.missedPoints || 0) > 0 ? "warn" : "blue"}">少拿 ${number(analysis.summary?.missedPoints || 0)} 点</span>
        </div>
        <div class="summary-strip">
          <span>交易 ${number(analysis.summary?.transactionCount || analysis.transactions?.length || 0)}</span>
          <span>金额 ${dollars(analysis.summary?.totalAmount || 0)}</span>
          <span>点数 ${number(analysis.summary?.totalPoints || 0)}</span>
        </div>
        <div class="row-actions">
          <button class="small-button" data-view-analysis="${analysis.id}">查看</button>
          <button class="small-button" data-delete-analysis="${analysis.id}">删除</button>
        </div>
      </article>
    `).join("") : empty("还没有解析历史。");
  }

  if (byId("rewardRuleLibraryList")) {
    byId("rewardRuleLibraryList").innerHTML = data.cards.length ? data.cards.map(card => {
      const summary = formatCardRewardRuleSummary(card);
      const updatedText = card.sourceUpdatedAt ? ` · 更新 ${formatDate(new Date(card.sourceUpdatedAt))}` : "";
      const sourceLink = summary.sourceUrl
        ? `<a href="${escapeHtml(summary.sourceUrl)}" target="_blank" rel="noreferrer">官网来源</a>`
        : "本地规则";
      return `
        <article class="list-item">
          <div class="item-top">
            <div>
              <strong>${escapeHtml(cardLabel(card))}</strong>
              <div class="item-meta">${escapeHtml(summary.program || "Rewards")} · ${escapeHtml(card.issuer || "")}</div>
            </div>
            <span class="tag blue">规则库</span>
          </div>
          <div class="item-meta">${escapeHtml(summary.rates || "everyday 1x")}</div>
          <div class="item-meta">当前依据：${sourceLink}${escapeHtml(updatedText)}</div>
        </article>
      `;
    }).join("") : empty("先添加信用卡，资料库会显示每张卡的回报规则。");
  }
}

function renderOptimizationRow(transaction) {
  const tag = transaction.verdict === "non_reward" ? "blue" : transaction.verdict === "optimize" ? "warn" : "blue";
  const label = transaction.verdict === "non_reward" ? "不赚点" : transaction.verdict === "optimize" ? "可优化" : "用对了";
  return `
    <article class="list-item">
      <div class="item-top">
        <div>
          <strong>${escapeHtml(transaction.merchant || transaction.description || "未识别商户")}</strong>
          <div class="item-meta">${escapeHtml([transaction.date, transaction.category, `${transaction.multiplier || 0}x 当前卡`, `${transaction.bestMultiplier || 0}x 最佳卡`].filter(Boolean).join(" · "))}</div>
        </div>
        <span class="tag ${tag}">${label}</span>
      </div>
      <div class="item-meta">${escapeHtml(transaction.advice || "")}</div>
      <div class="summary-strip">
        <span>当前 ${number(transaction.points || 0)} 点</span>
        <span>最佳 ${number(transaction.bestPoints || 0)} 点</span>
        <span>差额 ${number(transaction.missedPoints || 0)} 点</span>
      </div>
    </article>
  `;
}

function importParsedRewardEntries(result, uploaded) {
  const newRewards = (result.transactions || [])
    .filter(transaction => Number(transaction.points || 0) > 0 && !isNonRewardTransaction(transaction))
    .filter(transaction => !data.rewards.some(reward =>
      reward.documentId === uploaded.documentId &&
      reward.merchant === (transaction.merchant || transaction.description || "") &&
      Number(reward.points || 0) === Number(transaction.points || 0)
    ))
    .map(transaction => ({
      id: crypto.randomUUID(),
      program: transaction.rewardProgram || "Estimated Rewards",
      points: Number(transaction.points || 0),
      merchant: transaction.merchant || transaction.description || "",
      category: transaction.category || "everyday",
      cardId: byId("statementCardSelect").value,
      multiplier: Number(transaction.multiplier || 1),
      uploadName: uploaded.uploadName,
      documentId: uploaded.documentId
    }));
  if (!newRewards.length) return 0;
  data.rewards.push(...newRewards);
  saveData();
  newRewards.forEach(reward => upsertRemoteReward(reward));
  return newRewards.length;
}

function renderStatementParseResult(uploadName, result = {}) {
  const summary = result.summary || {};
  const transactions = Array.isArray(result.transactions) ? result.transactions : [];
  const categoryRows = Object.entries(summary.byCategory || {})
    .slice(0, 6)
    .map(([category, amount]) => `<span class="mini-pill">${escapeHtml(category)} ${dollars(amount)}</span>`)
    .join("");
  const transactionRows = transactions.slice(0, 8).map(transaction => `
    <div class="statement-row">
      <div>
        <strong>${escapeHtml(transaction.merchant || transaction.description || "未识别商户")}</strong>
        <div class="item-meta">${escapeHtml([transaction.date, transaction.category, transaction.note].filter(Boolean).join(" · "))}</div>
      </div>
      <div class="statement-row__amount">
        <strong>${dollars(Math.abs(Number(transaction.amount || 0)))}</strong>
        <div class="item-meta">${number(transaction.points || 0)} 点</div>
      </div>
    </div>
  `).join("");

  byId("statementParseResult").innerHTML = `
    <article class="list-item statement-result">
      <strong>${escapeHtml(uploadName)}</strong>
      <div class="item-meta">${escapeHtml(result.message || "解析完成。")}</div>
      <div class="summary-strip">
        <span>交易 ${number(summary.transactionCount || transactions.length)}</span>
        <span>金额 ${dollars(summary.totalAmount || 0)}</span>
        <span>点数 ${number(summary.totalPoints || 0)}</span>
      </div>
      ${categoryRows ? `<div class="pill-row">${categoryRows}</div>` : ""}
      ${transactionRows ? `<div class="statement-rows">${transactionRows}</div>` : `<div class="empty-note">没有识别到交易明细。请确认文件里有日期、商户、金额或点数字段。</div>`}
    </article>
  `;
}

byId("templateSelect").addEventListener("change", event => {
  const template = templates.find(item => item.id === event.target.value);
  if (!template || template.id === "custom") return;
  byId("issuerInput").value = template.issuer;
  byId("cardNameInput").value = template.name;
  byId("annualFeeInput").value = template.annualFee;
});

byId("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!supabaseClient) {
    setAuthMessage("请先填写 Supabase 配置。", "warn");
    return;
  }

  const email = byId("loginEmailInput").value.trim();
  const password = byId("loginPasswordInput").value;
  setAuthMessage("正在登录...");
  setFormBusy(form, true, "登录中...");

  const signInResult = await supabaseClient.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    setAuthMessage(signInResult.error.message, "warn");
    setFormBusy(form, false);
    return;
  }
  setAuthMessage("登录成功，正在同步资料...");
  setFormBusy(form, false);
});

byId("registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!supabaseClient) {
    setAuthMessage("请先填写 Supabase 配置。", "warn");
    return;
  }

  const email = byId("registerEmailInput").value.trim();
  const password = byId("registerPasswordInput").value;
  setAuthMessage("正在创建账户...");
  setFormBusy(form, true, "注册中...");
  const redirectUrl = getAuthRedirectUrl();
  const signUpResult = await supabaseClient.auth.signUp({
    email,
    password,
    options: redirectUrl ? { emailRedirectTo: redirectUrl } : undefined
  });
  if (signUpResult.error) {
    setAuthMessage(signUpResult.error.message, "warn");
    setFormBusy(form, false);
    return;
  }

  if (signUpResult.data.session) {
    setAuthMessage("注册成功，正在同步资料...");
  } else {
    setAuthMessage("已注册，请检查邮箱确认邮件。");
  }
  setFormBusy(form, false);
});

byId("resetForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!supabaseClient) {
    setAuthMessage("请先填写 Supabase 配置。", "warn");
    return;
  }

  const email = byId("resetEmailInput").value.trim();
  setAuthMessage("正在发送重设邮件...");
  setFormBusy(form, true, "发送中...");
  const redirectUrl = getAuthRedirectUrl();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(
    email,
    redirectUrl ? { redirectTo: redirectUrl } : undefined
  );
  if (error) {
    setAuthMessage(error.message, "warn");
    setFormBusy(form, false);
    return;
  }
  setAuthMessage("重设密码邮件已发送，请检查邮箱。");
  setFormBusy(form, false);
});

byId("updatePasswordForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!supabaseClient) {
    setAuthMessage("请先填写 Supabase 配置。", "warn");
    return;
  }
  setAuthMessage("正在保存新密码...");
  setFormBusy(form, true, "保存中...");
  const { error } = await supabaseClient.auth.updateUser({ password: byId("newPasswordInput").value });
  setFormBusy(form, false);
  if (error) {
    setAuthMessage(error.message, "warn");
    return;
  }
  setAuthMessage("新密码已保存，正在进入应用。");
  await loadRemoteData();
});

byId("signOutButton").addEventListener("click", async () => {
  if (!supabaseClient) return;
  setButtonBusy(byId("signOutButton"), true, "退出中...");
  await supabaseClient.auth.signOut();
  setButtonBusy(byId("signOutButton"), false);
});

byId("testSyncButton").addEventListener("click", async event => {
  if (!supabaseClient) {
    setSyncStatus("请先填写 Supabase 配置", "warn");
    return;
  }
  setButtonBusy(event.currentTarget, true, "测试中...");

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    setSyncStatus("请先登录再测试", "warn");
    setButtonBusy(event.currentTarget, false);
    return;
  }

  const { error } = await supabaseClient.from("cards").select("id").limit(1);
  if (error) {
    setSyncStatus(`连接失败：${error.message}`, "warn");
    setButtonBusy(event.currentTarget, false);
    return;
  }

  setSyncStatus("Supabase 连接正常");
  setButtonBusy(event.currentTarget, false);
});

byId("cardForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = byId("cardId").value || crypto.randomUUID();
  const existingCard = data.cards.find(item => item.id === id);
  const isNewCard = !data.cards.some(item => item.id === id);
  const card = {
    id,
    issuer: byId("issuerInput").value.trim(),
    name: byId("cardNameInput").value.trim(),
    nickname: byId("nicknameInput").value.trim(),
    last4: byId("last4Input").value.trim(),
    holder: byId("holderInput").value.trim(),
    annualFee: Number(byId("annualFeeInput").value || 0),
    dueDay: Number(byId("dueDayInput").value || 1),
    ...readCardReminderInputs(),
    anniversary: byId("anniversaryInput").value,
    notes: byId("cardNotesInput").value.trim(),
    rewardRules: existingCard?.rewardRules || null,
    sourceUrls: existingCard?.sourceUrls || [],
    officialName: existingCard?.officialName || ""
  };
  const validationError = validateCard(card);
  if (validationError) {
    setSyncStatus(validationError, "warn");
    return;
  }
  setFormBusy(form, true, "保存中...");
  const existingIndex = data.cards.findIndex(item => item.id === id);
  if (existingIndex >= 0) data.cards[existingIndex] = card;
  else {
    data.cards.push(card);
  }
  expandedCardIds.add(id);
  saveCardMetadata(card);
  clearCardForm();
  render();
  await upsertRemoteCard(card);
  if (isNewCard) {
    const newBenefits = data.benefits.filter(benefit => benefit.cardId === id);
    await Promise.all(newBenefits.map(upsertRemoteBenefit));
    if (!card.rewardRules) setSyncStatus("卡片已保存。请点击“AI 获取福利模板”获取当前官网福利和积分规则。", "warn");
  }
  setFormBusy(form, false);
});

byId("benefitForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const id = byId("benefitId").value || crypto.randomUUID();
  const benefit = {
    id,
    cardId: byId("benefitCardSelect").value,
    name: byId("benefitNameInput").value.trim(),
    value: Number(byId("benefitValueInput").value || 0),
    // Usage is logged via "记录使用" / quick-log, not the form, to avoid
    // double-entry. Keep the existing used amount when editing.
    used: Number(data.benefits.find(item => item.id === id)?.used || 0),
    cycle: byId("benefitCycleInput").value,
    expires: byId("benefitExpiresInput").value,
    activation: byId("benefitActivationInput").value,
    tracking: byId("benefitTrackingInput").value,
    notes: byId("benefitNotesInput").value.trim()
  };
  const validationError = validateBenefit(benefit);
  if (validationError) {
    setSyncStatus(validationError, "warn");
    return;
  }
  setFormBusy(form, true, "保存中...");
  const upserted = upsertLocalBenefit(benefit);
  clearBenefitForm();
  benefitFormOpen = false;
  render();
  await upsertRemoteBenefit(upserted.benefit);
  if (upserted.merged) setSyncStatus("同一卡片已有同名同周期福利，已合并更新。");
  setFormBusy(form, false);
});

byId("rewardForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const upload = byId("rewardUploadInput").files[0];
  const id = byId("rewardId").value || crypto.randomUUID();
  const existingReward = data.rewards.find(item => item.id === id);
  let uploaded = {
    documentId: existingReward?.documentId || "",
    uploadName: upload?.name || existingReward?.uploadName || ""
  };
  const selectedCard = data.cards.find(card => card.id === byId("rewardCardSelect").value);
  const defaultProgram = getCardRewardRules(selectedCard).program;
  const reward = {
    id,
    program: byId("rewardProgramInput").value.trim() || defaultProgram,
    points: Number(byId("rewardPointsInput").value || 0),
    merchant: byId("rewardMerchantInput").value.trim(),
    category: byId("rewardCategoryInput").value,
    cardId: byId("rewardCardSelect").value,
    multiplier: Number(byId("rewardMultiplierInput").value || 1),
    uploadName: uploaded.uploadName,
    documentId: uploaded.documentId
  };
  const validationError = validateReward(reward, upload);
  if (validationError) {
    setSyncStatus(validationError, "warn");
    return;
  }
  setFormBusy(form, true, "保存中...");
  if (upload && remoteMode()) {
    try {
      uploaded = await uploadPrivateDocument(upload, byId("rewardCardSelect").value);
      setSyncStatus("文件已上传");
    } catch (error) {
      setSyncStatus(error.message || "文件上传失败，积分先本地保存", "warn");
    }
  }

  reward.uploadName = uploaded.uploadName;
  reward.documentId = uploaded.documentId;
  const existingIndex = data.rewards.findIndex(item => item.id === id);
  if (existingIndex >= 0) data.rewards[existingIndex] = reward;
  else data.rewards.push(reward);
  byId("rewardForm").reset();
  byId("rewardId").value = "";
  render();
  await upsertRemoteReward(reward);
  setFormBusy(form, false);
});

document.addEventListener("click", event => {
  if (event.target.id !== "clearRewardFormButton") return;
  byId("rewardForm").reset();
  byId("rewardId").value = "";
});

document.addEventListener("click", async event => {
  if (event.target.id !== "fetchCardBenefitsButton") return;
  const issuer = byId("issuerInput").value.trim();
  const cardName = byId("cardNameInput").value.trim();
  if (!issuer || !cardName) {
    setSyncStatus("请先填写银行和卡片名称。", "warn");
    return;
  }
  if (!automationSettings.workerUrl) {
    setSyncStatus("请先在设置里保存 Cloudflare Worker URL。", "warn");
    return;
  }
  setButtonBusy(event.target, true, "获取中...");
  setSyncStatus("AI 正在检索官网福利，通常需要 20-90 秒...");
  try {
    const token = (await supabaseClient?.auth.getSession())?.data?.session?.access_token;
    if (!token) throw new Error("请先登录。");
    const response = await fetchWithTimeout(`${automationSettings.workerUrl.replace(/\/$/, "")}/card-benefits`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ issuer, bank: issuer, cardName, ...aiRequestFields() })
    }, 120000);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok || payload.ok === false) throw new Error(payload.error || payload.message || text || "福利模板获取失败。");
    const aiResult = payload.result || payload;

    const cardId = byId("cardId").value || crypto.randomUUID();
    byId("cardId").value = cardId;
    const currentAnnualFee = Number(byId("annualFeeInput").value || 0);
    const aiAnnualFee = Number(aiResult.annualFee || 0);
    if (currentAnnualFee <= 0 && aiAnnualFee > 0) byId("annualFeeInput").value = aiAnnualFee;

    const card = {
      id: cardId,
      issuer,
      name: cardName,
      nickname: byId("nicknameInput").value.trim(),
      last4: byId("last4Input").value.trim(),
      holder: byId("holderInput").value.trim(),
      annualFee: Number(byId("annualFeeInput").value || 0),
      dueDay: Number(byId("dueDayInput").value || 1),
      ...readCardReminderInputs(),
      anniversary: byId("anniversaryInput").value,
      notes: byId("cardNotesInput").value.trim(),
      rewardRules: aiResult.rewardRules || null,
      sourceUrls: aiResult.sourceUrls || [],
      officialName: aiResult.cardName || cardName,
      sourceUpdatedAt: new Date().toISOString()
    };
    saveCardMetadata(card);
    const existingCardIndex = data.cards.findIndex(item => item.id === cardId);
    if (existingCardIndex >= 0) data.cards[existingCardIndex] = card;
    else data.cards.push(card);

    // Build drafts but DON'T add them yet — the user reviews them first so
    // one-time / welcome bonuses don't get tracked as recurring annual value.
    const drafts = benefitDraftsFromAi(cardId, aiResult);

    render();
    await upsertRemoteCard(card);
    setSyncStatus(`卡片已保存，请在弹窗里确认要追踪的福利（共 ${drafts.length} 项）`);
    presentBenefitReview(cardId, drafts);
  } catch (error) {
    setSyncStatus(error.name === "AbortError" ? "AI 检索超时：官网搜索可能较慢，请稍后重试，或先保存卡片后再获取。" : `AI 获取失败：${error.message || "请检查 Worker、API key、模型和网络搜索配置。"}`, "warn");
  } finally {
    setButtonBusy(event.target, false);
  }
});

document.addEventListener("click", async event => {
  const editCardId = event.target.dataset.editCard;
  const deleteCardId = event.target.dataset.deleteCard;
  const calendarCardId = event.target.dataset.calendarCard;
  const editBenefitId = event.target.dataset.editBenefit;
  const reminderBenefitId = event.target.dataset.reminderBenefit;
  const deleteBenefitId = event.target.dataset.deleteBenefit;
  const useBenefitId = event.target.dataset.useBenefit;
  const editRewardId = event.target.dataset.editReward;
  const deleteRewardId = event.target.dataset.deleteReward;
  const viewAnalysisId = event.target.dataset.viewAnalysis;
  const deleteAnalysisId = event.target.dataset.deleteAnalysis;
  const quickBenefitId = event.target.dataset.quickBenefit;
  const quickPercent = Number(event.target.dataset.quickPercent || 0);
  const toggleCardId = event.target.closest("[data-toggle-card]")?.dataset.toggleCard;
  const refreshCardId = event.target.closest("[data-refresh-card]")?.dataset.refreshCard;

  if (refreshCardId) {
    refreshCardBenefits(refreshCardId);
    return;
  }

  if (quickBenefitId && quickPercent > 0) {
    const benefit = data.benefits.find(item => item.id === quickBenefitId);
    if (!benefit) return;
    if (isBenefitExpired(benefit)) {
      setSyncStatus(t("expiredBenefitNote"), "warn");
      return;
    }
    const targetUsed = Math.round((benefitCashValue(benefit) * quickPercent) / 100);
    benefit.used = Math.max(benefitCashUsed(benefit), targetUsed);
    render();
    await upsertRemoteBenefit(benefit);
    setSyncStatus(`Benefit logged at ${quickPercent}%`);
    return;
  }

  if (toggleCardId) {
    if (expandedCardIds.has(toggleCardId)) expandedCardIds.delete(toggleCardId);
    else expandedCardIds.add(toggleCardId);
    renderCards();
    return;
  }

  if (editCardId) {
    const card = data.cards.find(item => item.id === editCardId);
    if (!card) return;
    cardFormOpen = true;
    byId("cardId").value = card.id;
    byId("issuerInput").value = card.issuer;
    byId("cardNameInput").value = card.name;
    byId("nicknameInput").value = card.nickname;
    byId("last4Input").value = card.last4;
    byId("holderInput").value = card.holder;
    byId("annualFeeInput").value = card.annualFee;
    byId("dueDayInput").value = card.dueDay;
    byId("reminderChannelInput").value = card.reminderChannel || "inherit";
    // Prefill override fields from the card's own values, falling back to the
    // live global defaults so an inheriting card starts in sync (never stale).
    byId("remindDaysInput").value = card.remindDays == null ? automationSettings.paymentReminderDays : card.remindDays;
    byId("reminderEmailInput").value = card.reminderEmail || automationSettings.defaultReminderEmail || currentUser?.email || "";
    syncReminderFieldVisibility();
    byId("anniversaryInput").value = card.anniversary;
    byId("cardNotesInput").value = card.notes;
    renderCardDrawer();
  }

  if (deleteCardId) {
    setButtonBusy(event.target, true, "删除中...");
    const relatedBenefits = data.benefits.filter(item => item.cardId === deleteCardId);
    const relatedRewards = data.rewards.filter(item => item.cardId === deleteCardId);
    const relatedAnalyses = (data.statementAnalyses || []).filter(item => item.cardId === deleteCardId);
    data.cards = data.cards.filter(item => item.id !== deleteCardId);
    data.benefits = data.benefits.filter(item => item.cardId !== deleteCardId);
    data.rewards = data.rewards.filter(item => item.cardId !== deleteCardId);
    data.statementAnalyses = (data.statementAnalyses || []).filter(item => item.cardId !== deleteCardId);
    render();
    await Promise.all([
      ...relatedBenefits.map(item => deleteRemoteRow("benefits", item.id)),
      ...relatedRewards.map(item => deleteRemoteRow("reward_entries", item.id)),
      ...relatedAnalyses.map(item => deleteRemoteRow("statement_analyses", item.id).catch(() => {})),
      deleteRemoteRow("cards", deleteCardId)
    ]);
  }

  if (calendarCardId) {
    const card = data.cards.find(item => item.id === calendarCardId);
    if (card) downloadPaymentCalendar(card);
  }

  if (editBenefitId || reminderBenefitId) {
    const benefit = data.benefits.find(item => item.id === (editBenefitId || reminderBenefitId));
    if (!benefit) return;
    benefitFormOpen = true;
    byId("benefitId").value = benefit.id;
    byId("benefitCardSelect").value = benefit.cardId;
    byId("benefitNameInput").value = benefit.name;
    byId("benefitValueInput").value = benefit.value;
    byId("benefitCycleInput").value = benefit.cycle;
    byId("benefitExpiresInput").value = benefit.expires;
    byId("benefitActivationInput").value = benefit.activation;
    byId("benefitTrackingInput").value = benefit.tracking;
    byId("benefitNotesInput").value = benefit.notes;
    renderBenefitDrawer();
    if (reminderBenefitId) {
      setSyncStatus(interfaceLanguage === "zh" ? "可在这里设置到期日、追踪方式和提醒所需信息；全局提前提醒天数在设置页调整。" : "Set the expiration date, tracking method, and reminder details here. Global reminder timing is in Settings.");
      byId("benefitExpiresInput")?.focus();
    }
  }

  if (deleteBenefitId) {
    setButtonBusy(event.target, true, "删除中...");
    data.benefits = data.benefits.filter(item => item.id !== deleteBenefitId);
    render();
    await deleteRemoteRow("benefits", deleteBenefitId);
  }

  if (useBenefitId) {
    const benefit = data.benefits.find(item => item.id === useBenefitId);
    if (!benefit) return;
    if (isBenefitExpired(benefit)) {
      setSyncStatus(t("expiredBenefitNote"), "warn");
      return;
    }
    byId("benefitUseId").value = benefit.id;
    byId("benefitUseTitle").textContent = `${t("recordBenefitUse")}: ${benefit.name}`;
    byId("benefitUseAmountInput").value = "";
    byId("benefitUseModal").hidden = false;
  }

  if (editRewardId) {
    const reward = data.rewards.find(item => item.id === editRewardId);
    if (!reward) return;
    byId("rewardId").value = reward.id;
    byId("rewardProgramInput").value = reward.program || "";
    byId("rewardPointsInput").value = reward.points || 0;
    byId("rewardMerchantInput").value = reward.merchant || "";
    byId("rewardCategoryInput").value = reward.category || byId("rewardCategoryInput").options[0]?.value || "";
    byId("rewardCardSelect").value = reward.cardId || "";
    byId("rewardMultiplierInput").value = reward.multiplier || 1;
    switchView("rewards");
    byId("rewardProgramInput").focus();
  }

  if (deleteRewardId) {
    setButtonBusy(event.target, true, "删除中...");
    data.rewards = data.rewards.filter(item => item.id !== deleteRewardId);
    render();
    await deleteRemoteRow("reward_entries", deleteRewardId);
  }

  if (viewAnalysisId) {
    const analyses = Array.isArray(data.statementAnalyses) ? data.statementAnalyses : [];
    const selected = analyses.find(item => item.id === viewAnalysisId);
    if (!selected) return;
    data.statementAnalyses = [selected, ...analyses.filter(item => item.id !== viewAnalysisId)];
    saveData();
    renderAnalysis();
    switchView("analysis");
  }

  if (deleteAnalysisId) {
    data.statementAnalyses = (data.statementAnalyses || []).filter(item => item.id !== deleteAnalysisId);
    saveData();
    renderAnalysis();
  }
});

byId("cancelBenefitUseButton").addEventListener("click", () => {
  byId("benefitUseModal").hidden = true;
  byId("benefitUseForm").reset();
});

byId("benefitUseForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const benefit = data.benefits.find(item => item.id === byId("benefitUseId").value);
  const amount = Number(byId("benefitUseAmountInput").value || 0);
  if (!benefit || amount <= 0) {
    setSyncStatus("请输入有效的福利使用金额。", "warn");
    return;
  }
  setFormBusy(form, true, "保存中...");
  benefit.used = Math.min(Number(benefit.value || 0), Number(benefit.used || 0) + amount);
  byId("benefitUseModal").hidden = true;
  form.reset();
  render();
  await upsertRemoteBenefit(benefit);
  setFormBusy(form, false);
});

function downloadPaymentCalendar(card) {
  const due = nextDueDate(card.dueDay);
  const reminderDays = Number(card.remindDays || 0);
  const title = `${cardLabel(card)} 还款到期`;
  const description = `信用卡还款提醒：${card.issuer} ${card.name}${card.last4 ? ` 尾号 ${card.last4}` : ""}。建议确认是否已全额还款。`;
  const uid = `${card.id}-${icsDate(due)}@credit-card-butler`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Credit Card Butler//Payment Reminder//CN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(today)}T120000Z`,
    `DTSTART;VALUE=DATE:${icsDate(due)}`,
    `DTEND;VALUE=DATE:${icsDate(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1))}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    `TRIGGER:-P${reminderDays}D`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFileName(title)}.ics`;
  link.click();
  URL.revokeObjectURL(link.href);
}

byId("resetDemoButton").addEventListener("click", () => {
  data = structuredClone(defaultData);
  render();
  if (remoteMode()) setSyncStatus("示例只恢复到本机，未覆盖云端", "warn");
});

byId("closeYearButton").addEventListener("click", async event => {
  setButtonBusy(event.currentTarget, true, "保存中...");
  const totals = getTotals();
  const snapshot = {
    year: today.getFullYear(),
    annualFee: totals.annualFee,
    usedValue: totals.usedValue,
    remainingValue: totals.remainingValue,
    cards: data.cards.map(card => {
      const benefits = data.benefits.filter(benefit => benefit.cardId === card.id);
      return {
        id: card.id,
        label: cardLabel(card),
        annualFee: Number(card.annualFee || 0),
        usedValue: benefits.reduce((sum, benefit) => sum + benefitCashUsed(benefit), 0),
        remainingValue: benefits.reduce((sum, benefit) => sum + benefitCashRemaining(benefit), 0),
        unusedBenefits: benefits
          .filter(benefit => benefitCashRemaining(benefit) > 0)
          .map(benefit => ({ name: benefit.name, remaining: benefitCashRemaining(benefit) }))
      };
    }),
    createdAt: today.toISOString()
  };
  data.history.unshift(snapshot);
  data.benefits = data.benefits.map(benefit => ({ ...benefit, used: 0 }));
  render();
  await saveRemoteSnapshot(snapshot);
  await Promise.all(data.benefits.map(upsertRemoteBenefit));
  setSyncStatus("年度档案已保存，新的年度福利记录已开启");
  setButtonBusy(event.currentTarget, false);
});

async function initApp() {
  setupLogoFallback();
  updateAuthVisibility();
  await initSupabase();
  if (currentUser) {
    render();
    switchView(window.location.hash.replace("#", ""), false);
  }
  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      setSyncStatus("离线缓存暂时不可用", "warn");
    });
  }
}

initApp();

window.addEventListener("hashchange", () => {
  if (currentUser) switchView(window.location.hash.replace("#", ""), false);
});

