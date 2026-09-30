/* For your trial: the words and code that travel into the organization. Pure string builders, no DOM.
 * Every function takes the page state `s` and (where needed) the planning result from CausalTrial.plan
 * and the operating characteristics from CausalTrial.ocRunner(...).results().
 * House style: no em dashes; plain regulatory English; claims tied to a named source. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalTrialSAP = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const STRATEGIES = {
    "treatment-policy": {
      label: "Treatment policy",
      sentence: "The endpoint is used as observed whether or not the event occurs; the event is part of the treatment condition being compared.",
      data: "Outcome data should continue to be collected after the event (retrieved data), because the estimand includes those outcomes.",
    },
    hypothetical: {
      label: "Hypothetical",
      sentence: "The estimand targets the outcome that would have been observed had the event not occurred.",
      data: "This requires an additional, prespecified method (for example multiple imputation or inverse probability weighting under stated assumptions) and a sensitivity analysis for those assumptions.",
    },
    composite: {
      label: "Composite",
      sentence: "Occurrence of the event is incorporated into the endpoint (for example, counted as a treatment failure).",
      data: "The endpoint definition in Section 1 must state exactly how the event enters the variable.",
    },
    "while-on-treatment": {
      label: "While on treatment",
      sentence: "The endpoint is the response observed before the event occurs.",
      data: "The endpoint then describes a different time window for different participants, which should be justified clinically.",
    },
    "principal-stratum": {
      label: "Principal stratum",
      sentence: "The estimand targets the subpopulation in whom the event would not occur under either treatment.",
      data: "This stratum is not observed directly; the method and its assumptions must be prespecified and accompanied by sensitivity analyses.",
    },
  };

  const MEASURE_WORDS = {
    md: { name: "difference in means", short: "mean difference", ratio: false },
    rd: { name: "risk difference", short: "risk difference", ratio: false },
    rr: { name: "risk ratio", short: "risk ratio", ratio: true },
    or: { name: "odds ratio", short: "odds ratio", ratio: true },
  };

  function list(text) {
    return String(text || "")
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 16);
  }
  /* A safe R/SAS-style name for a covariate label. */
  function varName(label) {
    let v = String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!v) v = "x";
    if (/^[0-9]/.test(v)) v = "x_" + v;
    return v;
  }
  const joinWords = (xs) =>
    xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
  const pct = (p, d = 0) => `${(100 * p).toFixed(d)}%`;
  const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "not available");
  const ratioText = (r) => (r === 1 ? "1:1" : `${r}:1`);

  function measureOf(s) {
    return s.endpoint === "continuous" ? "md" : s.measure === "md" ? "rd" : s.measure || "rd";
  }
  function effectText(s) {
    const m = measureOf(s);
    if (m === "md") return `a difference in means of ${s.delta} (SD ${s.sd})`;
    const p0 = +s.p0,
      p1 = +s.p1;
    const eff =
      m === "rd" ? `a risk difference of ${fmt(p1 - p0, 3)}` : m === "rr" ? `a risk ratio of ${fmt(p1 / p0, 2)}` : `an odds ratio of ${fmt((p1 / (1 - p1)) / (p0 / (1 - p0)), 2)}`;
    return `${eff} (${pct(p1, 1)} versus ${pct(p0, 1)})`;
  }

  /* ---------- Estimand ---------- */
  function estimand(s) {
    const m = measureOf(s),
      events = (s.events || []).filter((e) => e && e.name && e.name.trim());
    return {
      population: s.population || "Participants meeting the protocol eligibility criteria",
      treatment: `${s.treatment || "Investigational treatment"} versus ${s.control || "control"}`,
      variable: `${s.endpointName || "Primary endpoint"}${s.timepoint ? ` at ${s.timepoint}` : ""}${s.endpoint === "binary" ? " (binary)" : ""}`,
      events: events.map((e) => ({ name: e.name.trim(), strategy: e.strategy, ...STRATEGIES[e.strategy] })),
      summary:
        m === "md"
          ? `The unconditional (marginal) difference in means: the average outcome if every participant in the population received ${s.treatment || "the investigational treatment"}, minus the average if every participant received ${s.control || "control"}.`
          : `The unconditional (marginal) ${MEASURE_WORDS[m].name} comparing the probability of the endpoint if every participant in the population received ${s.treatment || "the investigational treatment"} with the probability if every participant received ${s.control || "control"}.`,
    };
  }

  /* ---------- SAP text (Markdown) ---------- */
  function sap(s, plan, oc) {
    const m = measureOf(s),
      mw = MEASURE_WORDS[m],
      e = estimand(s),
      covs = list(s.covariates),
      strata = list(s.strata),
      device = s.product === "device",
      alpha = +s.alpha,
      level = pct(1 - alpha, 0),
      L = [];
    const title = s.trialName ? `${s.trialName}: ` : "";
    L.push(`# ${title}Primary efficacy analysis (draft SAP section)`);
    L.push("");
    L.push(
      `_Draft generated by Causality, For your trial. It is a starting point for the trial statistician, not regulatory advice. Confirm the approach with the ${device ? "CDRH review team (for example through a Q-Submission)" : "relevant FDA review division"} before finalizing._`,
    );
    L.push("");
    L.push("## 1. Estimand");
    L.push("");
    L.push("The primary estimand is defined by the attributes in ICH E9(R1).");
    L.push("");
    L.push(`- **Population.** ${e.population}.`);
    L.push(`- **Treatment condition.** ${e.treatment}, as assigned at randomization.`);
    L.push(`- **Variable (endpoint).** ${e.variable}.`);
    if (e.events.length) {
      L.push("- **Intercurrent events and strategies.**");
      e.events.forEach((ev) => L.push(`  - ${ev.name}: ${ev.label.toLowerCase()} strategy. ${ev.sentence}`));
    } else {
      L.push(
        "- **Intercurrent events and strategies.** None are specified here. Most trials have at least one (for example treatment discontinuation or use of rescue therapy); each should be listed with its strategy.",
      );
    }
    L.push(`- **Population-level summary.** ${e.summary}`);
    if (m === "or")
      L.push(
        "",
        "The odds ratio is non-collapsible: the unconditional odds ratio generally differs from the covariate-conditional odds ratio from a logistic regression, even with no confounding and no effect modification (FDA 2023). The estimand here is the unconditional odds ratio, which does not depend on which covariates are adjusted for.",
      );
    L.push("");
    L.push("## 2. Primary analysis");
    L.push("");
    const covText = covs.length ? joinWords(covs) : "[list the prespecified baseline covariates]";
    if (s.endpoint === "continuous") {
      L.push(
        `The ${mw.name} will be estimated by covariate-adjusted standardization, which in this setting is analysis of covariance with treatment-by-covariate interactions. A linear regression of the endpoint on the prespecified baseline covariates will be fitted separately in each treatment arm. Each randomized participant's outcome will be predicted under both treatment conditions, and the predictions will be averaged over all randomized participants. The estimate is the difference between the two averages.`,
      );
    } else {
      L.push(
        `The ${mw.name} will be estimated by covariate-adjusted standardization (g-computation), following the steps described in FDA (2023). A logistic regression of the endpoint on the prespecified baseline covariates will be fitted separately in each treatment arm. For every randomized participant, the probability of response will be predicted under ${s.treatment || "the investigational treatment"} and under ${s.control || "control"}, and each set of predictions will be averaged over all randomized participants. The ${mw.name} will be computed from these two standardized response probabilities.`,
      );
    }
    L.push("");
    L.push(
      s.endpoint === "continuous"
        ? `Because treatment is randomized, this estimator is consistent for the unconditional treatment effect even if the working regression model is misspecified, and with the model fitted within each arm it is asymptotically at least as precise as the unadjusted comparison (Tsiatis, Davidian, Zhang and Lu 2008; Ye, Shao, Yi and Zhao 2023; FDA 2023).`
        : `Because treatment is randomized, this estimator is consistent for the unconditional treatment effect even if the working logistic model is misspecified, and it is typically more precise than the unadjusted comparison when the covariates are prognostic (FDA 2023; Tsiatis, Davidian, Zhang and Lu 2008).`,
    );
    L.push("");
    L.push("**Covariates.** " +
      `The working model will include the following baseline covariates, each measured before randomization: ${covText}.` +
      (strata.length
        ? ` It will also include the randomization stratification factor${strata.length > 1 ? "s" : ""} (${joinWords(strata)}) as indicators of their joint levels.`
        : "") +
      ` These covariates were selected before any unblinding because they are expected to be strongly associated with the endpoint${s.r2Source ? `, based on ${s.r2Source}` : ""}. Continuous covariates will enter linearly and categorical covariates as indicator variables. No variable measured after randomization will be included.`);
    L.push("");
    L.push(
      "**Missing baseline covariates.** Missing values of a continuous covariate will be replaced by the mean over all randomized participants, and missing values of a categorical covariate by an additional \"missing\" category; for a continuous covariate with more than 5% missing values, an indicator of missingness will also be included. These rules use baseline data only and do not depend on treatment assignment or outcome.",
    );
    L.push("");
    L.push(
      `**Standard error and confidence interval.** The standard error will be computed from the estimated influence function of the standardized estimator, a robust (sandwich-type) variance that remains valid when the working model is misspecified and when the treatment effect varies across participants (FDA 2023 recommends robust standard errors of this kind).` +
        (strata.length
          ? " Including the stratification factors in the working model lets this variance reflect the stratified randomization rather than overstate the standard error (FDA 2023; Ye, Shao, Yi and Zhao 2023)."
          : "") +
        (mw.ratio
          ? ` The two-sided ${level} confidence interval will be computed for the log ${mw.name} and transformed back.`
          : ` A two-sided ${level} Wald confidence interval will be reported.`) +
        ` The null hypothesis of no treatment effect will be tested at two-sided significance level ${alpha}.`,
    );
    L.push("");
    const ies = e.events.filter((ev) => ev.strategy !== "treatment-policy" && ev.strategy !== "composite");
    if (ies.length)
      L.push(
        `**Intercurrent events.** Covariate adjustment does not by itself implement ${joinWords(ies.map((ev) => `the ${ev.label.toLowerCase()} strategy for ${ev.name.toLowerCase()}`))}. ${ies.map((ev) => ev.data).filter((v, i, a) => a.indexOf(v) === i).join(" ")}`,
        "",
      );
    L.push("**Supportive analyses.**");
    L.push("");
    L.push("- The unadjusted estimate of the same estimand, with its Wald confidence interval.");
    L.push("- The primary estimate with a nonparametric bootstrap standard error (2,000 resamples, drawn within treatment arm).");
    if (m === "or") L.push("- The conditional odds ratio from a logistic regression with the same covariates, labelled as a different estimand.");
    L.push("- Treatment-by-covariate interactions, as exploratory analyses only.");
    L.push("");
    if (plan && plan.ok) {
      L.push("## 3. Sample size");
      L.push("");
      const c = plan.cfg,
        aw = ratioText(c.ratio);
      const assume = `This assumes ${effectText(s)}, a two-sided significance level of ${alpha}, ${aw} allocation, and ${pct(+c.dropout, 0)} of randomized participants without an evaluable primary endpoint.`;
      if (s.sizing === "adjusted") {
        L.push(
          `The sample size accounts for the expected precision gain from covariate adjustment. The prespecified covariates are assumed to explain R² = ${fmt(+c.r2, 2)} of the variance in the endpoint${s.r2Source ? ` (source: ${s.r2Source})` : ""}. With ${plan.adjusted.evaluable} evaluable participants, the adjusted analysis has ${pct(plan.powerAdjustedAtAdjusted, 0)} power. ${assume} A total of ${plan.adjusted.enrolled} participants will be randomized. An unadjusted analysis would need ${plan.unadjusted.evaluable} evaluable participants for the same power.`,
        );
        L.push("");
        const half = plan.sensitivity.find((x) => x.fraction === 0.5),
          none = plan.sensitivity.find((x) => x.fraction === 0);
        L.push(
          `If the covariates explain half the assumed R², power falls to ${pct(half.power, 0)}; if they explain nothing, it falls to ${pct(none.power, 0)}. The R² assumption can be checked on blinded pooled data during the trial; the prespecified analysis does not change.`,
        );
      } else {
        L.push(
          `The sample size is based on the unadjusted analysis, which FDA (2023) notes will often be more conservative. With ${plan.unadjusted.evaluable} evaluable participants, the unadjusted analysis has ${pct(+c.power, 0)} power. ${assume} A total of ${plan.unadjusted.enrolled} participants will be randomized. If the prespecified covariates explain R² = ${fmt(+c.r2, 2)} of the variance in the endpoint${s.r2Source ? ` (source: ${s.r2Source})` : ""}, the planned adjusted analysis is expected to have approximately ${pct(plan.powerBuffer, 0)} power.`,
        );
      }
      L.push("");
    }
    if (oc && oc.length) {
      L.push("## 4. Operating characteristics");
      L.push("");
      L.push(
        `Operating characteristics were evaluated by simulation (${oc.reps} trials per scenario, ${oc.n} evaluable participants, ${ratioText(+s.ratio)} complete randomization). The baseline covariates were represented by a single prognostic score explaining the assumed R². In the stress scenario, the true relationship between the score and the endpoint is curved while the prespecified working model stays linear in the score.`,
      );
      L.push("");
      L.push("| Scenario | Analysis | Rejection rate | CI coverage | Bias | Empirical SD | Mean SE |");
      L.push("|---|---|---|---|---|---|---|");
      oc.forEach((row) =>
        ["unadjusted", "adjusted"].forEach((k) => {
          const r = row[k];
          L.push(
            `| ${row.label} | ${k === "adjusted" ? "Adjusted (primary)" : "Unadjusted"} | ${pct(r.rejectRate, 1)} | ${pct(r.coverage, 1)} | ${fmt(r.bias, 4)} | ${fmt(r.empiricalSD, 4)} | ${fmt(r.meanSE, 4)} |`,
          );
        }),
      );
      L.push("");
      L.push(
        `Under no effect the rejection rate is the type I error; under an effect it is power. ${mw.ratio ? "Bias, SD and SE are on the log scale." : ""}`.trim(),
      );
      L.push("");
    }
    L.push(`## ${plan && plan.ok ? (oc && oc.length ? 5 : 4) : 3}. Software`);
    L.push("");
    L.push(
      "The primary analysis will be programmed in R (base R, stats::glm). The companion script implements the estimator and its standard error. The RobinCar package implements the same class of estimators and can serve as an independent check.",
    );
    L.push("");
    L.push("## References");
    L.push("");
    L.push(
      "- FDA (2023). Adjusting for Covariates in Randomized Clinical Trials for Drugs and Biological Products. Guidance for Industry. https://www.fda.gov/media/148910/download",
    );
    L.push("- ICH (2019). E9(R1) Addendum on Estimands and Sensitivity Analysis in Clinical Trials.");
    L.push("- EMA (2015). Guideline on adjustment for baseline covariates in clinical trials. EMA/CHMP/295050/2013.");
    L.push(
      "- Tsiatis AA, Davidian M, Zhang M, Lu X (2008). Covariate adjustment for two-sample treatment comparisons in randomized clinical trials. Statistics in Medicine 27:4658-4677.",
    );
    L.push(
      "- Ye T, Shao J, Yi Y, Zhao Q (2023). Toward better practice of covariate adjustment in analyzing randomized clinical trials. Journal of the American Statistical Association 118:2370-2382.",
    );
    if (device)
      L.push(
        "",
        "_Note for a device trial: FDA (2023) was issued by CDER and CBER for drugs and biological products. CDRH has no device-specific counterpart, so state in the Q-Submission that the analysis follows its principles and ask the review team to confirm._",
      );
    return L.join("\n");
  }

  /* ---------- Reviewer questions ---------- */
  function reviewerQuestions(s, plan) {
    const m = measureOf(s),
      covs = list(s.covariates),
      strata = list(s.strata),
      Q = [];
    const params = covs.length + Math.max(0, strata.length) + 1;
    Q.push({
      id: "misspecified",
      q: "What if your working model is wrong?",
      a: "The estimate is still consistent for the prespecified unconditional effect, because randomization, not the model, makes the arms comparable. A poor model costs precision, not validity. The operating characteristics include a stress scenario in which the model misses the true shape: the type I error and coverage hold, and the power sits between the adjusted and unadjusted plans.",
      source: "FDA 2023; Tsiatis et al. 2008",
    });
    if (s.endpoint === "binary")
      Q.push({
        id: "conditional",
        q: m === "or" ? "Is this the odds ratio from the logistic regression?" : "Is the effect conditional or unconditional?",
        a:
          m === "or"
            ? "No. The logistic regression is a working model; its coefficient is a conditional odds ratio that depends on which covariates are included and generally differs from the unconditional odds ratio even with no confounding (non-collapsibility). The SAP targets the unconditional odds ratio, computed from the two standardized response probabilities, and reports the conditional odds ratio only as a supportive analysis of a different estimand."
            : `Unconditional. The ${MEASURE_WORDS[m].name} compares the average response if everyone received treatment with the average if everyone received control. It is computed from standardized probabilities, not read off a regression coefficient, so it does not change meaning when covariates are added or removed.`,
        source: "FDA 2023, section on nonlinear models",
      });
    Q.push({
      id: "selection",
      q: "Why these covariates, and when were they chosen?",
      a: `They were fixed in the protocol and SAP before any unblinding${s.r2Source ? `, chosen for their expected association with the endpoint based on ${s.r2Source}` : ", chosen for their expected association with the endpoint (state the source: literature, a Phase 2 trial, or registry data)"}. All are measured before randomization. FDA review emphasizes the prespecified primary analysis over post hoc models, so the list should not change after data are seen.`,
      source: "FDA 2023",
    });
    if (strata.length)
      Q.push({
        id: "strata",
        q: "Does the standard error account for stratified randomization?",
        a: "Yes. The stratification factors are in the working model as indicators of their joint levels, so the influence-function variance reflects the stratified design. An analysis that ignores stratification tends to overstate the standard error and be conservative, which FDA 2023 recommends avoiding.",
        source: "FDA 2023; Ye et al. 2023",
      });
    else
      Q.push({
        id: "nominal",
        q: s.endpoint === "continuous" ? "Why not the default ANCOVA standard error?" : "Why a robust standard error?",
        a:
          s.endpoint === "continuous" && +s.ratio === 1
            ? "With two arms and 1:1 allocation the default model-based standard error is acceptable even under misspecification. The influence-function (robust) standard error is used because it stays valid if the allocation or the variance differs between arms, at little cost."
            : "The model-based standard error can be wrong when the working model is misspecified, especially with unequal allocation or unequal variances between arms. The influence-function standard error is a robust (sandwich-type) variance that stays valid in those cases, as FDA 2023 recommends.",
        source: "FDA 2023",
      });
    if (plan && plan.ok) {
      if (s.sizing === "adjusted") {
        const half = plan.sensitivity.find((x) => x.fraction === 0.5);
        Q.push({
          id: "r2",
          q: "How credible is the R² behind your sample size?",
          a: `The plan assumes R² = ${fmt(+plan.cfg.r2, 2)}${s.r2Source ? ` from ${s.r2Source}` : ""}. Expect this question, and have the source analysis ready. If the covariates explain half as much, power falls to ${pct(half.power, 0)}. The conservative alternative, which FDA 2023 describes, is to size for the unadjusted analysis and treat the adjustment as extra power (here about ${pct(plan.powerBuffer, 0)}).`,
          source: "FDA 2023, sample size section",
        });
      } else
        Q.push({
          id: "r2",
          q: "Why not size the trial for the adjusted analysis?",
          a: `Sizing for the unadjusted analysis is the conservative choice FDA 2023 describes. The adjustment then raises power to about ${pct(plan.powerBuffer, 0)} rather than cutting enrolment. Sizing for the adjusted analysis would need ${plan.adjusted.enrolled} rather than ${plan.unadjusted.enrolled} randomized participants, and requires a credible, documented R².`,
          source: "FDA 2023",
        });
      const nArm = Math.min(plan.adjusted.evaluable * plan.pi, plan.adjusted.evaluable * (1 - plan.pi));
      const events = s.endpoint === "binary" ? Math.min(+s.p0, 1 - +s.p0, +s.p1, 1 - +s.p1) * nArm : null;
      const tight = s.endpoint === "binary" ? events / params < 10 : nArm / params < 20;
      Q.push({
        id: "count",
        q: "Is the number of covariates small relative to the sample size?",
        a: tight
          ? `This plan is tight: about ${params} parameters per arm model for ${s.endpoint === "binary" ? `roughly ${Math.round(events)} of the less common outcome` : `roughly ${Math.round(nArm)} participants`} in the smaller arm. FDA 2023 asks sponsors to discuss this with the review division when covariates are many relative to the sample size. Consider fewer covariates, or a single prognostic score built from external data.`
          : `About ${params} parameters per arm model against roughly ${Math.round(nArm)} participants in the smaller arm${events != null ? ` (about ${Math.round(events)} of the less common outcome)` : ""}. The large-sample properties FDA 2023 relies on should hold.`,
        source: "FDA 2023",
      });
    }
    Q.push({
      id: "missing",
      q: "How are missing baseline covariates handled?",
      a: "With rules that use baseline data only: mean imputation or a missing category, plus a missingness indicator when missingness is common. Because they never look at treatment or outcome, they keep the estimator valid in a randomized trial. Missing outcomes are a separate question, governed by the intercurrent event strategies.",
      source: "Common practice; state the rule in the SAP",
    });
    const hard = (s.events || []).filter((e) => e && e.name && ["hypothetical", "principal-stratum", "while-on-treatment"].includes(e.strategy));
    if (hard.length)
      Q.push({
        id: "ie",
        q: "How does the analysis handle your intercurrent events?",
        a: `${joinWords(hard.map((e) => `${e.name} (${STRATEGIES[e.strategy].label.toLowerCase()})`))} ${hard.length > 1 ? "need" : "needs"} its own prespecified method and a sensitivity analysis for its assumptions. Covariate adjustment sits on top of that method; it does not replace it. See the lesson on intercurrent events for how the strategies change the estimand.`,
        source: "ICH E9(R1)",
      });
    else if ((s.events || []).some((e) => e && e.name && e.strategy === "treatment-policy"))
      Q.push({
        id: "ie",
        q: "Will you collect outcomes after treatment discontinuation?",
        a: "The treatment policy strategy includes outcomes after the event, so they must be collected. Plan for retrieved-dropout follow-up and prespecify how any remaining missing outcomes are handled, with a sensitivity analysis.",
        source: "ICH E9(R1)",
      });
    Q.push({
      id: "ml",
      q: "Could you use machine learning for the working model?",
      a: "FDA 2023 explicitly does not address machine learning. The theory allows flexible working models (with cross-fitting), but a regulatory primary analysis gains little over a well-chosen prespecified regression and adds review burden. A reasonable path is a prespecified regression for the primary analysis, with a flexible model as a supportive analysis or discussed with the division in advance.",
      source: "FDA 2023, scope",
    });
    if (s.product === "device")
      Q.push({
        id: "device",
        q: "Does the FDA covariate guidance apply to a device trial?",
        a: "Not formally: it was issued by CDER and CBER for drugs and biological products, and CDRH has no device-specific counterpart. The statistical reasoning does not depend on the product type, so state that the analysis follows its principles and confirm with the CDRH review team, for example in a Q-Submission.",
        source: "FDA 2023, scope",
      });
    return Q;
  }

  /* ---------- R code ---------- */
  function rCode(s) {
    const m = measureOf(s),
      covs = list(s.covariates).map(varName),
      strata = list(s.strata).map(varName),
      cv = covs.length ? covs : ["x1", "x2"],
      strataTerm = strata.length > 1 ? ["strata_joint"] : strata,
      all = [...new Set([...cv, ...strataTerm])],
      binary = s.endpoint === "binary",
      alpha = +s.alpha || 0.05;
    const q = (xs) => xs.map((x) => `"${x}"`).join(", ");
    const L = [];
    L.push(`# ${s.trialName ? s.trialName + ": " : ""}primary analysis, covariate-adjusted ${MEASURE_WORDS[m].name} by standardization`);
    L.push("# Generated by Causality, For your trial. Review before use. Base R only.");
    L.push("#");
    L.push("# The estimate is the unconditional (marginal) treatment effect. The working model is fitted");
    L.push("# separately in each arm; the standard error comes from the estimated influence function.");
    L.push("");
    L.push("standardize <- function(data, outcome, arm, covariates, family, measure, alpha) {");
    L.push("  f <- reformulate(if (length(covariates)) covariates else \"1\", response = outcome)");
    L.push("  a <- data[[arm]]; y <- data[[outcome]]; n <- nrow(data); p <- mean(a)");
    L.push("  fit1 <- glm(f, family = family, data = data[a == 1, , drop = FALSE])");
    L.push("  fit0 <- glm(f, family = family, data = data[a == 0, , drop = FALSE])");
    L.push("  m1 <- predict(fit1, newdata = data, type = \"response\")");
    L.push("  m0 <- predict(fit0, newdata = data, type = \"response\")");
    L.push("  mu1 <- mean(m1) + mean(a * (y - m1)) / p");
    L.push("  mu0 <- mean(m0) + mean((1 - a) * (y - m0)) / (1 - p)");
    L.push("  phi1 <- a / p * (y - m1) + m1 - mu1            # influence function, arm 1 mean");
    L.push("  phi0 <- (1 - a) / (1 - p) * (y - m0) + m0 - mu0  # influence function, arm 0 mean");
    L.push("  est <- switch(measure, md = , rd = mu1 - mu0, rr = log(mu1 / mu0), or = qlogis(mu1) - qlogis(mu0))");
    L.push("  g <- switch(measure, md = , rd = c(1, -1), rr = c(1 / mu1, -1 / mu0),");
    L.push("              or = c(1 / (mu1 * (1 - mu1)), -1 / (mu0 * (1 - mu0))))");
    L.push("  se <- sqrt(mean((g[1] * phi1 + g[2] * phi0)^2) / n)");
    L.push("  ci <- est + c(-1, 1) * qnorm(1 - alpha / 2) * se");
    L.push("  back <- if (measure %in% c(\"rr\", \"or\")) exp else identity");
    L.push("  list(estimate = back(est), lower = back(ci[1]), upper = back(ci[2]),");
    L.push("       se = se, scale = if (measure %in% c(\"rr\", \"or\")) \"log\" else \"natural\",");
    L.push("       p_value = 2 * pnorm(-abs(est / se)), arm_means = c(treatment = mu1, control = mu0))");
    L.push("}");
    L.push("");
    L.push("# Baseline-only rules for missing covariates (SAP Section 2).");
    L.push("impute_baseline <- function(data, covariates, indicator_above = 0.05) {");
    L.push("  for (v in covariates) {");
    L.push("    x <- data[[v]]; miss <- is.na(x)");
    L.push("    if (!any(miss)) next");
    L.push("    if (is.numeric(x)) {");
    L.push("      if (mean(miss) > indicator_above) data[[paste0(v, \"_missing\")]] <- as.numeric(miss)");
    L.push("      x[miss] <- mean(x, na.rm = TRUE)");
    L.push("    } else {");
    L.push("      x <- as.character(x); x[miss] <- \"missing\"; x <- factor(x)");
    L.push("    }");
    L.push("    data[[v]] <- x");
    L.push("  }");
    L.push("  data");
    L.push("}");
    L.push("");
    L.push("# ---- Example data so the script runs as is. Replace with the locked analysis dataset. ----");
    L.push("set.seed(1)");
    L.push(`n <- ${Math.max(100, Math.min(2000, +s.nExample || 400))}`);
    L.push("dat <- data.frame(arm = sample(rep(0:1, length.out = n)))");
    cv.forEach((v) => L.push(`dat$${v} <- rnorm(n)`));
    strata.filter((v) => !cv.includes(v)).forEach((v) => L.push(`dat$${v} <- factor(sample(c("A", "B"), n, replace = TRUE))`));
    const lin = `0.8 * dat$${cv[0]}${cv[1] ? ` + 0.4 * dat$${cv[1]}` : ""}`;
    if (binary) {
      L.push(`dat$y <- rbinom(n, 1, plogis(qlogis(${+s.p0 || 0.3}) + ${lin} + log(${fmt(((+s.p1 || 0.2) / (1 - (+s.p1 || 0.2))) / ((+s.p0 || 0.3) / (1 - (+s.p0 || 0.3))), 3)}) * dat$arm))`);
    } else {
      L.push(`dat$y <- ${+s.sd || 1} * (0.5 * dat$${cv[0]}${cv[1] ? ` + 0.3 * dat$${cv[1]}` : ""} + 0.8 * rnorm(n)) + ${+s.delta || 0.3} * dat$arm`);
    }
    L.push(`dat$${cv[0]}[sample(n, 10)] <- NA  # a few missing baseline values, to exercise the rules`);
    if (strata.length > 1)
      L.push(`dat$strata_joint <- interaction(${strata.map((v) => "dat$" + v).join(", ")}, drop = TRUE)  # joint levels of the stratification factors`);
    L.push("# -----------------------------------------------------------------------------------------");
    L.push("");
    L.push(`covariates <- c(${q(all)})`);
    L.push("dat <- impute_baseline(dat, covariates)");
    L.push("covariates <- c(covariates, grep(\"_missing$\", names(dat), value = TRUE))");
    L.push(`family <- ${binary ? "binomial()" : "gaussian()"}`);
    L.push(`measure <- "${m}"`);
    L.push(`alpha <- ${alpha}`);
    L.push("");
    L.push("primary <- standardize(dat, \"y\", \"arm\", covariates, family, measure, alpha)");
    L.push("unadjusted <- standardize(dat, \"y\", \"arm\", character(0), family, measure, alpha)");
    L.push("str(primary)");
    L.push("str(unadjusted)");
    L.push("");
    L.push("# Supportive: nonparametric bootstrap SE, resampling within arm (use 2000 in the real analysis).");
    L.push("boot <- replicate(200, {");
    L.push("  i <- unlist(lapply(split(seq_len(n), dat$arm), function(ix) ix[sample.int(length(ix), replace = TRUE)]))");
    L.push("  r <- standardize(dat[i, ], \"y\", \"arm\", covariates, family, measure, alpha)");
    L.push("  if (r$scale == \"log\") log(r$estimate) else r$estimate");
    L.push("})");
    L.push("c(influence_function_se = primary$se, bootstrap_se = sd(boot))");
    L.push("");
    L.push("# Independent check (if installed): RobinCar implements the same class of estimators,");
    L.push("# including variance under stratified randomization. See its documentation for arguments.");
    return L.join("\n") + "\n";
  }

  return { STRATEGIES, MEASURE_WORDS, list, varName, estimand, sap, reviewerQuestions, rCode, effectText, measureOf };
});
