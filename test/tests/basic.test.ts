import { describe, it, expect } from "vitest";
import React from "react";
import { TreeStream } from "react-tree-stream";

describe("TreeStream", () => {
  it("exports the component", () => {
    expect(TreeStream).toBeTypeOf("function");
  });
});
