import React from 'react';
import renderer from 'react-test-renderer';
import ReactTestUtils from 'react-dom/test-utils';
import Button from '../app/js/Button';

test('render button with correct label', () => {
  const mockCallback = jest.fn();

  const button = renderer.create(
    <Button label='Export' clickHandler={mockCallback} className='glyphicon-export'/>
  );

  expect(button).toMatchSnapshot();
});

test('should call click handler callback when clicked', () => {
  const mockCallback = jest.fn();

  const button = ReactTestUtils.renderIntoDocument(
    <Button label='Export' clickHandler={mockCallback} className='glyphicon-export'/>
  );
  const buttonNode = ReactTestUtils.findRenderedDOMComponentWithTag(button, 'button');
  ReactTestUtils.Simulate.click(buttonNode);

  expect(mockCallback.mock.calls.length).toBe(1);
});