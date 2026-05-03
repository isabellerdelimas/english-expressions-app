const MAX_PLAYERS = 6;
const DEFAULT_QUESTION_TARGET = 10;

const hasDocument = typeof document !== "undefined";

const state = {
  allQuestions: [],
  queue: [],
  players: [],
  currentIndex: 0,
  streak: 0,
  answered: 0,
  missedIds: new Set(),
  roundMisses: [],
  resultView: "scores",
  locked: false,
  completed: false,
  selectedQuestionCount: 0,
};

const elements = {
  setupPanel: hasDocument ? document.querySelector("#setupPanel") : null,
  gamePanel: hasDocument ? document.querySelector("#gamePanel") : null,
  setupForm: hasDocument ? document.querySelector("#setupForm") : null,
  playerCount: hasDocument ? document.querySelector("#playerCount") : null,
  playerFields: hasDocument ? document.querySelector("#playerFields") : null,
  questionCount: hasDocument ? document.querySelector("#questionCount") : null,
  questionCountHint: hasDocument ? document.querySelector("#questionCountHint") : null,
  setupError: hasDocument ? document.querySelector("#setupError") : null,
  scoreValue: hasDocument ? document.querySelector("#scoreValue") : null,
  streakValue: hasDocument ? document.querySelector("#streakValue") : null,
  progressValue: hasDocument ? document.querySelector("#progressValue") : null,
  progressBar: hasDocument ? document.querySelector("#progressBar") : null,
  resultTabs: hasDocument ? document.querySelector("#resultTabs") : null,
  questionNumber: hasDocument ? document.querySelector("#questionNumber") : null,
  turnLabel: hasDocument ? document.querySelector("#turnLabel") : null,
  modeLabel: hasDocument ? document.querySelector("#modeLabel") : null,
  expressionText: hasDocument ? document.querySelector("#expressionText") : null,
  usageText: hasDocument ? document.querySelector("#usageText") : null,
  alternatives: hasDocument ? document.querySelector("#alternatives") : null,
  roundSummary: hasDocument ? document.querySelector("#roundSummary") : null,
  missedSummary: hasDocument ? document.querySelector("#missedSummary") : null,
  feedback: hasDocument ? document.querySelector("#feedback") : null,
  tipButton: hasDocument ? document.querySelector("#tipButton") : null,
  nextButton: hasDocument ? document.querySelector("#nextButton") : null,
  settingsButton: hasDocument ? document.querySelector("#settingsButton") : null,
  shuffleButton: hasDocument ? document.querySelector("#shuffleButton") : null,
  modeButtons: hasDocument ? document.querySelectorAll(".mode-button") : [],
};

async function loadQuestions() {
  try {
    const response = await fetch("data/english-expressions.json");
    if (!response.ok) {
      throw new Error("Could not load expressions.");
    }

    state.allQuestions = await response.json();
    initializeSetup();
  } catch (error) {
    elements.setupError.textContent = error.message;
    elements.setupError.classList.remove("hidden");
  }
}

function initializeSetup() {
  elements.playerCount.innerHTML = "";
  getPlayerCountOptions(state.allQuestions.length, MAX_PLAYERS).forEach((count) => {
    const option = document.createElement("option");
    option.value = count;
    option.textContent = `${count} player${count === 1 ? "" : "s"}`;
    elements.playerCount.append(option);
  });

  elements.playerCount.value = "1";
  renderPlayerFields();
  renderQuestionCountOptions();
}

function renderPlayerFields() {
  const existingNames = getEnteredPlayerNames();
  const playerCount = Number(elements.playerCount.value);
  elements.playerFields.innerHTML = "";

  for (let index = 0; index < playerCount; index += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "player-field";

    const label = document.createElement("label");
    label.htmlFor = `playerName${index}`;
    label.textContent = playerCount === 1 ? "Your name" : `Player ${index + 1}`;

    const input = document.createElement("input");
    input.id = `playerName${index}`;
    input.name = `playerName${index}`;
    input.type = "text";
    input.maxLength = 24;
    input.placeholder = index === 0 ? "You" : `Player ${index + 1}`;
    input.value = existingNames[index] || "";

    wrapper.append(label, input);
    elements.playerFields.append(wrapper);
  }
}

