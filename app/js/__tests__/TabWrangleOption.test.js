import React from "react";
import ReactTestUtils from "react-dom/test-utils";
import TabWrangleOption from "../TabWrangleOption";
import renderer from "react-test-renderer";

const chrome = {
  i18n: {
    getMessage: () => "",
  },
};

test("should render options with withDupes selected", () => {
  global.chrome = chrome;
  const mockCallback = jest.fn();

  const two = renderer.create(
    <TabWrangleOption onChange={mockCallback} selectedOption="withDupes" />
  );

  expect(two).toMatchSnapshot();
});

test("should render options with exactURLMatch selected", () => {
  global.chrome = chrome;
  const mockCallback = jest.fn();

  const two = renderer.create(
    <TabWrangleOption onChange={mockCallback} selectedOption="exactURLMatch" />
  );

  expect(two).toMatchSnapshot();
});

test("should render options with hostnameAndTitleMatch selected", () => {
  global.chrome = chrome;
  const mockCallback = jest.fn();

  const two = renderer.create(
    <TabWrangleOption onChange={mockCallback} selectedOption="hostnameAndTitleMatch" />
  );

  expect(two).toMatchSnapshot();
});

test("should call onChange handler callback when clicked", () => {
  global.chrome = chrome;
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

  const buttonNode = ReactTestUtils.scryRenderedDOMComponentsWithTag(two, "input");
  ReactTestUtils.Simulate.change(buttonNode[1], { target: { checked: true } });

  expect(mockCallback.mock.calls.length).toBe(1);
});
