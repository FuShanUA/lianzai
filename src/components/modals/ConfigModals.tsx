import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Cpu, Fingerprint, Share2, Compass, FolderOpen, 
  Settings2, Sparkles, AlertCircle
} from 'lucide-react';
import { TONE_OPTIONS } from '../../constants';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  onSave: () => void;
}

const BaseModal = ({ isOpen, onClose, title, icon, description, children, onSave }: ModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[100] bg-[#141414]/40 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-8 border-b border-[#141414]/5 flex items-center justify-between bg-[#F5F5F0]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center">{icon}</div>
              <div><h2 className="text-xl font-serif italic font-bold">{title}</h2><p className="text-xs text-[#141414]/50 mt-1">{description}</p></div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-8">{children}</div>
          <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#141414]/5 flex justify-end">
            <button onClick={onSave} className="px-6 py-2 bg-[#141414] text-white rounded-xl text-xs font-bold hover:bg-[#141414]/90 transition-all">保存设置</button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const SystemModal = ({ isOpen, onClose, aiState, onSave }: any) => {
  const isVertex = aiState.selectedLlmVendor === 'vertex';
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="系统基建配置" icon={<Cpu className="w-5 h-5" />} description="管理 AI 生成与图像生成引擎凭据" onSave={onSave}>
      <div className="space-y-6">
         {/* LLM Section */}
         <div className="space-y-4">
           <h3 className="text-xs font-bold text-[#141414]/60 border-b border-[#141414]/5 pb-1">1. 大语言模型 (LLM) 设定</h3>
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">LLM 供应商</label>
               <select value={aiState.selectedLlmVendor} onChange={(e) => {
                 const vendor = e.target.value;
                 aiState.setSelectedLlmVendor(vendor);
                 const models = aiState.llmVendors[vendor]?.models || [];
                 if (models.length > 0 && !models.includes(aiState.selectedLlmModel)) {
                   aiState.setSelectedLlmModel(models[0]);
                 }
               }} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs">
                 {Object.keys(aiState.llmVendors).length > 0 ? (
                   Object.entries(aiState.llmVendors).map(([key, config]: any) => (
                     <option key={key} value={key}>{config.name}</option>
                   ))
                 ) : (
                   <>
                     <option value="gemini">Google AI Studio</option>
                     <option value="vertex">Vertex AI (GCP)</option>
                   </>
                 )}
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">生成模型</label>
               <select value={aiState.selectedLlmModel} onChange={(e) => aiState.setSelectedLlmModel(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs">
                 {aiState.llmVendors[aiState.selectedLlmVendor]?.models.map((m: string) => (
                   <option key={m} value={m}>{m}</option>
                 )) || (
                   <>
                     <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                     <option value="gemini-3.1-flash-preview">gemini-3.1-flash-preview</option>
                   </>
                 )}
               </select>
             </div>
           </div>

           {!isVertex ? (
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">
                 {aiState.llmVendors[aiState.selectedLlmVendor]?.name || 'Gemini'} API Key
               </label>
               <input type="password" value={aiState.llmApiKey} onChange={(e) => aiState.setLlmApiKey(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" placeholder={`${aiState.llmVendors[aiState.selectedLlmVendor]?.name || 'Gemini'} 秘钥`} />
             </div>
           ) : (
             <div className="space-y-3">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-[#141414]/40">Vertex 项目 ID (GCP Project ID)</label>
                   <input type="text" value={aiState.vertexProjectId} onChange={(e) => aiState.setVertexProjectId(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-[#141414]/40">Vertex Location</label>
                   <input type="text" value={aiState.vertexLocation} onChange={(e) => aiState.setVertexLocation(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[9px] font-bold text-[#141414]/40">Service Account Key Path (.json)</label>
                 <div className="flex gap-2">
                   <input type="text" value={aiState.vertexSaKeyPath || ''} onChange={(e) => aiState.setVertexSaKeyPath(e.target.value)} className="flex-1 h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" />
                   <button onClick={async () => {
                     try {
                       const res = await fetch('/api/select-key');
                       if (res.ok) {
                         const data = await res.json();
                         if (data.path) aiState.setVertexSaKeyPath(data.path);
                       }
                     } catch (err) { console.error(err); }
                   }} className="px-4 h-10 bg-[#141414] text-white rounded-xl text-[10px] font-bold hover:bg-[#141414]/90 transition-all select-none whitespace-nowrap">选择文件</button>
                 </div>
               </div>
             </div>
           )}
         </div>

         {/* Image Section */}
         <div className="space-y-4 pt-4 border-t border-[#141414]/5">
           <h3 className="text-xs font-bold text-[#141414]/60 border-b border-[#141414]/5 pb-1">2. 视觉配图生成设定</h3>
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">配图 AI 供应商</label>
               <select value={aiState.selectedImageVendor} onChange={(e) => aiState.setSelectedImageVendor(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs">
                 <option value="google">Google Image</option>
                 <option value="replicate">Replicate (Flux/Hunyuan)</option>
                 <option value="vertex">Google Vertex Image</option>
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">配图生成模型</label>
               <select value={aiState.selectedImageModel} onChange={(e) => aiState.setSelectedImageModel(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs">
                 {aiState.imageVendors[aiState.selectedImageVendor]?.models.map((m: string) => (
                   <option key={m} value={m}>{m}</option>
                 )) || <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>}
               </select>
             </div>
           </div>
           {aiState.selectedImageVendor !== 'vertex' && (
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-[#141414]/40">配图 API Key</label>
               <input type="password" value={aiState.imageApiKey} onChange={(e) => aiState.setImageApiKey(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" placeholder="AI Studio / Replicate 秘钥 (选填，为空则使用系统 LLM 秘钥)" />
             </div>
           )}
         </div>
      </div>
    </BaseModal>
  );
};

export const BrandModal = ({ isOpen, onClose, projectState, onSave }: any) => {
  const handleCtaChange = (mode: 'none' | 'generate' | 'exact') => {
    projectState.setCtaMode(mode);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="品牌与业务策略" icon={<Fingerprint className="w-5 h-5" />} description="定义公司业务基因与标准引流方案" onSave={onSave}>
      <div className="space-y-6">
         <div className="space-y-2">
           <label className="text-[10px] uppercase font-bold opacity-40">公司业务 DNA (Business Background)</label>
           <textarea value={projectState.companyBusiness} onChange={(e) => projectState.setCompanyBusiness(e.target.value)} className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm min-h-[120px]" placeholder="详细描述您的公司业务、核心产品、受众群体等，AI 将自动融合至各连载篇目的叙事逻辑中..." />
         </div>

         <div className="space-y-4 pt-4 border-t border-[#141414]/5">
           <label className="text-[10px] uppercase font-bold opacity-40">引流策略设定 (CTA Strategy)</label>
           <div className="flex gap-4">
             <label className="flex items-center gap-2 text-xs font-bold text-[#141414]/60 cursor-pointer">
               <input type="radio" name="ctaMode" checked={projectState.ctaMode === 'none'} onChange={() => handleCtaChange('none')} className="text-[#141414] focus:ring-0" />
               无引流模板
             </label>
             <label className="flex items-center gap-2 text-xs font-bold text-[#141414]/60 cursor-pointer">
               <input type="radio" name="ctaMode" checked={projectState.ctaMode === 'generate'} onChange={() => handleCtaChange('generate')} className="text-[#141414] focus:ring-0" />
               AI 智能生成
             </label>
             <label className="flex items-center gap-2 text-xs font-bold text-[#141414]/60 cursor-pointer">
               <input type="radio" name="ctaMode" checked={projectState.ctaMode === 'exact'} onChange={() => handleCtaChange('exact')} className="text-[#141414] focus:ring-0" />
               精准模板注入
             </label>
           </div>

           {projectState.ctaMode === 'exact' && (
             <div className="space-y-2">
               <label className="text-[9px] font-bold text-[#141414]/40">精确引流模板内容 (Exact CTA Template)</label>
               <textarea value={projectState.exactCtaTemplate} onChange={(e) => projectState.setExactCtaTemplate(e.target.value)} className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-xs font-mono min-h-[120px]" placeholder="输入需要在文章末尾 1:1 精确注入的公众号二维码/入群指南/引流话术模板..." />
             </div>
           )}

           {projectState.ctaMode === 'generate' && (
             <div className="space-y-2">
               <label className="text-[9px] font-bold text-[#141414]/40">智能引流生成指南 (Generate CTA Prompt)</label>
               <textarea value={projectState.generateCtaTemplate} onChange={(e) => projectState.setGenerateCtaTemplate(e.target.value)} className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-xs min-h-[100px]" placeholder="给 AI 智能生成引流方案的指导词，例如：引导读者添加助教微信获取完整 PDF 并提供专属社群体验..." />
             </div>
           )}
         </div>
      </div>
    </BaseModal>
  );
};

export const StrategyModal = ({ isOpen, onClose, projectState, onSave }: any) => {
  const handleEpisodeChange = (mode: 'auto' | 'fixed') => {
    projectState.setEpisodeMode(mode);
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="连载策略策划" icon={<Compass className="w-5 h-5" />} description="设定当前连载的目的、期数与时事深度" onSave={onSave}>
      <div className="space-y-6">
         <div className="space-y-2">
           <label className="text-[11px] font-bold text-[#141414]/60">1. 报告分解深度与目的 (Report Breakdown Intent)</label>
           <textarea value={projectState.reportPurpose} onChange={(e) => projectState.setReportPurpose(e.target.value)} className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm min-h-[100px]" placeholder="例如：偏重实战案例，要求对数据指标进行极度详尽的解读，或站在战略高度提出落地路线图..." />
         </div>

         <div className="space-y-2">
           <label className="text-[11px] font-bold text-[#141414]/60">2. 当前政策/行业动态热点 (Tying to Dynamic Hotspots)</label>
           <textarea value={projectState.currentHotspot} onChange={(e) => projectState.setCurrentHotspot(e.target.value)} className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-xs min-h-[80px]" placeholder="例如：结合最近数据要素入表政策风口，或 DCMM 贯标审核最新规范要求..." />
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <label className="text-[11px] font-bold text-[#141414]/60">3. 篇目数量策划 (Episodes)</label>
             <div className="flex gap-3 h-10 items-center">
               <label className="flex items-center gap-1.5 text-xs font-bold text-[#141414]/60 cursor-pointer">
                 <input type="radio" name="episodeMode" checked={projectState.episodeMode === 'auto'} onChange={() => handleEpisodeChange('auto')} className="text-[#141414] focus:ring-0" />
                 AI 智能期数
               </label>
               <label className="flex items-center gap-1.5 text-xs font-bold text-[#141414]/60 cursor-pointer">
                 <input type="radio" name="episodeMode" checked={projectState.episodeMode === 'fixed'} onChange={() => handleEpisodeChange('fixed')} className="text-[#141414] focus:ring-0" />
                 固定期数
               </label>
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-[11px] font-bold text-[#141414]/60">4. 连载总篇数 (Count)</label>
             {projectState.episodeMode === 'fixed' ? (
               <input type="number" min={1} max={20} value={projectState.episodeCount || 5} onChange={(e) => projectState.setEpisodeCount(Number(e.target.value))} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs" />
             ) : (
               <div className="w-full h-10 px-3 bg-[#141414]/5 border border-[#141414]/5 rounded-xl text-xs text-[#141414]/40 flex items-center justify-center font-bold">智能自动规划</div>
             )}
           </div>
         </div>

         <div className="space-y-2">
           <label className="text-[11px] font-bold text-[#141414]/60">5. 整体内容调性 (Tone)</label>
           <select value={projectState.selectedTone} onChange={(e) => projectState.setSelectedTone(e.target.value)} className="w-full p-3.5 bg-[#F5F5F0]/50 border border-[#141414]/5 rounded-2xl text-sm font-bold">
             {TONE_OPTIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
           </select>
         </div>
      </div>
    </BaseModal>
  );
};

export const PublisherModal = ({ isOpen, onClose, projectState, onSave }: any) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="发布通道配置" icon={<Share2 className="w-5 h-5" />} description="配置微信公众号发布凭证与文章主题设置" onSave={onSave}>
    <div className="space-y-6">
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-1">
           <label className="text-[10px] font-bold text-[#141414]/40">微信公众号 AppID</label>
           <input type="text" value={projectState.wechatAppId || ''} onChange={(e) => projectState.setWechatAppId(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" placeholder="wx..." />
         </div>
         <div className="space-y-1">
           <label className="text-[10px] font-bold text-[#141414]/40">微信公众号 AppSecret</label>
           <input type="password" value={projectState.wechatSecret || ''} onChange={(e) => projectState.setWechatSecret(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" placeholder="秘钥" />
         </div>
       </div>
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-1">
           <label className="text-[10px] font-bold text-[#141414]/40">文章作者</label>
           <input type="text" value={projectState.wechatAuthor || ''} onChange={(e) => projectState.setWechatAuthor(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs" placeholder="作者名" />
         </div>
         <div className="space-y-1">
           <label className="text-[10px] font-bold text-[#141414]/40">排版渲染主题</label>
           <select value={projectState.wechatTheme || 'modern'} onChange={(e) => projectState.setWechatTheme(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs">
             <option value="modern">现代极简 (Modern)</option>
             <option value="default">默认风格 (Default)</option>
             <option value="elegant">典雅风尚 (Elegant)</option>
             <option value="simple">极简主义 (Simple)</option>
           </select>
         </div>
       </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#141414]/40">账号别名</label>
          <input type="text" value={projectState.wechatAccountAlias || 'default'} onChange={(e) => projectState.setWechatAccountAlias(e.target.value)} className="w-full h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs" placeholder="default" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#141414]/40">默认文章缩略图 (Default Cover)</label>
          <div className="flex gap-2">
            <input type="text" value={projectState.wechatDefaultCover || ''} onChange={(e) => projectState.setWechatDefaultCover(e.target.value)} className="flex-1 h-10 px-3 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-xs font-mono" placeholder="默认封面图片路径" />
            <button onClick={async () => {
              try {
                const res = await fetch('/api/select-image');
                if (res.ok) {
                  const data = await res.json();
                  if (data.path) projectState.setWechatDefaultCover(data.path);
                }
              } catch (err) { console.error(err); }
            }} className="px-4 h-10 bg-[#141414] text-white rounded-xl text-[10px] font-bold hover:bg-[#141414]/90 transition-all select-none">选择图片</button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input type="checkbox" id="wechatSyncEnabled" checked={projectState.wechatSyncEnabled || false} onChange={(e) => projectState.setWechatSyncEnabled(e.target.checked)} className="rounded border-[#141414]/10 text-[#141414] focus:ring-0 w-4 h-4" />
          <label htmlFor="wechatSyncEnabled" className="text-xs font-bold text-[#141414]/60 cursor-pointer">开启自动同步至微信草稿箱 (Sync to Drafts)</label>
        </div>
    </div>
  </BaseModal>
);
