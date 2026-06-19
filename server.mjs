import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import JSZip from 'jszip';
import dotenv from 'dotenv';

// Setup environment
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Use local tsx to run TypeScript scripts — no bun/global dependency needed
const TSX_BIN = path.join(__dirname, 'node_modules', '.bin', 'tsx');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json({ limit: '200mb' }));
app.use(express.raw({ limit: '200mb', type: 'application/octet-stream' }));

// --- HELPERS (Extracted from vite.config.ts) ---

function getDownloadsFolder() {
  try {
    const winPath = execSync('powershell.exe -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(\'shell:Downloads\').Self.Path"', { encoding: 'utf8' }).trim();
    if (winPath && fs.existsSync(winPath)) return winPath;
  } catch (e) {}
  return path.join(os.homedir(), 'Downloads');
}

const normalizePath = (p) => {
  if (!p) return '';
  let norm = p.replace(/\\/g, '/');
  const homeDir = os.homedir();
  if (norm.includes('/cc/')) {
    const idx = norm.indexOf('/cc/');
    return homeDir + norm.substring(idx);
  }
  if (/^[a-zA-Z]:\/cc\//i.test(norm)) {
    norm = norm.replace(/^[a-zA-Z]:\/cc\//i, path.join(homeDir, 'cc/').replace(/\\/g, '/'));
  } else if (norm.startsWith('cc/')) {
    norm = path.join(homeDir, 'cc/', norm.substring(3)).replace(/\\/g, '/');
  }
  return norm;
};

let CURRENT_PROJECT_PATH = '';
const SUPPORTED_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg'];

function findStableFile(dir, baseName) {
  if (!fs.existsSync(dir)) return null;
  for (const ext of SUPPORTED_EXTENSIONS) {
    const fullPath = path.join(dir, `${baseName}${ext}`);
    if (fs.existsSync(fullPath)) return { name: `${baseName}${ext}`, path: fullPath, ext };
  }
  return null;
}

function ensureSingleStableFile(dir, baseName, sourcePath) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  const targetName = `${baseName}${ext}`;
  const targetPath = path.join(dir, targetName);
  
  SUPPORTED_EXTENSIONS.forEach(e => {
    const p = path.join(dir, `${baseName}${e}`);
    if (fs.existsSync(p) && p.toLowerCase() !== targetPath.toLowerCase()) {
      try { fs.unlinkSync(p); } catch (err) {}
    }
  });
  
  if (fs.existsSync(sourcePath) && sourcePath.toLowerCase() !== targetPath.toLowerCase()) {
    fs.copyFileSync(sourcePath, targetPath);
  }
  return targetName;
}

const getChapterFolderName = (chapterId) => {
  const idStr = String(chapterId);
  const numPart = idStr.replace('issue-', '');
  const standardName = `Issue_${numPart}`;
  const legacyName = `Issue_issue-${numPart}`;
  if (CURRENT_PROJECT_PATH && fs.existsSync(CURRENT_PROJECT_PATH)) {
    if (!fs.existsSync(path.join(CURRENT_PROJECT_PATH, standardName)) && fs.existsSync(path.join(CURRENT_PROJECT_PATH, legacyName))) {
      return legacyName;
    }
  }
  return standardName;
};

const getAnchorSlug = (anchorText, infographicIndex, type) => {
  if (!anchorText && !type) return 'asset';
  const lower = (anchorText || '').toLowerCase();
  const lowerType = (type || '').toLowerCase();
  if (lower.includes('cover') || lowerType === 'cover') return 'cover';
  if (lower.includes('infographic') || lower.includes('placeholder') || lowerType === 'infographic') {
    return `infographic_${infographicIndex || 1}`;
  }
  return `asset_${infographicIndex || 1}`;
};

const makeContentPortable = (content, prefix = 'assets/') => {
  let portable = (content || '')
    .replace(/\/project-assets\/[^/]+\/assets\//g, prefix)
    .replace(/\(\/(assets\/)/g, `(${prefix}`)
    .replace(/\/assets\/visuals\//g, prefix);
  
  const p = prefix.endsWith('/') ? prefix : prefix + '/';
  portable = portable.replace(new RegExp(`\\b${p}cover(-[0-9]+)?\\.(png|webp|jpg|jpeg)\\b`, 'g'), `${p}cover/cover.$2`);
  portable = portable.replace(new RegExp(`(${p}(?:cover|infographic_[0-9]+)\/)(cover|infographic)-[0-9]+\\.(png|webp|jpg|jpeg)`, 'g'), '$1$2.$3')
                     .replace(/((?:cover|infographic))-[0-9]+\.(png|webp|jpg|jpeg)/g, '$1.$2');
  return portable;
};

const syncExtensionsWithDisk = (content, projectPath, chapterId) => {
  const folderName = getChapterFolderName(chapterId);
  const chapterDir = path.join(projectPath, folderName);
  const assetsDir = path.join(chapterDir, 'assets');
  if (!fs.existsSync(assetsDir)) return content;
  let updated = content;
  const assetRegex = /assets\/([^/\s)]+)\/([^/\s)"]+)\.(\w+)/g;
  updated = updated.replace(assetRegex, (match, slug, baseName, ext) => {
     const slugDir = path.join(assetsDir, slug);
     const stableFile = findStableFile(slugDir, baseName);
     if (stableFile && stableFile.ext.replace('.', '').toLowerCase() !== ext.toLowerCase()) {
        return `assets/${slug}/${stableFile.name}`;
     }
     return match;
  });
  return updated;
};

const saveVisualWithMigration = (v, infographicIndex, baseAssetsDir, basePromptsDir, projectPathOverride, chapterId) => {
  let srcPath = v.absolutePath;
  if (!srcPath) return v;
  const slug = getAnchorSlug(v.anchorText, infographicIndex, v.type);
  const targetAssetsDir = path.join(baseAssetsDir, slug);
  const targetPromptsDir = path.join(basePromptsDir, slug);
  if (!fs.existsSync(targetAssetsDir)) fs.mkdirSync(targetAssetsDir, { recursive: true });
  if (!fs.existsSync(targetPromptsDir)) fs.mkdirSync(targetPromptsDir, { recursive: true });
  
  if (!fs.existsSync(srcPath)) {
    const filename = path.basename(srcPath);
    const migratedPath = path.join(targetAssetsDir, filename);
    const legacyPath = path.join(baseAssetsDir, filename);
    if (fs.existsSync(migratedPath)) srcPath = migratedPath;
    else if (fs.existsSync(legacyPath)) srcPath = legacyPath;
    else return v;
  }
  const filename = path.basename(srcPath);
  const destImagePath = path.join(targetAssetsDir, filename);
  const promptFilename = filename.split('.')[0] + '.md';
  const destPromptPath = path.join(targetPromptsDir, promptFilename);
  try {
    const promptContent = `# Visual Asset Prompt: ${filename}\n\n` +
      `## Description\n${v.description || 'N/A'}\n\n` +
      `## Style DNA\n${v.styleDNA || 'N/A'}\n\n` +
      `## Labels\n${v.labels || 'N/A'}\n\n` +
      `## Anchor Text\n\`${v.anchorText || ''}\`\n`;
    fs.writeFileSync(destPromptPath, promptContent, 'utf8');
  } catch (e) {}

  const isCover = filename.toLowerCase().includes('cover');
  const stableBase = isCover ? 'cover' : 'infographic';
  const stableFilename = ensureSingleStableFile(targetAssetsDir, stableBase, srcPath);
  const destStablePath = path.join(targetAssetsDir, stableFilename);
  try {
    if (destImagePath !== destStablePath && fs.existsSync(destImagePath)) fs.copyFileSync(destImagePath, destStablePath);
    else if (srcPath !== destStablePath && fs.existsSync(srcPath)) fs.copyFileSync(srcPath, destStablePath);
  } catch (e) {}

  const finalChapterId = chapterId || v.chapterId || 'unknown';
  const stablePath = `assets/${slug}/${stableFilename}`;
  return {
    ...v,
    path: stablePath,
    absolutePath: destImagePath.replace(/\\/g, '/'),
    activeTimestampPath: stablePath
  };
};

const safeJsonParse = (raw) => {
  try {
    let jsonStr = raw.trim();
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      jsonStr = lines.slice(1, -1).join('\n').trim();
    }
    return JSON.parse(jsonStr);
  } catch (e) {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(raw.substring(start, end + 1)); } catch (e2) { throw e; }
    }
    throw e;
  }
};

