# External review and learner evaluation

Status: protocol ready; no participants recruited and no effectiveness claims established.

## Mathematical review packet

Give an independent semiparametric-methods reviewer the new geometry laboratory, inference laboratory, `science/core.js`, invariant tests and the original review. Ask for written checks of:

1. The finite model, tangent and nuisance spaces, inner-product coordinates, projection and scope of the efficiency claim.
2. The derivative/remainder sign convention and both-arm ATE expansion.
3. Known-propensity ATE statements at the same law; ATT differences.
4. Product-rate and cross-fitting conditions, including inference under one misspecified fitted nuisance.
5. Local versus universal targeting, Gaussian equality counterexample, binary fluctuation and separation.
6. Survival identification, censoring support, risk-set interpretation and the distinction between generator HR and fitted estimators.

Track each objection as: exact page/scene, claim, counterexample or reference, correction, test, and reviewer disposition. Automated tests are not a substitute for this review.

## Formative study

Recruit applied statisticians who routinely use KM/Cox, causal-methods learners and experienced theorists. An initial small think-aloud sample is for discovering misunderstandings, not estimating a learning effect. Obtain appropriate participant consent and permission before collecting recordings or identifiable information. No recruitment messages are sent by this package.

Session tasks (45–60 minutes, adjustable after piloting):

- Before instruction, ask for an estimand contract and explanations of a score, nuisance direction and influence function.
- In the estimand explorer, ask why ATE and ATT differ with heterogeneous effects, then equalize the effects. Ask the learner to keep the selected people fixed across both worlds. Use a new event-risk pair to distinguish percentage points from a risk ratio, and a new survival horizon to distinguish a vertical gap from a signed area. Check whether saved questions and later worked-example targets are distinguishable.
- Observe the roadmap and geometry steps without giving the mathematical terms first. Ask learners to predict a movement before touching controls.
- Have them construct sensitivities for a new three-outcome distribution and explain why their values work for every allowed direction.
- Restrict a different probability, and ask whether the bound must fall strictly.
- Return to KM/Cox: select survival probability or RMST, identify censoring and treatment assumptions, and explain why a hazard ratio answers a different question.
- End with a short paper excerpt containing “canonical gradient” and “tangent space”; ask the learner to translate the words into their construction.

Record misconceptions, hints needed, points of notation overload, control discoverability, view correspondence and accessibility barriers. Preserve incorrect predictions; do not equate clicks or completion with learning.

## Immediate and delayed transfer

Use unseen outcomes/probabilities, a new nuisance direction, different convergence rates and an altered censoring mechanism. Reassess after 3–7 days. If comparing versions, randomize assignment where practical, equalize study time and materials, prespecify outcomes and scoring, and report uncertainty rather than declaring success from a small sample.

Rubric per explanation (0–3):

- 0: incorrect or absent causal/mathematical relationship.
- 1: recalls a formula or term but cannot justify it in the new setting.
- 2: correct operation with a partly incomplete explanation of assumptions or geometry.
- 3: correct operation, explanation, assumptions and an appropriate counterexample or limitation.

Primary outcomes: reasoning on unseen tasks, misconception rates, delayed retention. Secondary: confidence calibration, perceived load, task time, and navigation failures. Have two raters independently score a subset and resolve disagreements before interpreting differences.

## Accessibility sessions

Test keyboard-only use, screen readers, 200–400% zoom, narrow viewports, light/dark themes, high contrast and reduced motion. Ask users to explain the direction and orthogonality relationships using descriptions and tables alone. A label transcript may expose numbers without communicating spatial relationships; fix those gaps scene by scene.
