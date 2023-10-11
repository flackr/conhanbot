import WebSocket from "ws";

const URL_EXPRESSION = /^http(?<secure>s?):\/\/(?<address>.*)\/?$/;

type ClientOptions = {
	username: string;
	password: string;
	url: string;
};

type ChatMessage = {
	msg: string;
	who: string;
	discord: boolean;
	server: boolean;
	datetime: string;
	room: string;
	recipient: string;
};

// Type sent with user and userList messages.
type User = {
  userID: number;
  name: string;
  status: number;
  tableID: number;
  hyphenated: boolean;
  inactive: boolean;
};

type Table = {
	id: number;
	name: string;
	passwordProtected: boolean;
	joined: boolean;
	numPlayers: number;
	owned: boolean;
	running: boolean;
	variant: string;
	options: {
		numPlayers: number;
		startingPlayer: number;
		variantID: number;
		variantName: string;
		timed: boolean;
		timeBase: number;
		timePerTurn: number;
		speedrun: boolean;
		cardCycle: boolean;
		deckPlays: boolean;
		emptyClues: boolean;
		oneExtraCard: boolean;
		oneLessCard: boolean;
		allOrNothing: boolean;
		detrimentalCharacters: boolean;
	};
	timed: boolean;
	timeBase: number;
	timePerTurn: number;
	sharedReplay: boolean;
	progress: number;
	players: string[];
	spectators: string[];
	maxPlayers: number;
};

type DrawAction = {
  type: "draw";
  playerIndex: number;
  order: number;
  // Will be -1 if unknown.
  suitIndex: number;
  // Will be -1 if unknown.
  rank: number;
};

type ClueAction = {
  type: "clue";
  clue: {
    type: number;
    value: number;
  },
  giver: number;
  // Absolute card indices touched.
  list: number[];
  target: number;
  turn: number;
};

type StatusAction = {
  type: "status";
  clues: number;
  maxScore: number;
  score: number;
};

type TurnAction = {
  type: "turn";
  // Absolute turn number - first turn is 0.
  num: number;
  currentPlayerIndex: number;
};

type PlayAction = {
  type: "play";
  playerIndex: number;
  // Absolute card index
  order: number;
  suitIndex: number;
  rank: number;
}

type ActionType = DrawAction | ClueAction | StatusAction | PlayAction | TurnAction;

type GameAction = {
  action: ActionType;
  tableID: number;
};

type GameActionList = {
  list: ActionType[];
  tableID: number;
};

type NoteListPlayer = {
  // One for every card in game.
  notes: string[];
  tableID: number;
}

type NoteOrder = {
  tableID: number;
  // Card index.
  order: number;
  note: string;
}

export class HanabiClient {
	options: ClientOptions;
	ws?: WebSocket;
	username?: string;
	tables: { [key: number]: Table };
  users: { [key: number]: User };

	constructor(options: ClientOptions) {
		this.options = options;
		this.tables = {};
    this.users = {};
	}

	async login() {
		let match = this.options.url.match(URL_EXPRESSION);
		if (!match || !match.groups) {
			throw `Unmatched URL format: ${this.options.url}`;
			return;
		}
		const groups = match.groups;
		let loginAddress = `http${groups.secure}://${groups.address}/login`;
		let websocketAddress = `ws${groups.secure}://${groups.address}/ws`;
		let response = await fetch(loginAddress, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				username: this.options.username,
				password: this.options.password,
				version: "bot",
			}),
		});
		if (response.status != 200) {
			throw `Authentication failed: ${response.statusText}`;
			return;
		}
		let cookie = response.headers.get("set-cookie");
		if (!cookie) {
			throw `No auth cookie in response`;
			return;
		}
		this.ws = new WebSocket(websocketAddress, undefined, {
			headers: {
				Cookie: cookie,
			},
		});
		this.ws.addEventListener("open", this.onopen);
		this.ws.addEventListener("message", this.onmessage);
	}

	onopen = () => {};

	onmessage = (evt) => {
		console.log(evt.data);
		let parts = evt.data.split(" ");
		const command = parts.splice(0, 1)[0];
		const data = JSON.parse(parts.join(" "));
		console.log(command, data);
		switch (command) {
			case "welcome":
				this.username = data.username;
				break;
			case "chat":
				this.chat(data);
				break;
			case "table":
				this.tableUpdate(data);
				break;
			case "tableList":
				for (let table of data) {
					this.tableUpdate(table);
				}
				break;
			case "tableGone":
				delete this.tables[data.tableID];
				break;
			case "tableStart":
				// We only get start messages if we are in the game.
				// When this happens, immediately request info.
				// Server responds with init (next case).
				this.send("getGameInfo1", {
					tableID: data.tableID,
				});
				break;
			case "init":
				// TODO: Handle this by setting up AI bot.
				this.send("getGameInfo2", {
					tableID: data.tableID,
				});
				break;
      case "gameAction":
        // TODO: Process the action,
        // and take action if its our turn.
        break;
      case "gameActionList":
        // TODO: Process all of the actions,
        // and take action if its our turn.
        this.send("loaded", {
          tableID: data.tableID
        });
        break;
      case "databaseID":
        // Sent when the game is over and shared replay starts.
        // Leave table and clean up game data.
        this.send("tableUnattend", {
          tableID: data.tableID
        });
        break;
		}
	};

	chat(message: ChatMessage) {
		if (message.recipient != this.username) return;
		if (!message.msg.startsWith("/")) return;
		const command = message.msg.substring(1);
		if (command == "join") {
		} else {
			this.chatReply("That is not a valid command.", message.who);
		}
	}

	chatJoin(message: ChatMessage) {
		let found;
		// TODO: use userList instead as it requires no searching.
		for (let id in this.tables) {
			const table = this.tables[id];
			if (table.running) continue;
			if (table.players.indexOf(message.who) != -1) {
				found = table;
				break;
			}
		}

		if (found === undefined) {
			this.chatReply(
				"Please create a table first before requesting that I join your game.",
				message.who,
			);
			return;
		}

		if (found.numPlayers >= found.maxPlayers) {
			this.chatReply("Your game is full.", message.who);
			return;
		}

		this.send("tableJoin", {
			tableID: found.id,
		});
	}

	chatReply(message: string, recipient: string) {
		this.send("chatPM", {
			msg: message,
			recipient,
			room: "lobby",
		});
	}

	send(command: string, data: any) {
		this.ws?.send(command + " " + JSON.stringify(data));
	}

	tableUpdate(table: Table) {
		this.tables[table.id] = table;
	}

	async quit() {
		if (!this.ws) return;
		this.ws.close();
		this.ws = undefined;
	}
}
