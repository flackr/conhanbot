import { describe, expect, it } from "vitest";
import { setState, clue, draw, cards } from "../helpers";

// https://hanabi.github.io/docs/beginner/play-clues
describe("hgroup level 1", () => {
  it("Marks direct play clues correclty", () => {
    let ai = setState({
      hands: [
        ["??", "??", "??", "??", "??"],
        ["??", "??", "??", "??", "??"],
      ]
    });
    // Alice clues red to Bob
    clue(ai, 0, 1, "R", [1]);
    expect(cards(ai, 1, 1)).toEqual(["R1"]);

    ai = setState({
      piles: ["R5", "Y3", "G2", "B1", "P2"],
      hands: [
        ["??", "??", "??", "??", "??"],
        ["??", "??", "??", "??", "??"],
      ]
    });
    // Alice clues blue to Bob
    clue(ai, 0, 1, "B", [2]);
    expect(cards(ai, 1, 2)).toEqual(["B2"]);  

    ai = setState({
      piles: ["R3", "Y4", "G3", "B3", "P2"],
      hands: [
        ["??", "??", "??", "??", "??"],
        ["??", "??", "??", "??", "??"],
      ]
    });
    // Alice clues 4 to Bob
    clue(ai, 0, 1, 4, [3]);
    expect(cards(ai, 1, 3)).toEqual(["R4", "G4", "B4"].sort());  
  });

  it("Marks delayed play clues correctly", () => {
    let ai = setState({
      piles: ["R1"],
      hands: [
        ["??", "??", "??", "??", "??"],
        ["??", "??", "??", "??", "??"],
        ["??", "Y1", "G1", "B1", "??"],
      ]
    });
    // 1's are already clued
    clue(ai, 0, 2, 1, [1, 2, 3]);
    // Alice clues 2 in Bob's hand.
    clue(ai, 0, 1, 2, [2]);
    // Bob must consider this may be a delayed play.
    expect(cards(ai, 1, 2)).toEqual(["R2", "Y2", "G2", "B2"].sort());
    // Should we assert that Bob discards?

    ai = setState({
      piles: ["R1", "Y4", "G4", "B2", "P3"],
      hands: [
        ["??", "??", "??", "??"],
        ["??", "??", "??", "??"],
        ["??", "??", "??", "??"],
        ["??", "R2", "??", "??"],
      ]
    });
    // Red in Donald's hand is already clued.
    clue(ai, 0, 3, "R", [1]);
    clue(ai, 1, 2, "R", [2]);
    expect(cards(ai, 2, 2)).toEqual(["R3"]);

    ai = setState({
      piles: ["R3", "Y1", "B2", "P3"],
      hands: [
        ["??", "??", "??", "??"],
        ["??", "??", "??", "??"],
        ["R1", "Y2", "Y3", "G5"],
        ["P5", "G2", "P1", "B3"],
      ]
    });
    // Known clued cards
    clue(ai, 0, 2, "Y", [1, 2]);
    clue(ai, 0, 2, 5, [3]);
    clue(ai, 0, 3, "B", [3]);

    // Alice clues 4 to Bob.
    clue(ai, 0, 1, 4, [0]);
    expect(cards(ai, 1, 0)).toEqual(["R4", "Y4", "B4", "P4"].sort());
  });


});
