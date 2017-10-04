/* @flow */

import React from 'react';

interface Props {
  onChange: (event: SyntheticInputEvent<HTMLInputElement>) => void;
  selectedOption: string;
}

const OPTIONS = [
  { name: 'withDupes', text: 'Never (Default)' },
  { name: 'exactURLMatch', text: 'If URL matches exactly' },
  { name: 'hostnameAndTitleMatch', text: 'If hostname and page title match' },
];

export default class TabWrangleOption extends React.Component<Props> {
  render() {
    return (
      <div>
        <label htmlFor="wrangleOption">Prevent duplicate tabs in the Tab Corral:</label>
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
        <div className="row">
          <div className="col-xs-8 help-block">
            <dl>
              <dt>Never</dt>
              <dd>
                When a tab is wrangled, it will be added to the Corral. No other changes will be
                made to the Corral.
              </dd>
              <dt style={{ marginTop: '10px' }}>If URL matches exactly</dt>
              <dd>
                When a tab is wrangled, it will be added to the Corral and any older tabs with the
                exact same URL will be removed from the Corral.
              </dd>
              <dt style={{ marginTop: '10px' }}>If hostname and page title match</dt>
              <dd>
                When a tab is wrangled, it will be added to the Corral and any older tabs with the
                same hostname (like &quot;wikipedia.org&quot;) and page title will be removed from
                the Corral.
              </dd>
            </dl>
          </div>
        </div>
      </div>
    );
  }
}
