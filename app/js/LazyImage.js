/* @flow */

import _ from 'underscore';
import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';

// Whether `LazyImage` instances should check to load their images immediately. This will be true
// only after a period of time that allows the popup to show quickly.
let checkShouldLoadOnMount = false;

const loadedSrcs = new Set();
const pendingLazyImages = new Set();

function checkShouldLoadLazyImages() {
  for (const lazyImage of pendingLazyImages) {
    lazyImage.checkShouldLoad();
  }
}

// Begin the loading process a full second after initial execution to allow the popup to open
// before loading images. If images begin to load too soon after the popup opens, Chrome waits for
// them to fully load before showing the popup.
setTimeout(function() {
  checkShouldLoadLazyImages();
  checkShouldLoadOnMount = true;

  // Check whether to load images on scroll events but throttle the check to once every 150ms
  // because scroll events are numerous.
  window.addEventListener('scroll', _.throttle(checkShouldLoadLazyImages, 150));
}, 1000);

type Props = {
  className?: string,
  height: number,
  src: ?string,
  style?: {[key: string]: any},
  width: number,
};

export default class LazyImage extends React.PureComponent {
  props: Props;
  state: {
    loaded: boolean,
  };

  _img: ?Image;
  _placeholder: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      loaded: this.props.src == null || loadedSrcs.has(this.props.src),
    };
  }

  componentDidMount() {
    if (!this.state.loaded) {
      pendingLazyImages.add(this);
      if (checkShouldLoadOnMount) this.checkShouldLoad();
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
    const {src} = this.props;

    if (src == null || !this._placeholder) return;

    const rect = this._placeholder.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    if (isInViewport) {
      this._img = new Image();
      this._img.onload = this.setLoaded;
      this._img.src = src;
      pendingLazyImages.delete(this);
    }
  }

  setLoaded = () => {
    this._img = null;
    loadedSrcs.add(this.props.src);
    this.setState({loaded: true});
  };

  render() {
    return (
      <ReactCSSTransitionGroup
        component="div"
        transitionEnterTimeout={250}
        transitionLeaveTimeout={250}
        transitionName="lazy-image">
        {(this.props.src != null && this.state.loaded) ?
          <img key="img" {...this.props} /> :
          <div
            className={this.props.className}
            key="placeholder"
            ref={placeholder => { this._placeholder = placeholder; }}
            style={Object.assign({}, this.props.style, {
              background: '#ccc',
              borderRadius: `${this.props.height / 2}px`,
              display: 'inline-block',
              height: `${this.props.height}px`,
              width: `${this.props.width}px`,
            })}
          />
        }
      </ReactCSSTransitionGroup>
    );
  }
}
