/* @flow */

import React from 'react';

type Props = {
  selectedOption?: string,
  onChange?: () => void,
};

export default class TabWrangleOption extends React.Component {
  constructor(props: Props) {
    super(props);

    this.state = {selectedOption: this.props.selectedOption };
    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    this.setState({
      selectedOption: e.target.value,
    });

    this.props.onChange(e);
  }

  render() {
    const checked = this.state.selectedOption;

    return (
      <form className="form-inline"
            onSubmit={this.handleChange} style={{ marginBottom: '20px' }}>
          <div className="form-check">
            <label className="form-check-label">
              <input
                className="form-check-input"
                type="radio"
                value="withDupes"
                name="wrangleOption"
                id="withDupes"
                onChange={this.handleChange}
                checked={checked === 'withDupes'}
              /> With Duplicates
            </label>
          </div>
          <div className="form-check">
            <label className="form-check-label">
              <input
                className="form-check-input"
                type="radio"
                value="exactURLMatch"
                name="wrangleOption"
                id="exactURLMatch"
                onChange={this.handleChange}
                checked={checked === 'exactURLMatch'}
              /> Exact URL match
            </label>
          </div>
          <div className="form-check">
            <label className="form-check-label">
              <input
                className="form-check-input"
                type="radio"
                value="hostnameAndTitleMatch"
                name="wrangleOption"
                id="hostnameAndTitleMatch"
                onChange={this.handleChange}
                checked={checked === 'hostnameAndTitleMatch'}
              /> Hostname and Title match
            </label>
          </div>
        <p className="help-block">
          <strong>Example:</strong> <i>cnn</i> would match every page on <i>cnn.com</i> and any
          URL with <i>cnn</i> anywhere in it.
        </p>
      </form>
    );
  }
}
