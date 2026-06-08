import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import os from 'os';
import { exec, execSync } from 'child_process';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import JSZip from 'jszip';


// Resolve true Windows Downloads folder, fallback to default homedir
function getDownloadsFolder() {
  try {
    const winPath = execSync('powershell.exe -NoProfile -Command "(New-Object -ComObject Shell.Application).NameSpace(\'shell:Downloads\').Self.Path"', { encoding: 'utf8' }).trim();
    if (winPath && fs.existsSync(winPath)) return winPath;
  } catch (e) {
    console.warn("Could not resolve shell:Downloads via COM, falling back to os.homedir().");
  }
  return path.join(os.homedir(), 'Downloads');
}

// Global project path used for static serving bridge
let CURRENT_PROJECT_PATH = '';

// Hardcoded prompt generator to avoid import resolution issues in Vite config environment
function generateVisualPointExtractionPrompt(content: string, chapterTitle: string, styleName: string = "工业琥珀", mode: string = "all", extraRequirement: string = "", targetCount: number = 2, overrideDNA?: string): string {
  let requirements = "";
  let formatExample = "";
  
  const countStr = targetCount > 0 ? `${targetCount} 个` : "1-2 个";
  const extraDesc = extraRequirement ? `\n          【特别附加要求】: ${extraRequirement}` : "";

  // 视觉 DNA 字典，强化风格一致性
  const STYLE_DNA_MAP: Record<string, string> = {
    "工业琥珀": "【核心视觉】琥珀金 (#FFBF00) 为唯一光源，背景为温暖的米色 (#FDF5E6) 或深工业灰。 【核心材质】发光的琥珀色微晶、半透明聚合材料、技术刻度线。 【氛围】高端 B2B 工业质感，极致专业。 【关键隐喻】当提及 \"OpenClaw\" 时，必须使用“小龙虾 (Crawfish)”的抽象工业形态（如由琥珀金微晶构成的机械螯肢或流线型工业外壳）作为核心视觉符号。 【绝对禁忌】严禁任何蓝色、紫色、冷色调，即使内容涉及“科技”、“网络”也必须通过琥珀色调表现。",
    "深海蓝调": "【核心视觉】深邃蓝 (#0047AB) 与霓虹青色。核心元素：玻璃材质、发光网格、高对比度。禁忌：避免使用暖黄色调。",
    "极简图纸": "【核心视觉】白底黑线、极致简约的工程图纸。核心元素：0.5px 细线、无填充、技术标注。禁忌：禁止出现任何鲜艳颜色。",
    "暗岩专业": "【核心视觉】石墨色调与全息质感。核心元素：深灰色渐变、半透明玻璃、金色点缀。"
  };

  const styleDNA = overrideDNA || STYLE_DNA_MAP[styleName] || `风格：${styleName}`;

  if (mode === "cover") {
    requirements = `1. **核心头图策划 (Abstract Cover)**: 仅策划 1 个。
          - **意境要求**: 必须避免“平铺直叙”地描绘文章标题。请使用“抽象隐喻”或“宏大景观”来表现文章灵魂。
          - **风格锁定**: 必须 100% 服从 ${styleName} 的视觉 DNA，特别是配色方案。
          - **占位符**: anchorText 必须固定设为 [IMAGE_PLACEHOLDER: COVER_METAPHOR]。`;
    formatExample = `[
            {
              "type": "cover",
              "description": "构图建议和视觉描述（必须严格符合 ${styleName} 风格）",
              "labels": "文章标题, 核心关键词...",
              "anchorText": "[IMAGE_PLACEHOLDER: COVER_METAPHOR]"
            }
          ]`;
  } else if (mode === "infographic") {
    requirements = `1. **仅策划信息图 (Infographic Only)**: 策划 ${countStr}。请从文章中找出预留的 [IMAGE_PLACEHOLDER: ...] 标记，将其完整内容（包含中括号）填入 anchorText。`;
    formatExample = `[
            {
              "type": "infographic",
              "description": "逻辑说明（必须符合 ${styleName} 风格）",
              "labels": "文章标题, 核心关键词...",
              "anchorText": "[IMAGE_PLACEHOLDER: INFOGRAPHIC_SUMMARY]"
            }
          ]`;
  } else {
    requirements = `1. **头图 (Cover)**: 策划 1 个。其 anchorText 固定设为 [IMAGE_PLACEHOLDER: COVER_METAPHOR]。
          2. **信息图 (Infographic)**: 策划 ${countStr}。请从文章中找出预留的 [IMAGE_PLACEHOLDER: ...] 标记，将其完整内容（包含中括号）填入 anchorText。如果文中确实没有预留标记，头图仍需保持上述固定 anchorText。`;
    formatExample = `[
            { "type": "cover", "description": "构图与视觉描述（必须符合 ${styleName} 风格）", "labels": "文章标题, 核心关键词...", "anchorText": "[IMAGE_PLACEHOLDER: COVER_METAPHOR]" },
            { "type": "infographic", "description": "逻辑说明（必须符合 ${styleName} 风格）", "labels": "文章标题, 核心关键词...", "anchorText": "[IMAGE_PLACEHOLDER: INFOGRAPHIC_SUMMARY]" }
          ]`;
  }

  return `你是一个专业的 B2B 技术内容出版专家，擅长将复杂的商业逻辑转化为极具美感的视觉意象。
          
          【文章标题】: ${chapterTitle}
          
          【文章内容】: 
          ${content.substring(0, 50000)}${extraDesc}
          
          【策划要求】
          ${requirements}
          ${extraRequirement ? `\n          【特别调优指示 (HIGH PRIORITY)】: ${extraRequirement}\n          (请务必在策划描述中优先体现该指示，并确保其不破坏视觉 DNA 一致性)` : ""}
          
          【视觉风格指南 (CRITICAL - MUST FOLLOW)】
          1. **视觉 DNA**: ${styleDNA}
          2. **视觉一致性**: 你策划的所有画面描述 (description) 必须“字字珠玑”地体现上述【视觉 DNA】。**即使文章标题或内容提到“蓝色”、“寒冷”、“紫色”等词汇，你也必须严格遵守 DNA 的配色方案（如工业琥珀则必须使用琥珀色，禁止蓝色）**。
          3. **风格优先 (DNA OVERRIDE)**: 视觉风格的权重高于内容意境。如果内容是“冷思考”，但 DNA 是“工业琥珀”，你必须用“琥珀色的暖光”来表现“深刻的思考”，绝对禁止切换到蓝色系。
          4. **禁忌色调 (STRICTLY FORBIDDEN)**: 严禁在描述中出现任何与指定 DNA 冲突的颜色或元素。例如，在“工业琥珀”风格下，**绝对禁止**出现“科技蓝”、“紫色”、“霓虹”等冷色调词汇。
          5. **保留专有名词 (PRESERVE TERMS)**: 必须在描述中保留文章的核心英文专有名词（如 "OpenClaw"），不得将其翻译或省略。**注意：OpenClaw 的视觉隐喻是“小龙虾 (Crawfish)”**。
          6. **标签约束 (LABEL RULES)**: 
             - \`labels\` 必须包含且优先显示文章标题。
             - **严禁**在 \`labels\` 中出现任何风格定义或构图方法词汇，如“高端 B2B”、“抽象隐喻”、“琥珀金光源”、“构图方式”等。标签应仅包含文章的主旨关键词和标题。
          7. **语言**: 所有策划方案涉及的所有文字必须使用简体中文，专有名词除外。
          
          【输出格式】
          请严格按照以下 JSON 数组格式返回（不要包含 Markdown 代码块标记）：
          ${formatExample}`;

}

