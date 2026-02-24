const POKEMON_URL = "https://pokeapi.co/api/v2/pokemon/dragapult";

const statusElement = document.getElementById("status");
const nameElement = document.getElementById("pokemon-name");
const imageElement = document.getElementById("pokemon-image");

async function loadPokemon() {
	try {
		const response = await fetch(POKEMON_URL);

		if (!response.ok) {
			throw new Error("Failed to load Pokémon data");
		}

		const pokemon = await response.json();
		const imageUrl = pokemon.sprites.front_default;

		nameElement.textContent = pokemon.name;
		imageElement.src = imageUrl;
		imageElement.hidden = false;
		statusElement.textContent = "";
	} catch (error) {
		statusElement.textContent = "Could not load Pokémon.";
		nameElement.textContent = "";
		imageElement.hidden = true;
	}
}

loadPokemon();
