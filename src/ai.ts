type AIInfo = {
	inferred: ExtraCardInfo[];
};

// The value of a card. Lower critical numbers are more important than 5's
// as losing them reduces the score by more points.
enum CardValue {
	Trash = 0, // No longer playable.
	Duplicate = 1, // Duplicate of a clued card.
	Unknown = 2, // Used as the value of cards we don't know about.
	Eventual = 3, // Eventually playable.
	Soon = 4, // One away from playable.
	Playable = 5, // Currently playable.
	Clued = 6, // Currently clued - so probably eventually playable.

	Important = 7, // Must try to save cards higher than this value.
	TwoSave = 8, // A two that's not visible in someone elses hand.
	Critical_5 = 9, // A critical 5.
	Critical_4 = 10, // A critical 4.
	Critical_3 = 11, // A critical 3.
	Critical_2 = 12, // A critical 2.
	Critical_1 = 13, // A critical 1.
	MaxValue = 13,
}

type ExtraCardInfo = {
	possible: CardInfo[];
	chopMoved: boolean;
	clued: boolean;
	// Set when a play has been constructed.
	play?: {
		// The player who set up this play.
		from: number;
		// The next card to be played after this, e.g. a finesse.
		next?: number;
		// The cards to consider if this isn't the right one. E.g. a layered finesse.
		backup: number[];
	};
};

// GameState tracks what's known for sure.
type GameState = {
	hands: Hand[];
	discard: number[];
	cards: CardInfo[];
	deck: number[];
	// Each entry is a single character representing the suit, e.g. "R".
	suits: string[];
	// The number of remaining cards for each suit/rank.
	remain: number[][];
	// The number of clued cards of each suit/rank.
	clued: number[][];
	piles: Pile[];
	ai: AIInfo;
	clues: number;
	faults: number;
	turn: number;
};

type Pile = number[];
type Hand = number[];

type CardInfo = {
	suitIndex: number;
	rank: number;
};

type SetupGameConfig = {
	variant?: string;
	players: string[] | number;
	tableID?: number;
};

type GameConfig = {
	playerNames: string[];
	variant: string;
	tableID: number;
};

type Convention = "hgroup" | "refsieve";

const DEFAULT_PLAYER_NAMES = ["Alice", "Bob", "Cathy", "Donald"];

/*
Client actions:
Clue number: action {"tableID":1,"type":3,"target":<player>,"value":<value>}
Clue suit: action {"tableID":1,"type":2,"target":<player>,"value":<suitIndex>}
Play card 0: action {"tableID":1,"type":0,"target":<order>}
Discard card 4: action {"tableID":1,"type":1,"target":<order>}
*/

export enum PlayerActionType {
	Play = 0,
	Discard = 1,
	ClueSuit = 2,
	ClueRank = 3,
}

export type PlayerIndex = number;
export type CardOrder = number;
export type SuitIndex = number;
export type Rank = number;

export type PlayerAction = PlayerPlayOrDiscardAction | PlayerClueAction;
export type PlayerPlayOrDiscardAction = {
	tableID: number;
	type: PlayerActionType.Play | PlayerActionType.Discard;
	target: CardOrder;
};
export type PlayerClueAction = {
	tableID: number;
	type: PlayerActionType.ClueRank | PlayerActionType.ClueSuit;
	target: PlayerIndex;
	value: SuitIndex | Rank;
};

class ReversibleAction {
	ai: AI;

	constructor(ai: AI) {
		this.ai = ai;
	}

	count() {
		return 1;
	}
	play(index: number) {}
	undo(index: number) {}
	command(): PlayerAction | null {
		return null;
	}
}

class MoveCardAction extends ReversibleAction {
	source: number[];
	index: number;
	order: number;

	constructor(ai: AI, source: number[], index: number) {
		super(ai);
		this.source = source;
		this.index = index;
		this.order = source[index];
	}

	play(index: number) {
		this.source.splice(this.index, 1);
	}

