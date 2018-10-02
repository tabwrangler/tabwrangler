/* @flow */

import './CoralTabRow.css';
import LazyImage from './LazyImage';
import React from 'react';
import TimeAgo from 'timeago-react';
import cx from 'classnames';
import extractHostname from './extractHostname';
import timeago from 'timeago.js';
import timeagoLocale from './timeagoLocale';

const uiLanguage = chrome.i18n.getUILanguage();
timeago.register(uiLanguage, timeagoLocale[uiLanguage]);

type Props = {
  isSelected: boolean,
  onOpenTab: (tab: chrome$Tab, session: ?chrome$Session) => void,
  onRemoveTab: (tab: chrome$Tab) => void,
  onToggleTab: (tab: chrome$Tab, selected: boolean, multiselect: boolean) => void,
  session: ?chrome$Session,
  tab: chrome$Tab,
  style: Object,
};

type State = {
  hovered: boolean,
};

export default class ClosedTabRow extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hovered: false,
    };
  }

  _handleClickAnchor = (event: SyntheticMouseEvent<HTMLElement>) => {
    const { tab } = this.props;
    event.preventDefault();
    this.props.onOpenTab(tab, this.props.session);
  };

  _handleClickCheckbox = (event: SyntheticMouseEvent<HTMLInputElement>) => {
    // Dynamic type check to ensure target is an input element.
    if (!(event.target instanceof HTMLInputElement)) return;

    this.props.onToggleTab(this.props.tab, event.target.checked, event.shiftKey);
  };

  _handleClickRemove = () => {
    this.props.onRemoveTab(this.props.tab);
  };

  _handleClickTd = (event: SyntheticMouseEvent<HTMLElement>) => {
    if (event.currentTarget.nodeName === 'input') return;
    this.props.onToggleTab(this.props.tab, !this.props.isSelected, event.shiftKey);
  };

  _handleMouseOut = () => {
    this.setState({ hovered: false });
  };

  _handleMouseOver = () => {
    this.setState({ hovered: true });
  };

  render() {
    const { isSelected, session, style, tab } = this.props;

    return (
      <div
        aria-label="row"
        className={cx('ReactVirtualized__Table__row', { 'item-selected': isSelected })}
        role="row"
        style={style}>
        <div
          className="ReactVirtualized__Table__rowColumn"
          onClick={this._handleClickTd}
          style={{ verticalAlign: 'middle' }}>
          <input
            checked={isSelected}
            className="checkbox--td"
            onClick={this._handleClickCheckbox}
            type="checkbox"
          />
        </div>
        <div
          className="faviconCol ReactVirtualized__Table__rowColumn"
          style={{ verticalAlign: 'middle' }}>
          <LazyImage
            alt=""
            className="faviconCol--hover-hidden favicon"
            height={16}
            src={tab.favIconUrl}
            width={16}
          />
          <span
            className="faviconCol--hover-shown"
            onClick={this._handleClickRemove}
            role="button"
            style={{ cursor: 'pointer', height: 16, width: 16 }}
            tabIndex={0}
            title="Remove this tab">
            <i className="far fa-trash-alt"/>
          </span>
        </div>
        <div className="ReactVirtualized__Table__rowColumn py-1" style={{ flex: 1 }}>
          <div style={{ display: 'flex' }}>
            <div className="CorralTabRow-content">
              <a
                href={tab.url}
                onClick={this._handleClickAnchor}
                rel="noopener noreferrer"
                style={{ flex: 1 }}
                target="_blank"
                title={tab.url}>
                {tab.title}
              </a>
              <br />
              <small className="text-muted">
                ({tab.url == null ? '???' : extractHostname(tab.url)})
              </small>
            </div>
          </div>
        </div>
        <div
          className="ReactVirtualized__Table__rowColumn text-right"
          style={{ verticalAlign: 'middle' }}
          title={
            /* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */
            new Date(tab.closedAt).toLocaleString()
          }>
          {/* $FlowFixMe: `closedAt` is an expando property added by Tab Wrangler to chrome$Tab */}
          <TimeAgo datetime={tab.closedAt} locale={uiLanguage} />
        </div>
        <div className="ReactVirtualized__Table__rowColumn" style={{ width: '11px' }}>
          {session == null ? null : (
            <abbr title={chrome.i18n.getMessage('corral_tabSessionFresh')}>
              <i className="fas fa-leaf text-success" />
            </abbr>
          )}
        </div>
      </div>
    );
  }
}
