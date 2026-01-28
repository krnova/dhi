  // Asset URL Handler - Convert between storage and display formats
  
  // Convert asset ID to markdown-safe format
  export function assetIdToMarkdown(assetId: string, filename: string): string {
    // Use a format that won't trigger browser URL loading
    return `![${filename}](dhi-asset://${assetId})`;
  }
  
  // Extract asset ID from markdown URL
  export function extractAssetId(url: string): string | null {
    if (url.startsWith('dhi-asset://')) {
      return url.replace('dhi-asset://', '');
    }
    if (url.startsWith('asset:')) {
      return url.replace('asset:', '');
    }
    return null;
  }
  
  // Check if URL is an asset reference
  export function isAssetUrl(url: string): boolean {
    return url.startsWith('dhi-asset://') || url.startsWith('asset:');
  }
