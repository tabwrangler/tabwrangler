/* @flow */

import './LazyImage.css';
import ColorHash from 'color-hash';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

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

interface Props {
  className?: string;
  height: number;
  src: ?string;
  style?: Object;
  width: number;
}

interface State {
  loaded: boolean;
}

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

    const {src} = this.props;

    if (src == null || !this._placeholder) return;

    this._img = new Image();
    this._img.onload = this.setLoaded;
    this._img.src = src;
    pendingLazyImages.delete(this);
  }

  setLoaded = () => {
    this._img = null;
    loadedSrcs.add(this.props.src);
    this.setState({loaded: true});
  };

  render() {
    return (
      <ReactCSSTransitionGroup
        className="lazy-image-container"
        component="div"
        transitionEnterTimeout={250}
        transitionLeaveTimeout={250}
        transitionName="lazy-image">
        {(this.props.src != null && this.state.loaded) ?
          <img
            className={this.props.className}
            height={this.props.height}
            key="img"
            src={this.props.src}
            style={this.props.style}
            width={this.props.width}
          /> :
          <div
            className={this.props.className}
            key="placeholder"
            ref={(placeholder: ?HTMLDivElement) => { this._placeholder = placeholder; }}
            style={Object.assign({}, this.props.style, {
              background: colorHash.hex(this.props.src),
              borderRadius: `${this.props.height / 2}px`,
              height: `${this.props.height}px`,
              width: `${this.props.width}px`,
            })}
          />
        }
      </ReactCSSTransitionGroup>
    );
  }
}
