// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumberPopIn } from "./number-pop-in";

// Verifies the core mechanism: changing `value` must REMOUNT the inner
// .t-digit-group element (new DOM node), which is what replays the CSS
// pop-in animation. If the key-on-root were a no-op, the node identity
// would be preserved across re-renders.
describe("NumberPopIn remount-on-value-change", () => {
  it("replaces the .t-digit-group DOM node when value changes", () => {
    const { container, rerender } = render(<NumberPopIn value={3} />);
    const first = container.querySelector(".t-digit-group");
    expect(first).not.toBeNull();

    rerender(<NumberPopIn value={5} />);
    const second = container.querySelector(".t-digit-group");
    expect(second).not.toBeNull();

    // Different node instance => the element remounted => animation replays.
    expect(second).not.toBe(first);
  });

  it("keeps the same node when value is unchanged", () => {
    const { container, rerender } = render(<NumberPopIn value={7} />);
    const first = container.querySelector(".t-digit-group");
    rerender(<NumberPopIn value={7} />);
    const second = container.querySelector(".t-digit-group");
    expect(second).toBe(first);
  });
});
