/* @flow */

import React from 'react';

interface Props {
  onChange: (event: SyntheticInputEvent) => void;
  selectedOption: string;
}

const OPTIONS = [
  { name: 'withDupes', text: 'With Duplicates (Default)' },
  { name: 'exactURLMatch', text: 'Exact URL match' },
  { name: 'hostnameAndTitleMatch', text: 'Hostname and Title match' },
];

export default class TabWrangleOption extends React.Component {
  props: Props;

  render() {
    return (
      <form className="form-inline" style={{ marginBottom: '20px' }}>
        {OPTIONS.map(option => (
          <div className="radio" key={option.name}>
            <label>
              <input
                checked={this.props.selectedOption === option.name}
                className="form-check-input"
                id={option.name}
                name="wrangleOption"
                onChange={this.props.onChange}
                type="radio"
                value={option.name}
              />{' '}
              {option.text}
            </label>
          </div>
        ))}
        <div className="help-block">
          <dl>
            <dt>With Duplicates</dt>
            <dd>
              Always add a wrangled tab to the corral.
            </dd>
            <dt style={{ marginTop: '10px' }}>Exact URL match</dt>
            <dd>
              Add a wrangled tab to the corral only if its exact URL is unique in the corral. For
              example, a tab for "https://www.github.com" will not be added to the corral if there
              is already a tab with the exact same URL in the corral. The existing entry will be
              renewed instead.
            </dd>
            <dt style={{ marginTop: '10px' }}>Hostname and Title match</dt>
            <dd>
              Add a wrangled tab to the corral only if its hostname + page title pair are unique in
              the corral. For an example, a tab for "https://github.com/tabwrangler/tabwrangler"
              with title "tabwrangler/tabwrangler" will not be added to the corral if there is
              already an tab in the corral that matches both the hostname and the title. The
              existing entry will be renewed instead.
            </dd>
          </dl>
        </div>
      </form>
    );
  }
}
