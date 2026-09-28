import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { render, cleanup, screen, fireEvent } = await import('@testing-library/react');
const { default: LessonTopics } = await import('../src/components/LessonTopics.jsx');
const topics = [{ _id: 'manual', title: 'Manual intro', startTimeSeconds: 0, endTimeSeconds: 10 }, { _id: 'accepted', title: 'Reviewed syntax', startTimeSeconds: 10, endTimeSeconds: 122.8 }];
test('student navigation displays persisted manual and accepted ranges and uses normal media seeking', () => {
  let focuses = 0;
  const media = { readyState: 1, currentTime: 0, focus: () => focuses++ };
  render(<LessonTopics topics={topics} mediaRef={{ current: media }} ready />);
  assert.ok(screen.getByRole('button', { name: /Manual intro/ }));
  fireEvent.click(screen.getByRole('button', { name: /Reviewed syntax/ }));
  assert.equal(media.currentTime, 10); assert.equal(focuses, 1);
  assert.ok(screen.getByText('00:10–02:02.8'));
  assert.equal(topics[0]._id, 'manual'); cleanup();
});
test('missing topics render nothing and unavailable media disables navigation', () => {
  const view = render(<LessonTopics mediaRef={{ current: null }} ready={false} />);
  assert.equal(screen.queryByRole('region'), null);
  view.rerender(<LessonTopics topics={topics} mediaRef={{ current: null }} ready={false} />);
  assert.ok(screen.getByRole('button', { name: /Reviewed syntax/ }).disabled); cleanup();
});
