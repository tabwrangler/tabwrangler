/* @flow */

import "./LazyImage.css";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import ColorHash from "color-hash";
import React from "react";
import cx from "classnames";

const loadedSrcs = new Set();
const pendingLazyImages = new Set();

function checkShouldLoadLazyImages() {
  for (const lazyImage of pendingLazyImages) {
    lazyImage.checkShouldLoad();
  }
}

// Begin the loading process a full second after initial execution to allow the popup to open
// before loading images. If images begin to load too soon after the popup opens, Chrome waits
// for them to fully load before showing the popup.
let shouldCheck = false;
setTimeout(() => {
  shouldCheck = true;
  checkShouldLoadLazyImages();
}, 1000);

type Props = {
  alt?: string,
  className?: string,
  height: number,
  src: ?string,
  style?: Object,
  width: number,
};

type State = {
  loaded: boolean,
};

const colorHash = new ColorHash();

export default class LazyImage extends React.PureComponent<Props, State> {
  _img: ?Image;
  _placeholder: ?HTMLDivElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      loaded: this.props.src == null || loadedSrcs.has(this.props.src),
    };
  }

  componentDidMount() {
    if (!this.state.loaded) {
      pendingLazyImages.add(this);
      if (shouldCheck) this.checkShouldLoad();
    }
  }

  componentWillUnmount() {
    if (pendingLazyImages.has(this)) {
      pendingLazyImages.delete(this);
    }

    // Ensure the loading image does not try to call this soon-to-be-unmounted component.
    if (this._img != null) {
      this._img.onload = null;
      this._img = null;
    }
  }

  checkShouldLoad() {
    if (!shouldCheck) return;

    const { src } = this.props;

    if (src == null || !this._placeholder) return;

    this._img = new Image();
    this._img.onload = this.setLoaded;
    this._img.src = src;
    pendingLazyImages.delete(this);
  }

  setLoaded = () => {
    this._img = null;
    loadedSrcs.add(this.props.src);
    this.setState({ loaded: true });
  };

  render() {
    return (
      <TransitionGroup className="lazy-image-container">
        {this.props.src != null && this.state.loaded ? (
          <CSSTransition classNames="lazy-image" key="img" timeout={250}>
            <img
              alt={this.props.alt}
              className={cx("lazy-image-img", this.props.className)}
              height={this.props.height}
              src={this.props.src}
              style={this.props.style}
              width={this.props.width}
            />
          </CSSTransition>
        ) : (
          <CSSTransition classNames="lazy-image" key="placeholder" timeout={250}>
            <div
              className={this.props.className}
              ref={(placeholder: ?HTMLDivElement) => {
                this._placeholder = placeholder;
              }}
              style={Object.assign({}, this.props.style, {
                background: colorHash.hex(this.props.src),
                borderRadius: `${this.props.height / 2}px`,
                height: `${this.props.height}px`,
                width: `${this.props.width}px`,
              })}
            />
          </CSSTransition>
        )}
      </TransitionGroup>
    );
  }
}
