import { Node, mergeAttributes } from '@tiptap/core';

export const VisualSlot = Node.create({
  name: 'visualSlot',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      anchor: {
        default: null,
      },
      label: {
        default: '视觉占位符',
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="visual-slot"]',
        getAttrs: element => ({
          anchor: (element as HTMLElement).getAttribute('data-anchor'),
          label: (element as HTMLElement).getAttribute('data-label'),
        }),
      },
      {
        getAttrs: (text: string) => {
          if (typeof text !== 'string') return false;
          const match = text.match(/\[IMAGE_PLACEHOLDER:\s*([^\]]+)\]/);
          if (match) {
            const anchorRaw = match[1];
            const lowerAnchor = anchorRaw.toLowerCase();
            const isCover = lowerAnchor.includes('cover') || lowerAnchor.includes('metaphor');
            const label = isCover ? '本文头图预留' : '信息图预留';
            return { anchor: `[IMAGE_PLACEHOLDER: ${anchorRaw}]`, label };
          }
          return false;
        },
      } as any
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'visual-slot',
        class: 'my-4 p-6 border-2 border-dashed border-[#5A5A40]/20 rounded-2xl bg-[#5A5A40]/5 flex flex-col items-center justify-center gap-2 group hover:border-[#5A5A40]/40 transition-all cursor-default',
      }),
      [
        'div',
        { class: 'w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[#5A5A40]/40 group-hover:scale-110 transition-transform' },
        ['svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, 
          ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2', ry: '2' }],
          ['circle', { cx: '8.5', cy: '8.5', r: '1.5' }],
          ['polyline', { points: '21 15 16 10 5 21' }]
        ]
      ],
      ['span', { class: 'text-[10px] font-bold text-[#5A5A40]/60 uppercase tracking-widest' }, node.attrs.label || '视觉预留位'],
      ['span', { class: 'text-[9px] text-[#5A5A40]/30 font-mono' }, node.attrs.anchor]
    ];
  },
});