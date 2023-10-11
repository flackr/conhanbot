type AIInfo = {
  inferred: ExtraCardInfo[];
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
}

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
}

type SetupGameConfig = {
  variant?: string;
  players: string[] | number;
}

type GameConfig = {
  playerNames: string[];
  variant: string;
}

type Convention = "hgroup" | "refsieve";

const DEFAULT_PLAYER_NAMES = ["Alice", "Bob", "Cathy", "Donald"];

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
};

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
};

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

  constructor(ai: AI, from: number, player: number, clueSuit: number, clueRank: number) {
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
      this.prevInfo.push({...this.ai.state.ai.inferred[order]});
    }
  }

  play(index: number) {
    let clued: number[][] = this.ai.state.suits.map(x => []);
    for (let i = 0; i < this.ai.state.hands.length; ++i) {
      const hand = this.ai.state.hands[i];
      for (let j = 0; j < hand.length; ++j) {
        const order = hand[j];
        let card = this.ai.state.cards[order];
        const extra = this.ai.state.ai.inferred[order];
        if (i == this.from || i == this.player) {
          if (extra.possible.length == 1) {
            card = extra.possible[0];
          } else {
            // Don't use information from unknown cards.
            continue;
          }
        }
        // Ignore cards we don't know everything about.
        if (card.rank == -1 || card.suitIndex == -1)
          continue;
        if (extra.clued) {
          clued[card.suitIndex][card.rank] = (clued[card.suitIndex][card.rank] || 0) + 1;
        }
      }
    }
    const hand = this.ai.state.hands[this.player];
    // Update knowledge about cards.
    let newlyClued = [];
    let touched = [];
    let chop = this.ai.chop(this.player);
    for (let i = 0; i < hand.length; ++i) {
      const order = hand[i];
      const card = this.ai.state.cards[order];
      const inferred = this.ai.state.ai.inferred[order];
      let wasTouched = false;
      let prevKnown = this.prevInfo[i].clued;
      if (this.clueRank >= 0) {
        wasTouched = wasTouched || card.rank == this.clueRank;
        const filterFn = card.rank == this.clueRank ? (info: CardInfo) => info.rank == this.clueRank && (prevKnown || !clued[info.suitIndex][info.rank]) : (info: CardInfo) => info.rank != this.clueRank;
        this.ai.state.ai.inferred[order].possible = this.ai.state.ai.inferred[order].possible.filter(filterFn);
      } else if (this.clueSuit >= 0) {
        wasTouched = wasTouched || card.suitIndex == this.clueSuit;
        const filterFn = card.suitIndex == this.clueSuit ? (info: CardInfo) => info.suitIndex == this.clueSuit && (prevKnown || !clued[info.suitIndex][info.rank]) : (info: CardInfo) => info.suitIndex != this.clueSuit;
        this.ai.state.ai.inferred[order].possible = this.ai.state.ai.inferred[order].possible.filter(filterFn);
      }
      inferred.clued = inferred.clued || wasTouched;
      if (wasTouched) {
        touched.push(i);
        if (!this.prevInfo[i].clued)
          newlyClued.push(i);
      }
    }
    // Infer convention plays / protects. Both conventions have the concept of
    // plays. Only h-group has explicit protect clues.
    let protect = false;
    let play = true;
    let focus = -1;
    if (this.ai.convention == 'hgroup') {
      if (newlyClued.indexOf(chop) != -1) {
        focus = chop;
        // Check for possible cards needing protecting. Assume it is one of the matching cards.
        // If not, just assume a play clue.
        // protect = true;
        // However, if someone later plays a card blindly that could lead to this card,
        // we should assume it may have been a play clue. As such, we should assume it
        // could also be one of the playable cards that could follow an implied play.
      } else if (newlyClued.length > 0) {
        focus = newlyClued[0];
      } else if (touched.length > 0) {
        focus = touched[0];
      }
    }
    if (focus == -1)
      return;

    if (play) {
      // TODO: Detect finesses.
      // For each suit, determine the maximum rank that could be reached through clued card plays
      let maxRank:number[] = [];
      for (let suit = 0; suit < this.ai.state.suits.length; ++suit) {
        let rank = this.ai.state.piles[suit].length + 1;
        while (clued[suit][rank]) {
          ++rank;
        }
        maxRank.push(rank);
      }
      this.ai.state.ai.inferred[hand[focus]].possible = this.ai.state.ai.inferred[hand[focus]].possible.filter((card) => {
        let pile = this.ai.state.piles[card.suitIndex];
        let minRank = pile.length + 1;
        if (card.rank >= minRank && card.rank <= maxRank[card.suitIndex])
          return true;
        return false;
      });
    }
  }

  undo(index: number) {
    // Restore previous knowledge about cards.
    for (let i = 0; i < hand.length; ++i) {
      const order = hand[i];
      const card = this.ai.state.cards[order];
      this.ai.state.ai.inferred[order] = this.prevInfo[i];
    }    
  }
}

export class AI {
  config: GameConfig;
  convention: Convention;
  level: number;
  state: GameState;
  actions: ReversibleAction[];

  constructor(config: SetupGameConfig) {
    this.actions = [];
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
      playerNames: players
    }
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
      ai: {
        inferred: []
      }
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
      const numOfRank = [0, 3, 2, 2, 2, 1]
      this.state.remain.push([]);
      this.state.piles.push([]);
      for (let rank = 1; rank <= 5; ++rank) {
        this.state.remain[suit][rank] = numOfRank[rank];
        cards += this.state.remain[suit][rank];
        allPossible.push({rank, suitIndex: suit});
      }
    }
    
    while (this.state.deck.length < cards) {
      const order = this.state.deck.length;
      this.state.deck.push(order);
      this.state.ai.inferred.push({
        clued: false,
        chopMoved: false,
        possible: allPossible
      });
      this.state.cards.push({
        suitIndex: -1,
        rank: -1
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
      if (extra.clued || extra.chopMoved)
        continue;
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

  giveClue(from: number, player: number, clueSuit: number, clueRank: number, touched: number[]) {
    // Set affected cards.
    for (let i = 0; i < touched.length; ++i) {
      if (clueSuit >= 0)
        this.state.cards[this.state.hands[player][touched[i]]].suitIndex = clueSuit;
      if (clueRank >= 0)
        this.state.cards[this.state.hands[player][touched[i]]].rank = clueRank;
    }
    (new ClueAction(this, from, player, clueSuit, clueRank)).play(0);
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