	undo(index: number) {
		this.source.splice(this.index, 0, this.order);
	}
}

class PlayIndexAction extends MoveCardAction {
	constructor(ai: AI, source: number[], index: number) {
		super(ai, source, index);
	}

	// Play should consider every possible outcome.
	count() {
		return this.ai.state.ai.inferred[this.order].possible.length;
	}

	play(index: number) {
		super.play(index);
		let card = this.ai.state.ai.inferred[this.order].possible[index];
		if (this.ai.playable(card)) {
			this.ai.state.piles[card.suitIndex].push(this.order);
		} else {
			this.ai.state.discard.push(this.order);
			this.ai.state.faults++;
		}
	}

	undo(index: number) {
		super.undo(index);
		let card = this.ai.state.ai.inferred[this.order].possible[index];
		let pile = this.ai.state.piles[card.suitIndex];
		if (pile.length > 0 && pile[pile.length - 1] == this.order) {
			pile.pop();
		} else {
			this.ai.state.discard.pop();
			this.ai.state.faults--;
		}
	}

	command(): PlayerPlayOrDiscardAction {
		return {
			tableID: this.ai.config.tableID,
			type: PlayerActionType.Play,
			target: this.order,
		};
	}
}

class DiscardIndexAction extends MoveCardAction {
	constructor(ai: AI, source: number[], index: number) {
		super(ai, source, index);
	}

	play(index: number) {
		super.play(index);
		this.ai.state.discard.push(this.order);
		this.ai.state.clues++;

		// TODO: A discard when the player has a known play should be treated differently.
	}

	undo(index: number) {
		super.undo(index);
		this.ai.state.discard.pop();
		this.ai.state.clues--;
	}

	command(): PlayerPlayOrDiscardAction {
		return {
			tableID: this.ai.config.tableID,
			type: PlayerActionType.Discard,
			target: this.order,
		};
	}
}

class PickupCardAction extends MoveCardAction {
	player: number;

	constructor(ai: AI, player: number) {
		super(ai, ai.state.deck, 0);
		this.player = player;
	}

	play(index: number) {
		super.play(index);
		this.ai.state.hands[this.player].splice(0, 0, this.order);
	}

	undo(index: number) {
		super.undo(index);
		this.ai.state.hands[this.player].splice(0, 1);
	}
}

class ClueAction extends ReversibleAction {
	from: number;
	player: number;
	clueSuit: number;
	clueRank: number;
	prevInfo: ExtraCardInfo[];

	constructor(
		ai: AI,
		from: number,
		player: number,
		clueSuit: number,
		clueRank: number,
	) {
		super(ai);
		this.from = from;
		this.player = player;
		this.clueSuit = clueSuit;
		this.clueRank = clueRank;
		const hand = this.ai.state.hands[this.player];
		this.prevInfo = [];
		// Save previous knowledge about cards.
		for (let i = 0; i < hand.length; ++i) {
			const order = hand[i];
			const card = this.ai.state.cards[order];
			this.prevInfo.push({ ...this.ai.state.ai.inferred[order] });
		}
	}

