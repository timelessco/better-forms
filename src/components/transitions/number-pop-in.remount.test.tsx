// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumberPopIn } from "./number-pop-in";

// Core mechanism: changing `value` must REMOUNT .t-digit-group (new DOM node) to replay the CSS anim; a no-op key would keep node identity.
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