const LLM_MODELS = {
  gemini: { 
    name: 'Google AI Studio', 
    models: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-flash-preview'], 
    envKey: 'GEMINI_API_KEY', 
    baseUrl: '' 
  },
  vertex: { 
    name: 'Vertex AI (GCP)', 
    models: [
      'gemini-3.1-pro-preview', 
      'gemini-3-pro-preview', 
      'gemini-3.1-flash-preview', 
      'gemini-3.1-flash-lite-preview', 
      'gemini-2.5-pro', 
      'gemini-3.1-flash-image-preview', 
      'lyria-3-pro-preview', 
      'imagen-3-fast-preview', 
      'imagen-3-pro-preview', 
      'imagen-3.0-generate-001', 
      'claude-opus-4-5', 
      'claude-sonnet-4-5'
    ], 
    envKey: 'VERTEX_SA_KEY_PATH', 
    baseUrl: '' 
  },
  openai: { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'o1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], envKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
  moonshot: { name: 'Moonshot (Kimi)', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], envKey: 'MOONSHOT_API_KEY', baseUrl: 'https://api.moonshot.cn/v1' },
  dashscope: { name: 'Alibaba Bailian (Qwen)', models: ['qwen-max', 'qwen-max-2025-01-25', 'qwen-plus', 'qwen-plus-2025-01-25', 'qwen-turbo', 'qwen-turbo-2025-01-25', 'qwen2.5-72b-instruct', 'qwen2.5-32b-instruct', 'qwen2.5-14b-instruct', 'qwen2.5-7b-instruct', 'qwen2.5-coder-32b-instruct', 'qwen2.5-coder-7b-instruct', 'deepseek-r1', 'deepseek-v3'], envKey: 'DASHSCOPE_API_KEY', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  zhipu: { name: 'Zhipu (GLM)', models: ['glm-4.5', 'glm-4-plus', 'glm-4-flash', 'glm-4-air'], envKey: 'ZHIPUAI_API_KEY', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  deepseek: { name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], envKey: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com' },
  siliconflow: { name: 'SiliconFlow', models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-14B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'meta-llama/Meta-Llama-3.1-400B-Instruct'], envKey: 'SILICONFLOW_API_KEY', baseUrl: 'https://api.siliconflow.cn/v1' },
  minimax: { name: 'MiniMax', models: ['minimax-m3', 'abab7-chat', 'abab6.5g-chat'], envKey: 'MINIMAX_API_KEY', baseUrl: 'https://api.minimaxi.com/v1' }
};

const loadAllApiKeys = () => {
  const keys = { ...process.env };
  
  // 1. Try local project .env first
  const localEnvPath = path.join(__dirname, '.env');
  if (fs.existsSync(localEnvPath)) {
    const content = fs.readFileSync(localEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const k = match[1].trim();
        const v = match[2].trim();
        if (v) keys[k] = v;
      }
    });
  }

  // 2. Try global/home .env or legacy path
  const homeEnvPath = path.join(os.homedir(), '.baoyu-skills', '.env');
  const legacyEnvPath = process.platform === 'win32' ? 'D:\\cc\\.baoyu-skills\\.env' : path.join(os.homedir(), 'cc', '.baoyu-skills', '.env');
  const globalEnvPath = fs.existsSync(homeEnvPath) ? homeEnvPath : legacyEnvPath;
  
  if (fs.existsSync(globalEnvPath)) {
    const content = fs.readFileSync(globalEnvPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const k = match[1].trim();
        const v = match[2].trim();
        if (v) keys[k] = v;
      }
    });
  }
  return keys;
};

const unifiedGenerateContent = async (modelName, prompt, overrideApiKey, explicitProvider, overrideProjectId, overrideLocation) => {
  const keys = loadAllApiKeys();
  let provider = null;
  let vendorKey = '';
  if (explicitProvider && LLM_MODELS[explicitProvider]) {
    vendorKey = explicitProvider;
    provider = LLM_MODELS[explicitProvider];
  } else {
    // Route Google models to Vertex if we have Vertex project configured, otherwise use standard loop
    const isGoogleModel = modelName.toLowerCase().includes('gemini') || modelName.toLowerCase().includes('imagen');
    if (isGoogleModel && keys['VERTEX_PROJECT_ID']) {
      vendorKey = 'vertex';
      provider = LLM_MODELS.vertex;
    } else {
      for (const [v, config] of Object.entries(LLM_MODELS)) {
        if (config.models.includes(modelName)) { provider = config; vendorKey = v; break; }
      }
    }
  }
  if (!provider) { provider = LLM_MODELS.gemini; vendorKey = 'gemini'; }
  let apiKey = overrideApiKey || keys[provider.envKey];
  if (!apiKey && vendorKey === 'gemini') apiKey = keys['GEMINI_API_KEY'] || keys['GOOGLE_API_KEY'];
  if (!apiKey && vendorKey !== 'vertex') throw new Error(`API Key for ${provider.name} (${provider.envKey}) is missing.`);
  
  const isKeyPath = apiKey && (apiKey.includes('/') || apiKey.includes('\\') || apiKey.includes(':'));
  if (isKeyPath && vendorKey !== 'vertex') vendorKey = 'vertex';

  if (vendorKey === 'gemini') {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: modelName });
    const result = await genModel.generateContent(prompt);
    return result.response.text();
  } else if (vendorKey === 'vertex') {
    const projectId = overrideProjectId || keys['VERTEX_PROJECT_ID'];
    const location = overrideLocation || keys['VERTEX_LOCATION'] || 'global';
    const keyPath = overrideApiKey || keys['VERTEX_SA_KEY_PATH'];
    if (!projectId) throw new Error("Vertex Project ID is missing.");
    if (keyPath) process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
    const vertexAI = new VertexAI({ project: projectId, location: location });
    let vertexModelName = modelName.includes(':') ? modelName.split(':')[1] : modelName;
    const generativeModel = vertexAI.getGenerativeModel({ model: vertexModelName });
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.candidates?.[0].content.parts?.[0].text || "";
  } else {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
    });
    if (!response.ok) throw new Error(`${provider.name} API error: ${await response.text()}`);
    const resJson = await response.json();
    return resJson.choices[0].message.content;
  }
};