	play(index: number) {
		const hand = this.ai.state.hands[this.player];
		// Update knowledge about cards.
		let newlyClued = [];
		let touched = [];
		let chop = this.ai.chop(this.player);
		this.ai.modifyCluedFor(this.from, -1);
		for (let i = 0; i < hand.length; ++i) {
			const order = hand[i];
			let card = this.ai.state.cards[order];
			const inferred = this.ai.state.ai.inferred[order];
			let wasTouched = false;
			let prevKnown = this.prevInfo[i].clued;
			if (this.clueRank >= 0) {
				wasTouched = wasTouched || card.rank == this.clueRank;
				const filterFn =
					card.rank == this.clueRank
						? (info: CardInfo) =>
								info.rank == this.clueRank &&
								(prevKnown ||
									this.ai.cardValue(order, info, CardValue.Eventual) >=
										CardValue.Eventual)
						: (info: CardInfo) => info.rank != this.clueRank;
				this.ai.state.ai.inferred[order].possible =
					this.ai.state.ai.inferred[order].possible.filter(filterFn);
			} else if (this.clueSuit >= 0) {
				wasTouched = wasTouched || card.suitIndex == this.clueSuit;
				const filterFn =
					card.suitIndex == this.clueSuit
						? (info: CardInfo) =>
								info.suitIndex == this.clueSuit &&
								(prevKnown ||
									this.ai.cardValue(order, info, CardValue.Eventual) >=
										CardValue.Eventual)
						: (info: CardInfo) => info.suitIndex != this.clueSuit;
				this.ai.state.ai.inferred[order].possible =
					this.ai.state.ai.inferred[order].possible.filter(filterFn);
			}
			inferred.clued = inferred.clued || wasTouched;
			if (wasTouched) {
				touched.push(i);
				if (!this.prevInfo[i].clued) {
					card = this.ai.assumedCard(order);
					if (card.suitIndex >= 0 && card.rank >= 0) {
						this.ai.state.clued[card.suitIndex][card.rank]++;
					}
					newlyClued.push(i);
				}
			}
		}
		// Infer convention plays / protects. Both conventions have the concept of
		// plays. Only h-group has explicit protect clues.
		let protect = false;
		let play = true;
		let focus = -1;
		if (this.ai.convention == "hgroup") {
			if (newlyClued.indexOf(chop) != -1) {
				focus = chop;
				// TODO: Check for possible cards needing protecting. Assume it is one of the matching cards.
				// If not, just assume a play clue.
				protect = true;
				play = false;
				// However, if someone later plays a card blindly that could lead to this card,
				// we should assume it may have been a play clue. As such, we should assume it
				// could also be one of the playable cards that could follow an implied play.
			} else if (newlyClued.length > 0) {
				focus = newlyClued[0];
			} else if (touched.length > 0) {
				focus = touched[0];
			}
		}
		if (focus != -1) {
			if (play) {
				// TODO: Detect finesses.
				// For each suit, determine the maximum rank that could be reached through clued card plays
				let maxRank: number[] = [];
				for (let suit = 0; suit < this.ai.state.suits.length; ++suit) {
					let rank = this.ai.state.piles[suit].length + 1;
					while (this.ai.state.clued[suit][rank]) {
						++rank;
					}
					maxRank.push(rank);
				}
				this.ai.state.ai.inferred[hand[focus]].possible =
					this.ai.state.ai.inferred[hand[focus]].possible.filter((card) => {
						let pile = this.ai.state.piles[card.suitIndex];
						let minRank = pile.length + 1;

						if (card.rank >= minRank && card.rank <= maxRank[card.suitIndex])
							return true;
						return false;
					});
			}
		}
		this.ai.modifyCluedFor(this.from, 1);
	}

	undo(index: number) {
		// Restore previous knowledge about cards.
		const hand = this.ai.state.hands[this.player];
		for (let i = 0; i < hand.length; ++i) {
			const order = hand[i];
			const card = this.ai.assumedCard(order);
			if (
				!this.prevInfo[i].clued &&
				this.ai.state.ai.inferred[order].clued &&
				card.rank >= 0 &&
				card.suitIndex >= 0
			) {
				this.ai.state.clued[card.suitIndex][card.rank]--;
			}
			this.ai.state.ai.inferred[order] = this.prevInfo[i];
		}
	}

	command(): PlayerClueAction {
		if (this.clueRank >= 0) {
			return {
				tableID: this.ai.config.tableID,
				type: PlayerActionType.ClueRank,
				target: this.player,
				value: this.clueRank,
			};
		}
		return {
			tableID: this.ai.config.tableID,
			type: PlayerActionType.ClueSuit,
			target: this.player,
			value: this.clueSuit,
		};
	}
}

export class AI {
	config: GameConfig;
	convention: Convention;
	level: number;
	state: GameState;

