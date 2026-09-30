# Inference Lab: AIPW with 2-fold cross-fitting and a flexible base-R learner.
# Nuisances are natural-spline GLMs (splines::ns). Each patient's influence value
# uses models fitted on the other fold only. true ATE = 1.
#
# In practice: AIPW::AIPW is an R6 class, AIPW$new(Y, A, W, Q.SL.library, g.SL.library,
# k_split = 10)$fit()$summary(), which cross-fits SuperLearner nuisances for you.
# tmle::tmle() uses cross-validated initial outcome predictions by default
# (cvQinit = TRUE); lmtp::lmtp_tmle() and lmtp::lmtp_sdr() cross-fit through
# their `folds` argument. Learners come from SuperLearner::SuperLearner or sl3.
library(splines)
set.seed(20260925)
n <- 2000
X <- runif(n, -2, 2)
A <- rbinom(n, 1, plogis(0.4 + 0.8 * X - 0.5 * X^2))          # nonlinear propensity
Y <- sin(1.5 * X) + 0.5 * X^2 + A * (1 + 0.5 * X) + rnorm(n)  # E[X] = 0 so ATE = 1
dat <- data.frame(X, A, Y)

# Part 1: cross-fit AIPW, spline nuisances
fold <- sample(rep(1:2, length.out = n))
m1 <- m0 <- g <- numeric(n)
for (k in 1:2) {
  tr <- dat[fold != k, ]; te <- dat[fold == k, ]
  gfit <- glm(A ~ ns(X, df = 4), family = binomial, data = tr)
  mfit <- lm(Y ~ A * ns(X, df = 5), data = tr)
  g[fold == k]  <- predict(gfit, te, type = "response")
  m1[fold == k] <- predict(mfit, transform(te, A = 1))
  m0[fold == k] <- predict(mfit, transform(te, A = 0))
}
g <- pmin(pmax(g, 0.01), 0.99)                   # truncate extreme propensities

phi  <- m1 - m0 + A / g * (Y - m1) - (1 - A) / (1 - g) * (Y - m0)
aipw <- mean(phi); se <- sd(phi) / sqrt(n)
cat(sprintf("cross-fit AIPW = %.4f, SE = %.4f, 95%% CI (%.3f, %.3f)\n",
            aipw, se, aipw - 1.96 * se, aipw + 1.96 * se))

# Contrast: linear working models without cross-fitting
lin1 <- predict(lm(Y ~ A + X), transform(dat, A = 1))
lin0 <- predict(lm(Y ~ A + X), transform(dat, A = 0))
cat(sprintf("plug-in, cross-fit splines = %.4f; plug-in, linear = %.4f; truth = 1\n",
            mean(m1 - m0), mean(lin1 - lin0)))
cat(sprintf("propensity range after truncation: %.3f to %.3f\n", min(g), max(g)))

# Part 2: WITHOUT cross-fitting, with an overfitting learner (1-nearest neighbour)
# Outcome learner: predict m_a(x) by the closest patient in arm a. Fitted and used on
# the same patients, each patient's own-arm "prediction" is its own outcome, so the
# residual Y - m_A(X) is 0 and the influence values lose the outcome noise.
nn1 <- function(xtr, ytr, xte) {                 # 1-NN in one dimension
  o <- order(xtr); xs <- xtr[o]; ys <- ytr[o]
  j <- pmax(findInterval(xte, xs), 1); k <- pmin(j + 1, length(xs))
  ifelse(abs(xte - xs[j]) <= abs(xs[k] - xte), ys[j], ys[k])
}
one_study <- function(n, crossfit) {
  X <- runif(n, -2, 2); A <- rbinom(n, 1, plogis(0.4 + 0.8 * X - 0.5 * X^2))
  Y <- sin(1.5 * X) + 0.5 * X^2 + A * (1 + 0.5 * X) + rnorm(n)
  g <- fitted(glm(A ~ X + I(X^2), family = binomial))   # correct propensity model
  fold <- if (crossfit) sample(rep(1:2, length.out = n)) else rep(1, n)
  m1 <- m0 <- numeric(n)
  for (k in unique(fold)) {
    tr <- if (crossfit) fold != k else rep(TRUE, n); te <- fold == k
    m1[te] <- nn1(X[tr & A == 1], Y[tr & A == 1], X[te])
    m0[te] <- nn1(X[tr & A == 0], Y[tr & A == 0], X[te])
  }
  phi <- m1 - m0 + A / g * (Y - m1) - (1 - A) / (1 - g) * (Y - m0)
  c(est = mean(phi), se = sd(phi) / sqrt(n))
}
for (cf in c(FALSE, TRUE)) {
  sims <- replicate(200, one_study(400, cf))
  cover <- mean(abs(sims["est", ] - 1) <= 1.96 * sims["se", ])
  cat(sprintf("1-NN, %-17s mean est %.3f, SD of est %.3f, mean SE %.3f, coverage %.0f%%\n",
              if (cf) "2-fold cross-fit:" else "no cross-fitting:",
              mean(sims["est", ]), sd(sims["est", ]), mean(sims["se", ]), 100 * cover))
}
cat("Without cross-fitting the SE is far below the real SD, so the intervals undercover.\n")

# Expected output:
# cross-fit AIPW = 1.0207, SE = 0.0547, 95% CI (0.914, 1.128)
# plug-in, cross-fit splines = 1.0251; plug-in, linear = 0.9492; truth = 1
# propensity range after truncation: 0.036 to 0.691
# 1-NN, no cross-fitting: mean est 0.998, SD of est 0.148, mean SE 0.076, coverage 70%
# 1-NN, 2-fold cross-fit: mean est 0.985, SD of est 0.161, mean SE 0.159, coverage 94%
# Without cross-fitting the SE is far below the real SD, so the intervals undercover.
