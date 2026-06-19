import { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { Chapter, Version } from '../types';
import { INITIAL_ISSUES, DEFAULT_SERIAL_PLAN, TONE_OPTIONS } from '../constants';
import { 
  generatePlanPrompt, generateApprovePlanPrompt, 
  generateArticlePrompt 
} from '../prompts';
import { safeJsonParse, normalizePaths, cleanTitle } from '../utils';

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
  if (val.includes('minimax')) return 'minimax';
  if (val.includes('openai') || val.includes('gpt')) return 'openai';
  return v;
};

export const useProjectState = () => {
  const [issues, setIssues] = useState<Chapter[]>(INITIAL_ISSUES);
  const [activeId, setActiveId] = useState<number | 'plan'>('plan');
  const [serialPlan, setSerialPlan] = useState<string>(DEFAULT_SERIAL_PLAN);
  const [planApproved, setPlanApproved] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [planVersions, setPlanVersions] = useState<Version[]>([]);
  const [reportText, setReportText] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  // Loading states
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Business strategy states
  const [companyBusiness, setCompanyBusiness] = useState('');
  const [reportPurpose, setReportPurpose] = useState('');
  const [currentHotspot, setCurrentHotspot] = useState('');
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0].id);
  const [episodeMode, setEpisodeMode] = useState<'auto' | 'fixed'>('auto');
  const [episodeCount, setEpisodeCount] = useState<number>(5);
  const [ctaMode, setCtaMode] = useState<'none' | 'generate' | 'exact'>('exact');
  const [exactCtaTemplate, setExactCtaTemplate] = useState('');
  const [generateCtaTemplate, setGenerateCtaTemplate] = useState('');

  // WeChat publisher states
  const [wechatAppId, setWechatAppId] = useState('');
  const [wechatSecret, setWechatSecret] = useState('');
  const [wechatAuthor, setWechatAuthor] = useState('');
  const [wechatTheme, setWechatTheme] = useState('modern');
  const [wechatSyncEnabled, setWechatSyncEnabled] = useState(false);
  const [wechatAccountAlias, setWechatAccountAlias] = useState('default');
  const [wechatDefaultCover, setWechatDefaultCover] = useState('');

  const isUpdatingRef = useRef<boolean>(false);


  
  const getWordCount = (text: string) => {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length;
    return chineseChars + englishWords;
  };

  const getNextVersion = (current: string, versions: Version[]) => {
    if (versions.length === 0) return "1.0";
    const last = versions[versions.length - 1];
    if (last.content === current) return null;
    const [major, minor] = last.version.split('.').map(Number);
    const charDiff = Math.abs(current.length - last.content.length);
    const changeRatio = charDiff / (last.content.length || 1);
    if (charDiff > 200 || changeRatio > 0.15) {
      return `${major + 1}.0`;
    } else {
      return `${major}.${minor + 1}`;
    }
  };

  const generateWithSelectedModel = async (prompt: string, model: string, apiKey: string) => {
    const res = await fetch('/api/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, llmApiKey: apiKey })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI generation failed');
    }
    const data = await res.json();
    return data.text;
  };

  const saveVersion = useCallback(() => {
    const activeIssue = activeId === 'plan' 
      ? { id: 0, content: serialPlan, versions: planVersions }
      : issues.find(i => i.id === activeId);

    if (!activeIssue || !activeIssue.content || activeIssue.content.trim() === '') return;

    setIsDirty(false);
    if (activeId === 'plan') {
      const nextVer = getNextVersion(serialPlan, planVersions);
      if (!nextVer) return;
      const newVersion: Version = { version: nextVer, content: serialPlan, timestamp: Date.now() };
      setPlanVersions(prev => [...prev, newVersion]);
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId) {
          const nextVer = getNextVersion(issue.content, issue.versions);
          if (!nextVer) return issue;
          const newVersion: Version = { version: nextVer, content: issue.content, timestamp: Date.now() };
          return { ...issue, versions: [...issue.versions, newVersion] };
        }
        return issue;
      }));
    }
  }, [activeId, serialPlan, planVersions, issues]);

  const restoreVersion = (v: Version) => {
    if (activeId === 'plan') setSerialPlan(v.content);
    else setIssues(prev => prev.map(ch => ch.id === activeId ? { ...ch, content: v.content } : ch));
  };

  const processReport = async (text: string, model: string, apiKey: string) => {
    if (!text || text.trim() === '') return;
    setIsGeneratingPlan(true);
    setUploadError(null);
    try {
      const prompt = generatePlanPrompt({
        text, companyBusiness, reportPurpose, currentHotspot,
        selectedTone, ctaTemplate: ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate,
        toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || '',
        episodeMode, episodeCount, globalSkills: { humanizer: '', writingStyle: '' }
      });
      const planText = await generateWithSelectedModel(prompt + "\n\n请严格返回 JSON 格式。", model, apiKey);
      const data = safeJsonParse(planText);
      if (data.businessName && !companyBusiness) setCompanyBusiness(data.businessName);
      if (data.reportSummary) setReportSummary(data.reportSummary);
      const newPlan = data.plan || '';
      setSerialPlan(newPlan);
      setIsPlanGenerated(true);
      if (data.chapters) {
        let finalChapters = data.chapters;
        if (episodeMode === 'fixed' && episodeCount && finalChapters.length > episodeCount) {
          finalChapters = finalChapters.slice(0, episodeCount);
        }
        setIssues(finalChapters.map((c: any) => ({ ...c, content: "", status: 'pending', versions: [] })));
        setPlanApproved(true);
        setActiveId('plan');
      }
    } catch (error) {
      console.error('Process report error:', error);
      setUploadError("自动规划生成失败");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, model: string, apiKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("文件大小超过 10MB 限制");
      return;
    }
    setIsPdfLoading(true);
    setUploadError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
      }
      setReportText(fullText.trim());
      await processReport(fullText.trim(), model, apiKey);
    } catch (error) {
      console.error('PDF parsing error:', error);
      setUploadError("PDF 解析失败");
    } finally {
      setIsPdfLoading(false);
    }
  };

  const approvePlan = async (model: string, apiKey: string) => {
    if (!serialPlan.trim()) return;
    setIsPlanLoading(true);
    try {
      const prompt = generateApprovePlanPrompt({
        serialPlan, toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || ''
      });
      const resText = await generateWithSelectedModel(prompt + "\n\n请严格返回 JSON 格式。", model, apiKey);
      const data = safeJsonParse(resText || '{}');
      if (data.chapters) {
        let finalChapters = data.chapters;
        if (episodeMode === 'fixed' && episodeCount && finalChapters.length > episodeCount) {
          finalChapters = finalChapters.slice(0, episodeCount);
        }
        setIssues(finalChapters);
        setPlanApproved(true);
        setActiveId(1);
      }
    } catch (error) { console.error(error); }
    finally { setIsPlanLoading(false); }
  };

  const generateIssue = async (id: number, model: string, apiKey: string, editor: any, extraRequirements?: string) => {
    const chapter = issues.find(i => i.id === id);
    if (!chapter) return;
    setIsGeneratingSingle(true);
    try {
      isUpdatingRef.current = true;
      const prevChapters = issues.filter(i => i.id < id && i.content).map(i => i.content).join('\n\n');
      const prompt = generateArticlePrompt({
        companyBusiness, toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || '',
        reportSummary, reportText, prevChapters, chapterTitle: chapter.title,
        chapterOutline: chapter.outline, serialPlan, extraRequirements,
        ctaMode, ctaTemplate: ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate,
        globalSkills: { humanizer: '', writingStyle: '' }
      });
      const newContent = await generateWithSelectedModel(prompt, model, apiKey);
      
      let finalContent = newContent;
      // If ctaMode is 'exact' and it is NOT the last chapter, append the CTA template exactly as is
      const isLastChapter = issues.length > 0 && id === issues[issues.length - 1].id;
      if (ctaMode === 'exact' && !isLastChapter) {
        const appliedCta = exactCtaTemplate.trim() || (serialPlan.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/)?.[1] || '').trim();
        if (appliedCta) {
          const normalizedApplied = appliedCta.replace(/\s/g, '');
          const normalizedContent = finalContent.replace(/\s/g, '');
          if (!normalizedContent.includes(normalizedApplied)) {
            finalContent = `${finalContent}\n\n${appliedCta}`;
          }
        }
      }

      setIssues(prev => prev.map(i => i.id === id ? { ...i, content: finalContent, status: 'draft' } : i));
      if (editor) {
        editor.chain().setContent(finalContent, false).run();
      }
    } catch (error) { console.error(error); }
    finally { setIsGeneratingSingle(false); isUpdatingRef.current = false; }
  };

  const generateAll = async (model: string, apiKey: string, editor: any) => {
    setIsGeneratingAll(true);
    try {
        for (const chapter of issues) {
            await generateIssue(chapter.id, model, apiKey, editor);
        }
    } catch (error) { console.error(error); }
    finally { setIsGeneratingAll(false); }
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>, aiState?: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let targetPath = '';
      const zip = await JSZip.loadAsync(file);
      
      const findFileInZip = (z: JSZip, suffix: string) => {
        let f = z.file(suffix);
        if (f) return f;
        const normSuffix = suffix.replace(/\\/g, '/').toLowerCase();
        let foundKey = Object.keys(z.files).find(key => {
          const normKey = key.replace(/\\/g, '/').toLowerCase();
          return normKey === normSuffix || normKey.endsWith('/' + normSuffix);
        });
        return foundKey ? z.file(foundKey) : null;
      };

      const normalizeProjectPath = (pathStr: string) => {
        if (!pathStr) return '';
        return pathStr.replace(/\\/g, '/');
      };

      let masterStateFile = findFileInZip(zip, "project_state.json") || findFileInZip(zip, ".app_state.json");
      if (masterStateFile) {
        const data = JSON.parse(await masterStateFile.async("string"));
        const cfg = data.config || data;
        const episodeModeVal = cfg.episodeMode !== undefined ? cfg.episodeMode : 'fixed';
        const episodeCountVal = cfg.episodeCount !== undefined ? Number(cfg.episodeCount) : 6;

        if (data.issues) {
          let loadedIssues = data.issues;
          if (episodeModeVal === 'fixed' && episodeCountVal && loadedIssues.length > episodeCountVal) {
            loadedIssues = loadedIssues.slice(0, episodeCountVal);
          }
          setIssues(loadedIssues.map((ch: any) => ({ ...ch, content: normalizePaths(ch.content) })));
        }
        if (data.serialPlan) setSerialPlan(data.serialPlan);
        if (data.planApproved !== undefined) setPlanApproved(data.planApproved);
        if (data.fileName) setFileName(data.fileName);
        if (data.activeId !== undefined) setActiveId(data.activeId);
        if (data.isPlanGenerated !== undefined) setIsPlanGenerated(data.isPlanGenerated);
        if (data.planVersions !== undefined) setPlanVersions(data.planVersions);
        if (data.reportText !== undefined) setReportText(data.reportText);
        if (data.reportSummary !== undefined) setReportSummary(data.reportSummary);

        // Configuration loading (Support both flat and nested 'config' object)
        if (cfg.companyBusiness !== undefined) setCompanyBusiness(cfg.companyBusiness);
        if (cfg.reportPurpose !== undefined) setReportPurpose(cfg.reportPurpose);
        if (cfg.currentHotspot !== undefined) setCurrentHotspot(cfg.currentHotspot);
        if (cfg.selectedTone !== undefined) setSelectedTone(cfg.selectedTone);
        if (cfg.episodeMode !== undefined) setEpisodeMode(cfg.episodeMode);
        if (cfg.episodeCount !== undefined) setEpisodeCount(cfg.episodeCount);
        if (cfg.ctaMode !== undefined) setCtaMode(cfg.ctaMode);
        if (cfg.exactCtaTemplate !== undefined) setExactCtaTemplate(cfg.exactCtaTemplate);
        if (cfg.generateCtaTemplate !== undefined) setGenerateCtaTemplate(cfg.generateCtaTemplate);
        if (data.projectPath !== undefined) {
          targetPath = normalizeProjectPath(data.projectPath);
          setProjectPath(targetPath);
        }
        if (cfg.wechatAppId !== undefined) setWechatAppId(cfg.wechatAppId);
        const secret = cfg.wechatSecret !== undefined ? cfg.wechatSecret : cfg.wechatAppSecret;
        if (secret !== undefined) setWechatSecret(secret);
        if (cfg.wechatAuthor !== undefined) setWechatAuthor(cfg.wechatAuthor);
        if (cfg.wechatTheme !== undefined) setWechatTheme(cfg.wechatTheme);
        if (cfg.wechatSyncEnabled !== undefined) setWechatSyncEnabled(cfg.wechatSyncEnabled);
        if (cfg.wechatAccountAlias !== undefined) setWechatAccountAlias(cfg.wechatAccountAlias);
        if (cfg.wechatDefaultCover !== undefined) setWechatDefaultCover(cfg.wechatDefaultCover);

        // Robustly load AI Engine config fields if aiState is provided
        if (aiState) {
          if (cfg.selectedLlmVendor !== undefined) aiState.setSelectedLlmVendor(normalizeVendor(cfg.selectedLlmVendor));
          if (cfg.selectedLlmModel !== undefined) {
            let m = cfg.selectedLlmModel;
            if (m.includes(':')) m = m.split(':').pop() || m;
            aiState.setSelectedLlmModel(m);
          }
          if (cfg.selectedImageModel !== undefined) {
            let m = cfg.selectedImageModel;
            if (m.includes(':')) {
              const parts = m.split(':');
              if (['google', 'vertex', 'replicate'].includes(parts[0])) {
                m = parts.slice(1).join(':');
              }
              if (m.includes(':')) {
                const parts2 = m.split(':');
                if (['google', 'vertex', 'replicate'].includes(parts2[0])) {
                  m = parts2.slice(1).join(':');
                }
              }
            }
            aiState.setSelectedImageModel(m);
          }
          if (cfg.selectedImageVendor !== undefined) aiState.setSelectedImageVendor(normalizeVendor(cfg.selectedImageVendor));
          if (cfg.llmApiKey !== undefined) aiState.setLlmApiKey(cfg.llmApiKey);
          if (cfg.imageApiKey !== undefined) aiState.setImageApiKey(cfg.imageApiKey);
          if (cfg.vertexProjectId !== undefined) aiState.setVertexProjectId(cfg.vertexProjectId);
          if (cfg.vertexLocation !== undefined) aiState.setVertexLocation(cfg.vertexLocation);
          if (cfg.vertexSaKeyPath !== undefined) aiState.setVertexSaKeyPath(normalizeSaKeyPath(cfg.vertexSaKeyPath));
        }
      }

      // Robust Fallback: Parse from 设定/ Markdown files
      const companyBusinessFile = findFileInZip(zip, "设定/01_公司业务.md");
      if (companyBusinessFile) {
        const txt = await companyBusinessFile.async("string");
        setCompanyBusiness(txt.trim());
      }
      const ctaDataFile = findFileInZip(zip, "设定/02_引流模板设定.md");
      if (ctaDataFile) {
        const txt = await ctaDataFile.async("string");
        const jsonMatch = txt.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const cta = safeJsonParse(jsonMatch[1]);
          if (cta.ctaMode) setCtaMode(cta.ctaMode);
          if (cta.exactCtaTemplate) setExactCtaTemplate(cta.exactCtaTemplate);
          if (cta.generateCtaTemplate) setGenerateCtaTemplate(cta.generateCtaTemplate);
        }
      }
      const reportPurposeFile = findFileInZip(zip, "设定/03_报告分解要求.md");
      if (reportPurposeFile) {
        const txt = await reportPurposeFile.async("string");
        setReportPurpose(txt.trim());
      }
      const hotspotFile = findFileInZip(zip, "设定/04_热点.md");
      if (hotspotFile) {
        const txt = await hotspotFile.async("string");
        setCurrentHotspot(txt.trim());
      }
      const episodeFile = findFileInZip(zip, "设定/05_连载期数设定.md");
      if (episodeFile) {
        const txt = await episodeFile.async("string");
        const jsonMatch = txt.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const ep = safeJsonParse(jsonMatch[1]);
          if (ep.episodeMode) setEpisodeMode(ep.episodeMode);
          if (ep.episodeCount !== undefined) setEpisodeCount(Number(ep.episodeCount));
        }
      }
      const toneFile = findFileInZip(zip, "设定/06_调性设定.md");
      if (toneFile) {
        const txt = await toneFile.async("string");
        setSelectedTone(txt.trim());
      }

      if (targetPath) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const unzipRes = await fetch('/api/unzip-project', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'X-Project-Path': targetPath
            },
            body: arrayBuffer
          });
          if (unzipRes.ok) {
            const unzipData = await unzipRes.json();
            if (unzipData.path) {
              setProjectPath(unzipData.path);
              console.log("Successfully extracted project archive to:", unzipData.path);
            }
          } else {
            console.error("Backend failed to extract project ZIP");
          }
        } catch (unzipErr) {
          console.error("Failed to upload ZIP for extraction:", unzipErr);
        }
      }
    } catch (error) { console.error(error); }
    finally { setIsStateLoaded(true); if (e.target) e.target.value = ''; }
  };

  const downloadMarkdown = async (type: 'current' | 'all') => {
    if (type === 'current') {
      const activeIssue = activeId === 'plan' 
        ? { id: 0, title: '连载规划', content: serialPlan }
        : issues.find(i => i.id === activeId);
      if (!activeIssue || !activeIssue.content || activeIssue.content.trim() === '') {
        alert("内容为空，无法保存");
        return;
      }
      const blob = new Blob([activeIssue.content], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeIssue.title}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Send full state to server — it builds a complete ZIP with PDF + images
      const fullState = {

        issues,
        activeId,
        companyBusiness,
        reportPurpose,
        selectedTone,
        reportText,
        reportSummary,
        fileName,
        isPlanGenerated,
        planApproved,
        serialPlan,
        planVersions,
        exactCtaTemplate,
        generateCtaTemplate,
        episodeMode,
        episodeCount,
        ctaMode,
        projectPath,
        currentHotspot,
        wechatAppId,
        wechatSecret,
        wechatAuthor,
        wechatTheme,
        wechatSyncEnabled,
        wechatAccountAlias,
        wechatDefaultCover
      };
      try {
        const response = await fetch('/api/build-full-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullState)
        });
        if (response.ok) {
          const result = await response.json();
          if (result.path) {
            alert(`已成功保存完整包到下载目录：\n${result.path}\n\n包含：文章、规划、设定、原始报告 PDF、全部配图`);
            return;
          }
        } else {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || '服务器打包失败');
        }
      } catch (err) {
        console.error('build-full-zip failed, falling back to frontend zip', err);
        // Fallback: frontend-only ZIP (no PDF/images)
        const zip = new JSZip();
        const contentIssues = issues.filter(i => i.content && i.content.trim() !== '');
        contentIssues.forEach(issue => {
          zip.file(`篇目/${issue.title}/最新版本.md`, issue.content);
          if (issue.versions) issue.versions.forEach(v => zip.file(`篇目/${issue.title}/版本历史/V${v.version}.md`, v.content));
        });
        zip.file(`project_state.json`, JSON.stringify(fullState, null, 2));
        zip.file(`.app_state.json`, JSON.stringify(fullState, null, 2));
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `连载系列_全部篇目_${new Date().toISOString().slice(0,10)}.zip`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };



  const publishToDrafts = async (type: 'current' | 'all') => {
    try {
      const activeIssue = activeId === 'plan' 
        ? { id: 0, title: '连载规划', content: serialPlan }
        : issues.find(i => i.id === activeId);
      
      const itemsToPublish = type === 'current'
        ? (activeIssue ? [activeIssue] : [])
        : issues.filter(i => i.content && i.content.trim().length > 0);

      if (itemsToPublish.length === 0) {
        alert("没有要发布的内容");
        return;
      }

      for (const item of itemsToPublish) {
        const response = await fetch('/api/publish-to-wechat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            content: item.content,
            accountAlias: wechatAccountAlias || 'default',
            author: (wechatAuthor || 'PostOS Pro').substring(0, 16),
            theme: wechatTheme || 'modern',
            appId: wechatAppId,
            appSecret: wechatSecret,
            summary: item.content.slice(0, 120),
            projectPath,
            chapterId: item.id,
            coverImage: wechatDefaultCover || null
          })
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "发布失败");
        }
      }
      alert("已成功同步发布至微信草稿箱！");
    } catch (err: any) {
      console.error(err);
      alert(`发布失败：${err.message || '未知错误'}`);
    }
  };

  return {
    projectState: {
        issues, setIssues, activeId, setActiveId, serialPlan, setSerialPlan,
        planApproved, setPlanApproved, isPlanGenerated, setIsPlanGenerated,
        planVersions, setPlanVersions, reportText, setReportText,
        reportSummary, setReportSummary, fileName, setFileName,
        isDirty, setIsDirty, projectPath, setProjectPath,
        isStateLoaded, setIsStateLoaded, companyBusiness, setCompanyBusiness,
        reportPurpose, setReportPurpose, currentHotspot, setCurrentHotspot,
        selectedTone, setSelectedTone, episodeMode, setEpisodeMode,
        episodeCount, setEpisodeCount, ctaMode, setCtaMode,
        exactCtaTemplate, setExactCtaTemplate, generateCtaTemplate, setGenerateCtaTemplate,
        wechatAppId, setWechatAppId, wechatSecret, setWechatSecret,
        wechatAuthor, setWechatAuthor, wechatTheme, setWechatTheme,
        wechatSyncEnabled, setWechatSyncEnabled, wechatAccountAlias, setWechatAccountAlias,
        wechatDefaultCover, setWechatDefaultCover,
        isUpdatingRef, isPdfLoading, setIsPdfLoading, isGeneratingPlan, setIsGeneratingPlan,
        isPlanLoading, setIsPlanLoading, isGeneratingSingle, setIsGeneratingSingle,
        isGeneratingAll, setIsGeneratingAll, uploadError, setUploadError,
        saveVersion, restoreVersion, approvePlan, generateIssue, generateAll,
        getWordCount, handleFileUpload, handleLoadProject,
        downloadMarkdown,
        publishToDrafts
    },
    activeId, setActiveId, issues, setIssues, 
    saveVersion, restoreVersion, getWordCount
  };
};