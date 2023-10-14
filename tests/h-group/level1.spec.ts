import { describe, expect, it } from "vitest";
import {
	setState,
	clue,
	draw,
	cards,
	action,
	expectAction,
	debugAction,
} from "../helpers";

describe("hgroup level 1", () => {
	describe("1 - Play Clues", () => {
		// https://hanabi.github.io/docs/beginner/play-clues
		it("Play Clues", () => {
			let ai = setState({
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
				],
			});
			// Alice clues red to Bob touching slot 2
			clue(ai, "Alice", "Bob", "R", [2]);
			expect(cards(ai, "Bob", 2)).toEqual(["R1"]);

			ai = setState({
				piles: ["R2", "G1", "P3"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
				],
			});
			// Alice clues 1 to Bob touching slot 3
			clue(ai, "Alice", "Bob", 1, [3]);
			expect(cards(ai, "Bob", 3)).toEqual(["Y1", "B1"].sort());
		});

		// https://hanabi.github.io/docs/beginner/play-clues-question-1
		it("Play Clues (Question 1)", () => {
			let ai = setState({
				piles: ["R5", "Y3", "G2", "B1", "P2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
				],
			});
			// Alice clues blue to Bob
			clue(ai, "Alice", "Bob", "B", [3]);
			expect(cards(ai, "Bob", 3)).toEqual(["B2"]);
		});

		// https://hanabi.github.io/docs/beginner/play-clues-question-2
		it("Play Clues (Question 2)", () => {
			let ai = setState({
				piles: ["R3", "Y4", "G3", "B3", "P2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
				],
			});
			// Alice clues 4 to Bob
			clue(ai, "Alice", "Bob", 4, [4]);
			expect(cards(ai, "Bob", 4)).toEqual(["R4", "G4", "B4"].sort());
		});

		// https://hanabi.github.io/docs/beginner/delayed-play-clues
		it("Delayed Play Clues", () => {
			let ai = setState({
				piles: ["R1"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["??", "Y1", "G1", "B1", "??"],
				],
			});
			// 1's are already clued
			clue(ai, "Alice", "Cathy", 1, [2, 3, 4]);
			// Alice clues 2 in Bob's hand.
			clue(ai, "Alice", "Bob", 2, [3]);
			// Bob must consider this may be a delayed play.
			expect(cards(ai, "Bob", 3)).toEqual(["R2", "Y2", "G2", "B2"].sort());
			// Should we assert that Bob discards?
		});

		// https://hanabi.github.io/docs/beginner/delayed-play-clues-question-1
		it("Delayed Play Clues (Question 1)", () => {
			let ai = setState({
				piles: ["R1", "Y4", "G4", "B2", "P3"],
				hands: [
					["??", "??", "??", "??"],
					["??", "??", "??", "??"],
					["??", "??", "??", "??"],
					["??", "R2", "??", "??"],
				],
			});
			// Red in Donald's hand is already clued.
			clue(ai, "Alice", "Donald", "R", [1]);
			clue(ai, "Bob", "Cathy", "R", [3]);
			expect(cards(ai, "Cathy", 3)).toEqual(["R3"]);
		});

		// https://hanabi.github.io/docs/beginner/delayed-play-clues-question-2
		it("Delayed Play Clues (Question 2)", () => {
			let ai = setState({
				piles: ["Y1", "B2", "P2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["??", "??", "R1", "G1", "??"],
				],
			});
			// Previously, Cathy was clued about some 1's, and will go on to play both of them.
			clue(ai, "Alice", "Cathy", 1, [3, 4]);

			// Alice clues number 3 to Bob, which touches one card on slot 1.
			clue(ai, "Alice", "Bob", 3, [1]);
			expect(cards(ai, "Bob", 1)).toEqual(["B3", "P3"].sort());
		});

		// https://hanabi.github.io/docs/beginner/delayed-play-clues-question-3
		it("Delayed Play Clues (Question 3)", () => {
			let ai = setState({
				piles: ["R3", "Y1", "B2", "P3"],
				hands: [
					["??", "??", "??", "??"],
					["??", "??", "??", "??"],
					["R1", "Y2*", "Y3*", "G5*"],
					["P5", "G2", "P1", "B3*"],
				],
			});
			// Alice clues 4 to Bob.
			clue(ai, "Alice", "Bob", 4, [1]);
			expect(cards(ai, "Bob", 1)).toEqual(["R4", "Y4", "B4", "P4"].sort());
		});
	});

	describe("2 - Save clues", () => {
		// https://hanabi.github.io/docs/beginner/5-save
		it("The 5 Save", () => {
			let ai = setState({
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "R5"],
				],
			});
			expect(action(ai, "Alice")).toEqual("Clue Bob 5");
		});

		// https://hanabi.github.io/docs/beginner/5-save-question-1
		it("The 5 Save (Question 1)", () => {
			let ai = setState({
				piles: ["R1", "Y2", "B1", "P1"],
				hands: [
					["??", "??", "??", "??"],
					["P4", "G4", "Y5", "Y1"],
					["Y4", "G4", "G3*", "G2*"],
					["P5", "B5", "P3", "P3"],
				],
			});

			expect(action(ai, "Alice")).toEqual("Discard #4");
		});

		// https://hanabi.github.io/docs/beginner/5-save-question-2
		it("The 5 Save (Question 2)", () => {
			let ai = setState({
				piles: ["R1", "B3", "G2"],
				hands: [
					["??", "??", "??", "??"],
					["R1", "P5", "G5", "Y2"],
					["R4", "Y5", "B5*", "Y2*"],
					["P4", "B1", "R5", "P3"],
				],
			});

			expect(action(ai, "Alice")).toEqual("Clue Cathy 5");
		});

		// https://hanabi.github.io/docs/beginner/2-save
		it("The 2 Save", () => {
			let ai = setState({
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "B2"],
				],
			});

			expect(action(ai, "Alice")).toEqual("Clue Bob 2");
		});

		// https://hanabi.github.io/docs/beginner/2-save-question-1
		it("The 2 Save (Question 1)", () => {
			let ai = setState({
				piles: ["R3", "B1", "P2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["Y5", "Y1*", "R3", "R2", "B2"],
				],
			});
			clue(ai, "Alice", "Bob", 2, [4]);
			expect(cards(ai, "Bob", 4)).toEqual(["B2", "Y2"].sort());
		});

		// https://hanabi.github.io/docs/beginner/2-save-question-2
		it("The 2 Save (Question 2)", () => {
			let ai = setState({
				piles: ["Y1", "G2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["G5", "B3", "G4", "P3", "P3"],
				],
			});
			// Previously in the game, Bob was given a Play Clue on a 1. He had planned on playing it on his next turn.
			clue(ai, "Alice", "Bob", 1, [1]);
			// Now, Alice clues number 2 to Bob, touching his slot 5.
			clue(ai, "Alice", "Bob", 2, [5]);

			// Bob already has a card note of "red 1, a blue 1, purple 1" on his 1 (because these are the 1's left to play on the stacks).
			expect(cards(ai, "Bob", 1)).toEqual(["R1", "B1", "P1"].sort());
			// Bob does not know whether or not this is a Play Clue or a Save Clue, but he has to treat it as a Save Clue for the time being until he gets more information.
			expect(cards(ai, "Bob", 5)).toEqual(["R2", "Y2", "B2", "P2"].sort());
		});

		// https://hanabi.github.io/docs/beginner/2-save-question-3
		it("The 2 Save (Question 3)", () => {
			let ai = setState({
				piles: ["B2", "P1"],
				hands: [
					["??", "??", "??", "?5*", "?5*"],
					["R4", "P3", "Y2", "R2", "G2"],
					["Y5", "G2", "G1", "G1", "Y2"],
				],
			});

			// Not allowed to save either 2 because the matching 2 is visible.
			//expectAction(ai, "Alice", "Discard #3");
			expect(action(ai, "Alice")).toEqual("Discard #3");
		});

		// https://hanabi.github.io/docs/beginner/critical-save
		it("The Critical Save", () => {
			let ai = setState({
				piles: ["R1", "Y1", "B1"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "?5*"],
				],
				discard: ["B4"],
			});
			clue(ai, "Alice", "Bob", "B", [4]);
			expect(cards(ai, "Bob", 4)).toEqual(["B2", "B4"].sort());
			expect(action(ai, "Bob")).toEqual("Discard #3");
		});

		// https://hanabi.github.io/docs/beginner/critical-save-question-1
		it("The Critical Save (Question 1)", () => {
			let ai = setState({
				piles: ["R1", "Y2", "P3"],
				discard: ["G3"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "?4*", "?4*"],
					["P4", "R2*", "Y1", "Y2", "Y4"],
				],
			});
			// Alice clues number 3 to Bob, touching a card on slot 3.
			clue(ai, "Alice", "Bob", 3, [3]);
			expect(cards(ai, "Bob", 3)).toEqual(["Y3", "R3", "G3"].sort());
		});

		// https://hanabi.github.io/docs/beginner/critical-save-question-2
		it("The Critical Save (Question 2)", () => {
			let ai = setState({
				piles: ["R4", "G1", "B2"],
				discard: ["P3", "P4"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["R1", "R1", "P4", "P3", "P5"],
				],
			});
			expect(action(ai, "Alice")).toEqual("Clue Cathy 5");
			clue(ai, "Alice", "Cathy", 5, [5]);
			expect(action(ai, "Bob")).toEqual("Clue Cathy P");
		});

		// https://hanabi.github.io/docs/beginner/critical-save-question-3
		it("The Critical Save (Question 3)", () => {
			let ai = setState({
				piles: ["R2", "G1", "B4", "P3"],
				discard: ["Y3", "Y4"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "?3*"],
					["G3", "G4", "Y3", "G1", "P1"],
				],
			});
			// Alice clues yellow to Bob, touching a card on slot 4.
			clue(ai, "Alice", "Bob", "Y", [4]);
			expect(cards(ai, "Bob", 4)).toEqual(["Y1", "Y4"].sort());
		});

		// https://hanabi.github.io/docs/beginner/critical-save-question-4
		it("The Critical Save (Question 4)", () => {
			let ai = setState({
				piles: ["Y2", "G2", "B2", "P2"],
				discard: ["R2"],
				hands: [
					["??", "??", "??", "??", "??"],
					["??", "??", "??", "??", "??"],
					["P1", "G1", "B2", "B1", "G2"],
				],
			});
			// Alice clues red to Bob, touching a card on slot 5.
			clue(ai, "Alice", "Bob", "R", [5]);
			expect(cards(ai, "Bob", 5)).toEqual(["R1", "R2"].sort());
		});
	});
});
