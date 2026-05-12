let state = { jobs: [], media: [], subjects: [], references: [], presets: [], models: [] };
let selectedReferenceIds = new Set();
let selectedGalleryIds = new Set();
let selectedHistoryJobId = null;
let selectedHistoryDayKey = null;
let historyExpanded = true;
const historyDayOpen = new Map();
const historyIndustryOpen = new Map();
const NEW_TASK_DRAFT_ID = "__new_task__";

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
  stopAutoGenerate: $("#stopAutoGenerate"),
  promptScore: $("#promptScore"),
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
let verifiedImageModels = [];
let autoModelTimer = 0;
let modelRequestId = 0;
let selectedAgent = null;
let agentModeEnabled = false;
let agentEnabled = false;
let agentGenerated = false;
let agentPlan = null;
let agentPlanRevision = 0;
let appliedAgentVariant = null;
let agentComposerExpanded = false;
let guideStep = 0;
let guideAutoShown = false;
let guideDismissedThisSession = false;
const GUIDE_STORAGE_KEY = "yangyangapi:onboarding:v1:completed";

function currentHistoryJob() {
  if (!selectedHistoryJobId || selectedHistoryJobId === NEW_TASK_DRAFT_ID) return null;
  return state.jobs.find((job) => job.id === selectedHistoryJobId) || null;
}
let preflightTimer = 0;
let preflightOriginalPrompt = "";

function applyRoute() {
  const anchor = location.hash || "#home";
  document.body.classList.toggle("studio-active", anchor === "#studio");
  if (anchor !== "#studio") {
    hideGuide(false);
  }
  const target = document.querySelector(anchor);
  if (target) {
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: anchor === "#studio" ? "auto" : "smooth" });
    });
  }
  maybeAutoShowGuide(anchor);
}

const CLIENT_ID_STORAGE_KEY = "yangyang_image_client_id";