	constructor(config: SetupGameConfig) {
		let players = [];
		if (Array.isArray(config.players)) {
			players = config.players;
		} else if (config.players > 0) {
			if (config.players > DEFAULT_PLAYER_NAMES.length)
				throw `Asked for ${config.players} players, please extend DEFAULT_PLAYER_NAMES.`;
			while (players.length < config.players) {
				players.push(DEFAULT_PLAYER_NAMES[players.length]);
			}
		}
		this.config = {
			variant: config.variant || "No Variant",
			playerNames: players,
			tableID: config.tableID || 0,
		};
		this.state = {
			hands: [],
			discard: [],
			cards: [],
			deck: [],
			suits: [],
			piles: [],
			clues: 8,
			faults: 0,
			turn: 0,
			remain: [],
			clued: [],
			ai: {
				inferred: [],
			},
		};
		let piles = 5;
		this.state.suits = ["R", "Y", "G", "B", "P"];
		if (this.config.variant != "No Variant") {
			throw `Unrecognized variant: ${variant}`;
			return;
		}
		let cards = 0;
		let allPossible: CardInfo[] = [];
		for (let suit = 0; suit < this.state.suits.length; ++suit) {
			const numOfRank = [0, 3, 2, 2, 2, 1];
			this.state.remain.push([]);
			this.state.clued.push([]);
			this.state.piles.push([]);
			for (let rank = 1; rank <= 5; ++rank) {
				this.state.remain[suit][rank] = numOfRank[rank];
				this.state.clued[suit][rank] = 0;
				cards += this.state.remain[suit][rank];
				allPossible.push({ rank, suitIndex: suit });
			}
		}

		while (this.state.deck.length < cards) {
			const order = this.state.deck.length;
			this.state.deck.push(order);
			this.state.ai.inferred.push({
				clued: false,
				chopMoved: false,
				possible: allPossible,
			});
			this.state.cards.push({
				suitIndex: -1,
				rank: -1,
			});
		}
		while (this.state.hands.length < this.config.playerNames.length) {
			this.state.hands.push([]);
		}
		this.state.deck = this.state.deck.reverse();
		this.convention = "hgroup";
		this.level = 1;
	}

	chop(player: number): number {
		// TODO: Implement ref sieve chop.
		let chop = this.state.hands[player].length - 1;
		for (; chop >= 0; --chop) {
			const order = this.state.hands[player][chop];
			const extra = this.state.ai.inferred[order];
			if (extra.clued || extra.chopMoved) continue;
			break;
		}
		return chop;
	}

	drawCard(player: number, order: number, suit: number, rank: number) {
		const index = this.state.deck.indexOf(order);
		if (index == -1) {
			throw `Requested card #${order} not in deck.`;
			return;
		}
		this.state.deck.splice(index, 1);
		this.state.hands[player].splice(0, 0, order);
		this.state.cards[order].rank = rank;
		this.state.cards[order].suitIndex = suit;
	}

	giveClue(
		from: number,
		player: number,
		clueSuit: number,
		clueRank: number,
		touched: number[],
	) {
		// Set affected cards.
		for (let i = 0; i < touched.length; ++i) {
			if (clueSuit >= 0)
				this.state.cards[this.state.hands[player][touched[i]]].suitIndex =
					clueSuit;
			if (clueRank >= 0)
				this.state.cards[this.state.hands[player][touched[i]]].rank = clueRank;
		}
		new ClueAction(this, from, player, clueSuit, clueRank).play(0);
	}

	assumedCard(order: number): CardInfo {
		const card = this.state.cards[order];
		if (card.rank >= 0 && card.suitIndex >= 0) {
			return card;
		}
		const possible = this.state.ai.inferred[order].possible;
		if (possible.length == 1) {
			return possible[0];
		}
		return { suitIndex: -1, rank: -1 };
	}

