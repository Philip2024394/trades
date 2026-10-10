import { describe, it, expect } from "vitest";
import {
  opAddJsxAttribute,
  opModifyJsxAttribute,
  opWrapJsxElement,
  opCreateReactComponent,
  listJsxOperators,
  JSX_AUTHORING_OPERATORS_VERSION,
} from "./capability-jsx-authoring-operators";

describe("JSX authoring operators · 4 real primitives", () => {
  describe("add_jsx_attribute", () => {
    it("adds attribute to an element that lacks one", () => {
      const src = `export function A() { return <Button>Click me</Button>; }`;
      const r = opAddJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", attribute_value: `"orange"` });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`<Button color="orange">`);
    });

    it("adds attribute to self-closing element", () => {
      const src = `export function A() { return <Input placeholder="name" />; }`;
      const r = opAddJsxAttribute({ content: src, element_name: "Input", attribute_name: "required", attribute_value: `{true}` });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`required={true}`);
      expect(r.new_content).toContain(`/>`);
    });

    it("refuses when element not found", () => {
      const src = `export function A() { return <div>hi</div>; }`;
      const r = opAddJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", attribute_value: `"red"` });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("element_not_found");
    });

    it("refuses when attribute already present", () => {
      const src = `export function A() { return <Button color="blue">Click</Button>; }`;
      const r = opAddJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", attribute_value: `"red"` });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("attribute_already_present");
    });

    it("refuses on ambiguous match (default max=1)", () => {
      const src = `export function A() { return (<><Button>1</Button><Button>2</Button></>); }`;
      const r = opAddJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", attribute_value: `"blue"` });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("ambiguous_match");
    });
  });

  describe("modify_jsx_attribute", () => {
    it("changes an existing attribute value", () => {
      const src = `export function A() { return <Button color="blue">Click</Button>; }`;
      const r = opModifyJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", new_attribute_value: `"orange"` });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`color="orange"`);
      expect(r.new_content).not.toContain(`color="blue"`);
    });

    it("refuses when attribute is absent", () => {
      const src = `export function A() { return <Button>Click</Button>; }`;
      const r = opModifyJsxAttribute({ content: src, element_name: "Button", attribute_name: "color", new_attribute_value: `"orange"` });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toContain("attribute_not_found");
    });

    it("handles JSX expression values", () => {
      const src = `export function A() { return <Counter count={0} />; }`;
      const r = opModifyJsxAttribute({ content: src, element_name: "Counter", attribute_name: "count", new_attribute_value: `{42}` });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`count={42}`);
    });
  });

  describe("wrap_jsx_element", () => {
    it("wraps a self-closing element", () => {
      const src = `export function A() { return <Input placeholder="name" />; }`;
      const r = opWrapJsxElement({ content: src, inner_element_name: "Input", wrapper_element_name: "Card" });
      expect(r.ok).toBe(true);
      expect(r.new_content).toContain(`<Card><Input placeholder="name" /></Card>`);
    });

    it("supports wrapper attributes", () => {
      const src = `export function A() { return <Input />; }`;
      const r = opWrapJsxElement({
        content: src,
        inner_element_name: "Input",
        wrapper_element_name: "Card",
        wrapper_attributes: `className="wrap"`,
      });
      expect(r.new_content).toContain(`<Card className="wrap">`);
    });

    it("refuses when inner not found (self-closing form)", () => {
      const src = `export function A() { return <div>hi</div>; }`;
      const r = opWrapJsxElement({ content: src, inner_element_name: "Missing", wrapper_element_name: "Card" });
      expect(r.ok).toBe(false);
    });
  });

  describe("create_react_component", () => {
    it("creates a minimal component with no props", () => {
      const r = opCreateReactComponent({
        component_name: "Greeting",
        body_jsx: `<div>Hello</div>`,
      });
      expect(r.ok).toBe(true);
      expect(r.content).toContain(`export function Greeting()`);
      expect(r.content).toContain(`<div>Hello</div>`);
    });

    it("creates a component with typed props + Props interface", () => {
      const r = opCreateReactComponent({
        component_name: "Button",
        props: [
          { name: "label", type: "string" },
          { name: "color", type: "string", default_value: `"blue"` },
        ],
        body_jsx: `<button style={{ color }}>{label}</button>`,
      });
      expect(r.ok).toBe(true);
      expect(r.content).toContain(`export interface ButtonProps`);
      expect(r.content).toContain(`readonly label: string`);
      expect(r.content).toContain(`readonly color: string`);
      expect(r.content).toContain(`{ label, color = "blue" }: ButtonProps`);
    });

    it("refuses non-PascalCase component name", () => {
      const r = opCreateReactComponent({
        component_name: "myComponent",
        body_jsx: `<div />`,
      });
      expect(r.ok).toBe(false);
      expect(r.refusal_reason).toBe("component_name_must_be_pascal_case");
    });

    it("deterministic content hash for identical input", () => {
      const a = opCreateReactComponent({ component_name: "X", body_jsx: `<div />` });
      const b = opCreateReactComponent({ component_name: "X", body_jsx: `<div />` });
      expect(a.content_hash).toBe(b.content_hash);
    });
  });

  describe("invariants", () => {
    it("declares zero_llm=true and ledger=B on every operator result", () => {
      const src = `<Button />`;
      const r1 = opAddJsxAttribute({ content: `<A><Button /></A>`, element_name: "Button", attribute_name: "x", attribute_value: `"1"` });
      const r2 = opCreateReactComponent({ component_name: "Y", body_jsx: `<div />` });
      expect(r1.zero_llm).toBe(true);
      expect(r1.ledger).toBe("B");
      expect(r2.zero_llm).toBe(true);
      expect(r2.ledger).toBe("B");
    });

    it("listJsxOperators returns 4 operators", () => {
      const ops = listJsxOperators();
      expect(ops.length).toBe(4);
      const ids = ops.map((o) => o.operator_id);
      expect(ids).toEqual(["add_jsx_attribute", "modify_jsx_attribute", "wrap_jsx_element", "create_react_component"]);
    });

    it("canonical version", () => {
      expect(JSX_AUTHORING_OPERATORS_VERSION).toBe("jsx-authoring-operators.v1.2026-09-19");
    });
  });
});