function ensureClientId() {
  const cached = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (cached) return cached;
  const randomId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const value = `yy-${randomId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, value);
  return value;
}

const clientId = ensureClientId();

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
  return state.jobs.filter((job) => historyDayKey(job.created_at) === dayKey);
}

function statusText(status) {
  return { queued: "排队", running: "生成中", success: "完成", error: "失败" }[status] || status;
}

const protocols = {
  "custom-openai": {
    label: "OpenAI 兼容",
    shortLabel: "兼容协议",
    description: "适合第三方中转或自建 OpenAI 风格图片接口",
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
const CUSTOM_API_URL_KEY = "yangyang_image_custom_api_url";

const connectionNotes = {
  proxy: modelConnections.proxy?.description || "中转代理线路，可在后台或环境变量 CONNECTION_PROXY_URL 中配置。",
  local: modelConnections.local?.description || "本地接入线路，可在后台或环境变量 CONNECTION_LOCAL_URL 中配置。",
  direct: modelConnections.direct?.description || "浏览器直连线路，可在后台或环境变量 CONNECTION_DIRECT_URL 中配置。",
  auto: modelConnections.auto?.description || "自动模式会按后台配置顺序尝试可用线路。",
  pool: modelConnections.pool?.description || "本地号池模式不需要填写 API Key，会从管理员号池中挑选可用账号生成图片。",
  custom: modelConnections.custom?.description || "自定义 API 模式用于临时接入第三方中转站或其他 OpenAI 兼容地址。",
};

const connectionEndpoints = {
  proxy: modelConnections.proxy?.url || "http://your-server.example.com:3004/v1",
  local: modelConnections.local?.url || "http://127.0.0.1:3004/v1",
  direct: modelConnections.direct?.url || "https://your-newapi.example.com/v1",
  auto: modelConnections.auto?.label || "自动选择",
  pool: modelConnections.pool?.label || "使用本地号池，无需 API URL",
  custom: modelConnections.custom?.url || "",
};
const modelProfiles = Array.isArray(modelConfig.model_profiles) ? modelConfig.model_profiles : [];
const modelProfileMap = new Map(modelProfiles.map((item) => [item.id, item]));
if (modelConfig.connections) {
  Object.entries(modelConfig.connections).forEach(([key, item]) => {
    const label = item.label || key;
    const badge = item.badge ? ` ${item.badge}` : "";
    if (key !== "auto" && item.url) connectionEndpoints[key] = item.url;
    if (key === "auto") {
      const order = Array.isArray(modelConfig.auto_order) ? modelConfig.auto_order : ["local", "proxy", "direct"];
      connectionEndpoints.auto = `自动选择：${order.map((mode) => modelConfig.connections?.[mode]?.label || mode).join(" → ")}`;
    }
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
  "16:9": "1792x1024",
  "21:9": "1792x768",
  "9:21": "768x1792",
  "4:1": "2048x512",
  "1:4": "512x2048",
  "8:1": "2048x256",
  "1:8": "256x2048",
};

const resolutionMultipliers = { "1K": 1, "2K": 2, "4K": 4 };

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

function requestSize() {
  const baseSize = aspectSizes[els.aspectRatio.value] || aspectSizes["1:1"];
  const multiplier = resolutionMultipliers[els.resolution.value] || 1;
  if (multiplier === 1) return baseSize;
  const [width, height] = baseSize.split("x").map(Number);
  return `${Math.round(width * multiplier)}x${Math.round(height * multiplier)}`;
}

function describeAspect() {
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
    "21:9": "超宽视觉横幅",
    "9:21": "长竖屏沉浸构图",
    "4:1": "横向长图 Banner",
    "1:4": "纵向长图物料",
    "8:1": "超长横幅",
    "1:8": "超长竖幅",
  };
  return labels[els.aspectRatio.value] || "按当前模型合法尺寸发送";
}

function describeResolution() {
  const descriptions = {
    "1K": ["速度优先，适合批量预览", "当前模型会优先使用上游合法 size，避免不合法尺寸报错"],
    "2K": ["细节更稳，适合正式方案筛选", "会按当前比例放大请求尺寸，失败时建议回到 1K"],
    "4K": ["高细节输出，适合最终物料", "仅在上游模型支持时使用，成本和耗时更高"],
  };
  return descriptions[els.resolution.value] || descriptions["1K"];
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

function quickConfigTitle() {
  return `打开生成配置：${els.count.value}张 · ${els.aspectRatio.value} · ${els.resolution.value} · ${requestSize()} · ${els.outputFormat.value.toUpperCase()} · 并发 ${els.concurrency.value}`;
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

function setQuickConfigPanel(open) {
  syncQuickConfigControls();
  els.quickConfigPanel?.classList.toggle("hidden", !open);
  els.composer?.classList.toggle("quick-config-open", open);
}

function syncSummary() {
  const protocol = protocols[els.protocol.value] || protocols["custom-openai"];
  const hasPrompt = Boolean(els.prompt.value.trim());
  els.composer?.classList.toggle("has-prompt", hasPrompt);
  els.compatLabel.textContent = els.model.value || "未选择";
  els.protocolTitle.textContent = protocol.shortLabel;
  els.protocolDescription.textContent = protocol.description;
  els.protocolSupport.textContent = protocol.support;
  els.connectionNote.textContent = connectionNotes[els.connectionMode.value] || connectionNotes.proxy;
  els.protocolSummary.textContent = `${protocol.shortLabel} · ${requestSize()}`;
  els.countSummary.textContent = `${els.count.value}张 · ${els.aspectRatio.value} · ${els.resolution.value} · ${els.outputFormat.value.toUpperCase()}`;
  if (els.quickConfigButton) {
    els.quickConfigButton.textContent = `☷ ${els.count.value}张 ${els.aspectRatio.value} ${els.resolution.value}`;
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
  [els.optimizePrompt, els.recommendParams, els.predictFailure, els.enhanceStyle].forEach((button) => {
    if (button) button.disabled = !hasPrompt;
  });
  syncQuickConfigControls();
}

function setConnectionMode(mode) {
  els.connectionMode.value = mode;
  els.connectionMode.setAttribute("value", mode);
  els.connectionButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.connectionMode === mode);
  });
  if (mode === "custom") {
    els.apiUrl.value = localStorage.getItem(CUSTOM_API_URL_KEY) || connectionEndpoints.custom || "";
  } else if (connectionEndpoints[mode]) {
    els.apiUrl.value = connectionEndpoints[mode];
  }
  els.apiUrl.readOnly = mode === "auto" || mode === "pool";
  if (els.apiKey) {
    els.apiKey.disabled = mode === "pool";
    els.apiKey.placeholder = mode === "pool" ? "本地号池无需 API Key" : "sk-... 或 New API Token";
  }
  if (els.apiUrl) {
    els.apiUrl.placeholder = mode === "custom" ? "填写第三方中转站或 OpenAI 兼容 API 地址" : "OpenAI 兼容 API 地址";
  }
  if (els.rememberApiKey) {
    els.rememberApiKey.disabled = mode === "pool";
  }
  renderPoolUser();
  syncSummary();
}

function selectedApiUrl() {
  return els.connectionMode.value === "auto" || els.connectionMode.value === "pool" ? "" : els.apiUrl.value.trim();
}

function selectedApiKey() {
  return els.connectionMode.value === "pool" ? "" : els.apiKey.value.trim();
}

function loadApiKeyPreference() {
  const saved = localStorage.getItem("yangyang_image_api_key") || "";
  if (saved) {
    els.apiKey.value = saved;
    els.rememberApiKey.checked = true;
  }
}

function saveApiKeyPreference() {
  if (els.connectionMode.value === "pool") return;
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
  els.modelFetchHelp.textContent = message || "API Key 可在 New API 后台的“令牌”里创建或复制；如果浏览器直连读取失败，优先切到“自动”或“中转代理”。";
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
  if (name) {
    return {
      id: id || `agent:${name}`,
      name,
      variant: String(job.agent_variant || "").trim(),
      source: "agent",
    };
  }
  const haystack = `${job.title || ""}\n${job.prompt || ""}`.toLowerCase();
  const matched = industryAgents.find((agent) => {
    const agentName = String(agent.name || "").toLowerCase();
    return agentName && haystack.includes(agentName);
  });
  if (matched) {
    return { id: matched.id, name: matched.name, variant: "", source: "inferred" };
  }
  return { id: "general", name: "通用生图", variant: "", source: "general" };
}

function historyIndustryKey(dayKey, industry) {
  return `${dayKey}:${industry.id || industry.name}`;
}

function restoreAgentFromJob(job) {
  const matched = industryAgents.find((agent) => agent.id === job.agent_id || agent.name === job.agent_name);
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

function formatModelTime() {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function replaceModelOptions(models) {
  const current = els.model.value;
  els.model.innerHTML = "";
  if (!models.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "未检测到生图模型";
    els.model.append(option);
    els.model.disabled = true;
    els.submitJob.disabled = true;
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
  if (!models.includes(current) && models[0]) {
    els.model.value = models[0];
  }
  syncSummary();
}

function renderAvailableModels(models = verifiedImageModels) {
  if (!els.availableModelList) return;
  const query = (els.modelFilter?.value || "").trim().toLowerCase();
  const filtered = models.filter((model) => !query || model.toLowerCase().includes(query));
  els.availableModelList.innerHTML = "";
  if (!filtered.length) {
    els.availableModelList.innerHTML = '<div class="empty-model-list">暂无可用生图模型</div>';
    return;
  }
  for (const model of filtered) {
    const profile = modelProfileMap.get(model) || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = `available-model-item ${model === els.model.value ? "selected" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(profile.title || model)}</strong>
      <span>${escapeHtml(profile.description || model)}</span>
      <small>${escapeHtml(profile.tag || "生图模型")}</small>
    `;
    button.addEventListener("click", () => {
      els.model.value = model;
      syncSummary();
      renderAvailableModels();
    });
    els.availableModelList.append(button);
  }
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
  for (const agent of industryAgents) {
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
      selectedAgent = agent;
      agentGenerated = false;
      agentPlan = null;
      agentPlanRevision = 0;
      agentEnabled = false;
      appliedAgentVariant = null;
      agentComposerExpanded = true;
      syncAgentEntry();
      syncAgentComposer();
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

function renderAgentList() {
  els.agentList.innerHTML = "";
  for (const agent of industryAgents) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `agent-list-item ${selectedAgent?.id === agent.id ? "selected" : ""}`;
    button.innerHTML = `
      <span>${escapeHtml(agent.icon)}</span>
      <div>
        <strong>${escapeHtml(agent.name)}</strong>
        <small>${escapeHtml(agent.meta)}</small>
      </div>
      <em>›</em>
    `;
    button.addEventListener("click", () => {
      selectedAgent = agent;
      agentGenerated = false;
      agentPlan = null;
      agentPlanRevision = 0;
      agentEnabled = false;
      appliedAgentVariant = null;
      syncAgentEntry();
      syncAgentComposer();
      renderAgentPanel();
    });
    els.agentList.append(button);
  }
}

function renderAgentEmpty() {
  els.agentWorkspace.innerHTML = `
    <div class="agent-empty-select">
      <span>✣</span>
      <strong>先选择一个行业 Agent</strong>
      <p>默认不启用行业工作流。选择左侧行业后，系统会自动填入行业默认目标、比例、张数和负面提示词。</p>
    </div>
  `;
  setAgentFooter("empty");
}

function renderAgentForm() {
  const fields = selectedAgent.fields || {};
  const optionHtml = (items = []) => items.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join("");
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
          <input id="agentSubject" value="${escapeAttr(fields.subject || selectedAgent.name)}">
        </label>
        <label>
          <span>${escapeHtml(fields.materialLabel || "材质 / 风格")}</span>
          <input id="agentMaterial" value="${escapeAttr(fields.material || "")}">
        </label>
        <label class="agent-wide-field">
          <span>核心卖点</span>
          <textarea id="agentSellingPoint" rows="2">${escapeHtml(fields.sellingPoint || selectedAgent.prompt)}</textarea>
        </label>
        <label>
          <span>${escapeHtml(fields.sceneLabel || "使用场景")}</span>
          <select id="agentScene">${optionHtml(fields.sceneOptions || selectedAgent.goals)}</select>
        </label>
        <label>
          <span>${escapeHtml(fields.platformLabel || "目标平台")}</span>
          <select id="agentPlatform">${optionHtml(fields.platformOptions || selectedAgent.goals)}</select>
        </label>
        <label>
          <span>${escapeHtml(fields.holdLabel || "留白位置")}</span>
          <select id="agentHold">${optionHtml(fields.holdOptions || ["不需要", "顶部留白", "右侧留白"])}</select>
        </label>
      </div>
      <div class="agent-tag-cloud">
        ${(fields.tags || selectedAgent.goals).map((goal) => `<span>${escapeHtml(goal)}</span>`).join("")}
      </div>
    </div>
  `;
  setAgentFooter("form");
}

