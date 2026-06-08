import { useState, useRef, useEffect } from 'react';
import { VisualAsset, Chapter, Version, VisualHistoryEntry } from '../types';
import { getChapterFolderName, TONE_OPTIONS } from '../constants';
import { safeJsonParse } from '../utils';

interface UseVisualStateProps {
  activeIssue: any;
  activeId: number | 'plan';
  selectedLlmModel: string;
  llmApiKey: string;
  selectedImageModel: string;
  imageApiKey: string;
  projectPath: string;
  issues: Chapter[];
  setIssues: React.Dispatch<React.SetStateAction<Chapter[]>>;
  editor: any;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const DEFAULT_STYLE_PRESETS = [
  { 
    id: 'amber', 
    label: '工业琥珀', 
    color: '#FFBF00',
    params: {
      palette: '现代商务 (Modern Corporate)',
      background: '技术网格 (Technical Grid)',
      material: '磨砂金属 (Brushed Metal)',
      composition: '等轴测 (Isometric)'
    }
  },
  { 
    id: 'cobalt', 
    label: '深海蓝调', 
    color: '#0047AB',
    params: {
      palette: '高对比赛博 (High-contrast Cyber)',
      background: '平滑玻璃 (Smooth Glass)',
      material: '发光网格 (Glowing Mesh)',
      composition: '3D 架构图 (3D Schematic)'
    }
  },
  { 
    id: 'blueprint', 
    label: '极简图纸', 
    color: '#666666',
    params: {
      palette: '黑白技术 (Monochrome Technical)',
      background: '技术网格 (Technical Grid)',
      material: '极简黑线 (Minimalist Ink)',
      composition: '平面透视 (Flat Perspective)'
    }
  },
  { 
    id: 'slate', 
    label: '暗岩专业', 
    color: '#2F4F4F',
    params: {
      palette: '现代商务 (Modern Corporate)',
      background: '平滑玻璃 (Smooth Glass)',
      material: '全息流体 (Holographic Fluid)',
      composition: '等轴测 (Isometric)'
    }
  }
];

export const useVisualState = (props: UseVisualStateProps) => {
  const {
    activeIssue, activeId, selectedLlmModel, llmApiKey,
    selectedImageModel, imageApiKey, projectPath,
    issues, setIssues, editor, showToast
  } = props;

  const [isVisualSidebarOpen, setIsVisualSidebarOpen] = useState(true);
  const [isExtractingVisuals, setIsExtractingVisuals] = useState(false);
  const [extractionMode, setExtractionMode] = useState<'cover' | 'infographic' | 'all' | null>(null);
  const extractionAbortControllerRef = useRef<AbortController | null>(null);
  const [extractedVisualsError, setExtractedVisualsError] = useState<string | null>(null);
  const [pendingVisuals, setPendingVisuals] = useState<VisualAsset[]>([]);
  const [generatingVisualIds, setGeneratingVisualIds] = useState<string[]>([]);
  const generationAbortControllers = useRef<Record<string, AbortController>>({});
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState('amber');
  const [collapsedTypes, setCollapsedTypes] = useState<string[]>([]);
  const [infographicExtraPrompt, setInfographicExtraPrompt] = useState('');
  const [infographicTargetCount, setInfographicTargetCount] = useState<number>(2);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [assetRefreshKey, setAssetRefreshKey] = useState<number>(Date.now());
  const lastAssetRefreshKey = useRef<number>(assetRefreshKey);
  const [coverExtraPrompt, setCoverExtraPrompt] = useState('');
  const [wechatDefaultCover, setWechatDefaultCover] = useState('');

  // Styles customization state
  const [customStyles, setCustomStyles] = useState<{id: string, label: string, color: string, params: any}[]>(() => {
    const saved = localStorage.getItem('custom_visual_styles');
    return saved ? JSON.parse(saved) : [];
  });
  const STYLE_PRESETS = [...DEFAULT_STYLE_PRESETS, ...customStyles];

  useEffect(() => {
    localStorage.setItem('custom_visual_styles', JSON.stringify(customStyles));
  }, [customStyles]);

  const [showCustomArchitect, setShowCustomArchitect] = useState(false);
  const [customStyleName, setCustomStyleName] = useState('');
  const [architectParams, setArchitectParams] = useState({
    palette: '现代商务 (Modern Corporate)',
    background: '技术网格 (Technical Grid)',
    material: '玻璃与铬合金 (Glass & Chrome)',
    composition: '等轴测 (Isometric)'
  });
  const [customStyleDNA, setCustomStyleDNA] = useState('');
  const [compareItems, setCompareItems] = useState<VisualHistoryEntry[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Auto-generate visual style DNA
  useEffect(() => {
    const dna = `# 角色：${customStyleName || '新风格'} 视觉 DNA 架构师

# 概况：
- 配色方案：${architectParams.palette}
- 背景材质：${architectParams.background}
- 核心材质：${architectParams.material}
- 构图方式：${architectParams.composition}

# 视觉逻辑：
- 高端 B2B 技术插画风格。
- 简洁的矢量线条，极具专业呼吸感。
- 覆盖专业技术网格底纹。
`;
    setCustomStyleDNA(dna);
  }, [architectParams, customStyleName]);

  const handleSelectStyle = (styleId: string) => {
    setSelectedStyleId(styleId);
    const style = STYLE_PRESETS.find(s => s.id === styleId);
    if (style && style.params) {
      setArchitectParams(style.params);
      setCustomStyleName(style.id.startsWith('custom-') ? style.label : `${style.label} - 定制`);
      setShowCustomArchitect(true);
    }
  };

  const handleSaveCustomStyle = (isUpdate = false) => {
    if (!customStyleName.trim() || !customStyleDNA.trim()) {
      alert('请填写风格名称和DNA内容');
      return;
    }
    if (isUpdate && selectedStyleId.startsWith('custom-')) {
      setCustomStyles(prev => prev.map(s => s.id === selectedStyleId ? {
        ...s,
        label: customStyleName,
        params: { ...architectParams }
      } : s));
      showToast("风格已更新", "success");
    } else {
      const newStyle = {
        id: `custom-${Date.now()}`,
        label: customStyleName,
        params: { ...architectParams },
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      };
      setCustomStyles(prev => [...prev, newStyle]);
      setSelectedStyleId(newStyle.id);
      showToast("新风格已保存", "success");
    }
  };

  const resolveAssetUrl = (path: string, key?: number) => {
    if (!path) return '';
    let norm = path.replace(/\\/g, '/');
    const issueMatch = norm.match(/(Issue_[^/]+)\/(assets\/.*)/i);
    if (issueMatch) {
      const folderName = issueMatch[1];
      const relativeAssetPath = issueMatch[2];
      const k = key || assetRefreshKey;
      return `/project-assets/${folderName}/${relativeAssetPath}${k ? `?t=${k}` : ''}`;
    }
    if (norm.startsWith('http') || norm.startsWith('data:') || (norm.includes(':') && !/^[a-zA-Z]:\//.test(norm))) {
      return norm;
    }
    if (/^[a-zA-Z]:\//.test(norm)) {
      norm = norm.replace(/^[a-zA-Z]:\//, '/');
    }
    if (norm.startsWith('/project-assets/') || norm.startsWith('project-assets/')) {
      const cleanPath = norm.startsWith('/') ? norm : '/' + norm;
      const k = key || assetRefreshKey;
      return `${cleanPath}${k ? `?t=${k}` : ''}`;
    }
    const cleanPath = norm.startsWith('/') ? norm.substring(1) : norm;
    const activeChapterId = activeId === 'plan' ? 'plan' : activeIssue?.id || 'unknown';
    const folderName = getChapterFolderName(activeChapterId);
    const k = key || assetRefreshKey;
    return `/project-assets/${folderName}/${cleanPath}${k ? `?t=${k}` : ''}`;
  };

  const handleSyncHistory = async (overrideIssues?: Chapter[], overrideVisuals?: any[]) => {
    const currentIssues = overrideIssues || issues;
    const currentVisuals = overrideVisuals || pendingVisuals;
    if (!projectPath || !currentIssues.length) return;
    try {
      const response = await fetch('/api/sync-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: projectPath,
          issues: currentIssues,
          pendingVisuals: currentVisuals
        })
      });
      const data = await response.json();
      if (data.success && data.issues) {
        setIssues(data.issues);
        const currentIdStr = String(activeId).replace('issue-', '');
        const activeIdx = data.issues.findIndex((i: any) => String(i.id).replace('issue-', '') === currentIdStr);
        if (activeIdx !== -1 && data.issues[activeIdx]) {
           const vPoints = data.issues[activeIdx].visualPoints || data.issues[activeIdx].visuals || [];
           setPendingVisuals(vPoints);
        }
        setAssetRefreshKey(Date.now());
      }
    } catch (err) {
      console.error("Sync history failed:", err);
    }
  };

  const handleRestoreHistory = async (visual: any, historyEntry: any) => {
    if (!visual || !historyEntry) return;
    try {
      const response = await fetch('/api/restore-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: historyEntry.absolutePath || historyEntry.path,
          targetPath: visual.absolutePath || visual.path,
          projectPath: projectPath,
          visual: visual,
          historyEntry: historyEntry
        })
      });
      
