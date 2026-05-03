const assert = require("node:assert/strict");

const {
  buildPlayers,
  formatPossessive,
  getDefaultQuestionCount,
  getLeaders,
  getPlayerCountOptions,
  getQuestionCountOptions,
  getRoundSize,
} = require("../app.js");

assert.deepEqual(getPlayerCountOptions(150, 6), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(getPlayerCountOptions(3, 6), [1, 2, 3]);

assert.deepEqual(getQuestionCountOptions(10, 1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(getQuestionCountOptions(10, 3), [3, 6, 9]);
assert.equal(getDefaultQuestionCount(getQuestionCountOptions(10, 1), 4), 4);
assert.equal(getDefaultQuestionCount(getQuestionCountOptions(10, 3), 4), 6);
assert.equal(getRoundSize(150, 6, 3), 6);
assert.equal(getRoundSize(5, 6, 3), 3);
assert.equal(getRoundSize(2, 6, 3), 0);

assert.deepEqual(buildPlayers(1, [""]), [{ name: "You", score: 0 }]);
assert.deepEqual(buildPlayers(3, ["Ana", "", "Mia"]), [
  { name: "Ana", score: 0 },
  { name: "Player 2", score: 0 },
  { name: "Mia", score: 0 },
]);

assert.deepEqual(
  getLeaders([
    { name: "Ana", score: 1 },
    { name: "Bia", score: 3 },
    { name: "Cam", score: 3 },
  ]).map((player) => player.name),
  ["Bia", "Cam"],
);

assert.equal(formatPossessive("You"), "Your");
assert.equal(formatPossessive("Ana"), "Ana's");
assert.equal(formatPossessive("James"), "James'");

console.log("multiplayer helper tests passed");
