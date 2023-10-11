import { HanabiClient } from "./hanabi_client.ts";

let quitFunction = () => {};
let quitPromise = new Promise((resolve) => {
	quitFunction = () => {
		resolve(true);
	};
});

export function quit(reason: string) {
	console.log(`Quitting: ${reason}`);
	quitFunction();
}

const url = process.env.HANAB_URL || 'https://hanab.live/';
const bots = process.env.HANAB_BOTS || "1";
if (!process.env.HANAB_USERNAME ||
	  !process.env.HANAB_PASSWORD) {
	console.error(`Please set the following environment variables:
	HANAB_USERNAME		The base username to log into ${url} with. A number will be added for each bot.
	HANAB_PASSWORD		The password for these accounts.`);
	process.exit(0);
}

let baseName = process.env.HANAB_USERNAME;
let baseOptions = {
	username: "",
	password: process.env.HANAB_PASSWORD,
	url,
};
let num = parseInt(bots);

for (let i = 1; i <= num; ++i) {
	let options = {...baseOptions, username: `${baseName}i`};
	let client = new HanabiClient(options);
	await client.login();
}

// Wait for a quit signal.
await quitPromise;
