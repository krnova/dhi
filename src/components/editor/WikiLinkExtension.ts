  // Wiki Link Tiptap Extension
  import { Mark, mergeAttributes } from '@tiptap/core';

  export interface WikiLinkOptions {
    HTMLAttributes: Record<string, any>;
  }

  declare module '@tiptap/core' {
    interface Commands<ReturnType> {
      wikiLink: {
        setWikiLink: (noteId: string, displayText?: string) => ReturnType;
      };
    }
  }

  export const WikiLink = Mark.create<WikiLinkOptions>({
    name: 'wikiLink',

    addOptions() {
      return {
        HTMLAttributes: {},
      };
    },

    addAttributes() {
      return {
        noteId: {
          default: null,
        },
        displayText: {
          default: null,
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: 'a[data-wiki-link]',
        },
      ];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'a',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-wiki-link': '',
          class: 'wiki-link',
        }),
        0,
      ];
    },

    addCommands() {
      return {
        setWikiLink:
          (noteId, displayText) =>
          ({ commands }) => {
            return commands.setMark(this.name, { noteId, displayText });
          },
      };
    },
  });
