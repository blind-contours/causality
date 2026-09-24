/* Transfer problems use new numbers, not the displayed worked example. */
(function () {
  const bank = {
    "causal-roadmap": (n) => [
      {
        q: `Treatment benefits are 1 for low severity and 3 for high severity. High severity is ${n * 10}% of everyone. What is the population ATE?`,
        a: 1 + (2 * n) / 10,
        h: "Average the two effects using everyone's severity proportions.",
      },
      {
        q: "Benefits are 2 in low severity and 6 in high severity. High severity is 20% of everyone, but 70% of treated people. What is the ATT?",
        a: 4.8,
        h: "ATT follows the actually treated people into both worlds: use 0.3 × 2 + 0.7 × 6.",
      },
      {
        q: "Benefits are 1 in low severity and 4 in high severity. High severity is 60% of treated people and 20% of untreated people. What is the ATC?",
        a: 1.6,
        h: "ATC uses the untreated population's composition: 0.8 × 1 + 0.2 × 4.",
      },
      {
        q: "For the same population at one year, event risk is 12% under treatment and 18% under control. What is treatment minus control in percentage points?",
        a: -6,
        h: "Subtract 12 − 18. The answer is in percentage points, not a proportional percentage change.",
      },
      {
        q: "For the same population at one year, event risk is 6% under treatment and 8% under control. What is the risk ratio, treatment divided by control?",
        a: .75,
        h: "Divide 0.06 by 0.08. A ratio has no probability or time units.",
      },
      {
        q: "The survival difference is 0.1 throughout year 0–1 and 0.2 throughout year 1–3 (values at the endpoints do not change the area). What is the RMST difference through year 3, in years?",
        a: .5,
        h: "Add the signed areas: 0.1 × 1 + 0.2 × 2. The vertical gap at year 3 is a different quantity.",
      },
    ][(n - 2) % 6],
    "canonical-gradient": (n) => ({
      q: `Move probability ${n / 100} from outcome −1 to outcome 2, leaving other masses fixed. How much does the mean change?`,
      a: (3 * n) / 100,
      h: "The increase is (destination − origin) × mass moved.",
    }),
    "mean-along-a-path": (n) => ({
      q: `Outcomes are 0 and ${n}, each with probability ½. A path moves ε mass from the first to the second. What is dΨ/dε?`,
      a: n,
      h: "Differentiate 0·(½−ε) + z·(½+ε).",
    }),
    "scores-from-scratch": (n) => ({
      q: `Two bins have equal probability. The first score value is ${n}. What must the second be to conserve probability?`,
      a: -n,
      h: "The probability-weighted mean score must be zero.",
    }),
    "under-the-integral": (n) => ({
      q: `Three bins contribute slopes ${n}, −2 and 1. What is the slope of their total?`,
      a: n - 1,
      h: "For a finite sum, add the individual derivatives.",
    }),
    "one-step-estimator": (n) => ({
      q: `A plug-in estimate is 2.5. The sample mean of its fitted influence function is −${n / 10}. What is the one-step estimate?`,
      a: 2.5 - n / 10,
      h: "Add the signed empirical correction to the plug-in.",
    }),
    "one-move-two-faces": (n) => ({
      q: `A Gaussian has mean 1 and variance 2. Tilt it by exp(εH(y−1)), with ε=0.1 and H=${n}. What is the new mean?`,
      a: 1 + 0.2 * n,
      h: "Completing the square gives μ + εHσ². The variance matters.",
    }),
    "two-strata": (n) => ({
      q: `Two equally common strata have treatment probabilities 0.1 and 0.${n}. For a treated-mean target, what is H(first) / H(second)?`,
      a: n,
      h: "H=1/g for a treated observation; the ratio reverses the propensities.",
    }),
    "clever-covariate": (n) => ({
      q: `For the ATE, a CONTROL patient has treatment probability 0.${n}. What is H=A/g−(1−A)/(1−g)?`,
      a: -1 / (1 - n / 10),
      h: "For a control patient, A=0. Keep the minus sign.",
    }),
    "four-patients": (n) => ({
      q: `A targeting fit has ΣHr=${n} and ΣH²=20. What is its least-squares fluctuation coefficient?`,
      a: n / 20,
      h: "This is regression through the origin: numerator divided by denominator.",
    }),
    "inference-lab": (n) => ({
      q: `Outcome error is n⁻⁰·³ and propensity error is n⁻⁰·${n}. What is the exponent of √n times their product? Enter 0.5 minus the two rates.`,
      a: 0.5 - 0.3 - n / 10,
      h: "The scaled remainder is n^(0.5−α−β). A negative exponent vanishes.",
    }),
    "efficiency-theory-story": (n) => ({
      q: `A gradient decomposes into orthogonal canonical and extra components with squared norms ${n} and 2. What is its total variance?`,
      a: n + 2,
      h: "Use the probability-weighted Pythagorean identity.",
    }),
    "survival-lab": (n) => ({
      q: `For everyone treated, survival is 1 during year 0–1 and 0.${n} during year 1–2. What is RMST through 2 years?`,
      a: 1 + n / 10,
      h: "RMST is the area under the survival curve; add the two rectangles.",
    }),
    "interference-lab": (n) => ({
      q: `Spillover strength γ is 0.${n}. A unit with three neighbours goes from one treated neighbour to all three, with its own treatment fixed. By how much does its outcome change?`,
      a: (n / 10) * (2 / 3),
      h: "Neighbour exposure rises from 1/3 to 1: multiply γ by the change in exposure, 2/3.",
    }),
    "experiment-design-lab": (n) => ({
      q: `A switchback uses 30-minute blocks and a ${n}-minute washout after each switch. With uniform arrivals, what fraction of each block's requests is excluded from the analysis? Enter a decimal.`,
      a: n / 30,
      h: "Excluded minutes over block minutes. Deleting them changes the analysed population, not the fleet state.",
    }),
    "marketplace-decision-lab": (n) => ({
      q: `In the benchmark y = μ + δ·z_t + ρ·z_{t−1} + e with blocks of length L = ${n + 4} and no washout, the block-mean estimator of δ + ρ has expected bias −ρ/L. With ρ = 0.06, what is the bias?`,
      a: -0.06 / (n + 4),
      h: "Only the first period of each block sees the previous block's policy, so a fraction 1/L of the carryover is lost.",
    }),
  };
  window.CausalPractice = {
    bank,
    mount(el, id, api) {
      let variant = 0;
      const saved = api.state().units[id]?.exercises.transfer;
      if (saved) variant = Number(saved.variant) || 0;
      el.className = "practice";
      el.innerHTML =
        '<h2>Try a new case</h2><p class="question"></p><label>Your answer <input class="answer" inputmode="decimal" type="text" autocomplete="off"></label><div class="btns"><button class="check">Check reasoning</button><button class="hint">Hint</button><button class="reveal">Worked solution</button><button class="new-case">New case</button></div><p class="feedback" role="status"></p><label>Explain it to a colleague <textarea class="explain" rows="2" placeholder="What moves, what stays fixed, and why?"></textarea></label><p class="note">The numerical check is automatic. Your explanation is saved for reflection; it is not automatically graded. After a hint or solution, try a new case independently.</p>';
      const input = el.querySelector(".answer"),
        feedback = el.querySelector(".feedback"),
        explain = el.querySelector(".explain");
      let problem;
      const create = () => {
        const n = 2 + (variant % 6);
        problem = (bank[id] || bank["canonical-gradient"])(n);
        el.querySelector(".question").textContent = problem.q;
        input.value = "";
        feedback.textContent = "";
      };
      create();
      if (saved) input.value = saved.answer ?? "";
      const key = "explain-" + id;
      try {
        explain.value = localStorage.getItem("causality." + key) || "";
      } catch {}
      explain.oninput = () => {
        try {
          localStorage.setItem("causality." + key, explain.value);
        } catch {}
      };
      const emit = (correct, assisted = false) =>
        api.event({
          type: "exercise",
          unit: id,
          id: "transfer",
          variant,
          answer: input.value,
          correct,
          assisted,
          transfer: true,
        });
      el.querySelector(".check").onclick = () => {
        const number = Number(input.value.trim().replace(",", ".")),
          correct =
            input.value.trim() !== "" &&
            Number.isFinite(number) &&
            Math.abs(number - problem.a) < 0.011;
        emit(correct);
        feedback.textContent = correct
          ? "Correct. Explain why this works, then carry that reasoning into the next lesson."
          : "Try again. Identify the quantity being averaged or changed; keep its sign and units.";
      };
      el.querySelector(".hint").onclick = () => {
        emit(false, true);
        feedback.textContent = problem.h;
      };
      el.querySelector(".reveal").onclick = () => {
        emit(false, true);
        feedback.textContent =
          problem.h +
          " Answer: " +
          Number(problem.a.toFixed(4)) +
          ". Try New case to demonstrate it without the solution.";
      };
      el.querySelector(".new-case").onclick = () => {
        variant++;
        create();
        input.focus();
        emit(false);
      };
    },
  };
})();
