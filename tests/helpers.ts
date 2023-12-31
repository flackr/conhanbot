import { expect } from "vitest";
import { AI, PlayerActionType } from "../src/ai";

export function setState(state: {
	ai?: AI;
	piles?: string[];
	discard?: string[];
	hands: string[][];
}): AI {
	const piles = state.piles || [];
	const discard = state.discard || [];
	const hands = state.hands;
	let ai = state.ai || new AI({ players: hands.length });
	for (let i = 0; i < piles.length; ++i) {
		let suit = ai.state.suits.indexOf(piles[i][0]);
		let rank = parseInt(piles[i][1]);
		// NOTE: The order may need to be backwards for some variants.
		for (let j = 1; j <= rank; ++j) {
			const order = ai.state.deck.pop();
			if (order === undefined) {
				throw "Ran out of cards.";
				return ai;
			}
			ai.state.cards[order].rank = j;
			ai.state.cards[order].suitIndex = suit;
			ai.state.visible[suit][j]++;
			ai.state.piles[suit].push(order);
		}
	}
	for (let i = 0; i < discard.length; ++i) {
		let suit = ai.state.suits.indexOf(discard[i][0]);
		let rank = parseInt(discard[i][1]);
		const order = ai.state.deck[ai.state.deck.length - 1];
		if (order === undefined) {
			throw "Ran out of cards.";
			return ai;
		}
		ai.state.cards[order].rank = rank;
		ai.state.cards[order].suitIndex = suit;
		ai.discardDeckCard(order);
	}
	for (let i = 0; i < hands.length; ++i) {
		for (let j = hands[i].length - 1; j >= 0; --j) {
			let suit = ai.state.suits.indexOf(hands[i][j][0]);
			let rank = hands[i][j][1] == "?" ? -1 : parseInt(hands[i][j][1]);
			let clued = hands[i][j][2] == "*";
			const order = ai.state.deck[ai.state.deck.length - 1];
			ai.drawCard(i, order, suit, rank);
			ai.state.ai.inferred[order].clued = clued;
			if (clued && suit >= 0 && rank >= 0) {
				ai.state.clued[suit][rank]++;
			}
		}
	}
	return ai;
}

export function clue(
	ai: AI,
	from: string,
	to: string,
	clue: string | number,
	touched: number[],
) {
	const clueSuit = typeof clue == "string" ? ai.state.suits.indexOf(clue) : -1;
	const clueRank = typeof clue == "number" ? clue : -1;
	ai.giveClue(
		ai.config.playerNames.indexOf(from),
		ai.config.playerNames.indexOf(to),
		clueSuit,
		clueRank,
		touched.map((x) => x - 1),
	);
}

/*export function draw(ai: AI, player: string, card: string) {
  let suit = ai.state.suits.indexOf(hands[i][j][0]);
  let rank = hands[i][j][1] == '?' ? -1 : parseInt(hands[i][j][1]);
  ai.drawCard(player, ai.state.deck[ai.state.deck.length - 1], suit, rank);
}*/

export function cards(ai: AI, player: string, slot: number): string[] {
	let possible: string[] = [];
	const possibleArray =
		ai.state.ai.inferred[
			ai.state.hands[ai.config.playerNames.indexOf(player)][slot - 1]
		].possible;
	for (let i = 0; i < possibleArray.length; ++i) {
		possible.push(
			ai.state.suits[possibleArray[i].suitIndex] + possibleArray[i].rank,
		);
	}
	return possible.sort();
}

// Format of the string is the following:
// play #
// discard #
// clue player Suit/#
export function action(ai: AI, player: string): string {
	const playerIndex = ai.config.playerNames.indexOf(player);
	const action = ai.action(playerIndex);
	return ai.actionString(playerIndex, action);
}

export function debugAction(ai: AI, player: string) {
	const playerIndex = ai.config.playerNames.indexOf(player);
	return ai.debug(playerIndex);
}
