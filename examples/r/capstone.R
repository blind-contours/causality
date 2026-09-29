# An emulated trial, end to end: the capstone's main estimate in base R.
# Same world as the lesson (science/capstone.js), drawn with R's own random numbers, so the
# registry and the numbers differ from the page by sampling noise; the truth is the same.
# A three-learner Super Learner (convex weights minimising 5-fold CV squared error),
# 5-fold cross-fitting, AIPW for the 1-year risk difference with an influence-function SE,
# the risk ratio (delta method on the log scale) and its E-value.
#
# In practice: SuperLearner::SuperLearner(Y, X, family = binomial(), SL.library =
# c("SL.glm", "SL.glm.interaction", "SL.gam", "SL.knn")) or sl3::Lrnr_sl fits the ensemble;
# tmle::tmle(Y, A, W, family = "binomial", Q.SL.library, g.SL.library) returns the TMLE of
# the risk difference, risk ratio and odds ratio; AIPW::AIPW cross-fits the AIPW estimate;
# WeightIt::weightit() and cobalt::bal.tab() check weights and balance;
# EValue::evalues.RR(est, lo, hi) gives the E-values.
library(splines)
set.seed(20260929)
sim_x <- function(n) {                               # baseline covariates, as z-scores
  age <- pmin(pmax(rnorm(n, 78, 7), 55), 95); female <- rbinom(n, 1, 0.45)
  lvef <- pmin(pmax(rnorm(n, 52, 10), 20), 75); egfr <- pmin(pmax(rnorm(n, 60, 18), 15), 110)
  sts <- pmin(pmax(exp(log(4) + 0.03 * (age - 78) + rnorm(n, 0, 0.45)), 0.5), 20)
  data.frame(za = (age - 78) / 7, zl = (lvef - 52) / 10, ze = (egfr - 60) / 18,
             zs = (log(sts) - log(4)) / 0.5, female = female)
}
risk <- function(a, z) plogis(-1.25 + 0.3 * z$za + 0.7 * z$zs - 0.3 * z$zl - 0.2 * z$ze +
  0.45 * pmax(0, -z$ze - 0.5)^2 + a * (-0.55 + 0.3 * z$zs - 0.2 * z$za))
n <- 1600; d <- sim_x(n)
d$a <- rbinom(n, 1, plogis(-0.35 + 0.1 * d$za + 0.08 * d$za^2 + 0.9 * d$zs - 0.25 * d$zl + 0.25 * d$female))
d$y <- rbinom(n, 1, risk(d$a, d))                    # 1-year event, treatment policy

# The library: main terms, squares and pairwise interactions, additive natural splines
lib <- list(y = c("a + za + zl + ze + zs + female",
                  "(a + za + zl + ze + zs + female)^2 + I(za^2) + I(zl^2) + I(ze^2) + I(zs^2)",
                  "a * (za + zs) + ns(za, 3) + ns(zl, 3) + ns(ze, 3) + ns(zs, 3) + female"),
            a = c("za + zl + ze + zs + female",
                  "(za + zl + ze + zs + female)^2 + I(za^2) + I(zl^2) + I(ze^2) + I(zs^2)",
                  "ns(za, 3) + ns(zl, 3) + ns(ze, 3) + ns(zs, 3) + female"))
fit_lib <- function(tr, lhs) lapply(lib[[lhs]], function(f)
  suppressWarnings(glm(as.formula(paste(lhs, "~", f)), binomial, tr)))
