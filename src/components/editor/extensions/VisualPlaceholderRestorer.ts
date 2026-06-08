import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const VisualPlaceholderRestorer = Extension.create({
  name: 'visualPlaceholderRestorer',

  addStorage() {
    return {
      isPlan: false,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('visualPlaceholderRestorer'),
        appendTransaction(transactions, oldState, newState) {
          const docChanged = transactions.some(tr => tr.docChanged);
          if (!docChanged) return null;

          if ((this as any).storage?.isPlan) return null;

          const isChapterSwitch = transactions.some(tr => tr.getMeta('chapterSwitch'));
          if (isChapterSwitch) return null;

          let tr = newState.tr;
          let modified = false;

          const oldAnchors = new Map<string, number>();
          oldState.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs.anchor) {
              oldAnchors.set(node.attrs.anchor, pos);
            }
            return true;
          });

          if (oldAnchors.size === 0) return null;

          const newAnchors = new Set<string>();
          newState.doc.descendants((node) => {
            if (node.type.name === 'image' && node.attrs.anchor) {
              newAnchors.add(node.attrs.anchor);
            }
            if (node.type.name === 'visualSlot' && node.attrs.anchor) {
              newAnchors.add(node.attrs.anchor);
            }
            return true;
          });

          for (const [anchor, pos] of oldAnchors.entries()) {
            if (!newAnchors.has(anchor)) {
              let currentPos = pos;
              transactions.forEach(t => {
                if (t.docChanged) {
                  currentPos = t.mapping.map(currentPos);
                }
              });
              
              const lowerAnchor = anchor.toLowerCase();
              const isCover = lowerAnchor.includes('cover') || lowerAnchor.includes('metaphor');
              const label = isCover ? '本文头图预留' : '信息图预留';
              tr.insert(currentPos, newState.schema.nodes.visualSlot.create({ anchor, label }));
              modified = true;
            }
          }

          return modified ? tr : null;
        },
      }),
    ];
  },
});