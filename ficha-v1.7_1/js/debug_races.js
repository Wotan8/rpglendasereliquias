console.log("RACES object keys:", Object.keys(RACES));
Object.keys(RACES).forEach(r => {
    console.log("Race:", r, "Peculiarities count:", RACES[r] ? RACES[r].peculiaridades.length : 0);
});