	/**
	 * Returns the value of the given card:
	 */
	cardValue(
		order: number,
		card: CardInfo,
		minValue: CardValue = CardValue.MaxValue,
	): CardValue {
		// We can't save cards we don't know about.
		if (card.rank == -1 || card.suitIndex == -1) {
			return CardValue.Unknown;
		}

		// TODO: Support piles played backwards.
		let minRank = this.state.piles[card.suitIndex].length + 1;
		if (card.rank < minRank) {
			return CardValue.Trash;
		}
		let maxRank = minRank;
		while (this.state.remain[card.suitIndex][maxRank]) {
			++maxRank;
		}
		if (card.rank >= maxRank) {
			return CardValue.Trash;
		}

		// Critical cards
		if (this.state.remain[card.suitIndex][card.rank] == 1) {
			return CardValue.Critical_5 + (5 - card.rank);
		}

		// Check for a duplicate of an already clued card.
		if (
			!this.state.ai.inferred[order].clued &&
			this.state.clued[card.suitIndex][card.rank]
		) {
			return CardValue.Duplicate;
		}

		// At this point, we're guaranteed this should eventually be a useful card.
		// If we only card to know that, we can skip some of the more expensive checks.
		if (minValue <= CardValue.Eventual) {
			return CardValue.Eventual;
		}
		if (card.rank == 2) {
			// Check if any other instances of this card are visible.
			let otherCard = -1;
			for (let i = 0; i < this.state.hands.length; ++i) {
				let oorder = this.state.hands[i].find((oorder) => {
					const other = this.state.cards[oorder];
					return (
						oorder != order &&
						other.rank == card.rank &&
						other.suitIndex == card.suitIndex
					);
				});
				if (oorder !== undefined) {
					// TODO: Find clued other card if it exists.
					otherCard = oorder;
					break;
				}
			}
			if (otherCard == -1) {
				return CardValue.TwoSave;
			}
		}

		if (
			this.state.ai.inferred[order].clued ||
			this.state.ai.inferred[order].chopMoved
		) {
			return CardValue.Clued;
		}
		if (card.rank == minRank) {
			return CardValue.Playable;
		}
		if (card.rank == minRank + 1) {
			return CardValue.Soon;
		}
		return CardValue.Eventual;
	}

	modifyCluedFor(player: number, direction: number) {
		const giver = this.state.hands[player];
		// Remove known clued cards that the cluegiver wouldn't know for sure.
		for (let i = 0; i < giver.length; ++i) {
			const order = giver[i];
			const card = this.state.cards[order];
			const inferred = this.state.ai.inferred[order];
			if (
				inferred.clued &&
				card.rank >= 0 &&
				card.suitIndex >= 0 &&
				inferred.possible.length != 1
			) {
				this.state.clued[card.suitIndex][card.rank] += direction;
			}
		}
	}

	action(player: number): ReversibleAction {
		// Check for protects.
		const hand = this.state.hands[player];
		for (let offset = 1; offset < this.state.hands.length; ++offset) {
			let index = (player + offset) % this.state.hands.length;
			const chop = this.chop(index);
			const order = this.state.hands[index][chop];
			const card = this.state.cards[order];
			if (chop == -1) continue;
			const cValue = this.cardValue(order, card);
			if (cValue >= CardValue.Important) {
				// Should keep this player busy or protect their card.
				// For now, just protect the card.
				// TODO: Determine whether rank or color is better
				return new ClueAction(this, player, index, -1, card.rank);
			}
		}
		// Check for plays.
		for (let i = 0; i < hand.length; ++i) {
			const order = hand[i];
			let allPlayable = true;
			for (let card of this.state.ai.inferred[order].possible) {
				if (!this.playable(card)) {
					allPlayable = false;
					break;
				}
			}
			if (allPlayable) {
				return new PlayIndexAction(this, hand, i);
			}
		}
		// Otherwise discard.
		return new DiscardIndexAction(this, hand, this.chop(player));
	}

	playable(card: CardInfo) {
		let pile = this.state.piles[card.suitIndex];
		let topValue = pile.length;
		return card.rank == topValue + 1;
	}

	supportedVariants(): string[] {
		return ["No Variant"];
	}

	//setState(piles: string[], )
}