function generateVisualPointExtractionPrompt(content, chapterTitle, styleName = "工业琥珀", mode = "all", extraRequirement = "", targetCount = 2, overrideDNA) {
  const STYLE_DNA_MAP = {
    "工业琥珀": "【核心视觉】琥珀金 (#FFBF00) 为唯一光源，背景为温暖的米色 (#FDF5E6) 或深工业灰。 【核心材质】发光的琥珀色微晶、半透明聚合材料、技术刻度线。 【氛围】高端 B2B 工业质感，极致专业。 【关键隐喻】当提及 \"OpenClaw\" 时，必须使用“小龙虾 (Crawfish)”的抽象工业形态。 【绝对禁忌】严禁任何蓝色、紫色、冷色调。",
    "深海蓝调": "【核心视觉】深邃蓝 (#0047AB) 与霓虹青色。核心元素：玻璃材质、发光网格、高对比度。禁忌：避免使用暖黄色调。",
    "极简图纸": "【核心视觉】白底黑线、极致简约的工程图纸。核心元素：0.5px 细线、无填充、技术标注。禁忌：禁止出现任何鲜艳颜色。",
    "暗岩专业": "【核心视觉】石墨色调与全息质感。核心元素：深灰色渐变、半透明玻璃、金色点缀。"
  };
  const styleDNA = overrideDNA || STYLE_DNA_MAP[styleName] || `风格：${styleName}`;
  const countStr = targetCount > 0 ? `${targetCount} 个` : "1-2 个";
  const extraDesc = extraRequirement ? `\n          【特别附加要求】: ${extraRequirement}` : "";
  let requirements = "", formatExample = "";
  if (mode === "cover") {
    requirements = `1. **核心头图策划 (Abstract Cover)**: 仅策划 1 个。 anchorText 固定为 [IMAGE_PLACEHOLDER: COVER_METAPHOR]。`;
    formatExample = `[{ "type": "cover", "description": "...", "labels": "...", "anchorText": "[IMAGE_PLACEHOLDER: COVER_METAPHOR]" }]`;
  } else if (mode === "infographic") {
    requirements = `1. **仅策划信息图 (Infographic Only)**: 策划 ${countStr}。从文中寻找 [IMAGE_PLACEHOLDER: ...] 标记。`;
    formatExample = `[{ "type": "infographic", "description": "...", "labels": "...", "anchorText": "[IMAGE_PLACEHOLDER: INFOGRAPHIC_SUMMARY]" }]`;
  } else {
    requirements = `1. **头图 (Cover)**: 策划 1 个。 anchorText 固定为 [IMAGE_PLACEHOLDER: COVER_METAPHOR]。\n2. **信息图 (Infographic)**: 策划 ${countStr}。`;
    formatExample = `[{ "type": "cover", ... }, { "type": "infographic", ... }]`;
  }
  return `你是一个专业的 B2B 技术内容出版专家... \n\n【文章标题】: ${chapterTitle}\n【文章内容】: ${content.substring(0, 50000)}${extraDesc}\n【视觉风格指南】: ${styleDNA}\n【输出格式】: ${formatExample}`;
}

