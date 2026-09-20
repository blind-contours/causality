# Scientific and learning-design references

The experiments are teaching models, not validated clinical tools. Mathematical identities are tested in code. External expert review and learning outcomes remain separate acceptance gates.

## Semiparametric and causal theory

- [Kennedy, Semiparametric theory (2017)](https://arxiv.org/pdf/1709.06418): tangent spaces, projection, influence functions and the ATE. The finite-probability laboratory supplies exact numbers for those geometric relationships.
- [Hines et al., Demystifying statistical learning based on efficient influence functions](https://arxiv.org/html/2107.00681v3): pathwise derivatives and efficient influence-function reasoning. Point-mass calculations in continuous models are qualified as formal devices.
- [Hahn (1998)](https://doi.org/10.2307/2998560): propensity-score information and semiparametric efficiency. The course distinguishes ATE from ATT and compares bounds at the same law.
- [van der Laan and Gruber, One-Step Targeted Minimum Loss-Based Estimation Based on Universal Least Favorable One-Dimensional Submodels](https://pmc.ncbi.nlm.nih.gov/articles/PMC4912007/): distinguishes a universal submodel from iterated local fluctuations. The Gaussian laboratory implements the latter, explicitly.
- [Targeted learning roadmap](https://onlinelibrary.wiley.com/doi/10.1155/2014/502678): question, model, identification, estimation, inference and interpretation.
- [Schuler and van der Laan, Introduction to Modern Causal Inference](https://alejandroschuler.github.io/mci/introduction-to-modern-causal-inference.html): supplementary derivations and geometric framing.
- [Kaplan and Meier (1958)](https://www.tandfonline.com/doi/abs/10.1080/01621459.1958.10501452), [Cox (1972)](https://rss.onlinelibrary.wiley.com/doi/10.1111/j.2517-6161.1972.tb00899.x), and [Hernán, The hazards of hazard ratios](https://pmc.ncbi.nlm.nih.gov/articles/PMC3653612/): connect familiar survival methods to their targets and assumptions.

## Learning design and the implementation it motivates

| Evidence / framework | Design choice in this course | What still needs testing |
|---|---|---|
| [Chi and Wylie, ICAP (2014)](https://education.asu.edu/sites/g/files/litvpz656/files/lcl/chiwylie2014icap_2.pdf) | Construct sensitivity values and explain why; separate exploration from successful transfer checks | Whether learners generate explanations rather than merely copy numbers |
| [Mayer and Moreno, reducing cognitive load (2003)](https://anenadic.github.io/instructor-training/files/papers/mayer-reduce-cognitive-load-2003.pdf) | Guided stages, nearby symbol keys, controllable playback | Whether the pacing and amount of notation fit the intended audience |
| [Ainsworth, DeFT (2006)](https://doi.org/10.1016/j.learninstruc.2006.03.001) | Linked mass, path, score and geometry representations share one mathematical state | Whether learners understand correspondence between views |
| [Fyfe et al., concreteness fading (2014)](https://doi.org/10.1007/s10648-014-9249-3) | Three outcomes precede L² notation and an abstract canonical gradient | Whether the finite picture transfers without implying that all models are 3D |
| [Roediger and Karpicke, test-enhanced learning (2006)](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/) | New-case transfer tasks, prior-lesson recall, delayed retrieval reminders | Retention and transfer after several days |
| [Tversky, Morrison and Bétrancourt, animation](https://www.tc.columbia.edu/faculty/bt2158/faculty-profile/files/_Morrison_Betrancourt_AnimationCanitfacilitate.pdf) | Scrubbing, pause, steps, reduced motion, exact numerical alternatives | Whether motion improves explanation rather than attracting attention alone |
| [PhET interaction design](https://arxiv.org/abs/1306.6544) and [Seeing Theory](https://seeing-theory.brown.edu/) | Immediate feedback, small control sets and mathematical affordances | The right balance of exploration and guidance for advanced applied statisticians |

These sources motivate design hypotheses; they do not establish that this implementation is effective. Step lengths are not advertised as measured completion times. The course does not grade free-text explanations with an unvalidated automated rubric.

## Accessibility and rendering

[W3C guidance on complex images](https://www.w3.org/WAI/tutorials/images/complex/) informs figure descriptions and numerical alternatives. New SVG laboratories pair visuals with tables. Legacy canvases retain readable native sizes in keyboard-scrollable panels and provide descriptions, captions and live-generated label transcripts. This is not a claim of complete screen-reader equivalence or WCAG conformance; test relationships, reading order and controls with assistive-technology users.

[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) keep repeated simulation off the main UI thread. Seeds, run configurations, Monte Carlo errors and CSV exports make numerical claims inspectable.