function readAgentValues() {
  const fields = selectedAgent.fields || {};
  return {
    subject: $("#agentSubject")?.value.trim() || fields.subject || selectedAgent.name,
    material: $("#agentMaterial")?.value.trim() || fields.material || "",
    sellingPoint: $("#agentSellingPoint")?.value.trim() || fields.sellingPoint || selectedAgent.prompt,
    scene: $("#agentScene")?.value.trim() || fields.sceneOptions?.[0] || selectedAgent.goals?.[0] || "",
    platform: $("#agentPlatform")?.value.trim() || fields.platformOptions?.[0] || selectedAgent.goals?.[0] || "",
    hold: $("#agentHold")?.value.trim() || "不需要",
  };
}

function buildAgentPrompt(variant = "stable", values = agentPlan?.values || readAgentValues(), revision = 1) {
  const fields = selectedAgent.fields || {};
  const delivery = (selectedAgent.goals || ["业务场景"]).join(" / ");
  const businessGoal = `生成可直接用于${delivery}的高质感${selectedAgent.name === "电商商品图" ? "商业摄影图" : selectedAgent.name}。`;
  const sceneLine = `${values.scene}${selectedAgent.id === "commerce" ? "电商主图，干净浅灰背景，商品完整居中" : "，主体明确，画面干净，有明确视觉中心"}。`;
  const variantStrategies = {
    stable: `主体为${values.subject}，产品完整清晰，占据画面中心，干净浅灰背景，柔和双侧棚拍布光，真实材质纹理，边缘清晰，轻微自然投影。`,
    creative: `保持主体结构真实，加入更强场景叙事、氛围光和记忆点，让画面更适合传播，但不喧宾夺主。`,
    commercial: `强调广告可交付质感，卖点可视化，背景克制，构图适合${delivery}和品牌页面复用。`,
  };
  const tags = (fields.tags || selectedAgent.goals || []).slice(0, 8).join("，");
  const checks = (fields.tags || [])
    .filter((item) => item.startsWith("验收："))
    .map((item) => item.replace("验收：", ""))
    .join("；") || "主体完整清晰；比例正确；材质真实；背景干净；适合投放平台";
  return [
    `行业类型：${selectedAgent.name}，${delivery}`,
    `业务目标：${businessGoal}`,
    `主体：${values.subject}`,
    `使用场景：${sceneLine}`,
    `目标受众：电商运营、品牌营销和正在浏览内容的潜在买家。`,
    `业务信息：商品名称：${values.subject}；材质 / 颜色：${values.material || "按行业默认"}；核心卖点：${values.sellingPoint}；使用场景：${values.scene}；目标平台：${values.platform}；留白位置：${values.hold}。`,
    `平台/比例约束：${selectedAgent.aspectRatio}，画面可直接用于${delivery}。`,
    `构图：主体清晰，视觉中心明确，保留必要文案区或平台安全区。`,
    `光线：真实自然，符合${selectedAgent.name}的专业摄影语言。`,
    `背景：干净、有层次，不干扰主体。`,
    tags ? `镜头/材质/细节：${tags}。` : "",
    `提示词蓝图：主体 + 材质细节 + 平台用途 + 专业布光 + 干净背景 + 主体占比 + 可交付视觉。`,
    revision > 1 ? `重新生成要求：第 ${revision} 版，保持业务信息不变，但更换构图节奏、光线重点和画面卖点表达，避免和上一版重复。` : "",
    `版本策略：${variantStrategies[variant]}`,
    `负面控制：${selectedAgent.negative}`,
    `交付标准：${checks}。高细节，真实光影，专业商业视觉，可交付成片。`,
  ].filter(Boolean).join("\n");
}

