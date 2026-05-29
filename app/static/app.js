let state = { jobs: [], media: [], subjects: [], references: [], presets: [], models: [] };
let selectedReferenceIds = new Set();
let selectedGalleryIds = new Set();
let selectedHistoryJobId = null;
let selectedHistoryDayKey = null;
let historyExpanded = true;
let squareSort = "latest";
const historyDayOpen = new Map();
const historyIndustryOpen = new Map();
const NEW_TASK_DRAFT_ID = "__new_task__";
const SELECTED_HISTORY_JOB_KEY = "yy-selected-history-job";
const SHOW_ALL_GENERATED_KEY = "yy-show-all-generated";
const MAX_REFERENCE_SELECTION = 4;
const VALID_WORKSPACES = new Set(["studio", "commerce", "research"]);
const REFERENCE_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "heic", "heif"]);

const $ = (sel) => document.querySelector(sel);
const els = {
  compatLabel: $("#compatLabel"),
  showAllMedia: $("#showAllMedia"),
  mediaCount: $("#mediaCount"),
  protocolSummary: $("#protocolSummary"),
  countSummary: $("#countSummary"),
  wordCount: $("#wordCount"),
  toggleHistory: $("#toggleHistory"),
  historyList: $("#historyList"),
  galleryHeader: $("#galleryHeader"),
  mediaGrid: $("#mediaGrid"),
  emptyState: $("#emptyState"),
  prompt: $("#prompt"),
  submitJob: $("#submitJob"),
  clearPrompt: $("#clearPrompt"),
  quickConfigButton: $("#quickConfigButton"),
  quickConfigPanel: $("#quickConfigPanel"),
  closeQuickConfig: $("#closeQuickConfig"),
  quickCount: $("#quickCount"),
  quickAspect: $("#quickAspect"),
  matchReferenceAspect: $("#matchReferenceAspect"),
  quickResolution: $("#quickResolution"),
  quickConcurrency: $("#quickConcurrency"),
  quickQuality: $("#quickQuality"),
  quickFormat: $("#quickFormat"),
  title: $("#title"),
  protocol: $("#protocol"),
  protocolTitle: $("#protocolTitle"),
  protocolDescription: $("#protocolDescription"),
  protocolSupport: $("#protocolSupport"),
  connectionMode: $("#connectionMode"),
  connectionButtons: document.querySelectorAll("[data-connection-mode]"),
  connectionNote: $("#connectionNote"),
  connectionStatus: $("#connectionStatus"),
  debugApiBanner: $("#debugApiBanner"),
  apiUrl: $("#apiUrl"),
  apiKey: $("#apiKey"),
  rememberApiKey: $("#rememberApiKey"),
  poolLoginPanel: $("#poolLoginPanel"),
  poolUserName: $("#poolUserName"),
  poolUserHint: $("#poolUserHint"),
  poolUsername: $("#poolUsername"),
  poolPassword: $("#poolPassword"),
  poolLoginButton: $("#poolLoginButton"),
  poolLogoutButton: $("#poolLogoutButton"),
  model: $("#model"),
  modelFilter: $("#modelFilter"),
  availableModelList: $("#availableModelList"),
  modelStatus: $("#modelStatus"),
  modelFetchHelp: $("#modelFetchHelp"),
  analysisModel: $("#analysisModel"),
  researchTextModel: $("#researchTextModel"),
  manualTextModelPanel: $("#manualTextModelPanel"),
  manualTextModel: $("#manualTextModel"),
  reuseTextApiUrl: $("#reuseTextApiUrl"),
  textApiUrlField: $("#textApiUrlField"),
  textApiUrl: $("#textApiUrl"),
  reuseTextApiKey: $("#reuseTextApiKey"),
  textApiKeyField: $("#textApiKeyField"),
  textApiKey: $("#textApiKey"),
  textApiKeyStatus: $("#textApiKeyStatus"),
  aspectRatio: $("#aspectRatio"),
  resolution: $("#resolution"),
  count: $("#count"),
  concurrency: $("#concurrency"),
  retryLimit: $("#retryLimit"),
  quality: $("#quality"),
  outputFormat: $("#outputFormat"),
  seed: $("#seed"),
  negative: $("#negative"),
  editMode: $("#editMode"),
  referenceUpload: $("#referenceUpload"),
  referenceUploadButton: $("#referenceUploadButton"),
  referenceList: $("#referenceList"),
  composerReferenceList: $("#composerReferenceList"),
  referenceSendSummary: $("#referenceSendSummary"),
  sendOptimize: $("#sendOptimize"),
  aspectSummary: $("#aspectSummary"),
  resolutionSummary: $("#resolutionSummary"),
  promptAnalysisCard: $("#promptAnalysisCard"),
  closePromptAnalysis: $("#closePromptAnalysis"),
  analysisResultTitle: $("#analysisResultTitle"),
  preflightGenerate: $("#preflightGenerate"),
  preflightSeconds: $("#preflightSeconds"),
  preflightText: $("#preflightText"),
  preflightProgress: $("#preflightProgress"),
  preflightRunAi: $("#preflightRunAi"),
  stopAutoGenerate: $("#stopAutoGenerate"),
  promptScore: $("#promptScore"),
  analysisRiskTitle: $("#analysisRiskTitle"),
  analysisParamTitle: $("#analysisParamTitle"),
  analysisPromptTitle: $("#analysisPromptTitle"),
  analysisStyleTitle: $("#analysisStyleTitle"),
  analysisAspect: $("#analysisAspect"),
  analysisSize: $("#analysisSize"),
  analysisCount: $("#analysisCount"),
  analysisStyle: $("#analysisStyle"),
  optimizedPrompt: $("#optimizedPrompt"),
  applyOptimizedPrompt: $("#applyOptimizedPrompt"),
  applyOptimizedParams: $("#applyOptimizedParams"),
  continueOriginalPrompt: $("#continueOriginalPrompt"),
  copyOptimizedPrompt: $("#copyOptimizedPrompt"),
  clearMedia: $("#clearMedia"),
  newTask: $("#newTask"),
  refreshModels: $("#refreshModels"),
  appShell: $(".app-shell"),
  composer: $(".composer"),
  toggleLeft: $("#toggleLeft"),
  collapseLeft: $("#collapseLeft"),
  toggleConfig: $("#toggleConfig"),
  configPanel: $("#configPanel"),
  collapseRight: $("#collapseRight"),
  mobileShellBackdrop: $("#mobileShellBackdrop"),
  mediaPreviewModal: $("#mediaPreviewModal"),
  mediaPreviewTitle: $("#mediaPreviewTitle"),
  mediaPreviewMeta: $("#mediaPreviewMeta"),
  mediaPreviewImageWrap: $("#mediaPreviewImageWrap"),
  mediaPreviewImage: $("#mediaPreviewImage"),
  mediaPreviewAgent: $("#mediaPreviewAgent"),
  mediaPreviewPrompt: $("#mediaPreviewPrompt"),
  closeMediaPreview: $("#closeMediaPreview"),
  agentEntry: $("#agentEntry"),
  agentClearButton: $("#agentClearButton"),
  agentAppliedStatus: $("#agentAppliedStatus"),
  agentStatusBubble: $("#agentStatusBubble"),
  agentQuickList: $("#agentQuickList"),
  agentModeToggle: $("#agentModeToggle"),
  agentModeSubtitle: $("#agentModeSubtitle"),
  agentModeCard: $("#agentModeCard"),
  closeAgentMode: $("#closeAgentMode"),
  agentModal: $("#agentModal"),
  agentList: $("#agentList"),
  agentWorkspace: $("#agentWorkspace"),
  closeAgentPanel: $("#closeAgentPanel"),
  applyAgent: $("#applyAgent"),
  applyStableAgent: $("#applyStableAgent"),
  applyCreativeAgent: $("#applyCreativeAgent"),
  applyCommercialAgent: $("#applyCommercialAgent"),
  regenerateAgent: $("#regenerateAgent"),
  disableAgent: $("#disableAgent"),
  cancelAgent: $("#cancelAgent"),
  guideOverlay: $("#guideOverlay"),
  guideStepLabel: $("#guideStepLabel"),
  guideTitle: $("#guideTitle"),
  guideBody: $("#guideBody"),
  guideHint: $("#guideHint"),
  guideBubble: $("#guideBubble"),
  guideConfig: $("#guideConfig"),
  skipGuide: $("#skipGuide"),
  nextGuide: $("#nextGuide"),
  presetButton: $("#presetButton"),
  presetPanel: $("#presetPanel"),
  presetGrid: $("#presetGrid"),
  closePresetPanel: $("#closePresetPanel"),
  expandAdvanced: $("#expandAdvanced"),
  optimizePrompt: $("#optimizePrompt"),
  recommendParams: $("#recommendParams"),
  predictFailure: $("#predictFailure"),
  enhanceStyle: $("#enhanceStyle"),
};

const squareEls = {
  grid: document.querySelector(".square-grid"),
  tabs: document.querySelectorAll(".square-tabs button"),
  refresh: document.querySelector(".square-refresh-button"),
  quota: document.querySelector(".square-quota-strip"),
};

const commerceEls = {
  tabs: document.querySelectorAll("[data-commerce-tab]"),
  panels: document.querySelectorAll("[data-commerce-panel]"),
  chatToggle: $("#commerceChatToggle"),
  chatFloat: $("#commerceChatFloat"),
  chatClose: $("#commerceChatClose"),
  analysisCard: $("#commerceAnalysisCard"),
  apiUrl: $("#commerceApiUrl"),
  apiKey: $("#commerceApiKey"),
  rememberKey: $("#commerceRememberKey"),
  model: $("#commerceModel"),
  modelStatus: $("#commerceModelStatus"),
  templateSelect: $("#commerceTemplateSelect"),
  modeChips: document.querySelectorAll("[data-commerce-mode]"),
  referenceField: $("#commerceReferenceField"),
  referenceUpload: $("#commerceReferenceUpload"),
  referenceInput: $("#commerceReferenceInput"),
  referenceDrop: $("#commerceReferenceDrop"),
  referencePreview: $("#commerceReferencePreview"),
  productName: $("#commerceProductName"),
  sellingPoints: $("#commerceSellingPoints"),
  style: $("#commerceStyle"),
  clearStyle: $("#commerceClearStyle"),
  sceneChips: document.querySelectorAll("[data-commerce-scene]"),
  ratioChips: document.querySelectorAll("[data-commerce-ratio]"),
  count: $("#commerceCount"),
  size: $("#commerceSize"),
  resolution: $("#commerceResolution"),
  quality: $("#commerceQuality"),
  format: $("#commerceFormat"),
  background: $("#commerceBackground"),
  upscale: $("#commerceUpscale"),
  prompt: $("#commercePrompt"),
  templateName: $("#commerceTemplateName"),
  templateTags: $("#commerceTemplateTags"),
  saveTemplate: $("#commerceSaveTemplate"),
  clearSelection: $("#commerceClearSelection"),
  generate: $("#commerceGenerate"),
  generateBottom: $("#commerceGenerateBottom"),
  gallery: $("#commerceGallery"),
  resultStatus: $("#commerceResultStatus"),
  resultPager: $("#commerceResultPager"),
  resultPageButtons: document.querySelectorAll("[data-commerce-result-page]"),
  resultPageLabel: $("#commerceResultPageLabel"),
  openGallery: $("#commerceOpenGallery"),
  currentTask: $("#commerceCurrentTask"),
  recentTasks: $("#commerceRecentTasks"),
  showAllHistory: $("#commerceShowAllHistory"),
  archiveCompleted: $("#commerceArchiveCompleted"),
  newTemplate: $("#commerceNewTemplate"),
  templateSearch: $("#commerceTemplateSearch"),
  templateCount: $("#commerceTemplateCount"),
  templateList: $("#commerceTemplateList"),
  library: $("#commerceLibrary"),
  pageButtons: document.querySelectorAll("[data-commerce-page]"),
  galleryPageLabel: $("#commerceGalleryPageLabel"),
  historyFilters: document.querySelectorAll("[data-commerce-status]"),
  historyList: $("#commerceHistoryList"),
  historyPageLabel: $("#commerceHistoryPageLabel"),
  analysisStatus: $("#commerceAnalysisStatus"),
  textApiUrl: $("#commerceTextApiUrl"),
  textModelSelect: $("#commerceTextModelSelect"),
  textModel: $("#commerceTextModel"),
  textApiKey: $("#commerceTextApiKey"),
  analysisContext: $("#commerceAnalysisContext"),
  analysisInput: $("#commerceAnalysisInput"),
  analysisImages: $("#commerceAnalysisImages"),
  analysisMessages: $("#commerceAnalysisMessages"),
  analysisInputText: $("#commerceAnalysisInputText"),
  analysisSend: $("#commerceAnalysisSend"),
};

if (commerceEls.analysisCard && !commerceEls.analysisCard.classList.contains("hidden")) {
  document.body.classList.add("commerce-chat-open");
  commerceEls.chatFloat?.classList.add("active");
}

let commercePromptTouched = false;
let commerceRefreshTimer = 0;
let commerceActiveTab = "workspace";
let commerceHistoryStatus = "all";
let commerceTemplates = [];
let commerceResultPage = 1;
let commerceGalleryPage = 1;
let commerceHistoryPage = 1;
let commerceEditingTemplateId = "";
let commerceSelectedJobId = "";
let commerceTextModelTimer = 0;
let commerceAnalysisRefs = [];
let commerceAnalysisMessages = [];

function persistHistorySelection(showAll = false) {
  try {
    if (showAll) {
      localStorage.setItem(SHOW_ALL_GENERATED_KEY, "1");
      localStorage.removeItem(SELECTED_HISTORY_JOB_KEY);
      return;
    }
    localStorage.removeItem(SHOW_ALL_GENERATED_KEY);
    if (selectedHistoryJobId && selectedHistoryJobId !== NEW_TASK_DRAFT_ID) {
      localStorage.setItem(SELECTED_HISTORY_JOB_KEY, selectedHistoryJobId);
    } else {
      localStorage.removeItem(SELECTED_HISTORY_JOB_KEY);
    }
  } catch (err) {
    // localStorage may be blocked by browser privacy settings.
  }
}

function restoreHistorySelection() {
  try {
    if (selectedHistoryJobId || selectedHistoryDayKey || localStorage.getItem(SHOW_ALL_GENERATED_KEY) === "1") return;
    const lastJobId = localStorage.getItem(SELECTED_HISTORY_JOB_KEY);
    const studioJobs = jobsForWorkspace("studio");
    if (lastJobId && studioJobs.some((job) => job.id === lastJobId)) {
      selectedHistoryJobId = lastJobId;
      return;
    }
  } catch (err) {
    // Fall through to latest task.
  }
  selectedHistoryJobId = jobsForWorkspace("studio")[0]?.id || null;
}

function clearLegacyDefaultNegative() {
  if (els.negative?.value.trim() === LEGACY_DEFAULT_NEGATIVE) {
    els.negative.value = "";
  }
}

let verifiedImageModels = [];
let verifiedTextModels = [];
let autoModelTimer = 0;
let modelRequestId = 0;
let selectedAgent = null;
let agentModeEnabled = false;
let agentEnabled = false;
let agentGenerated = false;
let agentPlan = null;
let agentPlanRevision = 0;
let appliedAgentVariant = null;
let previewAgentVariant = "stable";
let agentModePlan = null;
let promptAnalysisPlan = null;
let referenceAspectAutoValue = "";
let referenceAspectAutoEnabled = true;
let referenceAspectSyncing = false;
let customIndustryAgents = [];
let agentComposerExpanded = false;
let guideStep = 0;
let guideAutoShown = false;
let guideDismissedThisSession = false;
const GUIDE_STORAGE_KEY = "yangyangapi:onboarding:v1:completed";
const CUSTOM_INDUSTRY_AGENTS_KEY = "yangyangapi:custom-industry-agents:v1";
let submitInFlight = false;
let activeSubmitRequestId = "";
let stateRefreshTimer = 0;
let stateRefreshInFlight = false;
let preflightAnalysisInFlight = false;
let preflightCancelled = false;
let activeMediaPreviewItem = null;
let mediaPreviewScale = 1;
let mediaPreviewTranslate = { x: 0, y: 0 };
let mediaPreviewDrag = null;
let mediaPreviewPointers = new Map();
let mediaPreviewPinch = null;
let textModelRefreshTimer = 0;
let activeResearchJobId = "";
let activeResearchProjectSignature = "";
const RESEARCH_PROJECT_STORAGE_KEY = "yy-research-project";
const RESEARCH_ACTIVE_JOB_STORAGE_KEY = "yy-research-active-job";
const LEGACY_DEFAULT_NEGATIVE = "低清晰度，畸形结构，错误文字，重复肢体，低质量，过度锐化";

function cleanWorkspace(value) {
  const workspace = String(value || "").trim().toLowerCase();
  return VALID_WORKSPACES.has(workspace) ? workspace : "";
}

function legacyJobWorkspace(job = {}) {
  const agentId = String(job.agent_id || "");
  const agentName = String(job.agent_name || "");
  const title = String(job.title || "");
  if (agentId === "research-workbench" || agentName.includes("科研图")) return "research";
  if (title.includes("简洁生图台")) return "commerce";
  return "studio";
}

function jobWorkspace(job = {}) {
  return cleanWorkspace(job.workspace) || legacyJobWorkspace(job);
}

function mediaWorkspace(media = {}, job = {}) {
  return cleanWorkspace(media.workspace) || jobWorkspace(job);
}

function jobsForWorkspace(workspace = "studio") {
  const target = cleanWorkspace(workspace) || "studio";
  return state.jobs.filter((job) => jobWorkspace(job) === target);
}

function mediaForWorkspace(workspace = "studio") {
  const target = cleanWorkspace(workspace) || "studio";
  const jobById = new Map(state.jobs.map((job) => [job.id, job]));
  return state.media.filter((media) => mediaWorkspace(media, jobById.get(media.job_id) || {}) === target);
}

function currentHistoryJob() {
  if (!selectedHistoryJobId || selectedHistoryJobId === NEW_TASK_DRAFT_ID) return null;
  return jobsForWorkspace("studio").find((job) => job.id === selectedHistoryJobId) || null;
}
let preflightTimer = 0;
let preflightOriginalPrompt = "";
let lastRouteAnchor = "";

function applyRoute() {
  const anchor = location.hash || "#home";
  document.body.classList.toggle("studio-active", anchor === "#studio");
  document.body.classList.toggle("research-active", anchor === "#research");
  document.body.classList.toggle("commerce-active", anchor === "#commerce");
  if (anchor === "#commerce" && lastRouteAnchor && lastRouteAnchor !== "#commerce") {
    selectedReferenceIds.clear();
    setCommerceChip(commerceEls.modeChips, "commerceMode", "text");
    syncCommerceModeControls({ clearTextReferences: true });
  }
  lastRouteAnchor = anchor;
  if (anchor !== "#studio") {
    hideGuide(false);
  }
  const target = document.querySelector(anchor);
  if (target) {
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: anchor === "#studio" || anchor === "#research" || anchor === "#commerce" ? "auto" : "smooth" });
    });
  }
  maybeAutoShowGuide(anchor);
}

const CLIENT_ID_STORAGE_KEY = "yangyang_image_client_id";
const CONNECTION_MODE_STORAGE_KEY = "yangyang_image_connection_mode";

function ensureClientId() {
  const cached = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (cached) return cached;
  const randomId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const value = `yy-${randomId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, value);
  return value;
}

const clientId = ensureClientId();

function compactSignatureText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 260);
}

function researchPromptSignature(value) {
  return compactSignatureText(value).slice(0, 260);
}

function researchProjectSignature(promptOverride = "") {
  const prompt = promptOverride || [...document.querySelectorAll("#researchStage .research-node textarea")]
    .map((item) => item.value || "")
    .filter(Boolean)
    .join("\n");
  return [
    compactSignatureText($("#researchSubject")?.value || ""),
    compactSignatureText($("#researchProjectContext")?.value || ""),
    compactSignatureText(prompt || $("#researchPrompt")?.value || ""),
  ].filter(Boolean).join(" || ").slice(0, 900);
}

function saveActiveResearchJob(jobId = activeResearchJobId, signature = activeResearchProjectSignature) {
  if (!jobId) {
    localStorage.removeItem(RESEARCH_ACTIVE_JOB_STORAGE_KEY);
    return;
  }
  localStorage.setItem(RESEARCH_ACTIVE_JOB_STORAGE_KEY, JSON.stringify({
    jobId,
    signature: signature || "",
  }));
}

function restoreActiveResearchJob() {
  if (activeResearchJobId) return;
  try {
    const payload = JSON.parse(localStorage.getItem(RESEARCH_ACTIVE_JOB_STORAGE_KEY) || "{}");
    if (payload.jobId) activeResearchJobId = String(payload.jobId);
    if (payload.signature) activeResearchProjectSignature = String(payload.signature);
  } catch {
    localStorage.removeItem(RESEARCH_ACTIVE_JOB_STORAGE_KEY);
  }
}

async function api(path, options = {}) {
  const resp = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-YY-Client-ID": clientId, ...(options.headers || {}) },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || data.detail || "请求失败");
  return data;
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false });
}

function historyDayKey(ts) {
  const date = new Date((ts || 0) * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function historyDayLabel(key) {
  const today = historyDayKey(Date.now() / 1000);
  const yesterday = historyDayKey(Date.now() / 1000 - 86400);
  if (key === today) return "今天";
  if (key === yesterday) return "昨天";
  const [, month, day] = key.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function historyTimeLabel(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function jobsForHistoryDay(dayKey) {
  if (!dayKey) return [];
  return jobsForWorkspace("studio").filter((job) => historyDayKey(job.created_at) === dayKey);
}

function statusText(status) {
  return { queued: "排队", running: "生成中", success: "完成", error: "失败" }[status] || status;
}

const protocols = {
  "custom-openai": {
    label: "OpenAI 兼容",
    shortLabel: "兼容协议",
    description: "适合云端 OpenAI 兼容图片接口",
    support: "支持参考图 · 支持质量 · 支持格式",
  },
  "openai-images": {
    label: "OpenAI Images",
    shortLabel: "OpenAI",
    description: "OpenAI 风格 Images API，宽高比会转换为 size 参数",
    support: "支持参考图 · 支持质量 · 支持格式",
  },
  "openai-responses": {
    label: "OpenAI Responses",
    shortLabel: "Responses",
    description: "适合对话式生成和后续多轮改图",
    support: "不支持参考图 · 支持质量 · 支持格式",
  },
  "gemini-native": {
    label: "Gemini Native",
    shortLabel: "Gemini",
    description: "Google Gemini 原生 generateContent 生图/改图",
    support: "支持参考图 · 不支持质量 · 支持格式",
  },
  "gemini-openai": {
    label: "Gemini OpenAI 兼容",
    shortLabel: "Gemini 兼容",
    description: "Gemini 的 OpenAI 兼容接口，适合快速迁移",
    support: "不支持参考图 · 不支持质量 · 支持格式",
  },
  "google-imagen": {
    label: "Google Imagen",
    shortLabel: "Imagen",
    description: "Imagen 系列文生图，比例范围较明确",
    support: "不支持参考图 · 不支持质量 · 支持格式",
  },
  "stability-core": {
    label: "Stability Core",
    shortLabel: "Stability",
    description: "Stability AI Stable Image Core/Ultra 风格接口",
    support: "不支持参考图 · 不支持质量 · 支持格式",
  },
};

const modelConfig = window.YY_MODEL_CONFIG || {};
const modelConnections = modelConfig.connections || {};
const DEFAULT_CUSTOM_API_URL = "https://yynewapi.yangyangnj.top/v1";
const CUSTOM_API_URL_KEY = "yangyang_image_custom_api_url";
const SELECTED_IMAGE_MODEL_KEY = "yangyang_image_selected_model";
const SELECTED_TEXT_MODEL_KEY = "yangyang_image_selected_text_model";
const MANUAL_TEXT_MODEL_KEY = "yangyang_image_manual_text_model";
const TEXT_API_URL_KEY = "yangyang_image_text_api_url";
const TEXT_API_KEY_STORAGE_KEY = "yangyang_image_text_api_key";
const SEND_OPTIMIZE_KEY = "yangyang_image_send_optimize";
const COMMERCE_TEMPLATES_KEY = "yangyang_simple_studio_templates";
const COMMERCE_ANALYSIS_CHAT_KEY = "yangyang_commerce_analysis_chat";
const COMMERCE_ANALYSIS_REFS_KEY = "yangyang_commerce_analysis_refs";
const COMMERCE_ANALYSIS_MODEL_KEY = "yangyang_commerce_analysis_model";
const COMMERCE_ANALYSIS_TEXT_KEY = "yangyang_commerce_analysis_text_key";
const COMMERCE_ANALYSIS_URL_KEY = "yangyang_commerce_analysis_text_url";
const COMMERCE_ANALYSIS_CONTEXT_KEY = "yangyang_commerce_analysis_context";
const ALLOWED_CONNECTION_MODES = new Set(["custom", "pool"]);
let debugCustomApi = {
  enabled: Boolean(modelConfig.debug?.workbench_custom_api),
  apiUrl: "",
  hasApiKey: Boolean(modelConnections.custom?.api_key_configured),
  image: { apiUrl: "", hasApiKey: false, routeKind: "" },
  text: { apiUrl: "", hasApiKey: false, routeKind: "" },
};

const connectionNotes = {
  custom: modelConnections.custom?.description || "自定义 API 模式用于接入云端 OpenAI 兼容地址，Token 可在 New API 后台管理。",
  pool: modelConnections.pool?.description || "本地号池模式不需要填写 API Key，会从管理员号池中挑选可用账号生成图片。",
};

const connectionEndpoints = {
  custom: modelConnections.custom?.url || DEFAULT_CUSTOM_API_URL,
  pool: modelConnections.pool?.label || "使用本地号池，无需 API URL",
};
function storedCustomApiUrl() {
  const saved = (localStorage.getItem(CUSTOM_API_URL_KEY) || "").trim();
  if (!saved || saved === "http://127.0.0.1:3004" || saved === "http://127.0.0.1:3004/v1" || saved === "https://your-api.example.com/v1") {
    return DEFAULT_CUSTOM_API_URL;
  }
  return saved;
}
const modelProfiles = Array.isArray(modelConfig.model_profiles) ? modelConfig.model_profiles : [];
const modelProfileMap = new Map(modelProfiles.map((item) => [item.id, item]));
if (modelConfig.connections) {
  Object.entries(modelConfig.connections).forEach(([key, item]) => {
    if (!ALLOWED_CONNECTION_MODES.has(key)) return;
    const label = item.label || key;
    const badge = item.badge ? ` ${item.badge}` : "";
    if (item.url) connectionEndpoints[key] = item.url;
    connectionNotes[key] = `${label}${badge ? `（${item.badge}）` : ""}：${item.description || item.url || "后台可维护线路说明。"}`;
  });
}

const aspectSizes = {
  "1:1": "1024x1024",
  "4:5": "1024x1280",
  "5:4": "1280x1024",
  "3:4": "1024x1365",
  "4:3": "1365x1024",
  "2:3": "1024x1536",
  "3:2": "1536x1024",
  "9:16": "1024x1792",
  "16:9": "1920x1080",
  "21:9": "1792x768",
  "9:21": "768x1792",
  "4:1": "2048x512",
  "1:4": "512x2048",
  "8:1": "2048x256",
  "1:8": "256x2048",
};

const resolutionMultipliers = { "1K": 1, "2K": 2, "4K": 4 };
const GPT_IMAGE_2_MAX_EDGE = 3840;
const GPT_IMAGE_2_MIN_PIXELS = 655360;
const GPT_IMAGE_2_MAX_PIXELS = 8294400;

function isGptImage2Model(model = "") {
  const value = String(model || els.model?.value || "gpt-image-2").trim().toLowerCase();
  return ["gpt-image-2", "codex-gpt-image-2"].includes(value);
}

function roundToMultiple(value, multiple = 16) {
  return Math.max(multiple, Math.round(Number(value || 0) / multiple) * multiple);
}

function ceilToMultiple(value, multiple = 16) {
  return Math.max(multiple, Math.ceil(Number(value || 0) / multiple) * multiple);
}

function floorToMultiple(value, multiple = 16) {
  return Math.max(multiple, Math.floor(Number(value || 0) / multiple) * multiple);
}

function gptImage2SizeFor(aspectRatio, resolution) {
  const [rw, rh] = String(aspectRatio || "1:1").split(":").map(Number);
  let ratioW = Number.isFinite(rw) && rw > 0 ? rw : 1;
  let ratioH = Number.isFinite(rh) && rh > 0 ? rh : 1;
  if (Math.max(ratioW, ratioH) / Math.min(ratioW, ratioH) > 3) {
    if (ratioW >= ratioH) ratioW = ratioH * 3;
    else ratioH = ratioW * 3;
  }
  const targetLongEdge = { "1K": 1024, "2K": 2048, "4K": 3840 }[resolution] || 1024;
  let width;
  let height;
  if (ratioW >= ratioH) {
    width = targetLongEdge;
    height = targetLongEdge * ratioH / ratioW;
  } else {
    height = targetLongEdge;
    width = targetLongEdge * ratioW / ratioH;
  }
  width = roundToMultiple(width);
  height = roundToMultiple(height);
  if (width * height < GPT_IMAGE_2_MIN_PIXELS) {
    const scale = Math.sqrt(GPT_IMAGE_2_MIN_PIXELS / Math.max(1, width * height));
    width = ceilToMultiple(width * scale);
    height = ceilToMultiple(height * scale);
  }
  if (width * height > GPT_IMAGE_2_MAX_PIXELS || Math.max(width, height) > GPT_IMAGE_2_MAX_EDGE) {
    const scale = Math.min(GPT_IMAGE_2_MAX_EDGE / Math.max(width, height), Math.sqrt(GPT_IMAGE_2_MAX_PIXELS / Math.max(1, width * height)));
    width = floorToMultiple(width * scale);
    height = floorToMultiple(height * scale);
  }
  if (Math.max(width, height) > GPT_IMAGE_2_MAX_EDGE || width * height > GPT_IMAGE_2_MAX_PIXELS) {
    const scale = Math.min(GPT_IMAGE_2_MAX_EDGE / Math.max(width, height), Math.sqrt(GPT_IMAGE_2_MAX_PIXELS / (width * height)));
    width = floorToMultiple(width * scale);
    height = floorToMultiple(height * scale);
  }
  return `${width}x${height}`;
}

const promptSkillLibrary = {
  productHero: {
    group: "base",
    name: "产品英雄主图",
    desc: "主体完整、大占比、平台安全区清楚",
    instruction: "使用产品英雄主图技法：主体完整清晰，占画面主要面积，背景干净，平台安全区明确，适合首图和详情页首屏。",
  },
  lifestyleScene: {
    group: "base",
    name: "生活方式场景",
    desc: "把产品放进真实使用环境",
    instruction: "使用生活方式场景技法：把主体放进真实可理解的使用场景，加入少量人物动作或环境线索，强调真实使用价值。",
  },
  benefitVisual: {
    group: "base",
    name: "卖点可视化",
    desc: "把功能优势转成画面证据",
    instruction: "使用卖点可视化技法：把核心卖点转成可见的材质、结构、对比、状态变化或场景结果，不依赖文字解释。",
  },
  macroDetail: {
    group: "base",
    name: "材质微距",
    desc: "突出纹理、工艺、质感",
    instruction: "使用材质微距技法：靠近主体关键部位，突出纹理、工艺、高光、边缘和触感，背景虚化且不抢主体。",
  },
  miniatureWorld: {
    group: "base",
    name: "微缩场景",
    desc: "用小人/微缩空间制造记忆点",
    instruction: "使用微缩场景技法：围绕主体构建微缩世界或小尺度叙事，让主体像场景核心装置，保持商业质感和识别度。",
  },
  flatlayKit: {
    group: "base",
    name: "平铺清单",
    desc: "适合套装、步骤、成分展示",
    instruction: "使用平铺清单技法：俯拍整齐陈列主体、配件、材料或步骤道具，留出标题区，画面清楚有秩序。",
  },
  coverHook: {
    group: "base",
    name: "封面钩子",
    desc: "大主体、高对比、一秒读懂",
    instruction: "使用封面钩子技法：大主体、高对比、清晰动作瞬间或结果展示，手机缩略图也能一秒读懂。",
  },
  beforeAfter: {
    group: "base",
    name: "前后对比",
    desc: "突出变化、效果、解决问题",
    instruction: "使用前后对比技法：用左右分区、场景状态变化或结果对照表现痛点和改善，但不要生成错误文字。",
  },
  kvLayout: {
    group: "base",
    name: "广告 KV",
    desc: "品牌主视觉、标题安全区",
    instruction: "使用广告 KV 技法：主体、卖点视觉和标题安全区分区明确，构图适合投放、官网头图和品牌页面复用。",
  },
  infographic: {
    group: "base",
    name: "信息图布局",
    desc: "参数、步骤、结构更清楚",
    instruction: "使用信息图布局技法：以视觉分区表达结构、步骤或参数关系，保留文字位置但不要要求模型生成可读中文。",
  },
  ugcReal: {
    group: "base",
    name: "真实 UGC",
    desc: "手机实拍感、自然可信",
    instruction: "使用真实 UGC 技法：模拟自然手机拍摄、真实环境光和轻微生活痕迹，画面可信但保持干净专业。",
  },
  premiumLuxury: {
    group: "base",
    name: "奢华质感",
    desc: "高级材质、克制光影",
    instruction: "使用奢华质感技法：高级材质、高光边缘、克制背景、低噪点商业布光，避免廉价模板感。",
  },
  uiMockup: {
    group: "base",
    name: "界面样机",
    desc: "SaaS/App 功能展示",
    instruction: "使用界面样机技法：展示清晰产品界面、设备样机、功能层级和品牌色，不生成混乱文字和不可读界面。",
  },
  caseMiniatureDiorama: {
    group: "case",
    name: "案例 · 微缩搭景",
    desc: "用微缩人物和装置把卖点讲成画面",
    instruction: "使用案例灵感：把主体放大成场景核心，用微缩人物、工具、平台或装置表达“打造、修护、升级、制造”等隐喻，主体标签和外观保持清晰。",
  },
  caseStoryboardGrid: {
    group: "case",
    name: "案例 · 分镜九宫格",
    desc: "把单张图扩展成产品故事板",
    instruction: "使用案例灵感：按 6 到 9 个镜头组织产品故事板，包含环境建立、英雄镜头、材质特写、使用动作、结果展示和收尾画面，整体产品身份保持一致。",
  },
  caseLuxuryCampaign: {
    group: "case",
    name: "案例 · 奢品广告系统",
    desc: "主物、包装、反光、品牌安全区",
    instruction: "使用案例灵感：搭建高端广告系统，包含主商品、包装或道具、反光台面、轮廓高光、克制色彩和标题安全区，画面可用于品牌 KV。",
  },
  casePosterNarrative: {
    group: "case",
    name: "案例 · 海报叙事",
    desc: "用单张海报讲清活动或主题",
    instruction: "使用案例灵感：把主题拆成主体、环境、动作、情绪和留白区域，形成有故事感的海报画面，避免堆砌元素和不可读文字。",
  },
  caseSocialMockup: {
    group: "case",
    name: "案例 · 社媒样机",
    desc: "封面、界面、设备、发布场景",
    instruction: "使用案例灵感：把界面、设备样机、封面构图和社媒发布场景结合，突出可点击的第一屏视觉，保留标题或按钮安全区。",
  },
  caseFormulaPrompt: {
    group: "case",
    name: "案例 · 提示词配方",
    desc: "把主题拆成主体、动作、环境、镜头、光线",
    instruction: "使用提示词配方技法：按“主体身份 + 动作状态 + 环境语境 + 镜头距离 + 光线质感 + 构图留白 + 交付平台”组织画面，避免只堆风格词；每套方案必须替换至少两个画面变量。",
  },
  caseVisualMetaphor: {
    group: "case",
    name: "案例 · 视觉隐喻",
    desc: "把抽象卖点变成可见装置或场景",
    instruction: "使用视觉隐喻技法：把效率、安全、轻盈、修复、增长、清洁、智能等抽象卖点变成可看见的装置、空间关系、对比状态或动作结果，主体仍然是画面核心。",
  },
  caseMultiAngleSet: {
    group: "case",
    name: "案例 · 多角度套图",
    desc: "英雄图、细节图、场景图形成一组",
    instruction: "使用多角度套图技法：同一主体生成英雄主图、局部细节、使用场景和商业 KV 四类画面逻辑，保证主体外观一致，避免每张像不同产品。",
  },
  characterConsistency: {
    group: "case",
    name: "角色一致性",
    desc: "适合人像、IP、连续内容",
    instruction: "使用角色一致性技法：明确角色年龄、发型、服装、五官特征、姿态和标志性道具，多方案中保持同一身份，不随场景变化而换脸或换设定。",
  },
  referenceRestage: {
    group: "edit",
    name: "参考图再编排",
    desc: "保留参考主体，重做场景和构图",
    instruction: "使用参考图再编排技法：如果上传了参考图，优先保留主体身份、结构、颜色和关键细节，只重做背景、光线、构图、道具和商业氛围。",
  },
  localRedraw: {
    group: "edit",
    name: "局部重绘",
    desc: "只改指定区域，其他保持不变",
    instruction: "使用局部重绘技法：明确只修改目标区域或目标元素，周围主体、比例、材质和视角保持不变，避免全图风格漂移。",
  },
};

const promptSkillGroups = [
  { id: "base", title: "基础技法", desc: "主体、卖点、材质、构图" },
  { id: "case", title: "案例灵感包", desc: "来自优秀 GPT Image 案例的可复用方法" },
  { id: "edit", title: "图生图 / 编辑", desc: "参考图再生成、局部重绘和一致性控制" },
];

const defaultPromptSkills = {
  commerce: ["productHero", "benefitVisual", "macroDetail", "caseMiniatureDiorama", "caseMultiAngleSet", "referenceRestage"],
  xiaohongshu: ["coverHook", "lifestyleScene", "flatlayKit", "caseSocialMockup", "caseFormulaPrompt", "beforeAfter"],
  "short-video": ["coverHook", "caseStoryboardGrid", "caseVisualMetaphor", "beforeAfter", "lifestyleScene", "benefitVisual"],
  poster: ["kvLayout", "casePosterNarrative", "caseVisualMetaphor", "benefitVisual", "premiumLuxury", "infographic"],
  interior: ["lifestyleScene", "premiumLuxury", "benefitVisual", "ugcReal", "referenceRestage"],
  portrait: ["premiumLuxury", "characterConsistency", "lifestyleScene", "coverHook", "ugcReal"],
  food: ["productHero", "macroDetail", "caseStoryboardGrid", "lifestyleScene", "caseFormulaPrompt", "coverHook"],
  saas: ["uiMockup", "caseSocialMockup", "kvLayout", "infographic", "caseVisualMetaphor", "benefitVisual"],
  custom: ["productHero", "benefitVisual", "referenceRestage", "caseStoryboardGrid", "caseFormulaPrompt", "kvLayout"],
};

const industryAgents = [
  {
    id: "commerce",
    icon: "商",
    name: "电商商品图",
    meta: "商业高频 · 1:1",
    aspectRatio: "1:1",
    count: 4,
    negative: "低清晰度，主体变形，错误文字，杂乱背景，比例失真，廉价模板感，过度锐化，AI伪影，商品变形，过度反光，低质感，道具喧宾夺主",
    prompt: "电商商品主图，突出商品卖点和材质质感，干净商业摄影布光，主体清晰，背景简洁，构图适合电商首图。",
    goals: ["商品主图", "场景图", "详情页配图"],
    fields: {
      subjectLabel: "商品名称 · 建议",
      subject: "现代消费电子产品",
      materialLabel: "材质 / 颜色",
      material: "磨砂金属与细腻织物纹理",
      sellingPoint: "高质感、主体清晰、材质真实、平台可直接使用",
      sceneLabel: "使用场景",
      sceneOptions: ["纯净棚拍", "居家桌面", "礼盒场景", "户外生活方式", "高级灰背景"],
      platformLabel: "目标平台",
      platformOptions: ["电商主图", "电商详情页", "品牌官网", "广告投放", "私域海报"],
      holdLabel: "留白位置",
      holdOptions: ["不需要", "上方留白", "左侧留白", "右侧留白", "底部留白"],
      tags: ["商业摄影布光", "商品占比明确", "材质细节清晰", "背景干净", "适合电商合规构图", "验收：商品完整清晰", "验收：主体占比明确", "验收：材质真实", "验收：背景干净", "验收：适合电商平台"],
    },
  },
  {
    id: "xiaohongshu",
    icon: "封",
    name: "小红书封面",
    meta: "社媒增长 · 4:5",
    aspectRatio: "4:5",
    count: 4,
    negative: "低清、杂乱排版、错别字、过度磨皮、廉价贴纸感",
    prompt: "小红书笔记封面，强标题留白，清爽种草氛围，高点击率社媒构图，画面有生活方式质感。",
    goals: ["笔记封面", "种草图", "干货图"],
    fields: {
      subjectLabel: "主题 / 产品",
      subject: "春季生活方式好物",
      materialLabel: "画面情绪",
      material: "明亮、清爽、有种草感",
      sellingPoint: "封面信息清晰，适合标题留白，手机端缩略图可读",
      sceneLabel: "封面类型",
      sceneOptions: ["种草封面", "干货清单", "教程步骤", "对比测评"],
      platformLabel: "目标平台",
      platformOptions: ["小红书封面", "朋友圈配图", "社媒广告", "竖版海报"],
      holdLabel: "标题留白",
      holdOptions: ["顶部留白", "中部留白", "左侧留白", "不需要"],
      tags: ["高点击封面", "清爽排版", "标题留白", "移动端优先", "生活方式质感", "验收：主体明确", "验收：留白可放标题", "验收：不杂乱"],
    },
  },
  {
    id: "short-video",
    icon: "视",
    name: "短视频封面",
    meta: "高点击 · 9:16",
    aspectRatio: "9:16",
    count: 4,
    negative: "低清、主体太小、信息不清、文字错误、画面拥挤",
    prompt: "短视频竖屏封面，一秒能看懂主题，强主体、强对比、适合抖音/TikTok/Reels 的高点击首帧。",
    goals: ["抖音封面", "Reels 封面", "Shorts 首帧"],
    fields: {
      subjectLabel: "视频主题",
      subject: "爆款教程短视频封面",
      materialLabel: "视觉强度",
      material: "强对比、大主体、清晰动作瞬间",
      sellingPoint: "一眼看懂主题，主体足够大，适合竖屏信息流停留",
      sceneLabel: "封面场景",
      sceneOptions: ["教程封面", "剧情首帧", "产品展示", "人物反应"],
      platformLabel: "目标平台",
      platformOptions: ["抖音封面", "TikTok 封面", "Reels 封面", "Shorts 封面"],
      holdLabel: "字幕区域",
      holdOptions: ["顶部留白", "底部留白", "左右留白", "不需要"],
      tags: ["竖屏构图", "高对比", "强主体", "一秒读懂", "信息流封面", "验收：主体不小", "验收：画面不拥挤"],
    },
  },
  {
    id: "poster",
    icon: "品",
    name: "品牌海报",
    meta: "主视觉 · 4:5",
    aspectRatio: "4:5",
    count: 4,
    negative: "低清、廉价素材、文字错误、Logo 变形、颜色混乱",
    prompt: "品牌活动海报主视觉，高级商业设计，明确视觉焦点，留出文案区域，色彩秩序统一，适合发布会或官网头图。",
    goals: ["活动海报", "发布会图", "官网头图"],
    fields: {
      subjectLabel: "活动 / 品牌主题",
      subject: "新品发布品牌主视觉",
      materialLabel: "品牌调性",
      material: "克制高级、现代商业、秩序感强",
      sellingPoint: "主视觉聚焦，层级清楚，可承载活动标题和品牌信息",
      sceneLabel: "海报类型",
      sceneOptions: ["新品发布", "促销活动", "品牌形象", "线下物料"],
      platformLabel: "投放位置",
      platformOptions: ["官网头图", "活动海报", "门店屏幕", "社媒宣发"],
      holdLabel: "文案区域",
      holdOptions: ["顶部留白", "右侧留白", "底部留白", "不需要"],
      tags: ["品牌主视觉", "文案留白", "高级商业感", "视觉焦点明确", "色彩统一", "验收：层级清楚", "验收：适合放标题"],
    },
  },
  {
    id: "interior",
    icon: "室",
    name: "室内空间",
    meta: "设计灵感 · 4:3",
    aspectRatio: "4:3",
    count: 4,
    negative: "低清、空间扭曲、家具畸形、光线不真实、过度广角",
    prompt: "室内空间设计灵感图，空间层次清晰，真实自然光，材质细节丰富，镜头焦段自然，适合软装方案展示。",
    goals: ["空间效果图", "软装方案", "空间灵感"],
    fields: {
      subjectLabel: "空间类型",
      subject: "现代客厅软装方案",
      materialLabel: "材质 / 色系",
      material: "木质、亚麻、低饱和暖灰色",
      sellingPoint: "空间真实，材质细节明确，软装搭配可落地",
      sceneLabel: "空间风格",
      sceneOptions: ["现代简约", "中古风", "奶油风", "商业空间"],
      platformLabel: "用途",
      platformOptions: ["设计方案", "灵感图", "客户提案", "社媒案例"],
      holdLabel: "构图重点",
      holdOptions: ["全景展示", "局部特写", "左侧留白", "不需要"],
      tags: ["真实自然光", "空间层次", "材质清晰", "焦段自然", "软装可落地", "验收：空间不扭曲", "验收：家具比例正确"],
    },
  },
  {
    id: "portrait",
    icon: "人",
    name: "人像写真",
    meta: "人物形象 · 3:4",
    aspectRatio: "3:4",
    count: 4,
    negative: "低清、五官畸形、手部错误、过度磨皮、眼神不自然",
    prompt: "人像写真，真实自然肤色，干净背景，专业摄影布光，姿态自然，适合头像、半身写真或商务形象照。",
    goals: ["头像", "半身写真", "商务形象照"],
    fields: {
      subjectLabel: "人物设定",
      subject: "自然真实的商务半身人像",
      materialLabel: "服装 / 氛围",
      material: "简洁服装、柔和自然光、干净背景",
      sellingPoint: "面部真实自然，姿态放松，适合头像和形象照",
      sceneLabel: "拍摄类型",
      sceneOptions: ["商务头像", "生活写真", "半身肖像", "社媒头像"],
      platformLabel: "使用位置",
      platformOptions: ["头像", "个人主页", "宣传物料", "社媒封面"],
      holdLabel: "构图",
      holdOptions: ["半身居中", "头像特写", "右侧留白", "不需要"],
      tags: ["真实肤色", "自然眼神", "专业布光", "干净背景", "姿态自然", "验收：五官正常", "验收：手部不畸形"],
    },
  },
  {
    id: "food",
    icon: "食",
    name: "餐饮美食",
    meta: "菜单转化 · 1:1",
    aspectRatio: "1:1",
    count: 4,
    negative: "低清、食物不新鲜、颜色脏、餐具畸形、油腻过度",
    prompt: "餐饮美食宣传图，食物新鲜诱人，真实餐桌布光，突出食材质感和卖点，适合菜单、外卖和社媒推广。",
    goals: ["菜单图", "外卖主图", "门店海报"],
    fields: {
      subjectLabel: "菜品名称",
      subject: "招牌热卖餐品",
      materialLabel: "食材 / 色彩",
      material: "新鲜食材、油亮但不过度、暖色食欲感",
      sellingPoint: "食物新鲜诱人，主体突出，适合菜单和外卖转化",
      sceneLabel: "拍摄场景",
      sceneOptions: ["菜单主图", "餐桌氛围", "外卖主图", "门店海报"],
      platformLabel: "目标平台",
      platformOptions: ["外卖平台", "菜单", "社媒推广", "门店屏幕"],
      holdLabel: "文案位置",
      holdOptions: ["顶部留白", "右侧留白", "底部留白", "不需要"],
      tags: ["食欲感", "食材新鲜", "餐桌布光", "主体突出", "菜单可用", "验收：颜色自然", "验收：餐具不畸形"],
    },
  },
  {
    id: "saas",
    icon: "软",
    name: "App / SaaS 宣传图",
    meta: "科技营销 · 16:9",
    aspectRatio: "16:9",
    count: 4,
    negative: "低清、界面杂乱、文字错误、过度科幻、比例失衡",
    prompt: "App / SaaS 产品宣传图，现代科技营销视觉，界面展示清晰，品牌感强，适合官网首屏和产品发布配图。",
    goals: ["官网头图", "产品发布图", "功能展示图"],
    fields: {
      subjectLabel: "产品名称 / 类型",
      subject: "AI SaaS 产品发布视觉",
      materialLabel: "界面 / 品牌色",
      material: "清晰产品界面、克制科技感、浅色背景",
      sellingPoint: "界面清楚，产品价值突出，适合官网首屏和发布图",
      sceneLabel: "宣传类型",
      sceneOptions: ["官网首屏", "功能展示", "发布海报", "社媒横图"],
      platformLabel: "目标位置",
      platformOptions: ["官网", "Product Hunt", "社媒", "产品发布"],
      holdLabel: "文案留白",
      holdOptions: ["左侧留白", "右侧留白", "顶部留白", "不需要"],
      tags: ["界面清晰", "科技营销", "品牌感", "浅色高级", "适合官网", "验收：文字不乱", "验收：界面不杂"],
    },
  },
];

const guideSteps = [
  {
    label: "首次使用 · 第 1 步 / 3",
    title: "连接你的生图服务",
    body: "先在右侧配置里选择服务地址并填入 API Key。地址已被限制为两个固定入口，避免请求落到未知服务。",
    hint: "等待填写 API Key",
    cls: "guide-step-config",
    next: "下一步 →",
  },
  {
    label: "首次使用 · 第 2 步 / 3",
    title: "读取并选择模型",
    body: "点击读取模型列表，只能从接口返回的模型中选择。模型就绪后，顶部会显示已连接状态。",
    hint: "填写 API Key 后自动验证",
    cls: "guide-step-model",
    next: "下一步 →",
  },
  {
    label: "首次使用 · 第 3 步 / 3",
    title: "输入提示词并生成",
    body: "回到底部输入框描述画面，选择宽高比、分辨率、张数和并发。提交后提示词会在发送动画完成后自动清空。",
    hint: "等待提示词、模型和比例就绪",
    cls: "guide-step-compose",
    next: "完成引导",
  },
];

function requestSizeFor(aspectRatio, resolution) {
  if (isGptImage2Model(els.model?.value)) {
    return gptImage2SizeFor(aspectRatio, resolution);
  }
  const baseSize = aspectSizes[aspectRatio] || aspectSizes["1:1"];
  const multiplier = resolutionMultipliers[resolution] || 1;
  if (multiplier === 1) return baseSize;
  const [width, height] = baseSize.split("x").map(Number);
  return `${Math.round(width * multiplier)}x${Math.round(height * multiplier)}`;
}

function requestSize() {
  if (document.body.classList.contains("commerce-active")) {
    const explicitCommerceSize = commerceExplicitSizeValue();
    if (explicitCommerceSize) return explicitCommerceSize;
  }
  return requestSizeFor(els.aspectRatio.value, els.resolution.value);
}

function parseAspectRatioValue(value = "") {
  const match = String(value || "").match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}

function selectedReferenceItems() {
  return state.references.filter((ref) => selectedReferenceIds.has(ref.id));
}

function singleReferenceAspect() {
  const refs = selectedReferenceItems();
  if (refs.length !== 1) return null;
  const ref = refs[0];
  const width = Number(ref.width || 0);
  const height = Number(ref.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { ref, ratio: width / height, label: `${width}x${height}` };
}

function closestAspectOptionForRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0 || !els.aspectRatio) return "";
  let best = "";
  let bestDistance = Infinity;
  [...els.aspectRatio.options].forEach((option) => {
    const optionRatio = parseAspectRatioValue(option.value);
    if (!optionRatio) return;
    const distance = Math.abs(Math.log(ratio / optionRatio));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option.value;
    }
  });
  return best;
}

function referenceAspectCandidate() {
  const aspect = singleReferenceAspect();
  if (!aspect) return null;
  const value = closestAspectOptionForRatio(aspect.ratio);
  return value ? { ...aspect, value } : null;
}

function applyReferenceAspectRatio({ announce = false } = {}) {
  const candidate = referenceAspectCandidate();
  if (!candidate) {
    if (announce) showReferenceLimitHint("仅选中 1 张带尺寸信息的参考图时，才能按参考图比例生成");
    return false;
  }
  referenceAspectSyncing = true;
  els.aspectRatio.value = candidate.value;
  if (els.quickAspect) els.quickAspect.value = candidate.value;
  referenceAspectAutoValue = candidate.value;
  referenceAspectAutoEnabled = true;
  referenceAspectSyncing = false;
  syncSummary();
  if (announce) {
    showReferenceLimitHint(`已按参考图 ${candidate.label} 匹配为 ${candidate.value}`);
  }
  return true;
}

function syncReferenceAspectAuto({ announce = false } = {}) {
  const candidate = referenceAspectCandidate();
  if (!candidate) {
    referenceAspectAutoValue = "";
    return false;
  }
  if (!referenceAspectAutoEnabled) return false;
  if (els.aspectRatio.value !== candidate.value || referenceAspectAutoValue !== candidate.value) {
    return applyReferenceAspectRatio({ announce });
  }
  referenceAspectAutoValue = candidate.value;
  return true;
}

function syncReferenceAspectControl() {
  if (!els.matchReferenceAspect) return;
  const refs = selectedReferenceItems();
  const candidate = referenceAspectCandidate();
  const disabledReason = refs.length > 1
    ? "多张参考图比例可能不一致，仅单张可用"
    : refs.length === 1
      ? "参考图缺少尺寸信息"
      : "先选择 1 张参考图";
  els.matchReferenceAspect.classList.toggle("hidden", refs.length !== 1);
  els.matchReferenceAspect.disabled = !candidate;
  els.matchReferenceAspect.classList.toggle("off", Boolean(candidate && !referenceAspectAutoEnabled));
  els.matchReferenceAspect.textContent = candidate
    ? (referenceAspectAutoEnabled ? `自适应开 · ${candidate.value}` : `自适应关 · ${candidate.value}`)
    : "按参考图比例";
  els.matchReferenceAspect.title = candidate
    ? (referenceAspectAutoEnabled
      ? `参考图 ${candidate.label}，生成比例已自适应为 ${candidate.value}；点击可重新应用`
      : `参考图 ${candidate.label}，点击恢复自适应为 ${candidate.value}`)
    : disabledReason;
}

function describeAspect() {
  const candidate = referenceAspectCandidate();
  if (candidate && referenceAspectAutoEnabled && els.aspectRatio.value === candidate.value) {
    return `单张参考图自适应 · 原图 ${candidate.label}`;
  }
  const labels = {
    "1:1": "GPT Image 官方方图尺寸",
    "4:5": "竖版社媒封面常用比例",
    "5:4": "横版产品展示比例",
    "3:4": "竖版照片与人物构图",
    "4:3": "经典横图和场景展示",
    "2:3": "海报与详情页竖图",
    "3:2": "相机横幅与产品场景",
    "9:16": "手机竖屏与短视频封面",
    "16:9": "宽屏封面和官网头图",
    "21:9": isGptImage2Model(els.model?.value) ? "GPT Image 2 合法超宽构图" : "超宽视觉横幅",
    "9:21": isGptImage2Model(els.model?.value) ? "GPT Image 2 合法长竖构图" : "长竖屏沉浸构图",
    "4:1": isGptImage2Model(els.model?.value) ? "GPT Image 2 会压到 3:1 内" : "横向长图 Banner",
    "1:4": isGptImage2Model(els.model?.value) ? "GPT Image 2 会压到 1:3 内" : "纵向长图物料",
    "8:1": isGptImage2Model(els.model?.value) ? "GPT Image 2 不支持 8:1，会压到 3:1 内" : "超长横幅",
    "1:8": isGptImage2Model(els.model?.value) ? "GPT Image 2 不支持 1:8，会压到 1:3 内" : "超长竖幅",
  };
  return labels[els.aspectRatio.value] || "按当前模型合法尺寸发送";
}

function describeResolution() {
  const descriptions = {
    "1K": ["速度优先，适合批量预览", isGptImage2Model(els.model?.value) ? "GPT Image 2 会发送 16 倍数且合法像素范围内的 size" : "当前模型会优先使用上游合法 size，避免不合法尺寸报错"],
    "2K": ["细节更稳，适合正式方案筛选", isGptImage2Model(els.model?.value) ? "GPT Image 2 会按比例放大并限制最大边 3840px" : "会按当前比例放大请求尺寸，失败时建议回到 1K"],
    "4K": ["高细节输出，适合最终物料", isGptImage2Model(els.model?.value) ? "GPT Image 2 会自动压到最大 3840px 且不超过 8294400 像素" : "仅在上游模型支持时使用，成本和耗时更高"],
  };
  return descriptions[els.resolution.value] || descriptions["1K"];
}

function syncQualityOptionsForModel() {
  if (!els.quality) return;
  const current = els.quality.value || "auto";
  const options = isGptImage2Model(els.model?.value)
    ? [["auto", "auto"], ["low", "low"], ["medium", "medium"], ["high", "high"]]
    : [["auto", "auto"], ["standard", "standard"], ["high", "high"], ["hd", "hd"]];
  const values = options.map(([value]) => value);
  if ([...els.quality.options].map((option) => option.value).join("|") !== values.join("|")) {
    els.quality.innerHTML = "";
    options.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      els.quality.append(option);
    });
  }
  els.quality.value = values.includes(current) ? current : (current === "hd" ? "high" : "auto");
  if (els.quickQuality) {
    els.quickQuality.innerHTML = "";
    copyOptions(els.quality, els.quickQuality);
    els.quickQuality.value = els.quality.value;
  }
}

function copyOptions(source, target) {
  if (!source || !target || target.options.length) return;
  [...source.options].forEach((option) => {
    const clone = document.createElement("option");
    clone.value = option.value;
    clone.textContent = option.textContent;
    target.append(clone);
  });
}

function ensureQuickConfigOptions() {
  copyOptions(els.aspectRatio, els.quickAspect);
  copyOptions(els.resolution, els.quickResolution);
  copyOptions(els.quality, els.quickQuality);
  copyOptions(els.outputFormat, els.quickFormat);
}

function syncQuickConfigControls() {
  ensureQuickConfigOptions();
  if (els.quickCount) els.quickCount.value = els.count.value;
  if (els.quickAspect) els.quickAspect.value = els.aspectRatio.value;
  if (els.quickResolution) els.quickResolution.value = els.resolution.value;
  if (els.quickConcurrency) els.quickConcurrency.value = els.concurrency.value;
  if (els.quickQuality) els.quickQuality.value = els.quality.value;
  if (els.quickFormat) els.quickFormat.value = els.outputFormat.value;
}

function clampNumberInput(input, fallback, min, max) {
  const value = Number.parseInt(input?.value, 10);
  const next = Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  if (input) input.value = String(next);
  return next;
}

function readNumberInput(input, fallback, min, max) {
  const value = Number.parseInt(input?.value, 10);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
}

function recommendedConcurrency(count) {
  const value = Number.parseInt(count, 10);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(value, 20));
}

function syncConcurrencyToCount({ commit = false } = {}) {
  if (!els.count || !els.concurrency) return;
  const count = commit ? clampNumberInput(els.count, 1, 1, 20) : readNumberInput(els.count, 1, 1, 20);
  const next = recommendedConcurrency(count);
  els.concurrency.value = String(next);
  if (commit && els.quickCount) els.quickCount.value = String(count);
  if (els.quickConcurrency) els.quickConcurrency.value = String(next);
}

function normalizeGenerationNumbers() {
  const count = clampNumberInput(els.count, 1, 1, 20);
  const concurrency = recommendedConcurrency(count);
  if (els.concurrency) els.concurrency.value = String(concurrency);
  const retryLimit = clampNumberInput(els.retryLimit, 2, 0, 5);
  if (els.quickCount) els.quickCount.value = String(count);
  if (els.quickConcurrency) els.quickConcurrency.value = String(concurrency);
  return { count, concurrency, retryLimit };
}

function quickConfigTitle() {
  return `打开生成配置：${readNumberInput(els.count, 1, 1, 20)}张 · ${els.aspectRatio.value} · ${els.resolution.value} · ${requestSize()} · ${els.outputFormat.value.toUpperCase()} · 并发 ${els.concurrency.value}`;
}

function applyModelConfigToUi() {
  if (!modelConfig.connections) return;
  els.connectionButtons.forEach((button) => {
    const item = modelConfig.connections[button.dataset.connectionMode];
    if (!item) return;
    button.innerHTML = `<strong>${escapeHtml(item.label || button.dataset.connectionMode)}</strong><span>${escapeHtml(item.badge || "")}</span>`;
    button.hidden = item.enabled === false;
  });
}

function normalizeConnectionMode(mode) {
  const requested = String(mode || "custom").trim() || "custom";
  const button = Array.from(els.connectionButtons).find((item) => item.dataset.connectionMode === requested);
  if (button && !button.hidden) return requested;
  const customButton = Array.from(els.connectionButtons).find((item) => item.dataset.connectionMode === "custom");
  if (customButton && !customButton.hidden) return "custom";
  return Array.from(els.connectionButtons).find((item) => !item.hidden)?.dataset.connectionMode || "custom";
}

function setQuickConfigPanel(open) {
  syncQuickConfigControls();
  els.quickConfigPanel?.classList.toggle("hidden", !open);
  els.composer?.classList.toggle("quick-config-open", open);
}

function syncPromptTextareaSize() {
  if (!els.prompt) return;
  const hasPrompt = Boolean(els.prompt.value.trim());
  const viewport = window.innerHeight || document.documentElement.clientHeight || 720;
  const maxHeight = Math.max(96, Math.min(hasPrompt ? 220 : 132, Math.round(viewport * (hasPrompt ? 0.24 : 0.18))));
  els.prompt.style.height = "auto";
  const nextHeight = hasPrompt
    ? Math.min(Math.max(els.prompt.scrollHeight, 96), maxHeight)
    : Math.min(Math.max(els.prompt.scrollHeight, 44), maxHeight);
  els.prompt.style.height = `${nextHeight}px`;
  els.prompt.style.overflowY = els.prompt.scrollHeight > nextHeight + 2 ? "auto" : "hidden";
  els.composer?.classList.toggle("prompt-expanded", hasPrompt && nextHeight >= 128);
}

function syncSummary() {
  syncReferenceAspectAuto();
  syncConcurrencyToCount({ commit: false });
  syncQualityOptionsForModel();
  const protocol = protocols[els.protocol.value] || protocols["custom-openai"];
  const hasPrompt = Boolean(els.prompt.value.trim());
  els.composer?.classList.toggle("has-prompt", hasPrompt);
  syncPromptTextareaSize();
  els.compatLabel.textContent = els.model.value || "未选择";
  els.protocolTitle.textContent = protocol.shortLabel;
  els.protocolDescription.textContent = protocol.description;
  els.protocolSupport.textContent = protocol.support;
  els.connectionNote.textContent = connectionNotes[els.connectionMode.value] || connectionNotes.custom;
  els.protocolSummary.textContent = `${protocol.shortLabel} · ${requestSize()}`;
  const displayCount = String(readNumberInput(els.count, 1, 1, 20));
  els.countSummary.textContent = `${displayCount}张 · ${els.aspectRatio.value} · ${els.resolution.value} · ${els.outputFormat.value.toUpperCase()}`;
  if (els.quickConfigButton) {
    els.quickConfigButton.textContent = `☷ ${displayCount}张 ${els.aspectRatio.value} ${els.resolution.value}`;
    els.quickConfigButton.title = quickConfigTitle();
    els.quickConfigButton.setAttribute("aria-label", quickConfigTitle());
  }
  els.wordCount.textContent = `${els.prompt.value.trim().length} 字`;
  if (els.aspectSummary) {
    els.aspectSummary.innerHTML = `
      <strong>${escapeHtml(els.aspectRatio.value)}</strong>
      <span>${escapeHtml(describeAspect())}</span>
      <small>${escapeHtml(els.resolution.value)} · 请求尺寸 ${escapeHtml(requestSize())}</small>
    `;
  }
  if (els.resolutionSummary) {
    const [title, body] = describeResolution();
    els.resolutionSummary.innerHTML = `
      <strong>${escapeHtml(els.resolution.value)}</strong>
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(body)}</small>
    `;
  }
  if (els.promptAnalysisCard && !els.promptAnalysisCard.classList.contains("hidden")) {
    if (els.analysisAspect) els.analysisAspect.textContent = els.aspectRatio.value;
    if (els.analysisSize) els.analysisSize.textContent = requestSize();
  }
  [els.optimizePrompt, els.recommendParams, els.predictFailure, els.enhanceStyle].forEach((button) => {
    if (button) button.disabled = !hasPrompt;
  });
  syncQuickConfigControls();
  syncReferenceAspectControl();
}

function setConnectionMode(mode, options = {}) {
  mode = normalizeConnectionMode(mode);
  els.connectionMode.value = mode;
  els.connectionMode.setAttribute("value", mode);
  if (options.persist) {
    localStorage.setItem(CONNECTION_MODE_STORAGE_KEY, mode);
  }
  els.connectionButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.connectionMode === mode);
  });
  if (mode === "custom") {
    els.apiUrl.value = storedCustomApiUrl() || connectionEndpoints.custom || DEFAULT_CUSTOM_API_URL;
  } else if (connectionEndpoints[mode]) {
    els.apiUrl.value = connectionEndpoints[mode];
  }
  els.apiUrl.readOnly = mode === "pool";
  if (els.apiKey) {
    els.apiKey.disabled = mode === "pool";
    els.apiKey.placeholder = mode === "pool" ? "本地号池无需 API Key" : "sk-... 或 New API Token";
  }
  if (els.apiUrl) {
    els.apiUrl.placeholder = mode === "custom" ? "填写云端 OpenAI 兼容 API 地址" : "OpenAI 兼容 API 地址";
  }
  if (els.rememberApiKey) {
    els.rememberApiKey.disabled = mode === "pool";
  }
  renderDebugApiState();
  renderPoolUser();
  syncSummary();
}

function renderDebugApiState() {
  const isCustom = els.connectionMode?.value === "custom";
  const active = Boolean(isCustom && debugCustomApi.enabled);
  els.debugApiBanner?.classList.toggle("hidden", !active);
  if (active && els.apiUrl) {
    els.apiUrl.value = debugCustomApi.image?.apiUrl || debugCustomApi.apiUrl || connectionEndpoints.custom || DEFAULT_CUSTOM_API_URL;
  }
  if (els.apiKey) {
    const useBackendKey = active && debugCustomApi.hasApiKey;
    els.apiKey.disabled = els.connectionMode?.value === "pool" || useBackendKey;
    if (useBackendKey) els.apiKey.value = "";
    if (useBackendKey) {
      els.apiKey.placeholder = "调试中无需填写，后端使用管理后台 Key";
    }
  }
  if (els.rememberApiKey && active) {
    els.rememberApiKey.checked = false;
    els.rememberApiKey.disabled = true;
  }
}

function selectedApiUrl() {
  return els.connectionMode.value === "pool" ? "" : (els.apiUrl.value.trim() || DEFAULT_CUSTOM_API_URL);
}

function selectedApiKey() {
  if (els.connectionMode.value === "pool") return "";
  if (adminDebugApiActive()) return "";
  return els.apiKey.value.trim();
}

function adminDebugApiActive() {
  return Boolean(els.connectionMode.value === "custom" && debugCustomApi.enabled && debugCustomApi.hasApiKey);
}

function debugTextRouteActive() {
  return Boolean(els.connectionMode.value === "custom" && debugCustomApi.enabled && debugCustomApi.text?.hasApiKey);
}

function loadApiKeyPreference() {
  const saved = localStorage.getItem("yangyang_image_api_key") || "";
  if (saved) {
    els.apiKey.value = saved;
    els.rememberApiKey.checked = true;
  }
  const textUrl = localStorage.getItem(TEXT_API_URL_KEY) || "";
  const textKey = localStorage.getItem(TEXT_API_KEY_STORAGE_KEY) || "";
  if (textUrl && els.textApiUrl) els.textApiUrl.value = textUrl;
  if (textKey && els.textApiKey) els.textApiKey.value = textKey;
  if (els.sendOptimize) {
    els.sendOptimize.checked = localStorage.getItem(SEND_OPTIMIZE_KEY) === "1";
  }
  syncTextApiKeyStatus();
}

function saveApiKeyPreference() {
  if (els.connectionMode.value === "pool") return;
  if (adminDebugApiActive()) return;
  if (els.connectionMode.value === "custom" && els.apiUrl.value.trim()) {
    localStorage.setItem(CUSTOM_API_URL_KEY, els.apiUrl.value.trim());
  }
  if (els.rememberApiKey.checked && selectedApiKey()) {
    localStorage.setItem("yangyang_image_api_key", selectedApiKey());
  } else {
    localStorage.removeItem("yangyang_image_api_key");
  }
}

function setModelStatus(message, tone = "idle") {
  if (!els.modelStatus) return;
  els.modelStatus.textContent = message;
  els.modelStatus.classList.toggle("success", tone === "success");
  els.modelStatus.classList.toggle("error", tone === "error");
  els.modelStatus.classList.toggle("loading", tone === "loading");
}

function setModelFetchHelp(message = "", tone = "idle") {
  if (!els.modelFetchHelp) return;
  els.modelFetchHelp.textContent = message || "API Key 可在云端 New API 后台的“令牌”里创建或复制；如读取失败，请检查自定义 API 地址、Token 和模型权限。";
  els.modelFetchHelp.classList.toggle("error", tone === "error");
  els.modelFetchHelp.classList.toggle("success", tone === "success");
}

function setConnectionStatus(message, tone = "idle") {
  if (!els.connectionStatus) return;
  els.connectionStatus.textContent = message;
  els.connectionStatus.classList.toggle("success", tone === "success");
  els.connectionStatus.classList.toggle("error", tone === "error");
  els.connectionStatus.classList.toggle("loading", tone === "loading");
}

function activePoolUser() {
  return state.pool_user || null;
}

function renderPoolUser() {
  if (!els.poolLoginPanel) return;
  const isPoolMode = els.connectionMode?.value === "pool";
  const user = activePoolUser();
  els.poolLoginPanel.classList.toggle("hidden", !isPoolMode);
  if (els.poolUserName) {
    els.poolUserName.textContent = user ? `${user.display_name || user.username} · 已登录` : "号池用户未登录";
  }
  if (els.poolUserHint) {
    const pool = state.account_pool || {};
    const okCount = Number(pool.ok || 0);
    els.poolUserHint.textContent = user
      ? `当前账号：${user.username}，可用底层账号 ${okCount} 个`
      : "输入后台创建的号池用户名和密码后，才能使用本地号池生成";
  }
  els.poolUsername?.classList.toggle("hidden", Boolean(user));
  els.poolPassword?.classList.toggle("hidden", Boolean(user));
  els.poolLoginButton?.classList.toggle("hidden", Boolean(user));
  els.poolLogoutButton?.classList.toggle("hidden", !user);
}

async function loginPoolUser() {
  const username = els.poolUsername?.value.trim() || "";
  const password = els.poolPassword?.value || "";
  if (!username) {
    els.poolUsername?.focus();
    return;
  }
  if (!password) {
    els.poolPassword?.focus();
    return;
  }
  els.poolLoginButton.disabled = true;
  try {
    const data = await api("/api/pool/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    state.pool_user = data.user || null;
    if (data.account_pool) state.account_pool = data.account_pool;
    if (els.poolPassword) els.poolPassword.value = "";
    renderPoolUser();
    await refreshModels({ silent: true });
  } catch (err) {
    setModelStatus(`号池登录失败：${err.message}`, "error");
    setConnectionStatus("号池登录失败", "error");
  } finally {
    els.poolLoginButton.disabled = false;
  }
}

function jobIndustry(job) {
  const name = String(job.agent_name || "").trim();
  const id = String(job.agent_id || "").trim();
  if (job.agent_enabled && name) {
    return {
      id: id || `agent:${name}`,
      name,
      variant: String(job.agent_variant || "").trim(),
      source: "agent",
    };
  }
  if (Array.isArray(job.reference_ids) && job.reference_ids.length) {
    return { id: "reference", name: "参考生图", variant: "", source: "reference" };
  }
  return { id: "general", name: "通用生图", variant: "", source: "general" };
}

function titleMatchesIndustryAgent(title = "") {
  const value = String(title || "").trim();
  return Boolean(value && availableIndustryAgents().some((agent) => agent.name === value));
}

function syncTextApiKeyStatus(message = "") {
  const hasBackendKey = debugTextRouteActive();
  const hasTextKey = hasBackendKey || Boolean((els.textApiKey?.value || localStorage.getItem(TEXT_API_KEY_STORAGE_KEY) || "").trim());
  if (els.textApiKeyStatus) {
    els.textApiKeyStatus.textContent = message || (hasBackendKey ? "管理后台文本 Key 已配置" : (hasTextKey ? "文本 Key 已配置" : "未配置文本 Key"));
    els.textApiKeyStatus.classList.toggle("success", hasTextKey);
    els.textApiKeyStatus.classList.toggle("error", !hasTextKey && Boolean(message));
  }
  if (els.textApiKey && hasTextKey && !hasBackendKey) {
    els.textApiKey.placeholder = "•••••••• 已保存文本 Key";
  }
}

function saveTextApiPreference() {
  if (els.textApiUrl && !els.reuseTextApiUrl?.checked && els.textApiUrl.value.trim()) {
    localStorage.setItem(TEXT_API_URL_KEY, els.textApiUrl.value.trim());
  }
  if (els.textApiKey && !els.reuseTextApiKey?.checked && els.textApiKey.value.trim()) {
    localStorage.setItem(TEXT_API_KEY_STORAGE_KEY, els.textApiKey.value.trim());
  }
  if (els.manualTextModel?.value.trim()) {
    localStorage.setItem(MANUAL_TEXT_MODEL_KEY, els.manualTextModel.value.trim());
  }
  syncTextApiKeyStatus();
}

function canAutoRefreshTextModels() {
  return Boolean(
    els.manualTextModelPanel &&
    !els.manualTextModelPanel.classList.contains("hidden") &&
    !els.reuseTextApiKey?.checked &&
    selectedTextApiUrl() &&
    selectedTextApiKey()
  );
}

function scheduleTextModelRefresh({ immediate = false } = {}) {
  window.clearTimeout(textModelRefreshTimer);
  saveTextApiPreference();
  if (!canAutoRefreshTextModels()) return;
  textModelRefreshTimer = window.setTimeout(() => {
    refreshTextModelsOnly({ silent: true });
  }, immediate ? 0 : 650);
}

function displayJobTitle(job = {}) {
  const rawTitle = String(job.title || "").trim();
  const industry = jobIndustry(job);
  if (rawTitle && industry.source !== "agent" && titleMatchesIndustryAgent(rawTitle)) {
    return String(job.prompt || "").trim() || "未命名任务";
  }
  const titleLooksLikeDifferentAgent = rawTitle
    && industry.source === "agent"
    && rawTitle !== industry.name
    && availableIndustryAgents().some((agent) => agent.name === rawTitle);
  if (titleLooksLikeDifferentAgent) {
    return industry.name;
  }
  return rawTitle || String(job.prompt || "").trim() || "未命名任务";
}

function compactText(value = "") {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadCustomIndustryAgents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_INDUSTRY_AGENTS_KEY) || "[]");
    customIndustryAgents = Array.isArray(parsed) ? parsed.filter((agent) => agent && String(agent.id || "").startsWith("custom-")).slice(0, 30) : [];
  } catch {
    customIndustryAgents = [];
  }
}

function saveCustomIndustryAgents() {
  try {
    localStorage.setItem(CUSTOM_INDUSTRY_AGENTS_KEY, JSON.stringify(customIndustryAgents.slice(0, 30)));
  } catch {
    // Ignore storage failures; the current session list still works.
  }
}

function availableIndustryAgents() {
  return [...customIndustryAgents, ...industryAgents];
}

function addCustomIndustryAgent(agent) {
  if (!agent) return null;
  customIndustryAgents = [agent, ...customIndustryAgents.filter((item) => item.id !== agent.id)].slice(0, 30);
  saveCustomIndustryAgents();
  return agent;
}

function clipText(value = "", max = 80) {
  const text = compactText(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function cleanGeneratedPromptSeed(text = "") {
  const raw = String(text || "").replace(/\r/g, "\n");
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const useful = [];
  for (const line of lines) {
    if (/^(提示词技能执行|负面控制|交付标准|参考图要求|平台\/比例约束|构图方案|默认场景|行业类型|版本策略|验收标准)[:：]/.test(line)) {
      continue;
    }
    if (/^业务信息[:：]/.test(line)) {
      const subject = line.match(/商品名称[:：]\s*([^；;。]+)/)?.[1] || "";
      const selling = line.match(/核心卖点[:：]\s*([^；;。]+)/)?.[1] || "";
      if (subject) useful.push(subject);
      if (selling) useful.push(selling);
      continue;
    }
    if (/^提示词蓝图[:：]/.test(line)) {
      useful.push(line.replace(/^提示词蓝图[:：]\s*/, "").split(/[+＋/｜|；;]/)[0]);
      continue;
    }
    useful.push(line);
  }
  const compact = compactText(useful.join(" "));
  return compact
    .replace(/^自定义\s*[·-]\s*/, "")
    .replace(/^(提示词蓝图|业务信息|商品名称|核心卖点)[:：]\s*/g, "")
    .trim();
}

function shortCustomSubject(text = "") {
  const cleaned = cleanGeneratedPromptSeed(text);
  const first = cleaned.split(/[。；;，,\n]/).map((item) => item.trim()).find(Boolean) || "";
  return clipText(first.replace(/^自定义\s*[·-]\s*/, ""), 28) || "自定义产品或主题";
}

function customSellingPoint(text = "", subject = "") {
  const cleaned = cleanGeneratedPromptSeed(text);
  if (!cleaned || cleaned === subject) {
    return `围绕${subject || "主体"}突出主体清晰、卖点可视化、商业质感和平台可用性`;
  }
  return clipText(cleaned, 140);
}

function inferCustomIndustryAgent(text = "") {
  const compact = cleanGeneratedPromptSeed(text);
  const lower = compact.toLowerCase();
  const has = (...tokens) => tokens.some((token) => lower.includes(token));
  let preset = {
    name: "自定义行业",
    meta: "动态需求 · 1:1",
    aspectRatio: "1:1",
    goals: ["主图方案", "场景方案", "广告方案"],
    sceneOptions: ["标准主图", "生活方式场景", "卖点展示", "广告 KV"],
    platformOptions: ["电商主图", "社媒内容", "官网头图", "广告投放"],
    holdOptions: ["不需要", "上方留白", "右侧留白", "底部留白"],
    skillIds: ["productHero", "benefitVisual", "referenceRestage", "caseStoryboardGrid", "kvLayout"],
  };
  if (has("美妆", "护肤", "口红", "精华", "面霜", "香水")) {
    preset = {
      name: "美妆护肤",
      meta: "美妆转化 · 4:5",
      aspectRatio: "4:5",
      goals: ["产品主图", "成分场景", "种草封面"],
      sceneOptions: ["纯净棚拍", "水润质感", "成分场景", "梳妆台生活方式"],
      platformOptions: ["电商详情页", "小红书封面", "品牌官网", "广告投放"],
      holdOptions: ["顶部留白", "右侧留白", "不需要"],
      skillIds: ["productHero", "macroDetail", "premiumLuxury", "caseLuxuryCampaign", "referenceRestage"],
    };
  } else if (has("食品", "饮料", "咖啡", "茶", "零食", "餐", "菜", "甜品")) {
    preset = {
      name: "食品饮品",
      meta: "食欲转化 · 1:1",
      aspectRatio: "1:1",
      goals: ["菜单图", "外卖主图", "社媒推广"],
      sceneOptions: ["菜单主图", "餐桌氛围", "食材飞溅", "门店海报"],
      platformOptions: ["外卖平台", "菜单", "社媒", "门店屏幕"],
      holdOptions: ["顶部留白", "底部留白", "不需要"],
      skillIds: ["productHero", "macroDetail", "caseStoryboardGrid", "lifestyleScene", "coverHook"],
    };
  } else if (has("服装", "穿搭", "鞋", "包", "潮牌", "饰品")) {
    preset = {
      name: "服装穿搭",
      meta: "穿搭展示 · 3:4",
      aspectRatio: "3:4",
      goals: ["穿搭图", "商品展示", "社媒封面"],
      sceneOptions: ["模特穿搭", "平铺陈列", "街拍场景", "细节特写"],
      platformOptions: ["电商详情页", "小红书", "Lookbook", "广告投放"],
      holdOptions: ["左侧留白", "右侧留白", "不需要"],
      skillIds: ["lifestyleScene", "flatlayKit", "macroDetail", "characterConsistency", "coverHook"],
    };
  } else if (has("课程", "训练营", "知识付费", "讲座", "教育", "培训")) {
    preset = {
      name: "课程知识付费",
      meta: "转化封面 · 4:5",
      aspectRatio: "4:5",
      goals: ["课程封面", "直播海报", "社媒广告"],
      sceneOptions: ["讲师形象", "学习场景", "成果展示", "干货清单"],
      platformOptions: ["朋友圈海报", "小红书封面", "直播间封面", "落地页"],
      holdOptions: ["顶部留白", "右侧留白", "中部留白"],
      skillIds: ["coverHook", "infographic", "casePosterNarrative", "beforeAfter", "kvLayout"],
    };
  } else if (has("app", "saas", "软件", "系统", "平台", "工具", "ai ")) {
    preset = {
      name: "App / SaaS 宣传图",
      meta: "科技营销 · 16:9",
      aspectRatio: "16:9",
      goals: ["官网头图", "产品发布图", "功能展示图"],
      sceneOptions: ["官网首屏", "功能展示", "发布海报", "社媒横图"],
      platformOptions: ["官网", "Product Hunt", "社媒", "产品发布"],
      holdOptions: ["左侧留白", "右侧留白", "顶部留白", "不需要"],
      skillIds: ["uiMockup", "caseSocialMockup", "kvLayout", "infographic", "benefitVisual"],
    };
  }
  const subject = shortCustomSubject(compact);
  const sellingPoint = customSellingPoint(compact, subject);
  return {
    id: `custom-${Date.now()}`,
    icon: "自",
    name: preset.name,
    meta: preset.meta,
    aspectRatio: preset.aspectRatio,
    count: 4,
    negative: "低清晰度，主体变形，错误文字，杂乱背景，比例失真，廉价模板感，过度锐化，AI伪影",
    prompt: `根据当前需求生成${preset.name}的商业生图方案，兼顾主体清晰、平台用途、卖点表达和可交付质感。`,
    goals: preset.goals,
    skillIds: preset.skillIds,
    fields: {
      subjectLabel: "产品 / 主题",
      subject,
      materialLabel: "材质 / 风格",
      material: "按需求提取，保持真实商业质感",
      sellingPoint,
      sceneLabel: "场景类型",
      sceneOptions: preset.sceneOptions,
      platformLabel: "目标平台",
      platformOptions: preset.platformOptions,
      holdLabel: "留白位置",
      holdOptions: preset.holdOptions,
      tags: ["动态行业", "主体清晰", "卖点可视化", "商业质感", "平台可用", "验收：主体明确", "验收：画面不杂乱"],
    },
  };
}

function historyIndustryKey(dayKey, industry) {
  return `${dayKey}:${industry.id || industry.name}`;
}

function restoreAgentFromJob(job) {
  const matched = availableIndustryAgents().find((agent) => agent.id === job.agent_id || agent.name === job.agent_name);
  selectedAgent = matched || null;
  agentEnabled = Boolean(matched && job.agent_enabled);
  appliedAgentVariant = matched ? (job.agent_variant || null) : null;
  agentGenerated = false;
  agentPlan = null;
  syncAgentEntry();
  syncAgentComposer();
  renderAgentPanel();
}

async function logoutPoolUser() {
  await api("/api/pool/logout", { method: "POST", body: "{}" });
  state.pool_user = null;
  renderPoolUser();
  if (els.connectionMode.value === "pool") {
    setConnectionStatus("请先登录号池账号", "idle");
    setModelStatus("请先登录号池账号", "idle");
  }
}

function isImageModel(model) {
  const value = String(model || "").toLowerCase();
  return [
    "image",
    "imagen",
    "dall-e",
    "dalle",
    "gpt-image",
    "banana",
    "flux",
    "stable",
    "stability",
    "sdxl",
    "midjourney",
    "mj-",
  ].some((token) => value.includes(token));
}

function cleanTextModelList(models = []) {
  return cleanModelList(models).filter(isTextModel);
}

function isTextModel(model) {
  const value = String(model || "").toLowerCase();
  if (!value || isImageModel(value)) return false;
  return [
    "gpt-",
    "gpt4",
    "gpt5",
    "o3",
    "o4",
    "o5",
    "chat",
    "claude",
    "deepseek",
    "qwen",
    "glm",
    "moonshot",
    "kimi",
    "yi-",
    "llama",
    "mistral",
    "gemini",
  ].some((token) => value.includes(token));
}

function preferredTextModel(models = []) {
  const priorities = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-5-mini", "gpt-4.1", "gpt-4o", "gpt-5"];
  const lowerMap = new Map(models.map((model) => [model.toLowerCase(), model]));
  for (const item of priorities) {
    if (lowerMap.has(item)) return lowerMap.get(item);
  }
  return models[0] || "";
}

function formatModelTime() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function normalizeModelId(model) {
  if (typeof model === "string") return model.trim();
  if (model && typeof model === "object") {
    return String(model.id || model.name || model.model || "").trim();
  }
  return String(model || "").trim();
}

function cleanModelList(models = []) {
  return Array.from(new Set((Array.isArray(models) ? models : [])
    .map(normalizeModelId)
    .filter(Boolean)));
}

function replaceModelOptions(models) {
  models = cleanModelList(models);
  const saved = localStorage.getItem(SELECTED_IMAGE_MODEL_KEY) || "";
  const current = els.model.value || saved;
  els.model.innerHTML = "";
  if (!models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "未检测到生图模型";
    els.model.append(option);
    els.model.disabled = true;
    els.submitJob.disabled = true;
    syncResearchImageModelOptions([]);
    syncCommerceModelOptions([]);
    syncSummary();
    return;
  }
  els.model.disabled = false;
  els.submitJob.disabled = false;
  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    if (model === current) option.selected = true;
    els.model.append(option);
  }
  if (models.includes(current)) {
    els.model.value = current;
  } else if (models[0]) {
    els.model.value = models[0];
  }
  if (els.model.value) localStorage.setItem(SELECTED_IMAGE_MODEL_KEY, els.model.value);
  syncResearchImageModelOptions(models);
  syncCommerceModelOptions(models);
  syncSummary();
}

function syncResearchImageModelOptions(models = verifiedImageModels) {
  const selects = document.querySelectorAll(".research-image-model-select");
  if (!selects.length) return;
  models = cleanModelList(models).filter(isImageModel);
  const selected = els.model?.value || localStorage.getItem(SELECTED_IMAGE_MODEL_KEY) || "";
  selects.forEach((select) => {
    const current = select.value || selected;
    select.innerHTML = "";
    if (!models.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "未检测到生图模型";
      select.append(option);
      select.disabled = true;
      return;
    }
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      select.append(option);
    }
    select.disabled = false;
    select.value = models.includes(current) ? current : (models.includes(selected) ? selected : models[0]);
  });
}

function syncTextModelFields() {
  const manual = !verifiedTextModels.length;
  const poolMode = els.connectionMode?.value === "pool";
  els.manualTextModelPanel?.classList.toggle("hidden", !manual);
  els.analysisModel?.classList.toggle("manual", manual);
  if (poolMode && els.reuseTextApiUrl) els.reuseTextApiUrl.checked = false;
  if (poolMode && els.reuseTextApiKey) els.reuseTextApiKey.checked = false;
  if (els.textApiUrlField) {
    els.textApiUrlField.classList.toggle("hidden", Boolean(els.reuseTextApiUrl?.checked));
  }
  if (els.textApiKeyField) {
    els.textApiKeyField.classList.toggle("hidden", Boolean(els.reuseTextApiKey?.checked));
  }
  if (els.textApiUrl && els.reuseTextApiUrl?.checked) {
    els.textApiUrl.value = debugTextRouteActive() ? (debugCustomApi.text?.apiUrl || selectedApiUrl() || DEFAULT_CUSTOM_API_URL) : (selectedApiUrl() || DEFAULT_CUSTOM_API_URL);
  }
  if (els.textApiKey) {
    const useBackendTextKey = debugTextRouteActive();
    els.textApiKey.disabled = useBackendTextKey;
    if (useBackendTextKey) els.textApiKey.value = "";
    els.textApiKey.placeholder = useBackendTextKey
      ? "调试中无需填写，后端使用管理后台文本 Key"
      : (localStorage.getItem(TEXT_API_KEY_STORAGE_KEY) ? "•••••••• 已保存文本 Key" : "填写有 GPT 文本模型权限的 Key");
  }
  syncTextApiKeyStatus();
}

function replaceTextModelOptions(models = []) {
  models = cleanTextModelList(models);
  syncCommerceAnalysisModelOptions(models);
  if (!els.analysisModel) return;
  const saved = localStorage.getItem(SELECTED_TEXT_MODEL_KEY) || "";
  const current = els.analysisModel.value || saved;
  els.analysisModel.innerHTML = "";
  if (models.length) {
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      els.analysisModel.append(option);
    }
    els.analysisModel.disabled = false;
    els.analysisModel.value = models.includes(current) ? current : preferredTextModel(models);
    if (els.analysisModel.value) localStorage.setItem(SELECTED_TEXT_MODEL_KEY, els.analysisModel.value);
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "未检测到文本模型";
    els.analysisModel.append(option);
    els.analysisModel.disabled = true;
    if (els.reuseTextApiKey) els.reuseTextApiKey.checked = false;
    if (els.manualTextModel && !els.manualTextModel.value.trim()) {
      els.manualTextModel.value = localStorage.getItem(MANUAL_TEXT_MODEL_KEY) || "";
    }
  }
  syncResearchTextModelOptions(models);
  syncTextModelFields();
  if (!models.length) scheduleTextModelRefresh({ immediate: true });
}

function syncResearchTextModelOptions(models = verifiedTextModels) {
  const select = els.researchTextModel;
  if (!select) return;
  models = cleanTextModelList(models);
  const current = select.value || selectedTextModel();
  select.innerHTML = "";
  if (models.length) {
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      select.append(option);
    }
    select.disabled = false;
    select.value = models.includes(current) ? current : selectedTextModel();
    return;
  }
  const manual = (els.manualTextModel?.value || "").trim();
  const option = document.createElement("option");
  option.value = manual;
  option.textContent = manual || "未检测到文本模型";
  select.append(option);
  select.disabled = !manual;
}

function syncCommerceAnalysisModelOptions(models = verifiedTextModels) {
  models = cleanTextModelList(models);
  if (!commerceEls.textModel || !commerceEls.textModelSelect) return;
  const current = commerceEls.textModel.value.trim();
  const saved = localStorage.getItem(COMMERCE_ANALYSIS_MODEL_KEY) || "";
  const selected = current || saved || selectedTextModel() || localStorage.getItem(SELECTED_TEXT_MODEL_KEY) || preferredTextModel(models) || "";
  commerceEls.textModelSelect.innerHTML = "";
  if (models.length) {
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      commerceEls.textModelSelect.append(option);
    });
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "未读取到文本模型";
    commerceEls.textModelSelect.append(option);
  }
  const manual = document.createElement("option");
  manual.value = "__manual__";
  manual.textContent = "手动填写模型...";
  commerceEls.textModelSelect.append(manual);
  const usesListedModel = Boolean(selected && models.includes(selected));
  commerceEls.textModelSelect.value = usesListedModel ? selected : "__manual__";
  commerceEls.textModel.classList.toggle("hidden", usesListedModel);
  if (usesListedModel) commerceEls.textModel.value = selected;
  if (!usesListedModel && selected && !current) commerceEls.textModel.value = selected;
}

function selectedTextModel() {
  return (verifiedTextModels.length ? els.analysisModel?.value : els.manualTextModel?.value || "").trim();
}

function selectedTextModelLabel() {
  const model = selectedTextModel();
  if (model) return model;
  if (debugTextRouteActive()) return "管理后台文本模型";
  return "";
}

function selectedTextApiUrl() {
  if (debugTextRouteActive()) return (debugCustomApi.text?.apiUrl || selectedApiUrl() || DEFAULT_CUSTOM_API_URL).trim();
  return (els.reuseTextApiUrl?.checked ? (selectedApiUrl() || DEFAULT_CUSTOM_API_URL) : (els.textApiUrl?.value || localStorage.getItem(TEXT_API_URL_KEY) || DEFAULT_CUSTOM_API_URL)).trim();
}

function selectedTextApiKey() {
  if (debugTextRouteActive()) return "";
  return (els.reuseTextApiKey?.checked ? selectedApiKey() : (els.textApiKey?.value || localStorage.getItem(TEXT_API_KEY_STORAGE_KEY) || "")).trim();
}

function renderAvailableModels(models = verifiedImageModels) {
  if (!els.availableModelList) return;
  const query = (els.modelFilter?.value || "").trim().toLowerCase();
  const normalizedModels = cleanModelList(models);
  const filtered = normalizedModels.filter((model) => !query || model.toLowerCase().includes(query));
  els.availableModelList.innerHTML = "";
  if (!filtered.length) {
    els.availableModelList.innerHTML = '<div class="empty-model-list">暂无可用生图模型</div>';
    return;
  }
  for (const model of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `available-model-item ${model === els.model.value ? "selected" : ""}`;
    button.dataset.modelName = model;
    button.textContent = model;
    button.addEventListener("click", () => {
      els.model.value = model;
      localStorage.setItem(SELECTED_IMAGE_MODEL_KEY, model);
      syncSummary();
      renderAvailableModels();
    });
    els.availableModelList.append(button);
  }
}

function selectIndustryAgent(agent, { preserveCurrent = true } = {}) {
  if (!agent) return;
  const sameAgent = preserveCurrent && selectedAgent?.id === agent.id;
  selectedAgent = agent;
  if (!sameAgent) {
    agentGenerated = false;
    agentPlan = null;
    agentPlanRevision = 0;
    agentEnabled = false;
    appliedAgentVariant = null;
    previewAgentVariant = "stable";
  }
  agentComposerExpanded = true;
  syncAgentEntry();
  syncAgentComposer();
}

function setActionHidden(el, hidden) {
  el?.classList.toggle("hidden", hidden);
}

function variantLabel(variantId) {
  return ({ stable: "稳定版", creative: "创意版", commercial: "商业版" }[variantId]) || "稳定版";
}

function syncAgentEntry() {
  if (!els.agentEntry) return;
  const hasSelected = Boolean(selectedAgent);
  const hasApplied = Boolean(agentEnabled && selectedAgent && appliedAgentVariant);
  els.agentEntry.classList.toggle("active", agentEnabled);
  els.agentEntry.classList.toggle("is-muted", !hasSelected);
  els.agentEntry.classList.toggle("needs-attention", !hasSelected);
  els.agentEntry.classList.toggle("is-selected", hasSelected && !hasApplied);
  els.agentEntry.classList.toggle("is-applied", hasApplied);
  if (hasApplied) {
    els.agentEntry.innerHTML = `<span>✣ ${escapeHtml(selectedAgent.name)} · ${variantLabel(appliedAgentVariant)} 已应用</span><small>送出后清</small>`;
  } else if (hasSelected) {
    els.agentEntry.innerHTML = `<span>✣ ${escapeHtml(selectedAgent.name)} · 已选</span><small>可应用</small>`;
  } else {
    els.agentEntry.innerHTML = `<span>✣ 行业 Agent · 未启用</span><small>可开启</small>`;
  }
  els.agentClearButton?.classList.toggle("hidden", !hasSelected);
  els.composer?.classList.toggle("agent-applied", hasApplied);
  if (els.agentAppliedStatus) {
    els.agentAppliedStatus.classList.toggle("hidden", !hasApplied);
    if (hasApplied) {
      els.agentAppliedStatus.querySelector("span").textContent = `${selectedAgent.name} · ${variantLabel(appliedAgentVariant)}`;
    }
  }
  renderAgentQuickList();
}

function syncAgentMode() {
  els.composer?.classList.toggle("agent-mode-enabled", agentModeEnabled);
  els.agentModeToggle?.classList.toggle("active", agentModeEnabled);
  if (els.agentModeToggle) {
    els.agentModeToggle.textContent = agentModeEnabled ? "关闭" : "打开";
    els.agentModeToggle.setAttribute("aria-label", `${agentModeEnabled ? "关闭" : "打开"} Agent 模式 A`);
    els.agentModeToggle.setAttribute("aria-pressed", String(agentModeEnabled));
  }
  els.agentModeCard?.classList.toggle("hidden", !agentModeEnabled);
  if (els.agentModeSubtitle) {
    els.agentModeSubtitle.textContent = agentModeEnabled ? "理解任务并自动拆解" : "自动编排单图、多图与宣传画册";
  }
  if (els.prompt) {
    els.prompt.placeholder = agentModeEnabled
      ? "上传参考图后，直接描述你想做一张图、一组不同图片，或一本宣传画册..."
      : "描述你想生成的图片...";
  }
  if (!agentModeEnabled) {
    agentModePlan = null;
  }
}

function syncAgentComposer() {
  els.composer?.classList.toggle("agent-collapsed", !agentComposerExpanded);
  if (els.expandAdvanced) {
    els.expandAdvanced.textContent = agentComposerExpanded ? "收起 ›" : "展开 ›";
    els.expandAdvanced.setAttribute("aria-expanded", String(agentComposerExpanded));
  }
  els.agentStatusBubble?.classList.toggle("hidden", agentComposerExpanded || Boolean(selectedAgent));
}

function renderAgentQuickList() {
  if (!els.agentQuickList) return;
  els.agentQuickList.innerHTML = "";
  for (const agent of availableIndustryAgents().slice(0, 5)) {
    const selected = selectedAgent?.id === agent.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `agent-quick-chip ${selected ? "active" : ""}`;
    button.innerHTML = `
      <span>${escapeHtml(agent.icon)}</span>
      <strong>${escapeHtml(agent.name)}</strong>
      <small>${selected ? "已选" : "开启"}</small>
    `;
    button.addEventListener("click", () => {
      selectIndustryAgent(agent);
      setAgentPanel(true);
    });
    els.agentQuickList.append(button);
  }
}

function setAgentFooter(mode) {
  const generated = mode === "generated";
  const form = mode === "form";
  const empty = mode === "empty";
  setActionHidden(els.applyStableAgent, !generated);
  setActionHidden(els.applyCreativeAgent, !generated);
  setActionHidden(els.applyCommercialAgent, !generated);
  setActionHidden(els.regenerateAgent, !generated);
  setActionHidden(els.applyAgent, generated);
  setActionHidden(els.disableAgent, empty);
  els.applyAgent.disabled = empty;
  els.applyAgent.textContent = empty ? "✣ 先选择行业 Agent" : "✣ 生成行业方案";
  els.applyAgent.classList.toggle("is-disabled", empty);
  els.disableAgent.disabled = false;
  if (form) els.disableAgent.textContent = "停用行业 Agent";
}

function syncAgentVariantActions() {
  const actions = [
    [els.applyStableAgent, "stable", "稳定版"],
    [els.applyCreativeAgent, "creative", "创意版"],
    [els.applyCommercialAgent, "commercial", "商业版"],
  ];
  for (const [button, id, label] of actions) {
    if (!button) continue;
    const active = previewAgentVariant === id;
    button.classList.toggle("primary-action", active);
    button.classList.toggle("subtle-button", !active);
    button.textContent = `${active ? "✣ 应用当前预览" : "✣ 应用"}${label}到提示词`;
  }
}

function renderAgentList() {
  els.agentList.innerHTML = "";
  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.className = "agent-list-item agent-custom-builder";
  customButton.innerHTML = `
    <span>自</span>
    <div>
      <strong>根据当前需求生成行业</strong>
      <small>从输入框提示词动态创建 Agent</small>
    </div>
    <em>+</em>
  `;
  customButton.addEventListener("click", () => {
    selectIndustryAgent(addCustomIndustryAgent(inferCustomIndustryAgent(els.prompt?.value || "")), { preserveCurrent: false });
    renderAgentPanel();
  });
  els.agentList.append(customButton);
  for (const agent of availableIndustryAgents()) {
    const button = document.createElement("button");
    button.type = "button";
    const isCustomAgent = String(agent.id || "").startsWith("custom-");
    button.className = `agent-list-item ${isCustomAgent ? "custom-agent-item" : ""} ${selectedAgent?.id === agent.id ? "selected" : ""}`;
    button.innerHTML = `
      <span>${escapeHtml(agent.icon)}</span>
      <div>
        <strong>${escapeHtml(agent.name)}</strong>
        <small>${escapeHtml(agent.meta)}</small>
      </div>
      <em>›</em>
      ${isCustomAgent ? `<i class="agent-delete-custom" data-delete-custom-agent="${escapeAttr(agent.id)}" title="删除自定义行业">×</i>` : ""}
    `;
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-delete-custom-agent]")) return;
      selectIndustryAgent(agent);
      renderAgentPanel();
    });
    els.agentList.append(button);
  }
}

function deleteCustomAgent(agentId = "") {
  const deletingSelected = selectedAgent?.id === agentId;
  customIndustryAgents = customIndustryAgents.filter((agent) => agent.id !== agentId);
  saveCustomIndustryAgents();
  if (deletingSelected) {
    selectedAgent = null;
    agentGenerated = false;
    agentPlan = null;
    agentPlanRevision = 0;
    agentEnabled = false;
    appliedAgentVariant = null;
  }
  syncAgentEntry();
  syncAgentComposer();
  renderAgentPanel();
}

function renderAgentEmpty() {
  const activeSkillIds = new Set(defaultPromptSkills.custom);
  const skillPreview = renderPromptSkillChips(activeSkillIds, { preview: true });
  els.agentWorkspace.innerHTML = `
    <div class="agent-empty-select">
      <span>✣</span>
      <strong>先选择一个行业 Agent</strong>
      <p>默认不启用行业工作流。可以选择左侧固定行业，也可以用当前输入内容动态生成一个自定义行业 Agent。</p>
      <section class="agent-skill-section agent-skill-section-preview">
        <div>
          <strong>提示词技能库</strong>
          <span>已加入案例灵感包和图生图编辑技能。选择行业后可逐项勾选，生成 GPT 方案和本地模板都会读取这些技能。</span>
        </div>
        <div class="agent-skill-preview-list">${skillPreview}</div>
      </section>
    </div>
  `;
  setAgentFooter("empty");
}

function selectedPromptSkills() {
  const checked = [...document.querySelectorAll("#agentSkillList input:checked")].map((input) => input.value);
  const fallback = selectedAgent?.skillIds || defaultPromptSkills[selectedAgent?.id] || defaultPromptSkills.custom;
  return (checked.length ? checked : fallback)
    .map((id) => ({ id, ...(promptSkillLibrary[id] || {}) }))
    .filter((item) => item.name);
}

function promptSkillIdsForAgent(agent) {
  return agent?.skillIds || defaultPromptSkills[agent?.id] || defaultPromptSkills.custom;
}

function customAgentDisplayName(values = null) {
  const raw = shortCustomSubject(values?.subject || $("#agentSubject")?.value || selectedAgent?.fields?.subject || "");
  const cleaned = raw
    .replace(/[，。；、,.，:：!！?？\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const name = cleaned.length > 14 ? `${cleaned.slice(0, 14)}…` : cleaned;
  return `自定义 · ${name}`;
}

function syncCustomAgentState(values = null) {
  if (!selectedAgent || !String(selectedAgent.id || "").startsWith("custom-")) return;
  values = values || readAgentValues();
  const name = customAgentDisplayName(values);
  const displayName = name || selectedAgent.name;
  const skillIds = Array.isArray(values.skills) ? values.skills.map((item) => item.id).filter(Boolean) : selectedAgent.skillIds;
  selectedAgent = {
    ...selectedAgent,
    name: displayName,
    meta: "动态行业 · 已命名",
    prompt: `根据“${displayName.replace(/^自定义 · /, "")}”生成商业生图方案，兼顾主体清晰、平台用途、卖点表达和可交付质感。`,
    skillIds: skillIds?.length ? skillIds : selectedAgent.skillIds,
    fields: {
      ...(selectedAgent.fields || {}),
      subject: values.subject || selectedAgent.fields?.subject || "",
      material: values.material || selectedAgent.fields?.material || "",
      sellingPoint: values.sellingPoint || selectedAgent.fields?.sellingPoint || "",
      scene: values.scene || selectedAgent.fields?.scene || "",
      platform: values.platform || selectedAgent.fields?.platform || "",
      hold: values.hold || selectedAgent.fields?.hold || "",
    },
  };
  customIndustryAgents = customIndustryAgents.map((agent) => agent.id === selectedAgent.id ? selectedAgent : agent);
  saveCustomIndustryAgents();
}

function renderPromptSkillChips(activeSkillIds = new Set(), { preview = false, limit = 0 } = {}) {
  const entries = Object.entries(promptSkillLibrary);
  const filtered = limit ? entries.slice(0, limit) : entries;
  return promptSkillGroups.map((group) => {
    const items = filtered.filter(([, skill]) => (skill.group || "base") === group.id);
    if (!items.length) return "";
    const chips = items.map(([id, skill]) => {
      const checked = activeSkillIds.has(id);
      if (preview) {
        return `
          <span class="agent-skill-preview-chip ${checked ? "selected" : ""}">
            <strong>${escapeHtml(skill.name)}</strong>
            <small>${escapeHtml(skill.desc)}</small>
          </span>
        `;
      }
      return `
        <label class="agent-skill-chip">
          <input type="checkbox" value="${escapeAttr(id)}" ${checked ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(skill.name)}</strong>
            <small>${escapeHtml(skill.desc)}</small>
          </span>
        </label>
      `;
    }).join("");
    return `
      <div class="agent-skill-group">
        <div class="agent-skill-group-title">
          <strong>${escapeHtml(group.title)}</strong>
          <small>${escapeHtml(group.desc)}</small>
        </div>
        <div class="agent-skill-list">${chips}</div>
      </div>
    `;
  }).join("");
}

function renderAgentForm() {
  const fields = selectedAgent.fields || {};
  const subjectValue = clipText(fields.subject || selectedAgent.name, 80);
  const materialValue = clipText(fields.material || "", 90);
  const sellingValue = clipText(fields.sellingPoint || selectedAgent.prompt, 180);
  const activeSkillIds = new Set(promptSkillIdsForAgent(selectedAgent));
  const skillList = renderPromptSkillChips(activeSkillIds);
  const optionHtml = (items = [], selected = "") => items.map((item) => `<option value="${escapeAttr(item)}" ${item === selected ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
  const sceneOptions = fields.sceneOptions || selectedAgent.goals;
  const platformOptions = fields.platformOptions || selectedAgent.goals;
  const holdOptions = fields.holdOptions || ["不需要", "顶部留白", "右侧留白"];
  els.agentWorkspace.innerHTML = `
    <div class="agent-workspace-form">
      <div class="agent-workspace-head">
        <div>
          <strong>${escapeHtml(selectedAgent.name)}</strong>
          <p>${escapeHtml(selectedAgent.prompt)}</p>
          <b>不填写也会默认生成现代消费级${escapeHtml(selectedAgent.name)}方案。</b>
        </div>
        <div class="agent-param-pills">
          <span>${escapeHtml(selectedAgent.aspectRatio)}</span>
          <span>${selectedAgent.count} 张</span>
          <span>high</span>
        </div>
      </div>
      <div class="agent-form-grid">
        <label>
          <span>${escapeHtml(fields.subjectLabel || "主题名称 · 建议")}</span>
          <input id="agentSubject" value="${escapeAttr(subjectValue)}">
        </label>
        <label>
          <span>${escapeHtml(fields.materialLabel || "材质 / 风格")}</span>
          <input id="agentMaterial" value="${escapeAttr(materialValue)}">
        </label>
        <label class="agent-wide-field">
          <span>核心卖点</span>
          <textarea id="agentSellingPoint" rows="2">${escapeHtml(sellingValue)}</textarea>
        </label>
        <label>
          <span>${escapeHtml(fields.sceneLabel || "使用场景")}</span>
          <select id="agentScene">${optionHtml(sceneOptions, fields.scene || sceneOptions?.[0] || "")}</select>
        </label>
        <label>
          <span>${escapeHtml(fields.platformLabel || "目标平台")}</span>
          <select id="agentPlatform">${optionHtml(platformOptions, fields.platform || platformOptions?.[0] || "")}</select>
        </label>
        <label>
          <span>${escapeHtml(fields.holdLabel || "留白位置")}</span>
          <select id="agentHold">${optionHtml(holdOptions, fields.hold || holdOptions?.[0] || "不需要")}</select>
        </label>
      </div>
      <div class="agent-tag-cloud">
        ${(fields.tags || selectedAgent.goals).map((goal) => `<span>${escapeHtml(goal)}</span>`).join("")}
      </div>
      <section class="agent-skill-section">
        <div>
          <strong>提示词技能</strong>
          <span>按当前行业默认启用，可手动调整；GPT 和本地兜底都会使用这些技法。</span>
        </div>
        <div id="agentSkillList" class="agent-skill-list">${skillList}</div>
      </section>
    </div>
  `;
  setAgentFooter("form");
}

function readAgentValues() {
  const fields = selectedAgent.fields || {};
  const skills = selectedPromptSkills();
  const subject = shortCustomSubject($("#agentSubject")?.value.trim() || fields.subject || selectedAgent.name);
  return {
    subject,
    material: clipText($("#agentMaterial")?.value.trim() || fields.material || "", 90),
    sellingPoint: customSellingPoint($("#agentSellingPoint")?.value.trim() || fields.sellingPoint || selectedAgent.prompt, subject),
    scene: $("#agentScene")?.value.trim() || fields.scene || fields.sceneOptions?.[0] || selectedAgent.goals?.[0] || "",
    platform: $("#agentPlatform")?.value.trim() || fields.platform || fields.platformOptions?.[0] || selectedAgent.goals?.[0] || "",
    hold: $("#agentHold")?.value.trim() || fields.hold || "不需要",
    skills,
  };
}

function buildAgentPrompt(variant = "stable", values = agentPlan?.values || readAgentValues(), revision = 1) {
  const fields = selectedAgent.fields || {};
  const delivery = (selectedAgent.goals || ["业务场景"]).join(" / ");
  const businessGoal = `生成可直接用于${delivery}的高质感${selectedAgent.name === "电商商品图" ? "商业摄影图" : selectedAgent.name}。`;
  const skills = Array.isArray(values.skills) && values.skills.length ? values.skills : promptSkillIdsForAgent(selectedAgent).map((id) => ({ id, ...(promptSkillLibrary[id] || {}) })).filter((item) => item.name);
  const skillNames = skills.map((item) => item.name).join(" / ");
  const skillInstructions = skills.map((item) => item.instruction).filter(Boolean).join("\n");
  const variantPlans = {
    stable: {
      title: "稳定交付方案",
      scene: `${values.scene}${selectedAgent.id === "commerce" ? "，标准电商棚拍主图，干净浅灰背景，商品完整居中" : "，标准业务场景，主体明确，画面干净"}。`,
      composition: "主体居中或三分线偏中，完整露出关键结构，边缘留出平台安全区，画面信息少而清楚。",
      lighting: "柔和双侧棚拍光或均匀自然光，阴影轻微，材质纹理真实，颜色不过饱和。",
      camera: "50mm 标准视角，轻微俯拍或平视，透视克制，主体比例稳定。",
      background: "干净浅灰、米白或低饱和背景，只保留少量辅助道具，不干扰主体。",
      strategy: `主体为${values.subject}，强调完整清晰、材质可信、平台审核友好，适合直接交付。`,
    },
    creative: {
      title: "创意传播方案",
      scene: `${values.scene}，加入可理解的使用情境、动作瞬间或情绪氛围，让主体处在更有记忆点的画面里。`,
      composition: "采用对角线、前景遮挡、局部大特写或透视纵深，保留主体识别度，同时制造视觉停留点。",
      lighting: "使用清晨逆光、窗边侧光、霓虹边缘光或暖冷对比光，形成更强氛围和传播感。",
      camera: "35mm 环境视角或 85mm 浅景深特写，允许轻微动态模糊，但主体关键部位必须清楚。",
      background: "背景加入场景线索、光斑、材质反差或空间层次，避免杂乱和廉价贴纸感。",
      strategy: `围绕${values.sellingPoint}做一个可被一眼记住的画面创意，不只换风格，要换场景叙事和视觉钩子。`,
    },
    commercial: {
      title: "商业广告方案",
      scene: `${values.scene}，广告 KV 或品牌详情页视觉，卖点被清晰组织成可复用的商业画面。`,
      composition: `主体偏左或偏右布局，按“主体 + 卖点视觉 + ${values.hold || "文案安全区"}”组织，适合${delivery}。`,
      lighting: "高质感商业布光，主体轮廓有高光，材质细节突出，整体对比清楚但不过曝。",
      camera: "70mm 至 100mm 商业摄影视角，压缩背景，突出质感和高级感。",
      background: "背景克制但有品牌感，可用色块、台面、柔和渐层或几何陈列承托主体。",
      strategy: `把${values.sellingPoint}转成可视化卖点，画面预留标题和按钮区域，适合投放、详情页和品牌页面复用。`,
    },
  };
  const plan = variantPlans[variant] || variantPlans.stable;
  const tags = (fields.tags || selectedAgent.goals || []).slice(0, 8).join("，");
  const checks = (fields.tags || [])
    .filter((item) => item.startsWith("验收："))
    .map((item) => item.replace("验收：", ""))
    .join("；") || "主体完整清晰；比例正确；材质真实；背景干净；适合投放平台";
  return [
    `行业类型：${selectedAgent.name}，${delivery}`,
    `业务目标：${businessGoal}`,
    `方案类型：${plan.title}`,
    `主体：${values.subject}`,
    `使用场景：${plan.scene}`,
    `目标受众：电商运营、品牌营销和正在浏览内容的潜在买家。`,
    `业务信息：商品名称：${values.subject}；材质 / 颜色：${values.material || "按行业默认"}；核心卖点：${values.sellingPoint}；使用场景：${values.scene}；目标平台：${values.platform}；留白位置：${values.hold}。`,
    `平台/比例约束：${selectedAgent.aspectRatio}，画面可直接用于${delivery}。`,
    skillNames ? `启用提示词技能：${skillNames}。` : "",
    skillInstructions ? `技能执行要求：\n${skillInstructions}` : "",
    `构图：${plan.composition}`,
    `光线：${plan.lighting}`,
    `镜头：${plan.camera}`,
    `背景：${plan.background}`,
    tags ? `镜头/材质/细节：${tags}。` : "",
    `提示词蓝图：主体 + 材质细节 + 平台用途 + 专业布光 + 干净背景 + 主体占比 + 可交付视觉。`,
    revision > 1 ? `重新生成要求：第 ${revision} 版，保持业务信息不变，但更换构图节奏、光线重点和画面卖点表达，避免和上一版重复。` : "",
    `版本策略：${plan.strategy}`,
    `负面控制：${selectedAgent.negative}`,
    `交付标准：${checks}。高细节，真实光影，专业商业视觉，可交付成片。`,
  ].filter(Boolean).join("\n");
}

function makeAgentPlan(valuesOverride = null, revision = 1) {
  const values = valuesOverride || readAgentValues();
  const delivery = (selectedAgent.goals || ["业务场景"]).join("、");
  const targetName = selectedAgent.id === "commerce" ? "商业摄影图" : selectedAgent.name;
  const skills = Array.isArray(values.skills) && values.skills.length ? values.skills : promptSkillIdsForAgent(selectedAgent).map((id) => ({ id, ...(promptSkillLibrary[id] || {}) })).filter((item) => item.name);
  const skillNames = skills.map((item) => item.name).join("、");
  const tags = (selectedAgent.fields?.tags || selectedAgent.goals || []).slice(0, 8).join("，");
  const checks = (selectedAgent.fields?.tags || [])
    .filter((item) => item.startsWith("验收："))
    .map((item) => item.replace("验收：", ""))
    .join("；") || "主体完整清晰；比例正确；材质真实；背景干净；适合投放平台";
  const brief = [
    revision > 1 ? `方案刷新：第 ${revision} 版，已保留当前行业参数并重新组织构图、卖点和执行重点。` : "",
    `画面目标：生成可直接用于${delivery}的高质感${targetName}。`,
    `默认主体：${values.subject}。`,
    `默认场景：${values.scene}${selectedAgent.id === "commerce" ? "电商主图，干净浅灰背景，商品完整居中" : "，主体明确，画面干净，有明确视觉中心"}。`,
    `业务信息：商品名称：${values.subject}；材质 / 颜色：${values.material || "按行业默认"}；核心卖点：${values.sellingPoint}；使用场景：${values.scene}；目标平台：${values.platform}；留白位置：${values.hold}。`,
    `构图方案：推荐 ${selectedAgent.aspectRatio}，主体明确，保留必要文案或平台安全区。`,
    skillNames ? `提示词技能：${skillNames}。` : "",
    `风格关键词：${tags}。`,
    `质量检查：${checks}。`,
  ].join("\n");
  return {
    values,
    revision,
    source: "local",
    brief,
    variants: [
      { id: "stable", title: revision > 1 ? `稳定版 R${revision}` : "稳定版", prompt: buildAgentPrompt("stable", values, revision) },
      { id: "creative", title: revision > 1 ? `创意版 R${revision}` : "创意版", prompt: buildAgentPrompt("creative", values, revision) },
      { id: "commercial", title: revision > 1 ? `商业版 R${revision}` : "商业版", prompt: buildAgentPrompt("commercial", values, revision) },
    ],
  };
}

async function requestAgentModePlan(basePrompt) {
  const textModel = selectedTextModel();
  if (!textModel) {
    throw new Error("未配置 Agent 文本模型");
  }
  const references = state.references
    .filter((ref) => selectedReferenceIds.has(ref.id))
    .slice(0, 4)
    .map((ref) => ({
      id: ref.id,
      name: ref.name || ref.filename || "",
      mime: ref.mime || "",
    }));
  const data = await api("/api/agent-mode-plan", {
    method: "POST",
    body: JSON.stringify({
      connection_mode: els.connectionMode.value,
      api_url: selectedApiUrl(),
      api_key: selectedApiKey(),
      text_model: textModel,
      text_api_url: selectedTextApiUrl(),
      text_api_key: selectedTextApiKey(),
      text_custom_fallback: Boolean(els.connectionMode.value === "pool" && !verifiedTextModels.length),
      prompt: basePrompt,
      image_model: els.model.value,
      aspect_ratio: els.aspectRatio.value,
      count: Number(els.count.value || 1),
      negative: els.negative.value.trim(),
      references,
    }),
  });
  if (data && data.ok === false) {
    throw new Error(data.detail || data.error || "Agent 模式 A 拆解失败");
  }
  return { ...(data.plan || {}), textModel: data.model || textModel };
}

function applyAgentModePlan(plan) {
  if (!plan || typeof plan !== "object") return "";
  if (plan.title && !els.title.value.trim()) {
    els.title.value = String(plan.title).trim();
  }
  if (!referenceAspectCandidate() && plan.aspect_ratio && [...els.aspectRatio.options].some((option) => option.value === plan.aspect_ratio)) {
    els.aspectRatio.value = plan.aspect_ratio;
  }
  if (plan.count) {
    els.count.value = String(Math.max(1, Math.min(Number(plan.count) || 1, 20)));
    syncConcurrencyToCount({ commit: true });
  }
  if (plan.negative) {
    els.negative.value = String(plan.negative).trim();
  }
  syncSummary();
  return String(plan.prompt || "").trim();
}

function showAgentModeAnalysis(plan, originalPrompt) {
  promptAnalysisPlan = null;
  const prompt = applyAgentModePlan(plan) || originalPrompt;
  const notes = [
    plan.brief ? `Brief：${plan.brief}` : "",
    Array.isArray(plan.steps) && plan.steps.length ? `拆解步骤：${plan.steps.join("；")}` : "",
    Array.isArray(plan.notes) && plan.notes.length ? `注意事项：${plan.notes.join("；")}` : "",
  ].filter(Boolean);
  const warning = els.promptAnalysisCard?.querySelector(".analysis-warning");
  if (warning) {
    warning.querySelector("b").textContent = "Agent 模式 A 已拆解";
    warning.querySelector("span").textContent = notes.join(" ") || "已将任务拆解为可直接生成的提示词和参数。";
  }
  const styleTags = els.promptAnalysisCard?.querySelector(".analysis-style-tags");
  if (styleTags) {
    const tags = [plan.task_type === "album" ? "宣传画册" : plan.task_type === "set" ? "成组图片" : "单图任务", "AI 拆解", "可直接生成", selectedReferenceIds.size ? "参考图约束" : ""].filter(Boolean);
    styleTags.innerHTML = tags.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }
  els.analysisResultTitle.textContent = `Agent 模式 A · ${escapeHtml(plan.textModel || "文本模型")} 拆解完成`;
  els.promptScore.textContent = "96";
  els.analysisAspect.textContent = els.aspectRatio.value;
  els.analysisSize.textContent = requestSize();
  els.analysisCount.textContent = els.count.value;
  els.analysisStyle.textContent = "agent";
  els.optimizedPrompt.value = prompt;
  els.promptAnalysisCard.classList.remove("hidden");
  els.composer?.classList.add("analysis-open");
}

function setAnalysisReady(label, message) {
  const row = els.promptAnalysisCard?.querySelector(".analysis-ready-row");
  if (!row) return;
  const title = row.querySelector("strong");
  const copy = row.querySelector("span");
  if (title) title.textContent = label;
  if (copy) copy.textContent = message;
}

function flashButton(button, text, duration = 1100) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = original;
  }, duration);
}

function syncAnalysisModeLabels(mode = "optimize") {
  const labels = {
    preflight: ["发送前预检", "推荐参数", "预检优化提示词", "预检标签"],
    optimize: ["优化依据", "参数建议", "优化提示词", "优化标签"],
    params: ["参数判断", "推荐参数", "当前提示词参考", "参数标签"],
    failure: ["风险预判", "规避参数", "规避风险后的提示词", "风险标签"],
    style: ["风格方向", "风格参数", "风格增强提示词", "风格标签"],
  }[mode] || ["优化依据", "参数建议", "优化提示词", "优化标签"];
  if (els.analysisRiskTitle) els.analysisRiskTitle.textContent = labels[0];
  if (els.analysisParamTitle) els.analysisParamTitle.textContent = labels[1];
  if (els.analysisPromptTitle) els.analysisPromptTitle.textContent = labels[2];
  if (els.analysisStyleTitle) els.analysisStyleTitle.textContent = labels[3];
}

function isPromptAnalysisRelevant(source = "", result = "") {
  const sourceText = compactText(source);
  const resultText = compactText(result);
  if (!sourceText || !resultText) return true;
  if (resultText.includes(sourceText)) return true;
  const tokens = sourceText
    .split(/[\s,，。.!！？、；;：:]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  if (!tokens.length) return true;
  const matched = tokens.filter((token) => resultText.includes(token)).length;
  return matched / tokens.length >= 0.45;
}

function isEnglishHeavyPrompt(text = "") {
  const value = String(text || "");
  if (!value.trim()) return false;
  const englishWords = value.match(/\b[A-Za-z][A-Za-z-]{2,}\b/g) || [];
  const letters = value.match(/[A-Za-z]/g) || [];
  const cjk = value.match(/[\u4e00-\u9fff]/g) || [];
  return englishWords.length >= 12 && letters.length > Math.max(80, cjk.length * 2);
}

function localChineseAnalysisPrompt(originalPrompt = "") {
  const base = String(originalPrompt || els.prompt.value || "").trim();
  const parts = [];
  if (base) parts.push(base);
  if (selectedReferenceIds.size) {
    parts.push("参考图约束：保留参考图的主体数量、人物身份特征、动作关系、构图比例、光影方向和主要色彩，不凭空增加参考图中不存在的人物、文字、Logo 或品牌元素。");
  }
  parts.push("优化补充：保持原始主题、人物数量、动作和场景不变，补充构图、光线、材质、清晰度和负面控制，输出可直接生图的中文提示词。");
  parts.push("负面控制：低清晰度、肢体畸形、手指错误、面部崩坏、主体变形、错别字、多余人物、多余手臂、过度锐化、AI 伪影。");
  return parts.join("\n\n");
}

function showTextAiAnalysis(plan, originalPrompt, mode = "preflight") {
  syncAnalysisModeLabels(mode);
  let prompt = String(plan?.prompt || originalPrompt || "").trim();
  if (!isPromptAnalysisRelevant(originalPrompt, prompt) || isEnglishHeavyPrompt(prompt)) {
    prompt = localChineseAnalysisPrompt(originalPrompt);
    plan = {
      ...(plan || {}),
      prompt,
      risks: ["文本模型返回内容与当前输入不匹配或包含大段英文，已回退到中文本地规则优化。"],
      notes: ["请重新点击对应按钮可再次调用文本模型。"],
    };
  }
  agentModePlan = null;
  promptAnalysisPlan = plan || null;
  const warning = els.promptAnalysisCard?.querySelector(".analysis-warning");
  const notes = [
    plan?.brief ? `Brief：${plan.brief}` : "",
    Array.isArray(plan?.risks) && plan.risks.length ? `风险点：${plan.risks.join("；")}` : "",
    Array.isArray(plan?.steps) && plan.steps.length ? `优化策略：${plan.steps.join("；")}` : "",
    Array.isArray(plan?.notes) && plan.notes.length ? `注意事项：${plan.notes.join("；")}` : "",
  ].filter(Boolean);
  if (warning) {
    warning.querySelector("b").textContent = mode === "failure" ? "文本 AI 已完成风险预判" : "文本 AI 已完成分析";
    warning.querySelector("span").textContent = notes.join(" ") || "已根据当前提示词、参考图和参数生成优化建议。";
  }
  const styleTags = els.promptAnalysisCard?.querySelector(".analysis-style-tags");
  if (styleTags) {
    const tags = [plan?.task_type === "album" ? "宣传画册" : plan?.task_type === "set" ? "成组图片" : "单图任务", "文本 AI", selectedReferenceIds.size ? "参考图约束" : "参数建议"].filter(Boolean);
    styleTags.innerHTML = tags.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }
  const titles = {
    preflight: "文本 AI 预检完成",
    optimize: "文本 AI 优化完成",
    params: "文本 AI 参数推荐完成",
    failure: "文本 AI 风险预判完成",
    style: "文本 AI 风格增强完成",
  };
  els.analysisResultTitle.textContent = titles[mode] || "文本 AI 分析完成";
  setAnalysisReady("GPT 分析模型", `已使用 ${plan?.textModel || selectedTextModel() || "文本模型"} 完成分析，可应用优化提示词或推荐参数。`);
  els.promptScore.textContent = "96";
  els.analysisAspect.textContent = plan?.aspect_ratio || els.aspectRatio.value;
  els.analysisSize.textContent = requestSize();
  els.analysisCount.textContent = plan?.count || els.count.value;
  els.analysisStyle.textContent = "AI";
  els.optimizedPrompt.value = prompt;
  els.promptAnalysisCard.classList.remove("hidden");
  els.composer?.classList.add("analysis-open");
}

async function requestAgentPlan(values, revision) {
  const textModel = selectedTextModel();
  if (!textModel) {
    throw new Error("未配置 Agent 文本模型，已改用本地模板。");
  }
  const data = await api("/api/agent-plan", {
    method: "POST",
    body: JSON.stringify({
      connection_mode: els.connectionMode.value,
      api_url: selectedApiUrl(),
      api_key: selectedApiKey(),
      text_model: textModel,
      text_api_url: selectedTextApiUrl(),
      text_api_key: selectedTextApiKey(),
      text_custom_fallback: Boolean(els.connectionMode.value === "pool" && !verifiedTextModels.length),
      revision,
      agent: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        prompt: selectedAgent.prompt,
        goals: selectedAgent.goals || [],
        prompt_skills: selectedPromptSkills(),
        aspect_ratio: selectedAgent.aspectRatio,
        count: selectedAgent.count,
        negative: selectedAgent.negative,
        fields: selectedAgent.fields || {},
      },
      values,
    }),
  });
  if (data && data.ok === false) {
    throw new Error(data.detail || data.error || "Agent 文本模型生成失败");
  }
  const plan = data.plan || {};
  return {
    ...makeAgentPlan(values, revision),
    ...plan,
    values: { ...(plan.values || {}), ...values },
    revision,
    source: "gpt",
    textModel: data.model || textModel,
  };
}

function renderAgentGenerated() {
  const fields = selectedAgent.fields || {};
  const values = agentPlan.values;
  previewAgentVariant = agentPlan.variants.some((item) => item.id === previewAgentVariant) ? previewAgentVariant : agentPlan.variants[0]?.id || "stable";
  const skillNames = (Array.isArray(values.skills) ? values.skills : []).map((item) => item.name).filter(Boolean);
  const sourceLine = agentPlan.source === "gpt"
    ? `由 ${escapeHtml(agentPlan.textModel || "GPT")} 生成差异化方案。`
    : agentPlan.fallbackReason === "error"
      ? `AI 生成失败，已使用本地模板兜底：${escapeHtml(agentPlan.errorMessage || "接口返回错误")}`
      : "当前未启用文本模型，已使用本地模板生成可预览方案。";
  const variantCards = agentPlan.variants.map((variant) => `
    <article class="agent-variant-card ${variant.id === previewAgentVariant ? "selected" : ""}" data-agent-variant="${escapeAttr(variant.id)}" role="button" tabindex="0" aria-selected="${variant.id === previewAgentVariant}">
      <strong>${escapeHtml(variant.title)}</strong>
      <p>${escapeHtml(variant.prompt).replace(/\n/g, "<br>")}</p>
      <button type="button" data-agent-variant="${escapeAttr(variant.id)}">预览这套方案</button>
    </article>
  `).join("");
  els.agentWorkspace.innerHTML = `
    <div class="agent-generated-view">
      <div class="agent-workspace-head">
        <div>
          <strong>${escapeHtml(selectedAgent.name)}</strong>
          <p>${escapeHtml(selectedAgent.prompt)}</p>
          <b>不填写也会默认生成现代消费级${escapeHtml(selectedAgent.name)}方案。</b>
        </div>
        <div class="agent-param-pills">
          <span>${escapeHtml(selectedAgent.aspectRatio)}</span>
          <span>${selectedAgent.count} 张</span>
          <span>high</span>
        </div>
      </div>
      <section class="agent-brief-box">
        <strong>生图 Brief</strong>
        <p>${escapeHtml(agentPlan.brief).replace(/\n/g, "<br>")}</p>
      </section>
      <div class="agent-variant-grid">${variantCards}</div>
      <div class="agent-generated-notes">
        <span>不填写也会默认生成现代消费级${escapeHtml(selectedAgent.name)}方案。</span>
        <span>${sourceLine}</span>
        <span>点击上方方案只切换预览；点击下方“应用”按钮才会写入输入框。</span>
      </div>
      ${skillNames.length ? `<div class="agent-tag-cloud">${skillNames.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
      <div class="agent-form-grid agent-form-grid-compact">
        <label><span>${escapeHtml(fields.subjectLabel || "主题名称 · 建议")}</span><input value="${escapeAttr(values.subject)}" readonly></label>
        <label><span>${escapeHtml(fields.materialLabel || "材质 / 风格")}</span><input value="${escapeAttr(values.material)}" readonly></label>
        <label class="agent-wide-field"><span>核心卖点</span><textarea rows="2" readonly>${escapeHtml(values.sellingPoint)}</textarea></label>
      </div>
    </div>
  `;
  setAgentFooter("generated");
  syncAgentVariantActions();
}

function renderAgentPanel() {
  if (!els.agentList || !els.agentWorkspace) return;
  renderAgentList();
  if (!selectedAgent) {
    renderAgentEmpty();
    return;
  }
  if (agentGenerated && agentPlan) {
    renderAgentGenerated();
    return;
  }
  renderAgentForm();
}

function setAgentPanel(open) {
  if (!els.agentModal) return;
  els.agentModal.classList.toggle("hidden", !open);
  document.body.classList.toggle("agent-panel-open", open);
  if (open) renderAgentPanel();
}

async function generateAgentPlan() {
  if (!selectedAgent) return;
  const values = agentPlan?.values || null;
  agentPlanRevision += 1;
  const nextValues = values || readAgentValues();
  syncCustomAgentState(nextValues);
  const fallbackPlan = makeAgentPlan(nextValues, agentPlanRevision);
  els.applyAgent.disabled = true;
  els.applyAgent.textContent = "✣ 正在生成方案...";
  try {
    agentPlan = await requestAgentPlan(nextValues, agentPlanRevision);
  } catch (err) {
    const message = String(err.message || "");
    const fallbackReason = message.includes("未配置") || message.includes("本地号池模式") ? "not-configured" : "error";
    agentPlan = {
      ...fallbackPlan,
      brief: fallbackReason === "error"
        ? `${fallbackPlan.brief}\n\nAI 方案生成失败，已使用本地模板兜底：${message}`
        : fallbackPlan.brief,
      source: "local",
      fallbackReason,
      errorMessage: message,
    };
  } finally {
    els.applyAgent.disabled = false;
  }
  previewAgentVariant = agentPlan.variants[0]?.id || "stable";
  agentGenerated = true;
  renderAgentPanel();
}

function previewAgentVariantCard(variantId = "stable") {
  if (!agentPlan?.variants?.some((item) => item.id === variantId)) return;
  previewAgentVariant = variantId;
  renderAgentPanel();
}

function applyAgentVariant(variantId = "stable") {
  if (!selectedAgent || !agentPlan) return;
  const variant = agentPlan.variants.find((item) => item.id === variantId) || agentPlan.variants[0];
  syncCustomAgentState(agentPlan.values);
  els.prompt.value = variant.prompt;
  if (!els.title.value.trim()) {
    els.title.value = selectedAgent.name;
  }
  els.aspectRatio.value = selectedAgent.aspectRatio;
  els.count.value = selectedAgent.count;
  if ([...els.quality.options].some((option) => option.value === "high")) {
    els.quality.value = "high";
  }
  els.negative.value = selectedAgent.negative;
  if (selectedReferenceIds.size) {
    selectedReferenceIds.clear();
    referenceAspectAutoValue = "";
    referenceAspectAutoEnabled = true;
    renderReferences();
  }
  agentEnabled = true;
  appliedAgentVariant = variant.id;
  agentComposerExpanded = true;
  syncAgentEntry();
  syncAgentComposer();
  setAgentPanel(false);
  syncSummary();
  els.prompt.focus();
}

function disableSelectedAgent() {
  selectedAgent = null;
  agentEnabled = false;
  agentGenerated = false;
  agentPlan = null;
  agentPlanRevision = 0;
  appliedAgentVariant = null;
  syncAgentEntry();
  renderAgentPanel();
  syncSummary();
}

function clearAgentForGeneralGeneration() {
  const previousAgentName = selectedAgent?.name || "";
  const currentTitle = els.title?.value.trim() || "";
  const titleLooksLikeAgent = currentTitle && availableIndustryAgents().some((agent) => agent.name === currentTitle);
  selectedAgent = null;
  agentEnabled = false;
  agentGenerated = false;
  agentPlan = null;
  agentPlanRevision = 0;
  appliedAgentVariant = null;
  agentComposerExpanded = false;
  if (els.title && (currentTitle === previousAgentName || titleLooksLikeAgent)) {
    els.title.value = "";
  }
  syncAgentEntry();
  syncAgentComposer();
  renderAgentPanel();
  syncSummary();
}

function showGuide(step = 0) {
  if (!els.guideOverlay) return;
  if ((location.hash || "#home") !== "#studio") return;
  guideStep = Math.max(0, Math.min(step, guideSteps.length - 1));
  const current = guideSteps[guideStep];
  els.guideOverlay.classList.remove("hidden", "guide-step-config", "guide-step-model", "guide-step-agent", "guide-step-compose");
  els.guideOverlay.classList.add(current.cls);
  els.guideOverlay.setAttribute("aria-hidden", "false");
  els.guideStepLabel.textContent = current.label;
  els.guideTitle.textContent = current.title;
  els.guideBody.textContent = current.body;
  els.guideHint.textContent = current.hint;
  els.nextGuide.textContent = current.next;
  els.guideConfig.style.display = guideStep === 0 ? "" : "none";
  els.guideBubble?.classList.toggle("hidden", guideStep !== 2);
  els.guideOverlay.querySelectorAll(".onboarding-progress button").forEach((button, index) => {
    button.classList.toggle("active", index === guideStep);
  });
  alignGuideTarget();
}

function placeGuideSpotlight(target, padding = 8) {
  const spotlight = els.guideOverlay?.querySelector(".onboarding-spotlight");
  if (!spotlight || !target) return;
  const rect = target.getBoundingClientRect();
  spotlight.style.setProperty("display", "block", "important");
  spotlight.style.setProperty("left", `${Math.max(8, rect.left - padding)}px`, "important");
  spotlight.style.setProperty("top", `${Math.max(8, rect.top - padding)}px`, "important");
  spotlight.style.setProperty("width", `${Math.min(window.innerWidth - 16, rect.width + padding * 2)}px`, "important");
  spotlight.style.setProperty("height", `${Math.min(window.innerHeight - 16, rect.height + padding * 2)}px`, "important");
  spotlight.style.setProperty("right", "auto", "important");
  spotlight.style.setProperty("bottom", "auto", "important");
  spotlight.style.setProperty("transform", "none", "important");
  placeGuidePanel(rect);
}

function placeGuidePanel(targetRect) {
  const panel = els.guideOverlay?.querySelector(".onboarding-panel");
  if (!panel || !targetRect) return;
  const margin = 14;
  const panelRect = panel.getBoundingClientRect();
  const panelWidth = panelRect.width || 420;
  const panelHeight = panelRect.height || 220;
  let left = targetRect.left - panelWidth - margin;
  if (left < margin) left = targetRect.right + margin;
  if (left + panelWidth > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - panelWidth - margin);
  let top = targetRect.top;
  if (top + panelHeight > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - panelHeight - margin);
  panel.style.setProperty("left", `${left}px`, "important");
  panel.style.setProperty("right", "auto", "important");
  panel.style.setProperty("top", `${top}px`, "important");
  panel.style.setProperty("bottom", "auto", "important");
  panel.style.setProperty("transform", "none", "important");
}

function alignGuideTarget() {
  if (!els.configPanel) return;
  if (guideStep === 0) {
    els.appShell?.classList.add("settings-open");
    syncShellToggles();
    els.configPanel.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => placeGuideSpotlight(els.configPanel, 10));
    return;
  }
  if (guideStep === 1) {
    els.appShell?.classList.add("settings-open");
    syncShellToggles();
    const modelSection = els.configPanel.querySelector(".model-catalog");
    const top = modelSection ? Math.max(0, modelSection.offsetTop - 12) : 0;
    els.configPanel.scrollTo({ top, behavior: "auto" });
    window.requestAnimationFrame(() => placeGuideSpotlight(modelSection, 8));
    return;
  }
  if (guideStep === 2) {
    agentComposerExpanded = false;
    syncAgentComposer();
    window.requestAnimationFrame(() => placeGuideSpotlight(els.composerMain || els.composer, 10));
  }
}

function hideGuide(done = false) {
  if (!els.guideOverlay) return;
  els.guideOverlay.classList.add("hidden");
  els.guideOverlay.setAttribute("aria-hidden", "true");
  els.guideBubble?.classList.add("hidden");
  if (done) {
    guideDismissedThisSession = true;
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures; the session flag still prevents repeat popups now.
    }
  }
}

function hasCompletedGuide() {
  try {
    return localStorage.getItem(GUIDE_STORAGE_KEY) === "1";
  } catch {
    return guideDismissedThisSession;
  }
}

function maybeAutoShowGuide(anchor = location.hash || "#home") {
  if (guideAutoShown || anchor !== "#studio") return;
  if (guideDismissedThisSession) return;
  if (hasCompletedGuide()) return;
  window.setTimeout(() => {
    if ((location.hash || "#home") !== "#studio") return;
    if (guideDismissedThisSession || guideAutoShown) return;
    if (hasCompletedGuide()) return;
    showGuide(0);
    guideAutoShown = true;
  }, 450);
}

function renderHistory() {
  els.historyList.innerHTML = "";
  const jobs = jobsForWorkspace("studio");
  els.historyList.classList.toggle("hidden", !historyExpanded);
  if (els.toggleHistory) {
    els.toggleHistory.textContent = historyExpanded ? `任务归档 · ${jobs.length}` : `展开任务归档 · ${jobs.length}`;
    els.toggleHistory.setAttribute("aria-expanded", String(historyExpanded));
    els.toggleHistory.classList.toggle("active", historyExpanded);
  }
  if (els.clearMedia) {
    const activeJob = currentHistoryJob();
    const dayCount = jobsForHistoryDay(selectedHistoryDayKey).length;
    els.clearMedia.title = activeJob
      ? "删除当前任务记录"
      : selectedHistoryDayKey && dayCount
        ? `删除${historyDayLabel(selectedHistoryDayKey)}的 ${dayCount} 个任务`
        : "删除所有会话记录";
    els.clearMedia.classList.toggle("context-active", Boolean(activeJob || (selectedHistoryDayKey && dayCount)));
  }
  if (!historyExpanded) {
    return;
  }
  if (!jobs.length) {
    selectedHistoryDayKey = null;
    els.historyList.innerHTML = '<div class="empty-history">暂无记录</div>';
    return;
  }
  const groups = new Map();
  for (const job of jobs) {
    const key = historyDayKey(job.created_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(job);
  }
  for (const [key, dayJobs] of groups) {
    const selectedInGroup = dayJobs.some((job) => job.id === selectedHistoryJobId);
    if (!historyDayOpen.has(key)) historyDayOpen.set(key, key === historyDayKey(Date.now() / 1000) || selectedInGroup);
    const group = document.createElement("section");
    group.className = `history-day-group ${selectedHistoryDayKey === key ? "selected" : ""}`;
    const header = document.createElement("div");
    header.className = "history-day-head";
    const head = document.createElement("button");
    head.type = "button";
    head.className = "history-day-toggle";
    head.setAttribute("aria-expanded", String(historyDayOpen.get(key)));
    head.innerHTML = `<strong>${escapeHtml(historyDayLabel(key))}</strong><span>${dayJobs.length} 个任务</span>`;
    head.addEventListener("click", () => {
      historyDayOpen.set(key, !historyDayOpen.get(key));
      renderHistory();
    });
    const selectDay = document.createElement("button");
    selectDay.type = "button";
    selectDay.className = "history-day-select";
    selectDay.textContent = selectedHistoryDayKey === key ? "已选" : "选择";
    selectDay.addEventListener("click", () => {
      selectedHistoryDayKey = selectedHistoryDayKey === key ? null : key;
      selectedHistoryJobId = null;
      selectedGalleryIds.clear();
      persistHistorySelection(false);
      renderState();
    });
    header.append(head, selectDay);
    group.append(header);
    if (historyDayOpen.get(key)) {
      const list = document.createElement("div");
      list.className = "history-day-list";
      const industryGroups = new Map();
      for (const job of dayJobs) {
        const industry = jobIndustry(job);
        const industryKey = industry.id || industry.name;
        if (!industryGroups.has(industryKey)) industryGroups.set(industryKey, { industry, jobs: [] });
        industryGroups.get(industryKey).jobs.push(job);
      }
      for (const { industry, jobs: industryJobs } of industryGroups.values()) {
        const selectedInIndustry = industryJobs.some((job) => job.id === selectedHistoryJobId);
        const industryOpenKey = historyIndustryKey(key, industry);
        if (!historyIndustryOpen.has(industryOpenKey)) {
          historyIndustryOpen.set(industryOpenKey, selectedInIndustry || key === historyDayKey(Date.now() / 1000) || industry.source !== "general");
        }
        const industryGroup = document.createElement("section");
        industryGroup.className = `history-industry-group ${selectedInIndustry ? "active" : ""}`;
        const industryHead = document.createElement("button");
        industryHead.type = "button";
        industryHead.className = "history-industry-head";
        industryHead.setAttribute("aria-expanded", String(historyIndustryOpen.get(industryOpenKey)));
        const variantText = industry.variant ? ` · ${variantLabel(industry.variant)}` : "";
        industryHead.innerHTML = `
          <span class="history-industry-name">${escapeHtml(industry.name)}${escapeHtml(variantText)}</span>
          <span class="history-industry-meta">${industryJobs.length} 条</span>
        `;
        industryHead.addEventListener("click", () => {
          historyIndustryOpen.set(industryOpenKey, !historyIndustryOpen.get(industryOpenKey));
          renderHistory();
        });
        industryGroup.append(industryHead);
        if (historyIndustryOpen.get(industryOpenKey)) {
          const industryList = document.createElement("div");
          industryList.className = "history-industry-list";
          for (const job of industryJobs) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `history-item ${job.status} ${selectedHistoryJobId === job.id ? "active" : ""}`;
            btn.innerHTML = `
              <strong>${escapeHtml(displayJobTitle(job))}</strong>
              <span>${statusText(job.status)} · ${historyTimeLabel(job.created_at)} · ${escapeHtml(job.model || "")}</span>
            `;
            btn.addEventListener("click", () => {
              selectedHistoryJobId = job.id;
              selectedHistoryDayKey = null;
              selectedGalleryIds.clear();
              persistHistorySelection(false);
              renderState();
            });
            industryList.append(btn);
          }
          industryGroup.append(industryList);
        }
        list.append(industryGroup);
      }
      group.append(list);
    }
    els.historyList.append(group);
  }
}

function galleryItems() {
  if (selectedHistoryJobId === NEW_TASK_DRAFT_ID) return [];
  const studioJobs = jobsForWorkspace("studio");
  const studioMedia = mediaForWorkspace("studio");
  const visibleMedia = selectedHistoryJobId
    ? studioMedia.filter((media) => media.job_id === selectedHistoryJobId)
    : studioMedia;
  const visibleJobs = selectedHistoryJobId
    ? studioJobs.filter((job) => job.id === selectedHistoryJobId)
    : studioJobs;
  const jobById = new Map(studioJobs.map((job) => [job.id, job]));
  const referencesById = new Map(state.references.map((ref) => [ref.id, ref]));
  const jobReferences = (job = {}, media = {}) => {
    const ids = Array.isArray(media.reference_ids) && media.reference_ids.length
      ? media.reference_ids
      : (Array.isArray(job.reference_ids) ? job.reference_ids : []);
    return ids.map((id) => referencesById.get(id)).filter(Boolean).slice(0, MAX_REFERENCE_SELECTION);
  };
  const agentInfo = (job = {}) => {
    const enabled = Boolean(job.agent_enabled);
    return {
      agentName: enabled ? String(job.agent_name || "").trim() : "",
      agentVariant: enabled ? String(job.agent_variant || "").trim() : "",
    };
  };
  const mediaItems = visibleMedia.map((media) => {
    const job = jobById.get(media.job_id) || {};
    const aspectRatio = media.aspect_ratio || job.aspect_ratio || "1:1";
    const resolution = media.resolution || job.resolution || "1K";
    const requestedSize = media.size || job.size || requestSizeFor(aspectRatio, resolution);
    const actualSize = media.actual_size || "";
    return {
      kind: "media",
      id: `media:${media.id}`,
      rawId: media.id,
      jobId: media.job_id || "",
      status: "success",
      title: media.model || "生成图片",
      prompt: media.prompt || "",
      url: media.url,
      thumbUrl: media.thumb_url || media.url,
      index: media.index,
      created_at: media.created_at,
      aspect_ratio: aspectRatio,
      resolution,
      size: requestedSize,
      actual_size: actualSize,
      quality: media.quality || job.quality || "auto",
      references: jobReferences(job, media),
      editMode: Boolean(media.edit_mode || job.edit_mode),
      ...agentInfo(job),
    };
  });
  const failedItems = visibleJobs
    .filter((job) => job.status === "error")
    .flatMap((job) => {
      const count = Math.max(1, Number(job.count || 1));
      return Array.from({ length: count }, (_, idx) => ({
        kind: "job",
        id: `job:${job.id}:${idx}`,
        rawId: job.id,
        jobId: job.id,
        status: "error",
        title: job.model || "生成失败",
        prompt: job.prompt || "",
        error: job.error || "生成失败",
        retryCount: job.retry_count || 0,
        index: idx + 1,
        created_at: job.created_at,
        aspect_ratio: job.aspect_ratio || "1:1",
        resolution: job.resolution || "1K",
        size: job.size || "1024x1024",
        quality: job.quality || "auto",
        references: jobReferences(job),
        editMode: Boolean(job.edit_mode),
        ...agentInfo(job),
      }));
    });
  return [...mediaItems, ...failedItems].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

function renderGalleryHeader(items) {
  if (!els.galleryHeader) return;
  if (!items.length) {
    els.galleryHeader.classList.add("hidden");
    return;
  }
  const selectedCount = selectedGalleryIds.size;
  const studioJobs = jobsForWorkspace("studio");
  const studioMedia = mediaForWorkspace("studio");
  const running = studioJobs.filter((job) => job.status === "running").length;
  const queued = studioJobs.filter((job) => job.status === "queued").length;
  const succeeded = studioJobs.filter((job) => job.status === "success").length;
  const failed = studioJobs.filter((job) => job.status === "error").length;
  const currentJob = currentHistoryJob();
  const retryableFailed = currentJob ? (currentJob.status === "error" ? 1 : 0) : failed;
  const title = currentJob ? `当前任务记录 · 已显示 ${items.length} 条` : `最近生成 · 已显示 ${items.length} 条`;
  els.galleryHeader.classList.remove("hidden");
  els.galleryHeader.innerHTML = `
    <div class="gallery-title">
      <strong>${escapeHtml(title)}</strong>
      <span>运行中 ${running} / 排队 ${queued} / 成功 ${succeeded} / 失败 ${failed} / 图片 ${studioMedia.length}</span>
      <small>列表为缩略图，点击预览查看原图</small>
    </div>
    ${currentJob && !selectedCount ? `
      <div class="gallery-bulk-actions muted">
        <span>正在查看单个任务</span>
        <button data-gallery-action="show-all" onclick="window.showAllGenerated?.()" type="button">查看全部最近生成</button>
      </div>
    ` : ""}
    ${!selectedCount && retryableFailed ? `
      <div class="gallery-bulk-actions muted">
        <span>${currentJob ? "当前任务失败" : `失败任务 ${retryableFailed}`}</span>
        <button data-gallery-action="retry-failed" class="retry" type="button">重试失败</button>
        <button data-gallery-action="clear-failed" class="danger" type="button">清除失败</button>
      </div>
    ` : ""}
    ${selectedCount ? `
      <div class="gallery-bulk-actions">
        <span>已选 ${selectedCount} / 可选 ${items.length}</span>
        <button data-gallery-action="select-all" type="button">全选已显示</button>
        <button data-gallery-action="retry-selected" class="retry" type="button">重试选中失败</button>
        <button data-gallery-action="clear-failed" class="danger" type="button">清除失败 ${failed}</button>
        <button data-gallery-action="invert" type="button">反选</button>
        <button data-gallery-action="download" type="button">下载</button>
        <button data-gallery-action="delete" class="danger" type="button">删除</button>
        <button data-gallery-action="cancel" type="button">取消选择</button>
      </div>
    ` : ""}
  `;
}

async function recommendGalleryItem(item) {
  if (!item?.rawId || item.status !== "success") return;
  try {
    const result = await api("/api/square/recommend", {
      method: "POST",
      body: JSON.stringify({ media_id: item.rawId }),
    });
    if (result.duplicate) {
      showReferenceLimitHint("这张图已经在广场里");
    } else {
      showReferenceLimitHint("已推荐到广场");
    }
    await loadSquare();
  } catch (err) {
    alert(err.message || "推荐到广场失败");
  }
}

window.showAllGenerated = function showAllGenerated() {
  selectedHistoryJobId = null;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
  persistHistorySelection(true);
  renderState();
};

function toggleGalleryItem(itemId) {
  if (selectedGalleryIds.has(itemId)) {
    selectedGalleryIds.delete(itemId);
  } else {
    selectedGalleryIds.add(itemId);
  }
  renderMedia();
}

function reuseItemReferences(item) {
  const refs = Array.isArray(item?.references) ? item.references : [];
  if (!refs.length) {
    showReferenceLimitHint("这张图没有可复用的参考图记录");
    return;
  }
  selectedReferenceIds = new Set(refs.slice(0, MAX_REFERENCE_SELECTION).map((ref) => ref.id));
  renderReferences();
  showReferenceLimitHint(`已复用 ${selectedReferenceIds.size} 张参考图`);
  els.prompt?.focus();
}

function applyGalleryItemToPrompt(item, withReferences = false) {
  if (!item) return;
  els.prompt.value = item.prompt || "";
  clearAgentForGeneralGeneration();
  if (withReferences) {
    reuseItemReferences(item);
  } else {
    selectedReferenceIds.clear();
    renderReferences();
  }
  syncSummary();
}

function squareSortFromButton(button) {
  const text = button?.textContent || "";
  if (text.includes("热门")) return "hot";
  if (text.includes("精选")) return "featured";
  return "latest";
}

function renderSquare(items = []) {
  if (!squareEls.grid) return;
  if (!items.length) {
    squareEls.grid.innerHTML = `
      <article class="square-card square-empty-card">
        <div class="square-card-image"></div>
        <div class="square-card-body">
          <strong>等待推荐作品</strong>
          <p>在工作台生成成功图片后，点击“推荐广场”即可公开展示到这里。</p>
        </div>
      </article>
    `;
    return;
  }
  squareEls.grid.innerHTML = items.map((item) => `
    <article class="square-card" data-square-id="${escapeAttr(item.id)}">
      <button class="square-card-image square-image-button" type="button" data-square-action="open">
        <img src="${escapeAttr(item.thumb_url || item.image_url || "")}" data-full-url="${escapeAttr(item.image_url || item.thumb_url || "")}" data-prompt="${escapeAttr(item.prompt || "")}" alt="${escapeAttr(item.title || "广场作品")}" loading="lazy">
      </button>
      <div class="square-card-overlay">
        <span>${escapeHtml(item.aspect_ratio || "作品")}</span>
        <button type="button" data-square-action="like">♥ ${Number(item.likes || 0)}</button>
      </div>
    </article>
  `).join("");
}

async function loadSquare() {
  if (!squareEls.grid) return;
  squareEls.grid.classList.add("loading");
  try {
    const data = await api(`/api/square?sort=${encodeURIComponent(squareSort)}`);
    renderSquare(data.items || []);
    if (squareEls.quota) {
      const label = squareEls.quota.querySelector("span");
      if (label) label.textContent = data.total ? `公开作品 ${data.total} 张` : "暂无公开作品";
    }
  } catch (err) {
    squareEls.grid.innerHTML = `<div class="admin-empty">广场读取失败：${escapeHtml(err.message || "请求失败")}</div>`;
  } finally {
    squareEls.grid.classList.remove("loading");
  }
}

async function likeSquareItem(id) {
  if (!id) return;
  try {
    await api("/api/square/like", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
    await loadSquare();
  } catch (err) {
    alert(err.message || "点赞失败");
  }
}

function previewSquareItem(id) {
  const card = squareEls.grid?.querySelector(`[data-square-id="${CSS.escape(id)}"]`);
  const image = card?.querySelector("img");
  const fullUrl = image?.dataset.fullUrl || image?.src || "";
  if (!fullUrl) return;
  setMediaPreview(true, {
    title: "广场作品",
    prompt: image.dataset.prompt || image.alt || "广场作品",
    url: fullUrl,
    aspect_ratio: card?.querySelector(".square-card-overlay span")?.textContent || "",
    resolution: "",
    size: "",
  });
}

function setCommerceStatus(message, tone = "idle") {
  if (!commerceEls.modelStatus) return;
  commerceEls.modelStatus.textContent = message;
  commerceEls.modelStatus.classList.toggle("error", tone === "error");
  commerceEls.modelStatus.classList.toggle("loading", tone === "loading");
}

function setCommerceAnalysisStatus(message, tone = "idle") {
  if (!commerceEls.analysisStatus) return;
  commerceEls.analysisStatus.textContent = message;
  commerceEls.analysisStatus.classList.toggle("error", tone === "error");
  commerceEls.analysisStatus.classList.toggle("loading", tone === "loading");
  commerceEls.analysisStatus.classList.toggle("success", tone === "success");
}

function setCommerceChatOpen(open = true) {
  if (!commerceEls.analysisCard) return;
  if (open && commerceActiveTab !== "workspace") setCommerceTab("workspace");
  commerceEls.analysisCard.classList.toggle("hidden", !open);
  commerceEls.analysisCard.setAttribute("aria-hidden", open ? "false" : "true");
  commerceEls.chatToggle?.classList.toggle("active", open);
  commerceEls.chatFloat?.classList.toggle("active", open);
  document.body.classList.toggle("commerce-chat-open", open);
  if (open) {
    window.requestAnimationFrame(() => commerceEls.analysisInputText?.focus());
  }
}

function saveCommerceAnalysisState() {
  localStorage.removeItem(COMMERCE_ANALYSIS_REFS_KEY);
  localStorage.setItem(COMMERCE_ANALYSIS_CHAT_KEY, JSON.stringify(commerceAnalysisMessages.slice(-40)));
  if (commerceEls.textApiUrl?.value.trim()) localStorage.setItem(COMMERCE_ANALYSIS_URL_KEY, commerceEls.textApiUrl.value.trim());
  if (commerceEls.textModel?.value.trim()) localStorage.setItem(COMMERCE_ANALYSIS_MODEL_KEY, commerceEls.textModel.value.trim());
  if (commerceEls.textApiKey?.value.trim()) localStorage.setItem(COMMERCE_ANALYSIS_TEXT_KEY, commerceEls.textApiKey.value.trim());
  localStorage.setItem(COMMERCE_ANALYSIS_CONTEXT_KEY, commerceEls.analysisContext?.value || "");
}

function loadCommerceAnalysisState() {
  try {
      commerceAnalysisRefs = [];
      localStorage.removeItem(COMMERCE_ANALYSIS_REFS_KEY);
  } catch (err) {
    commerceAnalysisRefs = [];
  }
  try {
    commerceAnalysisMessages = JSON.parse(localStorage.getItem(COMMERCE_ANALYSIS_CHAT_KEY) || "[]");
    if (!Array.isArray(commerceAnalysisMessages)) commerceAnalysisMessages = [];
  } catch (err) {
    commerceAnalysisMessages = [];
  }
  commerceAnalysisRefs = [];
  commerceAnalysisMessages = commerceAnalysisMessages
    .filter((message) => ["user", "assistant"].includes(message?.role) && message?.content)
    .slice(-40);
  if (commerceEls.textApiUrl) {
    commerceEls.textApiUrl.value = localStorage.getItem(COMMERCE_ANALYSIS_URL_KEY)
      || localStorage.getItem(TEXT_API_URL_KEY)
      || DEFAULT_CUSTOM_API_URL;
  }
  if (commerceEls.textModel) {
    commerceEls.textModel.value = localStorage.getItem(COMMERCE_ANALYSIS_MODEL_KEY)
      || selectedTextModel()
      || localStorage.getItem(SELECTED_TEXT_MODEL_KEY)
      || "";
  }
  syncCommerceAnalysisModelOptions(verifiedTextModels);
  if (commerceEls.textApiKey) {
    commerceEls.textApiKey.value = localStorage.getItem(COMMERCE_ANALYSIS_TEXT_KEY)
      || localStorage.getItem(TEXT_API_KEY_STORAGE_KEY)
      || "";
  }
  if (commerceEls.analysisContext) commerceEls.analysisContext.value = localStorage.getItem(COMMERCE_ANALYSIS_CONTEXT_KEY) || "";
  renderCommerceAnalysisRefs();
  renderCommerceAnalysisMessages();
}

function renderCommerceAnalysisRefs() {
  commerceAnalysisRefs = [];
}

function renderCommerceAnalysisMessages() {
  if (!commerceEls.analysisMessages) return;
  if (!commerceAnalysisMessages.length) {
    commerceEls.analysisMessages.innerHTML = '<div class="commerce-analysis-empty">可以直接提问，也可以上传图片后进行图文对话。</div>';
    return;
  }
  commerceEls.analysisMessages.innerHTML = commerceAnalysisMessages.map((message) => `
    <div class="commerce-analysis-message ${message.role}">
      <strong>${message.role === "assistant" ? "分析助手" : "我"}</strong>
      <p>${escapeHtml(message.content).replace(/\n/g, "<br>")}</p>
    </div>
  `).join("");
  commerceEls.analysisMessages.scrollTop = commerceEls.analysisMessages.scrollHeight;
}

async function uploadCommerceAnalysisImages(fileList) {
  const files = Array.from(fileList || []).filter(isReferenceImageFile);
  if (!files.length) {
    setCommerceAnalysisStatus("请选择图片", "error");
    return;
  }
  const uploadFiles = files.slice(0, 4);
  const uploaded = [];
  try {
    for (let index = 0; index < uploadFiles.length; index += 1) {
      setCommerceAnalysisStatus(`正在上传图片 ${index + 1}/${uploadFiles.length}`, "loading");
      const file = uploadFiles[index];
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      const resp = await fetch("/api/references", {
        method: "POST",
        headers: { "X-YY-Client-ID": clientId },
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "图片上传失败");
      uploaded.push(data.reference);
    }
    setCommerceAnalysisStatus(`已上传 ${uploaded.length} 张图片，正在发送...`, "loading");
    await sendCommerceAnalysisMessage({ refs: uploaded, imageOnlyLabel: `已发送 ${uploaded.length} 张图片` });
  } catch (err) {
    setCommerceAnalysisStatus(err.message || "图片上传失败", "error");
  } finally {
    if (commerceEls.analysisInput) commerceEls.analysisInput.value = "";
  }
}

async function sendCommerceAnalysisMessage(options = {}) {
  const message = (commerceEls.analysisInputText?.value || "").trim();
  const refs = Array.isArray(options.refs) ? options.refs.filter((ref) => ref?.id) : commerceAnalysisRefs;
  const apiUrl = (commerceEls.textApiUrl?.value || "").trim();
  const apiKey = (commerceEls.textApiKey?.value || "").trim();
  const model = (commerceEls.textModel?.value || "").trim();
  if (!message && !refs.length) {
    setCommerceAnalysisStatus("请输入问题或上传图片", "error");
    return;
  }
  if (!apiUrl || !apiKey) {
    setCommerceAnalysisStatus("请填写文本 API 和 Key", "error");
    return;
  }
  const question = message || "请根据这些图片进行正常图文对话。";
  const visibleQuestion = message || options.imageOnlyLabel || question;
  const history = commerceAnalysisMessages.slice(-10);
  commerceAnalysisMessages.push({ role: "user", content: visibleQuestion });
  if (commerceEls.analysisInputText) commerceEls.analysisInputText.value = "";
  commerceAnalysisRefs = [];
  saveCommerceAnalysisState();
  renderCommerceAnalysisMessages();
  commerceEls.analysisSend.disabled = true;
  setCommerceAnalysisStatus("正在回复...", "loading");
  try {
    const data = await api("/api/commerce-analysis-chat", {
      method: "POST",
      body: JSON.stringify({
        text_api_url: apiUrl,
        text_api_key: apiKey,
        text_model: model,
        product_context: (commerceEls.analysisContext?.value || "").trim(),
        message: question,
        reference_ids: refs.map((ref) => ref.id),
        history,
      }),
    });
    if (!data.ok) throw new Error(data.detail || data.error || "对话失败");
    commerceAnalysisMessages.push({ role: "assistant", content: data.reply || "模型未返回分析内容" });
    saveCommerceAnalysisState();
    renderCommerceAnalysisMessages();
    setCommerceAnalysisStatus(`回复完成 · ${data.model || model || "默认模型"}`, "success");
  } catch (err) {
    commerceAnalysisMessages.push({ role: "assistant", content: `回复失败：${err.message}` });
    saveCommerceAnalysisState();
    renderCommerceAnalysisMessages();
    setCommerceAnalysisStatus(err.message || "对话失败", "error");
  } finally {
    commerceEls.analysisSend.disabled = false;
  }
}

function scheduleCommerceTextModelRefresh() {
  window.clearTimeout(commerceTextModelTimer);
  commerceTextModelTimer = window.setTimeout(refreshCommerceTextModels, 650);
}

async function refreshCommerceTextModels() {
  const apiUrl = (commerceEls.textApiUrl?.value || "").trim();
  const apiKey = (commerceEls.textApiKey?.value || "").trim();
  saveCommerceAnalysisState();
  if (!apiUrl || !apiKey) {
    syncCommerceAnalysisModelOptions([]);
    setCommerceAnalysisStatus(!apiUrl ? "请先填写文本 API 地址" : "请先填写文本模型 Key");
    return;
  }
  setCommerceAnalysisStatus("正在读取文本模型...", "loading");
  try {
    const data = await api("/api/models", {
      method: "POST",
      body: JSON.stringify({
        connection_mode: "custom",
        api_url: apiUrl,
        api_key: apiKey,
        model_kind: "text",
      }),
    });
    const allModels = Array.isArray(data.models) ? data.models : [];
    const textModels = cleanTextModelList(Array.isArray(data.text_models) ? data.text_models : allModels);
    verifiedTextModels = textModels;
    replaceTextModelOptions(textModels);
    syncCommerceAnalysisModelOptions(textModels);
    if (textModels.length) {
      setCommerceAnalysisStatus(`已读取 ${textModels.length} 个文本模型`, "success");
      return;
    }
    setCommerceAnalysisStatus("Key 有效，但未识别到文本模型，可手动填写", "error");
  } catch (err) {
    verifiedTextModels = [];
    replaceTextModelOptions([]);
    syncCommerceAnalysisModelOptions([]);
    setCommerceAnalysisStatus(`文本模型读取失败：${err.message}`, "error");
  }
}

function activeCommerceValue(buttons, key, fallback = "") {
  const active = [...buttons].find((button) => button.classList.contains("active"));
  return active?.dataset?.[key] || fallback;
}

function setCommerceChip(buttons, key, value) {
  buttons.forEach((button) => button.classList.toggle("active", button.dataset[key] === value));
}

function commerceModeValue() {
  return activeCommerceValue(commerceEls.modeChips, "commerceMode", "text");
}

function syncCommerceModeControls({ clearTextReferences = false } = {}) {
  const isImageMode = commerceModeValue() === "image";
  commerceEls.referenceField?.classList.toggle("hidden", !isImageMode);
  if (!isImageMode && (clearTextReferences || selectedReferenceIds.size)) {
    selectedReferenceIds.clear();
    if (els.editMode) els.editMode.checked = false;
    renderReferences();
  }
}

let commerceLastAutoPrompt = "";

function syncCommerceStyleControls() {
  const style = (commerceEls.style?.value || "").trim();
  commerceEls.sceneChips.forEach((button) => {
    button.classList.toggle("active", Boolean(style) && button.dataset.commerceScene === style);
  });
  commerceEls.clearStyle?.classList.toggle("hidden", !style);
}

function buildCommercePrompt() {
  return "";
}

function syncCommercePrompt({ force = false } = {}) {
  if (!commerceEls.prompt) return;
  const next = buildCommercePrompt();
  if (force && commerceLastAutoPrompt && commerceEls.prompt.value.trim() === commerceLastAutoPrompt.trim()) {
    commerceEls.prompt.value = next;
    commercePromptTouched = false;
  }
  commerceLastAutoPrompt = next;
}

function loadCommerceTemplates() {
  try {
    commerceTemplates = JSON.parse(localStorage.getItem(COMMERCE_TEMPLATES_KEY) || "[]");
    if (!Array.isArray(commerceTemplates)) commerceTemplates = [];
  } catch (err) {
    commerceTemplates = [];
  }
}

function saveCommerceTemplates() {
  localStorage.setItem(COMMERCE_TEMPLATES_KEY, JSON.stringify(commerceTemplates.slice(0, 80)));
}

function filteredCommerceTemplates() {
  const keyword = (commerceEls.templateSearch?.value || "").trim().toLowerCase();
  const list = [...commerceTemplates].sort((a, b) => {
    if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
    return Number(b.updated_at || b.created_at || 0) - Number(a.updated_at || a.created_at || 0);
  });
  if (!keyword) return list;
  return list.filter((template) => [
    template.name,
    template.prompt,
    template.style,
    ...(template.tags || []),
  ].some((value) => String(value || "").toLowerCase().includes(keyword)));
}

function renderCommerceTemplates() {
  if (!commerceEls.templateSelect) return;
  const current = commerceEls.templateSelect.value;
  commerceEls.templateSelect.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "不使用模板";
  commerceEls.templateSelect.append(empty);
  commerceTemplates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name || "未命名模板";
    commerceEls.templateSelect.append(option);
  });
  if (commerceTemplates.some((item) => item.id === current)) commerceEls.templateSelect.value = current;
  if (commerceEls.templateCount) commerceEls.templateCount.textContent = String(commerceTemplates.length);
  if (!commerceEls.templateList) return;
  const visibleTemplates = filteredCommerceTemplates();
  if (!visibleTemplates.length) {
    commerceEls.templateList.innerHTML = '<div class="commerce-empty">暂无模板</div>';
    return;
  }
  commerceEls.templateList.innerHTML = visibleTemplates.map((template) => `
    <article class="commerce-template-item" data-commerce-template-id="${escapeAttr(template.id)}">
      <strong>${template.favorite ? "★ " : ""}${escapeHtml(template.name || "未命名模板")}</strong>
      <span>${escapeHtml((template.tags || []).join("，") || "未设置标签")}</span>
      <span>${escapeHtml((template.prompt || "").slice(0, 140))}</span>
      <span>使用 ${Number(template.usage_count || 0)} 次 · ${template.last_used_at ? `最近 ${formatTime(template.last_used_at)}` : "未使用"}</span>
      <div class="commerce-template-actions">
        <button data-commerce-template-action="favorite" type="button">${template.favorite ? "取消收藏" : "收藏模板"}</button>
        <button data-commerce-template-action="use" type="button">套用到工作台</button>
        <button data-commerce-template-action="edit" type="button">编辑</button>
        <button data-commerce-template-action="delete" type="button">删除</button>
      </div>
    </article>
  `).join("");
}

function applyCommerceTemplate(id) {
  const template = commerceTemplates.find((item) => item.id === id);
  if (!template) return;
  if (commerceEls.prompt) {
    commerceEls.prompt.value = template.prompt || "";
    commerceLastAutoPrompt = template.prompt || "";
    commercePromptTouched = true;
  }
  if (commerceEls.style) commerceEls.style.value = template.style || template.scene || "";
  if (template.model && commerceEls.model && [...commerceEls.model.options].some((option) => option.value === template.model)) commerceEls.model.value = template.model;
  if (template.size && commerceEls.size) {
    const hasSizeOption = [...commerceEls.size.options].some((option) => option.value === template.size);
    commerceEls.size.value = hasSizeOption ? template.size : "auto";
  }
  if (template.quality && commerceEls.quality) commerceEls.quality.value = template.quality;
  if (template.format && commerceEls.format) commerceEls.format.value = template.format;
  if (template.background && commerceEls.background) commerceEls.background.value = template.background;
  if (template.upscale && commerceEls.upscale) commerceEls.upscale.value = template.upscale;
  if (template.mode) setCommerceChip(commerceEls.modeChips, "commerceMode", template.mode);
  if (template.ratio) setCommerceChip(commerceEls.ratioChips, "commerceRatio", template.ratio);
  syncCommerceModeControls({ clearTextReferences: template.mode !== "image" });
  syncCommerceStyleControls();
  if (commerceEls.templateName) commerceEls.templateName.value = template.name || "";
  if (commerceEls.templateTags) commerceEls.templateTags.value = (template.tags || []).join(", ");
  if (commerceEls.saveTemplate) commerceEls.saveTemplate.textContent = "更新模板";
  template.usage_count = Number(template.usage_count || 0) + 1;
  template.last_used_at = Date.now() / 1000;
  commerceEditingTemplateId = template.id;
  saveCommerceTemplates();
  renderCommerceTemplates();
}

function saveCommerceTemplateFromForm() {
  const prompt = (commerceEls.prompt?.value || "").trim();
  if (!prompt) {
    commerceEls.prompt?.focus();
    return;
  }
  const name = (commerceEls.templateName?.value || "").trim() || `模板 ${commerceTemplates.length + 1}`;
  const tags = (commerceEls.templateTags?.value || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const now = Date.now() / 1000;
  const payload = {
    name,
    tags,
    prompt,
    style: (commerceEls.style?.value || "").trim(),
    model: commerceEls.model?.value || "",
    size: commerceEls.size?.value || "auto",
    resolution: commerceResolutionValue(),
    quality: commerceEls.quality?.value || "auto",
    format: commerceEls.format?.value || "png",
    background: commerceEls.background?.value || "auto",
    upscale: commerceEls.upscale?.value || "none",
    mode: activeCommerceValue(commerceEls.modeChips, "commerceMode", "text"),
    ratio: activeCommerceValue(commerceEls.ratioChips, "commerceRatio", "1:1"),
    updated_at: now,
  };
  const existing = commerceTemplates.find((template) => template.id === commerceEditingTemplateId);
  if (existing) {
    Object.assign(existing, payload);
  } else {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    commerceEditingTemplateId = id;
    commerceTemplates.unshift({
      id,
      ...payload,
      favorite: false,
      usage_count: 0,
      created_at: now,
    });
  }
  saveCommerceTemplates();
  renderCommerceTemplates();
  if (commerceEls.templateSelect) commerceEls.templateSelect.value = commerceEditingTemplateId;
  if (commerceEls.saveTemplate) commerceEls.saveTemplate.textContent = "更新模板";
}

function syncCommerceModelOptions(models = verifiedImageModels) {
  if (!commerceEls.model) return;
  const clean = cleanModelList(models);
  const selected = commerceEls.model.value || els.model?.value || localStorage.getItem(SELECTED_IMAGE_MODEL_KEY) || "";
  commerceEls.model.innerHTML = "";
  if (!clean.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "填写 Key 后自动读取";
    commerceEls.model.append(option);
    commerceEls.model.disabled = true;
    return;
  }
  clean.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    commerceEls.model.append(option);
  });
  commerceEls.model.disabled = false;
  commerceEls.model.value = clean.includes(selected) ? selected : clean[0];
}

function syncCommerceFromMain() {
  if (!commerceEls.apiUrl) return;
  if (document.activeElement !== commerceEls.apiUrl) {
    const mainApiUrl = els.connectionMode?.value === "custom" ? els.apiUrl?.value : "";
    commerceEls.apiUrl.value = mainApiUrl || storedCustomApiUrl() || DEFAULT_CUSTOM_API_URL;
  }
  if (document.activeElement !== commerceEls.apiKey) {
    commerceEls.apiKey.value = els.apiKey?.value || localStorage.getItem("yangyang_image_api_key") || "";
  }
  commerceEls.rememberKey.checked = Boolean(els.rememberApiKey?.checked || localStorage.getItem("yangyang_image_api_key"));
  syncCommerceModelOptions(verifiedImageModels);
  if (commerceEls.model && els.model?.value) commerceEls.model.value = els.model.value;
  setCommerceStatus(verifiedImageModels.length ? `已读取 ${verifiedImageModels.length} 个绘图模型` : "等待填写 API Key", verifiedImageModels.length ? "success" : "idle");
  syncCommerceModeControls({ clearTextReferences: true });
  syncCommerceStyleControls();
  syncCommercePrompt();
}

function pushCommerceConnectionToMain() {
  if (!commerceEls.apiUrl) return;
  setConnectionMode("custom", { persist: true });
  if (els.apiUrl) els.apiUrl.value = commerceEls.apiUrl.value.trim();
  if (els.apiKey) els.apiKey.value = commerceEls.apiKey.value.trim();
  if (els.rememberApiKey) els.rememberApiKey.checked = Boolean(commerceEls.rememberKey?.checked);
  if (commerceEls.model?.value && els.model) {
    if (![...els.model.options].some((option) => option.value === commerceEls.model.value)) {
      const option = document.createElement("option");
      option.value = commerceEls.model.value;
      option.textContent = commerceEls.model.value;
      els.model.append(option);
    }
    els.model.value = commerceEls.model.value;
    localStorage.setItem(SELECTED_IMAGE_MODEL_KEY, commerceEls.model.value);
  }
  saveApiKeyPreference();
}

function scheduleCommerceModelRefresh() {
  window.clearTimeout(commerceRefreshTimer);
  commerceRefreshTimer = window.setTimeout(async () => {
    pushCommerceConnectionToMain();
    if (!selectedApiUrl() || (!selectedApiKey() && !adminDebugApiActive())) {
      syncCommerceModelOptions([]);
      setCommerceStatus(!selectedApiUrl() ? "等待填写 API 地址" : "等待填写 API Key");
      return;
    }
    setCommerceStatus("正在读取模型...", "loading");
    await refreshModels({ silent: true });
    syncCommerceFromMain();
  }, 650);
}

function parseCommerceSizeValue(value = "") {
  const match = String(value || "").trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function reduceRatio(width, height) {
  let a = Math.round(Math.abs(width));
  let b = Math.round(Math.abs(height));
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  const divisor = a || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function commerceExplicitSizeValue() {
  const sizeValue = commerceEls.size?.value || "auto";
  return parseCommerceSizeValue(sizeValue) ? sizeValue : "";
}

function commerceResolutionValue() {
  const parsed = parseCommerceSizeValue(commerceExplicitSizeValue());
  if (!parsed) return "1K";
  const longEdge = Math.max(parsed.width, parsed.height);
  if (longEdge >= 3500) return "4K";
  if (longEdge >= 1900) return "2K";
  return "1K";
}

function commerceAspectValue() {
  const sizeValue = commerceEls.size?.value || "auto";
  const parsedSize = parseCommerceSizeValue(sizeValue);
  if (parsedSize) return reduceRatio(parsedSize.width, parsedSize.height);
  return activeCommerceValue(commerceEls.ratioChips, "commerceRatio", "1:1");
}

async function submitCommerceJob() {
  syncCommercePrompt();
  const rawPrompt = (commerceEls.prompt?.value || "").trim();
  const style = (commerceEls.style?.value || "").trim();
  const prompt = [rawPrompt, style ? `风格：${style}` : ""].filter(Boolean).join("\n");
  if (!rawPrompt) {
    setCommerceStatus("请输入提示词", "error");
    commerceEls.prompt?.focus();
    return;
  }
  const isImageMode = commerceModeValue() === "image";
  if (isImageMode && !selectedReferenceIds.size) {
    setCommerceStatus("图生图模式需要上传参考图片", "error");
    commerceEls.referenceDrop?.focus();
    return;
  }
  if (!isImageMode && selectedReferenceIds.size) {
    selectedReferenceIds.clear();
    renderReferences();
  }
  pushCommerceConnectionToMain();
  if (els.title) els.title.value = "简洁生图台";
  if (els.prompt) els.prompt.value = prompt;
  if (els.count && commerceEls.count) els.count.value = commerceEls.count.value || "1";
  if (els.concurrency && commerceEls.count) els.concurrency.value = commerceEls.count.value || "1";
  if (els.aspectRatio) els.aspectRatio.value = commerceAspectValue();
  if (els.resolution) els.resolution.value = commerceResolutionValue();
  if (els.quality && commerceEls.quality) els.quality.value = commerceEls.quality.value || "auto";
  if (els.outputFormat && commerceEls.format) els.outputFormat.value = commerceEls.format.value || "png";
  if (els.editMode) els.editMode.checked = isImageMode && selectedReferenceIds.size > 0;
  clearAgentForGeneralGeneration();
  syncSummary();
  setCommerceStatus("已提交生成任务", "loading");
  await performSubmitJob(prompt);
  commerceResultPage = 1;
  renderCommerceState();
}

function latestCommerceItems(limit = 8, options = {}) {
  const includeArchived = Boolean(options.includeArchived);
  const commerceJobs = jobsForWorkspace("commerce");
  const jobById = new Map(commerceJobs.map((job) => [job.id, job]));
  const items = mediaForWorkspace("commerce")
    .map((media) => ({ media, job: jobById.get(media.job_id) || {} }))
    .filter(({ job }) => includeArchived || !job.archived)
    .sort((a, b) => (b.media.created_at || 0) - (a.media.created_at || 0));
  return Number.isFinite(limit) ? items.slice(0, limit) : items;
}

function commerceMediaCard(media, job = {}) {
  const item = {
    title: media.model || job.model || "生成图片",
    prompt: media.prompt || job.prompt || "",
    url: media.url,
    thumbUrl: media.thumb_url || media.url,
    jobId: media.job_id || job.id || "",
    aspect_ratio: media.aspect_ratio || job.aspect_ratio || "",
    resolution: media.resolution || job.resolution || "",
    size: media.size || job.size || "",
  };
  return `
    <article class="commerce-result-item" data-commerce-media-id="${escapeAttr(media.id)}" data-commerce-job-id="${escapeAttr(item.jobId)}">
      <button data-commerce-media-action="preview" type="button">
        <img src="${escapeAttr(item.thumbUrl || item.url || "")}" alt="${escapeAttr(item.prompt || "生成图片")}" loading="lazy" decoding="async">
      </button>
      <div class="commerce-result-body">
        <div class="commerce-result-meta">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml([item.aspect_ratio, item.size].filter(Boolean).join(" · ") || "生成图片")}</span>
        </div>
        <div class="commerce-result-actions">
          <button class="is-primary" data-commerce-media-action="preview" type="button">预览</button>
          <a class="is-primary" href="${escapeAttr(item.url || "")}" download>下载</a>
          <button data-commerce-media-action="copy" type="button">复制</button>
          <button data-commerce-media-action="retry" type="button">重做</button>
          <button data-commerce-media-action="save-template" type="button">模板</button>
          <button class="is-danger" data-commerce-media-action="delete" type="button">删除</button>
        </div>
      </div>
    </article>
  `;
}

function saveCommerceTemplateFromMedia(mediaId) {
  const commerceJobs = jobsForWorkspace("commerce");
  const jobById = new Map(commerceJobs.map((job) => [job.id, job]));
  const media = mediaForWorkspace("commerce").find((item) => item.id === mediaId);
  if (!media) return;
  const job = jobById.get(media.job_id) || {};
  const prompt = media.prompt || job.prompt || "";
  if (!prompt) return;
  const now = Date.now() / 1000;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  commerceTemplates.unshift({
    id,
    name: (job.title || prompt.slice(0, 18) || "图片模板").trim(),
    tags: ["图库"],
    prompt,
    style: job.style || "",
    model: media.model || job.model || "",
    size: "auto",
    resolution: media.resolution || job.resolution || "1K",
    quality: media.quality || job.quality || "auto",
    format: media.output_format || job.output_format || "png",
    background: media.background || job.background || "auto",
    upscale: media.local_upscale || job.local_upscale || "none",
    mode: media.edit_mode || job.edit_mode ? "image" : "text",
    ratio: media.aspect_ratio || job.aspect_ratio || "1:1",
    favorite: false,
    usage_count: 0,
    created_at: now,
    updated_at: now,
  });
  saveCommerceTemplates();
  renderCommerceTemplates();
  setCommerceStatus("已存为模板", "success");
}

function renderCommerceGallery() {
  if (!commerceEls.gallery) return;
  const recentItems = latestCommerceItems(500);
  const recentPageSize = 6;
  const recentPageCount = Math.max(1, Math.ceil(recentItems.length / recentPageSize));
  commerceResultPage = Math.max(1, Math.min(commerceResultPage, recentPageCount));
  const items = recentItems.slice((commerceResultPage - 1) * recentPageSize, commerceResultPage * recentPageSize);
  if (!recentItems.length) {
    commerceEls.gallery.innerHTML = '<div class="commerce-empty">生成后会在这里显示图片。</div>';
  } else {
    commerceEls.gallery.innerHTML = items.map(({ media, job }) => commerceMediaCard(media, job)).join("");
  }
  if (commerceEls.resultStatus) {
    commerceEls.resultStatus.textContent = recentItems.length
      ? `只显示未归档任务缩略图，共 ${recentItems.length} 张`
      : "列表为缩略图，点击预览查看原图";
  }
  if (commerceEls.resultPager) {
    commerceEls.resultPager.classList.toggle("hidden", recentItems.length <= recentPageSize);
    if (commerceEls.resultPageLabel) commerceEls.resultPageLabel.textContent = `${commerceResultPage} / ${recentPageCount}`;
    commerceEls.resultPageButtons.forEach((button) => {
      const action = button.dataset.commerceResultPage || "";
      button.disabled = action === "prev" ? commerceResultPage <= 1 : commerceResultPage >= recentPageCount;
    });
  }
  if (commerceEls.library) {
    const all = latestCommerceItems(500, { includeArchived: true });
    const pageSize = 36;
    const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
    commerceGalleryPage = Math.max(1, Math.min(commerceGalleryPage, pageCount));
    const pageItems = all.slice((commerceGalleryPage - 1) * pageSize, commerceGalleryPage * pageSize);
    commerceEls.library.innerHTML = pageItems.length
      ? pageItems.map(({ media, job }) => commerceMediaCard(media, job)).join("")
      : '<div class="commerce-empty">暂无图片</div>';
    if (commerceEls.galleryPageLabel) commerceEls.galleryPageLabel.textContent = `${commerceGalleryPage} / ${pageCount}`;
  }
}

function renderCommerceTasks() {
  const commerceJobs = jobsForWorkspace("commerce");
  const activeJobs = commerceJobs.filter((job) => !job.archived);
  if (commerceSelectedJobId && !activeJobs.some((job) => job.id === commerceSelectedJobId)) commerceSelectedJobId = "";
  const current = activeJobs.find((job) => job.id === commerceSelectedJobId) || activeJobs[0] || null;
  if (commerceEls.currentTask) {
    const currentStatus = String(current?.status || "").toLowerCase();
    commerceEls.currentTask.innerHTML = current
      ? `<div class="commerce-task-line commerce-task-line-current" data-commerce-job-id="${escapeAttr(current.id)}">
          <div class="commerce-task-head">
            <strong>${escapeHtml(current.model || current.title || "生成任务")}</strong>
            <span class="commerce-status-badge status-${escapeAttr(currentStatus)}">${escapeHtml(statusText(current.status || ""))}</span>
          </div>
          <span class="commerce-task-meta">${escapeHtml(formatTime(current.created_at))} · ${Number(current.count || 1)} 张</span>
          <p class="commerce-task-prompt">${escapeHtml(current.prompt || "暂无提示词")}</p>
          <div class="commerce-task-actions">
            <button data-commerce-history-action="retry" type="button">重新生成</button>
            <button data-commerce-history-action="archive" type="button">归档</button>
            <button class="is-danger" data-commerce-history-action="delete" type="button">删除</button>
          </div>
        </div>`
      : "还没有当前任务";
  }
  const recent = activeJobs.slice(0, 5);
  if (commerceEls.recentTasks) {
    commerceEls.recentTasks.innerHTML = recent.length ? recent.map((job) => {
      const status = String(job.status || "").toLowerCase();
      return `
      <div class="commerce-task-line" data-commerce-job-id="${escapeAttr(job.id)}">
        <div class="commerce-task-head">
          <strong>${escapeHtml(job.model || job.title || "生成任务")}</strong>
          <span class="commerce-status-badge status-${escapeAttr(status)}">${escapeHtml(statusText(job.status || ""))}</span>
        </div>
        <span class="commerce-task-meta">${escapeHtml(formatTime(job.created_at))}</span>
        <div class="commerce-task-actions">
          <button data-commerce-history-action="select" type="button">设为当前</button>
          <button data-commerce-history-action="retry" type="button">重新生成</button>
          <button data-commerce-history-action="archive" type="button">归档</button>
          <button class="is-danger" data-commerce-history-action="delete" type="button">删除</button>
        </div>
      </div>
    `}).join("") : "暂无任务";
  }
  if (!commerceEls.historyList) return;
  const jobs = commerceJobs.filter((job) => {
    if (commerceHistoryStatus === "archived") return Boolean(job.archived);
    if (job.archived) return false;
    return commerceHistoryStatus === "all" || job.status === commerceHistoryStatus;
  });
  if (commerceEls.archiveCompleted) {
    const completedCount = commerceJobs.filter((job) => !job.archived && job.status === "success").length;
    commerceEls.archiveCompleted.disabled = completedCount === 0;
    commerceEls.archiveCompleted.textContent = completedCount ? `归档已完成 ${completedCount}` : "归档已完成";
  }
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(jobs.length / pageSize));
  commerceHistoryPage = Math.max(1, Math.min(commerceHistoryPage, pageCount));
  const pageJobs = jobs.slice((commerceHistoryPage - 1) * pageSize, commerceHistoryPage * pageSize);
  commerceEls.historyList.innerHTML = pageJobs.length ? pageJobs.map((job) => `
    <article class="commerce-history-item" data-commerce-job-id="${escapeAttr(job.id)}">
      <strong>${escapeHtml(job.model || job.title || "生成任务")}</strong>
      <span>${escapeHtml(job.status || "")} · ${escapeHtml(formatTime(job.created_at))} · ${Number(job.count || 1)} 张</span>
      <span>${escapeHtml(job.error || (job.prompt || "").slice(0, 180))}</span>
      <div class="commerce-template-actions">
        ${job.archived ? "" : '<button data-commerce-history-action="select" type="button">设为当前</button>'}
        <button data-commerce-history-action="retry" type="button">重新生成</button>
        <button data-commerce-history-action="${job.archived ? "restore" : "archive"}" type="button">${job.archived ? "恢复" : "归档"}</button>
        <button class="is-danger" data-commerce-history-action="delete" type="button">删除</button>
      </div>
    </article>
  `).join("") : '<div class="commerce-empty">暂无任务</div>';
  if (commerceEls.historyPageLabel) commerceEls.historyPageLabel.textContent = `${commerceHistoryPage} / ${pageCount}`;
}

function renderCommerceState() {
  syncCommerceFromMain();
  renderCommerceTemplates();
  renderCommerceGallery();
  renderCommerceTasks();
}

function setCommerceTab(tabName) {
  commerceActiveTab = tabName || "workspace";
  if (commerceActiveTab !== "workspace") setCommerceChatOpen(false);
  commerceEls.tabs.forEach((button) => button.classList.toggle("active", button.dataset.commerceTab === commerceActiveTab));
  commerceEls.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.commercePanel === commerceActiveTab));
  renderCommerceState();
}

function previewCommerceMedia(id) {
  const commerceJobs = jobsForWorkspace("commerce");
  const jobById = new Map(commerceJobs.map((job) => [job.id, job]));
  const media = mediaForWorkspace("commerce").find((item) => item.id === id);
  if (!media) return;
  const job = jobById.get(media.job_id) || {};
  setMediaPreview(true, {
    title: media.model || job.model || "生成图片",
    prompt: media.prompt || job.prompt || "",
    url: media.url,
    thumbUrl: media.thumb_url || media.url,
    aspect_ratio: media.aspect_ratio || job.aspect_ratio || "",
    resolution: media.resolution || job.resolution || "",
    size: media.size || job.size || "",
  });
}

async function deleteCommerceMedia(id) {
  if (!id) return;
  await api("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({ media_ids: [id] }),
  });
  await loadState();
  renderCommerceState();
}

async function deleteCommerceJob(jobId) {
  if (!jobId) return;
  const job = jobsForWorkspace("commerce").find((item) => item.id === jobId);
  const label = job?.model || job?.title || "该任务";
  if (!confirm(`确认删除${label}？\n\n会同时移除该任务生成的图片记录。`)) return;
  await api("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({ job_ids: [jobId] }),
  });
  if (commerceSelectedJobId === jobId) commerceSelectedJobId = "";
  await loadState();
  renderCommerceState();
}

async function archiveCommerceJob(jobId, archived = true) {
  if (!jobId) return;
  await api("/api/jobs/archive", {
    method: "POST",
    body: JSON.stringify({ job_ids: [jobId], archived }),
  });
  if (archived && commerceSelectedJobId === jobId) commerceSelectedJobId = "";
  await loadState();
  renderCommerceState();
}

async function archiveCompletedCommerceJobs() {
  const jobIds = jobsForWorkspace("commerce")
    .filter((job) => !job.archived && job.status === "success")
    .map((job) => job.id)
    .filter(Boolean);
  if (!jobIds.length) return;
  await api("/api/jobs/archive", {
    method: "POST",
    body: JSON.stringify({ job_ids: jobIds, archived: true }),
  });
  if (commerceSelectedJobId && jobIds.includes(commerceSelectedJobId)) commerceSelectedJobId = "";
  await loadState();
  renderCommerceState();
}

function clampMediaPreviewScale(value) {
  return Math.max(0.35, Math.min(5, value));
}

function syncMediaPreviewTransform() {
  if (!els.mediaPreviewImage) return;
  els.mediaPreviewImage.style.transform = `translate3d(${mediaPreviewTranslate.x}px, ${mediaPreviewTranslate.y}px, 0) scale(${mediaPreviewScale})`;
  els.mediaPreviewImage.style.cursor = mediaPreviewScale > 1 ? "grab" : "zoom-in";
}

function resetMediaPreviewTransform() {
  mediaPreviewScale = 1;
  mediaPreviewTranslate = { x: 0, y: 0 };
  syncMediaPreviewTransform();
}

function setMediaPreview(open = false, item = activeMediaPreviewItem) {
  if (!els.mediaPreviewModal) return;
  activeMediaPreviewItem = open ? item : null;
  els.mediaPreviewModal.classList.toggle("hidden", !open);
  document.body.classList.toggle("media-preview-open", open);
  mediaPreviewDrag = null;
  mediaPreviewPointers.clear();
  mediaPreviewPinch = null;
  if (!open || !item) {
    if (els.mediaPreviewImage) els.mediaPreviewImage.removeAttribute("src");
    resetMediaPreviewTransform();
    return;
  }
  resetMediaPreviewTransform();
  const meta = [
    item.title || "生成图片",
    item.aspect_ratio,
    item.resolution,
    item.actual_size || item.size,
  ].filter(Boolean).join(" · ");
  if (els.mediaPreviewTitle) els.mediaPreviewTitle.textContent = item.title || "生成图片";
  if (els.mediaPreviewMeta) els.mediaPreviewMeta.textContent = meta;
  if (els.mediaPreviewImage) {
    els.mediaPreviewImage.src = item.url || "";
    els.mediaPreviewImage.alt = item.prompt || "生成图片";
  }
  if (els.mediaPreviewPrompt) els.mediaPreviewPrompt.textContent = item.prompt || "暂无提示词";
  if (els.mediaPreviewAgent) {
    const agentText = item.agentName ? `✣ ${item.agentName} ${item.agentVariant ? variantLabel(item.agentVariant) : ""}` : "";
    els.mediaPreviewAgent.textContent = agentText;
    els.mediaPreviewAgent.classList.toggle("hidden", !agentText);
  }
}

function renderMedia() {
  const items = galleryItems();
  const studioMedia = mediaForWorkspace("studio");
  selectedGalleryIds = new Set([...selectedGalleryIds].filter((id) => items.some((item) => item.id === id)));
  if (els.mediaCount) {
    els.mediaCount.textContent = studioMedia.length;
  }
  if (els.showAllMedia) {
    const filtered = Boolean(currentHistoryJob()) || selectedHistoryJobId === NEW_TASK_DRAFT_ID;
    els.showAllMedia.classList.toggle("return-all", filtered);
    els.showAllMedia.setAttribute(
      "title",
      filtered ? `当前只显示部分记录，点击显示全部 ${studioMedia.length} 张` : `已显示全部最近生成 ${studioMedia.length} 张`
    );
    els.showAllMedia.setAttribute("aria-label", filtered ? "显示全部最近生成" : "全部最近生成");
  }
  els.mediaGrid.innerHTML = "";
  els.emptyState.style.display = items.length ? "none" : "grid";
  const emptyTitle = els.emptyState?.querySelector("strong");
  const emptyCopy = els.emptyState?.querySelector("span:last-child");
  if (emptyTitle && emptyCopy) {
    const activeJob = currentHistoryJob();
    if (selectedHistoryJobId === NEW_TASK_DRAFT_ID) {
      emptyTitle.textContent = "新任务";
      emptyCopy.textContent = "旧记录已归档到左侧，输入提示词开始新的生成。";
    } else if (activeJob) {
      emptyTitle.textContent = activeJob.status === "running" || activeJob.status === "queued" ? "当前任务生成中" : "当前任务暂无图片";
      emptyCopy.textContent = activeJob.status === "running" || activeJob.status === "queued"
        ? "图片完成后会只显示在当前任务画布里。"
        : "这条记录没有可显示图片，可重新生成或切回全部记录。";
    } else {
      emptyTitle.textContent = "准备生成";
      emptyCopy.textContent = "读取模型后输入提示词开始生成";
    }
  }
  renderGalleryHeader(items);
  if (!items.length) return;
  for (const item of items) {
    const selected = selectedGalleryIds.has(item.id);
    const agentLabel = item.agentName
      ? `✣ ${escapeHtml(item.agentName)} ${item.agentVariant ? variantLabel(item.agentVariant) : ""}`
      : (item.references?.length ? "✣ 参考生图" : "✣ 通用生图");
    const canReuseReferences = Boolean(item.editMode && item.references?.length);
    const card = document.createElement("article");
    card.className = `image-card ${item.status} ${selected ? "selected" : ""}`;
    const preview = item.url
      ? `<div class="image-preview-frame"><img src="${escapeAttr(item.thumbUrl || item.url)}" alt="${escapeAttr(item.prompt)}" loading="lazy" decoding="async"></div>`
      : `<div class="image-preview-frame"><div class="failed-preview"><span>!</span><strong>生成失败</strong><div><button type="button" data-card-action="retry">重试</button><button type="button" data-card-action="details">详情</button></div></div></div>`;
    card.innerHTML = `
      <button class="image-select" type="button" aria-label="选择生成记录"><span>${selected ? "✓" : ""}</span></button>
      <span class="image-index">#${escapeHtml(item.index || 1)}</span>
      ${preview}
      <div class="image-card-body">
        <div class="image-card-line">
          <span class="image-time">${item.status === "error" ? "ⓘ" : "✓"}</span>
          <strong>${escapeHtml(item.title || "生成记录")}</strong>
        </div>
        <div class="image-badges">
          <span>${escapeHtml(item.aspect_ratio)}</span>
          <span>${escapeHtml(item.resolution)}</span>
          <span>${escapeHtml(item.size)}</span>
          ${item.actual_size ? `<span>实际 ${escapeHtml(item.actual_size)}</span>` : ""}
          ${item.quality && item.quality !== "auto" ? `<span>${escapeHtml(item.quality)}</span>` : ""}
        </div>
        <div class="image-agent-tag">${agentLabel}</div>
        ${item.status === "error" ? `<div class="image-error">${escapeHtml(item.error || "生成失败")}</div>` : ""}
        <p>${escapeHtml(item.prompt || "暂无提示词")}</p>
        <div class="image-actions ${item.status === "error" ? "image-actions-error" : ""}">
          ${item.url ? `<button type="button" data-card-action="preview">预览</button><a href="${escapeAttr(item.url)}" download>下载</a>` : ""}
          ${item.status === "error" ? `<button type="button" class="retry" data-card-action="retry">重试</button>` : ""}
          <button type="button" data-card-action="reuse">复用</button>
          ${canReuseReferences ? `<button type="button" data-card-action="reuse-with-references" title="连同参考图一起复用">参考图复用</button>` : ""}
          ${item.url ? `<button type="button" data-card-action="square">推荐广场</button>` : ""}
        </div>
      </div>
    `;
    card.querySelector(".image-select").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleGalleryItem(item.id);
    });
    card.querySelector(".image-preview-frame")?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.url) setMediaPreview(true, item);
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest("a,button")) return;
      toggleGalleryItem(item.id);
    });
    card.querySelector('[data-card-action="preview"]')?.addEventListener("click", () => {
      setMediaPreview(true, item);
    });
    card.querySelector('[data-card-action="reuse"]')?.addEventListener("click", () => {
      applyGalleryItemToPrompt(item, false);
    });
    card.querySelector('[data-card-action="square"]')?.addEventListener("click", () => {
      recommendGalleryItem(item);
    });
    card.querySelector('[data-card-action="reuse-with-references"]')?.addEventListener("click", () => {
      applyGalleryItemToPrompt(item, true);
    });
    card.querySelector('[data-card-action="details"]')?.addEventListener("click", () => {
      alert(item.error || "生成失败");
    });
    card.querySelectorAll('[data-card-action="retry"]').forEach((button) => {
      button.addEventListener("click", () => retryJobs([item.rawId]));
    });
    els.mediaGrid.append(card);
  }
}

function renderReferences() {
  if (els.referenceList) els.referenceList.innerHTML = "";
  if (els.composerReferenceList) els.composerReferenceList.innerHTML = "";
  if (!state.references.length) {
    els.composerReferenceList?.classList.add("hidden");
    els.referenceSendSummary?.classList.add("hidden");
    if (commerceEls.referenceUpload) commerceEls.referenceUpload.textContent = "上传参考图";
    syncReferenceAspectControl();
    return;
  }
  for (const ref of state.references.slice(0, 12)) {
    if (!els.referenceList || els.referenceList.classList.contains("hidden")) break;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `reference-thumb ${selectedReferenceIds.has(ref.id) ? "active" : ""}`;
    btn.innerHTML = `
      <img src="${escapeAttr(ref.url)}" alt="">
      <span>${escapeHtml(ref.name || "参考图")}</span>
    `;
    btn.addEventListener("click", () => {
      if (selectedReferenceIds.has(ref.id)) {
        selectedReferenceIds.delete(ref.id);
      } else if (selectedReferenceIds.size < MAX_REFERENCE_SELECTION) {
        selectedReferenceIds.add(ref.id);
      } else {
        showReferenceLimitHint();
      }
      referenceAspectAutoEnabled = selectedReferenceIds.size === 1;
      renderReferences();
      syncSummary();
    });
    els.referenceList.append(btn);
  }
  const selectedRefs = selectedReferenceItems();
  if (commerceEls.referenceUpload) {
    commerceEls.referenceUpload.textContent = selectedRefs.length ? `已选 ${selectedRefs.length}/${MAX_REFERENCE_SELECTION}` : "上传";
  }
  if (commerceEls.referencePreview) {
    if (selectedRefs.length) {
      commerceEls.referencePreview.innerHTML = selectedRefs.map((ref) => `
        <article class="commerce-reference-thumb" data-commerce-reference-id="${escapeAttr(ref.id)}">
          <img src="${escapeAttr(ref.url)}" alt="${escapeAttr(ref.name || "参考图")}">
          <button type="button" aria-label="移除参考图">×</button>
        </article>
      `).join("");
      commerceEls.referencePreview.querySelectorAll("[data-commerce-reference-id] button").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const item = button.closest("[data-commerce-reference-id]");
          selectedReferenceIds.delete(item?.dataset.commerceReferenceId || "");
          renderReferences();
        });
      });
    } else {
      commerceEls.referencePreview.innerHTML = `
        <strong>⇧</strong>
        <span>上传一张或多张参考图片，AI 将基于这些图片进行修改</span>
      `;
    }
  }
  if (selectedRefs.length === 1) {
    syncReferenceAspectAuto({ announce: true });
  } else {
    referenceAspectAutoValue = "";
    referenceAspectAutoEnabled = true;
  }
  if (els.referenceSendSummary) {
    els.referenceSendSummary.textContent = selectedRefs.length
      ? `将发送参考图 ${selectedRefs.length}/${MAX_REFERENCE_SELECTION}`
      : "";
    els.referenceSendSummary.classList.toggle("hidden", !selectedRefs.length);
    els.referenceSendSummary.classList.toggle("limit", selectedRefs.length >= MAX_REFERENCE_SELECTION);
  }
  syncReferenceAspectControl();
  if (!els.composerReferenceList) return;
  els.composerReferenceList.classList.toggle("hidden", !selectedRefs.length);
  selectedRefs.forEach((ref) => {
    const type = (ref.mime || "image/png").split("/").pop().toUpperCase();
    const meta = [
      ref.width && ref.height ? `${ref.width} x ${ref.height}` : "参考图",
      type,
      ref.size ? `${Math.max(1, Math.round(ref.size / 1024))} KB` : "",
    ].filter(Boolean).join(" · ");
    const item = document.createElement("article");
    item.className = "composer-reference-item";
    item.innerHTML = `
      <img src="${escapeAttr(ref.url)}" alt="">
      <div>
        <strong>${escapeHtml(ref.name || "参考图")}</strong>
        <span>${escapeHtml(meta)}</span>
      </div>
      <span class="reference-ok">✓</span>
      <button type="button" aria-label="移除参考图">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      selectedReferenceIds.delete(ref.id);
      renderReferences();
    });
    els.composerReferenceList.append(item);
  });
}

function renderState() {
  restoreHistorySelection();
  if (selectedHistoryJobId && selectedHistoryJobId !== NEW_TASK_DRAFT_ID && !jobsForWorkspace("studio").some((job) => job.id === selectedHistoryJobId)) {
    selectedHistoryJobId = null;
    selectedGalleryIds.clear();
    persistHistorySelection(false);
  }
  if (selectedHistoryDayKey && !jobsForHistoryDay(selectedHistoryDayKey).length) {
    selectedHistoryDayKey = null;
  }
  renderHistory();
  renderMedia();
  renderReferences();
  renderAvailableModels();
  renderPresetPanel();
  renderPoolUser();
  syncResearchOutputsFromState();
  renderCommerceState();
  syncSummary();
}

function showReferenceLimitHint(message = `最多同时发送 ${MAX_REFERENCE_SELECTION} 张参考图`) {
  if (!els.referenceSendSummary) {
    alert(message);
    return;
  }
  const previous = els.referenceSendSummary.textContent;
  els.referenceSendSummary.textContent = message;
  els.referenceSendSummary.classList.remove("hidden");
  els.referenceSendSummary.classList.add("limit");
  window.setTimeout(() => {
    const selectedCount = selectedReferenceIds.size;
    els.referenceSendSummary.textContent = selectedCount
      ? `将发送参考图 ${selectedCount}/${MAX_REFERENCE_SELECTION}`
      : previous;
    els.referenceSendSummary.classList.toggle("hidden", !selectedCount);
    els.referenceSendSummary.classList.toggle("limit", selectedCount >= MAX_REFERENCE_SELECTION);
  }, 1800);
}

function addSelectedReferenceId(id) {
  if (!id) return false;
  if (selectedReferenceIds.has(id)) return true;
  if (selectedReferenceIds.size >= MAX_REFERENCE_SELECTION) {
    const first = selectedReferenceIds.values().next().value;
    if (first) selectedReferenceIds.delete(first);
  }
  selectedReferenceIds.add(id);
  return true;
}

function mergeReferenceItems(refs = []) {
  const incoming = refs.filter((ref) => ref?.id);
  if (!incoming.length) return;
  const byId = new Map(state.references.map((ref) => [ref.id, ref]));
  incoming.forEach((ref) => byId.set(ref.id, ref));
  state.references = [...byId.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

function isReferenceImageFile(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("image/")) return true;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  return REFERENCE_IMAGE_EXTENSIONS.has(ext);
}

async function loadState() {
  state = await api("/api/state");
  const debug = state.model_config?.debug || {};
  const custom = state.model_config?.connections?.custom || {};
  const routes = state.model_config?.custom_model_routes || {};
  debugCustomApi.enabled = Boolean(debug.workbench_custom_api);
  const imageRoute = routes.image || {};
  const textRoute = routes.text || {};
  const imageFallbackRoute = imageRoute.enabled ? imageRoute : (textRoute.enabled ? textRoute : {});
  const textFallbackRoute = textRoute.enabled ? textRoute : (imageRoute.enabled ? imageRoute : {});
  debugCustomApi.image = {
    apiUrl: debugCustomApi.enabled ? (imageFallbackRoute.url || custom.url || DEFAULT_CUSTOM_API_URL) : "",
    hasApiKey: Boolean(debugCustomApi.enabled && (imageFallbackRoute.api_key_configured || custom.api_key_configured)),
    routeKind: imageRoute.enabled ? "image" : (textRoute.enabled ? "text" : ""),
  };
  debugCustomApi.text = {
    apiUrl: debugCustomApi.enabled ? (textFallbackRoute.url || debugCustomApi.image.apiUrl || DEFAULT_CUSTOM_API_URL) : "",
    hasApiKey: Boolean(debugCustomApi.enabled && (textFallbackRoute.api_key_configured || debugCustomApi.image.hasApiKey)),
    routeKind: textRoute.enabled ? "text" : debugCustomApi.image.routeKind,
  };
  debugCustomApi.apiUrl = debugCustomApi.image.apiUrl;
  debugCustomApi.hasApiKey = debugCustomApi.image.hasApiKey;
  renderDebugApiState();
  renderState();
  loadSquare();
}

function hasActiveGenerationJobs() {
  return submitInFlight || state.jobs.some((job) => ["queued", "running"].includes(job.status));
}

function scheduleStateRefresh(delay = (hasActiveGenerationJobs() ? 1500 : 5000)) {
  window.clearTimeout(stateRefreshTimer);
  stateRefreshTimer = window.setTimeout(refreshStateLoop, delay);
}

async function refreshStateLoop() {
  if (stateRefreshInFlight) {
    scheduleStateRefresh(1000);
    return;
  }
  stateRefreshInFlight = true;
  try {
    await loadState();
  } catch (err) {
    console.warn("state refresh failed", err);
  } finally {
    stateRefreshInFlight = false;
    scheduleStateRefresh();
  }
}

function buildVariants() {
  return [];
}

async function performSubmitJob(promptOverride = "") {
  if (submitInFlight) return;
  const prompt = (promptOverride || els.prompt.value).trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }
  submitInFlight = true;
  agentModePlan = null;
  try {
    if (els.connectionMode.value === "pool" && !activePoolUser()) {
      setConnectionStatus("请先登录号池账号", "error");
      setModelStatus("请先登录号池账号", "error");
      els.poolUsername?.focus();
      return;
    }
    saveApiKeyPreference();
    const numbers = normalizeGenerationNumbers();
    activeSubmitRequestId = activeSubmitRequestId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    els.submitJob.disabled = true;
    els.submitJob.textContent = "…";
    const activeAgent = agentEnabled && selectedAgent ? selectedAgent : null;
    const workspace = document.body.classList.contains("commerce-active") ? "commerce" : "studio";
    const commerceImageMode = workspace === "commerce" && commerceModeValue() === "image";
    const submittedReferenceIds = workspace === "commerce" && !commerceImageMode
      ? []
      : Array.from(selectedReferenceIds).slice(0, MAX_REFERENCE_SELECTION);
    let title = els.title.value.trim();
    if (!activeAgent && titleMatchesIndustryAgent(title)) {
      title = "";
    }
    title = title || (activeAgent ? activeAgent.name : "");
    const created = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        mode: "single",
        workspace,
        client_request_id: activeSubmitRequestId,
        title,
        prompt,
        model: els.model.value,
        protocol: els.protocol.value,
        connection_mode: els.connectionMode.value,
        api_url: selectedApiUrl(),
        api_key: selectedApiKey(),
        agent_id: activeAgent?.id || "",
        agent_name: activeAgent?.name || "",
        agent_variant: activeAgent ? (appliedAgentVariant || "") : "",
        agent_enabled: Boolean(activeAgent),
        aspect_ratio: els.aspectRatio.value,
        resolution: els.resolution.value,
        size: requestSize(),
        quality: els.quality.value,
        output_format: els.outputFormat.value,
        background: workspace === "commerce" ? (commerceEls.background?.value || "auto") : "auto",
        local_upscale: workspace === "commerce" ? (commerceEls.upscale?.value || "none") : "none",
        count: numbers.count,
        concurrency: numbers.concurrency,
        retry_limit: numbers.retryLimit,
        seed: els.seed.value.trim(),
        negative: els.negative.value.trim(),
        variants: buildVariants(),
        reference_ids: submittedReferenceIds,
        edit_mode: workspace === "commerce" ? Boolean(commerceImageMode && submittedReferenceIds.length) : Boolean(els.editMode.checked || submittedReferenceIds.length),
      }),
    });
    els.prompt.value = prompt;
    if (workspace === "studio") {
      selectedHistoryJobId = created?.job?.id || null;
      persistHistorySelection(false);
    }
    selectedGalleryIds.clear();
    closePromptAnalysis();
    syncSummary();
    await loadState();
    scheduleStateRefresh(800);
  } catch (err) {
    alert(err.message);
  } finally {
    submitInFlight = false;
    activeSubmitRequestId = "";
    els.submitJob.disabled = false;
    els.submitJob.textContent = "➤";
  }
}

function setPreflightActionMode(active = false) {
  if (!els.applyOptimizedPrompt) return;
  els.applyOptimizedPrompt.textContent = active ? "✣ 立即使用优化版生成" : "✣ 应用优化提示词";
  if (els.applyOptimizedParams) {
    els.applyOptimizedParams.textContent = "☷ 应用推荐参数";
    els.applyOptimizedParams.classList.toggle("hidden", active);
  }
  els.copyOptimizedPrompt?.classList.toggle("hidden", active);
  if (els.continueOriginalPrompt) {
    els.continueOriginalPrompt.textContent = active ? "原样立即生成" : "原样继续";
    els.continueOriginalPrompt.classList.toggle("hidden", !active && (!els.promptAnalysisCard || els.promptAnalysisCard.classList.contains("hidden")));
  }
}

function isPreflightAwaitingAction() {
  return Boolean(
    preflightOriginalPrompt &&
    els.promptAnalysisCard &&
    !els.promptAnalysisCard.classList.contains("hidden")
  );
}

function stopPreflight() {
  preflightCancelled = true;
  preflightAnalysisInFlight = false;
  window.clearInterval(preflightTimer);
  preflightTimer = 0;
  preflightOriginalPrompt = "";
  if (els.submitJob) {
    els.submitJob.disabled = false;
    els.submitJob.textContent = "➤";
  }
  if (els.preflightGenerate && !els.preflightGenerate.classList.contains("hidden")) {
    els.preflightGenerate.classList.add("paused");
    if (els.preflightSeconds) els.preflightSeconds.textContent = "0";
    if (els.preflightText) els.preflightText.textContent = "已取消本次发送，可继续编辑后重新发送";
    if (els.preflightProgress) els.preflightProgress.style.width = "0%";
  } else {
    els.preflightGenerate?.classList.add("hidden");
  }
  setPreflightActionMode(false);
}

async function showAgentModePreflight() {
  const originalPrompt = els.prompt.value.trim();
  if (!originalPrompt) return false;
  els.submitJob.disabled = true;
  els.submitJob.textContent = "拆";
  setModelStatus("Agent 模式 A 正在调用文本模型拆解任务...", "loading");
  try {
    agentModePlan = await requestAgentModePlan(originalPrompt);
    showAgentModeAnalysis(agentModePlan, originalPrompt);
    return true;
  } catch (err) {
    agentModePlan = null;
    setModelFetchHelp(`Agent 模式 A 拆解失败，已改用本地预检：${err.message}`, "error");
    showPreflightGenerate();
    return false;
  } finally {
    submitInFlight = false;
    activeSubmitRequestId = "";
    els.submitJob.disabled = false;
    els.submitJob.textContent = "➤";
  }
}

function startPreflightCountdown() {
  setPreflightActionMode(true);
  els.preflightGenerate?.classList.remove("hidden");
  els.preflightGenerate?.classList.remove("paused");
  let remaining = 10;
  const total = remaining;
  const agentName = selectedAgent ? `${selectedAgent.name} · ${variantLabel(appliedAgentVariant || "stable")}` : "优化版";
  const tick = () => {
    els.preflightSeconds.textContent = `${remaining}s`;
    els.preflightText.textContent = `${remaining} 秒后使用 ${agentName} 自动生成`;
    els.preflightProgress.style.width = `${Math.max(0, Math.min(100, ((total - remaining) / total) * 100))}%`;
    if (remaining <= 0) {
      stopPreflight();
      applyRecommendedParams();
      performSubmitJob(els.optimizedPrompt.value.trim() || preflightOriginalPrompt);
    }
    remaining -= 1;
  };
  window.clearInterval(preflightTimer);
  tick();
  preflightTimer = window.setInterval(tick, 1000);
}

async function runPreflightAiAnalysis() {
  if (preflightAnalysisInFlight || !isPreflightAwaitingAction()) return;
  const textModel = selectedTextModel();
  if (!textModel) {
    setAnalysisReady("未配置文本模型", "右侧 Agent 文本模型未接入，当前只能使用本地预检结果。");
    flashButton(els.preflightRunAi, "未配置文本模型");
    return;
  }
  preflightCancelled = false;
  preflightAnalysisInFlight = true;
  const originalButtonText = els.preflightRunAi?.textContent || "AI 分析";
  if (els.preflightRunAi) {
    els.preflightRunAi.disabled = true;
    els.preflightRunAi.textContent = "分析中...";
  }
  if (els.submitJob) {
    els.submitJob.disabled = true;
    els.submitJob.textContent = "AI";
  }
  els.analysisResultTitle.textContent = "正在调用文本 AI 预检";
  setAnalysisReady("GPT 分析模型", `正在使用 ${selectedTextModelLabel()} 优化提示词和参数，完成后由你手动确认是否生成。`);
    if (els.preflightSeconds) els.preflightSeconds.textContent = "AI";
  if (els.preflightText) els.preflightText.textContent = `正在使用 ${selectedTextModelLabel()} 做发送前优化...`;
  if (els.preflightProgress) els.preflightProgress.style.width = "45%";
  try {
    const plan = await requestPromptAnalysis("preflight");
    if (preflightCancelled) return;
    showTextAiAnalysis(plan, preflightOriginalPrompt, "preflight");
    setPreflightActionMode(true);
    els.preflightGenerate?.classList.add("hidden");
    if (els.preflightProgress) els.preflightProgress.style.width = "0%";
  } catch (err) {
    if (preflightCancelled) return;
    showPromptAnalysis("preflight");
    setPreflightActionMode(true);
    setAnalysisReady("本地规则预检", `文本 AI 调用失败，已保留本地规则结果：${err.message}`);
    if (els.preflightSeconds) els.preflightSeconds.textContent = "失败";
    if (els.preflightText) els.preflightText.textContent = "AI 分析失败，已保留本地预检，可继续手动生成。";
    if (els.preflightProgress) els.preflightProgress.style.width = "0%";
  } finally {
    preflightAnalysisInFlight = false;
    if (els.preflightRunAi) {
      els.preflightRunAi.disabled = false;
      els.preflightRunAi.textContent = originalButtonText;
    }
    if (els.submitJob) {
      els.submitJob.disabled = false;
      els.submitJob.textContent = "➤";
    }
  }
}

async function showPreflightGenerate() {
  if (preflightTimer || submitInFlight || preflightAnalysisInFlight) return;
  preflightCancelled = false;
  preflightOriginalPrompt = els.prompt.value.trim();
  agentModePlan = null;
  showPromptAnalysis("preflight");
  els.analysisResultTitle.textContent = "发送前预检完成";
  els.preflightGenerate?.classList.remove("hidden");
  els.preflightGenerate?.classList.remove("paused");
  setPreflightActionMode(true);
  if (els.preflightSeconds) els.preflightSeconds.textContent = "待确认";
  if (els.preflightText) els.preflightText.textContent = selectedTextModel()
    ? "已完成本地预检；可点 AI 分析深度优化，或直接选择生成方式。"
    : "已完成本地预检；未配置文本模型，可直接选择生成方式。";
  if (els.preflightProgress) els.preflightProgress.style.width = "100%";
  if (preflightCancelled) return;
}

async function submitJob() {
  if (submitInFlight || preflightTimer || preflightAnalysisInFlight) return;
  const prompt = els.prompt.value.trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }
  if (agentModeEnabled) {
    await showAgentModePreflight();
    return;
  }
  if (els.sendOptimize?.checked) {
    await showPreflightGenerate();
    return;
  }
  performSubmitJob(prompt);
}

async function refreshModels({ silent = false } = {}) {
  if (els.connectionMode.value === "pool") {
    if (!activePoolUser()) {
      verifiedImageModels = [];
      verifiedTextModels = [];
      replaceModelOptions([]);
      replaceTextModelOptions([]);
      renderAvailableModels();
      renderPoolUser();
      setConnectionStatus("请先登录号池账号", "idle");
      setModelStatus("请先登录号池账号", "idle");
      setModelFetchHelp("号池模式不需要 API Key，但需要使用后台创建的号池用户登录。", "idle");
      if (!silent) els.poolUsername?.focus();
      return;
    }
    const profileModels = modelProfiles.map((item) => item.id).filter(Boolean);
    const imageModels = (Array.isArray(state.models) ? state.models : profileModels).filter(isImageModel);
    const textModels = cleanTextModelList(profileModels);
    verifiedImageModels = imageModels.length ? imageModels : ["gpt-image-2"];
    verifiedTextModels = textModels;
    replaceModelOptions(verifiedImageModels);
    replaceTextModelOptions(verifiedTextModels);
    renderAvailableModels();
    const pool = state.account_pool || {};
    const okCount = Number(pool.ok || 0);
    setConnectionStatus(okCount > 0 ? `本地号池可用 ${okCount} 个账号` : "本地号池暂无可用账号", okCount > 0 ? "success" : "error");
    setModelStatus(`号池已启用 · ${verifiedImageModels.length} 个生图模型 · ${verifiedTextModels.length} 个文本模型`, okCount > 0 ? "success" : "idle");
    setModelFetchHelp(verifiedTextModels.length ? "号池模式会复用本地号池账号生成图片和 Agent 文本方案，无需填写自定义 API Key。" : "号池模式未配置文本模型，Agent 会显示手动文本模型配置面板。", okCount > 0 ? "success" : "idle");
    return;
  }
  if (els.connectionMode.value === "custom" && !selectedApiUrl()) {
    verifiedImageModels = [];
    verifiedTextModels = [];
    replaceModelOptions([]);
    replaceTextModelOptions([]);
    renderAvailableModels();
    setModelStatus("ⓘ 填写自定义 API URL 和 API Key 后自动验证", "idle");
    setConnectionStatus("填写自定义 API URL", "idle");
    setModelFetchHelp("自定义 API 适合接入云端 New API 或 OpenAI 兼容接口；地址通常以 /v1 结尾。", "idle");
    if (!silent) els.apiUrl.focus();
    return;
  }
  const apiKey = selectedApiKey();
  if (!apiKey && !adminDebugApiActive()) {
    verifiedImageModels = [];
    verifiedTextModels = [];
    replaceModelOptions([]);
    replaceTextModelOptions([]);
    renderAvailableModels();
    setModelStatus("ⓘ 填写 API Key 后自动验证", "idle");
    setConnectionStatus("填写 API Key 后自动验证", "idle");
    setModelFetchHelp("API Key 可在云端 New API 后台的“令牌”里创建或复制；填入后会自动读取模型。", "idle");
    return;
  }
  const requestId = ++modelRequestId;
  saveApiKeyPreference();
  els.refreshModels.disabled = true;
  setModelStatus("↻ 正在读取模型...", "loading");
  setConnectionStatus("↻ 正在验证", "loading");
  try {
    const data = await api("/api/models", {
      method: "POST",
      body: JSON.stringify({
        connection_mode: els.connectionMode.value,
        api_url: selectedApiUrl(),
        api_key: selectedApiKey(),
        model_kind: adminDebugApiActive() ? "both" : "image",
      }),
    });
    if (requestId !== modelRequestId) return;
    const allModels = Array.isArray(data.models) ? data.models : [];
    const imageModels = Array.isArray(data.image_models) ? data.image_models : allModels.filter(isImageModel);
    const textModels = cleanTextModelList(Array.isArray(data.text_models) ? data.text_models : allModels);
    verifiedImageModels = imageModels;
    verifiedTextModels = textModels;
    if (textModels.length && els.reuseTextApiKey) els.reuseTextApiKey.checked = true;
    replaceModelOptions(imageModels);
    replaceTextModelOptions(textModels);
    renderAvailableModels();
    state.models = imageModels;
    setConnectionStatus("已连接", "success");
    setModelStatus(`✓ API Key 有效 · ${imageModels.length} 个生图模型 · ${textModels.length} 个文本模型 · ${formatModelTime()}`, "success");
    setModelFetchHelp(`已连接：${data.api_url || selectedApiUrl() || "自定义 API"}。Agent 会优先使用识别到的文本模型；未找到文本模型时请填写有文本权限的 Key。`, "success");
  } catch (err) {
    if (requestId !== modelRequestId) return;
    verifiedImageModels = [];
    verifiedTextModels = [];
    replaceModelOptions([]);
    replaceTextModelOptions([]);
    renderAvailableModels();
    setConnectionStatus("连接失败", "error");
    const mode = els.connectionMode.value;
    const connectionHint = mode === "custom"
        ? "自定义 API 要确认地址、Token、模型权限和 OpenAI 兼容路径都正确。"
        : "本地号池请确认号池用户已登录且后台有可用账号。";
    setModelStatus(`✕ 读取失败：${err.message}`, "error");
    setModelFetchHelp(`${connectionHint} 如果仍失败，检查 New API Token 是否有效、是否有模型权限。`, "error");
    if (!silent) {
      els.apiKey.focus();
    }
  } finally {
    if (requestId === modelRequestId) {
      els.refreshModels.disabled = false;
    }
  }
}

async function refreshTextModelsOnly({ silent = false } = {}) {
  const apiUrl = selectedTextApiUrl();
  const apiKey = selectedTextApiKey();
  if (!apiUrl && !debugTextRouteActive()) {
    setModelStatus("请先填写文本模型 API URL", "error");
    if (!silent) els.textApiUrl?.focus();
    return;
  }
  if (!apiKey && !debugTextRouteActive()) {
    setModelStatus("请先填写文本模型 API Key", "error");
    syncTextApiKeyStatus("未配置文本 Key");
    if (!silent) els.textApiKey?.focus();
    return;
  }
  saveTextApiPreference();
  const requestId = ++modelRequestId;
  setModelStatus("↻ 正在读取文本模型...", "loading");
  syncTextApiKeyStatus("正在验证文本 Key...");
  try {
    const data = await api("/api/models", {
      method: "POST",
      body: JSON.stringify({
        connection_mode: els.connectionMode.value,
        api_url: apiUrl,
        api_key: apiKey,
        model_kind: "text",
      }),
    });
    if (requestId !== modelRequestId) return;
    const allModels = Array.isArray(data.models) ? data.models : [];
    const textModels = cleanTextModelList(Array.isArray(data.text_models) ? data.text_models : allModels);
    verifiedTextModels = textModels;
    if (textModels.length && els.reuseTextApiKey) els.reuseTextApiKey.checked = false;
    replaceTextModelOptions(textModels);
    const selected = selectedTextModel();
    if (selected) localStorage.setItem(SELECTED_TEXT_MODEL_KEY, selected);
    if (!textModels.length) {
      setModelStatus("文本 Key 有效，但没有识别到文本模型", "error");
      syncTextApiKeyStatus("文本 Key 已配置，未返回文本模型");
      return;
    }
    setModelStatus(`✓ 已读取 ${textModels.length} 个文本模型 · ${formatModelTime()}`, "success");
    syncTextApiKeyStatus("文本 Key 已配置");
  } catch (err) {
    if (requestId !== modelRequestId) return;
    verifiedTextModels = [];
    replaceTextModelOptions([]);
    setModelStatus(`✕ 文本模型读取失败：${err.message}`, "error");
    syncTextApiKeyStatus("文本 Key 验证失败");
  } finally {
    // No button state to restore; text model refresh is driven by debounced inputs.
  }
}

async function uploadReferenceFiles(fileList) {
  const incoming = Array.from(fileList || []).filter(Boolean);
  const files = incoming.filter(isReferenceImageFile);
  if (!files.length) {
    const message = incoming.length ? "请选择图片文件，支持 JPG、PNG、WEBP、AVIF、HEIC" : "没有选择参考图";
    if (document.body.classList.contains("commerce-active")) setCommerceStatus(message, "error");
    else alert(message);
    return;
  }
  const uploadFiles = files.slice(0, MAX_REFERENCE_SELECTION);
  if (incoming.length !== files.length) {
    showReferenceLimitHint(`已忽略 ${incoming.length - files.length} 个非图片文件`);
  }
  if (files.length > MAX_REFERENCE_SELECTION) {
    showReferenceLimitHint(`一次最多上传并选中 ${MAX_REFERENCE_SELECTION} 张参考图，已忽略后 ${files.length - MAX_REFERENCE_SELECTION} 张`);
  }
  const uploaded = [];
  let uploadError = null;
  if (document.body.classList.contains("commerce-active")) setCommerceStatus(`正在上传参考图 0/${uploadFiles.length}`, "loading");
  if (els.referenceUploadButton) {
    els.referenceUploadButton.disabled = true;
    els.referenceUploadButton.dataset.uploading = "true";
    els.referenceUploadButton.querySelector(".upload-label")?.replaceChildren(document.createTextNode(`0/${uploadFiles.length}`));
  }
  try {
    for (let index = 0; index < uploadFiles.length; index += 1) {
      const file = uploadFiles[index];
      if (document.body.classList.contains("commerce-active")) setCommerceStatus(`正在上传参考图 ${index + 1}/${uploadFiles.length}`, "loading");
      if (els.referenceUploadButton) {
        els.referenceUploadButton.querySelector(".upload-label")?.replaceChildren(document.createTextNode(`${index + 1}/${uploadFiles.length}`));
      }
      const form = new FormData();
      form.append("file", file);
      form.append("name", file.name);
      const resp = await fetch("/api/references", {
        method: "POST",
        headers: { "X-YY-Client-ID": clientId },
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `${file.name} 上传失败`);
      }
      uploaded.push(data.reference);
      addSelectedReferenceId(data.reference.id);
    }
  } catch (err) {
    uploadError = err;
    if (document.body.classList.contains("commerce-active")) setCommerceStatus(err.message || "参考图上传失败", "error");
    alert(err.message || "参考图上传失败");
  } finally {
    if (els.referenceUpload) els.referenceUpload.value = "";
    if (commerceEls.referenceInput) commerceEls.referenceInput.value = "";
    if (els.referenceUploadButton) {
      els.referenceUploadButton.disabled = false;
      delete els.referenceUploadButton.dataset.uploading;
      els.referenceUploadButton.querySelector(".upload-label")?.replaceChildren(document.createTextNode("参考图"));
    }
  }
  if (uploaded.length) {
    mergeReferenceItems(uploaded);
    renderReferences();
    syncSummary();
  }
  try {
    await loadState();
    if (uploaded.length) {
      mergeReferenceItems(uploaded);
      uploaded.forEach((ref) => addSelectedReferenceId(ref.id));
      renderReferences();
      syncSummary();
    }
  } catch (err) {
    console.warn("state refresh after reference upload failed", err);
  }
  if (uploaded.length && !uploadError && document.body.classList.contains("commerce-active")) {
    setCommerceStatus(`已上传并选中 ${uploaded.length} 张参考图`, "success");
  }
  if (uploaded.length && files.length > MAX_REFERENCE_SELECTION) {
    showReferenceLimitHint(`已上传并选中前 ${MAX_REFERENCE_SELECTION} 张参考图`);
  }
}

async function uploadReference() {
  await uploadReferenceFiles(els.referenceUpload.files || []);
}

async function clearMedia() {
  const activeJob = currentHistoryJob();
  if (activeJob) {
    const title = displayJobTitle(activeJob);
    if (!confirm(`删除当前任务记录？\n\n${title}\n\n会同时从工作台移除该任务生成的图片记录。`)) return;
    await api("/api/media/delete", {
      method: "POST",
      body: JSON.stringify({ job_ids: [activeJob.id], media_ids: [] }),
    });
    selectedHistoryJobId = null;
    selectedGalleryIds.clear();
    persistHistorySelection(false);
    await loadState();
    return;
  }
  const dayJobs = jobsForHistoryDay(selectedHistoryDayKey);
  if (selectedHistoryDayKey && dayJobs.length) {
    const label = historyDayLabel(selectedHistoryDayKey);
    if (!confirm(`删除${label}的全部任务记录？\n\n共 ${dayJobs.length} 个任务，会同时移除这些任务生成的图片记录。`)) return;
    await api("/api/media/delete", {
      method: "POST",
      body: JSON.stringify({ job_ids: dayJobs.map((job) => job.id), media_ids: [] }),
    });
    selectedHistoryDayKey = null;
    selectedGalleryIds.clear();
    persistHistorySelection(false);
    await loadState();
    return;
  }
  const studioJobs = jobsForWorkspace("studio");
  const studioMedia = mediaForWorkspace("studio");
  if (!studioJobs.length && !studioMedia.length) return;
  if (!confirm("确认删除专业生图台的全部会话任务和媒体库记录？\n\n其他工作台记录不受影响，图片文件会保留在 data/media。")) return;
  await api("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({
      job_ids: studioJobs.map((job) => job.id),
      media_ids: studioMedia.map((media) => media.id),
    }),
  });
  selectedHistoryJobId = null;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
  persistHistorySelection(false);
  await loadState();
}

async function deleteSelectedGallery() {
  if (!selectedGalleryIds.size) return;
  const mediaIds = [...selectedGalleryIds]
    .filter((id) => id.startsWith("media:"))
    .map((id) => id.split(":")[1]);
  const jobIds = [...new Set([...selectedGalleryIds]
    .filter((id) => id.startsWith("job:"))
    .map((id) => id.split(":")[1]))];
  await api("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({ media_ids: mediaIds, job_ids: jobIds }),
  });
  selectedGalleryIds.clear();
  persistHistorySelection(false);
  await loadState();
}

async function clearFailedGallery() {
  const failedJobIds = jobsForWorkspace("studio")
    .filter((job) => job.status === "error")
    .map((job) => job.id);
  if (!failedJobIds.length) return;
  await api("/api/media/delete", {
    method: "POST",
    body: JSON.stringify({ media_ids: [], job_ids: failedJobIds }),
  });
  selectedGalleryIds.clear();
  persistHistorySelection(false);
  await loadState();
}

async function retryJobs(jobIds = []) {
  const ids = [...new Set(jobIds.filter(Boolean))];
  if (!ids.length) return;
  if (els.connectionMode.value === "pool" && !activePoolUser()) {
    setConnectionStatus("请先登录号池账号", "error");
    setModelStatus("请先登录号池账号", "error");
    els.poolUsername?.focus();
    return;
  }
  saveApiKeyPreference();
  let lastStudioJobId = null;
  const errors = [];
  for (const jobId of ids) {
    try {
      const created = await api(`/api/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        body: JSON.stringify({
          api_key: selectedApiKey(),
          connection_mode: els.connectionMode.value,
          api_url: selectedApiUrl(),
          model: els.model.value,
          retry_limit: Number(els.retryLimit.value || 2),
        }),
      });
      const createdJob = created?.job || {};
      if (createdJob.id && jobWorkspace(createdJob) === "studio") {
        lastStudioJobId = createdJob.id;
      }
    } catch (err) {
      errors.push(`${jobId}: ${err.message}`);
    }
  }
  if (lastStudioJobId) {
    selectedHistoryJobId = lastStudioJobId;
    persistHistorySelection(false);
  }
  selectedGalleryIds.clear();
  await loadState();
  if (errors.length) {
    alert(`部分任务重试失败：\n${errors.join("\n")}`);
  }
}

function downloadSelectedGallery() {
  const items = galleryItems().filter((item) => selectedGalleryIds.has(item.id) && item.url);
  for (const item of items) {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
  }
}

function handleGalleryAction(action) {
  const items = galleryItems();
  if (action === "show-all") {
    window.showAllGenerated?.();
  } else if (action === "select-all") {
    selectedGalleryIds = new Set(items.map((item) => item.id));
    renderMedia();
  } else if (action === "invert") {
    selectedGalleryIds = new Set(items.filter((item) => !selectedGalleryIds.has(item.id)).map((item) => item.id));
    renderMedia();
  } else if (action === "cancel") {
    selectedGalleryIds.clear();
    renderMedia();
  } else if (action === "download") {
    downloadSelectedGallery();
  } else if (action === "delete") {
    deleteSelectedGallery();
  } else if (action === "clear-failed") {
    clearFailedGallery();
  } else if (action === "retry-failed") {
    const currentJob = currentHistoryJob();
    const ids = currentJob?.status === "error"
      ? [currentJob.id]
      : jobsForWorkspace("studio").filter((job) => job.status === "error").map((job) => job.id);
    retryJobs(ids);
  } else if (action === "retry-selected") {
    const ids = [...new Set([...selectedGalleryIds]
      .filter((id) => id.startsWith("job:"))
      .map((id) => id.split(":")[1])
      .filter((id) => jobsForWorkspace("studio").some((job) => job.id === id && job.status === "error")))];
    retryJobs(ids);
  }
}

function builtInPresets() {
  return [
    {
      id: "portrait-real",
      tag: "头像写真",
      name: "超写实人像",
      prompt: "8K 超写实近景人像肖像，女性，白皙皮肤，五官与参考照片 100% 一致，柔和侧逆光打在脸上，背景虚化，皮肤纹理与毛发细节清晰可见，真实摄影，85mm 镜头，自然表情，高级质感。",
    },
    {
      id: "ink-dragon",
      tag: "东方概念",
      name: "水墨双龙",
      prompt: "阴阳概念，两条中国龙龙对战，一条白龙一条黑龙，极简水墨画风格，黑色墨迹绘制在白色背景上，带有和纸纹理，大号红色印章签名，禅意风，留白充足，东方美学。",
    },
    {
      id: "info-architecture",
      tag: "信息图",
      name: "建筑文字剖面",
      prompt: "2x2 网格布局，每一格是一栋著名建筑的垂直剖面示意图，不画真实造型，而是用建筑结构与材料术语堆叠成楼层文字方块：地基、柱网、楼板、幕墙、采光井，极简信息图，清晰留白。",
    },
    {
      id: "blueprint-real",
      tag: "建筑渲染",
      name: "蓝图到现实",
      prompt: "创建一张纵向分屏建筑可视化图，上半部分是深色主题的精细建筑平立面蓝图，包含清晰线稿、标注和结构细节，下半部分是与蓝图完全对应的真实建筑渲染，光线自然，材质真实。",
    },
    {
      id: "ip-poster",
      tag: "IP 视觉",
      name: "人物侧脸海报",
      prompt: "核心结构：人物侧脸外轮廓 + 内部世界观填充，适合文学/IP/人物传记海报。风格方向：电影海报 + 东方现实主义，强调光影、空间纵深和宿命感，高级克制配色。",
    },
    {
      id: "toy-figure",
      tag: "3D 手办",
      name: "历史学家玩具",
      prompt: "2x2 网格布局，每格展示一个基于“历史学家”职业的可爱玩具人物立牌。输入为一个著名历史学家，分析其典型特征并转化为 Q 版或 chibi 手办，干净棚拍背景，真实材质。",
    },
    {
      id: "text-cover",
      tag: "社媒封面",
      name: "文本封面主视觉",
      prompt: "核心任务：把一句话或大段文本转成封面主视觉，适合小红书、X、公众号、Telegram 封面。设计思路：苹果设计师思维 + 海报大师思维 + 信息层级清晰，强留白。",
    },
    {
      id: "comic-meme",
      tag: "社论漫画",
      name: "社交媒体成瘾",
      prompt: "为“社交媒体上瘾”这个主题创作一幅正方形、单格的社论漫画。先推理出最有力、最讽刺的视觉隐喻，例如赌局、轮盘、正在下沉的船、被屏幕牵引的人群，黑白线稿加少量强调色。",
    },
  ];
}

function presetList() {
  const serverPresets = (state.presets || []).map((preset) => ({
    id: preset.id,
    tag: preset.mode || "预设",
    name: preset.name,
    prompt: preset.prompt,
    quality: preset.quality,
  }));
  const builtIns = builtInPresets();
  const seen = new Set();
  return [...builtIns, ...serverPresets].filter((preset) => {
    const key = preset.id || preset.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return preset.name && preset.prompt;
  }).slice(0, 8);
}

function renderPresetPanel() {
  if (!els.presetGrid) return;
  els.presetGrid.innerHTML = "";
  for (const preset of presetList()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.innerHTML = `
      <span>${escapeHtml(preset.tag || "预设")}</span>
      <strong>${escapeHtml(preset.name)}</strong>
      <p>${escapeHtml(preset.prompt)}</p>
    `;
    button.addEventListener("click", () => applyPreset(preset));
    els.presetGrid.append(button);
  }
}

function setPresetPanel(open) {
  renderPresetPanel();
  els.presetPanel?.classList.toggle("hidden", !open);
  els.composer?.classList.toggle("preset-open", open);
}

function applyPreset(preset) {
  const selected = preset || presetList()[0];
  if (!selected) return;
  els.prompt.value = selected.prompt || "";
  if (selected.quality && [...els.quality.options].some((option) => option.value === selected.quality)) {
    els.quality.value = selected.quality;
  }
  setPresetPanel(false);
  syncSummary();
  els.prompt.focus();
}

function recommendedPromptText() {
  const base = els.prompt.value.trim();
  if (base.includes("提示词蓝图") || base.includes("交付标准")) return base;
  const agentName = selectedAgent?.name || "通用生图";
  const subject = selectedAgent?.fields?.subject || "清晰主体";
  const skills = selectedAgent ? selectedPromptSkills() : defaultPromptSkills.custom.map((id) => ({ id, ...(promptSkillLibrary[id] || {}) })).filter((item) => item.name);
  const skillNames = skills.map((item) => item.name).join(" / ");
  const skillInstructions = skills.map((item) => item.instruction).filter(Boolean).join("\n");
  return [
    `提示词蓝图：${agentName} + ${skillNames || "主体清晰 / 卖点可视化"} + 材质细节 + 平台用途 + 可交付商业视觉`,
    `版本策略：主体为${subject}，产品完整清晰，占据画面中心，干净浅灰背景，柔和双侧棚拍布光，真实材质纹理，边缘清晰，轻微自然投影。`,
    skillInstructions ? `提示词技能执行：\n${skillInstructions}` : "",
    selectedReferenceIds.size ? `参考图要求：保留参考图主体结构、关键材质、色彩关系和构图线索，在此基础上重新生成可交付成片。` : "",
    "负面控制：低清晰度，主体变形，错误文字，杂乱背景，比例失真，廉价模板感，过度锐化，AI伪影，商品变形，过度反光，低质感，道具喧宾夺主",
    "交付标准：商品完整清晰；主体占比明确；材质真实；背景干净；适合电商平台。高细节，真实光影，专业商业视觉，可交付成片。",
    base,
  ].filter(Boolean).join("\n");
}

function setRecommendedParams({ quality = "auto", applyNow = false } = {}) {
  els.outputFormat.value = "png";
  if (selectedAgent?.count && agentEnabled) {
    els.count.value = String(selectedAgent.count);
  }
  syncConcurrencyToCount({ commit: true });
  if ([...els.quality.options].some((option) => option.value === quality)) {
    els.quality.value = quality;
  }
  if (selectedAgent?.negative) {
    els.negative.value = selectedAgent.negative;
  }
  if (applyNow) syncSummary();
}

async function requestPromptAnalysis(mode = "optimize") {
  const textModel = selectedTextModel();
  if (!textModel) {
    throw new Error("未配置文本分析模型");
  }
  const references = state.references
    .filter((ref) => selectedReferenceIds.has(ref.id))
    .slice(0, 4)
    .map((ref) => ({
      id: ref.id,
      name: ref.name || ref.filename || "",
      mime: ref.mime || "",
    }));
  const data = await api("/api/prompt-analysis", {
    method: "POST",
    body: JSON.stringify({
      mode,
      connection_mode: els.connectionMode.value,
      api_url: selectedApiUrl(),
      api_key: selectedApiKey(),
      text_model: textModel,
      text_api_url: selectedTextApiUrl(),
      text_api_key: selectedTextApiKey(),
      text_custom_fallback: Boolean(els.connectionMode.value === "pool" && !verifiedTextModels.length),
      prompt: els.prompt.value.trim(),
      image_model: els.model.value,
      aspect_ratio: els.aspectRatio.value,
      resolution: els.resolution.value,
      size: requestSize(),
      count: Number(els.count.value || 1),
      quality: els.quality.value,
      negative: els.negative.value.trim(),
      references,
    }),
  });
  if (data && data.ok === false) {
    throw new Error(data.detail || data.error || "文本分析失败");
  }
  return { ...(data.plan || {}), textModel: data.model || textModel, analysisMode: mode };
}

function showPromptAnalysis(mode = "optimize") {
  promptAnalysisPlan = null;
  syncAnalysisModeLabels(mode);
  const titles = {
    optimize: "提示词优化完成",
    params: "参数推荐完成",
    failure: "失败预判完成",
    style: "风格增强完成",
  };
  const style = mode === "style" ? "high" : "medium";
  setRecommendedParams({ quality: mode === "style" ? "high" : "auto", applyNow: true });
  const optimized = recommendedPromptText();
  const risks = [];
  if (selectedReferenceIds.size) risks.push(`参考图 ${selectedReferenceIds.size} 张：将自动走图生图/编辑模式，适合重绘、改风格和保留主体。`);
  if (Number(els.count.value || 1) > 1) risks.push(`当前 ${els.count.value} 张，并发建议 ${recommendedConcurrency(els.count.value)}；过高并发可能触发上游限流。`);
  if (!selectedAgent) risks.push("未选择行业 Agent：建议用动态行业或固定行业补全场景、平台和负面提示词。");
  if (!els.prompt.value.trim()) risks.push("提示词为空：需要输入主题或先用动态行业生成默认方案。");
  const warning = els.promptAnalysisCard?.querySelector(".analysis-warning");
  if (warning) {
    warning.querySelector("b").textContent = risks.length ? "预检发现可优化项" : "预检通过";
    warning.querySelector("span").textContent = risks.length
      ? risks.join(" ")
      : "当前提示词、参数和参考图配置可以直接生成；如需更强控制，可先应用优化版再发送。";
  }
  const textModelLabel = selectedTextModelLabel();
  setAnalysisReady(
    textModelLabel ? "本地快速预检" : "本地规则预检",
    textModelLabel
      ? `文本模型已配置（${textModelLabel}），本次发送倒计时使用本地快速预检；需要深度优化可点击优化提示词。`
      : "未配置文本模型时，使用本地规则完成预检；右侧 Agent 文本模型可接入 GPT 做更强分析。"
  );
  const styleTags = els.promptAnalysisCard?.querySelector(".analysis-style-tags");
  if (styleTags) {
    const skills = selectedAgent ? selectedPromptSkills() : defaultPromptSkills.custom.map((id) => ({ id, ...(promptSkillLibrary[id] || {}) })).filter((item) => item.name);
    styleTags.innerHTML = skills.slice(0, 4).map((item) => `<span>${escapeHtml(item.name)}</span>`).join("") || "<span>商业摄影</span><span>主体清晰</span><span>可交付</span>";
  }
  els.analysisResultTitle.textContent = titles[mode] || titles.optimize;
  els.promptScore.textContent = String(Math.max(62, 92 - risks.length * 8));
  els.analysisAspect.textContent = els.aspectRatio.value;
  els.analysisSize.textContent = requestSize();
  els.analysisCount.textContent = els.count.value;
  els.analysisStyle.textContent = style;
  els.optimizedPrompt.value = mode === "failure" && risks.length
    ? `${optimized}\n\n失败预判：\n${risks.map((item) => `- ${item}`).join("\n")}`
    : optimized;
  els.promptAnalysisCard.classList.remove("hidden");
  els.composer?.classList.add("analysis-open");
}

async function showSmartPromptAnalysis(mode = "optimize") {
  if (!els.prompt.value.trim()) {
    showPromptAnalysis(mode);
    return;
  }
  const sourceButton = {
    optimize: els.optimizePrompt,
    params: els.recommendParams,
    failure: els.predictFailure,
    style: els.enhanceStyle,
  }[mode];
  const originalText = sourceButton?.textContent;
  if (sourceButton) {
    sourceButton.disabled = true;
    sourceButton.textContent = "分析中...";
  }
  try {
    const plan = await requestPromptAnalysis(mode);
    showTextAiAnalysis(plan, els.prompt.value.trim(), mode);
  } catch (err) {
    showPromptAnalysis(mode);
    setAnalysisReady("本地规则预检", `文本 AI 未启用或调用失败，已使用本地规则：${err.message}`);
  } finally {
    if (sourceButton) {
      sourceButton.disabled = false;
      sourceButton.textContent = originalText;
    }
  }
}

function closePromptAnalysis() {
  stopPreflight();
  promptAnalysisPlan = null;
  els.promptAnalysisCard?.classList.add("hidden");
  els.composer?.classList.remove("analysis-open");
  setPreflightActionMode(false);
}

function applyOptimizedPrompt() {
  if (!els.optimizedPrompt?.value.trim()) return;
  if (preflightTimer || isPreflightAwaitingAction()) {
    const text = els.optimizedPrompt.value.trim();
    stopPreflight();
    performSubmitJob(text);
    return;
  }
  els.prompt.value = els.optimizedPrompt.value.trim();
  syncSummary();
  els.prompt.focus();
  flashButton(els.applyOptimizedPrompt, "已应用到输入框");
}

function applyRecommendedParams() {
  if (agentModePlan) {
    applyAgentModePlan(agentModePlan);
    flashButton(els.applyOptimizedParams, "已应用参数");
    return;
  }
  if (promptAnalysisPlan) {
    if (!referenceAspectCandidate() && promptAnalysisPlan.aspect_ratio && [...els.aspectRatio.options].some((option) => option.value === promptAnalysisPlan.aspect_ratio)) {
      els.aspectRatio.value = promptAnalysisPlan.aspect_ratio;
    }
    if (promptAnalysisPlan.count) {
      els.count.value = String(Math.max(1, Math.min(Number(promptAnalysisPlan.count) || 1, 20)));
      syncConcurrencyToCount({ commit: true });
    }
    if (promptAnalysisPlan.negative) {
      els.negative.value = String(promptAnalysisPlan.negative).trim();
    }
    syncSummary();
    flashButton(els.applyOptimizedParams, "已应用参数");
    return;
  }
  setRecommendedParams({ quality: els.analysisStyle?.textContent === "high" ? "high" : "auto", applyNow: true });
  flashButton(els.applyOptimizedParams, "已应用参数");
}

function continueOriginalPrompt() {
  const text = preflightOriginalPrompt || els.prompt.value.trim();
  stopPreflight();
  flashButton(els.continueOriginalPrompt, "正在生成");
  performSubmitJob(text);
}

async function copyOptimizedPrompt() {
  const text = els.optimizedPrompt?.value.trim();
  if (!text) return;
  const originalText = els.copyOptimizedPrompt?.textContent || "复制优化版";
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    els.optimizedPrompt.select();
    document.execCommand("copy");
  }
  if (els.copyOptimizedPrompt) {
    els.copyOptimizedPrompt.textContent = "已复制";
    window.setTimeout(() => {
      els.copyOptimizedPrompt.textContent = originalText;
    }, 1200);
  }
}

function optimizePromptLocal() {
  showSmartPromptAnalysis("optimize");
}

function recommendParamsLocal() {
  if (selectedAgent) {
    els.aspectRatio.value = selectedAgent.aspectRatio;
    els.negative.value = selectedAgent.negative;
  }
  showSmartPromptAnalysis("params");
}

function predictFailureLocal() {
  showSmartPromptAnalysis("failure");
}

function enhanceStyleLocal() {
  showSmartPromptAnalysis("style");
}

function scheduleAutoRefreshModels() {
  window.clearTimeout(autoModelTimer);
  if (!selectedApiKey()) {
    refreshModels({ silent: true });
    return;
  }
  setModelStatus("↻ API Key 已填写，准备自动读取模型...", "loading");
  autoModelTimer = window.setTimeout(() => refreshModels({ silent: true }), 700);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

const researchPromptPresets = [
  {
    id: "research-apparatus",
    category: "实验流程",
    name: "反应釜工艺流程图",
    prompt: "生成一张科研工艺流程图，主体为 200 L 不锈钢反应釜系统。按左到右流程展示：原料输入、计量进料、反应釜搅拌与控温、压力/温度监测、出料、产物收集。每个模块用简洁图标或设备小图表示，用箭头标明物料流和控制流，保留标签位置，白底，工程科研说明图风格。"
  },
  {
    id: "research-mechanism",
    category: "机制流程",
    name: "机制路径流程图",
    prompt: "生成一张 Nature 风格科研机制流程图，白色背景，按左到右或上到下展示研究对象、刺激/处理、关键通路、核心变量变化和最终表型结果。模块之间必须用清晰箭头连接，箭头表示因果关系或步骤推进，避免做成发散式思维导图。"
  },
  {
    id: "research-abstract",
    category: "图形摘要",
    name: "论文图形摘要流程",
    prompt: "生成一张 Cell journal graphical abstract 风格科研流程图。画面按照问题背景、实验设计、关键机制、结果读出、结论应用五段组织，左到右推进，模块化分区，少量高可读标签，轻微阴影只用于区分层级，整体适合论文首页图、基金汇报和学术海报。"
  },
  {
    id: "research-dual-control",
    category: "双控制",
    name: "线稿 + 色稿高清重生成",
    prompt: "根据参考线稿保持结构、轮廓、管路走向和关键部件位置，根据参考色稿保持金属质感、蓝色电机、灰白背景与光照层次。对局部区域进行高清重生成，提升边缘清晰度、材质真实感和标注可读性，不改变科学结构，不添加无关零件。"
  },
  {
    id: "research-scss-flow",
    category: "S-C-S-S",
    name: "读项目生成科研流程图",
    prompt: "先阅读项目内容，提取研究主线、核心模块、模块关系和最终结论，再按 S-C-S-S 框架输出绘图 Prompt：Subject 主体、Composition 构图、Structure 结构细节、Style 风格渲染。目标是生成科研流程图初稿，后续可在 PPT 或 Adobe Illustrator 中重绘优化。"
  }
];
let selectedResearchSkillId = "project-reader";

const researchSkills = [
  {
    id: "project-reader",
    name: "项目读取",
    desc: "先读论文草稿、项目说明、模块设计和流程逻辑，提取主线。",
    instruction: "先阅读项目内容，提取研究主线、核心对象、关键模块、模块之间的因果关系和最终结论。不要急着画图，先把图要表达什么讲清楚。"
  },
  {
    id: "scss-prompt",
    name: "S-C-S-S 架构",
    desc: "按主体 / 构图 / 结构 / 风格输出绘图提示词。",
    instruction: "严格按主体、构图、结构、风格组织绘图提示词：主体写研究对象，构图写画面布局，结构写模块细节和箭头关系，风格写配色、边框、图标和整体质感。"
  },
  {
    id: "flow-draft",
    name: "流程图初稿",
    desc: "把项目逻辑转成可直接给生图工具使用的科研流程图初稿。",
    instruction: "目标是生成科研流程图初稿，优先表达逻辑框架和模块关系，允许后续在 PPT 或 Adobe Illustrator 中重绘优化。"
  },
  {
    id: "dual-control",
    name: "双控制重绘",
    desc: "线稿控结构，色稿控材质、配色和光影，用于局部高清重生成。",
    instruction: "如果有线稿图和色稿图，线稿用于约束结构、边界、管路和模块位置，色稿用于约束材质、配色和光影。局部重绘只能增强目标区域，不改变科学含义。"
  },
  {
    id: "handoff",
    name: "后期重绘交接",
    desc: "输出便于 PPT / AI 重绘的模块、标签、箭头和分层建议。",
    instruction: "输出时要考虑后期重绘：明确每个模块名称、标签位置、箭头方向、颜色分组和可拆分图层，让用户能在 PPT 或 AI 中快速描图和精修。"
  }
];

function buildResearchPrompt() {
  const subject = ($("#researchSubject")?.value || "").trim();
  const context = ($("#researchProjectContext")?.value || "").trim();
  const figureType = $("#researchFigureType")?.selectedOptions?.[0]?.textContent || "科研流程图";
  const style = $("#researchStyle")?.selectedOptions?.[0]?.textContent || "干净科研插图";
  const skill = researchSkills.find((item) => item.id === selectedResearchSkillId) || researchSkills[0];
  if (!subject && !context) {
    return "";
  }
  const extracted = context
    ? context.replace(/\s+/g, " ").slice(0, 520)
    : "未提供项目正文，请仅基于用户填写的绘图目标拆解核心对象、流程模块、关键变量和结论关系。";
  const base = [
    "请先读懂下面的项目内容，再生成科研流程图 Prompt，不要写成发散式思维导图，也不要直接泛泛描述。",
    `当前技能：${skill.name}。${skill.instruction}`,
    `项目内容：${extracted}`,
    "",
    `主体：${subject || "根据项目内容提取主体"}。明确流程图要表达的核心研究对象、输入条件、处理过程、关键变量和最终输出。`,
    `构图：生成一张${figureType}，采用左到右或上到下的线性/分层流程布局；每一步是一个模块，模块之间用箭头连接，箭头方向必须表达步骤推进、因果关系或数据/物料流。`,
    "结构细节：拆出每个流程节点的输入、处理、输出、变量、读出指标和可局部放大的关键部位；需要标明主流程、支路、反馈或对照组，不添加无关模块。",
    `风格渲染：${style}，白色或浅色背景，构图干净，信息层级清楚，适合论文图、基金汇报或科研流程图初稿。`,
    "图像编辑要求：如果使用参考图，线稿图用于约束结构、轮廓、局部边界；色稿图用于约束材质、配色和光影。局部高清重生成时只增强选区，不改变整体科学含义。",
    "负面控制：避免低清晰度、错别字、伪科学结构、不可读标签、随机多余零件、装饰性海报风。"
  ];
  return base.join("\n");
}

function renderResearchScssCards() {
  const wrap = $("#researchScssCards");
  if (!wrap) return;
  const subject = ($("#researchSubject")?.value || "").trim();
  const figureType = $("#researchFigureType")?.selectedOptions?.[0]?.textContent || "科研流程图";
  const style = $("#researchStyle")?.selectedOptions?.[0]?.textContent || "科研插图风格";
  const context = ($("#researchProjectContext")?.value || "").trim();
  const cards = [
    ["S", "Subject", subject || "待填写绘图目标"],
    ["C", "Composition", subject || context ? `${figureType}，按步骤排布，箭头连接输入、处理、结果和分支。` : "填写目标或摘要后生成构图建议。"],
    ["S", "Structure", context ? "按项目内容拆流程节点、变量、对照、输出和局部放大框。" : "粘贴项目内容后拆研究主线和流程节点。"],
    ["S", "Style", style],
  ];
  wrap.innerHTML = cards.map(([letter, title, body]) => `
    <article>
      <b>${escapeHtml(letter)}</b>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </article>
  `).join("");
}

function renderResearchPromptRepo() {
  const repo = $("#researchPromptRepo");
  if (!repo) return;
  repo.innerHTML = "";
  researchPromptPresets.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.researchPreset = preset.id;
    button.innerHTML = `
      <small>${escapeHtml(preset.category)}</small>
      <strong>${escapeHtml(preset.name)}</strong>
      <span>${escapeHtml(preset.prompt)}</span>
    `;
    button.addEventListener("click", () => {
      const prompt = $("#researchPrompt");
      if (prompt) prompt.value = preset.prompt;
      renderResearchScssCards();
      setResearchStatus(`已载入提示词预设：${preset.name}`);
    });
    repo.append(button);
  });
}

function renderResearchSkills() {
  const list = $("#researchSkillList");
  if (!list) return;
  list.innerHTML = "";
  researchSkills.forEach((skill) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = skill.id === selectedResearchSkillId ? "active" : "";
    button.innerHTML = `
      <strong>${escapeHtml(skill.name)}</strong>
      <span>${escapeHtml(skill.desc)}</span>
    `;
    button.addEventListener("click", () => {
      selectedResearchSkillId = skill.id;
      renderResearchSkills();
      renderResearchScssCards();
      const prompt = $("#researchPrompt");
      if (prompt) prompt.value = buildResearchPrompt();
    });
    list.append(button);
  });
}

function previewResearchFile(input, preview) {
  const file = input?.files?.[0];
  if (!file || !preview) return;
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${escapeAttr(reader.result)}" alt="">`;
  };
  reader.readAsDataURL(file);
}

function readResearchPaperFile(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const title = input.closest(".research-block")?.querySelector(".research-section-title em");
  const mirror = $("#researchProjectContextMirror");
  if (title) title.textContent = file.name;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["txt", "md"].includes(ext || "")) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").trim();
      if ($("#researchProjectContext")) $("#researchProjectContext").value = text.slice(0, 5000);
      if (mirror) mirror.value = text.slice(0, 5000);
      if ($("#researchPrompt")) $("#researchPrompt").value = buildResearchPrompt();
      renderResearchScssCards();
      setResearchStatus(`已读取 ${file.name}，并刷新科研绘图提示词`);
    };
    reader.readAsText(file, "utf-8");
    return;
  }
  const message = `已选择 ${file.name}。PDF/DOCX 当前先作为项目附件记录，请把摘要或关键段落粘贴到左侧文本框。`;
  if (mirror) mirror.value = message;
  setResearchStatus(message);
}

async function uploadResearchReference(file, name) {
  if (!file) return null;
  const form = new FormData();
  form.append("file", file);
  form.append("name", name || file.name);
  const resp = await fetch("/api/references", {
    method: "POST",
    headers: { "X-YY-Client-ID": clientId },
    body: form,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "参考图上传失败");
  selectedReferenceIds.add(data.reference.id);
  return data.reference;
}

async function applyResearchToStudio() {
  const button = $("#researchApplyToStudio");
  const prompt = buildResearchGenerationPrompt();
  if (!prompt) return;
  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "发送中...";
  }
  try {
    await uploadResearchControlReferences();
    els.prompt.value = prompt;
    els.title.value = ($("#researchSubject")?.value || "科研图").trim();
    syncSummary();
    renderReferences();
    location.hash = "#studio";
  } catch (err) {
    alert(err.message || "发送到生图台失败");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

let researchMermaidModule = null;
let researchMermaidPromise = null;
let researchDiagramRenderId = 0;

function researchCleanDiagramLabel(value, fallback = "步骤") {
  return String(value || fallback)
    .replace(/\s+/g, " ")
    .replace(/["'`[\]{}<>|]/g, "")
    .trim()
    .slice(0, 34) || fallback;
}

function extractResearchFlowSteps() {
  const subject = ($("#researchSubject")?.value || "").trim();
  const context = ($("#researchProjectContext")?.value || "").trim();
  if (!subject && !context) return [];
  const rawItems = context
    .split(/[\n\r。；;，,、>→\-]+/g)
    .map((item) => researchCleanDiagramLabel(item))
    .filter((item) => item.length >= 2 && !/^第?[一二三四五六七八九十0-9]+$/.test(item));
  const unique = [];
  rawItems.forEach((item) => {
    if (!unique.some((existing) => existing === item || existing.includes(item) || item.includes(existing))) {
      unique.push(item);
    }
  });
  const defaults = ["样本/输入", "实验或模型处理", "关键变量读出", "结果验证", "结论输出"];
  const steps = unique.length >= 3 ? unique.slice(0, 6) : [researchCleanDiagramLabel(subject, "研究对象"), ...defaults];
  return steps.slice(0, 7);
}

function buildResearchMermaidDiagram() {
  const rawSubject = ($("#researchSubject")?.value || "").trim();
  const context = ($("#researchProjectContext")?.value || "").trim();
  if (!rawSubject && !context) return "";
  const subject = researchCleanDiagramLabel(rawSubject || "科研流程");
  const figureType = $("#researchFigureType")?.value || "workflow";
  const direction = figureType === "mechanism" || figureType === "abstract" ? "TD" : "LR";
  const steps = extractResearchFlowSteps();
  const ids = ["A", "B", "C", "D", "E", "F", "G"];
  const lines = [
    `flowchart ${direction}`,
    `  title["${subject}"]:::title`,
    ...steps.map((step, index) => `  ${ids[index]}["${researchCleanDiagramLabel(step, `步骤 ${index + 1}`)}"]:::step`),
    "  title --> A",
    ...steps.slice(1).map((_, index) => `  ${ids[index]} --> ${ids[index + 1]}`),
  ];
  if (figureType === "mechanism" && steps.length >= 4) {
    lines.push(`  ${ids[Math.min(steps.length - 2, 4)]} -.机制反馈.-> ${ids[1]}`);
  }
  if (figureType === "abstract" && steps.length >= 5) {
    lines.push(`  ${ids[steps.length - 1]} --> output["论文图形摘要输出"]:::output`);
  }
  lines.push(
    "  classDef title fill:#0b8f72,stroke:#00665f,color:#ffffff,stroke-width:1px;",
    "  classDef step fill:#ffffff,stroke:#8ccbbb,color:#15201d,stroke-width:1px;",
    "  classDef output fill:#e8f8f2,stroke:#0b8f72,color:#063f3b,stroke-width:1px;"
  );
  return lines.join("\n");
}

async function requestResearchAiPlan() {
  const subject = ($("#researchSubject")?.value || "").trim();
  const context = ($("#researchProjectContext")?.value || "").trim();
  if (!subject && !context) {
    throw new Error("请先填写论文摘要、实验步骤或课题材料");
  }
  const textModel = selectedTextModel();
  if (!textModel) {
    throw new Error("未配置文本模型，请先在商业图工作台或管理员设置里读取文本模型");
  }
  const figureType = $("#researchFigureType");
  const style = $("#researchStyle");
  const skill = researchSkills.find((item) => item.id === selectedResearchSkillId);
  const data = await api("/api/research-plan", {
    method: "POST",
    body: JSON.stringify({
      connection_mode: els.connectionMode.value,
      api_url: selectedApiUrl(),
      api_key: selectedApiKey(),
      text_model: textModel,
      text_api_url: selectedTextApiUrl(),
      text_api_key: selectedTextApiKey(),
      text_custom_fallback: Boolean(els.connectionMode.value === "pool" && !verifiedTextModels.length),
      subject,
      context,
      figure_type: figureType?.value || "",
      figure_type_label: figureType?.selectedOptions?.[0]?.textContent || "",
      style: style?.selectedOptions?.[0]?.textContent || style?.value || "",
      skill: skill ? `${skill.name}: ${skill.instruction}` : "",
      current_prompt: ($("#researchPrompt")?.value || "").trim(),
      current_mermaid: ($("#researchDiagramSource")?.value || "").trim(),
    }),
  });
  if (data && data.ok === false) {
    throw new Error(data.detail || data.error || "科研工作台文本模型生成失败");
  }
  return { ...(data.plan || {}), textModel: data.model || textModel };
}

function applyResearchAiPlan(plan, { prompt = true, diagram = true } = {}) {
  if (!plan || typeof plan !== "object") return;
  const promptBox = $("#researchPrompt");
  const diagramSource = $("#researchDiagramSource");
  if (prompt && promptBox && String(plan.prompt || "").trim()) {
    promptBox.value = String(plan.prompt || "").trim();
  }
  if (diagram && diagramSource && String(plan.mermaid || "").trim()) {
    diagramSource.value = String(plan.mermaid || "").trim();
    renderResearchDiagram();
  }
  const caption = document.querySelector(".research-tools .research-empty-box:not(textarea)");
  if (caption && (plan.caption || plan.notes?.length)) {
    caption.textContent = [plan.caption, ...(Array.isArray(plan.notes) ? plan.notes : [])].filter(Boolean).join(" / ");
  }
  renderResearchScssCards();
}

async function generateResearchPromptWithAi(button) {
  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "AI 生成中...";
  }
  try {
    const plan = await requestResearchAiPlan();
    applyResearchAiPlan(plan, { prompt: true, diagram: false });
    setResearchStatus(`已使用 ${plan.textModel || selectedTextModelLabel()} 生成科研绘图提示词`);
  } catch (err) {
    renderResearchScssCards();
    setResearchStatus(err.message || "请先填写论文摘要、实验步骤或课题材料");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

async function generateResearchDiagramWithAi(button) {
  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "AI 生成中...";
  }
  try {
    const plan = await requestResearchAiPlan();
    applyResearchAiPlan(plan, { prompt: false, diagram: true });
    setResearchStatus(`已使用 ${plan.textModel || selectedTextModelLabel()} 生成 Mermaid 流程图`);
  } catch (err) {
    setResearchStatus(err.message || "请先填写论文摘要、实验步骤或课题材料");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

async function loadResearchMermaid() {
  if (researchMermaidModule) return researchMermaidModule;
  if (researchMermaidPromise) return researchMermaidPromise;
  researchMermaidPromise = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")
    .then((module) => {
      researchMermaidModule = module.default || module;
      researchMermaidModule.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: {
          primaryColor: "#ffffff",
          primaryBorderColor: "#8ccbbb",
          primaryTextColor: "#15201d",
          lineColor: "#0b8f72",
          fontFamily: "Inter, Arial, sans-serif",
        },
      });
      return researchMermaidModule;
    });
  return researchMermaidPromise;
}

function renderResearchDiagramFallback(source) {
  const nodeLabels = new Map();
  const edges = [];
  String(source || "").split(/\n+/).forEach((line) => {
    const nodeMatches = [...line.matchAll(/\b([A-Za-z][\w-]*)\s*\["([^"]+)"\]/g)];
    nodeMatches.forEach((match) => nodeLabels.set(match[1], match[2]));
    const edge = line.match(/\b([A-Za-z][\w-]*)\b\s*(?:-->|-.+?\.->)\s*\b([A-Za-z][\w-]*)\b/);
    if (edge) edges.push([edge[1], edge[2]]);
  });
  const orderedIds = [...nodeLabels.keys()].filter((id) => id !== "title" && id !== "output").slice(0, 7);
  if (!orderedIds.length) orderedIds.push("A", "B", "C");
  const width = Math.max(760, orderedIds.length * 170 + 120);
  const height = 260;
  const y = 102;
  const boxes = orderedIds.map((id, index) => {
    const x = 60 + index * 170;
    const label = escapeHtml(nodeLabels.get(id) || `步骤 ${index + 1}`);
    return `
      <g>
        <rect x="${x}" y="${y}" width="132" height="72" rx="10" fill="#fff" stroke="#8ccbbb"/>
        <text x="${x + 66}" y="${y + 34}" text-anchor="middle" fill="#15201d" font-size="13" font-weight="700">${label}</text>
      </g>`;
  }).join("");
  const arrows = orderedIds.slice(1).map((id, index) => {
    const x1 = 60 + index * 170 + 132;
    const x2 = 60 + (index + 1) * 170;
    return `<path d="M${x1} ${y + 36} L${x2 - 10} ${y + 36}" fill="none" stroke="#0b8f72" stroke-width="2.5" marker-end="url(#arrow)"/>`;
  }).join("");
  const title = escapeHtml(nodeLabels.get("title") || researchCleanDiagramLabel($("#researchSubject")?.value, "科研流程"));
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0b8f72"/></marker></defs>
      <rect width="${width}" height="${height}" fill="#f7f7f5"/>
      <text x="${width / 2}" y="48" text-anchor="middle" fill="#063f3b" font-size="18" font-weight="800">${title}</text>
      ${arrows}
      ${boxes}
    </svg>`;
}

async function renderResearchDiagram() {
  const sourceBox = $("#researchDiagramSource");
  const preview = $("#researchDiagramPreview");
  if (!sourceBox || !preview) return;
  if (!sourceBox.value.trim()) sourceBox.value = buildResearchMermaidDiagram();
  const source = sourceBox.value.trim();
  if (!source) {
    preview.classList.remove("loading");
    preview.innerHTML = "<span>填写绘图目标或论文摘要后生成流程图。</span>";
    setResearchStatus("等待填写科研主题或项目内容");
    return;
  }
  preview.classList.add("loading");
  preview.innerHTML = "<span>正在渲染流程图...</span>";
  try {
    const mermaid = await loadResearchMermaid();
    const id = `research-diagram-${Date.now()}-${researchDiagramRenderId += 1}`;
    const result = await mermaid.render(id, source);
    preview.innerHTML = result.svg;
    setResearchStatus("流程图已用 Mermaid 渲染，可导出 SVG 或 PNG");
  } catch (err) {
    preview.innerHTML = renderResearchDiagramFallback(source);
    setResearchStatus("Mermaid 在线渲染不可用，已使用本地 SVG 兜底预览");
  } finally {
    preview.classList.remove("loading");
  }
}

function ensureResearchDiagramNode() {
  let node = document.querySelector('.research-node[data-node-id="diagram-preview"]');
  if (!node) {
    node = createResearchNode("diagram", { id: "diagram-preview", x: 1080, y: 160, w: 460 });
  }
  return node;
}

async function sendResearchDiagramToCanvas() {
  const node = ensureResearchDiagramNode();
  selectResearchNode(node);
  await renderResearchDiagram();
  setResearchStatus("流程图预览已放到画布");
}

function downloadResearchBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildResearchGenerationPrompt() {
  const prompt = ($("#researchPrompt")?.value || buildResearchPrompt()).trim();
  const diagram = ($("#researchDiagramSource")?.value || "").trim();
  if (!prompt && !diagram) return "";
  const figureType = $("#researchFigureType")?.selectedOptions?.[0]?.textContent || "科研流程图";
  const style = $("#researchStyle")?.selectedOptions?.[0]?.textContent || "干净科研插图";
  const subject = ($("#researchSubject")?.value || "").trim();
  const parts = [
    prompt,
    "",
    "科研工作台生成要求：",
    subject ? `绘图目标：${subject}` : "",
    `图类型：${figureType}`,
    `视觉风格：${style}`,
    diagram ? `流程图结构参考（Mermaid）：\n${diagram}` : "",
    "请严格保持科研逻辑、流程箭头方向、模块边界和标签区域；输出适合论文、基金汇报或 PPT 精修的科研图草图。",
  ].filter(Boolean);
  return parts.join("\n");
}

async function uploadResearchControlReferences() {
  const lineFile = $("#researchLineInput")?.files?.[0];
  const colorFile = $("#researchColorInput")?.files?.[0];
  const uploads = [];
  if (lineFile) uploads.push(uploadResearchReference(lineFile, `科研线稿控制-${lineFile.name}`));
  if (colorFile) uploads.push(uploadResearchReference(colorFile, `科研色稿控制-${colorFile.name}`));
  if (!uploads.length) return [];
  const refs = await Promise.all(uploads);
  await loadState();
  renderReferences();
  return refs.filter(Boolean);
}

function selectedResearchImageModel(sourceNode = null) {
  const nodeModel = sourceNode?.querySelector(".research-image-model-select")?.value || "";
  return (nodeModel || els.model?.value || "").trim();
}

function researchNodeControlValue(sourceNode, labelText) {
  const labels = [...(sourceNode?.querySelectorAll(".research-node-grid label") || [])];
  const label = labels.find((item) => (item.firstChild?.textContent || item.textContent || "").trim().startsWith(labelText));
  const field = label?.querySelector("select, input");
  return (field?.value || "").trim();
}

function normalizeResearchQuality(value) {
  const text = String(value || "").trim().toLowerCase();
  const map = { medium: "medium", high: "high", auto: "auto", standard: "standard", hd: "hd", "标准": "standard", "高": "high", "中": "medium" };
  return map[text] || els.quality?.value || "auto";
}

function normalizeResearchFormat(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["png", "webp", "jpeg", "jpg"].includes(text) ? (text === "jpg" ? "jpeg" : text) : (els.outputFormat?.value || "png");
}

function researchTextToImageNodes() {
  return [...document.querySelectorAll("#researchStage .research-node")]
    .filter((node) => node.querySelector("[data-research-generate-node], .research-node-grid"));
}

function researchPromptForNode(node) {
  return (node?.querySelector("textarea")?.value || "").trim();
}

function researchOutputNodesForSource(sourceNode = null) {
  if (!sourceNode?.dataset?.nodeId) return [];
  const targetIds = researchCanvasState.links
    .filter((link) => link.from === sourceNode.dataset.nodeId)
    .map((link) => link.to);
  return targetIds
    .map(researchNodeById)
    .filter((node) => node?.classList.contains("research-node-output"));
}

function ensureResearchOutputNodesForSource(sourceNode = null, count = 1) {
  if (!sourceNode) return ensureResearchOutputNodes(count);
  let nodes = researchOutputNodesForSource(sourceNode);
  while (nodes.length < count) {
    const index = document.querySelectorAll(".research-node-output").length;
    const outputNode = createResearchNode("output", {
      x: Number(sourceNode.dataset.x || 120) + Number(sourceNode.dataset.w || sourceNode.offsetWidth || 340) + 190,
      y: Number(sourceNode.dataset.y || 120) + nodes.length * 360,
      w: 390,
    });
    if (outputNode) {
      addResearchLink(sourceNode.dataset.nodeId, outputNode.dataset.nodeId);
      const title = outputNode.querySelector(".research-node-head strong");
      if (title) title.textContent = `科研图 ${index + 1}`;
    }
    nodes = researchOutputNodesForSource(sourceNode);
  }
  return nodes.slice(0, count).map((node) => node.querySelector(".research-generated-preview")).filter(Boolean);
}

function researchGenerationSettings(sourceNode = null, promptCount = 1) {
  const numbers = normalizeGenerationNumbers();
  const aspectRatio = researchNodeControlValue(sourceNode, "比例") || els.aspectRatio.value;
  const resolution = researchNodeControlValue(sourceNode, "分辨率") || els.resolution.value;
  const model = selectedResearchImageModel(sourceNode);
  return {
    model,
    aspectRatio,
    resolution,
    size: requestSizeFor(aspectRatio, resolution),
    quality: normalizeResearchQuality(researchNodeControlValue(sourceNode, "质量")),
    outputFormat: normalizeResearchFormat(researchNodeControlValue(sourceNode, "格式")),
    count: Math.max(1, Math.min(20, promptCount || 1)),
    concurrency: numbers.concurrency,
    retryLimit: numbers.retryLimit,
  };
}

function ensureResearchOutputNodes(count = 1) {
  let outputs = [...document.querySelectorAll(".research-node-output .research-generated-preview")];
  while (outputs.length < count) {
    createResearchNode("output", { x: 650, y: 90 + outputs.length * 390, w: 390 });
    outputs = [...document.querySelectorAll(".research-node-output .research-generated-preview")];
  }
  return outputs;
}

function resetResearchOutputNode(node, text = "等待生成当前科研图。") {
  if (!node) return;
  delete node.dataset.researchJobId;
  delete node.dataset.researchProjectSignature;
  delete node.dataset.researchPromptSignature;
  const preview = node.querySelector(".research-generated-preview");
  if (preview) {
    preview.classList.remove("generated", "loading", "failed");
    preview.innerHTML = "";
  }
  const desc = node.querySelector("p");
  if (desc) desc.textContent = text;
}

function clearMismatchedResearchOutputs(currentSignature = researchProjectSignature()) {
  document.querySelectorAll(".research-node-output").forEach((node) => {
    const nodeSignature = node.dataset.researchProjectSignature || "";
    const hasRenderedImage = Boolean(node.querySelector(".research-generated-preview img"));
    if (!nodeSignature && hasRenderedImage) {
      resetResearchOutputNode(node, "已清空未绑定当前科研任务的旧输出。");
      return;
    }
    if (nodeSignature && currentSignature && nodeSignature !== currentSignature) {
      resetResearchOutputNode(node, "已清空非当前科研项目的输出。");
    }
  });
}

function setResearchOutputPending(job = {}, sourceNode = null) {
  const count = Math.max(1, Number(job.count || 1));
  const outputs = sourceNode
    ? ensureResearchOutputNodesForSource(sourceNode, 1)
    : ensureResearchOutputNodes(count);
  outputs.slice(0, count).forEach((preview, index) => {
    preview.classList.add("generated", "loading");
    preview.classList.remove("failed");
    preview.innerHTML = `<strong>生成中 ${index + 1}/${count}</strong><span>${escapeHtml(job.progress?.message || "已进入商业生图队列，等待返回图片")}</span>`;
    const node = preview.closest(".research-node");
    if (node) {
      node.dataset.researchJobId = job.id || node.dataset.researchJobId || "";
      node.dataset.researchProjectSignature = job.research_project_signature || activeResearchProjectSignature || researchProjectSignature();
      node.dataset.researchPromptSignature = sourceNode ? researchPromptSignature(researchPromptForNode(sourceNode)) : "";
    }
    const title = node?.querySelector(".research-node-head strong");
    const desc = node?.querySelector("p");
    if (title) title.textContent = `科研图 ${index + 1}`;
    if (desc) desc.textContent = `状态: ${statusText(job.status || "queued")} · ${job.size || ""} · ${job.quality || ""}`;
  });
  focusResearchNode(outputs[0]?.closest(".research-node"));
}

function mediaForResearchJob(jobId) {
  const job = jobsForWorkspace("research").find((item) => item.id === jobId) || {};
  const ids = new Set((job.media_ids || []).map(String));
  return mediaForWorkspace("research")
    .filter((media) => media.job_id === jobId || ids.has(String(media.id)))
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
}

function renderResearchJobMedia(jobId, sourceNode = null) {
  const job = jobsForWorkspace("research").find((item) => item.id === jobId) || {};
  const mediaItems = mediaForResearchJob(jobId);
  if (!mediaItems.length) return mediaItems;
  const count = Math.max(1, Number(job.count || mediaItems.length || 1));
  const outputs = sourceNode
    ? ensureResearchOutputNodesForSource(sourceNode, 1)
    : ensureResearchOutputNodes(Math.max(count, mediaItems.length));
  mediaItems.forEach((media, index) => {
    const preview = outputs[index];
    if (!preview) return;
    const filename = `research-${job.id || "image"}-${index + 1}.${(media.output_format || job.output_format || "png").toLowerCase().replace("jpeg", "jpg")}`;
    preview.classList.add("generated");
    preview.classList.remove("loading", "failed");
    preview.innerHTML = `<img src="${escapeAttr(media.url)}" alt="${escapeAttr(media.prompt || job.prompt || "科研图")}" loading="lazy">`;
    const download = document.createElement("a");
    download.className = "research-download-button";
    download.href = media.url;
    download.download = filename;
    download.target = "_blank";
    download.rel = "noopener";
    download.textContent = "下载";
    preview.append(download);
    const node = preview.closest(".research-node");
    if (node) {
      node.dataset.researchJobId = job.id || "";
      node.dataset.researchProjectSignature = job.research_project_signature || activeResearchProjectSignature || researchProjectSignature();
      node.dataset.researchPromptSignature = sourceNode ? researchPromptSignature(researchPromptForNode(sourceNode)) : researchPromptSignature(job.prompt || "");
    }
    const title = node?.querySelector(".research-node-head strong");
    const desc = node?.querySelector("p");
    if (title) title.textContent = `科研图 ${index + 1}`;
    if (desc) desc.textContent = `已生成: ${media.actual_size || media.size || job.size || ""} · ${media.output_format || job.output_format || "png"}`;
  });
  focusResearchNode(outputs[0]?.closest(".research-node"));
  return mediaItems;
}

function lastResearchJobWithMedia() {
  const currentSignature = researchProjectSignature();
  if (!currentSignature) return null;
  const jobs = jobsForWorkspace("research").filter((job) => {
    const agentId = String(job.agent_id || "");
    const agentName = String(job.agent_name || "");
    if (!(agentId === "research-workbench" || agentName.includes("科研图"))) return false;
    return Boolean(job.research_project_signature && job.research_project_signature === currentSignature);
  });
  return jobs.find((job) => mediaForResearchJob(job.id).length) || null;
}

function sourceNodeForResearchJob(job = {}) {
  const jobPrompt = researchPromptSignature(job.prompt || "");
  if (!jobPrompt) return null;
  return researchTextToImageNodes().find((node) => researchPromptSignature(researchPromptForNode(node)) === jobPrompt) || null;
}

function syncResearchOutputsFromState() {
  if (!document.body.classList.contains("research-active") && !$("#research")) return;
  restoreActiveResearchJob();
  clearMismatchedResearchOutputs();
  const currentSignature = researchProjectSignature();
  if (!currentSignature) return;
  const jobId = activeResearchJobId || (selectedHistoryJobId !== NEW_TASK_DRAFT_ID ? selectedHistoryJobId : "");
  const directJob = jobId ? jobsForWorkspace("research").find((job) => job.id === jobId) : null;
  const directSourceNode = directJob ? sourceNodeForResearchJob(directJob) : null;
  const directMatches = directJob && (
    (directJob.research_project_signature && directJob.research_project_signature === currentSignature)
    || (!directJob.research_project_signature && Boolean(directSourceNode))
  );
  const job = directMatches && mediaForResearchJob(directJob.id).length ? directJob : lastResearchJobWithMedia();
  if (!job) return;
  const sourceNode = job.id === directJob?.id ? directSourceNode : sourceNodeForResearchJob(job);
  if (!sourceNode && !job.research_project_signature) return;
  const mediaItems = renderResearchJobMedia(job.id, sourceNode);
  if (mediaItems.length) {
    activeResearchJobId = job.id;
    activeResearchProjectSignature = job.research_project_signature || activeResearchProjectSignature || currentSignature;
    saveActiveResearchJob();
    setResearchStatus(`已从图片记录回填 ${mediaItems.length} 张到科研图输出节点`);
  }
}

function renderResearchJobError(job = {}) {
  const outputs = ensureResearchOutputNodes(Math.max(1, Number(job.count || 1)));
  const message = job.error || "科研图生成失败，请检查生图模型、Key 或提示词";
  outputs[0].classList.add("generated", "failed");
  outputs[0].classList.remove("loading");
  outputs[0].innerHTML = `<strong>生成失败</strong><span>${escapeHtml(message)}</span>`;
  const desc = outputs[0].closest(".research-node")?.querySelector("p");
  if (desc) desc.textContent = `失败原因: ${message}`;
  focusResearchNode(outputs[0]?.closest(".research-node"));
  setResearchStatus(message);
}

async function watchResearchGeneration(jobId, sourceNode = null) {
  if (!jobId || researchGenerationWatchers.has(jobId)) return;
  researchGenerationWatchers.add(jobId);
  try {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await loadState();
      const job = jobsForWorkspace("research").find((item) => item.id === jobId) || {};
      const mediaItems = renderResearchJobMedia(jobId, sourceNode);
      if (mediaItems.length && (job.status === "success" || mediaItems.length >= Number(job.count || 1))) {
        setResearchStatus(`科研图已生成 ${mediaItems.length} 张，已回填到画布输出节点`);
        return;
      }
      if (job.status === "error") {
        renderResearchJobError(job);
        return;
      }
      setResearchOutputPending(job, sourceNode);
      setResearchStatus(job.progress?.message || "科研图生成中，正在等待商业生图队列返回图片");
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    setResearchStatus("科研图任务仍在生成，可稍后在商业生图记录或画布输出节点查看");
  } finally {
    researchGenerationWatchers.delete(jobId);
  }
}

async function submitResearchGenerationJob(sourceNode = null) {
  if (submitInFlight) return null;
  const isBatch = !sourceNode;
  const promptNodes = isBatch ? researchTextToImageNodes().filter((node) => researchPromptForNode(node)) : [];
  const promptVariants = promptNodes.map(researchPromptForNode);
  const nodePrompt = researchPromptForNode(sourceNode);
  const prompt = isBatch && promptVariants.length
    ? promptVariants[0]
    : (nodePrompt || buildResearchGenerationPrompt());
  if (!prompt) {
    setResearchStatus("请先填写绘图目标或论文摘要，再生成科研图");
    $("#researchSubject")?.focus();
    return null;
  }
  if (els.connectionMode.value === "pool" && !activePoolUser()) {
    setResearchStatus("请先在专业生图台登录号池账号");
    setConnectionStatus("请先登录号池账号", "error");
    location.hash = "#studio";
    return null;
  }
  saveApiKeyPreference();
  const settingsNode = sourceNode || promptNodes[0] || null;
  const settings = researchGenerationSettings(settingsNode, isBatch && promptVariants.length ? promptVariants.length : 1);
  const projectSignature = researchProjectSignature(isBatch && promptVariants.length ? promptVariants.join("\n") : prompt);
  const button = $("#researchGenerateAll");
  const previousText = button?.textContent || "";
  submitInFlight = true;
  if (button) {
    button.disabled = true;
    button.textContent = "提交中...";
  }
  try {
    await uploadResearchControlReferences();
    const title = ($("#researchSubject")?.value || "科研图").trim();
    const created = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        mode: "single",
        workspace: "research",
        client_request_id: `research-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        prompt,
        model: settings.model,
        protocol: els.protocol.value,
        connection_mode: els.connectionMode.value,
        api_url: selectedApiUrl(),
        api_key: selectedApiKey(),
        agent_id: "research-workbench",
        agent_name: "科研图工作台",
        agent_variant: $("#researchFigureType")?.value || "",
        agent_enabled: true,
        aspect_ratio: settings.aspectRatio,
        resolution: settings.resolution,
        size: settings.size,
        quality: settings.quality,
        output_format: settings.outputFormat,
        count: settings.count,
        concurrency: settings.concurrency,
        retry_limit: settings.retryLimit,
        seed: els.seed.value.trim(),
        negative: els.negative.value.trim(),
        variants: buildVariants(),
        prompt_variants: isBatch ? promptVariants : [],
        research_project_signature: projectSignature,
        reference_ids: Array.from(selectedReferenceIds).slice(0, MAX_REFERENCE_SELECTION),
        edit_mode: Boolean(selectedReferenceIds.size),
      }),
    });
    activeResearchJobId = created?.job?.id || "";
    activeResearchProjectSignature = projectSignature;
    const appliedJob = created?.job || { id: activeResearchJobId, count: settings.count, status: "queued", research_project_signature: projectSignature };
    appliedJob.research_project_signature = appliedJob.research_project_signature || projectSignature;
    saveActiveResearchJob();
    selectedGalleryIds.clear();
    await loadState();
    renderState();
    setResearchOutputPending(appliedJob, sourceNode);
    setResearchStatus(isBatch && promptVariants.length
      ? `已按 ${promptVariants.length} 个文生图节点提交到商业生图队列`
      : `科研图任务已提交到商业生图队列：${created?.job?.title || title}`);
    watchResearchGeneration(created?.job?.id, sourceNode);
    return created?.job || null;
  } catch (err) {
    setResearchStatus(err.message || "科研图任务提交失败");
    alert(err.message || "科研图任务提交失败");
    return null;
  } finally {
    submitInFlight = false;
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

function currentResearchDiagramSvg() {
  const svg = $("#researchDiagramPreview svg");
  if (!svg) return "";
  const clone = svg.cloneNode(true);
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

async function exportResearchDiagramSvg() {
  if (!$("#researchDiagramPreview svg")) await renderResearchDiagram();
  const svgText = currentResearchDiagramSvg();
  if (!svgText) return;
  downloadResearchBlob(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }), "research-flow-diagram.svg");
  setResearchStatus("已导出 SVG 流程图");
}

async function exportResearchDiagramPng() {
  if (!$("#researchDiagramPreview svg")) await renderResearchDiagram();
  const svgText = currentResearchDiagramSvg();
  if (!svgText) return;
  const svg = $("#researchDiagramPreview svg");
  const box = svg.viewBox?.baseVal;
  const width = Math.max(900, Math.ceil(box?.width || svg.getBoundingClientRect().width || 1200));
  const height = Math.max(520, Math.ceil(box?.height || svg.getBoundingClientRect().height || 720));
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadResearchBlob(blob, "research-flow-diagram.png");
    setResearchStatus("已导出 PNG 流程图");
  }, "image/png");
}

const researchCanvasState = {
  scale: 1,
  panX: 0,
  panY: 0,
  activeNode: null,
  nodeCounter: 3,
  action: null,
  spaceDown: false,
  pointerId: null,
  startClientX: 0,
  startClientY: 0,
  startWorldX: 0,
  startWorldY: 0,
  startPanX: 0,
  startPanY: 0,
  startNodeX: 0,
  startNodeY: 0,
  startNodeW: 0,
  links: [
    { from: "prompt", to: "output-a" },
  ],
  linkDraft: null,
  pendingLinkFrom: "",
};
const researchGenerationWatchers = new Set();

function researchClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function researchCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - researchCanvasState.panX) / researchCanvasState.scale,
    y: (event.clientY - rect.top - researchCanvasState.panY) / researchCanvasState.scale,
  };
}

function setResearchNodeGeometry(node, geometry = {}) {
  const x = Number.isFinite(geometry.x) ? geometry.x : Number(node.dataset.x || 0);
  const y = Number.isFinite(geometry.y) ? geometry.y : Number(node.dataset.y || 0);
  const w = Number.isFinite(geometry.w) ? researchClamp(geometry.w, 240, 720) : Number(node.dataset.w || 320);
  node.dataset.x = String(Math.round(x));
  node.dataset.y = String(Math.round(y));
  node.dataset.w = String(Math.round(w));
  node.style.width = `${Math.round(w)}px`;
  node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  renderResearchLinks();
}

function researchNodeById(id) {
  if (!id) return null;
  return [...document.querySelectorAll("#researchStage .research-node")]
    .find((node) => node.dataset.nodeId === id) || null;
}

function researchPortPoint(node, side) {
  if (!node) return null;
  const x = Number(node.dataset.x || 0);
  const y = Number(node.dataset.y || 0);
  const w = Number(node.dataset.w || node.offsetWidth || 320);
  const h = node.offsetHeight || 180;
  return side === "out"
    ? { x: x + w + 10, y: y + h / 2 }
    : { x: x - 10, y: y + h / 2 };
}

function researchLinkPath(fromPoint, toPoint) {
  const gap = Math.max(80, Math.abs(toPoint.x - fromPoint.x) * 0.45);
  return `M${fromPoint.x} ${fromPoint.y} C ${fromPoint.x + gap} ${fromPoint.y}, ${toPoint.x - gap} ${toPoint.y}, ${toPoint.x} ${toPoint.y}`;
}

function renderResearchLinks() {
  const svg = $("#researchLinks");
  if (!svg) return;
  const paths = [];
  researchCanvasState.links = researchCanvasState.links.filter((link) => researchNodeById(link.from) && researchNodeById(link.to) && link.from !== link.to);
  researchCanvasState.links.forEach((link) => {
    const fromPoint = researchPortPoint(researchNodeById(link.from), "out");
    const toPoint = researchPortPoint(researchNodeById(link.to), "in");
    if (!fromPoint || !toPoint) return;
    paths.push(`<path class="research-link-path" data-from="${escapeAttr(link.from)}" data-to="${escapeAttr(link.to)}" d="${researchLinkPath(fromPoint, toPoint)}" />`);
  });
  if (researchCanvasState.linkDraft?.fromPoint && researchCanvasState.linkDraft?.toPoint) {
    paths.push(`<path class="research-link-path draft" d="${researchLinkPath(researchCanvasState.linkDraft.fromPoint, researchCanvasState.linkDraft.toPoint)}" />`);
  }
  svg.innerHTML = paths.join("");
}

function addResearchLink(fromId, toId) {
  if (!fromId || !toId || fromId === toId) {
    setResearchStatus("不能连接到同一个节点");
    return false;
  }
  if (!researchNodeById(fromId) || !researchNodeById(toId)) return false;
  const exists = researchCanvasState.links.some((link) => link.from === fromId && link.to === toId);
  if (!exists) researchCanvasState.links.push({ from: fromId, to: toId });
  renderResearchLinks();
  setResearchStatus("已建立节点连线");
  researchCanvasState.pendingLinkFrom = "";
  document.querySelectorAll(".research-node.pending-link").forEach((node) => node.classList.remove("pending-link"));
  return true;
}

function clearResearchLinksForNode(nodeId) {
  researchCanvasState.links = researchCanvasState.links.filter((link) => link.from !== nodeId && link.to !== nodeId);
  renderResearchLinks();
}

function updateResearchStage() {
  const stage = $("#researchStage");
  const label = $("#researchCanvasStatus");
  if (!stage) return;
  stage.style.transform = `translate(${Math.round(researchCanvasState.panX)}px, ${Math.round(researchCanvasState.panY)}px) scale(${researchCanvasState.scale})`;
  if (label) label.textContent = `${Math.round(researchCanvasState.scale * 100)}%`;
  renderResearchLinks();
}

function updateResearchNodeCount() {
  const count = document.querySelectorAll("#researchStage .research-node").length;
  const label = $("#researchNodeCount");
  if (label) label.textContent = `节点 ${count}`;
  researchCanvasState.nodeCounter = Math.max(researchCanvasState.nodeCounter, count);
}

function setResearchStatus(message) {
  const footer = document.querySelector(".research-canvas-footer span:first-child");
  if (footer) footer.textContent = message;
}

function syncResearchInspector(node) {
  const panel = document.querySelector(".research-tools");
  if (!panel) return;
  const titleInput = $("#researchInspectorTitle");
  const textInput = $("#researchInspectorText");
  const status = panel.querySelector(".research-section-title em");
  const name = node?.querySelector(".research-node-head strong")?.textContent || "对象标题";
  if (titleInput) {
    titleInput.value = node ? name : "对象标题";
    titleInput.disabled = !node;
  }
  if (textInput) {
    const editable = node?.querySelector("textarea");
    const description = node?.querySelector("p");
    textInput.value = node ? (editable?.value || description?.textContent || "") : "";
    textInput.disabled = !node;
  }
  if (status) status.textContent = node ? "已选中" : "未选中";
}

function selectResearchNode(node) {
  document.querySelectorAll(".research-node.selected").forEach((item) => item.classList.remove("selected"));
  researchCanvasState.activeNode = node || null;
  node?.classList.add("selected");
  syncResearchInspector(node);
}

function focusResearchNode(node) {
  if (!node) return;
  selectResearchNode(node);
  const canvas = $("#researchCanvas");
  if (!canvas) return;
  const canvasRect = canvas.getBoundingClientRect();
  const nodeWidth = Number(node.dataset.w || node.offsetWidth || 360);
  const nodeHeight = node.offsetHeight || 260;
  researchCanvasState.panX = Math.round((canvasRect.width / 2) - (Number(node.dataset.x || 0) + nodeWidth / 2) * researchCanvasState.scale);
  researchCanvasState.panY = Math.round((canvasRect.height / 2) - (Number(node.dataset.y || 0) + nodeHeight / 2) * researchCanvasState.scale);
  updateResearchStage();
  node.classList.add("just-updated");
  window.setTimeout(() => node.classList.remove("just-updated"), 1800);
}

function updateSelectedResearchNodeTitle(value) {
  const node = researchCanvasState.activeNode;
  if (!node) return;
  const title = node.querySelector(".research-node-head strong");
  if (title) title.textContent = value.trim() || "未命名节点";
}

function updateSelectedResearchNodeText(value) {
  const node = researchCanvasState.activeNode;
  if (!node) return;
  const editable = node.querySelector("textarea");
  if (editable) {
    editable.value = value;
    return;
  }
  const description = node.querySelector("p");
  if (description) description.textContent = value || "节点说明";
}

function researchNodeTemplate(type, id) {
  const promptText = ($("#researchPrompt")?.value || buildResearchPrompt()).trim();
  const templates = {
    image: {
      title: "上传图片节点",
      meta: "IMAGE-REFERENCE",
      body: `<div class="research-generated-preview"></div><p>用于上传线稿、色稿、实验装置参考图或论文插图。</p>`,
    },
    prompt: {
      title: "提示词节点",
      meta: "PROMPT",
      body: `<textarea aria-label="提示词节点" placeholder="在这里整理 S-C-S-S 科研绘图 Prompt">${escapeHtml(promptText)}</textarea>`,
    },
    "text-to-image": {
      title: "文生图节点",
      meta: "TEXT-TO-IMAGE",
      body: `<textarea aria-label="文生图提示词" placeholder="填写科研绘图提示词后启动文生图">${escapeHtml(promptText)}</textarea><div class="research-node-grid"><label>比例<select><option>16:9</option><option>1:1</option><option>4:3</option><option>3:4</option><option>9:16</option></select></label><label>分辨率<select><option>2K</option><option>1K</option><option>4K</option></select></label><label>质量<select><option>Medium</option><option>High</option><option>Auto</option></select></label><label>格式<select><option>PNG</option><option>WEBP</option><option>JPEG</option></select></label><label>背景<select><option>Auto</option><option>透明</option></select></label></div><button class="research-primary-button" data-research-generate-node="${escapeAttr(id)}" type="button">启动文生图</button>`,
    },
    "image-to-image": {
      title: "图生图节点",
      meta: "IMAGE-TO-IMAGE",
      body: `<div class="research-generated-preview"></div><p>接收线稿/色稿/草图作为输入，用于局部重绘或风格统一。</p>`,
    },
    "reverse-prompt": {
      title: "反推提示词节点",
      meta: "IMAGE-TO-PROMPT",
      body: `<textarea aria-label="反推提示词">从参考图提取主体、构图、结构细节和风格，输出可复用 Prompt。</textarea>`,
    },
    output: {
      title: "科研图草图",
      meta: "GENERATED-IMAGE",
      body: `<div class="research-generated-preview"></div><p>等待生成科研图草图。</p>`,
      headControl: `<span class="research-output-badge">输出</span>`,
    },
    diagram: {
      title: "流程图预览",
      meta: "MERMAID-SVG",
      body: `<div id="researchDiagramPreview" class="research-diagram-preview"></div><p>可复制 Mermaid 源码，也可导出 SVG/PNG 用于论文、PPT 或 Markdown。</p>`,
    },
    text: {
      title: "文本标注节点",
      meta: "ANNOTATION",
      body: `<textarea aria-label="文本标注">图注、标签、实验条件或局部说明</textarea>`,
    },
  };
  const item = templates[type] || templates.prompt;
  return `
    <div class="research-node-head">
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></div>
      ${item.headControl || `<select class="research-image-model-select"><option>未检测到生图模型</option></select>`}
      <button type="button" data-research-remove-node>×</button>
    </div>
    ${item.body}
    <span class="research-port in">IN</span>
    <span class="research-port out">OUT</span>
    <button class="research-resize-handle" type="button" aria-label="缩放节点"></button>
  `;
}

function createResearchNode(type = "prompt", options = {}) {
  const stage = $("#researchStage");
  if (!stage) return null;
  researchCanvasState.nodeCounter += 1;
  const id = options.id || `node-${Date.now()}-${researchCanvasState.nodeCounter}`;
  const node = document.createElement("article");
  node.className = `research-node research-node-${type}`;
  node.dataset.nodeId = id;
  node.dataset.x = String(options.x ?? 120 + (researchCanvasState.nodeCounter % 4) * 48);
  node.dataset.y = String(options.y ?? 120 + (researchCanvasState.nodeCounter % 5) * 42);
  node.dataset.w = String(options.w ?? (type === "text-to-image" ? 340 : 300));
  node.innerHTML = researchNodeTemplate(type, id);
  stage.append(node);
  setResearchNodeGeometry(node);
  syncResearchImageModelOptions(verifiedImageModels);
  selectResearchNode(node);
  updateResearchNodeCount();
  setResearchStatus(`已添加${node.querySelector(".research-node-head strong")?.textContent || "节点"}`);
  return node;
}

function removeResearchNode(node) {
  if (!node) return;
  const name = node.querySelector(".research-node-head strong")?.textContent || "节点";
  if (researchCanvasState.activeNode === node) selectResearchNode(null);
  clearResearchLinksForNode(node.dataset.nodeId);
  node.remove();
  updateResearchNodeCount();
  setResearchStatus(`已删除${name}`);
}

function optimizeResearchPromptText() {
  const prompt = $("#researchPrompt");
  if (!prompt) return;
  const base = (prompt.value || buildResearchPrompt()).trim();
  const additions = [
    "请优先保证科研逻辑准确、流程箭头清楚、模块边界明确。",
    "每个节点保留可读标签区域，避免生成无法辨认的小字。",
    "输出适合后续在 PPT 或 Illustrator 中描图重绘的扁平矢量草图。",
  ];
  prompt.value = `${base}\n\n优化要求：\n${additions.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`;
  renderResearchScssCards();
  setResearchStatus("已补充科研绘图优化要求");
}

function sendResearchPromptToCanvas() {
  if (!($("#researchPrompt")?.value || "").trim() && !buildResearchPrompt()) {
    setResearchStatus("请先填写绘图目标或论文摘要，再放到画布");
    return;
  }
  const node = createResearchNode("prompt", { x: 150, y: 150, w: 360 });
  if (node) setResearchStatus("已把当前提示词放到画布节点");
}

function generateResearchOutputs(sourceNode, options = {}) {
  const availablePrompt = sourceNode?.querySelector("textarea")?.value || $("#researchPrompt")?.value || buildResearchPrompt();
  if (!availablePrompt.trim() && !options.force) {
    setResearchStatus("请先填写绘图目标或论文摘要，再生成科研图");
    return;
  }
  let outputs = document.querySelectorAll(".research-node-output .research-generated-preview");
  if (!outputs.length) {
    createResearchNode("output", { x: 650, y: 90, w: 390 });
    outputs = document.querySelectorAll(".research-node-output .research-generated-preview");
  }
  outputs.forEach((preview, index) => {
    preview.classList.toggle("generated", true);
    const sourcePrompt = availablePrompt || buildResearchGenerationPrompt();
    const label = sourcePrompt.split("\n").find(Boolean)?.slice(0, 34) || "S-C-S-S 草图预览";
    preview.innerHTML = `<strong>科研图 ${index + 1}</strong><span>${escapeHtml(label)}</span>`;
    const node = preview.closest(".research-node");
    const desc = node?.querySelector("p");
    if (desc) desc.textContent = `已生成预览: ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  });
  const caption = document.querySelector(".research-tools .research-empty-box:not(textarea)");
  if (caption) caption.textContent = "图注候选：基于项目内容生成科研流程图，展示输入、处理、关键变量、结果读出与后期重绘结构。";
  selectResearchNode(sourceNode || document.querySelector(".research-node-output"));
  setResearchStatus(options.status || "已生成科研图草图预览，可继续局部重绘或高清放大");
}

function handleResearchMode(mode) {
  const modeMap = {
    inpaint: {
      status: "已切换科研图编辑：可在右侧输入编辑指令后生成局部方案",
      prompt: "科研图编辑：在不改变科学结构的前提下，优化选中科研图的模块边界、箭头走向、标签可读性和论文图质感。",
    },
    crop: {
      status: "已切换局部重绘：请选中节点或上传局部截图",
      prompt: "局部重绘：仅重绘选区范围，保持原图整体结构、配色和科学含义一致，增强边缘清晰度和局部细节。",
    },
    upscale: {
      status: "已切换高清放大：会优先增强线条、标签和设备边缘",
      prompt: "高清放大：将科研图草图放大并增强清晰度，保持箭头、标签、模块关系和原始构图不变。",
    },
    "dual-control": {
      status: "已切换线稿/色稿双控制：线稿控结构，色稿控材质和配色",
      prompt: researchPromptPresets.find((item) => item.id === "research-dual-control")?.prompt || "",
    },
  };
  const item = modeMap[mode];
  if (!item) return;
  const promptBox = $("#researchPrompt");
  if (promptBox && item.prompt) {
    const current = promptBox.value.trim();
    promptBox.value = current ? `${current}\n\n${item.prompt}` : item.prompt;
    renderResearchScssCards();
  }
  setResearchStatus(item.status);
}

function autoLayoutResearchNodes() {
  const nodes = [...document.querySelectorAll("#researchStage .research-node")];
  const positions = [
    [105, 210],
    [650, 82],
    [1080, 160],
    [105, 560],
    [650, 475],
    [1080, 560],
  ];
  nodes.forEach((node, index) => {
    const [x, y] = positions[index] || [120 + (index % 3) * 360, 120 + Math.floor(index / 3) * 260];
    setResearchNodeGeometry(node, { x, y, w: Number(node.dataset.w || node.offsetWidth || 320) });
  });
  researchCanvasState.scale = 1;
  researchCanvasState.panX = 0;
  researchCanvasState.panY = 0;
  updateResearchStage();
  setResearchStatus("已按流程结构重新排版节点");
}

function saveResearchProject() {
  const signature = researchProjectSignature();
  clearMismatchedResearchOutputs(signature);
  const payload = {
    prompt: $("#researchPrompt")?.value || "",
    diagram: $("#researchDiagramSource")?.value || "",
    subject: $("#researchSubject")?.value || "",
    context: $("#researchProjectContext")?.value || "",
    signature,
    links: researchCanvasState.links,
    nodes: [...document.querySelectorAll("#researchStage .research-node")].map((node) => ({
      id: node.dataset.nodeId,
      x: node.dataset.x,
      y: node.dataset.y,
      w: node.dataset.w,
      researchJobId: node.dataset.researchJobId || "",
      researchProjectSignature: node.dataset.researchProjectSignature || "",
      researchPromptSignature: node.dataset.researchPromptSignature || "",
      html: node.innerHTML,
      className: node.className,
    })),
  };
  localStorage.setItem(RESEARCH_PROJECT_STORAGE_KEY, JSON.stringify(payload));
  setResearchStatus("工程已保存到当前浏览器");
}

function loadResearchProject() {
  const raw = localStorage.getItem(RESEARCH_PROJECT_STORAGE_KEY);
  if (!raw) {
    setResearchStatus("当前浏览器没有已保存的科研工程");
    return;
  }
  const payload = JSON.parse(raw);
  if ($("#researchPrompt")) $("#researchPrompt").value = payload.prompt || "";
  if ($("#researchDiagramSource")) $("#researchDiagramSource").value = payload.diagram || "";
  if ($("#researchSubject")) $("#researchSubject").value = payload.subject || "";
  if ($("#researchProjectContext")) $("#researchProjectContext").value = payload.context || "";
  activeResearchProjectSignature = payload.signature || researchProjectSignature();
  const currentSignature = activeResearchProjectSignature;
  const stage = $("#researchStage");
  if (stage && Array.isArray(payload.nodes)) {
    stage.querySelectorAll(".research-node").forEach((node) => node.remove());
    payload.nodes.forEach((item) => {
      const node = document.createElement("article");
      node.className = item.className || "research-node";
      node.dataset.nodeId = item.id || `restored-${Date.now()}`;
      node.dataset.x = item.x || "120";
      node.dataset.y = item.y || "120";
      node.dataset.w = item.w || "320";
      if (item.researchJobId) node.dataset.researchJobId = item.researchJobId;
      if (item.researchProjectSignature) node.dataset.researchProjectSignature = item.researchProjectSignature;
      if (item.researchPromptSignature) node.dataset.researchPromptSignature = item.researchPromptSignature;
      node.innerHTML = item.html || researchNodeTemplate("prompt", node.dataset.nodeId);
      stage.append(node);
      setResearchNodeGeometry(node);
      if (node.classList.contains("research-node-output")) {
        const outputSignature = node.dataset.researchProjectSignature || "";
        if (!outputSignature || (currentSignature && outputSignature !== currentSignature)) {
          resetResearchOutputNode(node, "等待生成当前科研图。");
        }
      }
    });
  }
  researchCanvasState.links = Array.isArray(payload.links) ? payload.links.filter((link) => link.from && link.to) : [];
  clearMismatchedResearchOutputs(currentSignature);
  renderResearchScssCards();
  updateResearchNodeCount();
  renderResearchLinks();
  renderResearchDiagram();
  setResearchStatus("已读取浏览器中保存的科研工程");
}

function resetResearchProject() {
  localStorage.removeItem(RESEARCH_PROJECT_STORAGE_KEY);
  localStorage.removeItem(RESEARCH_ACTIVE_JOB_STORAGE_KEY);
  activeResearchJobId = "";
  activeResearchProjectSignature = "";
  ["researchPrompt", "researchDiagramSource", "researchSubject", "researchProjectContext", "researchProjectContextMirror"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.value = "";
  });
  const stage = $("#researchStage");
  if (stage) {
    stage.querySelectorAll(".research-node").forEach((node) => node.remove());
    const promptNode = createResearchNode("text-to-image", { id: "prompt", x: 105, y: 210, w: 340 });
    const outputNode = createResearchNode("output", { id: "output-a", x: 650, y: 82, w: 390 });
    const diagramNode = createResearchNode("diagram", { id: "diagram-preview", x: 1080, y: 160, w: 460 });
    if (promptNode) {
      const title = promptNode.querySelector(".research-node-head strong");
      if (title) title.textContent = "文生图节点";
    }
    if (outputNode) {
      const title = outputNode.querySelector(".research-node-head strong");
      if (title) title.textContent = "科研图 1";
    }
    if (diagramNode) {
      const select = diagramNode.querySelector(".research-image-model-select");
      if (select) {
        const badge = document.createElement("span");
        badge.className = "research-output-badge";
        badge.textContent = "Mermaid";
        select.replaceWith(badge);
      }
    }
  }
  researchCanvasState.links = [{ from: "prompt", to: "output-a" }];
  researchCanvasState.scale = 1;
  researchCanvasState.panX = 0;
  researchCanvasState.panY = 0;
  renderResearchScssCards();
  updateResearchNodeCount();
  updateResearchStage();
  renderResearchDiagram();
  selectResearchNode(researchNodeById("prompt"));
  setResearchStatus("已恢复科研工作台默认界面");
}

function zoomResearchCanvas(nextScale, origin) {
  const canvas = $("#researchCanvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const oldScale = researchCanvasState.scale;
  const newScale = researchClamp(nextScale, 0.35, 2.8);
  const localX = (origin?.x ?? rect.width / 2);
  const localY = (origin?.y ?? rect.height / 2);
  const worldX = (localX - researchCanvasState.panX) / oldScale;
  const worldY = (localY - researchCanvasState.panY) / oldScale;
  researchCanvasState.scale = newScale;
  researchCanvasState.panX = localX - worldX * newScale;
  researchCanvasState.panY = localY - worldY * newScale;
  updateResearchStage();
}

function initResearchCanvasEngine() {
  const canvas = $("#researchCanvas");
  const stage = $("#researchStage");
  if (!canvas || !stage || canvas.dataset.engineReady === "1") return;
  canvas.dataset.engineReady = "1";
  stage.querySelectorAll(".research-node").forEach((node) => setResearchNodeGeometry(node));
  updateResearchStage();

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    zoomResearchCanvas(researchCanvasState.scale * factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, { passive: false });

  const startResearchLink = (event, node) => {
    selectResearchNode(node);
    const point = researchCanvasPoint(canvas, event);
    researchCanvasState.pointerId = event.pointerId;
    researchCanvasState.startClientX = event.clientX;
    researchCanvasState.startClientY = event.clientY;
    researchCanvasState.action = "link";
    researchCanvasState.linkDraft = {
      from: node.dataset.nodeId,
      fromPoint: researchPortPoint(node, "out"),
      toPoint: point,
    };
    node.classList.add("linking");
    canvas.classList.add("linking");
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    canvas.setPointerCapture?.(event.pointerId);
    renderResearchLinks();
    setResearchStatus("拖到目标节点的 IN 端口建立连线；也可以先点 OUT 再点 IN");
  };

  canvas.addEventListener("pointerdown", (event) => {
    const port = event.target.closest(".research-port");
    const node = event.target.closest(".research-node");
    if (node && port?.classList.contains("out")) {
      startResearchLink(event, node);
    }
  }, { capture: true });

  canvas.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".research-resize-handle");
    const port = event.target.closest(".research-port");
    const node = event.target.closest(".research-node");
    const interactive = event.target.closest("input, textarea, select, button");
    canvas.focus({ preventScroll: true });
    researchCanvasState.pointerId = event.pointerId;
    researchCanvasState.startClientX = event.clientX;
    researchCanvasState.startClientY = event.clientY;
    researchCanvasState.startPanX = researchCanvasState.panX;
    researchCanvasState.startPanY = researchCanvasState.panY;

    if (node && port?.classList.contains("out")) {
      event.preventDefault();
      return;
    }

    if (node && interactive && !handle) {
      selectResearchNode(node);
      researchCanvasState.action = null;
      return;
    }

    if (node) {
      selectResearchNode(node);
      const point = researchCanvasPoint(canvas, event);
      researchCanvasState.startWorldX = point.x;
      researchCanvasState.startWorldY = point.y;
      researchCanvasState.startNodeX = Number(node.dataset.x || 0);
      researchCanvasState.startNodeY = Number(node.dataset.y || 0);
      researchCanvasState.startNodeW = Number(node.dataset.w || node.offsetWidth || 320);
      researchCanvasState.action = handle ? "resize-node" : "drag-node";
      node.classList.toggle("dragging", !handle);
      event.preventDefault();
    } else if (researchCanvasState.spaceDown || event.button === 1) {
      researchCanvasState.action = "pan";
      canvas.classList.add("dragging");
      event.preventDefault();
    } else {
      researchCanvasState.action = null;
      selectResearchNode(null);
    }
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    const action = researchCanvasState.action;
    if (!action) return;
    if (action === "pan") {
      researchCanvasState.panX = researchCanvasState.startPanX + event.clientX - researchCanvasState.startClientX;
      researchCanvasState.panY = researchCanvasState.startPanY + event.clientY - researchCanvasState.startClientY;
      updateResearchStage();
      return;
    }
    if (action === "link") {
      if (researchCanvasState.linkDraft) {
        researchCanvasState.linkDraft.toPoint = researchCanvasPoint(canvas, event);
        renderResearchLinks();
      }
      return;
    }
    const node = researchCanvasState.activeNode;
    if (!node) return;
    const point = researchCanvasPoint(canvas, event);
    const dx = point.x - researchCanvasState.startWorldX;
    const dy = point.y - researchCanvasState.startWorldY;
    if (action === "drag-node") {
      setResearchNodeGeometry(node, {
        x: researchCanvasState.startNodeX + dx,
        y: researchCanvasState.startNodeY + dy,
        w: researchCanvasState.startNodeW,
      });
    }
    if (action === "resize-node") {
      setResearchNodeGeometry(node, {
        x: researchCanvasState.startNodeX,
        y: researchCanvasState.startNodeY,
        w: researchCanvasState.startNodeW + dx,
      });
    }
  });

  const finishPointerAction = (event) => {
    if (researchCanvasState.action === "link") {
      const targetPort = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".research-port.in");
      const targetNode = targetPort?.closest(".research-node");
      if (targetNode && researchCanvasState.linkDraft?.from) {
        addResearchLink(researchCanvasState.linkDraft.from, targetNode.dataset.nodeId);
      } else {
        setResearchStatus("连线已取消：请松开到目标节点的 IN 端口");
      }
      researchCanvasState.linkDraft = null;
      canvas.classList.remove("linking");
      document.querySelectorAll(".research-node.linking").forEach((node) => node.classList.remove("linking"));
      renderResearchLinks();
    }
    if (researchCanvasState.pointerId !== null) {
      canvas.releasePointerCapture?.(researchCanvasState.pointerId);
    }
    researchCanvasState.pointerId = null;
    researchCanvasState.action = null;
    canvas.classList.remove("dragging");
    document.querySelectorAll(".research-node.dragging").forEach((node) => node.classList.remove("dragging"));
    event?.preventDefault?.();
  };
  canvas.addEventListener("pointerup", finishPointerAction);
  canvas.addEventListener("pointercancel", finishPointerAction);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.mediaPreviewModal?.classList.contains("hidden")) {
      setMediaPreview(false);
      return;
    }
    if (event.code !== "Space" || document.activeElement?.matches("input, textarea, select")) return;
    researchCanvasState.spaceDown = true;
    canvas.classList.add("is-panning");
    event.preventDefault();
  });
  document.addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    researchCanvasState.spaceDown = false;
    canvas.classList.remove("is-panning");
  });
}

function initResearchWorkbench() {
  if (!$("#research")) return;
  const researchRoot = $("#research");
  const prompt = $("#researchPrompt");
  renderResearchPromptRepo();
  renderResearchSkills();
  renderResearchScssCards();
  $("#researchBuildPrompt")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    generateResearchPromptWithAi(event.currentTarget);
  }, true);
  $("#researchBuildDiagram")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    generateResearchDiagramWithAi(event.currentTarget);
  }, true);
  $("#researchBuildPrompt")?.addEventListener("click", () => {
    if (prompt) prompt.value = buildResearchPrompt();
    renderResearchScssCards();
    setResearchStatus("已生成 S-C-S-S 科研绘图提示词");
  });
  const diagramSource = $("#researchDiagramSource");
  ["researchSubject", "researchProjectContext", "researchFigureType", "researchStyle"].forEach((id) => {
    const el = $(`#${id}`);
    el?.addEventListener("input", renderResearchScssCards);
    el?.addEventListener("change", renderResearchScssCards);
  });
  $("#researchProjectContext")?.addEventListener("input", (event) => {
    const mirror = $("#researchProjectContextMirror");
    if (mirror) mirror.value = event.currentTarget.value;
  });
  $("#researchCopyPrompt")?.addEventListener("click", async () => {
    const text = prompt?.value || "";
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setResearchStatus("提示词已复制");
  });
  $("#researchBuildDiagram")?.addEventListener("click", () => {
    if (diagramSource) diagramSource.value = buildResearchMermaidDiagram();
    renderResearchDiagram();
  });
  $("#researchRenderDiagram")?.addEventListener("click", renderResearchDiagram);
  $("#researchCopyDiagram")?.addEventListener("click", async () => {
    const text = diagramSource?.value || "";
    if (!text) return;
    await navigator.clipboard?.writeText(text);
    setResearchStatus("Mermaid 流程图源码已复制");
  });
  $("#researchSendDiagramNode")?.addEventListener("click", sendResearchDiagramToCanvas);
  $("#researchApplyToStudio")?.addEventListener("click", applyResearchToStudio);
  $("#researchApiButton")?.addEventListener("click", () => {
    location.hash = "#studio";
    els.appShell?.classList.add("settings-open");
    setResearchStatus("API 配置沿用专业生图台，请在专业生图台右侧模型接入里填写");
  });
  document.querySelectorAll("[data-research-add-node]").forEach((button) => {
    button.addEventListener("click", () => createResearchNode(button.dataset.researchAddNode || "prompt"));
  });
  $("#researchUploadShortcut")?.addEventListener("click", () => $("#researchPaperInput")?.click());
  $("#researchOptimizePrompt")?.addEventListener("click", optimizeResearchPromptText);
  $("#researchSendPromptNode")?.addEventListener("click", sendResearchPromptToCanvas);
  $("#researchScrollPresets")?.addEventListener("click", () => {
    $("#researchPromptRepo")?.scrollIntoView({ block: "center", behavior: "smooth" });
    setResearchStatus("已定位到提示词仓库");
  });
  $("#researchGenerateAll")?.addEventListener("click", () => submitResearchGenerationJob(null));
  $("#researchExportSvg")?.addEventListener("click", exportResearchDiagramSvg);
  $("#researchExportPng")?.addEventListener("click", exportResearchDiagramPng);
  $("#researchAutoLayout")?.addEventListener("click", autoLayoutResearchNodes);
  $("#researchSaveProject")?.addEventListener("click", saveResearchProject);
  $("#researchLoadProject")?.addEventListener("click", loadResearchProject);
  $("#researchResetProject")?.addEventListener("click", resetResearchProject);
  $("#researchToggleLeft")?.addEventListener("click", (event) => {
    researchRoot.classList.toggle("left-collapsed");
    event.currentTarget.classList.toggle("active", !researchRoot.classList.contains("left-collapsed"));
  });
  $("#researchToggleRight")?.addEventListener("click", (event) => {
    researchRoot.classList.toggle("right-collapsed");
    event.currentTarget.classList.toggle("active", !researchRoot.classList.contains("right-collapsed"));
  });
  $("#researchPaperInput")?.addEventListener("change", (event) => readResearchPaperFile(event.currentTarget));
  $("#researchLineInput")?.addEventListener("change", (event) => previewResearchFile(event.currentTarget, $("#researchLinePreview")));
  $("#researchColorInput")?.addEventListener("change", (event) => previewResearchFile(event.currentTarget, $("#researchColorPreview")));
  $("#researchInspectorTitle")?.addEventListener("input", (event) => updateSelectedResearchNodeTitle(event.currentTarget.value));
  $("#researchInspectorText")?.addEventListener("input", (event) => updateSelectedResearchNodeText(event.currentTarget.value));
  document.querySelectorAll("[data-research-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-research-mode]").forEach((item) => item.classList.toggle("active", item === button));
      handleResearchMode(button.dataset.researchMode);
    });
  });
  document.querySelectorAll("[data-research-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      const tool = button.dataset.researchTool;
      if (tool === "zoom-in") {
        zoomResearchCanvas(researchCanvasState.scale * 1.15);
        return;
      }
      if (tool === "zoom-out") {
        zoomResearchCanvas(researchCanvasState.scale / 1.15);
        return;
      }
      if (tool === "reset-view") {
        researchCanvasState.scale = 1;
        researchCanvasState.panX = 0;
        researchCanvasState.panY = 0;
        updateResearchStage();
        setResearchStatus("画布视图已复位");
        return;
      }
      document.querySelectorAll("[data-research-tool]").forEach((item) => item.classList.toggle("active", item === button));
      const label = $("#researchCanvasStatus");
      if (label) label.textContent = button.textContent.trim();
    });
  });
  $("#researchStage")?.addEventListener("click", (event) => {
    const port = event.target.closest(".research-port");
    if (port) {
      event.preventDefault();
      const node = port.closest(".research-node");
      if (!node) return;
      if (port.classList.contains("out")) {
        researchCanvasState.pendingLinkFrom = node.dataset.nodeId || "";
        document.querySelectorAll(".research-node.pending-link").forEach((item) => item.classList.remove("pending-link"));
        node.classList.add("pending-link");
        setResearchStatus("已选中输出端口，请点击目标节点的 IN");
        return;
      }
      if (port.classList.contains("in") && researchCanvasState.pendingLinkFrom) {
        addResearchLink(researchCanvasState.pendingLinkFrom, node.dataset.nodeId);
        return;
      }
    }
    const removeButton = event.target.closest("[data-research-remove-node]");
    if (removeButton) {
      event.preventDefault();
      removeResearchNode(removeButton.closest(".research-node"));
      return;
    }
    const generateButton = event.target.closest("[data-research-generate-node]");
    if (generateButton) {
      event.preventDefault();
      submitResearchGenerationJob(generateButton.closest(".research-node"));
    }
  });
  initResearchCanvasEngine();
  updateResearchNodeCount();
  renderResearchDiagram();
}

els.prompt.addEventListener("input", syncSummary);
window.addEventListener("resize", syncPromptTextareaSize);
["change", "input"].forEach((eventName) => {
  [els.protocol, els.model, els.apiUrl, els.apiKey, els.rememberApiKey, els.aspectRatio, els.resolution, els.count, els.concurrency, els.retryLimit, els.quality, els.outputFormat, els.seed, els.negative].forEach((el) => el.addEventListener(eventName, () => {
    if (el === els.aspectRatio && !referenceAspectSyncing && referenceAspectCandidate()) {
      referenceAspectAutoEnabled = false;
      referenceAspectAutoValue = "";
    }
    if (el === els.count || el === els.concurrency) syncConcurrencyToCount({ commit: eventName === "change" });
    syncSummary();
  }));
});
els.count?.addEventListener("blur", () => {
  syncConcurrencyToCount({ commit: true });
  syncSummary();
});
els.connectionButtons.forEach((button) => button.addEventListener("click", () => {
  setConnectionMode(button.dataset.connectionMode, { persist: true });
  scheduleAutoRefreshModels();
}));
els.submitJob.addEventListener("click", submitJob);
els.clearPrompt?.addEventListener("click", () => {
  els.prompt.value = "";
  closePromptAnalysis();
  syncSummary();
  els.prompt.focus();
});
els.referenceUploadButton.addEventListener("click", () => els.referenceUpload.click());
els.referenceUpload.addEventListener("change", uploadReference);
els.matchReferenceAspect?.addEventListener("click", () => {
  referenceAspectAutoEnabled = true;
  applyReferenceAspectRatio({ announce: true });
});
els.clearMedia.addEventListener("click", clearMedia);
els.toggleHistory?.addEventListener("click", () => {
  historyExpanded = !historyExpanded;
  renderHistory();
});
els.galleryHeader?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gallery-action]");
  if (button) handleGalleryAction(button.dataset.galleryAction);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest('[data-gallery-action="show-all"]');
  if (!button || els.galleryHeader?.contains(button)) return;
  handleGalleryAction("show-all");
});
els.showAllMedia?.addEventListener("click", () => {
  window.showAllGenerated?.();
});
squareEls.refresh?.addEventListener("click", loadSquare);
squareEls.tabs.forEach((button) => {
  button.addEventListener("click", () => {
    squareEls.tabs.forEach((item) => item.classList.toggle("active", item === button));
    squareSort = squareSortFromButton(button);
    loadSquare();
  });
});
squareEls.grid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-square-action]");
  if (!button) return;
  const card = button.closest("[data-square-id]");
  const id = card?.dataset.squareId || "";
  const action = button.dataset.squareAction;
  if (action === "like") {
    likeSquareItem(id);
  } else if (action === "open") {
    previewSquareItem(id);
  }
});
commerceEls.tabs.forEach((button) => {
  button.addEventListener("click", () => setCommerceTab(button.dataset.commerceTab));
});
commerceEls.chatToggle?.addEventListener("click", () => setCommerceChatOpen(true));
commerceEls.chatFloat?.addEventListener("click", () => setCommerceChatOpen(true));
commerceEls.chatClose?.addEventListener("click", () => setCommerceChatOpen(false));
commerceEls.analysisCard?.addEventListener("click", (event) => {
  if (event.target === commerceEls.analysisCard && window.matchMedia("(max-width: 1180px)").matches) setCommerceChatOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("commerce-chat-open")) {
    setCommerceChatOpen(false);
  }
});
commerceEls.modeChips.forEach((button) => {
  button.addEventListener("click", () => {
    setCommerceChip(commerceEls.modeChips, "commerceMode", button.dataset.commerceMode);
    syncCommerceModeControls({ clearTextReferences: button.dataset.commerceMode !== "image" });
    syncCommercePrompt({ force: false });
  });
});
commerceEls.sceneChips.forEach((button) => {
  button.addEventListener("click", () => {
    if (commerceEls.style) commerceEls.style.value = button.dataset.commerceScene || "";
    syncCommerceStyleControls();
    syncCommercePrompt({ force: false });
  });
});
commerceEls.ratioChips.forEach((button) => {
  button.addEventListener("click", () => {
    setCommerceChip(commerceEls.ratioChips, "commerceRatio", button.dataset.commerceRatio);
    if (commerceEls.size) commerceEls.size.value = "auto";
  });
});
[commerceEls.productName, commerceEls.sellingPoints, commerceEls.style].forEach((input) => {
  input?.addEventListener("input", () => {
    if (input === commerceEls.style) syncCommerceStyleControls();
    syncCommercePrompt({ force: false });
  });
});
commerceEls.clearStyle?.addEventListener("click", () => {
  if (commerceEls.style) commerceEls.style.value = "";
  syncCommerceStyleControls();
  syncCommercePrompt({ force: false });
  commerceEls.style?.focus();
});
function openCommerceReferencePicker() {
  setCommerceChip(commerceEls.modeChips, "commerceMode", "image");
  syncCommerceModeControls();
  (commerceEls.referenceInput || els.referenceUpload)?.click();
}

commerceEls.referenceDrop?.addEventListener("click", () => {
  openCommerceReferencePicker();
});
commerceEls.referenceDrop?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openCommerceReferencePicker();
});
commerceEls.referenceDrop?.addEventListener("dragover", (event) => {
  event.preventDefault();
  commerceEls.referenceDrop?.classList.add("drag-over");
});
commerceEls.referenceDrop?.addEventListener("dragleave", () => {
  commerceEls.referenceDrop?.classList.remove("drag-over");
});
commerceEls.referenceDrop?.addEventListener("drop", async (event) => {
  event.preventDefault();
  commerceEls.referenceDrop?.classList.remove("drag-over");
  setCommerceChip(commerceEls.modeChips, "commerceMode", "image");
  syncCommerceModeControls();
  await uploadReferenceFiles(event.dataTransfer?.files || []);
});
commerceEls.prompt?.addEventListener("input", () => {
  commercePromptTouched = true;
});
[commerceEls.apiUrl, commerceEls.apiKey].forEach((input) => {
  input?.addEventListener("input", scheduleCommerceModelRefresh);
});
commerceEls.rememberKey?.addEventListener("change", () => {
  pushCommerceConnectionToMain();
});
commerceEls.model?.addEventListener("change", () => {
  pushCommerceConnectionToMain();
  renderAvailableModels();
});
commerceEls.templateSelect?.addEventListener("change", () => applyCommerceTemplate(commerceEls.templateSelect.value));
commerceEls.saveTemplate?.addEventListener("click", saveCommerceTemplateFromForm);
commerceEls.newTemplate?.addEventListener("click", () => {
  commerceEditingTemplateId = "";
  if (commerceEls.templateSelect) commerceEls.templateSelect.value = "";
  if (commerceEls.templateName) commerceEls.templateName.value = "";
  if (commerceEls.templateTags) commerceEls.templateTags.value = "";
  if (commerceEls.saveTemplate) commerceEls.saveTemplate.textContent = "保存模板";
  if (commerceEls.prompt) {
    commerceEls.prompt.value = "";
    commercePromptTouched = false;
  }
  commerceEls.templateName?.focus();
  setCommerceTab("workspace");
});
commerceEls.templateSearch?.addEventListener("input", renderCommerceTemplates);
commerceEls.templateList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-commerce-template-action]");
  if (!button) return;
  const item = button.closest("[data-commerce-template-id]");
  const id = item?.dataset.commerceTemplateId || "";
  if (button.dataset.commerceTemplateAction === "favorite") {
    const template = commerceTemplates.find((entry) => entry.id === id);
    if (template) {
      template.favorite = !template.favorite;
      template.updated_at = Date.now() / 1000;
      saveCommerceTemplates();
      renderCommerceTemplates();
    }
    return;
  }
  if (button.dataset.commerceTemplateAction === "use") {
    applyCommerceTemplate(id);
    setCommerceTab("workspace");
    return;
  }
  if (button.dataset.commerceTemplateAction === "edit") {
    applyCommerceTemplate(id);
    setCommerceTab("workspace");
    commerceEls.templateName?.focus();
    return;
  }
  commerceTemplates = commerceTemplates.filter((template) => template.id !== id);
  if (commerceEditingTemplateId === id) {
    commerceEditingTemplateId = "";
    if (commerceEls.saveTemplate) commerceEls.saveTemplate.textContent = "保存模板";
  }
  saveCommerceTemplates();
  renderCommerceTemplates();
});
commerceEls.clearSelection?.addEventListener("click", () => {
  commercePromptTouched = false;
  if (commerceEls.productName) commerceEls.productName.value = "";
  if (commerceEls.sellingPoints) commerceEls.sellingPoints.value = "";
  if (commerceEls.style) commerceEls.style.value = "";
  if (commerceEls.prompt) commerceEls.prompt.value = "";
  if (commerceEls.templateName) commerceEls.templateName.value = "";
  if (commerceEls.templateTags) commerceEls.templateTags.value = "";
  commerceEditingTemplateId = "";
  if (commerceEls.templateSelect) commerceEls.templateSelect.value = "";
  if (commerceEls.saveTemplate) commerceEls.saveTemplate.textContent = "保存模板";
  selectedReferenceIds.clear();
  renderReferences();
  setCommerceChip(commerceEls.modeChips, "commerceMode", "text");
  syncCommerceModeControls({ clearTextReferences: true });
  syncCommerceStyleControls();
  setCommerceChip(commerceEls.ratioChips, "commerceRatio", "1:1");
  syncCommercePrompt({ force: true });
});
commerceEls.referenceUpload?.addEventListener("click", () => {
  setCommerceChip(commerceEls.modeChips, "commerceMode", "image");
  syncCommerceModeControls();
});
commerceEls.referenceInput?.addEventListener("change", () => {
  uploadReferenceFiles(commerceEls.referenceInput.files || []);
});
commerceEls.analysisInput?.addEventListener("change", () => {
  uploadCommerceAnalysisImages(commerceEls.analysisInput.files || []);
});
commerceEls.analysisImages?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-commerce-analysis-remove]");
  if (!button) return;
  commerceAnalysisRefs = commerceAnalysisRefs.filter((ref) => ref.id !== button.dataset.commerceAnalysisRemove);
  saveCommerceAnalysisState();
  renderCommerceAnalysisRefs();
  setCommerceAnalysisStatus(commerceAnalysisRefs.length ? `已保留 ${commerceAnalysisRefs.length} 张图片` : "可上传图片后开始对话");
});
[commerceEls.textApiUrl, commerceEls.textModel, commerceEls.textApiKey, commerceEls.analysisContext].forEach((input) => {
  input?.addEventListener("input", saveCommerceAnalysisState);
});
commerceEls.textApiUrl?.addEventListener("input", scheduleCommerceTextModelRefresh);
commerceEls.textApiKey?.addEventListener("input", scheduleCommerceTextModelRefresh);
commerceEls.textModelSelect?.addEventListener("change", () => {
  const selected = commerceEls.textModelSelect.value;
  const manual = selected === "__manual__";
  commerceEls.textModel.classList.toggle("hidden", !manual);
  if (manual) {
    if (verifiedTextModels.includes(commerceEls.textModel.value.trim())) commerceEls.textModel.value = "";
    commerceEls.textModel.focus();
  } else if (selected) {
    commerceEls.textModel.value = selected;
  }
  saveCommerceAnalysisState();
});
commerceEls.analysisSend?.addEventListener("click", sendCommerceAnalysisMessage);
commerceEls.analysisInputText?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  sendCommerceAnalysisMessage();
});
[commerceEls.generate, commerceEls.generateBottom].forEach((button) => {
  button?.addEventListener("click", submitCommerceJob);
});
[commerceEls.gallery, commerceEls.library].forEach((list) => {
  list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-commerce-media-action]");
    if (!button) return;
    const card = button.closest("[data-commerce-media-id]");
    const mediaId = card?.dataset.commerceMediaId || "";
    const jobId = card?.dataset.commerceJobId || "";
    const action = button.dataset.commerceMediaAction;
    if (action === "preview") {
      previewCommerceMedia(mediaId);
    } else if (action === "copy") {
      const media = mediaForWorkspace("commerce").find((item) => item.id === mediaId);
      navigator.clipboard?.writeText(media?.prompt || "");
    } else if (action === "retry") {
      retryJobs([jobId]);
    } else if (action === "save-template") {
      saveCommerceTemplateFromMedia(mediaId);
    } else if (action === "delete") {
      deleteCommerceMedia(mediaId).catch((err) => alert(err.message));
    }
  });
});
commerceEls.showAllHistory?.addEventListener("click", () => setCommerceTab("history"));
commerceEls.archiveCompleted?.addEventListener("click", () => archiveCompletedCommerceJobs().catch((err) => alert(err.message)));
commerceEls.openGallery?.addEventListener("click", () => setCommerceTab("gallery"));
commerceEls.resultPageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.commerceResultPage || "";
    if (action === "prev") commerceResultPage = Math.max(1, commerceResultPage - 1);
    if (action === "next") commerceResultPage += 1;
    renderCommerceGallery();
  });
});
commerceEls.pageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.commercePage || "";
    if (action === "gallery-prev") commerceGalleryPage = Math.max(1, commerceGalleryPage - 1);
    if (action === "gallery-next") commerceGalleryPage += 1;
    if (action === "history-prev") commerceHistoryPage = Math.max(1, commerceHistoryPage - 1);
    if (action === "history-next") commerceHistoryPage += 1;
    renderCommerceState();
  });
});
commerceEls.historyFilters.forEach((button) => {
  button.addEventListener("click", () => {
    commerceHistoryStatus = button.dataset.commerceStatus || "all";
    commerceHistoryPage = 1;
    commerceEls.historyFilters.forEach((item) => item.classList.toggle("active", item === button));
    renderCommerceTasks();
  });
});
commerceEls.currentTask?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-commerce-history-action]");
  if (!button) return;
  const item = button.closest("[data-commerce-job-id]");
  const jobId = item?.dataset.commerceJobId || "";
  if (button.dataset.commerceHistoryAction === "retry") {
    retryJobs([jobId]);
  } else if (button.dataset.commerceHistoryAction === "archive") {
    archiveCommerceJob(jobId, true).catch((err) => alert(err.message));
  } else if (button.dataset.commerceHistoryAction === "delete") {
    deleteCommerceJob(jobId).catch((err) => alert(err.message));
  }
});
commerceEls.recentTasks?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-commerce-history-action]");
  if (!button) return;
  const item = button.closest("[data-commerce-job-id]");
  const jobId = item?.dataset.commerceJobId || "";
  if (button.dataset.commerceHistoryAction === "select") {
    commerceSelectedJobId = jobId;
    renderCommerceTasks();
  } else if (button.dataset.commerceHistoryAction === "retry") {
    retryJobs([jobId]);
  } else if (button.dataset.commerceHistoryAction === "archive") {
    archiveCommerceJob(jobId, true).catch((err) => alert(err.message));
  } else if (button.dataset.commerceHistoryAction === "delete") {
    deleteCommerceJob(jobId).catch((err) => alert(err.message));
  }
});
commerceEls.historyList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-commerce-history-action]");
  if (!button) return;
  const item = button.closest("[data-commerce-job-id]");
  const jobId = item?.dataset.commerceJobId || "";
  if (button.dataset.commerceHistoryAction === "select") {
    commerceSelectedJobId = jobId;
    setCommerceTab("workspace");
  } else if (button.dataset.commerceHistoryAction === "retry") {
    retryJobs([jobId]);
  } else if (button.dataset.commerceHistoryAction === "archive") {
    archiveCommerceJob(jobId, true).catch((err) => alert(err.message));
  } else if (button.dataset.commerceHistoryAction === "restore") {
    archiveCommerceJob(jobId, false).catch((err) => alert(err.message));
  } else if (button.dataset.commerceHistoryAction === "delete") {
    deleteCommerceJob(jobId).catch((err) => alert(err.message));
  }
});
els.closeMediaPreview?.addEventListener("click", () => setMediaPreview(false));
els.mediaPreviewModal?.addEventListener("click", (event) => {
  if (event.target === els.mediaPreviewModal) setMediaPreview(false);
});
els.mediaPreviewImageWrap?.addEventListener("wheel", (event) => {
  if (els.mediaPreviewModal?.classList.contains("hidden")) return;
  event.preventDefault();
  const nextScale = clampMediaPreviewScale(mediaPreviewScale * (event.deltaY < 0 ? 1.12 : 0.88));
  if (nextScale <= 1.01) {
    mediaPreviewScale = 1;
    mediaPreviewTranslate = { x: 0, y: 0 };
  } else {
    mediaPreviewScale = nextScale;
  }
  syncMediaPreviewTransform();
}, { passive: false });
els.mediaPreviewImageWrap?.addEventListener("dblclick", () => resetMediaPreviewTransform());
els.mediaPreviewImageWrap?.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  mediaPreviewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  els.mediaPreviewImageWrap.setPointerCapture?.(event.pointerId);
  if (mediaPreviewPointers.size === 2) {
    const points = [...mediaPreviewPointers.values()];
    mediaPreviewPinch = {
      startDistance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      startScale: mediaPreviewScale,
    };
    mediaPreviewDrag = null;
  } else if (mediaPreviewScale > 1) {
    mediaPreviewDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: mediaPreviewTranslate.x,
      baseY: mediaPreviewTranslate.y,
    };
    els.mediaPreviewImageWrap.classList.add("dragging");
    if (els.mediaPreviewImage) els.mediaPreviewImage.style.cursor = "grabbing";
  }
  event.preventDefault();
});
els.mediaPreviewImageWrap?.addEventListener("pointermove", (event) => {
  if (mediaPreviewPointers.has(event.pointerId)) {
    mediaPreviewPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  if (mediaPreviewPinch && mediaPreviewPointers.size >= 2) {
    const points = [...mediaPreviewPointers.values()];
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    mediaPreviewScale = clampMediaPreviewScale(mediaPreviewPinch.startScale * (distance / Math.max(1, mediaPreviewPinch.startDistance)));
    if (mediaPreviewScale <= 1.01) {
      mediaPreviewScale = 1;
      mediaPreviewTranslate = { x: 0, y: 0 };
    }
    syncMediaPreviewTransform();
    event.preventDefault();
    return;
  }
  if (!mediaPreviewDrag || mediaPreviewDrag.pointerId !== event.pointerId) return;
  mediaPreviewTranslate = {
    x: mediaPreviewDrag.baseX + event.clientX - mediaPreviewDrag.startX,
    y: mediaPreviewDrag.baseY + event.clientY - mediaPreviewDrag.startY,
  };
  syncMediaPreviewTransform();
});
const finishMediaPreviewDrag = (event) => {
  mediaPreviewPointers.delete(event.pointerId);
  els.mediaPreviewImageWrap?.releasePointerCapture?.(event.pointerId);
  if (mediaPreviewPointers.size < 2) mediaPreviewPinch = null;
  if (mediaPreviewDrag?.pointerId === event.pointerId || !mediaPreviewPointers.size) {
    els.mediaPreviewImageWrap?.classList.remove("dragging");
    mediaPreviewDrag = null;
  }
  syncMediaPreviewTransform();
};
els.mediaPreviewImageWrap?.addEventListener("pointerup", finishMediaPreviewDrag);
els.mediaPreviewImageWrap?.addEventListener("pointercancel", finishMediaPreviewDrag);
els.newTask.addEventListener("click", () => {
  selectedHistoryJobId = NEW_TASK_DRAFT_ID;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
  persistHistorySelection(false);
  els.prompt.value = "";
  els.title.value = "";
  selectedReferenceIds.clear();
  referenceAspectAutoValue = "";
  referenceAspectAutoEnabled = true;
  renderReferences();
  renderState();
  syncSummary();
});
els.refreshModels.addEventListener("click", refreshModels);
els.modelFilter.addEventListener("input", () => renderAvailableModels());
els.apiKey.addEventListener("input", scheduleAutoRefreshModels);
els.apiUrl.addEventListener("input", () => {
  syncTextModelFields();
  scheduleAutoRefreshModels();
});
els.reuseTextApiUrl?.addEventListener("change", () => {
  syncTextModelFields();
  scheduleTextModelRefresh({ immediate: true });
});
els.reuseTextApiKey?.addEventListener("change", () => {
  syncTextModelFields();
  scheduleTextModelRefresh({ immediate: true });
});
els.textApiUrl?.addEventListener("input", scheduleTextModelRefresh);
els.textApiKey?.addEventListener("input", scheduleTextModelRefresh);
els.rememberApiKey.addEventListener("change", saveApiKeyPreference);
els.poolLoginButton?.addEventListener("click", loginPoolUser);
els.poolLogoutButton?.addEventListener("click", logoutPoolUser);
els.poolPassword?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginPoolUser();
});
els.poolUsername?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loginPoolUser();
});
els.presetButton.addEventListener("click", () => setPresetPanel(els.presetPanel?.classList.contains("hidden")));
els.closePresetPanel?.addEventListener("click", () => setPresetPanel(false));
els.quickConfigButton?.addEventListener("click", () => setQuickConfigPanel(els.quickConfigPanel?.classList.contains("hidden")));
els.closeQuickConfig?.addEventListener("click", () => setQuickConfigPanel(false));
[
  [els.quickCount, els.count],
  [els.quickAspect, els.aspectRatio],
  [els.quickResolution, els.resolution],
  [els.quickQuality, els.quality],
  [els.quickFormat, els.outputFormat],
].forEach(([quick, source]) => {
  const syncQuickValue = (commit = false) => {
    if (quick === els.quickAspect && !referenceAspectSyncing && referenceAspectCandidate()) {
      referenceAspectAutoEnabled = false;
      referenceAspectAutoValue = "";
    }
    source.value = quick.value;
    if (source === els.count) {
      syncConcurrencyToCount({ commit });
      if (commit) quick.value = source.value;
    }
    syncSummary();
  };
  quick?.addEventListener("input", () => syncQuickValue(false));
  quick?.addEventListener("change", () => syncQuickValue(true));
  if (source === els.count) {
    quick?.addEventListener("blur", () => syncQuickValue(true));
  }
});
els.optimizePrompt?.addEventListener("click", optimizePromptLocal);
els.recommendParams?.addEventListener("click", recommendParamsLocal);
els.predictFailure?.addEventListener("click", predictFailureLocal);
els.enhanceStyle?.addEventListener("click", enhanceStyleLocal);
els.closePromptAnalysis?.addEventListener("click", closePromptAnalysis);
els.applyOptimizedPrompt?.addEventListener("click", applyOptimizedPrompt);
els.applyOptimizedParams?.addEventListener("click", applyRecommendedParams);
els.continueOriginalPrompt?.addEventListener("click", continueOriginalPrompt);
els.copyOptimizedPrompt?.addEventListener("click", copyOptimizedPrompt);
els.preflightRunAi?.addEventListener("click", runPreflightAiAnalysis);
els.sendOptimize?.addEventListener("change", () => {
  localStorage.setItem(SEND_OPTIMIZE_KEY, els.sendOptimize.checked ? "1" : "0");
});
els.stopAutoGenerate?.addEventListener("click", stopPreflight);
els.agentEntry.addEventListener("click", () => setAgentPanel(true));
els.agentClearButton?.addEventListener("click", disableSelectedAgent);
els.agentAppliedStatus?.querySelector("button")?.addEventListener("click", disableSelectedAgent);
els.agentModeToggle.addEventListener("click", () => {
  agentModeEnabled = !agentModeEnabled;
  syncAgentMode();
  syncSummary();
});
els.closeAgentMode?.addEventListener("click", () => {
  agentModeEnabled = false;
  syncAgentMode();
  syncSummary();
});
els.expandAdvanced.addEventListener("click", () => {
  agentComposerExpanded = !agentComposerExpanded;
  syncAgentComposer();
});
els.closeAgentPanel.addEventListener("click", () => setAgentPanel(false));
els.cancelAgent.addEventListener("click", () => setAgentPanel(false));
els.applyAgent.addEventListener("click", generateAgentPlan);
els.applyStableAgent.addEventListener("click", () => applyAgentVariant("stable"));
els.applyCreativeAgent.addEventListener("click", () => applyAgentVariant("creative"));
els.applyCommercialAgent.addEventListener("click", () => applyAgentVariant("commercial"));
els.regenerateAgent.addEventListener("click", generateAgentPlan);
els.disableAgent.addEventListener("click", disableSelectedAgent);
els.model?.addEventListener("change", () => {
  if (els.model.value) localStorage.setItem(SELECTED_IMAGE_MODEL_KEY, els.model.value);
  syncResearchImageModelOptions(verifiedImageModels);
});
els.analysisModel?.addEventListener("change", () => {
  if (els.analysisModel.value) localStorage.setItem(SELECTED_TEXT_MODEL_KEY, els.analysisModel.value);
  syncResearchTextModelOptions(verifiedTextModels);
});
els.manualTextModel?.addEventListener("input", () => {
  localStorage.setItem(MANUAL_TEXT_MODEL_KEY, els.manualTextModel.value.trim());
  syncResearchTextModelOptions(verifiedTextModels);
  scheduleTextModelRefresh();
});
els.researchTextModel?.addEventListener("change", () => {
  const value = els.researchTextModel.value;
  if (value && els.analysisModel && cleanTextModelList(verifiedTextModels).includes(value)) {
    els.analysisModel.value = value;
    localStorage.setItem(SELECTED_TEXT_MODEL_KEY, value);
  }
});
els.agentWorkspace.addEventListener("click", (event) => {
  const target = event.target.closest("[data-agent-variant]");
  if (target) previewAgentVariantCard(target.dataset.agentVariant);
});
els.agentWorkspace.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-agent-variant]");
  if (!target) return;
  event.preventDefault();
  previewAgentVariantCard(target.dataset.agentVariant);
});
els.agentModal.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-custom-agent]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteCustomAgent(deleteButton.dataset.deleteCustomAgent);
    return;
  }
  if (event.target === els.agentModal) setAgentPanel(false);
});
els.connectionStatus.addEventListener("click", () => showGuide(0));
els.skipGuide.addEventListener("click", () => hideGuide(true));
els.guideConfig.addEventListener("click", () => {
  els.appShell.classList.add("settings-open");
  syncShellToggles();
  showGuide(0);
});
els.nextGuide.addEventListener("click", () => {
  if (guideStep >= guideSteps.length - 1) {
    hideGuide(true);
    return;
  }
  showGuide(guideStep + 1);
});
function syncShellToggles() {
  els.toggleLeft?.classList.toggle("active", els.appShell?.classList.contains("left-open"));
  els.toggleConfig?.classList.toggle("active", els.appShell?.classList.contains("settings-open"));
  if (els.mobileShellBackdrop) {
    const isMobile = window.matchMedia("(max-width: 780px)").matches;
    const showBackdrop = isMobile && (
      els.appShell?.classList.contains("left-open") ||
      els.appShell?.classList.contains("settings-open")
    );
    els.mobileShellBackdrop.hidden = !showBackdrop;
  }
}

els.toggleLeft.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 780px)").matches) {
    els.appShell.classList.remove("settings-open");
  }
  els.appShell.classList.toggle("left-open");
  syncShellToggles();
});
els.collapseLeft.addEventListener("click", () => {
  els.appShell.classList.remove("left-open");
  syncShellToggles();
});
els.toggleConfig.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 780px)").matches) {
    els.appShell.classList.remove("left-open");
  }
  els.appShell.classList.toggle("settings-open");
  syncShellToggles();
});
els.collapseRight.addEventListener("click", () => {
  els.appShell.classList.toggle("settings-open");
  syncShellToggles();
});
els.mobileShellBackdrop?.addEventListener("click", () => {
  els.appShell?.classList.remove("left-open");
  els.appShell?.classList.remove("settings-open");
  syncShellToggles();
});
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    location.hash = link.getAttribute("href");
    applyRoute();
  });
});

window.addEventListener("hashchange", applyRoute);
window.addEventListener("resize", () => {
  if (!els.guideOverlay?.classList.contains("hidden")) alignGuideTarget();
});
loadApiKeyPreference();
clearLegacyDefaultNegative();
applyModelConfigToUi();
setConnectionMode(localStorage.getItem(CONNECTION_MODE_STORAGE_KEY) || "custom");
replaceTextModelOptions([]);
loadCommerceTemplates();
syncCommerceFromMain();
syncCommercePrompt({ force: true });
loadCommerceAnalysisState();
if (els.count && (!els.count.value || els.count.value === "4")) els.count.value = "1";
syncShellToggles();
loadCustomIndustryAgents();
syncAgentEntry();
syncAgentMode();
syncAgentComposer();
initResearchWorkbench();
if (!location.hash) location.hash = "#home";
applyRoute();
loadState().then(() => {
  if (selectedApiKey() || adminDebugApiActive()) {
    scheduleAutoRefreshModels();
  } else {
    renderAvailableModels();
    replaceModelOptions([]);
  }
}).catch((err) => {
  setModelStatus(`加载状态失败：${err.message}`, "error");
}).finally(() => {
  scheduleStateRefresh();
});
syncSummary();
window.setTimeout(() => maybeAutoShowGuide(location.hash || "#home"), 650);
