/* @flow */

import _ from 'underscore';
import React from 'react';

const loadedSrcs = new Set();
const pendingLazyImages = new Set();

// Check whether to load images on scroll events but throttle the check to once every 150ms because
// scroll events are numerous.
window.addEventListener('scroll', _.throttle(function() {
  for (const lazyImage of pendingLazyImages) {
    lazyImage.checkShouldLoad();
  }
}, 150));

type Props = {
  height: number,
  src: string,
  style?: {[key: string]: any},
  width: number,
};

const BASE64_PLACEHOLDER_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAFElEQVR42mN8+J8BL2AcVTCSFAAAxogeERIcrasAAAAASUVORK5CYII=';

export default class LazyImage extends React.PureComponent {
  props: Props;
  state: {
    loaded: boolean,
  };

  _img: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      loaded: loadedSrcs.has(this.props.src),
    };
  }

  componentDidMount() {
    if (!this.props.loaded) {
      pendingLazyImages.add(this);
      this.checkShouldLoad();
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
    if (!this._img) return;

    const rect = this._img.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );

    if (isInViewport) {
      loadedSrcs.add(this.props.src);
      pendingLazyImages.delete(this);
      this.setState({loaded: true});
    }
  }

  render() {
    const props = this.state.loaded
      ? this.props
      // If the image has not yet been visible in the viewport, use a base64-encoded image as its
      // placeholder and round its radius to make a pleasant, gray circle.
      : Object.assign({}, this.props, {
          src: BASE64_PLACEHOLDER_SRC,
          style: Object.assign({}, this.props.style, {borderRadius: `${this.props.height / 2}px`}),
        });
    return <img ref={img => {this._img = img; }} {...props} />;
  }
}
