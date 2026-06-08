import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { 
  Loader2, CheckCircle2, AlertCircle, Plus, Paperclip, 
  RotateCcw, Sparkles, Wand2, Lightbulb, Zap, Send, 
  Maximize2, Feather, ChevronRight, ChevronLeft, ChevronDown, 
  ChevronUp, History, Eye, Type as TypeIcon, FileText, 
  Save, Lock, Unlock, Settings2, Fingerprint, Share2, 
  Compass, LayoutDashboard, Download, FolderArchive, 
  Image as ImageIcon, RefreshCw, X, Layers, ArrowRight
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

import {
  generatePlanPrompt,
  generateApprovePlanPrompt,
  generateArticlePrompt,
  generateChatPrompt,
  generateFloatingEditPrompt,
  CHAT_SYSTEM_INSTRUCTION
} from './prompts';

// Hooks
import { useProjectState } from './hooks/useProjectState';
import { useAIState } from './hooks/useAIState';
import { useVisualState } from './hooks/useVisualState';
import { useConfigState } from './hooks/useConfigState';

// Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { VisualSidebar } from './components/layout/VisualSidebar';
import { ChatAssistant } from './components/chat/ChatAssistant';
import { SystemModal, BrandModal, StrategyModal, PublisherModal } from './components/modals/ConfigModals';

// Utils & Constants
import { 
  normalizePaths, cleanTitle, extractFirstImage, 
  cleanMarkdown, safeJsonParse 
} from './utils';
import { 
  TONE_OPTIONS, DEFAULT_SERIAL_PLAN, INITIAL_ISSUES, 
  getChapterFolderName 
} from './constants';
import { CustomImage } from './components/editor/extensions/CustomImage';
import { VisualPlaceholderRestorer } from './components/editor/extensions/VisualPlaceholderRestorer';
import { VisualSlot } from './components/editor/extensions/VisualSlot';

// Set worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const normalizeSaKeyPath = (p: string) => {
  if (!p) return '';
  const homeDir = (window as any).__HOME_DIR__ || '/Users/shanfu';
  let norm = p.replace(/\\/g, '/');
  if (norm.includes('application_default_credentials.json') && (p.includes('\\') || /^[a-zA-Z]:/i.test(p))) {
    return `${homeDir}/.config/gcloud/application_default_credentials.json`;
  }
  if (norm.includes('/cc/')) {
    const idx = norm.indexOf('/cc/');
    return homeDir + norm.substring(idx);
  }
  if (/^[a-zA-Z]:\/cc\//i.test(norm)) {
    norm = norm.replace(/^[a-zA-Z]:\/cc\//i, `${homeDir}/cc/`);
  } else if (norm.startsWith('cc/')) {
    norm = `${homeDir}/cc/` + norm.substring(3);
  }
  return norm;
};

const normalizeVendor = (v: string) => {
  if (!v) return 'vertex';
  const val = v.toLowerCase();
  if (val.includes('vertex')) return 'vertex';
  if (val.includes('gemini') || val.includes('studio') || val.includes('google')) return 'gemini';
  if (val.includes('moonshot') || val.includes('kimi')) return 'moonshot';
  if (val.includes('dashscope') || val.includes('qwen') || val.includes('alibaba')) return 'dashscope';
  if (val.includes('zhipu') || val.includes('glm')) return 'zhipu';
  if (val.includes('deepseek')) return 'deepseek';
  if (val.includes('siliconflow')) return 'siliconflow';
  return v;
};

const areVisualsEqual = (a: any[], b: any[]) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    if (!va || !vb) return false;
    if (va.id !== vb.id) return false;
    if ((va.description || '') !== (vb.description || '')) return false;
    if ((va.labels || '') !== (vb.labels || '')) return false;
    if (!!va.generated !== !!vb.generated) return false;
    if ((va.path || '') !== (vb.path || '')) return false;
    if ((va.absolutePath || '') !== (vb.absolutePath || '')) return false;
    if ((va.activeTimestampPath || '') !== (vb.activeTimestampPath || '')) return false;
  }
  return true;
};

