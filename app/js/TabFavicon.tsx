import LazyImage, { LazyImageProps } from "./LazyImage/LazyImage";
import React from "react";

interface TabFaviconProps extends Omit<LazyImageProps, "src"> {
  favIconUrl?: string;
  url?: string;
}

export default function TabFavicon({ favIconUrl, ...restProps }: TabFaviconProps) {
  return HAS_FAVICON_API ? (
    <ChromeFavicon {...restProps} />
  ) : (
    <LazyImage {...restProps} src={favIconUrl ?? ""} />
  );
}

function ChromeFavicon(props: TabFaviconProps) {
  const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(props.url ?? "")}&size=${props.height}`;
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