function renderQuestionCountOptions() {
  const playerCount = Number(elements.playerCount.value);
  const options = getQuestionCountOptions(state.allQuestions.length, playerCount);
  const previousValue = Number(elements.questionCount.value);

  elements.questionCount.innerHTML = "";
  options.forEach((count) => {
    const option = document.createElement("option");
    option.value = count;
    option.textContent = `${count} question${count === 1 ? "" : "s"}`;
    elements.questionCount.append(option);
  });

  const defaultCount = getDefaultQuestionCount(options, DEFAULT_QUESTION_TARGET);
  elements.questionCount.value = options.includes(previousValue) ? previousValue : defaultCount;

  const questionsEach = Number(elements.questionCount.value) / playerCount;
  elements.questionCountHint.textContent = `${questionsEach} turn${questionsEach === 1 ? "" : "s"} per player.`;
}

function handleSetupSubmit(event) {
  event.preventDefault();

  const playerCount = Number(elements.playerCount.value);
  const selectedQuestionCount = Number(elements.questionCount.value);

  if (!Number.isInteger(selectedQuestionCount) || selectedQuestionCount % playerCount !== 0) {
    showSetupError("Choose a question count that divides evenly between the players.");
    return;
  }

  state.players = buildPlayers(playerCount, getEnteredPlayerNames());
  state.selectedQuestionCount = selectedQuestionCount;
  elements.setupPanel.classList.add("hidden");
  elements.gamePanel.classList.remove("hidden");
  startPractice();
}

function startPractice() {
  state.currentIndex = 0;
  state.streak = 0;
  state.answered = 0;
  state.roundMisses = [];
  state.resultView = "scores";
  state.locked = false;
  state.completed = false;
  state.players = state.players.map((player) => ({ ...player, score: 0 }));

  const roundSize = getRoundSize(
    state.allQuestions.length,
    state.selectedQuestionCount || state.allQuestions.length,
    state.players.length,
  );
  state.queue = shuffle([...state.allQuestions]).slice(0, roundSize);
  elements.resultTabs.classList.add("hidden");
  updateResultTabs();
  renderQuestion();
}

function renderQuestion() {
  updateStats();
  elements.feedback.classList.remove("hidden");
  elements.tipButton.classList.remove("hidden");
  elements.nextButton.classList.remove("hidden");
  elements.roundSummary.classList.add("hidden");
  elements.roundSummary.innerHTML = "";
  elements.missedSummary.classList.add("hidden");
  elements.missedSummary.innerHTML = "";

  if (state.queue.length === 0) {
    elements.questionNumber.textContent = "No questions";
    elements.turnLabel.textContent = "";
    elements.modeLabel.textContent = "All expressions";
    elements.expressionText.textContent = "No expressions found";
    elements.usageText.textContent = "Check the JSON file and refresh the page.";
    elements.alternatives.innerHTML = "";
    elements.feedback.classList.add("hidden");
    elements.tipButton.disabled = true;
    elements.nextButton.disabled = true;
    return;
  }

  const question = getCurrentQuestion();
  state.locked = false;

  elements.tipButton.disabled = false;
  elements.nextButton.disabled = true;
  elements.nextButton.textContent = "Next";
  elements.questionNumber.textContent = `Question ${state.currentIndex + 1}`;
  elements.turnLabel.textContent = `${formatPossessive(getCurrentPlayer().name)} turn`;
  elements.modeLabel.textContent = "All expressions";
  elements.expressionText.textContent = question.expression;
  elements.usageText.textContent = question.usageExample;
  setFeedback("Choose the meaning that best matches the expression.", "");

  elements.alternatives.innerHTML = "";
  shuffle([...question.alternatives]).forEach((alternative) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = alternative;
    button.addEventListener("click", () => chooseAnswer(button, alternative));
    elements.alternatives.append(button);
  });
}

function chooseAnswer(button, alternative) {
  if (state.locked) return;

  const question = getCurrentQuestion();
  const currentPlayer = getCurrentPlayer();
  const isCorrect = alternative === question.correctAnswer;
  state.locked = true;
  state.answered += 1;

  if (isCorrect) {
    currentPlayer.score += 1;
    state.streak += 1;
    state.missedIds.delete(question.id);
    setFeedback(`Correct, ${currentPlayer.name}. ${question.tip}`, "success");
  } else {
    state.streak = 0;
    state.missedIds.add(question.id);
    state.roundMisses.push({
      question: question.expression,
      usageExample: question.usageExample,
      answerGiven: alternative,
      correctAnswer: question.correctAnswer,
      playerName: currentPlayer.name,
    });
    setFeedback(
      `Not quite, ${currentPlayer.name}. Correct answer: ${question.correctAnswer}. ${question.tip}`,
      "error",
    );
  }

  elements.alternatives.querySelectorAll(".answer-button").forEach((answerButton) => {
    answerButton.disabled = true;
    if (answerButton.textContent === question.correctAnswer) {
      answerButton.classList.add("correct");
    } else if (answerButton === button) {
      answerButton.classList.add("incorrect");
    }
  });

  elements.nextButton.disabled = false;
  elements.nextButton.textContent = state.answered >= state.queue.length ? "See results" : "Next";
  updateStats();
}

