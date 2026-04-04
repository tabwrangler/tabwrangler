import * as React from "react";

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
export default function FaviconApiFavicon(props: FaviconApiFaviconProps) {
  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(props.pageUrl ?? "")}&size=${props.height}`;
  return (
    <img
      alt={props.alt}
      className={props.className}
      height={props.height}
      src={faviconUrl}
      style={props.style}
      width={props.width}
    />
  );
}