function makeAgentPlan(valuesOverride = null, revision = 1) {
  const values = valuesOverride || readAgentValues();
  const delivery = (selectedAgent.goals || ["业务场景"]).join("、");
  const targetName = selectedAgent.id === "commerce" ? "商业摄影图" : selectedAgent.name;
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
    `风格关键词：${tags}。`,
    `质量检查：${checks}。`,
  ].join("\n");
  return {
    values,
    revision,
    brief,
    variants: [
      { id: "stable", title: revision > 1 ? `稳定版 R${revision}` : "稳定版", prompt: buildAgentPrompt("stable", values, revision) },
      { id: "creative", title: revision > 1 ? `创意版 R${revision}` : "创意版", prompt: buildAgentPrompt("creative", values, revision) },
      { id: "commercial", title: revision > 1 ? `商业版 R${revision}` : "商业版", prompt: buildAgentPrompt("commercial", values, revision) },
    ],
  };
}

function renderAgentGenerated() {
  const fields = selectedAgent.fields || {};
  const values = agentPlan.values;
  const variantCards = agentPlan.variants.map((variant) => `
    <article class="agent-variant-card" data-agent-variant="${escapeAttr(variant.id)}" role="button" tabindex="0">
      <strong>${escapeHtml(variant.title)}</strong>
      <p>${escapeHtml(variant.prompt).replace(/\n/g, "<br>")}</p>
      <button type="button" data-agent-variant="${escapeAttr(variant.id)}">应用到提示词，可继续编辑</button>
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
        <span>已按「${escapeHtml(selectedAgent.name)}」补全行业摄影语言、比例、负面提示词和质量检查项。</span>
        <span>选择 variant 后系统会把提示词填入输入框，你可以继续编辑再点击生成。</span>
      </div>
      <div class="agent-form-grid agent-form-grid-compact">
        <label><span>${escapeHtml(fields.subjectLabel || "主题名称 · 建议")}</span><input value="${escapeAttr(values.subject)}" readonly></label>
        <label><span>${escapeHtml(fields.materialLabel || "材质 / 风格")}</span><input value="${escapeAttr(values.material)}" readonly></label>
        <label class="agent-wide-field"><span>核心卖点</span><textarea rows="2" readonly>${escapeHtml(values.sellingPoint)}</textarea></label>
      </div>
    </div>
  `;
  setAgentFooter("generated");
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

function generateAgentPlan() {
  if (!selectedAgent) return;
  const values = agentPlan?.values || null;
  agentPlanRevision += 1;
  agentPlan = makeAgentPlan(values, agentPlanRevision);
  agentGenerated = true;
  renderAgentPanel();
}

function applyAgentVariant(variantId = "stable") {
  if (!selectedAgent || !agentPlan) return;
  const variant = agentPlan.variants.find((item) => item.id === variantId) || agentPlan.variants[0];
  els.prompt.value = variant.prompt;
  els.aspectRatio.value = selectedAgent.aspectRatio;
  els.count.value = selectedAgent.count;
  if ([...els.quality.options].some((option) => option.value === "high")) {
    els.quality.value = "high";
  }
  els.negative.value = selectedAgent.negative;
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
  const jobs = state.jobs;
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
              <strong>${escapeHtml(job.title || job.prompt || "未命名任务")}</strong>
              <span>${statusText(job.status)} · ${historyTimeLabel(job.created_at)} · ${escapeHtml(job.model || "")}</span>
            `;
            btn.addEventListener("click", () => {
              selectedHistoryJobId = job.id;
              selectedHistoryDayKey = null;
              selectedGalleryIds.clear();
              els.prompt.value = job.prompt || "";
              els.title.value = job.title || "";
              els.model.value = job.model || els.model.value;
              if (job.connection_mode) setConnectionMode(job.connection_mode);
              if (job.api_url && els.connectionMode.value !== "auto") els.apiUrl.value = job.api_url;
              if (job.aspect_ratio) els.aspectRatio.value = job.aspect_ratio;
              if (job.resolution) els.resolution.value = job.resolution;
              els.count.value = job.count || els.count.value;
              if (job.quality) els.quality.value = job.quality;
              if (job.output_format) els.outputFormat.value = job.output_format;
              els.negative.value = job.negative || "";
              restoreAgentFromJob(job);
              syncSummary();
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
  const visibleMedia = selectedHistoryJobId
    ? state.media.filter((media) => media.job_id === selectedHistoryJobId)
    : state.media;
  const visibleJobs = selectedHistoryJobId
    ? state.jobs.filter((job) => job.id === selectedHistoryJobId)
    : state.jobs;
  const mediaItems = visibleMedia.map((media) => ({
    kind: "media",
    id: `media:${media.id}`,
    rawId: media.id,
    jobId: media.job_id || "",
    status: "success",
    title: media.model || "生成图片",
    prompt: media.prompt || "",
    url: media.url,
    index: media.index,
    created_at: media.created_at,
    aspect_ratio: media.aspect_ratio || "1:1",
    resolution: media.resolution || "1K",
    size: media.size || requestSize(),
  }));
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
  const running = state.jobs.filter((job) => job.status === "running").length;
  const queued = state.jobs.filter((job) => job.status === "queued").length;
  const failed = state.jobs.filter((job) => job.status === "error").length;
  const currentJob = currentHistoryJob();
  const retryableFailed = currentJob ? (currentJob.status === "error" ? 1 : 0) : failed;
  const title = currentJob ? `当前任务记录 · 已显示 ${items.length} 条` : `最近生成 · 已显示 ${items.length} 条`;
  els.galleryHeader.classList.remove("hidden");
  els.galleryHeader.innerHTML = `
    <div class="gallery-title">
      <strong>${escapeHtml(title)}</strong>
      <span>运行中 ${running} / 排队 ${queued} / 成功 ${state.media.length} / 失败 ${failed}</span>
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

window.showAllGenerated = function showAllGenerated() {
  selectedHistoryJobId = null;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
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

function renderMedia() {
  const items = galleryItems();
  selectedGalleryIds = new Set([...selectedGalleryIds].filter((id) => items.some((item) => item.id === id)));
  if (els.mediaCount) {
    els.mediaCount.textContent = state.media.length;
  }
  if (els.showAllMedia) {
    const filtered = Boolean(currentHistoryJob()) || selectedHistoryJobId === NEW_TASK_DRAFT_ID;
    els.showAllMedia.classList.toggle("return-all", filtered);
    els.showAllMedia.setAttribute(
      "title",
      filtered ? `当前只显示部分记录，点击显示全部 ${state.media.length} 张` : `已显示全部最近生成 ${state.media.length} 张`
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
    const card = document.createElement("article");
    card.className = `image-card ${item.status} ${selected ? "selected" : ""}`;
    const preview = item.url
      ? `<img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.prompt)}" loading="lazy">`
      : `<div class="failed-preview"><span>!</span><strong>生成失败</strong><div><button type="button" data-card-action="retry">重试</button><button type="button" data-card-action="details">详情</button></div></div>`;
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
        </div>
        ${selectedAgent ? `<div class="image-agent-tag">✣ ${escapeHtml(selectedAgent.name)} ${appliedAgentVariant ? variantLabel(appliedAgentVariant) : ""}</div>` : ""}
        ${item.status === "error" ? `<div class="image-error">${escapeHtml(item.error || "生成失败")}</div>` : ""}
        <p>${escapeHtml(item.prompt || "暂无提示词")}</p>
        <div class="image-actions">
          ${item.url ? `<a href="${escapeAttr(item.url)}" target="_blank" rel="noopener">打开</a><a href="${escapeAttr(item.url)}" download>下载</a>` : ""}
          ${item.status === "error" ? `<button type="button" class="retry" data-card-action="retry">重试</button>` : ""}
          <button type="button" data-card-action="reuse">复用</button>
        </div>
      </div>
    `;
    card.querySelector(".image-select").addEventListener("click", (event) => {
      event.stopPropagation();
      toggleGalleryItem(item.id);
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest("a,button")) return;
      toggleGalleryItem(item.id);
    });
    card.querySelector('[data-card-action="reuse"]')?.addEventListener("click", () => {
      els.prompt.value = item.prompt || "";
      syncSummary();
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
      } else if (selectedReferenceIds.size < 4) {
        selectedReferenceIds.add(ref.id);
      }
      renderReferences();
    });
    els.referenceList.append(btn);
  }
  const selectedRefs = state.references.filter((ref) => selectedReferenceIds.has(ref.id));
  if (els.referenceSendSummary) {
    els.referenceSendSummary.textContent = `将发送参考图 ${selectedRefs.length}/${state.references.length}`;
    els.referenceSendSummary.classList.toggle("hidden", !selectedRefs.length);
  }
  if (!els.composerReferenceList) return;
  els.composerReferenceList.classList.toggle("hidden", !selectedRefs.length);
  selectedRefs.forEach((ref) => {
    const item = document.createElement("article");
    item.className = "composer-reference-item";
    item.innerHTML = `
      <img src="${escapeAttr(ref.url)}" alt="">
      <div>
        <strong>${escapeHtml(ref.name || "参考图")}</strong>
        <span>${escapeHtml(ref.width && ref.height ? `${ref.width} x ${ref.height}` : "参考图")} · ${escapeHtml((ref.mime || "image/png").split("/").pop().toUpperCase())}${ref.size ? ` · ${Math.max(1, Math.round(ref.size / 1024))} KB` : ""}</span>
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
  if (selectedHistoryJobId && selectedHistoryJobId !== NEW_TASK_DRAFT_ID && !state.jobs.some((job) => job.id === selectedHistoryJobId)) {
    selectedHistoryJobId = null;
    selectedGalleryIds.clear();
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
  syncSummary();
}

async function loadState() {
  state = await api("/api/state");
  renderState();
}

function buildVariants() {
  return [];
}

async function performSubmitJob(promptOverride = "") {
  const prompt = (promptOverride || els.prompt.value).trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }
  if (els.connectionMode.value === "pool" && !activePoolUser()) {
    setConnectionStatus("请先登录号池账号", "error");
    setModelStatus("请先登录号池账号", "error");
    els.poolUsername?.focus();
    return;
  }
  saveApiKeyPreference();
  els.submitJob.disabled = true;
  els.submitJob.textContent = "…";
  try {
    const created = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        mode: "single",
        title: els.title.value.trim(),
        prompt,
        model: els.model.value,
        protocol: els.protocol.value,
        connection_mode: els.connectionMode.value,
        api_url: selectedApiUrl(),
        api_key: selectedApiKey(),
        agent_id: selectedAgent?.id || "",
        agent_name: selectedAgent?.name || "",
        agent_variant: appliedAgentVariant || "",
        agent_enabled: Boolean(agentEnabled && selectedAgent),
        aspect_ratio: els.aspectRatio.value,
        resolution: els.resolution.value,
        size: requestSize(),
        quality: els.quality.value,
        output_format: els.outputFormat.value,
        count: Number(els.count.value || 1),
        concurrency: Number(els.concurrency.value || 2),
        retry_limit: Number(els.retryLimit.value || 2),
        seed: els.seed.value.trim(),
        negative: els.negative.value.trim(),
        variants: buildVariants(),
        reference_ids: Array.from(selectedReferenceIds),
        edit_mode: els.editMode.checked,
      }),
    });
    els.prompt.value = prompt;
    selectedHistoryJobId = created?.job?.id || null;
    selectedGalleryIds.clear();
    closePromptAnalysis();
    syncSummary();
    await loadState();
  } catch (err) {
    alert(err.message);
  } finally {
    els.submitJob.disabled = false;
    els.submitJob.textContent = "➤";
  }
}

function stopPreflight() {
  window.clearInterval(preflightTimer);
  preflightTimer = 0;
  els.preflightGenerate?.classList.add("hidden");
  if (!els.applyOptimizedPrompt) return;
  els.applyOptimizedPrompt.textContent = "✣ 应用优化提示词";
  els.applyOptimizedParams.textContent = "☷ 应用推荐参数";
  els.continueOriginalPrompt?.classList.add("hidden");
}

function showPreflightGenerate() {
  preflightOriginalPrompt = els.prompt.value.trim();
  showPromptAnalysis("preflight");
  els.analysisResultTitle.textContent = "已完成预检";
  els.applyOptimizedPrompt.textContent = "✣ 使用优化版生成";
  els.applyOptimizedParams.textContent = "☷ 应用推荐参数";
  els.continueOriginalPrompt?.classList.remove("hidden");
  els.preflightGenerate?.classList.remove("hidden");
  let remaining = 10;
  const total = remaining;
  const agentName = selectedAgent ? `${selectedAgent.name} · ${variantLabel(appliedAgentVariant || "stable")}` : "优化版";
  const tick = () => {
    els.preflightSeconds.textContent = String(remaining);
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

function submitJob() {
  const prompt = els.prompt.value.trim();
  if (!prompt) {
    els.prompt.focus();
    return;
  }
  if (els.sendOptimize?.checked) {
    showPreflightGenerate();
    return;
  }
  performSubmitJob(prompt);
}

async function refreshModels({ silent = false } = {}) {
  if (els.connectionMode.value === "pool") {
    if (!activePoolUser()) {
      verifiedImageModels = [];
      replaceModelOptions([]);
      renderAvailableModels();
      renderPoolUser();
      setConnectionStatus("请先登录号池账号", "idle");
      setModelStatus("请先登录号池账号", "idle");
      setModelFetchHelp("号池模式不需要 API Key，但需要使用后台创建的号池用户登录。", "idle");
      if (!silent) els.poolUsername?.focus();
      return;
    }
    const imageModels = Array.isArray(state.models) ? state.models.filter(isImageModel) : modelProfiles.map((item) => item.id).filter(isImageModel);
    verifiedImageModels = imageModels.length ? imageModels : ["gpt-image-2"];
    replaceModelOptions(verifiedImageModels);
    renderAvailableModels();
    const pool = state.account_pool || {};
    const okCount = Number(pool.ok || 0);
    setConnectionStatus(okCount > 0 ? `本地号池可用 ${okCount} 个账号` : "本地号池暂无可用账号", okCount > 0 ? "success" : "error");
    setModelStatus(`本地号池模式已启用 · ${verifiedImageModels.length} 个生图模型`, okCount > 0 ? "success" : "idle");
    setModelFetchHelp("本地号池不需要 New API Token；如果要走 New API 线路，可在 New API 后台“令牌”页面创建或复制 API Key。", okCount > 0 ? "success" : "idle");
    return;
  }
  if (els.connectionMode.value === "custom" && !selectedApiUrl()) {
    verifiedImageModels = [];
    replaceModelOptions([]);
    renderAvailableModels();
    setModelStatus("ⓘ 填写自定义 API URL 和 API Key 后自动验证", "idle");
    setConnectionStatus("☷ 填写自定义 API URL", "idle");
    setModelFetchHelp("自定义 API 适合临时接入第三方中转站或 OpenAI 兼容接口；地址通常以 /v1 结尾。", "idle");
    if (!silent) els.apiUrl.focus();
    return;
  }
  const apiKey = selectedApiKey();
  if (!apiKey) {
    verifiedImageModels = [];
    replaceModelOptions([]);
    renderAvailableModels();
    setModelStatus("ⓘ 填写 API Key 后自动验证", "idle");
    setConnectionStatus("☷ 填写 API Key 后自动验证", "idle");
    setModelFetchHelp("API Key 可在 New API 后台的“令牌”里创建或复制；填入后会自动读取模型。", "idle");
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
      }),
    });
    if (requestId !== modelRequestId) return;
    const allModels = Array.isArray(data.models) ? data.models : [];
    const imageModels = allModels.filter(isImageModel);
    verifiedImageModels = imageModels;
    replaceModelOptions(imageModels);
    renderAvailableModels();
    state.models = imageModels;
    if (data.api_url && els.connectionMode.value === "auto") {
      els.apiUrl.value = data.api_url;
    }
    setConnectionStatus("⌁ 已连接", "success");
    setModelStatus(`✓ API Key 有效 · ${imageModels.length} 个生图模型 · ${formatModelTime()}`, "success");
    setModelFetchHelp(`已连接：${data.api_url || selectedApiUrl() || "自动线路"}。模型 Token 可在 New API 后台“令牌”页面管理。`, "success");
  } catch (err) {
    if (requestId !== modelRequestId) return;
    verifiedImageModels = [];
    replaceModelOptions([]);
    renderAvailableModels();
    setConnectionStatus("☷ 连接失败", "error");
    const mode = els.connectionMode.value;
    const directHint = mode === "direct"
      ? "浏览器直连域名目前只有 IPv6，局域网或当前网络不支持 IPv6 时会失败；建议切到“自动”或“中转代理”。"
      : mode === "custom"
        ? "自定义 API 要确认地址、Token、模型权限和 OpenAI 兼容路径都正确。"
        : "建议先用“自动”读取；Token 可在 New API 后台“令牌”里创建或复制。";
    setModelStatus(`✕ 读取失败：${err.message}`, "error");
    setModelFetchHelp(`${directHint} 如果仍失败，检查 New API Token 是否有效、是否有模型权限。`, "error");
    if (!silent) {
      els.apiKey.focus();
    }
  } finally {
    if (requestId === modelRequestId) {
      els.refreshModels.disabled = false;
    }
  }
}

