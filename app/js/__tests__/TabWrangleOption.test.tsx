import React from "react";
import ReactTestUtils from "react-dom/test-utils";
import TabWrangleOption from "../TabWrangleOption";
import renderer from "react-test-renderer";

describe("TabWrangleOption", () => {
  test("renders options with withDupes selected", () => {
    const mockCallback = jest.fn();
    const two = renderer.create(
      <TabWrangleOption onChange={mockCallback} selectedOption="withDupes" />,
    );

    expect(two).toMatchSnapshot();
  });

  test("renders options with exactURLMatch selected", () => {
    const mockCallback = jest.fn();
    const two = renderer.create(
      <TabWrangleOption onChange={mockCallback} selectedOption="exactURLMatch" />,
    );

    expect(two).toMatchSnapshot();
  });

  test("renders options with hostnameAndTitleMatch selected", () => {
    const mockCallback = jest.fn();
    const two = renderer.create(
      <TabWrangleOption onChange={mockCallback} selectedOption="hostnameAndTitleMatch" />,
    );

    expect(two).toMatchSnapshot();
  });

  test("calls onChange handler callback when clicked", () => {
    const mockCallback = jest.fn();

    // Must wrap `TabWrangleOption` in a Composite Component in order to find it using ReactTestUtils.
    class Wrapper extends React.Component {
      render() {
        return (
          <div>
            <TabWrangleOption onChange={mockCallback} selectedOption="hostnameAndTitleMatch" />
          </div>
        );
      }
    }

    const two = ReactTestUtils.renderIntoDocument(<Wrapper />);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    const buttonNode = ReactTestUtils.scryRenderedDOMComponentsWithTag(two, "input");

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore:next-line
    ReactTestUtils.Simulate.change(buttonNode[1], { target: { checked: true } });

    expect(mockCallback.mock.calls.length).toBe(1);
  });
});
