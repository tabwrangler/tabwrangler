export type AnimationDirection = "collapse" | "expand";

export interface FadeInHandle {
  fadeIn: () => void;
}

export interface TabRowHandle extends FadeInHandle {
  animateHeight: (direction: AnimationDirection) => Promise<void>;
  rotateChevron: (direction: AnimationDirection) => void;
}

const ANIMATION_OPTIONS: KeyframeAnimationOptions = { duration: 200, easing: "ease-in-out" };

// Collapsing holds the end state until the rows unmount; expanding plays the same keyframes in
// reverse so both measure from the row's natural layout.
function directionOptions(direction: AnimationDirection): KeyframeAnimationOptions {
  return {
    ...ANIMATION_OPTIONS,
    direction: direction === "collapse" ? "normal" : "reverse",
    fill: direction === "collapse" ? "forwards" : "none",
  };
}

// Table rows can't animate their own height, so this shrinks each cell's padding and border and
// the height of its content instead.
export async function animateRowHeight(
  cells: Array<HTMLElement | null>,
  contents: Array<HTMLElement | null>,
  direction: AnimationDirection,
) {
  const options = directionOptions(direction);
  const animations = [
    ...cells.flatMap((cell) => {
      if (cell == null) return [];
      const { borderBottomWidth, paddingBottom, paddingTop } = getComputedStyle(cell);
      return cell.animate(
        [
          { borderBottomWidth, paddingBottom, paddingTop },
          { borderBottomWidth: "0px", paddingBottom: "0px", paddingTop: "0px" },
        ],
        options,
      );
    }),
    ...contents.flatMap((el) =>
      el == null
        ? []
        : el.animate(
            [
              { height: `${el.offsetHeight}px`, opacity: 1, overflow: "hidden" },
              { height: "0px", opacity: 0, overflow: "hidden" },
            ],
            options,
          ),
    ),
  ];
  await Promise.all(animations.map((animation) => animation.finished));
}

export function rotateChevron(chevron: HTMLElement | null, direction: AnimationDirection) {
  chevron?.animate(
    [{ transform: "none" }, { transform: "rotate(-90deg)" }],
    directionOptions(direction),
  );
}

// Fade content rather than whole table cells, otherwise the row's hover background fades too.
export function fadeIn(elements: Array<HTMLElement | null>) {
  elements.forEach((el) =>
    el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "ease-out" }),
  );
}
