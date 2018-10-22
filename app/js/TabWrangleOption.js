/* @flow */

import React from 'react';
import {
  Tooltip,
} from 'react-tippy';
interface Props {
  onChange: (event: SyntheticInputEvent<HTMLInputElement>) => void;
  selectedOption: string;
}

export default class TabWrangleOption extends React.Component<Props> {
  render() {
    // Declare this dynamically so it is available inside tests. It's not simple to modify globals,
    // like `chrome`, using Jest. Is there a better way to do this? Probably.
    const OPTIONS = [
      { name: 'withDupes', text: chrome.i18n.getMessage('options_dedupe_option_withDupes') },
      {
        name: 'exactURLMatch',
        text: chrome.i18n.getMessage('options_dedupe_option_exactURLMatch'),
      },
      {
        name: 'hostnameAndTitleMatch',
        text: chrome.i18n.getMessage('options_dedupe_option_hostnameAndTitleMatch'),
      },
    ];

    return (
      <React.Fragment>
        <label htmlFor="wrangleOption"><b>{chrome.i18n.getMessage('options_dedupe_label')}</b></label>
        {OPTIONS.map(option => (
          <div className="form-check" key={option.name}>
            <input
              checked={this.props.selectedOption === option.name}
              className="form-check-input"
              id={option.name}
              name="wrangleOption"
              onChange={this.props.onChange}
              type="radio"
              value={option.name}
            />
            
            <label className="form-check-label" htmlFor={option.name}>
              {option.text} {" "}
              <Tooltip
            html={(
            <div>
              <b>{chrome.i18n.getMessage(`options_dedupe_option_${option.name}_label`)}</b>
            <p>{chrome.i18n.getMessage(`options_dedupe_option_${option.name}_description`)}</p>
            </div>
            )}
            position="top"
            arrow="true"
            trigger="mouseenter"
            inertia="true"
            size="small"
            > <i className="fas fa-question-circle" /></Tooltip>
            </label>
            
          </div>
        ))}
        {/* <div className="row">
          <div className="col-8 help-block" style={{ marginBottom: 0 }}>
            <dl style={{ marginBottom: 0 }}>
              <dt>{chrome.i18n.getMessage('options_dedupe_option_withDupes_label')}</dt>
              <dd>{chrome.i18n.getMessage('options_dedupe_option_withDupes_description')}</dd>
              <dt style={{ marginTop: '10px' }}>
                {chrome.i18n.getMessage('options_dedupe_option_exactURLMatch_label')}
              </dt>
              <dd>{chrome.i18n.getMessage('options_dedupe_option_exactURLMatch_description')}</dd>
              <dt style={{ marginTop: '10px' }}>
                {chrome.i18n.getMessage('options_dedupe_option_hostnameAndTitleMatch_label')}
              </dt>
              <dd>
                {chrome.i18n.getMessage('options_dedupe_option_hostnameAndTitleMatch_description')}
              </dd>
            </dl>
          </div>
        </div> */}
      </React.Fragment>
    );
  }
}
