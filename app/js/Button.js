/* @flow */

import * as React from "react";

type Props = {
  children?: any,
  className?: string,
  glyph?: string,
  onClick?: (event: SyntheticMouseEvent<HTMLButtonElement>) => void,
};

export default function Button(props: Props): React.Node {
  let glyph;
  if (props.glyph != null) {
    glyph = <i className={`fas fa-${props.glyph}`} />;
  }

  return (
    <button className={props.className} onClick={props.onClick}>
      {glyph}
      {glyph === undefined ? null : " "}
      {props.children}
    </button>
  );
}
