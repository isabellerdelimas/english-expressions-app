const state = {
  allQuestions: [],
  queue: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  answered: 0,
  missedIds: new Set(),
  mode: "all",
  locked: false,
};

const elements = {
  scoreValue: document.querySelector("#scoreValue"),
  streakValue: document.querySelector("#streakValue"),
  progressValue: document.querySelector("#progressValue"),
  progressBar: document.querySelector("#progressBar"),
  questionNumber: document.querySelector("#questionNumber"),
  modeLabel: document.querySelector("#modeLabel"),
  expressionText: document.querySelector("#expressionText"),
  usageText: document.querySelector("#usageText"),
  alternatives: document.querySelector("#alternatives"),
  feedback: document.querySelector("#feedback"),
  tipButton: document.querySelector("#tipButton"),
  nextButton: document.querySelector("#nextButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  modeButtons: document.querySelectorAll(".mode-button"),
};

async function loadQuestions() {
  try {
    const response = await fetch("data/english-expressions.json");
    if (!response.ok) {
      throw new Error("Could not load expressions.");
    }

    state.allQuestions = await response.json();
    startPractice("all");
  } catch (error) {
    elements.expressionText.textContent = "Could not load practice data";
    elements.usageText.textContent = error.message;
  }
}

function startPractice(mode) {
  state.mode = mode;
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.answered = 0;
  state.locked = false;

  const source =
    mode === "missed"
      ? state.allQuestions.filter((question) => state.missedIds.has(question.id))
      : state.allQuestions;

  state.queue = shuffle([...source]);
  updateModeButtons();
  renderQuestion();
}

function renderQuestion() {
  updateStats();

  if (state.queue.length === 0) {
    elements.questionNumber.textContent = "No questions";
    elements.modeLabel.textContent = state.mode === "missed" ? "Missed expressions" : "All expressions";
    elements.expressionText.textContent =
      state.mode === "missed" ? "No missed expressions yet" : "No expressions found";
    elements.usageText.textContent =
      state.mode === "missed"
        ? "Answer a few questions in All mode, then come back here to review mistakes."
        : "Check the JSON file and refresh the page.";
    elements.alternatives.innerHTML = "";
    setFeedback("Your review list is clear.", "");
    elements.tipButton.disabled = true;
    elements.nextButton.disabled = true;
    return;
  }

  const question = getCurrentQuestion();
  state.locked = false;

  elements.tipButton.disabled = false;
  elements.nextButton.disabled = true;
  elements.questionNumber.textContent = `Question ${state.currentIndex + 1}`;
  elements.modeLabel.textContent = state.mode === "missed" ? "Missed expressions" : "All expressions";
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
  const isCorrect = alternative === question.correctAnswer;
  state.locked = true;
  state.answered += 1;

  if (isCorrect) {
    state.score += 1;
    state.streak += 1;
    state.missedIds.delete(question.id);
    setFeedback(`Correct. ${question.tip}`, "success");
  } else {
    state.streak = 0;
    state.missedIds.add(question.id);
    setFeedback(`Not quite. Correct answer: ${question.correctAnswer}. ${question.tip}`, "error");
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
  updateStats();
}

function showTip() {
  const question = getCurrentQuestion();
  setFeedback(question.tip, "");
}

function nextQuestion() {
  if (state.queue.length === 0) return;

  state.currentIndex += 1;
  if (state.currentIndex >= state.queue.length) {
    state.currentIndex = 0;
    state.queue = shuffle([...state.queue]);
  }

  renderQuestion();
}

function updateStats() {
  elements.scoreValue.textContent = state.score;
  elements.streakValue.textContent = state.streak;
  elements.progressValue.textContent = `${state.answered}/${state.queue.length}`;

  const progress = state.queue.length ? Math.min((state.answered / state.queue.length) * 100, 100) : 0;
  elements.progressBar.style.width = `${progress}%`;
}

function updateModeButtons() {
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });
}

function getCurrentQuestion() {
  return state.queue[state.currentIndex];
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

elements.nextButton.addEventListener("click", nextQuestion);
elements.tipButton.addEventListener("click", showTip);
elements.shuffleButton.addEventListener("click", () => startPractice(state.mode));
elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => startPractice(button.dataset.mode));
});

loadQuestions();
