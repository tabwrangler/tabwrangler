import "./LazyImage.css";
import * as React from "react";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import ColorHash from "color-hash";
import cx from "classnames";

const colorHash = new ColorHash();
const loadedSrcs = new Set<string>();
const LazyImageContext = React.createContext(false);

export function LazyImageProvider({ children }: { children: React.ReactNode }) {
  const [shouldCheck, setShouldCheck] = React.useState(false);
  React.useEffect(() => {
    // Begin the loading process a full second after initial execution to allow the popup to open
    // before loading images. If images begin to load too soon after the popup opens, Chrome waits
    // for them to fully load before showing the popup.
    const timer = setTimeout(() => setShouldCheck(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  return <LazyImageContext.Provider value={shouldCheck}>{children}</LazyImageContext.Provider>;
}

interface Props {
  alt?: string;
  className?: string;
  height: number;
  src: string;
  style?: Record<string, unknown>;
  width: number;
}

const LazyImage = React.memo(function LazyImage(props: Props) {
  const shouldCheck = React.useContext(LazyImageContext);
  const [loaded, setLoaded] = React.useState(props.src == null || loadedSrcs.has(props.src));
  const imgNodeRef = React.useRef<HTMLElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const placeholderNodeRef = React.useRef<HTMLElement | null>(null);
  const placeholderRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (loaded || !shouldCheck || props.src == null || !placeholderRef.current) return () => {};

    const img = new Image();
    imgRef.current = img;
    img.onload = () => {
      imgRef.current = null;
      loadedSrcs.add(props.src);
      setLoaded(true);
    };
    img.src = props.src;

    return () => {
      if (imgRef.current != null) {
        imgRef.current.onload = null;
        imgRef.current = null;
      }
    };
  }, [shouldCheck, loaded, props.src]);

  return (
    <TransitionGroup className="lazy-image-container">
      {props.src != null && loaded ? (
        <CSSTransition classNames="lazy-image" key="img" nodeRef={imgNodeRef} timeout={250}>
          <img
            alt={props.alt}
            className={cx("lazy-image-img", props.className)}
            height={props.height}
            src={props.src}
            style={props.style}
            width={props.width}
          />
        </CSSTransition>
      ) : (
        <CSSTransition
          classNames="lazy-image"
          key="placeholder"
          nodeRef={placeholderNodeRef}
          timeout={250}
        >
          <div
            className={props.className}
            ref={placeholderRef}
            style={Object.assign({}, props.style, {
              background: colorHash.hex(props.src),
              borderRadius: `${props.height / 2}px`,
              height: `${props.height}px`,
              width: `${props.width}px`,
            })}
          />
        </CSSTransition>
      )}
    </TransitionGroup>
  );
});

export default LazyImage;