async function uploadReference() {
  const file = els.referenceUpload.files && els.referenceUpload.files[0];
  if (!file) return;
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
    alert(data.error || "上传失败");
    return;
  }
  selectedReferenceIds.add(data.reference.id);
  els.referenceUpload.value = "";
  await loadState();
}

async function clearMedia() {
  const activeJob = currentHistoryJob();
  if (activeJob) {
    const title = activeJob.title || activeJob.prompt || "未命名任务";
    if (!confirm(`删除当前任务记录？\n\n${title}\n\n会同时从工作台移除该任务生成的图片记录。`)) return;
    await api("/api/media/delete", {
      method: "POST",
      body: JSON.stringify({ job_ids: [activeJob.id], media_ids: [] }),
    });
    selectedHistoryJobId = null;
    selectedGalleryIds.clear();
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
    await loadState();
    return;
  }
  if (!confirm("确认删除所有会话任务和媒体库记录？\n\n图片文件会保留在 data/media。")) return;
  await api("/api/media/clear", { method: "POST", body: "{}" });
  selectedHistoryJobId = null;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
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
  await loadState();
}

async function clearFailedGallery() {
  await api("/api/media/clear-failed", { method: "POST", body: "{}" });
  selectedGalleryIds.clear();
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
  let lastJobId = null;
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
      lastJobId = created?.job?.id || lastJobId;
    } catch (err) {
      errors.push(`${jobId}: ${err.message}`);
    }
  }
  if (lastJobId) selectedHistoryJobId = lastJobId;
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
      : state.jobs.filter((job) => job.status === "error").map((job) => job.id);
    retryJobs(ids);
  } else if (action === "retry-selected") {
    const ids = [...new Set([...selectedGalleryIds]
      .filter((id) => id.startsWith("job:"))
      .map((id) => id.split(":")[1])
      .filter((id) => state.jobs.some((job) => job.id === id && job.status === "error")))];
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
  return [
    `提示词蓝图：${agentName} + 材质细节 + 平台用途 + 商业棚拍布光 + 干净背景 + 主体占比 + 可交付电商视觉`,
    `版本策略：主体为${subject}，产品完整清晰，占据画面中心，干净浅灰背景，柔和双侧棚拍布光，真实材质纹理，边缘清晰，轻微自然投影。`,
    "负面控制：低清晰度，主体变形，错误文字，杂乱背景，比例失真，廉价模板感，过度锐化，AI伪影，商品变形，过度反光，低质感，道具喧宾夺主",
    "交付标准：商品完整清晰；主体占比明确；材质真实；背景干净；适合电商平台。高细节，真实光影，专业商业视觉，可交付成片。",
    base,
  ].filter(Boolean).join("\n");
}

