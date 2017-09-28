/* @flow */

import React from 'react';

type Props = {
  selectedOption: string,
  onChange: (event: SyntheticInputEvent) => void
};

const OPTIONS = [
  { name: 'withDupes', text: 'With Duplicates' },
  { name: 'exactURLMatch', text: 'Exact URL match' },
  { name: 'hostnameAndTitleMatch', text: 'Hostname and Title match' },
];
export default class TabWrangleOption extends React.Component {
  state: {
    selectedOption: string
  };

  static defaultProps = {
    selectedOption: 'withDupes',
    onChange: (event: SyntheticInputEvent) => {
      console.log(event);
    },
  };

  constructor(props: Props) {
    super(props);

    this.state = { selectedOption: this.props.selectedOption };
  }

  handleChange = (event: SyntheticInputEvent) => {
    this.setState({
      selectedOption: event.target.value,
    });

    this.props.onChange(event);
  };

  render() {
    const checked = this.state.selectedOption;

    return (
      <form className="form-inline" style={{ marginBottom: '20px' }}>
        {OPTIONS.map(option => (
          <div className="radio" key={option.name}>
            <label>
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
          <strong>Explanation:</strong>
          <ul>
            <li>
              With Duplicates - Wrangle tab no matter if it already exist in the wrangled tab list
              (Default and original behavior), e.g. a tab for http://www.github.com will be placed
              at top the wrangled tab list although there is an existing entry for it already.
            </li>
            <li>
              Exact URL match - Wrangle tab only if it doesn't match an already wrangled tab, e.g. a
              tab for http://www.github.com will not added to the wrangled tabs list if there is
              already one in the list. The existing entry will be moved to the top of the list
              instead.
            </li>
            <li>
              Hostname and Title match - Wrangle tab only if the hostname and the title doesn't
              match an already wrangled tab, e.g. a tab for
              https://github.com/tabwrangler/tabwrangler and title 'tabwrangler/tabwrangler' will
              only added to the wrangled tabs list, if there isn't already an entry that matches
              both the hostname and the title.
            </li>
          </ul>
        </div>
      </form>
    );
  }
}