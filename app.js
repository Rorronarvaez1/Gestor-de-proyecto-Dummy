const POKEMON_ENDPOINT = "https://pokeapi.co/api/v2/pokemon";
const TYPE_ENDPOINT = "https://pokeapi.co/api/v2/type";

const statusElement = document.getElementById("status");
const resultsCountElement = document.getElementById("results-count");
const pokemonListElement = document.getElementById("pokemon-list");
const filterNameElement = document.getElementById("filter-name");
const filterIdElement = document.getElementById("filter-id");
const filterTypeElement = document.getElementById("filter-type");

let allPokemon = [];

function capitalize(text) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractIdFromUrl(url) {
	const urlParts = url.split("/").filter(Boolean);
	const idText = urlParts[urlParts.length - 1];
	return Number(idText);
}

function getPokemonImageUrl(id) {
	return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

async function fetchTotalPokemonCount() {
	const response = await fetch(`${POKEMON_ENDPOINT}?limit=1`);

	if (!response.ok) {
		throw new Error("No se pudo obtener el total de Pokémon.");
	}

	const payload = await response.json();
	return payload.count;
}

async function fetchPokemonIndex(totalCount) {
	const response = await fetch(`${POKEMON_ENDPOINT}?limit=${totalCount}&offset=0`);

	if (!response.ok) {
		throw new Error("No se pudo obtener la lista de Pokémon.");
	}

	const payload = await response.json();

	return payload.results
		.map((item) => {
			const pokemonId = extractIdFromUrl(item.url);

			return {
				id: pokemonId,
				name: item.name,
				types: [],
				imageUrl: getPokemonImageUrl(pokemonId),
			};
		})
		.sort((left, right) => left.id - right.id);
}

async function fetchPokemonTypeMap() {
	const typeIndexResponse = await fetch(TYPE_ENDPOINT);

	if (!typeIndexResponse.ok) {
		throw new Error("No se pudo obtener la lista de tipos.");
	}

	const typeIndexPayload = await typeIndexResponse.json();
	const typesToLoad = typeIndexPayload.results.filter(
		(typeEntry) => typeEntry.name !== "unknown" && typeEntry.name !== "shadow"
	);

	const typeDetails = await Promise.all(
		typesToLoad.map(async (typeEntry) => {
			const response = await fetch(typeEntry.url);

			if (!response.ok) {
				throw new Error(`No se pudo obtener el tipo ${typeEntry.name}.`);
			}

			return response.json();
		})
	);

	const typeMap = new Map();

	typeDetails.forEach((typeData) => {
		typeData.pokemon.forEach((pokemonEntry) => {
			const pokemonName = pokemonEntry.pokemon.name;

			if (!typeMap.has(pokemonName)) {
				typeMap.set(pokemonName, []);
			}

			typeMap.get(pokemonName).push(typeData.name);
		});
	});

	return typeMap;
}

function populateTypeFilter(pokemonList) {
	const typeSet = new Set();

	pokemonList.forEach((pokemon) => {
		pokemon.types.forEach((type) => {
			typeSet.add(type);
		});
	});

	const sortedTypes = Array.from(typeSet).sort((left, right) => left.localeCompare(right));

	filterTypeElement.innerHTML = '<option value="all">Todos</option>';

	sortedTypes.forEach((type) => {
		const option = document.createElement("option");
		option.value = type;
		option.textContent = capitalize(type);
		filterTypeElement.appendChild(option);
	});
}

function createPokemonCard(pokemon) {
	const card = document.createElement("article");
	card.className = "pokemon-card";

	const image = document.createElement("img");
	image.className = "pokemon-image";
	image.src = pokemon.imageUrl;
	image.alt = `Imagen de ${pokemon.name}`;
	image.loading = "lazy";
	image.addEventListener("error", () => {
		image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
	});

	const title = document.createElement("h2");
	title.textContent = capitalize(pokemon.name);

	const id = document.createElement("p");
	id.innerHTML = `<strong>ID:</strong> ${pokemon.id}`;

	const types = document.createElement("p");
	const typeText = pokemon.types.length > 0
		? pokemon.types.map((type) => capitalize(type)).join(", ")
		: "Sin tipo";
	types.innerHTML = `<strong>Tipo:</strong> ${typeText}`;

	card.appendChild(image);
	card.appendChild(title);
	card.appendChild(id);
	card.appendChild(types);

	return card;
}

function getFilteredPokemon() {
	const nameQuery = filterNameElement.value.trim().toLowerCase();
	const idQuery = filterIdElement.value.trim();
	const typeQuery = filterTypeElement.value;

	return allPokemon.filter((pokemon) => {
		const matchesName = nameQuery === "" || pokemon.name.includes(nameQuery);
		const matchesId = idQuery === "" || String(pokemon.id) === idQuery;
		const matchesType = typeQuery === "all" || pokemon.types.includes(typeQuery);

		return matchesName && matchesId && matchesType;
	});
}

function renderPokemonList(pokemonToRender) {
	pokemonListElement.innerHTML = "";

	const fragment = document.createDocumentFragment();

	pokemonToRender.forEach((pokemon) => {
		fragment.appendChild(createPokemonCard(pokemon));
	});

	pokemonListElement.appendChild(fragment);
	resultsCountElement.textContent = `Mostrando ${pokemonToRender.length} de ${allPokemon.length} Pokémon`;

	if (pokemonToRender.length === 0) {
		statusElement.textContent = "No hay resultados con esos filtros.";
	} else {
		statusElement.textContent = "";
	}
}

function applyFilters() {
	const filteredPokemon = getFilteredPokemon();
	renderPokemonList(filteredPokemon);
}

function setupFilterEvents() {
	filterNameElement.addEventListener("input", applyFilters);
	filterIdElement.addEventListener("input", applyFilters);
	filterTypeElement.addEventListener("change", applyFilters);
}

async function loadPokemonData() {
	try {
		statusElement.textContent = "Cargando lista completa de Pokémon...";

		const totalCount = await fetchTotalPokemonCount();
		const [pokemonIndex, pokemonTypeMap] = await Promise.all([
			fetchPokemonIndex(totalCount),
			fetchPokemonTypeMap(),
		]);

		allPokemon = pokemonIndex.map((pokemon) => ({
			...pokemon,
			types: (pokemonTypeMap.get(pokemon.name) || []).sort((left, right) => left.localeCompare(right)),
		}));

		populateTypeFilter(allPokemon);
		applyFilters();
	} catch (error) {
		console.error(error);
		statusElement.textContent = "No se pudo cargar la Pokédex.";
		resultsCountElement.textContent = "";
		pokemonListElement.innerHTML = "";
	}
}

setupFilterEvents();
loadPokemonData();
