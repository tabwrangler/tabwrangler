/* @flow */

import LazyImage from './LazyImage';
import React from 'react';
import TimeAgo from 'timeago-react';
import extractHostname from './extractHostname';
import timeago from 'timeago.js';
import timeagoLocale from './timeagoLocale';

const uiLanguage = chrome.i18n.getUILanguage();
timeago.register(uiLanguage, timeagoLocale[uiLanguage]);

interface Props {
  isSelected: boolean,
  onOpenTab: (tab: chrome$Tab) => void,
  onRemoveTab: (tab: chrome$Tab) => void,
  onToggleTab: (tab: chrome$Tab, selected: boolean, multiselect: boolean) => void,
  shouldCheckLazyImages: boolean,
  tab: chrome$Tab,
}

interface State {
  hovered: boolean,
}

export default class ClosedTabRow extends React.PureComponent<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {
      hovered: false,
    };
  }

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

  _handleClickRemove = () => {
    this.props.onRemoveTab(this.props.tab);
  };

  _handleClickTd = (event: SyntheticMouseEvent<HTMLElement>) => {
    if (event.target.nodeName === 'input' || this.props.tab.id == null) return;
    this.props.onToggleTab(this.props.tab, !this.props.isSelected, event.shiftKey);
  };

  _handleMouseOut = () => {
    this.setState({hovered: false});
  };

  _handleMouseOver = () => {
    this.setState({hovered: true});
  };

  render() {
    const {isSelected, shouldCheckLazyImages, tab} = this.props;

    return (
      <tr className={isSelected ? 'bg-warning' : null}>
        <td onClick={this._handleClickTd} style={{verticalAlign: 'middle', width: '1px'}}>
          <input
            checked={isSelected}
            className="checkbox--td"
            onClick={this._handleClickCheckbox}
            type="checkbox"
          />
        </td>
        <td className="faviconCol" style={{verticalAlign: 'middle'}}>
          {tab.favIconUrl == null
            ? (
              <span
                className="faviconCol--hover-hidden"
                style={{display: 'inline-block', height: '16px'}}>
                -
              </span>
            ) : (
              <LazyImage
                alt=""
                className="faviconCol--hover-hidden favicon"
                height={16}
                src={tab.favIconUrl}
                shouldCheck={shouldCheckLazyImages}
                width={16}
              />
            )
          }
          <span
            className="faviconCol--hover-shown glyphicon glyphicon-trash"
            onClick={this._handleClickRemove}
            style={{cursor: 'pointer'}}
            title="Remove this tab"
          />
        </td>
        <td style={{paddingBottom: '4px', paddingTop: '4px', width: '75%'}}>
          <div style={{display: 'flex'}}>
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '1px',
              }}>
              <a
                href={tab.url}
                onClick={this._handleClickAnchor}
                rel="noopener noreferrer"
                style={{flex: 1}}
                target="_blank">
                {tab.title}
              </a>
              <br />
              <small className="text-muted">
                ({tab.url == null ? '???' : extractHostname(tab.url)})
              </small>
            </div>
          </div>
        </td>
        <td
          className="text-right"
          style={{verticalAlign: 'middle'}}
          title={
            /* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */
            new Date(tab.closedAt).toLocaleString()
          }>
          {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
          <TimeAgo datetime={tab.closedAt} locale={uiLanguage} />
        </td>
      </tr>
    );
  }

}
