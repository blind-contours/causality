# Optional foundations tutorial: an exact two-stratum teaching table.
# These are invented cell counts, not a random sample or patient records.
# Y(0)=2+3X; Y(1)=Y(0)+2. X is the only common cause in this teaching world.
# In practice: WeightIt::weightit(A ~ X, data = d, method = "glm", estimand = "ATE")
# estimates propensity weights; cobalt::bal.tab() checks covariate balance.
# https://ngreifer.github.io/WeightIt/reference/weightit.html
# https://ngreifer.github.io/cobalt/reference/bal.tab.weightit.html
X <- c(rep(0, 50), rep(1, 50))
A <- c(rep(1, 10), rep(0, 40), rep(1, 40), rep(0, 10))
Y <- 2 + 3 * X + 2 * A
d <- data.frame(X, A, Y)
ps <- glm(A ~ X, data = d, family = binomial())
g <- predict(ps, type = "response")
w <- ifelse(A == 1, 1 / g, 1 / (1 - g))
naive <- mean(Y[A == 1]) - mean(Y[A == 0])
ipw <- weighted.mean(Y[A == 1], w[A == 1]) -
  weighted.mean(Y[A == 0], w[A == 0])
high_before <- c(treated = mean(X[A == 1]), untreated = mean(X[A == 0]))
high_after <- c(treated = weighted.mean(X[A == 1], w[A == 1]),
                untreated = weighted.mean(X[A == 0], w[A == 0]))
cat(sprintf("Observed difference: %.2f\nIPW difference: %.2f\nTarget ATE: 2.00\n", naive, ipw))
print(rbind(high_before, high_after))
stopifnot(abs(naive - 3.8) < 1e-8, abs(ipw - 2) < 1e-8,
          max(abs(high_after - 0.5)) < 1e-8)
# This script demonstrates point estimation and balance only.
# For uncertainty with estimated weights, see the course's standard-errors lesson.
# Expected output:
# Observed difference: 3.80
# IPW difference: 2.00
# Target ATE: 2.00
#             treated untreated
# high_before     0.8       0.2
# high_after      0.5       0.5
