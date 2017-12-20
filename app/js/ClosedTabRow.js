/* @flow */

import LazyImage from './LazyImage';
import React from 'react';
import TimeAgo from 'timeago-react';
import timeago from 'timeago.js';
import timeagoLocale from './timeagoLocale';
import truncateString from './truncateString';

const uiLanguage = chrome.i18n.getUILanguage();
timeago.register(uiLanguage, timeagoLocale[uiLanguage]);

interface Props {
  isSelected: boolean;
  onOpenTab: (tab: chrome$Tab) => void;
  onToggleTab: (tab: chrome$Tab, selected: boolean, multiselect: boolean) => void;
  shouldCheckLazyImages: boolean;
  tab: chrome$Tab;
}

export default class ClosedTabRow extends React.PureComponent<Props> {

  _handleClickAnchor = (event: SyntheticMouseEvent<HTMLElement>) => {
    const {tab} = this.props;
    event.preventDefault();
    this.props.onOpenTab(tab);
  };

  _handleClickCheckbox = (event: SyntheticMouseEvent<HTMLInputElement>) => {
    // TODO: Handle tabs with no IDs in a predicatble way.
    if (this.props.tab.id == null) return;

    // Dynamic type check to ensure target is an input element.
    if (!(event.target instanceof HTMLInputElement)) return;

    this.props.onToggleTab(this.props.tab, event.target.checked, event.shiftKey);
  };

  _handleClickTd = (event: SyntheticMouseEvent<HTMLElement>) => {
    if (event.target.nodeName === 'input' || this.props.tab.id == null) return;
    this.props.onToggleTab(this.props.tab, !this.props.isSelected, event.shiftKey);
  };

  render() {
    const {isSelected, shouldCheckLazyImages, tab} = this.props;

    return (
      <tr className={isSelected ? 'bg-warning' : null}>
        <td onClick={this._handleClickTd} style={{width: '1px'}}>
          <input
            checked={isSelected}
            className="checkbox--td"
            onClick={this._handleClickCheckbox}
            type="checkbox"
          />
        </td>
        <td className="faviconCol">
          {tab.favIconUrl == null
            ? <span style={{display: 'inline-block', height: '16px'}}>-</span>
            : (
              <LazyImage
                alt=""
                className="favicon"
                height={16}
                src={tab.favIconUrl}
                shouldCheck={shouldCheckLazyImages}
                width={16}
              />
            )
          }
        </td>
        <td>
          <a
            href={tab.url}
            onClick={this._handleClickAnchor}
            rel="noopener noreferrer"
            target="_blank">
            {truncateString(tab.title, 70)}
          </a>
        </td>
        {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
        <td title={new Date(tab.closedAt).toLocaleString()}>
          {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
          <TimeAgo datetime={tab.closedAt} locale={uiLanguage} />
        </td>
      </tr>
    );
  }

}
