export interface FaviconApiFaviconProps {
  alt?: string;
  className?: string;
  height: number;
  pageUrl?: string;
  src?: string;
  style?: React.CSSProperties;
  width: number;
}

/**
 * Renders the favicon for the page at `props.pageUrl`.
 * @see https://developer.chrome.com/docs/extensions/how-to/ui/favicons
 */
export default function FaviconApiFavicon({ pageUrl, ...restProps }: FaviconApiFaviconProps) {
  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(pageUrl ?? "")}&size=${restProps.height}`;
  return <img {...restProps} loading="lazy" src={faviconUrl} />;
}
