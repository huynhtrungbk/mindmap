/**
 * Round-trip unit tests for DIF converters.
 * Run with: node --import tsx scripts/test-converters.ts
 * Or: npx tsx scripts/test-converters.ts
 */

import { mindmapToDif, difToMindmapNodes } from "../lib/converters/dif";
import type { DifNode } from "../lib/converters/dif";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  ✅ ${msg}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${msg}`);
        failed++;
    }
}

function test(name: string, fn: () => void) {
    console.log(`\n🧪 ${name}`);
    fn();
}

// ─── Test 1: DIF round-trip ────────────────────────

test("mindmapToDif → difToMindmapNodes round-trip", () => {
    const mockNodes = [
        { id: "1", parentId: null, sortIndex: 0, title: "Root", noteDoc: null, notePlain: "" },
        { id: "2", parentId: "1", sortIndex: 0, title: "Child A", noteDoc: null, notePlain: "Note A" },
        { id: "3", parentId: "1", sortIndex: 1, title: "Child B", noteDoc: null, notePlain: "" },
        { id: "4", parentId: "2", sortIndex: 0, title: "Grandchild", noteDoc: null, notePlain: "Deep note" },
    ];

    const dif = mindmapToDif(mockNodes);
    assert(dif.length === 1, "Single root node");
    assert(dif[0].title === "Root", "Root title preserved");
    assert(dif[0].children.length === 2, "2 children");
    assert(dif[0].children[0].title === "Child A", "Child A title preserved");
    assert(dif[0].children[0].note.plain === "Note A", "Child A note preserved");
    assert(dif[0].children[0].children.length === 1, "Grandchild exists");
    assert(dif[0].children[0].children[0].title === "Grandchild", "Grandchild title");
    assert(dif[0].children[0].children[0].note.plain === "Deep note", "Grandchild note");

    // Round-trip back to flat nodes
    const flatNodes = difToMindmapNodes(dif);
    assert(flatNodes.length === 4, "4 nodes reconstructed");

    const titles = flatNodes.map((n) => n.title).sort();
    assert(titles.includes("Root"), "Root exists in result");
    assert(titles.includes("Child A"), "Child A exists in result");
    assert(titles.includes("Child B"), "Child B exists in result");
    assert(titles.includes("Grandchild"), "Grandchild exists in result");
});

// ─── Test 2: Empty input ─────────────────────────

test("Empty input handling", () => {
    const dif = mindmapToDif([]);
    assert(dif.length === 0, "Empty input → empty DIF");

    const flat = difToMindmapNodes([]);
    assert(flat.length === 0, "Empty DIF → empty flat nodes");
});

// ─── Test 3: Multiple roots ──────────────────────

test("Multiple root nodes", () => {
    const mockNodes = [
        { id: "a", parentId: null, sortIndex: 0, title: "Root 1", noteDoc: null, notePlain: "" },
        { id: "b", parentId: null, sortIndex: 1, title: "Root 2", noteDoc: null, notePlain: "" },
        { id: "c", parentId: "a", sortIndex: 0, title: "Child of R1", noteDoc: null, notePlain: "" },
    ];

    const dif = mindmapToDif(mockNodes);
    assert(dif.length === 2, "2 root nodes");
    assert(dif[0].title === "Root 1", "First root");
    assert(dif[1].title === "Root 2", "Second root");
    assert(dif[0].children.length === 1, "Root 1 has 1 child");
});

// ─── Test 4: Sort order preservation ─────────────

test("Sort order preserved", () => {
    const mockNodes = [
        { id: "1", parentId: null, sortIndex: 0, title: "Root", noteDoc: null, notePlain: "" },
        { id: "3", parentId: "1", sortIndex: 2, title: "Third", noteDoc: null, notePlain: "" },
        { id: "2", parentId: "1", sortIndex: 0, title: "First", noteDoc: null, notePlain: "" },
        { id: "4", parentId: "1", sortIndex: 1, title: "Second", noteDoc: null, notePlain: "" },
    ];

    const dif = mindmapToDif(mockNodes);
    assert(dif[0].children[0].title === "First", "Sort index 0 = First");
    assert(dif[0].children[1].title === "Second", "Sort index 1 = Second");
    assert(dif[0].children[2].title === "Third", "Sort index 2 = Third");
});

// ─── Test 5: Position calculation ────────────────

test("Position calculation in difToMindmapNodes", () => {
    const dif: DifNode[] = [
        {
            title: "Root",
            note: { doc: null, plain: "", html: "" },
            children: [
                { title: "A", note: { doc: null, plain: "", html: "" }, children: [] },
                { title: "B", note: { doc: null, plain: "", html: "" }, children: [] },
            ],
        },
    ];

    const flat = difToMindmapNodes(dif);
    assert(flat.length === 3, "3 nodes total");

    const root = flat.find((n) => n.title === "Root");
    const a = flat.find((n) => n.title === "A");
    const b = flat.find((n) => n.title === "B");

    assert(root !== undefined, "Root found");
    assert(a !== undefined, "A found");
    assert(b !== undefined, "B found");
    assert(root!.positionX === 0, "Root at depth 0");
    assert(a!.positionX === 280, "A at depth 1 (280px)");
    assert(a!.parentId === root!.id, "A parent is Root");
});

// ─── Summary ─────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("✅ All tests passed!\n");
