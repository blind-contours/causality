# Lessons 12 and 23: pooled KM in the treated vs severity-standardized KM at tau,
# and RMST by integrating the KM step function. Generator as in the survival lab.
library(survival)
set.seed(20260925)
n <- 5000; tau <- 5; p <- 0.35
X <- rbinom(n, 1, p)                                   # high severity
A <- rbinom(n, 1, plogis(-0.8 + 1.6 * X))              # sicker patients treated more
lam <- ifelse(X == 1, 0.32, 0.08) * ifelse(A == 1, 0.65, 1)
Tev <- rexp(n, lam); Cen <- rexp(n, 0.04 * exp(2 * X)) # censoring depends on X
time <- pmin(Tev, Cen); event <- as.integer(Tev <= Cen)

km_tau <- function(keep) {           # S(tau) and RMST(tau) from one KM curve
  f <- survfit(Surv(time[keep], event[keep]) ~ 1)
  t <- c(0, f$time[f$time <= tau], tau)
  s <- c(1, f$surv[f$time <= tau])
  c(S = tail(s, 1), RMST = sum(s * diff(t)))   # area under the step function
}
pooled <- km_tau(A == 1)
strata <- sapply(0:1, function(x) km_tau(A == 1 & X == x))
w <- c(1 - mean(X), mean(X))                           # whole-cohort severity mix
standardized <- drop(strata %*% w)

lt <- c(0.08, 0.32) * 0.65                             # true treated hazards
truth <- c(S = sum(c(1 - p, p) * exp(-lt * tau)),
           RMST = sum(c(1 - p, p) * (1 - exp(-lt * tau)) / lt))
print(round(rbind(pooled, standardized, truth), 4))

# Cross-check the hand integration against survival's own restricted mean
f1 <- survfit(Surv(time, event) ~ 1, subset = A == 1)
cat(sprintf("survival rmean at tau (same curve): %.4f\n",
            summary(f1, rmean = tau)$table["rmean"]))

# Expected output:
#                   S   RMST
# pooled       0.5994 3.7901
# standardized 0.6209 3.9247
# truth        0.6249 3.9498
# survival rmean at tau (same curve): 3.7901