function showTip() {
  if (state.completed || state.queue.length === 0) return;

  const question = getCurrentQuestion();
  setFeedback(question.tip, "");
}

function nextQuestion() {
  if (state.queue.length === 0) return;

  if (state.answered >= state.queue.length) {
    showCompletedRound();
    return;
  }

  state.currentIndex += 1;
  renderQuestion();
}

function showCompletedRound() {
  state.completed = true;
  state.locked = true;
  state.currentIndex = state.queue.length - 1;

  const leaders = getLeaders(state.players);
  state.resultView = "scores";
  elements.resultTabs.classList.remove("hidden");
  updateResultTabs();
  renderScoresView(leaders);
  updateStats();
}

function renderScoresView(leaders = getLeaders(state.players)) {
  elements.questionNumber.textContent = "Round complete";
  elements.turnLabel.textContent = "";
  elements.modeLabel.textContent = "Scores";
  elements.expressionText.textContent = "Final scores";
  elements.usageText.textContent =
    leaders.length === 1
      ? `${leaders[0].name} wins with ${leaders[0].score} point${leaders[0].score === 1 ? "" : "s"}.`
      : `Tie game: ${leaders.map((player) => player.name).join(", ")}.`;
  elements.alternatives.innerHTML = "";
  elements.missedSummary.classList.add("hidden");
  elements.missedSummary.innerHTML = "";
  renderRoundSummary(leaders);
  elements.feedback.classList.add("hidden");
  elements.tipButton.classList.add("hidden");
  elements.nextButton.classList.add("hidden");
  elements.nextButton.textContent = "Finished";
}

function renderRoundSummary(leaders) {
  const leaderNames = new Set(leaders.map((player) => player.name));
  elements.roundSummary.innerHTML = "";
  elements.roundSummary.classList.remove("hidden");

  [...state.players]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .forEach((player) => {
      const row = document.createElement("div");
      row.className = leaderNames.has(player.name) ? "score-row winner" : "score-row";

      const name = document.createElement("span");
      name.textContent = player.name;

      const score = document.createElement("span");
      score.textContent = `${player.score}/${getTurnsPerPlayer()}`;

      row.append(name, score);
      elements.roundSummary.append(row);
    });
}

function renderMissedView() {
  elements.questionNumber.textContent = "Round complete";
  elements.turnLabel.textContent = "";
  elements.modeLabel.textContent = "Missed";
  elements.expressionText.textContent = "Missed answers";
  elements.usageText.textContent =
    state.roundMisses.length === 0
      ? "No missed answers this round."
      : `${state.roundMisses.length} missed answer${state.roundMisses.length === 1 ? "" : "s"} this round.`;
  elements.alternatives.innerHTML = "";
  elements.roundSummary.classList.add("hidden");
  elements.roundSummary.innerHTML = "";
  elements.feedback.classList.add("hidden");
  elements.tipButton.classList.add("hidden");
  elements.nextButton.classList.add("hidden");
  renderMissedSummary();
}

function renderMissedSummary() {
  elements.missedSummary.innerHTML = "";
  elements.missedSummary.classList.remove("hidden");

  if (state.roundMisses.length === 0) {
    const row = document.createElement("div");
    row.className = "missed-row";
    row.textContent = "Perfect round. Nothing to review here.";
    elements.missedSummary.append(row);
    return;
  }

  state.roundMisses.forEach((miss) => {
    const row = document.createElement("div");
    row.className = "missed-row";

    const question = document.createElement("div");
    question.className = "missed-question";

    const title = document.createElement("strong");
    title.textContent = miss.question;

    const prompt = document.createElement("p");
    prompt.textContent = miss.usageExample;

    question.append(title, prompt);

    const details = document.createElement("div");
    details.className = "missed-detail-grid";
    details.append(
      createMissedDetail("Player", miss.playerName),
      createMissedDetail("Answer given", miss.answerGiven),
      createMissedDetail("Correct answer", miss.correctAnswer),
    );

    row.append(question, details);
    elements.missedSummary.append(row);
  });
}

