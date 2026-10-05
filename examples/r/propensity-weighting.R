# Weighting foundations: the 100-patient hospital from the page.
# An invented teaching world, not patient records. Severity X is the only
# reason doctors chose treatment A, and Y = 1 means the patient died.
# Risk of death: 20% (low) and 50% (high) untreated; 10% and 40% treated.
# In practice: WeightIt::weightit(A ~ X, data = d, method = "glm", estimand = "ATE")
# estimates propensity weights; cobalt::bal.tab() checks covariate balance.
# https://ngreifer.github.io/WeightIt/reference/weightit.html
# https://ngreifer.github.io/cobalt/reference/bal.tab.weightit.html
n <- c(10, 40, 40, 10); deaths <- c(1, 8, 16, 5)       # low treated/untreated, high treated/untreated
d <- data.frame(X = rep(c(0, 0, 1, 1), n), A = rep(c(1, 0, 1, 0), n),
                Y = unlist(mapply(function(k, m) rep(1:0, c(k, m - k)), deaths, n)))
ps <- glm(A ~ X, data = d, family = binomial())     # propensity score g(X)
g <- predict(ps, type = "response")
w <- ifelse(d$A == 1, 1 / g, 1 / (1 - g))           # 1/g if treated, 1/(1-g) if not
crude <- with(d, tapply(Y, A, mean))
restored <- c(weighted.mean(d$Y[d$A == 0], w[d$A == 0]),
              weighted.mean(d$Y[d$A == 1], w[d$A == 1]))
standardized <- sapply(0:1, function(a)             # direct standardization to 50/50
  sum(prop.table(table(d$X)) * with(d[d$A == a, ], tapply(Y, X, mean))))
cat(sprintf("Crude death rates:    treated %.2f, untreated %.2f\n", crude[2], crude[1]))
cat(sprintf("Restored by weights:  treated %.2f, untreated %.2f\n", restored[2], restored[1]))
cat(sprintf("Standardized:         treated %.2f, untreated %.2f\n", standardized[2], standardized[1]))
cat(sprintf("Effect (risk difference): crude %+.2f, weighted %+.2f\n",
            crude[2] - crude[1], restored[2] - restored[1]))
high_share <- rbind(before = with(d, tapply(X, A, mean)),
                    after = c(weighted.mean(d$X[d$A == 0], w[d$A == 0]),
                              weighted.mean(d$X[d$A == 1], w[d$A == 1])))
colnames(high_share) <- c("untreated", "treated")
print(high_share)
stopifnot(abs(restored - c(0.35, 0.25)) < 1e-8, abs(restored - standardized) < 1e-8,
          abs(high_share["after", ] - 0.5) < 1e-8)
# This script demonstrates point estimation and balance only.
# For uncertainty with estimated weights, see the course's standard-errors lesson.
# Expected output:
# Crude death rates:    treated 0.34, untreated 0.26
# Restored by weights:  treated 0.25, untreated 0.35
# Standardized:         treated 0.25, untreated 0.35
# Effect (risk difference): crude +0.08, weighted -0.10
#        untreated treated
# before       0.2     0.8
# after        0.5     0.5
