import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageComponent from './ImageComponent';

export interface ImageOptions {
  inline: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

export const CustomImage = Node.create<ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
      // Also handle the data-src fallback we generate in renderHTML
      {
        tag: 'span[data-dhi-image]',
        getAttrs: (node) => ({
          src: (node as Element).getAttribute('data-src'),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, ...rest } = HTMLAttributes;
    
    // For DHI assets, we render a span placeholder.
    // The ReactNodeView (ImageComponent) immediately takes over rendering.
    // This prevents the browser from trying to fetch 'dhi-asset://' and throwing errors.
    if (src && src.startsWith('dhi-asset://')) {
      return [
        'span', 
        mergeAttributes(this.options.HTMLAttributes, rest, { 
          'data-dhi-image': '',
          'data-src': src,
          'style': 'display: inline-block; min-width: 100px; min-height: 100px; background: #1c1917;' 
        })
      ];
    }
    
    // Standard URL behavior for external images
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },
});
