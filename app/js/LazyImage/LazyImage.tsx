import "./LazyImage.css";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import ColorHash from "color-hash";
import cx from "classnames";

const colorHash = new ColorHash();
const loadedSrcs = new Set<string>();
const LazyImageContext = createContext(false);

export interface LazyImageProviderProps {
  children: React.ReactNode;
}

export function LazyImageProvider({ children }: LazyImageProviderProps) {
  const [shouldCheck, setShouldCheck] = useState(false);
  useEffect(() => {
    // Begin the loading process a full second after initial execution to allow the popup to open
    // before loading images. If images begin to load too soon after the popup opens, Chrome waits
    // for them to fully load before showing the popup.
    const timer = setTimeout(() => setShouldCheck(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  return <LazyImageContext.Provider value={shouldCheck}>{children}</LazyImageContext.Provider>;
}

export interface LazyImageProps {
  alt?: string;
  className?: string;
  height: number;
  src?: string;
  style?: React.CSSProperties;
  width: number;
}

const LazyImage = memo(function LazyImage(props: LazyImageProps) {
  const shouldCheck = useContext(LazyImageContext);
  const [loaded, setLoaded] = useState(props.src == null || loadedSrcs.has(props.src));
  const imgNodeRef = useRef<HTMLElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const placeholderNodeRef = useRef<HTMLElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const propsSrc = props.src;
    if (loaded || !shouldCheck || propsSrc == null || !placeholderRef.current) return () => {};

    const img = new Image();
    imgRef.current = img;
    img.onload = () => {
      imgRef.current = null;
      loadedSrcs.add(propsSrc);
      setLoaded(true);
    };
    img.src = propsSrc;

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
              backgroundColor: props.src == null ? "black" : colorHash.hex(props.src),
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
