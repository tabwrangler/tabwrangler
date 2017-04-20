import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

export default class Button extends React.PureComponent {
  constructor() {
    super();
  }

  render() {
    const classes = classNames(['glyphicon', this.props.className]);
    const content = <span><i className={classes}></i> {this.props.label}</span>;

    return (
      <button className="btn btn-default btn-xs" onClick={this.props.clickHandler}>
        {content}
      </button>
    );
  }
}

Button.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
  clickHandler: PropTypes.func.isRequired,
};