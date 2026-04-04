/* eslint-disable @typescript-eslint/no-var-requires */
import * as React from "react";
import type { LazyImageProps, LazyImageProviderProps } from "./LazyImage/LazyImage";
import type { FaviconApiFaviconProps } from "./FaviconApiFavicon";

// Import only the modules needed for the given browser capability.
// * Chrome: supports a custom favicon API for loading from disk for pages in browser history
// * Firefox: has no custom favicon support, favicons must be fetched over the internet
const TabFavicon = HAS_FAVICON_API
  ? (require("./ChromeFavicon") as { default: React.ComponentType<FaviconApiFaviconProps> }).default
  : (require("./LazyImage/LazyImage") as { default: React.ComponentType<LazyImageProps> }).default;

export const TabFaviconProvider: React.ComponentType<LazyImageProviderProps> = HAS_FAVICON_API
  ? function ImageProvider({ children }) {
      return <>{children}</>;
    }
  : require("./LazyImage/LazyImage").LazyImageProvider;

export default TabFavicon;
