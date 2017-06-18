/* @flow */

import React from 'react';

type Props = {
  children?: any,
  className?: string,
  glyph?: string,
  onClick?: () => void,
};

export default function Button(props: Props) {
  let glyph;
  if (props.glyph != null) {
    glyph = <i className={`glyphicon glyphicon-${props.glyph}`}></i>
  }

  return (
    <button className={props.className} onClick={props.onClick}>
      {glyph}{glyph === undefined ? null : ' '}{props.children}
    </button>
  );
}