const scanHistoryForVisual = (projectPath, v, chapterId, chapterIdx, infographicIndex = 1) => {
  const activeProjectPath = normalizePath(projectPath || CURRENT_PROJECT_PATH);
  if (!activeProjectPath) return v;
  const chapterOrder = typeof chapterId === 'number' ? chapterId : chapterIdx + 1;
  const folderName = getChapterFolderName(chapterId || chapterOrder);
  let chapterDir = path.join(activeProjectPath, folderName);
  let baseAssetsDir = path.join(chapterDir, 'assets');
  let basePromptsDir = path.join(chapterDir, 'prompts');

  if (!fs.existsSync(baseAssetsDir)) {
    const altChapterDir = path.join(activeProjectPath, 'portable_project', folderName);
    const altBaseAssetsDir = path.join(altChapterDir, 'assets');
    if (fs.existsSync(altBaseAssetsDir)) {
      chapterDir = altChapterDir;
      baseAssetsDir = altBaseAssetsDir;
      basePromptsDir = path.join(altChapterDir, 'prompts');
    }
  }

  if (!fs.existsSync(baseAssetsDir)) return v;

  const lowerAnchor = (v.anchorText || '').toLowerCase();
  const isCover = lowerAnchor.includes('cover') || v.type === 'cover';
  const slug = isCover ? 'cover' : getAnchorSlug(v.anchorText, infographicIndex, v.type);
  const targetAssetsDir = path.join(baseAssetsDir, slug);
  const targetPromptsDir = path.join(basePromptsDir, slug);

  if (!fs.existsSync(targetAssetsDir)) return v;

  const legacyAssetsHistoryDir = path.join(targetAssetsDir, 'history');
  const legacyPromptsHistoryDir = path.join(targetPromptsDir, 'history');
  if (fs.existsSync(legacyAssetsHistoryDir)) {
    const legacyFiles = fs.readdirSync(legacyAssetsHistoryDir);
    legacyFiles.forEach(f => {
       try {
         const oldPath = path.join(legacyAssetsHistoryDir, f);
         const newPath = path.join(targetAssetsDir, f);
         if (!fs.existsSync(newPath)) fs.renameSync(oldPath, newPath);
         else fs.unlinkSync(oldPath);
         const pFile = f.split('.')[0] + '.md';
         const oldP = path.join(legacyPromptsHistoryDir, pFile);
         const newP = path.join(targetPromptsDir, pFile);
         if (fs.existsSync(oldP)) { if (!fs.existsSync(newP)) fs.renameSync(oldP, newP); else fs.unlinkSync(oldP); }
       } catch (e) {}
    });
    try { fs.rmdirSync(legacyAssetsHistoryDir); if (fs.existsSync(legacyPromptsHistoryDir)) fs.rmdirSync(legacyPromptsHistoryDir); } catch (e) {}
  }

  const allFiles = fs.readdirSync(targetAssetsDir).filter(f => SUPPORTED_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)));
  const stableBase = isCover ? 'cover' : 'infographic';
  
  const stableFile = findStableFile(targetAssetsDir, stableBase);
  const stableFilename = stableFile ? stableFile.name : `${stableBase}.png`;
  const stablePath = path.join(targetAssetsDir, stableFilename).replace(/\\/g, '/');

  const historyItems = allFiles
    .filter(f => f.includes('-') && (f.startsWith('cover-') || f.startsWith('infographic-') || f.startsWith('asset-')))
    .map(f => {
      const tsMatch = f.match(/-(\d+)\.(png|webp|jpg|jpeg)$/i);
      const timestamp = tsMatch ? parseInt(tsMatch[1]) : fs.statSync(path.join(targetAssetsDir, f)).mtimeMs;
      const absolutePath = path.join(targetAssetsDir, f).replace(/\\/g, '/');
      const promptFile = f.split('.')[0] + '.md';
      const promptPath = path.join(targetPromptsDir, promptFile);
      let description = v.description, styleDNA = v.styleDNA, labels = v.labels;
      if (fs.existsSync(promptPath)) {
        try {
          const content = fs.readFileSync(promptPath, 'utf8');
          const descMatch = content.match(/## Description\s+([\s\S]*?)(?=\n\n##|$)/);
          if (descMatch) description = descMatch[1].trim();
          const dnaMatch = content.match(/## Style DNA\s+([\s\S]*?)(?=\n\n##|$)/);
          if (dnaMatch) styleDNA = dnaMatch[1].trim();
          const labelsMatch = content.match(/## Labels\s+([\s\S]*?)(?=\n\n##|$)/);
          if (labelsMatch) labels = labelsMatch[1].trim();
        } catch (e) {}
      }
      return {
        path: `assets/${slug}/${f}`,
        absolutePath,
        timestamp,
        styleDNA,
        description,
        labels,
        anchorText: v.anchorText
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  let activeTimestampPath = v.activeTimestampPath;
  if (!activeTimestampPath && historyItems.length > 0) {
    activeTimestampPath = historyItems[0].path;
  }

  const activeItem = historyItems.find(item => item.path === activeTimestampPath) || historyItems[0];

  const validDescItem = historyItems.find(item => item.description && item.description !== 'N/A' && item.description.trim() !== '');
  const validLabelsItem = historyItems.find(item => item.labels && item.labels !== 'N/A' && item.labels.trim() !== '');
  const validDnaItem = historyItems.find(item => item.styleDNA && item.styleDNA !== 'N/A' && item.styleDNA.trim() !== '');

  const fallbackDescription = validDescItem ? validDescItem.description : (activeItem?.description || '');
  const fallbackLabels = validLabelsItem ? validLabelsItem.labels : (activeItem?.labels || '');
  const fallbackStyleDNA = validDnaItem ? validDnaItem.styleDNA : (activeItem?.styleDNA || '');

  return {
    ...v,
    description: v.description || fallbackDescription || '',
    labels: v.labels || fallbackLabels || '',
    styleDNA: v.styleDNA || fallbackStyleDNA || '',
    path: `assets/${slug}/${stableFilename}`,
    absolutePath: stablePath,
    activeTimestampPath,
    history: historyItems
  };
};

// --- API ENDPOINTS ---

app.use('/project-assets', (req, res, next) => {
  if (!CURRENT_PROJECT_PATH) {
    try {
      const statePath = path.join(__dirname, '.app_state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (state.projectPath) CURRENT_PROJECT_PATH = normalizePath(state.projectPath);
      }
    } catch (e) {}
  }
  if (!CURRENT_PROJECT_PATH) return next();

  CURRENT_PROJECT_PATH = normalizePath(CURRENT_PROJECT_PATH);

  const requestedPath = decodeURIComponent(req.path);
  const baseDirs = [
    CURRENT_PROJECT_PATH,
    path.join(CURRENT_PROJECT_PATH, 'portable_project')
  ];

  for (const baseDir of baseDirs) {
    const exactPath = path.join(baseDir, requestedPath);
    
    // 1. Try exact physical path match
    if (fs.existsSync(exactPath) && fs.statSync(exactPath).isFile()) {
      return res.sendFile(exactPath);
    }

    // 2. Smart Fallback for timestamped/prefixed mismatches
    const parsed = path.parse(exactPath);
    const parentDir = parsed.dir;
    if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
      const files = fs.readdirSync(parentDir);
      const lowerBase = parsed.name.toLowerCase();
      
      const isCover = lowerBase.includes('cover');
      const isInfographic = lowerBase.includes('infographic') || lowerBase.includes('asset');
      
      let fallbackFile = null;
      if (isCover) {
        fallbackFile = files.find(f => {
          const lf = f.toLowerCase();
          return lf.includes('cover') && ['.webp', '.png', '.jpg', '.jpeg'].some(ext => lf.endsWith(ext));
        });
      } else if (isInfographic) {
        fallbackFile = files.find(f => {
          const lf = f.toLowerCase();
          return (lf.includes('infographic') || lf.includes('asset')) && ['.webp', '.png', '.jpg', '.jpeg'].some(ext => lf.endsWith(ext));
        });
      }
      
      if (fallbackFile) {
        const fallbackPath = path.join(parentDir, fallbackFile);
        if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
          return res.sendFile(fallbackPath);
        }
      }
    }
  }

  res.status(404).send('Asset not found');
});

app.get('/api/list-llm-models', (req, res) => res.json(LLM_MODELS));

app.get('/api/system-info', (req, res) => {
  res.json({
    homedir: os.homedir(),
    platform: process.platform,
    username: os.userInfo().username
  });
});

app.post('/api/generate-content', async (req, res) => {
  try {
    const { model, prompt, llmApiKey, provider, vertexProjectId, vertexLocation } = req.body;
    const result = await unifiedGenerateContent(model, prompt, llmApiKey, provider, vertexProjectId, vertexLocation);
    res.json({ text: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Full server-side ZIP builder — clean structure: 篇目/ contains text + images together
app.post('/api/build-full-zip', async (req, res) => {
  try {
    const state = req.body;
    const activeProjectPath = state.projectPath ? normalizePath(state.projectPath) : CURRENT_PROJECT_PATH;
    const zip = new JSZip();
    const issues = state.issues || [];

    // Build id→safeTitle map for asset lookup
    const issueMap = {};
    issues.forEach(i => {
      issueMap[i.id] = (i.title || `连载${i.id}`).replace(/[\\/:*?"<>|]/g, '_');
    });

    // 1. Text content — 篇目/<title>/
    issues.filter(i => i.content && i.content.trim()).forEach(issue => {
      const safeTitle = issueMap[issue.id];
      zip.file(`篇目/${safeTitle}/最新版本.md`, makeContentPortable(issue.content, 'assets/'));
      (issue.versions || []).forEach(v => {
        zip.file(`篇目/${safeTitle}/版本历史/V${v.version}.md`, makeContentPortable(v.content, 'assets/'));
      });
    });

    // 2. Plan & settings
    let planContent = `# 连载规划\n\n`;
    planContent += `## 业务背景\n${state.companyBusiness || ''}\n\n`;
    planContent += `## 报告目的\n${state.reportPurpose || ''}\n\n`;
    planContent += `## 整体调性\n${state.selectedTone || ''}\n\n`;
    planContent += `## 全篇提炼总结\n${state.reportSummary || ''}\n\n`;
    planContent += `## 规划详情\n${state.serialPlan || ''}\n`;
    zip.file(`规划/最新版本.md`, planContent);
    (state.planVersions || []).forEach(v => zip.file(`规划/版本历史/V${v.version}.md`, v.content));
    zip.file(`设定/01_公司业务.md`, state.companyBusiness || '');
    zip.file(`设定/02_引流模板设定.md`, `\`\`\`json\n${JSON.stringify({ctaMode: state.ctaMode, exactCtaTemplate: state.exactCtaTemplate, generateCtaTemplate: state.generateCtaTemplate}, null, 2)}\n\`\`\``);
    zip.file(`设定/03_报告分解要求.md`, state.reportPurpose || '');
    zip.file(`设定/04_热点.md`, state.currentHotspot || '');
    zip.file(`设定/05_连载期数设定.md`, `\`\`\`json\n${JSON.stringify({episodeMode: state.episodeMode, episodeCount: state.episodeCount}, null, 2)}\n\`\`\``);
    zip.file(`设定/06_调性设定.md`, state.selectedTone || '');

    if (activeProjectPath) {
      // 3. Source PDF → source/
      const pdfSearchDirs = [activeProjectPath, path.join(activeProjectPath, 'portable_project')];
      let pdfPacked = false;
      for (const dir of pdfSearchDirs) {
        if (!fs.existsSync(dir)) continue;
        const pdfs = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf'));
        for (const pdf of pdfs) {
          zip.file(`source/${pdf}`, fs.readFileSync(path.join(dir, pdf)));
          if (!state.fileName) state.fileName = pdf;
          pdfPacked = true;
        }
        if (pdfPacked) break;
      }

      // 4. Images → 篇目/<title>/assets/<slot>/<file>
      //    Scan both project root and portable_project/ for Issue_* dirs
      const packedAssets = new Set();
      for (const baseDir of [activeProjectPath, path.join(activeProjectPath, 'portable_project')]) {
        if (!fs.existsSync(baseDir)) continue;
        for (const entry of fs.readdirSync(baseDir)) {
          const m = entry.match(/^Issue_(\d+)$/i);
          if (!m) continue;
          const issueId = parseInt(m[1], 10);
          const safeTitle = issueMap[issueId];
          if (!safeTitle) continue; // skip if no matching issue in state
          const assetsDir = path.join(baseDir, entry, 'assets');
          if (!fs.existsSync(assetsDir)) continue;
          for (const slot of fs.readdirSync(assetsDir)) {
            const slotDir = path.join(assetsDir, slot);
            if (!fs.statSync(slotDir).isDirectory()) continue;
            for (const file of fs.readdirSync(slotDir)) {
              const filePath = path.join(slotDir, file);
              if (!fs.statSync(filePath).isFile()) continue;
              if (!['.webp', '.png', '.jpg', '.jpeg'].includes(path.extname(file).toLowerCase())) continue;
              const zipPath = `篇目/${safeTitle}/assets/${slot}/${file}`;
              if (!packedAssets.has(zipPath)) {
                zip.file(zipPath, fs.readFileSync(filePath));
                packedAssets.add(zipPath);
              }
            }
          }
        }
      }
    }

    // 5. Single project_state.json at root
    const stateToSave = { ...state };
    if (activeProjectPath) stateToSave.projectPath = activeProjectPath;
    zip.file(`project_state.json`, JSON.stringify(stateToSave, null, 2));

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const downloadsPath = getDownloadsFolder();
    const timestamp = new Date().toISOString().replace(/[:\\.]/g, '-');
    const targetPath = path.join(downloadsPath, `连载系列_完整包_${timestamp}.zip`);
    fs.writeFileSync(targetPath, zipBuffer);
    res.status(200).json({ path: targetPath });
  } catch (err) {
    console.error('[Build Full ZIP Error]', err);
    res.status(500).json({ error: err.message });

  }
});

app.get('/api/get-styles', (req, res) => {
  const localHumanizerPath = path.join(__dirname, 'Library', 'Tools', 'humanizer-zh', 'SKILL.md');
  const legacyHumanizerPath = process.platform === 'win32'
    ? 'D:\\cc\\Library\\Agents\\Humanizer\\SKILL.md'
    : path.join(os.homedir(), 'cc/Library/Agents/Humanizer/SKILL.md');
  const humanizerPath = fs.existsSync(localHumanizerPath) ? localHumanizerPath : legacyHumanizerPath;

  const localWritingStylePath = path.join(__dirname, 'Library', 'Tools', 'WritingStyle', 'SKILL.md');
  const legacyWritingStylePath = process.platform === 'win32'
    ? 'D:\\cc\\Library\\Tools\\WritingStyle\\SKILL.md'
    : path.join(os.homedir(), 'cc/Library/Tools/WritingStyle/SKILL.md');
  const writingStylePath = fs.existsSync(localWritingStylePath) ? localWritingStylePath : legacyWritingStylePath;
  
  const humanizer = fs.existsSync(humanizerPath) ? fs.readFileSync(humanizerPath, 'utf8') : '';
  const writingStyle = fs.existsSync(writingStylePath) ? fs.readFileSync(writingStylePath, 'utf8') : '';
  res.json({ humanizer, writingStyle });
});

app.post('/api/save-zip', (req, res) => {
  try {
    const body = req.body;
    const downloadsPath = getDownloadsFolder();
    const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
    const targetPath = path.join(downloadsPath, `连载系列_全部篇目_${timestamp}.zip`);
    fs.writeFileSync(targetPath, body);
    res.status(200).json({ path: targetPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save-file', (req, res) => {
  try {
    const { filename, content } = req.body;
    const downloadsPath = getDownloadsFolder();
    const targetPath = path.join(downloadsPath, filename);
    fs.writeFileSync(targetPath, content, 'utf8');
    res.status(200).json({ path: targetPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unzip-project', async (req, res) => {
  try {
    const projectPath = req.headers['x-project-path'];
    if (!projectPath) {
      return res.status(400).json({ error: 'Missing X-Project-Path header' });
    }
    const body = req.body;
    if (!body || body.length === 0) {
      return res.status(400).json({ error: 'Empty ZIP content' });
    }

    const zip = await JSZip.loadAsync(body);
    const normalizePath = (p) => {
      if (!p) return '';
      let norm = p.replace(/\\/g, '/');
      const homeDir = os.homedir();
      if (norm.includes('/cc/')) {
        const idx = norm.indexOf('/cc/');
        return homeDir + norm.substring(idx);
      }
      if (/^[a-zA-Z]:\/cc\//i.test(norm)) {
        norm = norm.replace(/^[a-zA-Z]:\/cc\//i, path.join(homeDir, 'cc/').replace(/\\/g, '/'));
      } else if (norm.startsWith('cc/')) {
        norm = path.join(homeDir, 'cc/', norm.substring(3)).replace(/\\/g, '/');
      }
      return norm;
    };

    const targetDir = normalizePath(projectPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const [relativePath, file] of Object.entries(zip.files)) {
      const destPath = path.join(targetDir, relativePath);
      if (file.dir) {
        fs.mkdirSync(destPath, { recursive: true });
      } else {
        const fileBuffer = await file.async('nodebuffer');
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, fileBuffer);
      }
    }

    CURRENT_PROJECT_PATH = normalizePath(targetDir);
    res.status(200).json({ success: true, path: CURRENT_PROJECT_PATH });
  } catch (err) {
    console.error('[Unzip Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/save-state', (req, res) => {
  try {
    const statePath = path.join(__dirname, '.app_state.json');
    const state = req.body;
    if (state.projectPath) {
      state.projectPath = normalizePath(state.projectPath);
      CURRENT_PROJECT_PATH = state.projectPath;
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/load-state', (req, res) => {
  try {
    const statePath = path.join(__dirname, '.app_state.json');
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      const state = JSON.parse(data);
      if (state.projectPath) {
        state.projectPath = normalizePath(state.projectPath);
        CURRENT_PROJECT_PATH = state.projectPath;
      }
      // Auto-detect source PDF if fileName is empty
      if (!state.fileName && CURRENT_PROJECT_PATH) {
        const searchDirs = [CURRENT_PROJECT_PATH, path.join(CURRENT_PROJECT_PATH, 'portable_project')];
        for (const dir of searchDirs) {
          if (!fs.existsSync(dir)) continue;
          const pdf = fs.readdirSync(dir).find(f => f.toLowerCase().endsWith('.pdf'));
          if (pdf) { state.fileName = pdf; break; }
        }
      }
      res.json(state);
    } else { res.status(404).json({ error: 'Not found' }); }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/save-project-chapter', async (req, res) => {
  try {
    const { projectPath, chapterId, chapterTitle, content, visuals } = req.body;
    const activeProjectPath = normalizePath(projectPath);
    const folderName = getChapterFolderName(chapterId);
    const chapterDir = path.join(activeProjectPath, folderName);
    const assetsDir = path.join(chapterDir, 'assets');
    const promptsDir = path.join(chapterDir, 'prompts');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });
    const safeChapterTitle = (chapterTitle || '未命名').replace(/[\\/:*?"<>|]/g, '_');
    const mdPath = path.join(chapterDir, `${safeChapterTitle}.md`);
    let portableContent = makeContentPortable(content, 'assets/');
    fs.writeFileSync(mdPath, portableContent, 'utf8');
    let updatedVisualsList = [];
    if (visuals && Array.isArray(visuals)) {
      let infoIdx = 0;
      updatedVisualsList = visuals.map((v) => {
        if (v.type === 'infographic') infoIdx++;
        return saveVisualWithMigration(v, infoIdx, assetsDir, promptsDir, activeProjectPath, chapterId);
      });
      portableContent = syncExtensionsWithDisk(portableContent, activeProjectPath, chapterId);
      fs.writeFileSync(mdPath, portableContent, 'utf8');
    }
    res.json({ success: true, updatedVisuals: updatedVisualsList });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/save-full-project', async (req, res) => {
  try {
    const { projectPath, chapters, plan, planVersions, config, chatMessages } = req.body;
    const activePath = normalizePath(projectPath);
    if (!fs.existsSync(activePath)) fs.mkdirSync(activePath, { recursive: true });
    const fullState = { issues: chapters, plan, planVersions, config, chatMessages, projectPath: activePath };
    fs.writeFileSync(path.join(activePath, 'project_state.json'), JSON.stringify(fullState, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/select-folder', async (req, res) => {
  try {
    if (process.platform === 'darwin') {
      const command = `osascript -e 'POSIX path of (choose folder with prompt "选择项目文件夹")'`;
      exec(command, (err, stdout) => {
        if (err) return res.json({ path: '' });
        res.json({ path: stdout.trim() });
      });
    } else {
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowDialog() | Out-Null; $f.SelectedPath"`;
      exec(command, (err, stdout) => res.json({ path: stdout.trim() }));
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/select-image', async (req, res) => {
  try {
    if (process.platform === 'darwin') {
      const command = `osascript -e 'POSIX path of (choose file of type {"png", "jpg", "jpeg", "webp"} with prompt "选择默认缩略图")'`;
      exec(command, (err, stdout) => {
        if (err) return res.json({ path: '' });
        res.json({ path: stdout.trim() });
      });
    } else {
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Images|*.jpg;*.jpeg;*.png;*.webp'; $f.ShowDialog() | Out-Null; $f.FileName"`;
      exec(command, (err, stdout) => res.json({ path: stdout.trim() }));
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/select-key', async (req, res) => {
  try {
    if (process.platform === 'darwin') {
      const command = `osascript -e 'POSIX path of (choose file of type {"json"} with prompt "选择 Service Account Key (.json)")'`;
      exec(command, (err, stdout) => {
        if (err) return res.json({ path: '' });
        res.json({ path: stdout.trim() });
      });
    } else {
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'JSON|*.json'; $f.ShowDialog() | Out-Null; $f.FileName"`;
      exec(command, (err, stdout) => res.json({ path: stdout.trim() }));
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/extract-visual-points', async (req, res) => {
  try {
    const { text, chapterTitle, styleName, styleDNA, mode, extraRequirement, targetCount, llmModel, llmApiKey, provider, vertexProjectId, vertexLocation } = req.body;
    const selectedModel = llmModel || "gemini-3-flash-preview";
    console.log(`[Visual Extraction] Request received. Provider: ${provider || 'auto'}, Model: ${selectedModel}, Mode: ${mode}, Title: ${chapterTitle}, Style: ${styleName}`);
    
    const prompt = generateVisualPointExtractionPrompt(text, chapterTitle, styleName, mode, extraRequirement, targetCount, styleDNA);
    console.log(`[Visual Extraction] Prompt generated (Style: ${styleName}, Mode: ${mode})`);
    
    const rawContent = await unifiedGenerateContent(selectedModel, prompt, llmApiKey, provider, vertexProjectId, vertexLocation);
    
    if (!rawContent) throw new Error("AI did not return any content");
    
    console.log(`[Visual Extraction] AI Response snippet: ${rawContent.substring(0, 200)}...`);
    
    const points = safeJsonParse(rawContent);
    console.log(`[Visual Extraction] Success! Points extracted: ${points.length}`);
    res.status(200).json({ success: true, points });
  } catch (err) {
    console.error("Visual Extraction Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-asset', async (req, res) => {
  const timestamp = Date.now();
  try {
    const { description, type, chapterId, labels, styleDNA, imageModel, imageVendor, imageKey, vertexProjectId, vertexLocation, anchorText, infographicIndex } = req.body;
    const slug = getAnchorSlug(anchorText, infographicIndex, type);
    const activeFilename = `${type || 'asset'}-${timestamp}.png`;
    const keys = loadAllApiKeys();
    
    let imgProvider = imageVendor || "google";
    let model = "gemini-3-pro-image-preview";
    if (imageModel && imageModel.includes(':')) {
      const parts = imageModel.split(':');
      imgProvider = parts[0];
      model = parts[1];
    } else if (imageModel) {
      model = imageModel;
    }

    const finalStyleDNA = styleDNA || "Industrial Amber style: High-end B2B technical illustration, #FFBF00 amber lines, #FDF5E6 cream background, technical isometric grid, professional and structured.";
    
    console.log(`[Asset Gen] Requesting ${type} for Chapter ${chapterId} (Slug: ${slug}, Index: ${infographicIndex})`);
    
    const currentProject = normalizePath(req.body.projectPath || CURRENT_PROJECT_PATH);
    let baseOutputDir = path.resolve(__dirname, 'public/assets/visuals');
    let basePromptDir = baseOutputDir; 

    if (currentProject && fs.existsSync(currentProject)) {
      const folderName = getChapterFolderName(chapterId);
      const chapterDir = path.join(currentProject, folderName);
      baseOutputDir = path.join(chapterDir, 'assets');
      basePromptDir = path.join(chapterDir, 'prompts');
    }

    const outputDir = path.join(baseOutputDir, slug);
    const promptDir = path.join(basePromptDir, slug);

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(promptDir)) fs.mkdirSync(promptDir, { recursive: true });
    
    const outputPath = path.join(outputDir, activeFilename);
    const imagineScript = path.join(__dirname, 'Library', 'Tools', 'baoyu-skills', 'skills', 'baoyu-imagine', 'scripts', 'main.ts');
    
    const promptFilename = activeFilename.split('.')[0] + '.md';
    const promptPath = path.join(promptDir, promptFilename);
    const promptContent = `# Image Generation Prompt\n\n- **Asset**: ${activeFilename}\n- **Chapter**: ${chapterId}\n- **Type**: ${type}\n- **Anchor**: ${anchorText}\n- **DNA**: ${finalStyleDNA}\n\n## Description\n${description}\n\n## Labels\n${labels}`;
    fs.writeFileSync(promptPath, promptContent, 'utf8');

    const fullPrompt = `[MASTER STYLE DNA]: ${finalStyleDNA}\n[VISUAL CONTENT]: ${description}\n[LABELS]: ${labels}\n\nSTRICT INSTRUCTIONS:\n1. Use ONLY colors and motifs defined in [MASTER STYLE DNA].\n2. IF [MASTER STYLE DNA] mentions specific colors (like Amber/Gold), IGNORE any color suggestions in [VISUAL CONTENT] that would introduce cool tones (Blue/Purple).\n3. Keep English technical terms (e.g. OpenClaw) if mentioned.`;

    const tmpPromptPath = path.join(os.tmpdir(), `prompt-${timestamp}.txt`);
    fs.writeFileSync(tmpPromptPath, fullPrompt, 'utf8');
    
    const cmd = `"${TSX_BIN}" "${imagineScript}" --promptfiles "${tmpPromptPath}" --image "${outputPath.replace(/\\/g, '/')}" --ar 16:9 --provider ${imgProvider} --model "${model}"`;
    
    const env = { 
      ...process.env, 
      ...keys,
      GOOGLE_API_KEY: (imgProvider === 'google' ? imageKey : '') || keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY,
      REPLICATE_API_TOKEN: (imgProvider === 'replicate' ? imageKey : '') || keys.REPLICATE_API_TOKEN || keys.REPLICATE_API_KEY,
      ARK_API_KEY: (imgProvider === 'seedream' ? imageKey : '') || keys.ARK_API_KEY,
      OPENAI_API_KEY: (imgProvider === 'openai' ? imageKey : '') || keys.OPENAI_API_KEY,
      AZURE_OPENAI_API_KEY: (imgProvider === 'azure' ? imageKey : '') || keys.AZURE_OPENAI_API_KEY,
      OPENROUTER_API_KEY: (imgProvider === 'openrouter' ? imageKey : '') || keys.OPENROUTER_API_KEY,
      DASHSCOPE_API_KEY: (imgProvider === 'dashscope' ? imageKey : '') || keys.DASHSCOPE_API_KEY,
      MINIMAX_API_KEY: (imgProvider === 'minimax' ? imageKey : '') || keys.MINIMAX_API_KEY,
      VERTEX_ACCESS_TOKEN: (imgProvider === 'vertex' ? imageKey : '') || keys.VERTEX_ACCESS_TOKEN,
      VERTEX_PROJECT_ID: keys.VERTEX_PROJECT_ID || keys.GOOGLE_CLOUD_PROJECT,
      VERTEX_LOCATION: keys.VERTEX_LOCATION || keys.GOOGLE_CLOUD_LOCATION || 'global'
    };

    try {
      if (imgProvider === 'vertex') {
        const projectId = vertexProjectId || keys['VERTEX_PROJECT_ID'] || 'vertexcc-493408';
        const location = vertexLocation || keys['VERTEX_LOCATION'] || keys['GOOGLE_CLOUD_LOCATION'] || 'global';
        const keyPath = imageKey || keys['VERTEX_SA_KEY_PATH'] || 'C:\\Users\\furun\\AppData\\Roaming\\gcloud\\application_default_credentials.json';
        
        if (!projectId) throw new Error("Vertex Project ID (VERTEX_PROJECT_ID) is missing.");
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

        const vertexAI = new VertexAI({ 
          project: projectId, 
          location: location, 
          apiOptions: { apiVersion: 'v1beta1' },
          apiEndpoint: location === 'global' ? 'aiplatform.googleapis.com' : undefined
        });
        
        const generativeModel = vertexAI.getGenerativeModel({ model: model });

        console.log(`[Vertex SDK] Generating image with ${model} in ${location}...`);
        const result = await generativeModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { imageSize: "1K" }
          }
        });

        const response = await result.response;
        const imagePart = response.candidates?.[0].content.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData?.data) {
          fs.writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'));
          console.log(`[Vertex SDK] Image saved to ${outputPath}`);
        } else {
          throw new Error("No image data found in Vertex AI SDK response candidates.");
        }
      } else if (imgProvider === 'google') {
        const apiKey = imageKey || keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Google API Key is missing for AI Studio image generation.");
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model: model });

        console.log(`[AI Studio SDK] Generating image with ${model}...`);
        const result = await genModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        });

        const response = await result.response;
        const imagePart = response.candidates?.[0].content.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData?.data) {
          fs.writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, 'base64'));
          console.log(`[AI Studio SDK] Image saved to ${outputPath}`);
        } else {
          throw new Error("No image data found in AI Studio SDK response candidates.");
        }
      } else {
        execSync(cmd, { stdio: 'inherit', env });
      }
    } catch (execErr) {
      console.error("[Generation Error]", execErr);
      throw new Error(`Generation failed: ${execErr.message}`);
    }
    
    try {
      const downloadsPath = getDownloadsFolder();
      const mirrorDir = path.join(downloadsPath, '连载发布资产', '视觉');
      if (!fs.existsSync(mirrorDir)) fs.mkdirSync(mirrorDir, { recursive: true });
      const mirrorPath = path.join(mirrorDir, activeFilename);
      fs.copyFileSync(outputPath, mirrorPath);
    } catch (copyErr) {
      console.warn("Failed to mirror asset to Downloads folder:", copyErr);
    }

    const stableBase = type === 'cover' ? 'cover' : 'infographic';
    const stableFilename = ensureSingleStableFile(outputDir, stableBase, outputPath);
    const stablePath = path.join(outputDir, stableFilename);
    
    try {
      const promptSrc = outputPath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
      const promptDest = stablePath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
      if (fs.existsSync(promptSrc)) fs.copyFileSync(promptSrc, promptDest);
    } catch (e) { console.error("Failed to sync stable asset copy", e); }

    res.status(200).json({ 
      success: true, 
      path: `assets/${slug}/${stableFilename}`,
      absolutePath: stablePath.replace(/\\/g, '/'),
      activeTimestampPath: `assets/${slug}/${activeFilename}`,
      activeTimestampAbsolutePath: outputPath.replace(/\\/g, '/')
    });
  } catch (err) {
    console.error("Asset Generation Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restore-history', async (req, res) => {
  try {
    const { sourcePath, targetPath, projectPath } = req.body;
    if (!sourcePath || !targetPath) throw new Error("Missing paths");
    
    let srcAbsolutePath = sourcePath;
    let destAbsolutePath = targetPath;
    const activeProjectPath = normalizePath(projectPath || CURRENT_PROJECT_PATH);
    
    if (sourcePath.startsWith('/project-assets/') && activeProjectPath) {
       const relativePath = sourcePath.replace('/project-assets/', '');
       srcAbsolutePath = path.join(activeProjectPath, relativePath);
    }
    
    if (targetPath.startsWith('/project-assets/') && activeProjectPath) {
       const relativePath = targetPath.replace('/project-assets/', '');
       destAbsolutePath = path.join(activeProjectPath, relativePath);
    }

    if (!fs.existsSync(srcAbsolutePath)) {
      console.error(`[Restore] Source not found: ${srcAbsolutePath}`);
      return res.status(404).json({ error: `Source version not found at: ${srcAbsolutePath}` });
    }

    console.log(`[Restore] Copying ${srcAbsolutePath} -> (Stable Base in ${path.dirname(destAbsolutePath)})`);
    const isCover = path.basename(srcAbsolutePath).toLowerCase().includes('cover');
    const stableBase = isCover ? 'cover' : 'infographic';
    const stableFilename = ensureSingleStableFile(path.dirname(destAbsolutePath), stableBase, srcAbsolutePath);
    const finalDestPath = path.join(path.dirname(destAbsolutePath), stableFilename);
    console.log(`[Restore] Restored to ${finalDestPath}`);
    
    const srcPrompt = srcAbsolutePath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
    const destPrompt = finalDestPath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
    if (fs.existsSync(srcPrompt)) {
       fs.copyFileSync(srcPrompt, destPrompt);
    }

    res.status(200).json({ 
      success: true,
      path: `assets/${path.basename(path.dirname(destAbsolutePath))}/${stableFilename}`,
      absolutePath: finalDestPath.replace(/\\/g, '/')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync-history', async (req, res) => {
  try {
    const { projectPath, issues, pendingVisuals } = req.body;
    console.log(`[Sync History] Request received. projectPath: "${projectPath}"`);
    const activeProjectPath = normalizePath(projectPath || CURRENT_PROJECT_PATH);
    console.log(`[Sync History] Resolved activeProjectPath: "${activeProjectPath}"`);
    if (!activeProjectPath || !fs.existsSync(activeProjectPath)) {
      throw new Error("Project path is missing or invalid: " + activeProjectPath);
    }

    const updatedIssues = issues.map((ch, idx) => {
      const visualsList = ch.visualPoints || ch.visuals || [];
      let infoIdx = 0;
      const updatedVisuals = visualsList.map((v) => {
        if (v.type === 'infographic') infoIdx++;
        return scanHistoryForVisual(activeProjectPath, v, ch.id, idx, infoIdx);
      });
      return { ...ch, visualPoints: updatedVisuals, visuals: updatedVisuals };
    });

    let updatedPendingVisuals = pendingVisuals;
    if (pendingVisuals && Array.isArray(pendingVisuals)) {
      const chapterInfoCounters = {};
      updatedPendingVisuals = pendingVisuals.map((v) => {
        const chId = v.chapterId || 'unknown';
        const chIdx = issues.findIndex((ch) => ch.id === chId);
        if (!chapterInfoCounters[chId]) chapterInfoCounters[chId] = 0;
        if (v.type === 'infographic') chapterInfoCounters[chId]++;
        return scanHistoryForVisual(activeProjectPath, v, chId, chIdx >= 0 ? chIdx : 0, chapterInfoCounters[chId]);
      });
    }

    res.status(200).json({ success: true, issues: updatedIssues, pendingVisuals: updatedPendingVisuals });
  } catch (err) {
    console.error("[Sync History Error]:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/open-folder', (req, res) => {
  const { path: folderPath } = req.body;
  if (folderPath && fs.existsSync(folderPath)) {
    const cmd = process.platform === 'darwin' ? `open "${folderPath}"` : `explorer "${folderPath}"`;
    exec(cmd);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Path not found' });
  }
});

app.post('/api/open-file-location', (req, res) => {
  const { path: filePath } = req.body;
  if (filePath && fs.existsSync(filePath)) {
    let cmd;
    if (process.platform === 'darwin') {
      cmd = `open -R "${filePath}"`;
    } else {
      const winPath = filePath.replace(/\//g, '\\');
      cmd = `explorer.exe /select,"${winPath}"`;
    }
    exec(cmd);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/migrate-assets-v3', async (req, res) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error("Invalid project path provided for migration.");
    }

    const sourceDir = path.resolve(__dirname, 'public/assets/visuals');
    const targetAssetsDir = path.join(projectPath, 'assets');
    const targetPromptsDir = path.join(projectPath, 'prompts');

    if (!fs.existsSync(targetAssetsDir)) fs.mkdirSync(targetAssetsDir, { recursive: true });
    if (!fs.existsSync(targetPromptsDir)) fs.mkdirSync(targetPromptsDir, { recursive: true });

    const report = {
      copiedImages: [],
      copiedPrompts: [],
      existing: [],
      errors: []
    };

    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        const srcPath = path.join(sourceDir, file);
        const ext = path.extname(file).toLowerCase();
        const targetDir = (ext === '.md') ? targetPromptsDir : targetAssetsDir;
        const destPath = path.join(targetDir, file);

        if (fs.existsSync(destPath)) {
          report.existing.push(file);
          continue;
        }

        try {
          fs.copyFileSync(srcPath, destPath);
          if (ext === '.md') {
            report.copiedPrompts.push(file);
          } else {
            report.copiedImages.push(file);
          }
        } catch (err) {
          report.errors.push(`${file}: ${err.message}`);
        }
      }
    }

    res.status(200).json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wechat-accounts', (req, res) => {
  try {
    const possiblePaths = [
      path.join(os.homedir(), '.baoyu-skills', 'baoyu-post-to-wechat', 'EXTEND.md'),
      path.join(os.homedir(), 'cc/.baoyu-skills/baoyu-post-to-wechat/EXTEND.md'),
      'D:\\cc\\.baoyu-skills\\baoyu-post-to-wechat\\EXTEND.md'
    ];
    
    let accounts = [];
    for (const extendPath of possiblePaths) {
      if (fs.existsSync(extendPath)) {
        const content = fs.readFileSync(extendPath, 'utf8');
        const accountsBlock = content.split('accounts:')[1];
        if (accountsBlock) {
          const accountMatches = accountsBlock.matchAll(/-\s*name:\s*(.*?)\n\s*alias:\s*(.*?)(?:\n|$)/g);
          for (const match of accountMatches) {
            accounts.push({ name: match[1].trim(), alias: match[2].trim() });
          }
        }
        if (accounts.length > 0) break;
      }
    }
    
    if (accounts.length === 0) {
      accounts.push({ name: '默认公众号', alias: 'default' });
    }
    res.status(200).json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wechat-credentials', (req, res) => {
  try {
    const envDir = path.join(os.homedir(), '.baoyu-skills');
    const envPath = path.join(envDir, '.env');
    let credentials = { appId: '', appSecret: '' };
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const getValue = (key) => {
        const regex = new RegExp(`^${key}=(.*)`, 'm');
        const match = content.match(regex);
        return match ? match[1].trim() : '';
      };
      credentials.appId = getValue('WECHAT_APP_ID');
      credentials.appSecret = getValue('WECHAT_APP_SECRET');
    }
    res.status(200).json(credentials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wechat-credentials', (req, res) => {
  try {
    const { appId, appSecret } = req.body;
    const envDir = path.join(os.homedir(), '.baoyu-skills');
    const envPath = path.join(envDir, '.env');
    if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const setEnv = (key, value, currentContent) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (currentContent.match(regex)) return currentContent.replace(regex, `${key}=${value}`);
      return currentContent.trim() + `\n${key}=${value}`;
    };
    let newContent = setEnv('WECHAT_APP_ID', appId, content);
    newContent = setEnv('WECHAT_APP_SECRET', appSecret, newContent);
    fs.writeFileSync(envPath, newContent.trim() + '\n', 'utf8');
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publish-to-wechat', (req, res) => {
  try {
    const { title, content, accountAlias, coverImage, theme, author, summary, wechatAppId, wechatAppSecret, projectPath, chapterId } = req.body;
    const tmpDir = path.join(os.tmpdir(), `reportserialize-wechat-${Date.now()}`);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    let finalContent = content;
    if (projectPath && chapterId !== undefined) {
       finalContent = syncExtensionsWithDisk(content, projectPath, chapterId);
       finalContent = finalContent.replace(/([A-Za-z]:[\\\/].*?[\\\/]assets[\\\/])/g, 'assets/')
                                 .replace(/(\/project-assets\/.*?\/assets\/)/g, 'assets/');
       console.log('[Publish] Content paths normalized to relative.');
    }
    
    const mdPath = path.join(tmpDir, 'post.md');
    
    let mdWithFrontmatter = '---\n';
    mdWithFrontmatter += `title: "${title.replace(/"/g, '\\"')}"\n`;
    if (author) mdWithFrontmatter += `author: "${author.replace(/"/g, '\\"')}"\n`;
    if (summary) mdWithFrontmatter += `digest: "${summary.replace(/"/g, '\\"')}"\n`;
    mdWithFrontmatter += '---\n\n';
    mdWithFrontmatter += finalContent;
    
    fs.writeFileSync(mdPath, mdWithFrontmatter, 'utf8');
    const scriptPath = path.join(__dirname, 'Library', 'Tools', 'baoyu-skills', 'skills', 'baoyu-post-to-wechat', 'scripts', 'wechat-api.ts');
    
    const publicDir = path.resolve(__dirname, 'public');
    
    let finalCoverPath = coverImage;
    if (coverImage && coverImage.startsWith('/')) {
      finalCoverPath = path.join(publicDir, coverImage);
    }

    let finalBaseDir = publicDir;
    if (projectPath && chapterId !== undefined) {
      const activeProjectPath = normalizePath(projectPath);
      const folderName = getChapterFolderName(chapterId);
      const candidate1 = path.join(activeProjectPath, folderName);
      const candidate2 = path.join(activeProjectPath, 'portable_project', folderName);
      // Use whichever has an assets/ directory
      if (fs.existsSync(path.join(candidate2, 'assets'))) {
        finalBaseDir = candidate2;
      } else if (fs.existsSync(path.join(candidate1, 'assets'))) {
        finalBaseDir = candidate1;
      } else {
        finalBaseDir = candidate2; // best guess
      }
      console.log(`[Publish] Using project-based baseDir: ${finalBaseDir}`);
    }

    const traceLog = path.join(__dirname, 'publish_trace.log');
    fs.appendFileSync(traceLog, `[${new Date().toISOString()}] Publish request received: ${title}\n`);

    console.log('[Publish] Starting publish-to-wechat...');
    console.log('[Publish] Title:', title);
    console.log('[Publish] publicDir:', publicDir, '| exists:', fs.existsSync(publicDir));
    console.log('[Publish] coverImage (raw):', coverImage);
    console.log('[Publish] finalCoverPath:', finalCoverPath);
    if (finalCoverPath) {
      console.log('[Publish] coverPath exists on disk:', fs.existsSync(finalCoverPath));
    }

    const allKeys = loadAllApiKeys();
    const resolvedAppId = wechatAppId || allKeys['WECHAT_APP_ID'] || '';
    const resolvedAppSecret = wechatAppSecret || allKeys['WECHAT_APP_SECRET'] || '';
    console.log('[Publish] AppId resolved:', resolvedAppId ? `${resolvedAppId.slice(0,8)}...` : '(empty)');
    console.log('[Publish] AppSecret resolved:', resolvedAppSecret ? '***set***' : '(empty!!)');

    let command = `"${TSX_BIN}" "${scriptPath}" "${mdPath}" --theme ${theme || 'modern'} --basedir "${finalBaseDir}"`;
    if (author) {
      const escapedAuthor = author.replace(/"/g, '\\"');
      command += ` --author "${escapedAuthor}"`;
    }
    if (accountAlias && accountAlias !== 'default') {
      command += ` --account "${accountAlias}"`;
    }
    if (finalCoverPath && fs.existsSync(finalCoverPath)) {
      command += ` --cover "${finalCoverPath}"`;
      console.log('[Publish] Cover image appended to command.');
    } else if (finalCoverPath) {
      console.warn('[Publish] WARNING: Cover path specified but file NOT FOUND:', finalCoverPath);
    }
    
    const env = { 
      ...process.env,
      ...allKeys,
      WECHAT_APP_ID: resolvedAppId || undefined,
      WECHAT_APP_SECRET: resolvedAppSecret || undefined
    };

    console.log('[Publish] Final command:', command);

    const cwd = __dirname;
    exec(command, { encoding: 'utf8', cwd, env }, (err, stdout, stderr) => {
      if (err) {
        const errMsg = stderr || stdout || err.message;
        fs.appendFileSync(traceLog, `[${new Date().toISOString()}] Publish FAILED: ${errMsg}\n`);
        console.error('[Publish Error] Exit code:', err.code);
        console.error('[Publish Error] stderr:', stderr);
        console.error('[Publish Error] stdout:', stdout);
        
        let userMsg = errMsg;
        if (errMsg.includes('No cover image')) {
          userMsg = `❌ 封面图片缺失：文章内容中没有图片，且未选择默认封面。请在「发布设置」中上传一张默认封面图，或在文章正文中插入至少一张图片。\n\n原始错误：${errMsg}`;
        } else if (errMsg.includes('Access token error') || errMsg.includes('access_token')) {
          userMsg = `❌ 微信鉴权失败：AppID 或 AppSecret 不正确，请检查「发布设置」中的凭据配置。\n\n原始错误：${errMsg}`;
        } else if (errMsg.includes('errcode')) {
          userMsg = `❌ 微信 API 错误：${errMsg}`;
        }
        
        res.status(500).json({ error: userMsg });
        return;
      }
      console.log('[Publish] Success! Output:', stdout);
      fs.appendFileSync(traceLog, `[${new Date().toISOString()}] Publish SUCCESS: ${stdout.slice(0, 200)}...\n`);
      res.status(200).json({ success: true, output: stdout });
    });
  } catch (err) {
    console.error('[Publish] Caught exception:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend assets
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`ReportSerialize Pro Production Server running at http://localhost:${PORT}`));