function createMissedDetail(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "missed-detail";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("p");
  valueElement.textContent = value;

  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function updateStats() {
  const answered = Math.min(state.answered, state.queue.length);
  const currentPlayer = state.players.length > 0 ? getCurrentPlayer() : null;

  elements.scoreValue.textContent = currentPlayer ? currentPlayer.score : 0;
  elements.streakValue.textContent = state.streak;
  elements.progressValue.textContent = `${answered}/${state.queue.length}`;

  const progress = state.queue.length ? (answered / state.queue.length) * 100 : 0;
  elements.progressBar.style.width = `${progress}%`;
}

function updateResultTabs() {
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.resultView);
  });
}

function showResultView(view) {
  if (!state.completed) return;

  state.resultView = view;
  updateResultTabs();

  if (view === "missed") {
    renderMissedView();
  } else {
    renderScoresView();
  }
}

function showSetupPanel() {
  state.currentIndex = 0;
  state.streak = 0;
  state.answered = 0;
  state.roundMisses = [];
  state.resultView = "scores";
  state.locked = false;
  state.completed = false;
  state.queue = [];
  state.players = [];

  elements.gamePanel.classList.add("hidden");
  elements.setupPanel.classList.remove("hidden");
  elements.resultTabs.classList.add("hidden");
  elements.feedback.classList.add("hidden");
  elements.tipButton.classList.remove("hidden");
  elements.nextButton.classList.remove("hidden");
  elements.progressBar.style.width = "0%";
  elements.scoreValue.textContent = "0";
  elements.streakValue.textContent = "0";
  elements.progressValue.textContent = "0/0";
  renderPlayerFields();
  renderQuestionCountOptions();
}

function getCurrentQuestion() {
  return state.queue[state.currentIndex];
}

function getCurrentPlayer() {
  return state.players[state.currentIndex % state.players.length];
}

function getTurnsPerPlayer() {
  return state.players.length > 0 ? state.queue.length / state.players.length : 0;
}

function getEnteredPlayerNames() {
  return [...elements.playerFields.querySelectorAll("input")].map((input) => input.value.trim());
}

function buildPlayers(playerCount, names) {
  return Array.from({ length: playerCount }, (_, index) => ({
    name: names[index] || (playerCount === 1 && index === 0 ? "You" : `Player ${index + 1}`),
    score: 0,
  }));
}

function getPlayerCountOptions(totalQuestions, maxPlayers) {
  return Array.from({ length: Math.min(totalQuestions, maxPlayers) }, (_, index) => index + 1);
}

function getQuestionCountOptions(totalQuestions, playerCount) {
  return Array.from({ length: Math.floor(totalQuestions / playerCount) }, (_, index) => {
    return (index + 1) * playerCount;
  });
}

function getDefaultQuestionCount(options, target) {
  return options.find((count) => count >= target) || options[options.length - 1] || 0;
}

function getRoundSize(totalAvailable, selectedQuestionCount, playerCount) {
  const requested = Math.min(totalAvailable, selectedQuestionCount);
  return requested - (requested % playerCount);
}

function getLeaders(players) {
  const highestScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === highestScore);
}

function formatPossessive(name) {
  if (name.toLowerCase() === "you") return "Your";
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function showSetupError(message) {
  elements.setupError.textContent = message;
  elements.setupError.classList.remove("hidden");
}

function setFeedback(message, type) {
  elements.feedback.textContent = message;
  elements.feedback.className = type ? `feedback ${type}` : "feedback";
}

function shuffle(items) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

if (hasDocument) {
  elements.setupForm.addEventListener("submit", handleSetupSubmit);
  elements.playerCount.addEventListener("change", () => {
    renderPlayerFields();
    renderQuestionCountOptions();
  });
  elements.questionCount.addEventListener("change", renderQuestionCountOptions);
  elements.nextButton.addEventListener("click", nextQuestion);
  elements.tipButton.addEventListener("click", showTip);
  elements.settingsButton.addEventListener("click", showSetupPanel);
  elements.shuffleButton.addEventListener("click", startPractice);
  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => showResultView(button.dataset.view));
  });

  loadQuestions();
}

if (typeof module !== "undefined") {
  module.exports = {
    buildPlayers,
    getDefaultQuestionCount,
    getLeaders,
    getRoundSize,
    formatPossessive,
    getPlayerCountOptions,
    getQuestionCountOptions,
  };
}
