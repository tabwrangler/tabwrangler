import * as React from "react";

type Props = {
  children: JSX.Element;
  className?: string;
  glyph?: string;
  onClick?: (event: React.MouseEvent) => void;
};

export default function Button(props: Props) {
  let glyph: React.ReactNode;
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
