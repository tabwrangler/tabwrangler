import { fireEvent, render, screen } from "@testing-library/react";
import TabWrangleOption from "../OptionsTab/TabWrangleOption";

describe("TabWrangleOption", () => {
  test("renders options with withDupes selected", () => {
    const mockCallback = jest.fn();
    const { container } = render(
      <TabWrangleOption onChange={mockCallback} selectedOption="withDupes" />,
    );

    expect(container).toMatchSnapshot();
  });

  test("renders options with exactURLMatch selected", () => {
    const mockCallback = jest.fn();
    const { container } = render(
      <TabWrangleOption onChange={mockCallback} selectedOption="exactURLMatch" />,
    );

    expect(container).toMatchSnapshot();
  });

  test("renders options with hostnameAndTitleMatch selected", () => {
    const mockCallback = jest.fn();
    const { container } = render(
      <TabWrangleOption onChange={mockCallback} selectedOption="hostnameAndTitleMatch" />,
    );

    expect(container).toMatchSnapshot();
  });

  test("calls onChange handler callback when clicked", () => {
    const mockCallback = jest.fn();
    render(<TabWrangleOption onChange={mockCallback} selectedOption="hostnameAndTitleMatch" />);

    const radioInputs = screen.getAllByRole("radio");
    fireEvent.click(radioInputs[1]);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});