function setRecommendedParams({ quality = "auto", applyNow = false } = {}) {
  els.aspectRatio.value = selectedAgent?.aspectRatio || "1:1";
  els.resolution.value = "1K";
  els.count.value = "2";
  els.outputFormat.value = "png";
  if ([...els.quality.options].some((option) => option.value === quality)) {
    els.quality.value = quality;
  }
  if (selectedAgent?.negative) {
    els.negative.value = selectedAgent.negative;
  }
  if (applyNow) syncSummary();
}

function showPromptAnalysis(mode = "optimize") {
  const titles = {
    optimize: "提示词优化完成",
    params: "参数推荐完成",
    failure: "失败预判完成",
    style: "风格增强完成",
  };
  const style = mode === "style" ? "high" : "medium";
  setRecommendedParams({ quality: mode === "style" ? "high" : "auto", applyNow: true });
  const optimized = recommendedPromptText();
  els.analysisResultTitle.textContent = titles[mode] || titles.optimize;
  els.promptScore.textContent = "84";
  els.analysisAspect.textContent = els.aspectRatio.value;
  els.analysisSize.textContent = requestSize();
  els.analysisCount.textContent = els.count.value;
  els.analysisStyle.textContent = style;
  els.optimizedPrompt.value = optimized;
  els.promptAnalysisCard.classList.remove("hidden");
  els.composer?.classList.add("analysis-open");
}