      const data = await response.json();
      if (data.success) {
        const updatedVisuals = pendingVisuals.map(v => 
          v.id === visual.id 
            ? { 
                ...v, 
                path: data.path || v.path, 
                absolutePath: data.absolutePath || v.absolutePath,
                activeTimestampPath: historyEntry.path 
              } 
            : v
        );
        setPendingVisuals(updatedVisuals);

        const currentIdStr = String(activeId).replace('issue-', '');
        const updatedIssues = issues.map(issue => {
          if (String(issue.id).replace('issue-', '') === currentIdStr) {
             const vPoints = (issue.visualPoints || issue.visuals || []) as any[];
             const updatedVPoints = vPoints.map((v: any) => 
               v.id === visual.id ? { 
                 ...v, 
                 path: data.path || v.path, 
                 absolutePath: data.absolutePath || v.absolutePath,
                 activeTimestampPath: historyEntry.path 
               } : v
             );
             return {
               ...issue,
               visualPoints: updatedVPoints,
               visuals: updatedVPoints
             };
          }
          return issue;
        });
        setIssues(updatedIssues);
        
        const newRefreshKey = Date.now();
        setAssetRefreshKey(newRefreshKey); 
        (window as any).__ASSET_REFRESH_KEY__ = newRefreshKey;
        
        if (editor) {
          const portablePath = data.path || visual.path;
          editor.state.doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'image' && (node.attrs.visualId === visual.id || node.attrs.anchor === visual.anchorText)) {
              editor.chain()
                .setNodeSelection(pos)
                .updateAttributes('image', { 
                  src: portablePath,
                  refreshKey: newRefreshKey 
                })
                .run();
              return false;
            }
            return true;
          });
        }

        showToast(`已还原至版本: ${historyEntry.path.split('-').pop()?.split('.')[0] || '选中版本'}`, 'success');
        await handleSyncHistory(updatedIssues, updatedVisuals);
      } else {
        showToast(`还原失败: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast("还原失败", "error");
    }
  };

  const insertImageWithPosition = (visual: any, resultData?: any) => {
    if (!editor) return;
    let path = resultData?.path || visual.path || resultData?.absolutePath || visual.absolutePath;
    if (!path) return;
    
    path = resolveAssetUrl(path);
    
    let portablePath = path;
    const projectMatch = portablePath.match(/\/project-assets\/[^/]+\/(assets\/.*)/);
    if (projectMatch) {
      portablePath = projectMatch[1];
    } else if (portablePath.startsWith('/assets/')) {
      portablePath = portablePath.substring(1);
    }

    portablePath = portablePath.replace(/(assets\/(?:cover|infographic_[0-9]+)\/)(cover|infographic)-[0-9]+\.(png|webp|jpg|jpeg)$/i, '$1$2.$3')
                             .replace(/(cover|infographic)-[0-9]+\.(png|webp|jpg|jpeg)$/i, '$1.$2');
    portablePath = portablePath.replace(/-(?:\d+)\.(png|webp|jpg|jpeg)$/i, '.$1');

    const anchorText = visual.anchorText;
    let foundRange: { from: number, to: number } | null = null;
    let isExistingImageMatch = false;

    editor.state.doc.descendants((node: any, pos: number) => {
      if (foundRange) return false;
      if (node.isText && anchorText && node.text?.includes(anchorText)) {
        const offset = node.text.indexOf(anchorText);
        foundRange = { from: pos + offset, to: pos + offset + anchorText.length };
        return false;
      }
      if (node.type.name === 'image' && node.attrs.anchor === anchorText) {
        foundRange = { from: pos, to: pos + node.nodeSize };
        isExistingImageMatch = true;
        return false;
      }
      if (node.type.name === 'visualSlot' && node.attrs.anchor === anchorText) {
        foundRange = { from: pos, to: pos + node.nodeSize };
        return false;
      }
      return true;
    });

    if (foundRange) {
      editor.chain().focus()
        .deleteRange(foundRange)
        .insertContentAt(foundRange.from, {
          type: 'image',
          attrs: { 
            src: portablePath, 
            alt: visual.labels || '', 
            anchor: anchorText, 
            title: anchorText,
            visualId: visual.id,
            refreshKey: Date.now()
          }
        }).run();
      showToast(isExistingImageMatch ? "已更新原有位置的图片" : "已在预设锚点处插入图片", "success");
    } else {
      let fuzzyRange: { from: number, to: number } | null = null;
      const coreId = visual.id;

      editor.state.doc.descendants((node: any, pos: number) => {
        if (fuzzyRange) return false;
        if (node.type.name === 'image' && node.attrs.visualId === coreId) {
          fuzzyRange = { from: pos, to: pos + node.nodeSize };
          return false;
        }
        if (node.isText && node.text?.includes(coreId)) {
          fuzzyRange = { from: pos, to: pos + node.nodeSize };
          return false;
        }
        return true;
      });

      if (fuzzyRange) {
         editor.chain()
           .focus()
           .deleteRange(fuzzyRange)
           .insertContentAt(fuzzyRange.from, {
             type: 'image',
             attrs: { src: portablePath, alt: visual.labels || '', anchor: anchorText, title: anchorText, visualId: visual.id }
           })
           .run();
         showToast("已成功更新原有配图", "success");
      } else {
         if (visual.type === 'cover') {
            editor.chain()
              .focus()
              .insertContentAt(0, {
                type: 'image',
                attrs: { src: portablePath, alt: visual.labels || '', anchor: anchorText, title: anchorText, visualId: visual.id }
              })
              .run();
            showToast("未找到预设锚点，已自动在文章顶部插入头图", "info");
         } else {
            const { from } = editor.state.selection;
            editor.chain()
              .focus()
              .insertContentAt(from, {
                type: 'image',
                attrs: { src: portablePath, alt: visual.labels || '', anchor: anchorText, title: anchorText, visualId: visual.id }
              })
              .run();
            showToast("未找到预设锚点，已在当前位置插入图片", "warning");
         }
      }
    }
  };

  const handleExtractVisuals = async (modeOrEvent: 'cover' | 'infographic' | 'all' | any = 'all', extraRequirement?: string, targetCount?: number) => {
    const mode = typeof modeOrEvent === 'string' ? modeOrEvent : 'all';
    if (!activeIssue?.content || activeId === 'plan') {
      showToast("请先选择具体篇目并生成内容，再提取视觉点", "error");
      return;
    }
    
    setIsExtractingVisuals(true);
    setExtractionMode(mode as any);
    setIsVisualSidebarOpen(true);
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
    }
    extractionAbortControllerRef.current = new AbortController();

    try {
      const selectedStyle = STYLE_PRESETS.find(s => s.id === selectedStyleId);
      const resp = await fetch('/api/extract-visual-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: extractionAbortControllerRef.current.signal,
        body: JSON.stringify({ 
          text: activeIssue.content,
          chapterTitle: activeIssue.title,
          styleName: selectedStyle?.label || "工业琥珀",
          mode,
          extraRequirement,
          targetCount,
          llmModel: selectedLlmModel,
          llmApiKey: llmApiKey
        })
      });
      const data = await resp.json();
      if (data.success) {
        setExtractedVisualsError(null);
        const relevantPoints = (data.points || []).filter((p: any) => mode === 'all' || p.type === mode);

        const newPoints = relevantPoints.map((p: any, idx: number) => {
          const existing = pendingVisuals.find(v => 
            v.type === p.type && (
              (p.type === 'cover' && v.chapterId === activeIssue.id) || 
              (v.anchorText && v.anchorText === p.anchorText) ||
              (v.id === p.id)
            )
          );

          return {
            ...p,
            id: existing?.id || `${Date.now()}-${idx}`,
            chapterId: activeIssue.id,
            generated: existing?.generated || false,
            path: existing?.path,
            absolutePath: existing?.absolutePath,
            styleDNA: existing?.styleDNA,
            history: existing?.history || []
          };
        });
        
        if (mode === 'all') {
          setPendingVisuals(newPoints);
        } else if (mode === 'cover') {
          setPendingVisuals(prev => [...prev.filter(v => v.type !== 'cover'), ...newPoints]);
        } else if (mode === 'infographic') {
          setPendingVisuals(prev => [...prev.filter(v => v.type !== 'infographic'), ...newPoints]);
        } else {
          setPendingVisuals(prev => [...prev, ...newPoints]);
        }
        showToast("视觉点策划成功，请在下方查看", "success");
      } else {
        setExtractedVisualsError(data.error);
        showToast(`策划失败: ${data.error}`, "error");
      }
    } catch (err: any) {
      setExtractedVisualsError(err.message);
      showToast(`策划出错: ${err.message}`, "error");
    } finally {
      setIsExtractingVisuals(false);
      setExtractionMode(null);
    }
  };

  const handleGenerateVisual = async (visual: any) => {
    if (generatingVisualIds.includes(visual.id)) return;
    setGeneratingVisualIds(prev => [...prev, visual.id]);
    const controller = new AbortController();
    generationAbortControllers.current[visual.id] = controller;

    try {
      let finalDNA = customStyleDNA;
      if (!finalDNA || finalDNA.length < 20) {
        finalDNA = `Minimalist Blueprint style: Clean architectural drawing, white background, precise grey technical ink lines.`;
      }

      const resp = await fetch('/api/generate-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          description: visual.description,
          type: visual.type,
          chapterId: visual.chapterId,
          labels: visual.labels,
          styleDNA: finalDNA,
          imageModel: selectedImageModel,
          imageKey: imageApiKey
        })
      });
      const data = await resp.json();
      if (data.success) {
        showToast("生成成功！图片已自动插入文章", "success");
        insertImageWithPosition(visual, data);
        
        const newHistoryEntry: VisualHistoryEntry = {
          path: data.path,
          absolutePath: data.absolutePath,
          timestamp: Date.now()
        };

        const updatedPending = pendingVisuals.map(v => v.id === visual.id ? { 
          ...v, 
          generated: true, 
          path: data.path, 
          absolutePath: data.absolutePath,
          styleDNA: finalDNA,
          history: [...(Array.isArray(v.history) ? v.history : []), { 
            ...newHistoryEntry, 
            styleDNA: finalDNA,
            description: v.description,
            labels: v.labels,
            anchorText: v.anchorText
          }]
        } : v);

        setPendingVisuals(updatedPending);

        if (visual.type === 'cover') {
          setWechatDefaultCover(data.path);
        }

        const currentIdStr = String(activeId).replace('issue-', '');
        const updatedIssues = issues.map(issue => {
          if (String(issue.id).replace('issue-', '') === currentIdStr) {
             return {
               ...issue,
               visualPoints: updatedPending,
               visuals: updatedPending
             };
          }
          return issue;
        });
        setIssues(updatedIssues);

        await handleSyncHistory(updatedIssues, updatedPending);
      } else {
        showToast(`生成失败: ${data.error}`, "error");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast(`生成时发生异常: ${err.message}`, "error");
      }
    } finally {
      setGeneratingVisualIds(prev => prev.filter(id => id !== visual.id));
      delete generationAbortControllers.current[visual.id];
    }
  };

  const handleGenerateAllInfographics = async () => {
    const infographics = pendingVisuals.filter(v => v.type === 'infographic' && v.chapterId === activeIssue?.id);
    if (infographics.length === 0) {
      showToast("没有可生成的信息图方案", "info");
      return;
    }
    setIsBatchGenerating(true);
    showToast(`启动 ${infographics.length} 个并行生成任务...`, "info");
    infographics.forEach(v => handleGenerateVisual(v));
  };

  // Monitor batch completion
  useEffect(() => {
    if (isBatchGenerating) {
      const remainingInfographics = pendingVisuals
        .filter(v => v.type === 'infographic')
        .map(v => v.id);
      const isStillGenerating = generatingVisualIds.some(id => remainingInfographics.includes(id));
      if (!isStillGenerating && generatingVisualIds.length === 0) {
        setIsBatchGenerating(false);
      }
    }
  }, [generatingVisualIds, isBatchGenerating, pendingVisuals]);

  const state = {
    isVisualSidebarOpen, setIsVisualSidebarOpen,
    isExtractingVisuals, setIsExtractingVisuals,
    extractionMode, setExtractionMode,
    extractionAbortControllerRef,
    extractedVisualsError, setExtractedVisualsError,
    pendingVisuals, setPendingVisuals,
    generatingVisualIds, setGeneratingVisualIds,
    generationAbortControllers,
    isBatchGenerating, setIsBatchGenerating,
    selectedStyleId, setSelectedStyleId,
    collapsedTypes, setCollapsedTypes,
    infographicExtraPrompt, setInfographicExtraPrompt,
    infographicTargetCount, setInfographicTargetCount,
    openHistoryId, setOpenHistoryId,
    assetRefreshKey, setAssetRefreshKey,
    lastAssetRefreshKey,
    coverExtraPrompt, setCoverExtraPrompt,
    STYLE_PRESETS,
    showCustomArchitect, setShowCustomArchitect,
    customStyleName, setCustomStyleName,
    architectParams, setArchitectParams,
    customStyleDNA, setCustomStyleDNA,
    compareItems, setCompareItems,
    showComparisonModal, setShowComparisonModal,
    customStyles, setCustomStyles,
    handleSelectStyle,
    handleSaveCustomStyle,
    resolveAssetUrl,
    handleSyncHistory,
    handleRestoreHistory,
    insertImageWithPosition,
    handleExtractVisuals,
    handleGenerateVisual,
    handleGenerateAllInfographics
  };

  return {
    ...state,
    visualState: state
  };
};