export default function App() {
  const { 
    projectState, activeId, setActiveId, issues, setIssues,
    getWordCount: calcWordCount, saveVersion, restoreVersion
  } = useProjectState();

  const aiState = useAIState();
  const { 
    llmVendors, selectedLlmVendor, setSelectedLlmVendor, 
    selectedLlmModel, setSelectedLlmModel, llmApiKey, setLlmApiKey,
    selectedImageModel, imageApiKey
  } = aiState;


  const config = useConfigState();
  const { 
    showSystemModal, setShowSystemModal, 
    showBrandModal, setShowBrandModal, showStrategyModal, 
    setShowStrategyModal, showPublisherModal, setShowPublisherModal
  } = config;
  const configState = projectState;

  // UI-only states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string, isModification?: boolean }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [showRawMd, setShowRawMd] = useState(false);
  const [activeQuickActionMenu, setActiveQuickActionMenu] = useState<string | null>(null);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showIssueSelector, setShowIssueSelector] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  const versionMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const publishMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const issueSelectorRef = useRef<HTMLDivElement>(null);
  const confirmAllRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [chatPanelWidth, setChatPanelWidth] = useState(400);

  // Tiptap Editor Initialization
  const isUpdatingRef = useRef(false);
  const updateContentRef = useRef<(md: string) => void>(() => {});
  const saveVersionRef = useRef<() => void>(() => {});
  const lastAssetRefreshKey = useRef<number>(0);
  const lastSyncedIdRef = useRef<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    updateContentRef.current = (md: string) => {
      if (activeId === 'plan') {
        projectState.setSerialPlan(md);
      } else {
        setIssues(prev => prev.map(ch => ch.id === activeId ? { ...ch, content: md } : ch));
      }
    };
    saveVersionRef.current = saveVersion;
  }, [activeId, projectState, setIssues, saveVersion]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapMarkdown,
      CustomImage,
      VisualPlaceholderRestorer,
      VisualSlot,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: '在此输入内容...' }),
      Highlight.configure({ HTMLAttributes: { class: 'bg-[#5A5A40]/30 text-inherit' } }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current || projectState.isGeneratingSingle || projectState.isGeneratingAll) return;
      const md = (editor.storage as any).markdown.getMarkdown();
      updateContentRef.current(md);
      projectState.setIsDirty(true);
    },
    onBlur: () => {
      saveVersionRef.current();
    },
    editorProps: {
      attributes: { class: 'prose prose-stone max-w-none focus:outline-none min-h-[500px] p-8' },
    },
  });

  const tips = [
    { title: "引流技巧", content: "别忘了在结尾保留“软广”话术！这是引导读者联系后台、转化潜在客户的关键。" },
    { title: "局部精修", content: "鼠标划选段落文本后，可以直接唤起隐形 AI 菜单，输入具体修改指令（如：换个更有趣的说法）。" },
    { title: "快捷动作", content: "点击右侧聊天浮窗的小图标菜单，可以快速一键对当前文章进行润色、扩写、精简，或调整风格调性。" },
    { title: "版本回溯", content: "每次让 AI 重写或生成新内容时，系统都会自动为您保存上一个版本。点击上方标题栏的 V 版本号即可随时找回并切换此前的草稿。" },
    { title: "防丢锦囊", content: "关闭软件前，可以通过左侧“保存 - 保存全部”将所有连载单篇以及系统状态打包为 ZIP 下载，下次直接全盘恢复进度。" },
    { title: "排版建议", content: "使用加粗 and 引用块来突出重点，让长文在手机端更易于扫描阅读。" },
    { title: "互动技巧", content: "在文末抛出一个开放性问题，引导读者在评论区留言，增加账号权重。" },
    { title: "内容策略", content: "连载内容建议保持风格统一，建立读者的阅读预期，提高留存率。" }
  ];

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    console.log(`[${type}] ${msg}`);
  };

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
  };

  const activeIssueData = useMemo(() => {
    if (activeId === 'plan') {
      return { id: 0, title: '连载规划', content: projectState.serialPlan, outline: '', status: 'completed' as const, versions: projectState.planVersions };
    }
    return issues.find(i => i.id === activeId) || issues[0] || { id: -1, title: '', content: '', outline: '', status: 'pending' as const, versions: [] };
  }, [activeId, projectState.serialPlan, projectState.planVersions, issues]);

  const visualState = useVisualState({
    activeIssue: activeIssueData,
    activeId,
    selectedLlmModel,
    llmApiKey,
    selectedImageModel,
    imageApiKey,
    projectPath: projectState.projectPath,
    issues,
    setIssues,
    editor,
    showToast: (msg, type) => showToast(msg, type === 'error' ? 'error' : 'success')
  });
  const { 
    isVisualSidebarOpen, setIsVisualSidebarOpen, 
    pendingVisuals, setPendingVisuals, isExtractingVisuals, 
    handleGenerateVisual, handleGenerateAllInfographics
  } = visualState;

  useEffect(() => {
    if (editor && activeIssueData && activeId !== 'plan') {
      const activeIdStr = String(activeId);
      
      // Case 1: Chapter switched
      if (lastSyncedIdRef.current !== activeIdStr) {
        lastSyncedIdRef.current = activeIdStr;
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        
        const newVisuals = activeIssueData.visualPoints || [];
        visualState.setPendingVisuals(newVisuals);
        visualState.handleSyncHistory(issues, newVisuals);
      } 
      // Case 2: Local modifications (keystrokes, extractions, etc.)
      else {
        const currentVisualPoints = activeIssueData.visualPoints || [];
        const isDifferent = !areVisualsEqual(currentVisualPoints, visualState.pendingVisuals);
        if (isDifferent) {
          if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
          syncTimeoutRef.current = setTimeout(() => {
            visualState.handleSyncHistory(issues, visualState.pendingVisuals);
          }, 1000);
        }
      }
    } else if (activeId === 'plan') {
      lastSyncedIdRef.current = null;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      visualState.setPendingVisuals([]);
    }
    
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [activeId, editor, activeIssueData.visualPoints, visualState.pendingVisuals]);

  useEffect(() => {
    if (editor && activeIssueData) {
      if ((editor.storage as any).visualPlaceholderRestorer) {
        (editor.storage as any).visualPlaceholderRestorer.isPlan = (activeId === 'plan');
      }

      let currentMd = normalizePaths((editor.storage as any).markdown.getMarkdown());
      let targetMd = normalizePaths(activeIssueData.content || '');
      
      if (activeId !== 'plan') {
        (window as any).__ACTIVE_ID__ = activeId;
        (window as any).__ACTIVE_CHAPTER_FOLDER__ = getChapterFolderName(activeIssueData.id);
        (window as any).__ASSET_REFRESH_KEY__ = visualState.assetRefreshKey;
      }
      
      const normalize = (s: string) => s.trim().replace(/\r\n/g, '\n');
      const isContentChanged = normalize(currentMd) !== normalize(targetMd);
      const isRefreshRequested = visualState.assetRefreshKey !== lastAssetRefreshKey.current;

      if (isContentChanged || isRefreshRequested) {
        lastAssetRefreshKey.current = visualState.assetRefreshKey;
        isUpdatingRef.current = true;
        editor.chain()
          .setContent(targetMd, false as any)
          .command(({ tr }) => {
            tr.setMeta('chapterSwitch', true);
            return true;
          })
          .run();
        
        setTimeout(() => { isUpdatingRef.current = false; }, 300);
      }
    }
  }, [activeId, editor, activeIssueData.content, visualState.assetRefreshKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Load state and model list on mount
  useEffect(() => {
    fetch('/api/system-info')
      .then(res => res.json())
      .then(info => {
        if (info.homedir) {
          (window as any).__HOME_DIR__ = info.homedir;
          (window as any).__PLATFORM__ = info.platform;
          aiState.setVertexSaKeyPath(prev => {
            if (prev === '/Users/shanfu/.config/gcloud/application_default_credentials.json') {
              return `${info.homedir}/.config/gcloud/application_default_credentials.json`;
            }
            return prev;
          });
        }
      })
      .catch(err => console.error("Failed to load system info:", err))
      .finally(() => {
        fetch('/api/load-state')
          .then(res => {
            if (!res.ok) throw new Error('No state found');
            return res.json();
          })
          .then(data => {
            if (data && typeof data === 'object') {
              const epMode = data.episodeMode !== undefined ? data.episodeMode : 'fixed';
              const epCount = data.episodeCount !== undefined ? Number(data.episodeCount) : 6;

              if (data.issues) {
                let loadedIssues = data.issues;
                if (epMode === 'fixed' && epCount && loadedIssues.length > epCount) {
                  loadedIssues = loadedIssues.slice(0, epCount);
                }
                setIssues(loadedIssues.map((ch: any) => ({
                  ...ch,
                  versions: Array.isArray(ch.versions) ? ch.versions : [],
                  visuals: Array.isArray(ch.visuals) ? ch.visuals : []
                })));
              }
              if (data.activeId !== undefined) setActiveId(data.activeId);
              if (data.serialPlan !== undefined) projectState.setSerialPlan(data.serialPlan);
              if (data.planApproved !== undefined) projectState.setPlanApproved(data.planApproved);
              if (data.isPlanGenerated !== undefined) projectState.setIsPlanGenerated(data.isPlanGenerated);
              if (data.planVersions !== undefined) projectState.setPlanVersions(data.planVersions);
              if (data.reportText !== undefined) projectState.setReportText(data.reportText);
              if (data.reportSummary !== undefined) projectState.setReportSummary(data.reportSummary);
              if (data.fileName !== undefined) projectState.setFileName(data.fileName);
              if (data.projectPath !== undefined) projectState.setProjectPath(data.projectPath);
              if (data.companyBusiness !== undefined) projectState.setCompanyBusiness(data.companyBusiness);
              if (data.reportPurpose !== undefined) projectState.setReportPurpose(data.reportPurpose);
              if (data.currentHotspot !== undefined) projectState.setCurrentHotspot(data.currentHotspot);
              if (data.selectedTone !== undefined) projectState.setSelectedTone(data.selectedTone);
              if (data.episodeMode !== undefined) projectState.setEpisodeMode(data.episodeMode);
              if (data.episodeCount !== undefined) projectState.setEpisodeCount(data.episodeCount);
              if (data.ctaMode !== undefined) projectState.setCtaMode(data.ctaMode);
              if (data.exactCtaTemplate !== undefined) projectState.setExactCtaTemplate(data.exactCtaTemplate);
              if (data.generateCtaTemplate !== undefined) projectState.setGenerateCtaTemplate(data.generateCtaTemplate);
              if (data.wechatAppId !== undefined) projectState.setWechatAppId(data.wechatAppId);
              const secret = data.wechatSecret !== undefined ? data.wechatSecret : data.wechatAppSecret;
              if (secret !== undefined) projectState.setWechatSecret(secret);
              if (data.wechatAuthor !== undefined) projectState.setWechatAuthor(data.wechatAuthor);
              if (data.wechatTheme !== undefined) projectState.setWechatTheme(data.wechatTheme);
              if (data.wechatSyncEnabled !== undefined) projectState.setWechatSyncEnabled(data.wechatSyncEnabled);
              if (data.wechatAccountAlias !== undefined) projectState.setWechatAccountAlias(data.wechatAccountAlias);
              if (data.wechatDefaultCover !== undefined) projectState.setWechatDefaultCover(data.wechatDefaultCover);

              // Load AI Engine config fields
              if (data.selectedLlmVendor !== undefined) aiState.setSelectedLlmVendor(normalizeVendor(data.selectedLlmVendor));
              if (data.selectedLlmModel !== undefined) aiState.setSelectedLlmModel(data.selectedLlmModel);
              if (data.selectedImageModel !== undefined) aiState.setSelectedImageModel(data.selectedImageModel);
              if (data.selectedImageVendor !== undefined) aiState.setSelectedImageVendor(normalizeVendor(data.selectedImageVendor));
              if (data.llmApiKey !== undefined) aiState.setLlmApiKey(data.llmApiKey);
              if (data.imageApiKey !== undefined) aiState.setImageApiKey(data.imageApiKey);
              if (data.vertexProjectId !== undefined) aiState.setVertexProjectId(data.vertexProjectId);
              if (data.vertexLocation !== undefined) aiState.setVertexLocation(data.vertexLocation);
              if (data.vertexSaKeyPath !== undefined) aiState.setVertexSaKeyPath(normalizeSaKeyPath(data.vertexSaKeyPath));
            }
            projectState.setIsStateLoaded(true);
          })
          .catch(err => {
            console.log('No prior state found:', err);
            projectState.setIsStateLoaded(true);
          });
      });

    // Fetch dynamic model list from backend
    fetch('/api/list-llm-models')
      .then(res => res.json())
      .then(data => {
        aiState.setLlmVendors(data);
      })
      .catch(err => console.error("Failed to load models list:", err));
  }, []);

  // Save state debounced effect
  useEffect(() => {
    if (!projectState.isStateLoaded) return;
    const handler = setTimeout(() => {
      const state = {
        issues,
        activeId,
        serialPlan: projectState.serialPlan,
        planApproved: projectState.planApproved,
        isPlanGenerated: projectState.isPlanGenerated,
        planVersions: projectState.planVersions,
        reportText: projectState.reportText,
        reportSummary: projectState.reportSummary,
        fileName: projectState.fileName,
        projectPath: projectState.projectPath,
        companyBusiness: projectState.companyBusiness,
        reportPurpose: projectState.reportPurpose,
        currentHotspot: projectState.currentHotspot,
        selectedTone: projectState.selectedTone,
        episodeMode: projectState.episodeMode,
        episodeCount: projectState.episodeCount,
        ctaMode: projectState.ctaMode,
        exactCtaTemplate: projectState.exactCtaTemplate,
        generateCtaTemplate: projectState.generateCtaTemplate,
        wechatAppId: projectState.wechatAppId,
        wechatSecret: projectState.wechatSecret,
        wechatAuthor: projectState.wechatAuthor,
        wechatTheme: projectState.wechatTheme,
        wechatSyncEnabled: projectState.wechatSyncEnabled,
        wechatAccountAlias: projectState.wechatAccountAlias,
        wechatDefaultCover: projectState.wechatDefaultCover,

        // Save AI Engine config fields
        selectedLlmVendor: aiState.selectedLlmVendor,
        selectedLlmModel: aiState.selectedLlmModel,
        selectedImageModel: aiState.selectedImageModel,
        selectedImageVendor: aiState.selectedImageVendor,
        llmApiKey: aiState.llmApiKey,
        imageApiKey: aiState.imageApiKey,
        vertexProjectId: aiState.vertexProjectId,
        vertexLocation: aiState.vertexLocation,
        vertexSaKeyPath: aiState.vertexSaKeyPath
      };
      fetch('/api/save-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      }).catch(err => console.error('Failed to save state:', err));
    }, 1200);
    return () => clearTimeout(handler);
  }, [
    projectState.isStateLoaded, issues, activeId, projectState.serialPlan, projectState.planApproved,
    projectState.isPlanGenerated, projectState.planVersions, projectState.reportText,
    projectState.reportSummary, projectState.fileName, projectState.projectPath,
    projectState.companyBusiness, projectState.reportPurpose, projectState.currentHotspot,
    projectState.selectedTone, projectState.episodeMode, projectState.episodeCount,
    projectState.ctaMode, projectState.exactCtaTemplate, projectState.generateCtaTemplate,
    projectState.wechatAppId, projectState.wechatSecret, projectState.wechatAuthor,
    projectState.wechatTheme, projectState.wechatSyncEnabled, projectState.wechatAccountAlias,
    projectState.wechatDefaultCover, aiState.selectedLlmVendor, aiState.selectedLlmModel,
    aiState.selectedImageModel, aiState.selectedImageVendor, aiState.llmApiKey,
    aiState.imageApiKey, aiState.vertexProjectId, aiState.vertexLocation, aiState.vertexSaKeyPath
  ]);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingChat(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingChat(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 450) setSidebarWidth(newWidth);
    }
    if (isResizingChat) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 600) setChatPanelWidth(newWidth);
    }
  }, [isResizingSidebar, isResizingChat]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as any;
      if (showPublishMenu && publishMenuRef.current && !publishMenuRef.current.contains(target)) setShowPublishMenu(false);
      if (showDownloadMenu && downloadMenuRef.current && !downloadMenuRef.current.contains(target)) setShowDownloadMenu(false);
      if (showIssueSelector && issueSelectorRef.current && !issueSelectorRef.current.contains(target)) setShowIssueSelector(false);
      if (showConfirmAll && confirmAllRef.current && !confirmAllRef.current.contains(target)) setShowConfirmAll(false);
      if (showVersionMenu && versionMenuRef.current && !versionMenuRef.current.contains(target)) setShowVersionMenu(false);
      if (activeQuickActionMenu) setActiveQuickActionMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPublishMenu, showDownloadMenu, showIssueSelector, showConfirmAll, showVersionMenu, activeQuickActionMenu]);

  return (
    <div className="flex h-screen bg-white text-[#141414] font-sans selection:bg-[#5A5A40]/20 overflow-hidden">
      <Sidebar 
        sidebarWidth={sidebarWidth}
        isPdfLoading={projectState.isPdfLoading}
        isGeneratingPlan={projectState.isGeneratingPlan}
        handleFileUpload={(e) => projectState.handleFileUpload(e, aiState.selectedLlmModel, aiState.llmApiKey)}
        fileName={projectState.fileName}
        uploadError={projectState.uploadError}
        isPlanGenerated={projectState.isPlanGenerated}
        projectPath={projectState.projectPath}
        setShowSystemModal={setShowSystemModal}
        setShowBrandModal={setShowBrandModal}
        setShowPublisherModal={setShowPublisherModal}
        setShowStrategyModal={setShowStrategyModal}
        serialPlan={projectState.serialPlan}
        activeId={activeId}
        setActiveId={setActiveId}
        issues={issues}
        planApproved={projectState.planApproved}
        approvePlan={() => projectState.approvePlan(aiState.selectedLlmModel, aiState.llmApiKey)}
        isPlanLoading={projectState.isPlanLoading}
        isGeneratingSingle={projectState.isGeneratingSingle}
        isGeneratingAll={projectState.isGeneratingAll}
        showIssueSelector={showIssueSelector}
        setShowIssueSelector={setShowIssueSelector}
        issueSelectorRef={issueSelectorRef}
        generateIssue={(id) => projectState.generateIssue(id, aiState.selectedLlmModel, aiState.llmApiKey, editor)}
        showConfirmAll={showConfirmAll}
        setShowConfirmAll={setShowConfirmAll}
        confirmAllRef={confirmAllRef}
        generateAll={() => projectState.generateAll(aiState.selectedLlmModel, aiState.llmApiKey, editor)}
        publishMenuRef={publishMenuRef}
        showPublishMenu={showPublishMenu}
        setShowPublishMenu={setShowPublishMenu}
        publishToDrafts={projectState.publishToDrafts}
        downloadMenuRef={downloadMenuRef}
        showDownloadMenu={showDownloadMenu}
        setShowDownloadMenu={setShowDownloadMenu}
        downloadMarkdown={projectState.downloadMarkdown}
        handleLoadProject={projectState.handleLoadProject}
        startResizingSidebar={startResizingSidebar}
        setIsChatOpen={setIsChatOpen}
        setIsVisualSidebarOpen={setIsVisualSidebarOpen}
        isExtractingVisuals={visualState.isExtractingVisuals}
        activeIssue={activeIssueData}
        getWordCount={calcWordCount}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Header 
          activeId={activeId}
          activeIssue={activeIssueData}
          isDirty={projectState.isDirty}
          showVersionMenu={showVersionMenu}
          setShowVersionMenu={setShowVersionMenu}
          versionMenuRef={versionMenuRef}
          restoreVersion={restoreVersion}
          saveVersion={saveVersion}
          ctaMode={configState.ctaMode}
          generateCtaTemplate={configState.generateCtaTemplate}
          exactCtaTemplate={configState.exactCtaTemplate}
          setGenerateCtaTemplate={configState.setGenerateCtaTemplate}
          setExactCtaTemplate={configState.setExactCtaTemplate}
          showRawMd={showRawMd}
          setShowRawMd={setShowRawMd}
          showTip={showTip}
          setShowTip={setShowTip}
          isChatOpen={isChatOpen}
          setIsChatOpen={setIsChatOpen}
          setIsVisualSidebarOpen={setIsVisualSidebarOpen}
        />

        <div className="flex-1 overflow-hidden flex relative">
          <div className="flex-1 overflow-y-auto p-8 bg-[#F5F5F0]/30 scroll-smooth">
            <div className="max-w-3xl mx-auto bg-white p-12 rounded-2xl border border-[#141414]/10 shadow-sm min-h-full">
              {showRawMd ? (
                <div className="font-mono text-sm leading-relaxed text-[#141414]/70 whitespace-pre-wrap">
                  {activeIssueData.content}
                </div>
              ) : (
                <article className="prose prose-stone max-w-none h-full">
                  <EditorContent editor={editor} className="h-full min-h-[500px]" />
                </article>
              )}
            </div>
          </div>

          <ChatAssistant 
            isChatOpen={isChatOpen}
            setIsChatOpen={setIsChatOpen}
            chatPanelWidth={chatPanelWidth}
            startResizingChat={startResizingChat}
            chatMessages={chatMessages}
            handleRollback={() => {}}
            isChatLoading={isChatLoading}
            messagesEndRef={messagesEndRef}
            activeQuickActionMenu={activeQuickActionMenu}
            setActiveQuickActionMenu={setActiveQuickActionMenu}
            activeId={activeId}
            handleQuickAction={() => {}}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendMessage={() => {}}
          />

          <VisualSidebar 
            isVisualSidebarOpen={visualState.isVisualSidebarOpen}
            setIsVisualSidebarOpen={setIsVisualSidebarOpen}
            chatPanelWidth={chatPanelWidth}
            startResizingChat={startResizingChat}
            selectedStyleId={visualState.selectedStyleId}
            handleSelectStyle={visualState.handleSelectStyle}
            STYLE_PRESETS={visualState.STYLE_PRESETS}
            showCustomArchitect={visualState.showCustomArchitect}
            setShowCustomArchitect={visualState.setShowCustomArchitect}
            customStyleName={visualState.customStyleName}
            setCustomStyleName={visualState.setCustomStyleName}
            architectParams={visualState.architectParams}
            setArchitectParams={visualState.setArchitectParams}
            customStyleDNA={visualState.customStyleDNA}
            setCustomStyleDNA={visualState.setCustomStyleDNA}
            handleSaveCustomStyle={visualState.handleSaveCustomStyle}
            setCustomStyles={visualState.setCustomStyles}
            isExtractingVisuals={visualState.isExtractingVisuals}
            extractionMode={visualState.extractionMode}
            handleExtractVisuals={visualState.handleExtractVisuals}
            pendingVisuals={visualState.pendingVisuals}
            setPendingVisuals={setPendingVisuals}
            activeId={activeId}
            activeIssue={activeIssueData}
            generatingVisualIds={visualState.generatingVisualIds}
            generationAbortControllers={visualState.generationAbortControllers as any}
            handleGenerateVisual={visualState.handleGenerateVisual}
            openHistoryId={visualState.openHistoryId}
            setOpenHistoryId={visualState.setOpenHistoryId}
            resolveAssetUrl={visualState.resolveAssetUrl}
            assetRefreshKey={visualState.assetRefreshKey}
            handleRestoreHistory={visualState.handleRestoreHistory}
            compareItems={visualState.compareItems}
            setCompareItems={visualState.setCompareItems}
            setShowComparisonModal={visualState.setShowComparisonModal}
            isBatchGenerating={visualState.isBatchGenerating}
            handleGenerateAllInfographics={visualState.handleGenerateAllInfographics}
            collapsedTypes={visualState.collapsedTypes}
            setCollapsedTypes={visualState.setCollapsedTypes}
            coverExtraPrompt={visualState.coverExtraPrompt}
            setCoverExtraPrompt={visualState.setCoverExtraPrompt}
            infographicExtraPrompt={visualState.infographicExtraPrompt}
            setInfographicExtraPrompt={visualState.setInfographicExtraPrompt}
            infographicTargetCount={visualState.infographicTargetCount}
            setInfographicTargetCount={visualState.setInfographicTargetCount}
            extractionAbortControllerRef={visualState.extractionAbortControllerRef}
            extractedVisualsError={visualState.extractedVisualsError}
            setExtractedVisualsError={visualState.setExtractedVisualsError}
          />
        </div>

        <AnimatePresence>
          {showTip && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md z-[200]"
            >
              <div className="bg-[#141414] text-white p-6 rounded-2xl shadow-2xl border border-white/10 mx-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">排版技巧</span>
                  </div>
                  <button onClick={() => setShowTip(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-sm font-bold mb-2">{tips[currentTipIndex].title}</h4>
                <p className="text-xs text-white/70 leading-relaxed mb-6">{tips[currentTipIndex].content}</p>
                <button onClick={handleNextTip} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold transition-all">换一个</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <SystemModal 
        isOpen={showSystemModal} 
        onClose={() => setShowSystemModal(false)}
        aiState={aiState}
        onSave={() => setShowSystemModal(false)}
      />

      <BrandModal 
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        projectState={projectState}
        onSave={() => setShowBrandModal(false)}
      />

      <StrategyModal 
        isOpen={showStrategyModal}
        onClose={() => setShowStrategyModal(false)}
        projectState={projectState}
        onSave={() => setShowStrategyModal(false)}
      />

      <PublisherModal 
        isOpen={showPublisherModal}
        onClose={() => setShowPublisherModal(false)}
        projectState={projectState}
        onSave={() => setShowPublisherModal(false)}
      />

      <Toast 
        message={projectState.uploadError || ''} 
        type="error" 
        isVisible={!!projectState.uploadError} 
      />
    </div>
  );
}

const Toast = ({ message, type, isVisible }: { message: string, type: 'error' | 'success', isVisible: boolean }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className={`fixed bottom-8 left-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            type === 'success' 
              ? 'bg-[#141414] border-white/10 text-white' 
              : 'bg-red-600 border-red-500 text-white'
          }`}
        >
          {type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span className="text-sm font-medium tracking-wide">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
