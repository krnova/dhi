  // Wiki Link Parser Utilities
  export interface WikiLink {
    id: string;
    displayText: string;
    startIndex: number;
    endIndex: number;
  }

  // Parse [[note-id]] or [[note-id|Custom Text]]
  // Now handles escaped brackets from Tiptap: \[\[note-id\]\]
  export function parseWikiLinks(content: string): WikiLink[] {
    // Match both escaped and unescaped brackets
    const wikiLinkRegex = /\\?\[\\?\[([a-z0-9-]+)(?:[\|\s]([^\]]+))?\\?\]\\?\]/g;
    const links: WikiLink[] = [];
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push({
        id: match[1],
        displayText: match[2] ? match[2].trim() : match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return links;
  }

  // Extract all note IDs from content
  export function extractLinkedNoteIds(content: string): string[] {
    const links = parseWikiLinks(content);
    return links.map(link => link.id);
  }

  // Create wiki link syntax
  export function createWikiLink(noteId: string, displayText?: string): string {
    if (displayText && displayText !== noteId) {
      return `[[${noteId}|${displayText}]]`;
    }
    return `[[${noteId}]]`;
  }

  // Replace wiki link IDs with titles for display
  export function renderWikiLinks(
    content: string,
    getNoteTitle: (id: string) => string | null
  ): string {
    const links = parseWikiLinks(content);
    let result = content;
    let offset = 0;

    for (const link of links) {
      const title = getNoteTitle(link.id);
      const displayText = title || link.displayText;
      const originalText = content.substring(link.startIndex, link.endIndex);
      const newText = displayText;

      result =
        result.substring(0, link.startIndex + offset) +
        newText +
        result.substring(link.endIndex + offset);

      offset += newText.length - originalText.length;
    }

    return result;
  }