function closePromptAnalysis() {
  stopPreflight();
  els.promptAnalysisCard?.classList.add("hidden");
  els.composer?.classList.remove("analysis-open");
}

function applyOptimizedPrompt() {
  if (!els.optimizedPrompt?.value.trim()) return;
  if (preflightTimer) {
    const text = els.optimizedPrompt.value.trim();
    stopPreflight();
    performSubmitJob(text);
    return;
  }
  els.prompt.value = els.optimizedPrompt.value.trim();
  syncSummary();
  els.prompt.focus();
}

function applyRecommendedParams() {
  setRecommendedParams({ quality: els.analysisStyle?.textContent === "high" ? "high" : "auto", applyNow: true });
}

function continueOriginalPrompt() {
  const text = preflightOriginalPrompt || els.prompt.value.trim();
  stopPreflight();
  performSubmitJob(text);
}

async function copyOptimizedPrompt() {
  const text = els.optimizedPrompt?.value.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    els.optimizedPrompt.select();
    document.execCommand("copy");
  }
}

function optimizePromptLocal() {
  showPromptAnalysis("optimize");
}

function recommendParamsLocal() {
  if (selectedAgent) {
    els.aspectRatio.value = selectedAgent.aspectRatio;
    els.negative.value = selectedAgent.negative;
  }
  showPromptAnalysis("params");
}

