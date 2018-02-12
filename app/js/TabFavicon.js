/* @flow */

import React from 'react';
import cx from 'classnames';

type Props = {
  className?: string,
  tab: chrome$Tab,
};

export default function TabFavicon(props: Props) {
  const {className} = props;
  const tabUrl = props.tab.url;
  return tabUrl == null ? (
    <span className={cx('favicon', className)}>-</span>
  ) : (
    <span
      className={cx('favicon', className)}
      style={{
        backgroundImage: `-webkit-image-set(url("chrome://favicon/size/16@1x/${tabUrl}") 1x, url("chrome://favicon/size/16@2x/${tabUrl}") 2x)`,
      }}
    />
  );
}
