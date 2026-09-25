# Lesson 16: covariate adjustment in a 1:1 randomized trial (FDA guidance, May 2023).
# Unadjusted difference in means vs standardization (g-computation) with a
# robust influence-function SE. Both target the same marginal ATE.
set.seed(20260925)
n <- 400
X <- rnorm(n)                                  # prognostic baseline covariate
A <- sample(rep(0:1, n / 2))                   # 1:1 randomization
Y <- 1 + 1 * A + 1 * X + rnorm(n, 0, 1.2)       # true ATE = 1, R-squared of X about 0.4
p <- mean(A)                                   # known 0.5; estimated is fine too

# Unadjusted: difference in means and its influence function
m1u <- mean(Y[A == 1]); m0u <- mean(Y[A == 0])
D_u <- A / p * (Y - m1u) - (1 - A) / (1 - p) * (Y - m0u)
unadj <- c(est = m1u - m0u, se = sd(D_u) / sqrt(n))

# Standardized: fit a working model with arm-by-covariate interaction,
# predict everyone under both arms, average the difference.
fit <- lm(Y ~ A * X)
m1 <- predict(fit, data.frame(A = 1, X = X))
m0 <- predict(fit, data.frame(A = 0, X = X))
est <- mean(m1 - m0)
D_s <- A / p * (Y - m1) - (1 - A) / (1 - p) * (Y - m0) + m1 - m0 - est
adj <- c(est = est, se = sd(D_s) / sqrt(n))

tab <- rbind(unadjusted = unadj, standardized = adj)
tab <- cbind(tab, lower = tab[, "est"] - 1.96 * tab[, "se"],
             upper = tab[, "est"] + 1.96 * tab[, "se"])
print(round(tab, 3))
cat(sprintf("CI width ratio adjusted/unadjusted = %.2f\n", adj[2] / unadj[2]))
cat(sprintf("equivalent sample-size gain: %.0f%%\n", 100 * ((unadj[2] / adj[2])^2 - 1)))
# The robust SE stays valid if the working model is wrong; randomization
# alone guarantees consistency. R's RobinCar package packages this.

# Expected output:
#                est    se lower upper
# unadjusted   0.865 0.158 0.556 1.174
# standardized 0.953 0.119 0.719 1.186
# CI width ratio adjusted/unadjusted = 0.76
# equivalent sample-size gain: 75%
