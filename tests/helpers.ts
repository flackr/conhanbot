import { AI } from '../src/ai';

export function setState(state: {ai?: AI, piles?: string[], hands: string[][]}): AI {
  const piles = state.piles || [];
  const hands = state.hands;
  let ai = state.ai || new AI({players: hands.length});
  for (let i = 0; i < piles.length; ++i) {
    let suit = ai.state.suits.indexOf(piles[i][0]);
    let rank = parseInt(piles[i][1]);
    // NOTE: The order may need to be backwards for some variants.
    for (let j = 1; j <= rank; ++j) {
      const order = ai.state.deck.pop();
      if (order === undefined) {
        throw "Ran out of cards.";
        return;
      }
      ai.state.cards[order].rank = j;
      ai.state.cards[order].suitIndex = suit;
      ai.state.piles[suit].push(order);
    }
  }
  for (let i = 0; i < hands.length; ++i) {
    for (let j = hands[i].length - 1; j >= 0; --j) {
      let suit = ai.state.suits.indexOf(hands[i][j][0]);
      let rank = hands[i][j][1] == '?' ? -1 : parseInt(hands[i][j][1]);
      const order = ai.state.deck[ai.state.deck.length - 1];
      ai.drawCard(i, order, suit, rank);
    }
  }
  return ai;
}

export function clue(ai: AI, from: number, to: number, clue: string | number, touched: number[]) {
  const clueSuit = typeof clue == "string" ? ai.state.suits.indexOf(clue) : -1;
  const clueRank = typeof clue == "number" ? clue : -1;
  ai.giveClue(from, to, clueSuit, clueRank, touched);
}

export function draw(ai: AI, player: number, card: string) {
  let suit = ai.state.suits.indexOf(hands[i][j][0]);
  let rank = hands[i][j][1] == '?' ? -1 : parseInt(hands[i][j][1]);
  ai.drawCard(player, ai.state.deck[ai.state.deck.length - 1], suit, rank);
}

export function cards(ai: AI, player: number, index: number): string[] {
  let possible: string[] = [];
  const possibleArray = ai.state.ai.inferred[ai.state.hands[player][index]].possible;
  for (let i = 0; i < possibleArray.length; ++i) {
    possible.push(ai.state.suits[possibleArray[i].suitIndex] + possibleArray[i].rank);
  }
  return possible.sort();
}