const POKEMON_ENDPOINT = "https://pokeapi.co/api/v2/pokemon";
const DEFAULT_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

const playerNameInput = document.getElementById("player-pokemon-name");
const turnLimitInput = document.getElementById("turn-limit");
const startBattleButton = document.getElementById("start-battle-btn");
const battleStatusElement = document.getElementById("battle-status");
const turnInfoElement = document.getElementById("turn-info");
const movesContainer = document.getElementById("moves-container");
const battleLogElement = document.getElementById("battle-log");

const uiBySide = {
	player: {
		name: document.getElementById("player-name"),
		sprite: document.getElementById("player-sprite"),
		types: document.getElementById("player-types"),
		hpText: document.getElementById("player-hp-text"),
		hpFill: document.getElementById("player-hp-fill"),
	},
	enemy: {
		name: document.getElementById("enemy-name"),
		sprite: document.getElementById("enemy-sprite"),
		types: document.getElementById("enemy-types"),
		hpText: document.getElementById("enemy-hp-text"),
		hpFill: document.getElementById("enemy-hp-fill"),
	},
};

const battleState = {
	inProgress: false,
	waitingEnemy: false,
	player: null,
	enemy: null,
	playerMoves: [],
	enemyMoves: [],
	turnLimit: 10,
	turnsPlayed: 0,
};

const moveCache = new Map();
let cachedPokemonCount = null;
let startingBattle = false;

const fallbackMoves = [
	{ name: "tackle", displayName: "Placaje", power: 40, accuracy: 100, type: "normal" },
	{ name: "quick-attack", displayName: "Ataque rapido", power: 40, accuracy: 100, type: "normal" },
	{ name: "scratch", displayName: "Araniazo", power: 40, accuracy: 100, type: "normal" },
	{ name: "headbutt", displayName: "Cabezazo", power: 70, accuracy: 100, type: "normal" },
];

