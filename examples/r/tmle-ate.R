# Lesson 07: a hand-rolled TMLE for the ATE with a binary outcome.
# Same X and A as the ATE study; the outcome is now binary.
# In practice tmle::tmle() (or lmtp) does this with Super Learner fits.
set.seed(20260925)
n <- 2000
X <- rbinom(n, 1, 0.35)
A <- rbinom(n, 1, plogis(-0.8 + 1.6 * X))
Qtrue <- function(a, x) plogis(-1.2 + 1.0 * x + 0.9 * a - 0.5 * a * x)
Y <- rbinom(n, 1, Qtrue(A, X))
truth <- sum(c(0.65, 0.35) * (Qtrue(1, 0:1) - Qtrue(0, 0:1)))

# Initial fits. The outcome model ignores severity X, so it is wrong on purpose.
g  <- fitted(glm(A ~ X, family = binomial))
qf <- glm(Y ~ A, family = binomial)
Q1 <- predict(qf, data.frame(A = 1, X = X), type = "response")
Q0 <- predict(qf, data.frame(A = 0, X = X), type = "response")
QA <- ifelse(A == 1, Q1, Q0)

# Targeting step: logistic fluctuation along the clever covariate H(A, X)
H1 <- 1 / g; H0 <- -1 / (1 - g); HA <- ifelse(A == 1, H1, H0)
eps <- coef(glm(Y ~ -1 + HA + offset(qlogis(QA)), family = binomial))
Q1s <- plogis(qlogis(Q1) + eps * H1)
Q0s <- plogis(qlogis(Q0) + eps * H0)
QAs <- ifelse(A == 1, Q1s, Q0s)

tmle <- mean(Q1s - Q0s)
D_t  <- HA * (Y - QAs) + Q1s - Q0s - tmle           # influence function at the update
aipw <- mean(Q1 - Q0 + HA * (Y - QA))               # one-step from the same fits
D_a  <- HA * (Y - QA) + Q1 - Q0 - aipw

out <- rbind(plugin = c(mean(Q1 - Q0), NA),
             aipw   = c(aipw, sd(D_a) / sqrt(n)),
             tmle   = c(tmle, sd(D_t) / sqrt(n)))
out <- cbind(out, out[, 1] - 1.96 * out[, 2], out[, 1] + 1.96 * out[, 2])
colnames(out) <- c("estimate", "SE", "lower", "upper")
print(round(out, 4))
cat(sprintf("eps = %.4f, truth = %.4f\n", eps, truth))
cat("TMLE solves mean(D) = 0:", isTRUE(all.equal(mean(D_t), 0, tolerance = 1e-6)), fill = TRUE)

# Expected output:
#        estimate     SE  lower  upper
# plugin   0.2212     NA     NA     NA
# aipw     0.1665 0.0236 0.1203 0.2127
# tmle     0.1665 0.0234 0.1206 0.2124
# eps = -0.0509, truth = 0.1610
# TMLE solves mean(D) = 0: TRUE