pred_lib <- function(fits, te) sapply(fits, predict, newdata = te, type = "response")
weights_cv <- function(P, y) {                       # min CV squared error over the simplex
  best <- NULL
  for (m in 1:(2^ncol(P) - 1)) {
    S <- which(bitwAnd(m, 2^(seq_len(ncol(P)) - 1)) > 0)
    K <- rbind(cbind(2 * crossprod(P[, S, drop = FALSE]), 1), c(rep(1, length(S)), 0))
    s <- tryCatch(solve(K, c(2 * crossprod(P[, S, drop = FALSE], y), 1)), error = function(e) NULL)
    if (is.null(s) || any(s[seq_along(S)] < 0)) next
    w <- numeric(ncol(P)); w[S] <- s[seq_along(S)]
    if (is.null(best) || mean((y - P %*% w)^2) < best$r) best <- list(w = w, r = mean((y - P %*% w)^2))
  }
  best$w
}
super_learner <- function(tr, lhs) {         # 5-fold CV weights, then refit on all of tr
  f <- sample(rep(1:5, length.out = nrow(tr))); P <- matrix(0, nrow(tr), 3)
  for (k in 1:5) P[f == k, ] <- pred_lib(fit_lib(tr[f != k, ], lhs), tr[f == k, ])
  list(w = weights_cv(P, tr[[lhs]]), fits = fit_lib(tr, lhs))
}
fold <- sample(rep(1:5, length.out = n)); m1 <- m0 <- g <- numeric(n); W <- NULL
for (k in 1:5) {                                     # cross-fitting
  tr <- d[fold != k, ]; te <- d[fold == k, ]
  so <- super_learner(tr, "y"); sg <- super_learner(tr, "a")
  m1[fold == k] <- pred_lib(so$fits, transform(te, a = 1)) %*% so$w
  m0[fold == k] <- pred_lib(so$fits, transform(te, a = 0)) %*% so$w
  g[fold == k] <- pred_lib(sg$fits, te) %*% sg$w; W <- rbind(W, so$w)
}
g <- pmin(pmax(g, 0.025), 0.975)                     # pre-specified bound
dimnames(W) <- list(paste("fold", 1:5), c("main", "interactions", "splines"))
cat("outcome ensemble weights, refitted in each cross-fitting fold:\n"); print(round(W, 2))
phi1 <- m1 + d$a / g * (d$y - m1); phi0 <- m0 + (1 - d$a) / (1 - g) * (d$y - m0)
r1 <- mean(phi1); r0 <- mean(phi0); rd <- r1 - r0
se <- sqrt(mean((phi1 - phi0 - rd)^2) / n)
se_log <- sqrt(mean(((phi1 - r1) / r1 - (phi0 - r0) / r0)^2) / n)
rr <- r1 / r0; rr_ci <- exp(log(rr) + c(-1, 1) * 1.96 * se_log)
ev <- function(r) { r <- ifelse(r < 1, 1 / r, r); r + sqrt(r * (r - 1)) }
zt <- sim_x(4e5)                                     # for the truth
cat(sprintf("unadjusted RD = %.4f\n", mean(d$y[d$a == 1]) - mean(d$y[d$a == 0])))
cat(sprintf("AIPW: risk %.4f (device) vs %.4f (standard care); RD = %.4f, SE %.4f, 95%% CI (%.4f, %.4f)\n",
            r1, r0, rd, se, rd - 1.96 * se, rd + 1.96 * se))
cat(sprintf("RR = %.3f (%.3f, %.3f); E-value %.2f, for the CI limit %.2f\n",
            rr, rr_ci[1], rr_ci[2], ev(rr), if (rr_ci[2] < 1 || rr_ci[1] > 1) ev(rr_ci[which.min(abs(log(rr_ci)))]) else 1))
cat(sprintf("truth (Monte Carlo, 400,000 patients): RD = %.4f\n", mean(risk(1, zt) - risk(0, zt))))

# Expected output:
# outcome ensemble weights, refitted in each cross-fitting fold:
#        main interactions splines
# fold 1 0.31         0.22    0.47
# fold 2 0.20         0.02    0.78
# fold 3 0.16         0.31    0.53
# fold 4 0.15         0.14    0.71
# fold 5 0.22         0.00    0.78
# unadjusted RD = 0.0503
# AIPW: risk 0.2092 (device) vs 0.2914 (standard care); RD = -0.0822, SE 0.0212, 95% CI (-0.1238, -0.0406)
# RR = 0.718 (0.608, 0.848); E-value 2.13, for the CI limit 1.64
# truth (Monte Carlo, 400,000 patients): RD = -0.0727
