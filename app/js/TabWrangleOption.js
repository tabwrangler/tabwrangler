/* @flow */

import React from 'react';

// type Props = {
//   children?: any,
//   className?: string,
//   glyph?: string,
//   onClick?: () => void,
// };

export default function TabWrangleOption() {
  return (
    <div className="row">
      <div className="col-xs-8">
        <form
          onSubmit={this.handleAddPatternSubmit}
          style={{marginBottom: '20px'}}>
          <label htmlFor="wl-add">Auto-lock tabs with URLs containing:</label>
          <div className="input-group">
            <input
              className="form-control"
              id="wl-add"
              onChange={this.handleNewPatternChange}
              type="text"
              value={this.state.newPattern}
            />
            {/* <span className="input-group-btn">
              <button
                className="btn btn-default"
                disabled={!isValidPattern(this.state.newPattern)}
                id="addToWL"
                type="submit">
                Add
              </button>
            </span> */}
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
