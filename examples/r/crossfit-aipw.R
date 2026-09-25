# Lesson 11: AIPW with 2-fold cross-fitting and a flexible base-R learner.
# Nuisances are natural-spline GLMs (splines::ns). Each patient's influence value
# uses models fitted on the other fold only. true ATE = 1.
library(splines)
set.seed(20260925)
n <- 2000
X <- runif(n, -2, 2)
A <- rbinom(n, 1, plogis(0.4 + 0.8 * X - 0.5 * X^2))          # nonlinear propensity
Y <- sin(1.5 * X) + 0.5 * X^2 + A * (1 + 0.5 * X) + rnorm(n)  # E[X] = 0 so ATE = 1
dat <- data.frame(X, A, Y)

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

# Expected output:
# cross-fit AIPW = 1.0207, SE = 0.0547, 95% CI (0.914, 1.128)
# plug-in, cross-fit splines = 1.0251; plug-in, linear = 0.9492; truth = 1
# propensity range after truncation: 0.036 to 0.691