function capitalize(text) {
	if (!text) {
		return "";
	}

	return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatName(value) {
	return value
		.split("-")
		.map((part) => capitalize(part))
		.join(" ");
}

function normalizePokemonName(value) {
	return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function shuffleArray(list) {
	for (let i = list.length - 1; i > 0; i -= 1) {
		const randomIndex = Math.floor(Math.random() * (i + 1));
		[list[i], list[randomIndex]] = [list[randomIndex], list[i]];
	}
}

function wait(milliseconds) {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}

function setStatus(message, statusType = "info") {
	battleStatusElement.textContent = message;
	battleStatusElement.classList.toggle("error", statusType === "error");
	battleStatusElement.classList.toggle("success", statusType === "success");
}

function appendBattleLog(message) {
	const placeholder = battleLogElement.querySelector(".log-placeholder");
	if (placeholder) {
		placeholder.remove();
	}

	const listItem = document.createElement("li");
	listItem.textContent = message;
	battleLogElement.prepend(listItem);

	while (battleLogElement.children.length > 14) {
		battleLogElement.removeChild(battleLogElement.lastElementChild);
	}
}

function clearBattleLog() {
	battleLogElement.innerHTML = "";
	const placeholderItem = document.createElement("li");
	placeholderItem.className = "log-placeholder";
	placeholderItem.textContent = "Aun no hay acciones de combate.";
	battleLogElement.appendChild(placeholderItem);
}

function setStartButtonLoading(isLoading) {
	startBattleButton.disabled = isLoading;
	startBattleButton.textContent = isLoading ? "Cargando..." : "Iniciar combate";
}

function getTurnLimitValue() {
	const parsedValue = Number.parseInt(turnLimitInput.value, 10);
	if (!Number.isInteger(parsedValue) || parsedValue < 1) {
		return 10;
	}

	return parsedValue;
}

function updateTurnInfo() {
	if (battleState.inProgress) {
		turnInfoElement.textContent = `Turnos: ${battleState.turnsPlayed} / ${battleState.turnLimit}`;
		return;
	}

	const pendingLimit = getTurnLimitValue();
	turnInfoElement.textContent = `Turnos: 0 / ${pendingLimit}`;
}

function getStatValue(pokemonData, statName) {
	const statEntry = pokemonData.stats.find((item) => item.stat.name === statName);
	return statEntry ? statEntry.base_stat : 1;
}

function getSpriteUrl(pokemonData) {
	const officialArtwork = pokemonData.sprites.other?.["official-artwork"]?.front_default;
	return officialArtwork || pokemonData.sprites.front_default || DEFAULT_SPRITE;
}

function buildFighter(pokemonData) {
	const hpBase = getStatValue(pokemonData, "hp");

	const maxHp = Math.max(65, hpBase + 75);

	return {
		id: pokemonData.id,
		name: pokemonData.name,
		displayName: formatName(pokemonData.name),
		types: pokemonData.types.map((entry) => entry.type.name),
		sprite: getSpriteUrl(pokemonData),
		maxHp,
		currentHp: maxHp,
	};
}

function renderFighter(side) {
	const fighter = battleState[side];
	const ui = uiBySide[side];

	if (!fighter) {
		ui.name.textContent = side === "player" ? "Tu Pokemon" : "Pokemon enemigo";
		ui.types.textContent = "Tipo: --";
		ui.hpText.textContent = "HP: -- / --";
		ui.hpFill.style.width = "0%";
		ui.hpFill.style.backgroundColor = "#22a35d";
		ui.sprite.src = DEFAULT_SPRITE;
		return;
	}

	ui.name.textContent = fighter.displayName;
	ui.types.textContent = `Tipo: ${fighter.types.map((type) => formatName(type)).join(", ")}`;
	ui.sprite.src = fighter.sprite;
	ui.sprite.alt = `Sprite de ${fighter.displayName}`;
	ui.sprite.onerror = () => {
		ui.sprite.onerror = null;
		ui.sprite.src = DEFAULT_SPRITE;
	};

	updateHpUi(side);
}

function updateHpUi(side) {
	const fighter = battleState[side];
	const ui = uiBySide[side];

	if (!fighter) {
		return;
	}

	const hpRatio = fighter.maxHp > 0 ? fighter.currentHp / fighter.maxHp : 0;
	const hpPercent = Math.max(0, Math.round(hpRatio * 100));

	ui.hpText.textContent = `HP: ${fighter.currentHp} / ${fighter.maxHp}`;
	ui.hpFill.style.width = `${hpPercent}%`;

	if (hpPercent > 55) {
		ui.hpFill.style.backgroundColor = "#22a35d";
	} else if (hpPercent > 25) {
		ui.hpFill.style.backgroundColor = "#ffb020";
	} else {
		ui.hpFill.style.backgroundColor = "#e04545";
	}
}

function getFallbackMoves(count) {
	const selected = [...fallbackMoves];
	shuffleArray(selected);
	return selected.slice(0, count).map((move) => ({ ...move }));
}

async function fetchPokemonCount() {
	if (cachedPokemonCount !== null) {
		return cachedPokemonCount;
	}

	const response = await fetch(`${POKEMON_ENDPOINT}?limit=1`);
	if (!response.ok) {
		throw new Error("No se pudo obtener la cantidad de Pokemon.");
	}

	const payload = await response.json();
	cachedPokemonCount = payload.count;
	return cachedPokemonCount;
}

async function fetchPokemonByName(name) {
	const normalizedName = normalizePokemonName(name);
	const response = await fetch(`${POKEMON_ENDPOINT}/${encodeURIComponent(normalizedName)}`);

	if (response.status === 404) {
		throw new Error("No existe un Pokemon con ese nombre.");
	}

	if (!response.ok) {
		throw new Error("No se pudo cargar tu Pokemon.");
	}

	return response.json();
}

async function fetchRandomEnemyPokemon(excludedPokemonName) {
	const totalCount = await fetchPokemonCount();

	for (let attempt = 0; attempt < 25; attempt += 1) {
		const randomId = Math.floor(Math.random() * totalCount) + 1;
		const response = await fetch(`${POKEMON_ENDPOINT}/${randomId}`);

		if (!response.ok) {
			continue;
		}

		const pokemonData = await response.json();
		if (pokemonData.name !== excludedPokemonName) {
			return pokemonData;
		}
	}

	throw new Error("No fue posible elegir un rival aleatorio.");
}

async function fetchMoveData(moveUrl) {
	if (moveCache.has(moveUrl)) {
		return moveCache.get(moveUrl);
	}

	const pendingMove = (async () => {
		try {
			const response = await fetch(moveUrl);
			if (!response.ok) {
				return null;
			}

			const payload = await response.json();
			const damageClass = payload.damage_class?.name;
			if (payload.power === null || damageClass === "status") {
				return null;
			}

			return {
				name: payload.name,
				displayName: formatName(payload.name),
				power: payload.power,
				accuracy: payload.accuracy ?? 100,
				type: payload.type?.name ?? "normal",
			};
		} catch {
			return null;
		}
	})();

	moveCache.set(moveUrl, pendingMove);
	return pendingMove;
}

async function selectBattleMoves(pokemonData, count) {
	const moveEntries = [...pokemonData.moves];
	shuffleArray(moveEntries);

	const selectedMoves = [];
	let pointer = 0;

	while (selectedMoves.length < count && pointer < moveEntries.length) {
		const moveBatch = moveEntries.slice(pointer, pointer + 12);
		pointer += 12;

		const moveDetails = await Promise.all(
			moveBatch.map((entry) => fetchMoveData(entry.move.url))
		);

		moveDetails.forEach((move) => {
			if (!move) {
				return;
			}
			if (selectedMoves.some((entry) => entry.name === move.name)) {
				return;
			}
			selectedMoves.push(move);
		});
	}

	if (selectedMoves.length < count) {
		const fallbackPool = getFallbackMoves(count);
		fallbackPool.forEach((move) => {
			if (selectedMoves.length >= count) {
				return;
			}
			if (!selectedMoves.some((entry) => entry.name === move.name)) {
				selectedMoves.push(move);
			}
		});
	}

	return selectedMoves.slice(0, count);
}

function renderMoveButtons() {
	movesContainer.innerHTML = "";

	if (battleState.playerMoves.length === 0) {
		movesContainer.textContent = "No hay movimientos disponibles.";
		return;
	}

	battleState.playerMoves.forEach((move, index) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "move-btn";
		button.dataset.moveIndex = String(index);

		const moveName = document.createElement("span");
		moveName.className = "move-name";
		moveName.textContent = move.displayName;

		const moveMeta = document.createElement("span");
		moveMeta.className = "move-meta";
		moveMeta.textContent = `Poder ${move.power} | Precision ${move.accuracy}% | Tipo ${formatName(move.type)}`;

		button.appendChild(moveName);
		button.appendChild(moveMeta);
		movesContainer.appendChild(button);
	});
}

function setMoveButtonsEnabled(isEnabled) {
	const moveButtons = movesContainer.querySelectorAll("button[data-move-index]");
	moveButtons.forEach((button) => {
		button.disabled = !isEnabled;
	});
}

function calculateDamage(move) {
	return Math.max(1, Number(move.power) || 1);
}

function finishBattle(winnerSide, reason = "knockout") {
	battleState.inProgress = false;
	battleState.waitingEnemy = false;
	setMoveButtonsEnabled(false);
	updateTurnInfo();

	if (winnerSide === "player") {
		if (reason === "turn-limit") {
			setStatus("Ganaste por tener mas vida al llegar al limite de turnos.", "success");
			appendBattleLog("Ganaste por mayor vida restante.");
		} else {
			setStatus("Ganaste el combate.", "success");
			appendBattleLog("Tu Pokemon gana la batalla.");
		}
	} else {
		if (reason === "turn-limit") {
			setStatus("Perdiste por tener menos vida al llegar al limite de turnos.", "error");
			appendBattleLog("El rival gana por mayor vida restante.");
		} else {
			setStatus("Perdiste el combate.", "error");
			appendBattleLog("El Pokemon enemigo gana la batalla.");
		}
	}
}

function finishByTurnLimit() {
	const playerHp = battleState.player.currentHp;
	const enemyHp = battleState.enemy.currentHp;

	if (playerHp > enemyHp) {
		finishBattle("player", "turn-limit");
		return;
	}

	if (enemyHp > playerHp) {
		finishBattle("enemy", "turn-limit");
		return;
	}

	battleState.inProgress = false;
	battleState.waitingEnemy = false;
	setMoveButtonsEnabled(false);
	updateTurnInfo();
	setStatus("Empate: se alcanzo el limite de turnos con la misma vida.");
	appendBattleLog("Combate empatado por limite de turnos.");
}

function executeAttack(attackerSide, defenderSide, move) {
	const defender = battleState[defenderSide];
	const attackerLabel = attackerSide === "player" ? "Tu Pokemon" : "Rival";
	const defenderLabel = defenderSide === "player" ? "tu Pokemon" : "el rival";

	const damage = calculateDamage(move);
	defender.currentHp = Math.max(0, defender.currentHp - damage);
	updateHpUi(defenderSide);
	appendBattleLog(`${attackerLabel} uso ${move.displayName} e hizo ${damage} de danio a ${defenderLabel}.`);

	if (defender.currentHp <= 0) {
		appendBattleLog(`${defender.displayName} se debilito.`);
		finishBattle(attackerSide);
		return attackerSide;
	}

	return null;
}

async function runPlayerTurn(moveIndex) {
	if (!battleState.inProgress || battleState.waitingEnemy) {
		return;
	}

	const playerMove = battleState.playerMoves[moveIndex];
	if (!playerMove) {
		return;
	}

	battleState.waitingEnemy = true;
	setMoveButtonsEnabled(false);
	setStatus("Tu Pokemon ataca...");

	const winnerAfterPlayerAttack = executeAttack("player", "enemy", playerMove);
	if (winnerAfterPlayerAttack) {
		return;
	}

	await wait(650);
	const enemyMove = battleState.enemyMoves[Math.floor(Math.random() * battleState.enemyMoves.length)];
	setStatus("El rival responde...");

	const winnerAfterEnemyAttack = executeAttack("enemy", "player", enemyMove);
	if (winnerAfterEnemyAttack) {
		return;
	}

	battleState.turnsPlayed += 1;
	updateTurnInfo();
	appendBattleLog(`Fin del turno ${battleState.turnsPlayed} de ${battleState.turnLimit}.`);

	if (battleState.turnsPlayed >= battleState.turnLimit) {
		finishByTurnLimit();
		return;
	}

	battleState.waitingEnemy = false;
	setMoveButtonsEnabled(true);
	setStatus("Tu turno. Elige un ataque.");
}

function resetBattleStateUi() {
	battleState.inProgress = false;
	battleState.waitingEnemy = false;
	battleState.player = null;
	battleState.enemy = null;
	battleState.playerMoves = [];
	battleState.enemyMoves = [];
	battleState.turnsPlayed = 0;
	battleState.turnLimit = getTurnLimitValue();

	renderFighter("player");
	renderFighter("enemy");

	movesContainer.innerHTML = "";
	setMoveButtonsEnabled(false);
	clearBattleLog();
	updateTurnInfo();
}

async function startBattle() {
	if (startingBattle) {
		return;
	}

	const playerPokemonName = playerNameInput.value.trim();
	if (playerPokemonName === "") {
		setStatus("Ingresa el nombre de un Pokemon.", "error");
		return;
	}

	const configuredTurnLimit = getTurnLimitValue();
	turnLimitInput.value = String(configuredTurnLimit);

	startingBattle = true;
	setStartButtonLoading(true);
	resetBattleStateUi();
	battleState.turnLimit = configuredTurnLimit;
	battleState.turnsPlayed = 0;
	updateTurnInfo();
	setStatus("Buscando tu Pokemon...");

	try {
		const playerPokemonData = await fetchPokemonByName(playerPokemonName);
		setStatus("Buscando rival aleatorio...");
		const enemyPokemonData = await fetchRandomEnemyPokemon(playerPokemonData.name);

		setStatus("Cargando movimientos...");
		const [playerMoves, enemyMoves] = await Promise.all([
			selectBattleMoves(playerPokemonData, 4),
			selectBattleMoves(enemyPokemonData, 4),
		]);

		battleState.player = buildFighter(playerPokemonData);
		battleState.enemy = buildFighter(enemyPokemonData);
		battleState.playerMoves = playerMoves;
		battleState.enemyMoves = enemyMoves.length > 0 ? enemyMoves : getFallbackMoves(4);
		battleState.inProgress = true;
		battleState.waitingEnemy = false;
		battleState.turnsPlayed = 0;
		updateTurnInfo();

		renderFighter("player");
		renderFighter("enemy");
		renderMoveButtons();
		setMoveButtonsEnabled(true);

		appendBattleLog(`Tu Pokemon es ${battleState.player.displayName}.`);
		appendBattleLog(`Tu rival aleatorio es ${battleState.enemy.displayName}.`);
		appendBattleLog(`Limite de turnos: ${battleState.turnLimit}.`);
		setStatus("Combate iniciado. Tu turno.", "success");
	} catch (error) {
		console.error(error);
		resetBattleStateUi();
		setStatus(error.message || "No se pudo iniciar el combate.", "error");
	} finally {
		startingBattle = false;
		setStartButtonLoading(false);
	}
}

startBattleButton.addEventListener("click", () => {
	startBattle();
});

playerNameInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		startBattle();
	}
});

turnLimitInput.addEventListener("input", () => {
	updateTurnInfo();
});

movesContainer.addEventListener("click", (event) => {
	if (!(event.target instanceof Element)) {
		return;
	}

	const moveButton = event.target.closest("button[data-move-index]");
	if (!moveButton) {
		return;
	}

	const moveIndex = Number(moveButton.dataset.moveIndex);
	runPlayerTurn(moveIndex);
});

resetBattleStateUi();
setStatus("Ingresa un nombre de Pokemon para comenzar.");
