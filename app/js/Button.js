import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

export default class Button extends React.PureComponent {
  constructor() {
    super();
  }

  render() {
    let classes = '';
    let spacer = '';

    if (this.props.glyph) {
      classes = classNames(['glyphicon', `glyphicon-${this.props.glyph}`]);
      spacer = ' ';
    }

    const content = <span><i className={classes}></i>{spacer}{this.props.children}</span>;

    return (
      <button className={this.props.className} onClick={this.props.onClick}>
        {content}
      </button>
    );
  }
}

Button.propTypes = {
  glyph: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};