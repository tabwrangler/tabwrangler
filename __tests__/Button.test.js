import React from 'react';
import renderer from 'react-test-renderer';
import ReactTestUtils from 'react-dom/test-utils';
import Button from '../app/js/Button';

test('render button with correct label', () => {
  const mockCallback = jest.fn();

  const button = renderer.create(
    <Button onClick={mockCallback} className='btn btn-default btn-xs'>Export</Button>
  );

  expect(button).toMatchSnapshot();
});

test('render button with correct label and glyphicon', () => {
  const mockCallback = jest.fn();

  const button = renderer.create(
    <Button glyph='export' onClick={mockCallback} className='btn btn-default btn-xs'>Export</Button>
  );

  expect(button).toMatchSnapshot();
});

test('should call click handler callback when clicked', () => {
  const mockCallback = jest.fn();

  // Must wrap `Button` in a Composite Component in order to find it using ReactTestUtils.
  class Wrapper extends React.Component {
    render() {
      return (
        <div>
          <Button onClick={mockCallback} className='btn btn-default btn-xs'>Export</Button>
        </div>
      )
    }
  }

  const button = ReactTestUtils.renderIntoDocument(
    <Wrapper />
  );

  const buttonNode = ReactTestUtils.findRenderedDOMComponentWithTag(button, 'button');
  ReactTestUtils.Simulate.click(buttonNode);

  expect(mockCallback.mock.calls.length).toBe(1);
});