// Simple Vite plugin to handle local file system operations using Express
const localFileAPIPlugin = () => ({
  name: 'local-api-plugin',
  configureServer(server: any) {
    const app = express();
    app.use(express.json({ limit: '200mb' }));

    const SUPPORTED_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg'];

    const normalizePath = (p: string): string => {
      if (!p) return '';
      let norm = p.replace(/\\/g, '/');
      if (process.platform !== 'win32') {
        if (/^[a-zA-Z]:/i.test(norm)) norm = norm.replace(/^[a-zA-Z]:/i, '');
      }
      if (fs.existsSync(norm)) return norm;
      const ccProjectsIndex = norm.toLowerCase().indexOf('/cc/projects/');
      if (ccProjectsIndex !== -1) {
        return path.join(os.homedir(), norm.substring(ccProjectsIndex + 1));
      }
      const projectsIndex = norm.toLowerCase().indexOf('/projects/');
      if (projectsIndex !== -1) {
        return path.join(os.homedir(), norm.substring(projectsIndex + 1));
      }
      const projectName = path.basename(norm) || 'ImportedProject';
      return path.join(os.homedir(), 'PostOS-Projects', projectName);
    };

    const findStableFile = (dir: string, baseName: string) => {
      if (!fs.existsSync(dir)) return null;
      for (const ext of SUPPORTED_EXTENSIONS) {
        const fullPath = path.join(dir, `${baseName}${ext}`);
        if (fs.existsSync(fullPath)) return { name: `${baseName}${ext}`, path: fullPath, ext };
      }
      return null;
    };

    const ensureSingleStableFile = (dir: string, baseName: string, sourcePath: string) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const ext = path.extname(sourcePath).toLowerCase() || '.png';
      const targetName = `${baseName}${ext}`;
      const targetPath = path.join(dir, targetName);
      
      // 1. Delete all other potential stable files
      SUPPORTED_EXTENSIONS.forEach(e => {
        const p = path.join(dir, `${baseName}${e}`);
        if (fs.existsSync(p) && p.toLowerCase() !== targetPath.toLowerCase()) {
          try { fs.unlinkSync(p); } catch (err) {}
        }
      });
      
      // 2. Copy source to stable
      if (fs.existsSync(sourcePath) && sourcePath.toLowerCase() !== targetPath.toLowerCase()) {
        fs.copyFileSync(sourcePath, targetPath);
      }
      return targetName;
    };
    app.use(express.raw({ limit: '200mb', type: 'application/octet-stream' }));

    // Middleware to serve current project assets
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
      try {
        fs.appendFileSync(path.join(__dirname, 'server_debug.log'), `[${new Date().toISOString()}] AssetRequest: ${requestedPath} (Project: ${CURRENT_PROJECT_PATH})\n`);
      } catch (e) {}
      
      // 1. Try exact physical path match (it should include Issue_X now)
      const exactPath = path.join(CURRENT_PROJECT_PATH, requestedPath);
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
            return lf.includes('cover') && SUPPORTED_EXTENSIONS.some(ext => lf.endsWith(ext));
          });
        } else if (isInfographic) {
          fallbackFile = files.find(f => {
            const lf = f.toLowerCase();
            return (lf.includes('infographic') || lf.includes('asset')) && SUPPORTED_EXTENSIONS.some(ext => lf.endsWith(ext));
          });
        }
        
        if (fallbackFile) {
          const fallbackPath = path.join(parentDir, fallbackFile);
          if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
            return res.sendFile(fallbackPath);
          }
        }
      }

      // 3. Fallback: If it's a legacy or malformed path, we still want to be safe but explicit
      res.status(404).send('Asset not found');
    });

    // Helper to standardize chapter folder names (e.g., issue-1 -> Issue_1)
    const getChapterFolderName = (chapterId: any) => {
      const idStr = String(chapterId);
      const numPart = idStr.replace('issue-', '');
      const standardName = `Issue_${numPart}`;
      const legacyName = `Issue_issue-${numPart}`;
      
      // If we are in a context where we can check the filesystem (via CURRENT_PROJECT_PATH)
      if (CURRENT_PROJECT_PATH && fs.existsSync(CURRENT_PROJECT_PATH)) {
        if (!fs.existsSync(path.join(CURRENT_PROJECT_PATH, standardName)) && fs.existsSync(path.join(CURRENT_PROJECT_PATH, legacyName))) {
          return legacyName;
        }
      }
      return standardName;
    };

    // Helper to convert anchor text to a folder-safe slug (e.g., [IMAGE_PLACEHOLDER: COVER_METAPHOR] -> cover)
    // Now supports indexing for multiple infographics
    const getAnchorSlug = (anchorText: string, infographicIndex?: number, type?: string) => {
      if (!anchorText && !type) return 'asset';
      const lower = (anchorText || '').toLowerCase();
      const lowerType = (type || '').toLowerCase();
      
      // Cover takes priority
      if (lower.includes('cover') || lowerType === 'cover') return 'cover';
      // Infographics are numbered 1, 2, 3...
      if (lower.includes('infographic') || lower.includes('placeholder') || lowerType === 'infographic') {
        return `infographic_${infographicIndex || 1}`;
      }
      return `asset_${infographicIndex || 1}`;
    };

    // DISK SYNC HELPER TEST
    // Shared Helper to save visual + prompt with Nested Subfolder Support
    const makeContentPortable = (content: string, prefix: string = 'assets/') => {
      let portable = (content || '')
        .replace(/\/project-assets\/[^/]+\/assets\//g, prefix)
        .replace(/\(\/(assets\/)/g, `(${prefix}`) // NEW: Strip leading slash from (assets/...) -> (assets/...)
        .replace(/\/assets\/visuals\//g, prefix);
      
      // If the prefix is not 'assets/', we need to adjust the following regexes
      const p = prefix.endsWith('/') ? prefix : prefix + '/';
      
      // Standardize to subfolder structure if missing (only for files in root assets dir)
      portable = portable.replace(new RegExp(`\\b${p}cover(-[0-9]+)?\\.(png|webp|jpg|jpeg)\\b`, 'g'), `${p}cover/cover.$2`);
      
      // FIX: Don't brute-force infographic_1. Only strip timestamps from files already in their subfolders.

      // Strip timestamps from stable structure
      portable = portable.replace(new RegExp(`(${p}(?:cover|infographic_[0-9]+)\/)(cover|infographic)-[0-9]+\\.(png|webp|jpg|jpeg)`, 'g'), '$1$2.$3')
                         .replace(/((?:cover|infographic))-[0-9]+\.(png|webp|jpg|jpeg)/g, '$1.$2');
      
      return portable;
    };

    const syncExtensionsWithDisk = (content: string, projectPath: string, chapterId: string | number) => {
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

    const saveVisualWithMigration = (v: any, infographicIndex: number, baseAssetsDir: string, basePromptsDir: string, projectPathOverride?: string, chapterId?: string | number) => {
      let srcPath = v.absolutePath;
      if (!srcPath) return v;

      const slug = getAnchorSlug(v.anchorText, infographicIndex, v.type);
      const targetAssetsDir = path.join(baseAssetsDir, slug);
      const targetPromptsDir = path.join(basePromptsDir, slug);

      if (!fs.existsSync(targetAssetsDir)) fs.mkdirSync(targetAssetsDir, { recursive: true });
      if (!fs.existsSync(targetPromptsDir)) fs.mkdirSync(targetPromptsDir, { recursive: true });
      
      if (!fs.existsSync(srcPath)) {
        // Check if it's already migrated
        const filename = path.basename(srcPath);
        const migratedPath = path.join(targetAssetsDir, filename);
        const legacyPath = path.join(baseAssetsDir, filename); // Check old flat structure
        
        if (fs.existsSync(migratedPath)) {
          srcPath = migratedPath;
        } else if (fs.existsSync(legacyPath)) {
          srcPath = legacyPath;
        } else {
          return v; // Lost file
        }
      }

      const filename = path.basename(srcPath);
      const destImagePath = path.join(targetAssetsDir, filename);
      
      const promptFilename = filename.split('.')[0] + '.md';
      const destPromptPath = path.join(targetPromptsDir, promptFilename);
      
      // Update prompt metadata file if needed
      try {
        const promptContent = `# Visual Asset Prompt: ${filename}\n\n` +
          `## Description\n${v.description || 'N/A'}\n\n` +
          `## Style DNA\n${v.styleDNA || 'N/A'}\n\n` +
          `## Labels\n${v.labels || 'N/A'}\n\n` +
          `## Anchor Text\n\`${v.anchorText || ''}\`\n`;
        fs.writeFileSync(destPromptPath, promptContent, 'utf8');
      } catch (e) { console.error("Failed to update prompt metadata", e); }

      // CRITICAL: Maintain a stable copy (e.g., cover.png) for Markdown consistency
      const isCover = filename.toLowerCase().includes('cover');
      const stableBase = isCover ? 'cover' : 'infographic';
      const stableFilename = ensureSingleStableFile(targetAssetsDir, stableBase, srcPath);
      const destStablePath = path.join(targetAssetsDir, stableFilename);
      
      try {
        // Only copy if it's not already the stable file (prevent self-copy loops)
        if (destImagePath !== destStablePath && fs.existsSync(destImagePath)) {
          fs.copyFileSync(destImagePath, destStablePath);
        } else if (srcPath !== destStablePath && fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destStablePath);
        }
      } catch (e) { console.error("Failed to maintain stable asset copy", e); }

      // Return updated metadata with correct relative path
      const baseProjPath = projectPathOverride || CURRENT_PROJECT_PATH;
      const finalChapterId = chapterId || v.chapterId || 'unknown';
      const folderName = getChapterFolderName(finalChapterId);
      
      const stablePath = `assets/${slug}/${stableFilename}`;
      
      return {
        ...v,
        path: stablePath, // Always use stable name for Markdown persistence
        absolutePath: destImagePath.replace(/\\/g, '/'),
        activeTimestampPath: stablePath // Force consistency even for active path
      };
    };

    // Robust JSON Extractor helper
    const safeJsonParse = (raw: string) => {
      try {
        let jsonStr = raw.trim();
        // Remove markdown code blocks if present
        if (jsonStr.startsWith('```')) {
          const lines = jsonStr.split('\n');
          jsonStr = lines.slice(1, -1).join('\n').trim();
        }
        return JSON.parse(jsonStr);
      } catch (e) {
        // Fallback: try to find anything between [ and ]
        const start = raw.indexOf('[');
        const end = raw.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
          try {
            return JSON.parse(raw.substring(start, end + 1));
          } catch (e2) {
            throw e; // throw original
          }
        }
        throw e;
      }
    };

    const LLM_MODELS: Record<string, any> = {
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
      moonshot: {
        name: 'Moonshot (Kimi)',
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        envKey: 'MOONSHOT_API_KEY',
        baseUrl: 'https://api.moonshot.cn/v1'
      },
      dashscope: {
        name: 'Alibaba (Qwen)',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
        envKey: 'DASHSCOPE_API_KEY',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      zhipu: {
        name: 'Zhipu (GLM)',
        models: ['glm-4.5', 'glm-4-plus', 'glm-4-flash', 'glm-4-air'],
        envKey: 'ZHIPUAI_API_KEY',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
      },
      deepseek: {
        name: 'DeepSeek',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        envKey: 'DEEPSEEK_API_KEY',
        baseUrl: 'https://api.deepseek.com'
      },
      siliconflow: {
        name: 'SiliconFlow',
        models: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-14B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'meta-llama/Meta-Llama-3.1-400B-Instruct'],
        envKey: 'SILICONFLOW_API_KEY',
        baseUrl: 'https://api.siliconflow.cn/v1'
      }
    };

    const loadAllApiKeys = () => {
      const keys: Record<string, any> = { ...process.env };
      const envSettings = loadEnv('development', '.', '');
      const globalEnvPath = process.platform === 'win32' ? 'D:\\cc\\.baoyu-skills\\.env' : '/Users/shanfu/cc/.baoyu-skills/.env';
      
      // Load from local .env
      Object.assign(keys, envSettings);
      
      // Load from global .env
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

    const unifiedGenerateContent = async (modelName: string, prompt: string, overrideApiKey?: string, explicitProvider?: string, overrideProjectId?: string, overrideLocation?: string) => {
      const keys = loadAllApiKeys();
      let provider: any = null;
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
            if (config.models.includes(modelName)) {
              provider = config;
              vendorKey = v;
              break;
            }
          }
        }
      }

      if (!provider) {
        // Fallback to gemini if not found
        provider = LLM_MODELS.gemini;
        vendorKey = 'gemini';
      }

      let apiKey = overrideApiKey || keys[provider.envKey];
      
      // Strict rule: If it's a Gemini/Vertex model but no specific key is found, 
      // check if we can use Vertex ADC. Do NOT silently fallback to GEMINI_API_KEY 
      // if Vertex was the intended provider.
      if (!apiKey && vendorKey === 'gemini') {
        apiKey = keys['GEMINI_API_KEY'] || keys['GOOGLE_API_KEY'];
      }
      
      if (!apiKey && vendorKey !== 'vertex') {
        throw new Error(`API Key for ${provider.name} (${provider.envKey}) is missing.`);
      }

      // Force Vertex if the key looks like a file path (Service Account JSON)
      const isKeyPath = apiKey.includes('/') || apiKey.includes('\\') || apiKey.includes(':');
      if (isKeyPath && vendorKey !== 'vertex') {
        console.log(`[LLM Router] API Key detected as file path. Overriding provider ${vendorKey} -> vertex. Model: ${modelName}`);
        vendorKey = 'vertex';
      } else {
        console.log(`[LLM Router] Selected provider: ${vendorKey}, Model: ${modelName}`);
      }

      if (vendorKey === 'gemini') {
        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model: modelName });
        const result = await genModel.generateContent(prompt);
        return result.response.text();
      } else if (vendorKey === 'vertex') {
        const projectId = overrideProjectId || keys['VERTEX_PROJECT_ID'];
        const location = overrideLocation || keys['VERTEX_LOCATION'] || keys['GOOGLE_CLOUD_LOCATION'] || 'global';
        const keyPath = overrideApiKey || keys['VERTEX_SA_KEY_PATH'] || 'C:\\Users\\furun\\AppData\\Roaming\\gcloud\\application_default_credentials.json';
        
        if (!projectId) throw new Error("Vertex Project ID (VERTEX_PROJECT_ID) is missing.");
        
        // Pass credentials path via ENV for the SDK to pick up
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
        
        const vertexAI = new VertexAI({ 
          project: projectId, 
          location: location, 
          apiOptions: { apiVersion: 'v1beta1' },
          apiEndpoint: location === 'global' ? 'aiplatform.googleapis.com' : undefined
        } as any);
        let vertexModelName = modelName;
        // Strip provider prefix if present (e.g. "google:..." or "google/...")
        if (vertexModelName.includes(':')) vertexModelName = vertexModelName.split(':')[1];
        // Standardize: The Vertex SDK handles model ID to resource name mapping.
        // Explicitly prefixing with publishers/google/models/ can cause double-prefixing.


        const generativeModel = vertexAI.getGenerativeModel({
          model: vertexModelName,
        });

        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        return response.candidates?.[0].content.parts?.[0].text || "";
      } else {
        // OpenAI-compatible
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
          })
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`${provider.name} API error (${response.status}): ${err}`);
        }

        const resJson: any = await response.json();
        return resJson.choices[0].message.content;
      }
    };

    app.get('/api/list-llm-models', (req, res) => {
      res.status(200).json(LLM_MODELS);
    });

    app.post('/api/generate-content', async (req, res) => {
      try {
        const { model, prompt, llmApiKey, provider, vertexProjectId, vertexLocation } = req.body;
        const result = await unifiedGenerateContent(model, prompt, llmApiKey, provider, vertexProjectId, vertexLocation);
        res.status(200).json({ text: result });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/get-styles', (req, res) => {
      try {
        const humanizerPath = 'D:\\cc\\Library\\Agents\\Humanizer\\SKILL.md';
        const writingStylePath = 'D:\\cc\\Library\\Tools\\WritingStyle\\SKILL.md';
        
        const humanizer = fs.existsSync(humanizerPath) ? fs.readFileSync(humanizerPath, 'utf8') : '';
        const writingStyle = fs.existsSync(writingStylePath) ? fs.readFileSync(writingStylePath, 'utf8') : '';
        
        res.status(200).json({ humanizer, writingStyle });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-zip', (req, res) => {
      try {
        const body = req.body;
        const downloadsPath = getDownloadsFolder();
        const timestamp = new Date().toISOString().replace(/[:\.]/g, '-');
        const targetPath = path.join(downloadsPath, `连载系列_全部篇目_${timestamp}.zip`);
        fs.writeFileSync(targetPath, body);
        res.status(200).json({ path: targetPath });
      } catch (err: any) {
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
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/open-folder', (req, res) => {
      const { path: folderPath } = req.body;
      if (folderPath && fs.existsSync(folderPath)) {
        exec(`explorer "${folderPath}"`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Path not found' });
      }
    });

    app.post('/api/open-file-location', (req, res) => {
      const { path: filePath } = req.body;
      if (filePath && fs.existsSync(filePath)) {
        // Use explorer /select to open parent and select the file
        const winPath = filePath.replace(/\//g, '\\');
        exec(`explorer.exe /select,"${winPath}"`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    });

    app.post('/api/unzip-project', async (req, res) => {
      try {
        const projectPath = req.headers['x-project-path'] as string;
        if (!projectPath) {
          return res.status(400).json({ error: 'Missing X-Project-Path header' });
        }
        const body = req.body;
        if (!body || body.length === 0) {
          return res.status(400).json({ error: 'Empty ZIP content' });
        }

        const zip = await JSZip.loadAsync(body);
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

        CURRENT_PROJECT_PATH = targetDir;
        res.status(200).json({ success: true, path: targetDir });
      } catch (err: any) {
        console.error('[Unzip Error]', err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-state', (req, res) => {
      try {
        const statePath = path.join(__dirname, '.app_state.json');
        const state = req.body;
        
        // Critical State Guardrail: Prevent accidental overwriting of populated state with empty content
        if (fs.existsSync(statePath)) {
          try {
            const oldContent = fs.readFileSync(statePath, 'utf8');
            const oldState = JSON.parse(oldContent);
            
            // 1. Content Length Check (Suspicious Empty)
            const oldHasContent = oldState.issues?.some((i: any) => i.content && i.content.length > 500);
            const newHasContent = state.issues?.some((i: any) => i.content && i.content.length > 100);
            
            if (oldHasContent && !newHasContent && state.issues?.length > 0) {
              const backupPath = path.join(__dirname, `.app_state.json.emergency_${Date.now()}`);
              fs.writeFileSync(backupPath, oldContent);
              console.error(`[SaveGuard] Content collapse detected! Backup: ${backupPath}`);
              return res.status(400).json({ 
                error: '检测到严重的内容丢失（疑似由于编辑器未正常加载）！保存已被拦截，请刷新页面恢复。', 
                backupPath 
              });
            }

            // 2. Newline Density Check (Formatting Loss)
            // We check the total count of double newlines across all issues
            const countNewlines = (s: any) => (s.issues || []).reduce((acc: number, cur: any) => acc + (cur.content?.split('\n\n').length || 0), 0);
            const oldNL = countNewlines(oldState);
            const newNL = countNewlines(state);

            if (oldNL > 15 && newNL < oldNL * 0.4) {
              const backupPath = path.join(__dirname, `.app_state.json.formatting_lost_${Date.now()}`);
              fs.writeFileSync(backupPath, oldContent);
              console.error(`[SaveGuard] Formatting collapse! Old: ${oldNL}, New: ${newNL}. Backup: ${backupPath}`);
              return res.status(400).json({ 
                error: `检测到严重的排版异常（段落间距大量消失）！原分段数: ${oldNL}, 现分段数: ${newNL}。保存已被拦截，请刷新页面尝试恢复。`,
                backupPath
              });
            }
          } catch (e) {
            console.error('[SaveGuard] Failed to run safety check', e);
          }
        }

        // Sync global project path for static serving
        if (state.projectPath) {
          state.projectPath = normalizePath(state.projectPath);
          CURRENT_PROJECT_PATH = state.projectPath;
        }
        
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
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
          
          res.setHeader('Content-Type', 'application/json');
          res.status(200).send(JSON.stringify(state, null, 2));
        } else {
          res.status(404).json({ error: 'Not found' });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
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
          copiedImages: [] as string[],
          copiedPrompts: [] as string[],
          existing: [] as string[],
          errors: [] as string[]
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
            } catch (err: any) {
              report.errors.push(`${file}: ${err.message}`);
            }
          }
        }

        res.status(200).json({ success: true, report });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/select-image', async (req, res) => {
      try {
        if (process.platform === 'darwin') {
          const command = `osascript -e 'POSIX path of (choose file of type {"png", "jpg", "jpeg", "webp"} with prompt "选择默认缩略图")'`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        } else {
          const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Images|*.jpg;*.jpeg;*.png;*.webp;*.avif;*.gif'; $f.Title = 'Select Cover Image'; $f.ShowDialog() | Out-Null; $f.FileName"`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/select-folder', async (req, res) => {
      try {
        if (process.platform === 'darwin') {
          const command = `osascript -e 'POSIX path of (choose folder with prompt "选择项目文件夹")'`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        } else {
          const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Project Root Folder'; $f.ShowDialog() | Out-Null; $f.SelectedPath"`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/select-key', async (req, res) => {
      try {
        if (process.platform === 'darwin') {
          const command = `osascript -e 'POSIX path of (choose file of type {"json"} with prompt "选择 Service Account Key (.json)")'`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        } else {
          const command = `powershell -NoProfile -ExecutionPolicy Bypass -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'JSON|*.json'; $f.ShowDialog() | Out-Null; $f.FileName"`;
          exec(command, (err, stdout) => {
            if (err) return res.status(200).json({ path: '' });
            res.status(200).json({ path: stdout.trim() });
          });
        }
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/wechat-accounts', (req, res) => {
      try {
        const possiblePaths = [
          path.join(os.homedir(), '.baoyu-skills', 'baoyu-post-to-wechat', 'EXTEND.md'),
          '/Users/shanfu/cc/.baoyu-skills/baoyu-post-to-wechat/EXTEND.md',
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
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/publish-to-wechat', (req, res) => {
      try {
        const { title, content, accountAlias, coverImage, theme, author, summary, wechatAppId, wechatAppSecret, projectPath, chapterId } = req.body;
        const tmpDir = path.join(os.tmpdir(), `reportserialize-wechat-${Date.now()}`);
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        
        // --- CRITICAL: DISK-DRIVEN EXTENSION SYNC BEFORE PUBLISHING ---
        let finalContent = content;
        if (projectPath && chapterId !== undefined) {
           finalContent = syncExtensionsWithDisk(content, projectPath, chapterId);
           // Also ensure paths are project-relative (strip absolute temp or project paths)
           finalContent = finalContent.replace(/([A-Za-z]:[\\\/].*?[\\\/]assets[\\\/])/g, 'assets/')
                                     .replace(/(\/project-assets\/.*?\/assets\/)/g, 'assets/');
           console.log('[Publish] Content paths normalized to relative.');
        }
        
        const mdPath = path.join(tmpDir, 'post.md');
        
        // Prepend frontmatter to ensure correct encoding (avoid CLI argument mangling on Windows)
        let mdWithFrontmatter = '---\n';
        mdWithFrontmatter += `title: "${title.replace(/"/g, '\\"')}"\n`;
        if (author) mdWithFrontmatter += `author: "${author.replace(/"/g, '\\"')}"\n`;
        if (summary) mdWithFrontmatter += `digest: "${summary.replace(/"/g, '\\"')}"\n`;
        mdWithFrontmatter += '---\n\n';
        mdWithFrontmatter += finalContent;
        
        fs.writeFileSync(mdPath, mdWithFrontmatter, 'utf8');
        const scriptPath = process.platform === 'win32'
          ? 'D:\\cc\\Library\\Tools\\baoyu-skills\\skills\\baoyu-post-to-wechat\\scripts\\wechat-api.ts'
          : '/Users/shanfu/cc/Library/Tools/baoyu-skills/skills/baoyu-post-to-wechat/scripts/wechat-api.ts';
        
        const publicDir = path.resolve(__dirname, 'public');
        
        // Resolve cover image path if it's a relative URL
        let finalCoverPath = coverImage;
        if (coverImage && coverImage.startsWith('/')) {
          finalCoverPath = path.join(publicDir, coverImage);
        }

        // Determine final base directory for image resolution
        let finalBaseDir = publicDir;
        if (projectPath && chapterId !== undefined) {
           const folderName = getChapterFolderName(chapterId);
           finalBaseDir = path.join(projectPath, folderName);
           console.log(`[Publish] Using project-based baseDir: ${finalBaseDir}`);
        }

        // ===== TRACE LOG =====
        const traceLog = process.platform === 'win32' ? 'D:\\cc\\publish_trace.log' : '/Users/shanfu/cc/publish_trace.log';
        fs.appendFileSync(traceLog, `[${new Date().toISOString()}] Publish request received: ${title}\n`);

        // ===== DIAGNOSTIC LOGGING =====
        console.log('[Publish] Starting publish-to-wechat...');
        console.log('[Publish] Title:', title);
        console.log('[Publish] publicDir:', publicDir, '| exists:', fs.existsSync(publicDir));
        console.log('[Publish] coverImage (raw):', coverImage);
        console.log('[Publish] finalCoverPath:', finalCoverPath);
        if (finalCoverPath) {
          console.log('[Publish] coverPath exists on disk:', fs.existsSync(finalCoverPath));
        }

        // Load global credentials (fallback to baoyu-skills env)
        const allKeys = loadAllApiKeys();
        const resolvedAppId = wechatAppId || allKeys['WECHAT_APP_ID'] || '';
        const resolvedAppSecret = wechatAppSecret || allKeys['WECHAT_APP_SECRET'] || '';
        console.log('[Publish] AppId resolved:', resolvedAppId ? `${resolvedAppId.slice(0,8)}...` : '(empty)');
        console.log('[Publish] AppSecret resolved:', resolvedAppSecret ? '***set***' : '(empty!!)');

        let command = `bun "${scriptPath}" "${mdPath}" --theme ${theme || 'modern'} --basedir "${finalBaseDir}"`;
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
          console.warn('[Publish] Will attempt publish without cover (fallback to first body image).');
        }
        
        // Pass credentials via environment variables --include global env keys too
        const env = { 
          ...process.env,
          ...allKeys,
          WECHAT_APP_ID: resolvedAppId || undefined,
          WECHAT_APP_SECRET: resolvedAppSecret || undefined
        };

        console.log('[Publish] Final command:', command);

        const cwd = process.platform === 'win32' ? 'D:\\cc' : '/Users/shanfu/cc';
        exec(command, { encoding: 'utf8', cwd, env }, (err, stdout, stderr) => {
          if (err) {
            const errMsg = stderr || stdout || err.message;
            fs.appendFileSync(traceLog, `[${new Date().toISOString()}] Publish FAILED: ${errMsg}\n`);
            console.error('[Publish Error] Exit code:', err.code);
            console.error('[Publish Error] stderr:', stderr);
            console.error('[Publish Error] stdout:', stdout);
            
            // Parse the error for a user-friendly message
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
      } catch (err: any) {
        console.error('[Publish] Caught exception:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/api/wechat-credentials', (req, res) => {
      try {
        const envPath = process.platform === 'win32' ? 'D:\\cc\\.baoyu-skills\\.env' : '/Users/shanfu/cc/.baoyu-skills/.env';
        let credentials = { appId: '', appSecret: '' };
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          const getValue = (key: string) => {
            const regex = new RegExp(`^${key}=(.*)`, 'm');
            const match = content.match(regex);
            return match ? match[1].trim() : '';
          };
          credentials.appId = getValue('WECHAT_APP_ID');
          credentials.appSecret = getValue('WECHAT_APP_SECRET');
        }
        res.status(200).json(credentials);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/wechat-credentials', (req, res) => {
      try {
        const { appId, appSecret } = req.body;
        const envDir = process.platform === 'win32' ? 'D:\\cc\\.baoyu-skills' : '/Users/shanfu/cc/.baoyu-skills';
        const envPath = path.join(envDir, '.env');
        if (!fs.existsSync(envDir)) fs.mkdirSync(envDir, { recursive: true });
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const setEnv = (key: string, value: string, currentContent: string) => {
          const regex = new RegExp(`^${key}=.*`, 'm');
          if (currentContent.match(regex)) return currentContent.replace(regex, `${key}=${value}`);
          return currentContent.trim() + `\n${key}=${value}`;
        };
        let newContent = setEnv('WECHAT_APP_ID', appId, content);
        newContent = setEnv('WECHAT_APP_SECRET', appSecret, newContent);
        fs.writeFileSync(envPath, newContent.trim() + '\n', 'utf8');
        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
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
        
        // Log a snippet of the raw response to check for color hallucinations
        console.log(`[Visual Extraction] AI Response snippet: ${rawContent.substring(0, 200)}...`);
        
        const points = safeJsonParse(rawContent);
        console.log(`[Visual Extraction] Success! Points extracted: ${points.length}`);
        res.status(200).json({ success: true, points });
      } catch (err: any) {
        console.error("Visual Extraction Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/generate-asset', async (req, res) => {
      const timestamp = Date.now();
      try {
        const { description, type, chapterId, labels, styleDNA, imageModel, imageKey, vertexProjectId, vertexLocation, anchorText, infographicIndex } = req.body;
        const slug = getAnchorSlug(anchorText, infographicIndex, type);
        const activeFilename = `${type || 'asset'}-${timestamp}.png`; // Back to .png as default per user request
        const keys = loadAllApiKeys();
        
        // Parse imageModel: "provider:model"
        let imgProvider = "google";
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
        
        // Target project directory if projectPath is set, otherwise fall back to public
        const currentProject = req.body.projectPath || CURRENT_PROJECT_PATH;
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
        
        // Stable naming: User now wants timestamped names directly in the slug folder.
        const outputPath = path.join(outputDir, activeFilename);
        const imagineScript = '/Users/shanfu/cc/Library/Tools/baoyu-skills/skills/baoyu-imagine/scripts/main.ts';
        
        const promptFilename = activeFilename.split('.')[0] + '.md';
        const promptPath = path.join(promptDir, promptFilename);
        const promptContent = `# Image Generation Prompt\n\n- **Asset**: ${activeFilename}\n- **Chapter**: ${chapterId}\n- **Type**: ${type}\n- **Anchor**: ${anchorText}\n- **DNA**: ${finalStyleDNA}\n\n## Description\n${description}\n\n## Labels\n${labels}`;
        fs.writeFileSync(promptPath, promptContent, 'utf8');

        // Prepare full prompt
        const fullPrompt = `[MASTER STYLE DNA]: ${finalStyleDNA}\n[VISUAL CONTENT]: ${description}\n[LABELS]: ${labels}\n\nSTRICT INSTRUCTIONS:\n1. Use ONLY colors and motifs defined in [MASTER STYLE DNA].\n2. IF [MASTER STYLE DNA] mentions specific colors (like Amber/Gold), IGNORE any color suggestions in [VISUAL CONTENT] that would introduce cool tones (Blue/Purple).\n3. Keep English technical terms (e.g. OpenClaw) if mentioned.`;

        const tmpPromptPath = path.join(os.tmpdir(), `prompt-${timestamp}.txt`);
        fs.writeFileSync(tmpPromptPath, fullPrompt, 'utf8');
        
        const cmd = `bun "${imagineScript}" --promptfiles "${tmpPromptPath}" --image "${outputPath.replace(/\\/g, '/')}" --ar 16:9 --provider ${imgProvider} --model "${model}"`;
        
        const env = { 
          ...process.env, 
          ...keys,
          GOOGLE_API_KEY: keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY,
          REPLICATE_API_TOKEN: (imgProvider === 'replicate' ? imageKey : '') || keys.REPLICATE_API_TOKEN,
          ARK_API_KEY: (imgProvider === 'seedream' ? imageKey : '') || keys.ARK_API_KEY,
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
            } as any);
            
            const generativeModel = vertexAI.getGenerativeModel({ model: model });

            console.log(`[Vertex SDK] Generating image with ${model} in ${location}...`);
            const result = await generativeModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
              generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig: { imageSize: "1K" }
              }
            } as any);

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
            } as any);

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
        } catch (execErr: any) {
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

        // --- STABLE PATH LOGIC ---
        const stableBase = type === 'cover' ? 'cover' : 'infographic';
        const stableFilename = ensureSingleStableFile(outputDir, stableBase, outputPath);
        const stablePath = path.join(outputDir, stableFilename);
        
        try {
          // Also copy prompt to stable location
          const promptSrc = outputPath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
          const promptDest = stablePath.replace(/\.(png|webp|jpg|jpeg)$/, '.md');
          if (fs.existsSync(promptSrc)) fs.copyFileSync(promptSrc, promptDest);
        } catch (e) { console.error("Failed to sync stable asset copy", e); }

        res.status(200).json({ 
          success: true, 
          // path points to the STABLE filename (for Markdown consistency)
          path: `assets/${slug}/${stableFilename}`,
          absolutePath: stablePath.replace(/\\/g, '/'),
          // activeTimestampPath points to the ACTUAL versioned file
          activeTimestampPath: `assets/${slug}/${activeFilename}`,
          activeTimestampAbsolutePath: outputPath.replace(/\\/g, '/')
        });
      } catch (err: any) {
        console.error("Asset Generation Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/restore-history', async (req, res) => {
      try {
        const { sourcePath, targetPath, projectPath } = req.body;
        if (!sourcePath || !targetPath) throw new Error("Missing paths");
        
        // Convert virtual path to physical if needed
        let srcAbsolutePath = sourcePath;
        let destAbsolutePath = targetPath;
        const activeProjectPath = projectPath || CURRENT_PROJECT_PATH;
        
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
        // Perform the restore: Copy versioned file OVER the stable file
        const isCover = path.basename(srcAbsolutePath).toLowerCase().includes('cover');
        const stableBase = isCover ? 'cover' : 'infographic';
        const stableFilename = ensureSingleStableFile(path.dirname(destAbsolutePath), stableBase, srcAbsolutePath);
        const finalDestPath = path.join(path.dirname(destAbsolutePath), stableFilename);
        console.log(`[Restore] Restored to ${finalDestPath}`);
        
        // Also sync prompt
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
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  
      app.post('/api/save-project-chapter', async (req, res) => {
      try {
        const { projectPath, chapterId, chapterTitle, content, visuals } = req.body;
        if (!projectPath) throw new Error("Project path is required");
        
        const folderName = getChapterFolderName(chapterId);
        const chapterDir = path.join(projectPath, folderName);
        const assetsDir = path.join(chapterDir, 'assets');
        const promptsDir = path.join(chapterDir, 'prompts');
        const historyDir = path.join(chapterDir, 'history');
        
        if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
        if (!fs.existsSync(promptsDir)) fs.mkdirSync(promptsDir, { recursive: true });
        if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

        const safeChapterTitle = (chapterTitle || '未命名篇目').replace(/[\\/:*?"<>|]/g, '_');
        const mdPath = path.join(chapterDir, `${safeChapterTitle}.md`);
        
        // Make markdown content portable by converting virtual paths to relative paths
        // AND ensuring we only use STABLE filenames (stripping -TIMESTAMP suffixes)
        let portableContent = makeContentPortable(content, 'assets/');
        fs.writeFileSync(mdPath, portableContent, 'utf8');



        // Save Visual Planning (visual_plan.md)
        if (visuals && Array.isArray(visuals)) {
          let planMd = `# Visual Planning: ${chapterTitle}\n\n`;
          visuals.forEach((v, idx) => {
            planMd += `### Asset ${idx + 1}: ${v.type}\n- **Anchor**: ${v.anchorText}\n- **Description**: ${v.description}\n- **Labels**: ${v.labels}\n\n`;
          });
          fs.writeFileSync(path.join(promptsDir, 'visual_plan.md'), planMd, 'utf8');
        }

        // Sync visuals with Migration Update
        let updatedVisualsList = [];
        if (visuals && Array.isArray(visuals)) {
          let infoIdx = 0;
          updatedVisualsList = visuals.map((v: any) => {
            if (v.type === 'infographic') infoIdx++;
            return saveVisualWithMigration(v, infoIdx, assetsDir, promptsDir, projectPath, chapterId);
          });
          
          // --- CRITICAL: DISK-DRIVEN EXTENSION SYNC ---
          portableContent = syncExtensionsWithDisk(portableContent, projectPath, chapterId);
          fs.writeFileSync(mdPath, portableContent, 'utf8');
        }
        
        res.status(200).json({ success: true, path: chapterDir, updatedVisuals: updatedVisualsList });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/save-full-project', async (req, res) => {
      try {
        const { projectPath, chapters, plan, planVersions, config, chatMessages } = req.body;
        if (!projectPath) throw new Error("Project path is required");
        
        if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });



        // 1. Save Granular Settings
        const settingsDir = path.join(projectPath, 'settings');
        if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
        
        // Business Profile
        fs.writeFileSync(path.join(settingsDir, 'company_business.md'), config.companyBusiness || '', 'utf8');
        // Hotspots
        fs.writeFileSync(path.join(settingsDir, 'hotspots.md'), config.currentHotspot || '', 'utf8');
        // Model Configuration
        const modelConfig = {
          selectedLlmVendor: config.selectedLlmVendor,
          selectedLlmModel: config.selectedLlmModel,
          selectedImageModel: config.selectedImageModel,
          llmApiKey: config.llmApiKey,
          imageApiKey: config.imageApiKey
        };
        fs.writeFileSync(path.join(settingsDir, 'model_config.json'), JSON.stringify(modelConfig, null, 2), 'utf8');
        // Strategy Config
        const strategyConfig = {
          reportPurpose: config.reportPurpose,
          selectedTone: config.selectedTone,
          episodeMode: config.episodeMode,
          episodeCount: config.episodeCount,
          infographicExtraPrompt: config.infographicExtraPrompt,
          infographicTargetCount: config.infographicTargetCount
        };
        fs.writeFileSync(path.join(settingsDir, 'strategy.json'), JSON.stringify(strategyConfig, null, 2), 'utf8');
        // CTA Templates
        const ctaConfig = {
          ctaMode: config.ctaMode,
          exactCtaTemplate: config.exactCtaTemplate,
          generateCtaTemplate: config.generateCtaTemplate
        };
        fs.writeFileSync(path.join(settingsDir, 'cta_templates.json'), JSON.stringify(ctaConfig, null, 2), 'utf8');
        // Custom Styles
        if (config.customStyles) {
          fs.writeFileSync(path.join(settingsDir, 'custom_styles.json'), JSON.stringify(config.customStyles, null, 2), 'utf8');
        }

        // Project Integrity Guard: Prevent overwriting populated files with empty content
        if (chapters && Array.isArray(chapters) && chapters.length > 0) {
           const someOldFileWithContent = chapters.find(ch => {
              const folderName = getChapterFolderName(ch.id);
              const files = fs.existsSync(path.join(projectPath, folderName)) ? fs.readdirSync(path.join(projectPath, folderName)) : [];
              const mdFile = files.find(f => f.endsWith('.md') && !f.includes('history'));
              if (mdFile) {
                 const stat = fs.statSync(path.join(projectPath, folderName, mdFile));
                 return stat.size > 1000;
              }
              return false;
           });
           
           const anyNewContent = chapters.some(ch => ch.content && ch.content.length > 200);
           
           if (someOldFileWithContent && !anyNewContent) {
              console.error("[SaveGuard] Blocked /api/save-full-project: Incoming chapters have no content but disk has content.");
              return res.status(400).json({ error: "检测到文章内容严重缩水（内容丢失风险），保存已拦截。请检查网络或刷新页面。" });
           }
        }
        
        // 2. Save Planning & Plan History
        const planningDir = path.join(projectPath, 'planning');
        const planHistoryDir = path.join(planningDir, 'history');
        if (!fs.existsSync(planHistoryDir)) fs.mkdirSync(planHistoryDir, { recursive: true });
        
        if (plan) {
          fs.writeFileSync(path.join(planningDir, 'current_plan.md'), plan, 'utf8');
        }
        if (planVersions && Array.isArray(planVersions)) {
          planVersions.forEach((pv: string, idx: number) => {
            fs.writeFileSync(path.join(planHistoryDir, `plan_v${idx + 1}.md`), pv, 'utf8');
          });
        }

        // 3. Save Chat History
        if (chatMessages && Array.isArray(chatMessages)) {
          let chatContent = `# AI助手对话记录\n\n`;
          chatMessages.forEach((msg, idx) => {
            chatContent += `### ${msg.role === 'user' ? '用户' : 'AI助手'} (${idx + 1})\n\n${msg.content}\n\n`;
          });
          fs.writeFileSync(path.join(projectPath, '01_AI助手对话记录.md'), chatContent, 'utf8');
        }
        
        // 4. Save each chapter with History
        if (chapters && Array.isArray(chapters)) {
          chapters.forEach((ch, idx) => {
            const paddedIdx = String(idx + 1).padStart(2, '0');
            const chapterOrder = idx + 1;
            const folderName = getChapterFolderName(chapterOrder);
            const chDir = path.join(projectPath, folderName);
            
            const chHistoryDir = path.join(chDir, 'history');
            const chAssetsDir = path.join(chDir, 'assets');
            const chPromptsDir = path.join(chDir, 'prompts');
            
            if (!fs.existsSync(chHistoryDir)) fs.mkdirSync(chHistoryDir, { recursive: true });
            if (!fs.existsSync(chAssetsDir)) fs.mkdirSync(chAssetsDir, { recursive: true });
            if (!fs.existsSync(chPromptsDir)) fs.mkdirSync(chPromptsDir, { recursive: true });
            
            const safeTitle = (ch.title || `连载_${paddedIdx}`).replace(/[\\/:*?"<>|]/g, '_');
            // 4.1 Migrate Visuals FIRST to get stable paths from disk
            if (ch.visuals && Array.isArray(ch.visuals)) {
              let infoIdx = 0;
              ch.visuals = ch.visuals.map((v: any) => {
                if (v.type === 'infographic') infoIdx++;
                const updatedV = saveVisualWithMigration(v, infoIdx, chAssetsDir, chPromptsDir, projectPath, ch.id || chapterOrder);
                if (v.history && Array.isArray(v.history)) {
                  // Fix: Exclude 'history' from v when creating history entry objects to prevent recursion
                  const { history: _, ...vWithoutHistory } = v;
                  updatedV.history = v.history.map((h: any) => {
                    const { history: __, ...hWithoutHistory } = h;
                    return saveVisualWithMigration({ ...vWithoutHistory, ...hWithoutHistory }, infoIdx, chAssetsDir, chPromptsDir, projectPath, ch.id || chapterOrder);
                  });
                }
                return updatedV;
              });
            }

            // 4.2 Save Markdown with disk-driven extension sync
            let portableContent = makeContentPortable(ch.content, 'assets/');
            portableContent = syncExtensionsWithDisk(portableContent, projectPath, ch.id || chapterOrder);
            fs.writeFileSync(path.join(chDir, `${safeTitle}.md`), portableContent, 'utf8');
            
            // 4.3 Save History
            if (ch.versions && Array.isArray(ch.versions)) {
              ch.versions.forEach((v: any, vIdx: number) => {
                const ts = v.timestamp ? new Date(v.timestamp).toISOString().replace(/[:.]/g, '-') : vIdx;
                const portableHistory = makeContentPortable(v.content, '../assets/');
                fs.writeFileSync(path.join(chHistoryDir, `version_${vIdx + 1}_${ts}.md`), portableHistory, 'utf8');
              });
            }
            
            // 4.4 Save Visual Plan
            if (ch.visuals && Array.isArray(ch.visuals)) {
              let planMd = `# Visual Planning: ${ch.title}\n\n`;
              ch.visuals.forEach((v: any, vIdx: number) => {
                planMd += `### Asset ${vIdx + 1}: ${v.type}\n- **Anchor**: ${v.anchorText}\n- **Description**: ${v.description}\n- **Labels**: ${v.labels}\n\n`;
              });
              fs.writeFileSync(path.join(chPromptsDir, 'visual_plan.md'), planMd, 'utf8');
            }
          });
        }
        // 5. Save Master JSON for easy loading/backfilling
        const fullState = {
          issues: chapters,
          plan: plan,
          planVersions: planVersions,
          config: config,
          chatMessages: chatMessages,
          projectPath: projectPath
        };
        fs.writeFileSync(path.join(projectPath, 'project_state.json'), JSON.stringify(fullState, null, 2), 'utf8');

        // 6. Generate Portable ZIP for colleagues
        const zip = new JSZip();
        
        const addEntriesToZip = (currentPath: string, zipRef: JSZip) => {
          const files = fs.readdirSync(currentPath);
          for (const file of files) {
            if (file === 'portable_project.zip') continue; // Don't zip the zip itself
            const fullPath = path.join(currentPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              addEntriesToZip(fullPath, zipRef.folder(file)!);
            } else {
              zipRef.file(file, fs.readFileSync(fullPath));
            }
          }
        };

        addEntriesToZip(projectPath, zip);
        const zipData = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(path.join(projectPath, 'portable_project.zip'), zipData);
        
        res.status(200).json({ 
          success: true, 
          path: projectPath, 
          zipPath: path.join(projectPath, 'portable_project.zip'),
          updatedChapters: chapters 
        });

      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/sync-history', async (req, res) => {
      try {
        const { projectPath, issues, pendingVisuals } = req.body;
        if (!projectPath || !fs.existsSync(projectPath)) {
          throw new Error("Project path is missing or invalid");
        }

        // Helper: scan a chapter's slug folder and build clean history items
        const scanHistoryForVisual = (v: any, chapterId: any, chapterIdx: number, infographicIndex: number = 1) => {
          const chapterOrder = typeof chapterId === 'number' ? chapterId : chapterIdx + 1;
          const folderName = getChapterFolderName(chapterId || chapterOrder);
          let chapterDir = path.join(projectPath, folderName);
          let baseAssetsDir = path.join(chapterDir, 'assets');
          let basePromptsDir = path.join(chapterDir, 'prompts');

          if (!fs.existsSync(baseAssetsDir)) {
            const altChapterDir = path.join(projectPath, 'portable_project', folderName);
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

          // --- PROACTIVE MIGRATION (Flattening history/) ---
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

          // --- SCAN ROOT SLUG FOLDER FOR ALL VERSIONS ---
          const allFiles = fs.readdirSync(targetAssetsDir).filter(f => SUPPORTED_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext)));
          const visualType = v.type || (isCover ? 'cover' : 'infographic');
          const stableBase = isCover ? 'cover' : 'infographic';
          
          const stableFile = findStableFile(targetAssetsDir, stableBase);
          const stableFilename = stableFile ? stableFile.name : `${stableBase}.png`;
          const stablePath = path.join(targetAssetsDir, stableFilename).replace(/\\/g, '/');

          // Only include timestamped files (with a dash before timestamp) — exclude stable cover.png/infographic.png
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
                path: `assets/${slug}/${f}`, // Use relative path
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
            path: `assets/${slug}/${stableFilename}`, // Use relative stable path
            absolutePath: stablePath,
            activeTimestampPath,
            history: historyItems
          };
        };

        // Process issues.visuals
        const updatedIssues = issues.map((ch: any, idx: number) => {
          const visualsList = ch.visualPoints || ch.visuals || [];
          let infoIdx = 0;
          const updatedVisuals = visualsList.map((v: any) => {
            if (v.type === 'infographic') infoIdx++;
            return scanHistoryForVisual(v, ch.id, idx, infoIdx);
          });
          return { ...ch, visualPoints: updatedVisuals, visuals: updatedVisuals };
        });

        // Process pendingVisuals (separate from issues)
        let updatedPendingVisuals = pendingVisuals;
        if (pendingVisuals && Array.isArray(pendingVisuals)) {
          const chapterInfoCounters: Record<string, number> = {};
          updatedPendingVisuals = pendingVisuals.map((v: any) => {
            const chId = v.chapterId || 'unknown';
            const chIdx = issues.findIndex((ch: any) => ch.id === chId);
            if (!chapterInfoCounters[chId]) chapterInfoCounters[chId] = 0;
            if (v.type === 'infographic') chapterInfoCounters[chId]++;
            return scanHistoryForVisual(v, chId, chIdx >= 0 ? chIdx : 0, chapterInfoCounters[chId]);
          });
        }

        res.status(200).json({ success: true, issues: updatedIssues, pendingVisuals: updatedPendingVisuals });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });


    server.middlewares.use(app);
  }
});



export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), localFileAPIPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/.app_state.json']
      }
    },
    build: {
      chunkSizeWarningLimit: 1500
    }
  };
});