function predictFailureLocal() {
  showPromptAnalysis("failure");
}

function enhanceStyleLocal() {
  showPromptAnalysis("style");
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

els.prompt.addEventListener("input", syncSummary);
["change", "input"].forEach((eventName) => {
  [els.protocol, els.model, els.apiUrl, els.apiKey, els.rememberApiKey, els.aspectRatio, els.resolution, els.count, els.concurrency, els.retryLimit, els.quality, els.outputFormat, els.seed, els.negative].forEach((el) => el.addEventListener(eventName, syncSummary));
});
els.connectionButtons.forEach((button) => button.addEventListener("click", () => {
  setConnectionMode(button.dataset.connectionMode);
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
els.newTask.addEventListener("click", () => {
  selectedHistoryJobId = NEW_TASK_DRAFT_ID;
  selectedHistoryDayKey = null;
  selectedGalleryIds.clear();
  els.prompt.value = "";
  els.title.value = "";
  selectedReferenceIds.clear();
  renderState();
  syncSummary();
});
els.refreshModels.addEventListener("click", refreshModels);
els.modelFilter.addEventListener("input", () => renderAvailableModels());
els.apiKey.addEventListener("input", scheduleAutoRefreshModels);
els.apiUrl.addEventListener("input", scheduleAutoRefreshModels);
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
  [els.quickConcurrency, els.concurrency],
  [els.quickQuality, els.quality],
  [els.quickFormat, els.outputFormat],
].forEach(([quick, source]) => {
  quick?.addEventListener("input", () => {
    source.value = quick.value;
    syncSummary();
  });
  quick?.addEventListener("change", () => {
    source.value = quick.value;
    syncSummary();
  });
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
els.agentWorkspace.addEventListener("click", (event) => {
  const target = event.target.closest("[data-agent-variant]");
  if (target) applyAgentVariant(target.dataset.agentVariant);
});
els.agentWorkspace.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-agent-variant]");
  if (!target) return;
  event.preventDefault();
  applyAgentVariant(target.dataset.agentVariant);
});
els.agentModal.addEventListener("click", (event) => {
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
}

els.toggleLeft.addEventListener("click", () => {
  els.appShell.classList.toggle("left-open");
  syncShellToggles();
});
els.collapseLeft.addEventListener("click", () => {
  els.appShell.classList.remove("left-open");
  syncShellToggles();
});
els.toggleConfig.addEventListener("click", () => {
  els.appShell.classList.toggle("settings-open");
  syncShellToggles();
});
els.collapseRight.addEventListener("click", () => {
  els.appShell.classList.toggle("settings-open");
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
applyModelConfigToUi();
setConnectionMode(modelConfig.default_connection_mode || els.connectionMode.value || "proxy");
if (els.count && (!els.count.value || els.count.value === "4")) els.count.value = "1";
syncShellToggles();
syncAgentEntry();
syncAgentMode();
syncAgentComposer();
if (!location.hash) location.hash = "#home";
applyRoute();
loadState();
syncSummary();
window.setTimeout(() => maybeAutoShowGuide(location.hash || "#home"), 650);
if (selectedApiKey()) {
  scheduleAutoRefreshModels();
} else {
  renderAvailableModels();
  replaceModelOptions([]);
}
setInterval(loadState, 5000);
