/* @flow */

import _ from 'underscore';
import React from 'react';

// Whether `LazyImage` instances should check to load their images immediately. This will be true
// only after a period of time that allows the popup to show quickly.
let checkShoudLoadOnMount = false;

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
  checkShoudLoadOnMount = true;

  // Check whether to load images on scroll events but throttle the check to once every 150ms
  // because scroll events are numerous.
  window.addEventListener('scroll', _.throttle(checkShouldLoadLazyImages, 150));
}, 1000);

type Props = {
  height: number,
  src: string,
  style?: {[key: string]: any},
  width: number,
};

export default class LazyImage extends React.PureComponent {
  props: Props;
  state: {
    loaded: boolean,
  };

  _placeholder: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      loaded: loadedSrcs.has(this.props.src),
    };
  }

  componentDidMount() {
    if (!this.state.loaded) {
      pendingLazyImages.add(this);
      if (checkShoudLoadOnMount) this.checkShouldLoad();
    }
  }

  componentWillUnmount() {
    if (pendingLazyImages.has(this)) {
      pendingLazyImages.delete(this);
    }
    if (loadedSrcs.has(this.props.src)) {
      loadedSrcs.delete(this.props.src);
    }
  }

  checkShouldLoad() {
    if (!this._placeholder) return;

    const rect = this._placeholder.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    if (isInViewport) {
      loadedSrcs.add(this.props.src);
      pendingLazyImages.delete(this);
      this.setState({loaded: true});
    }
  }

  render() {
    if (this.state.loaded) {
      return <img {...this.props} />;
    } else {
      const style = Object.assign({}, this.props.style, {
        background: '#ccc',
        borderRadius: `${this.props.height / 2}px`,
        display: 'inline-block',
        height: `${this.props.height}px`,
        verticalAlign: 'sub',
        width: `${this.props.width}px`,
      });
      return <div ref={placeholder => { this._placeholder = placeholder; }} style={style} />;
    }
  }
}
