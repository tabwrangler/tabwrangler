/* @flow */

import React from 'react';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import _ from 'lodash';

const loadedSrcs = new Set();
const pendingLazyImages = new Set();

function checkShouldLoadLazyImages() {
  for (const lazyImage of pendingLazyImages) {
    lazyImage.checkShouldLoad();
  }
}

// Check whether to load images on scroll events but throttle the check to once every 150ms
// because scroll events are numerous.
window.addEventListener('scroll', _.throttle(checkShouldLoadLazyImages, 150));

interface Props {
  className?: string;
  height: number;
  shouldCheck: boolean;
  src: ?string;
  style?: Object;
  width: number;
}

interface State {
  loaded: boolean;
}

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
      if (this.props.shouldCheck) this.checkShouldLoad();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.shouldCheck && this.props.shouldCheck) {
      this.checkShouldLoad();
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
    if (!this.props.shouldCheck) return;

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
              background: '#ccc',
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
