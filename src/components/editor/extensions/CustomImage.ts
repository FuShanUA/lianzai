import { Image } from '@tiptap/extension-image';

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: element => element.getAttribute('data-original-src') || element.getAttribute('src'),
        renderHTML: attributes => {
          if (!attributes.src) return {};
          let renderSrc = attributes.src;
          if (renderSrc.startsWith('assets/')) {
            const activeChapterId = (window as any).__ACTIVE_ID__ || '1';
            const folderName = (window as any).__ACTIVE_CHAPTER_FOLDER__ || `Issue_${activeChapterId}`;
            const refreshKey = attributes.refreshKey || (window as any).__ASSET_REFRESH_KEY__ || '';
            
            renderSrc = `/project-assets/${folderName}/${renderSrc}${refreshKey ? `?t=${refreshKey}` : ''}`;
          }
          return {
            src: renderSrc,
            'data-original-src': attributes.src,
            'data-refresh-key': attributes.refreshKey
          };
        }
      },
      refreshKey: {
        default: null,
        parseHTML: element => element.getAttribute('data-refresh-key'),
        renderHTML: attributes => {
          if (!attributes.refreshKey) return {};
          return { 'data-refresh-key': attributes.refreshKey };
        },
      },
      anchor: {
        default: null,
        parseHTML: element => element.getAttribute('data-anchor') || element.getAttribute('title'),
        renderHTML: attributes => {
          if (!attributes.anchor) return {};
          return { 
            'data-anchor': attributes.anchor,
            'title': attributes.anchor
          };
        },
      },
      visualId: {
        default: null,
        parseHTML: element => element.getAttribute('data-visual-id'),
        renderHTML: attributes => {
          if (!attributes.visualId) return {};
          return { 'data-visual-id': attributes.visualId };
        },
      }
    };
  },
});