/* @flow */

import React from 'react';

type Props = {
  selectedOption?: string,
  onChange?: () => void
};

const OPTIONS = [
  { name: 'withDupes', text: 'With Duplicates' },
  { name: 'exactURLMatch', text: 'Exact URL match' },
  { name: 'hostnameAndTitleMatch', text: 'Hostname and Title match' },
];
export default class TabWrangleOption extends React.Component {
  constructor(props: Props) {
    super(props);

    this.state = { selectedOption: this.props.selectedOption };
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
      <form className="form-inline" style={{ marginBottom: '20px' }}>
        {OPTIONS.map(option => (
          <div className="form-check" key={option.name}>
            <label className="form-check-label">
              <input
                className="form-check-input"
                type="radio"
                value={option.name}
                name="wrangleOption"
                id={option.name}
                onChange={this.handleChange}
                checked={checked === option.name}
              />{' '}
              {option.text}
            </label>
          </div>
        ))}
        <div className="help-block">
          <strong>Options:</strong>
          <ul>
            <li>With Duplicates - Wrangle tab no matter what (Default and original behavior).</li>
            <li>Exact URL match - Wrangle tab only if it doesn't match an already wrangled tab.</li>
            <li>
              Hostname and Title match - Wrangle tab only if the hostname and the title doesn't
              match an already wrangled tab.
            </li>
          </ul>
        </div>
      </form>
    );
  }
}

TabWrangleOption.defaultProps = {
  selectedOption: 'withDupes',
};