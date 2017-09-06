/* @flow */

import React from 'react';

// type Props = {
//   children?: any,
//   className?: string,
//   glyph?: string,
//   onClick?: () => void,
// };

export default function TabWrangleOption() {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    console.log(e.target);
  }

  const checked = this.props.checked;
  return (
    <div className="row">
      <div className="col-xs-8">
        <form
          onSubmit={this.handleAddPatternSubmit}
          style={{marginBottom: '20px'}}>
          <label htmlFor="wl-add">Wrangle Tab Options:</label>
          <div className="input-group">
              onChange={this.handleChange}>
              <input type="radio" value="withDupes" name="option" checked={checked === "withDupes"}/>With Duplicates
              <input type="radio" value="exactURLMatch" name="option" checked={checked === "exactURLMatch"}/>Exact URL match
              <input type="radio" value="hostnameAndTitleMatch" name="option" checked={checked === "hostnameAndTitleMatch"}/>Hostname and Title match
          </div>
          <p className="help-block">
            <strong>Example:</strong> <i>cnn</i> would match every page on <i>cnn.com</i> and
            any URL with <i>cnn</i> anywhere in it.
          </p>
        </form>
      </div>
    </div>
  );
}
