# Four Patients: the one-step correction, the TMLE epsilon and an interval, by hand.
# Target psi = E[m1(X)], the mean outcome if everyone were treated.
# g = propensity g(X) = P(A = 1 | X); m1 = initial outcome fit m1(X) = E[Y | A = 1, X].
#
# In practice: nobody does this by hand. tmle::tmle(Y, A, W) fits g and m with
# SuperLearner and returns the TMLE, its influence-function SE and CI; for a single
# treated mean the same targeting runs inside lmtp::lmtp_tmle (a static "treat all"
# shift). The arithmetic below is exactly what those functions do, on four rows.

# Part 1: the influence function, one patient at a time
d <- data.frame(stratum = c("young", "young", "old", "old"),
                A  = c(1, 0, 1, 0),
                Y  = c(4.0, 2.0, 2.5, 1.0),
                g  = c(0.8, 0.8, 0.25, 0.25),
                m1 = c(3.0, 3.0, 2.0, 2.0))
n <- nrow(d)
psi_hat <- mean(d$m1)                      # plug-in: 2.5
d$H  <- d$A / d$g                          # clever covariate, 0 if untreated
d$Hr <- d$H * (d$Y - d$m1)                 # Y-piece of the influence function
d$D  <- (d$m1 - psi_hat) + d$Hr            # X-piece + Y-piece
print(d, row.names = FALSE)
correction <- mean(d$Hr)                   # the one-step correction
one_step   <- psi_hat + correction
cat(sprintf("correction = %.4f, one-step = %.4f\n", correction, one_step))

# Part 2: epsilon on the same four patients, fluctuation m1 + eps * H
r   <- ifelse(d$A == 1, d$Y - d$m1, 0)    # residuals; untreated rows have H = 0 anyway
eps <- sum(d$H * r) / sum(d$H^2)           # no-intercept least squares
stopifnot(all.equal(eps, unname(coef(lm(r ~ 0 + d$H, subset = d$A == 1)))))
cat(sprintf("sum(H*r) = %g, sum(H^2) = %g, eps = %.4f\n", sum(d$H * r), sum(d$H^2), eps))
cat(sprintf("young shift = eps * 1.25 = %.4f, old shift = eps * 4 = %.4f\n", eps * 1.25, eps * 4))
cat("score after update, sum(H*(r - eps*H)) == 0:", isTRUE(all.equal(sum(d$H * (r - eps * d$H)), 0)), fill = TRUE)

# Part 3: the TMLE, a standard error and an interval
d$m1_star <- d$m1 + eps / d$g              # updated curve at every patient, treated or not
tmle <- mean(d$m1_star)
se <- sd(d$D) / sqrt(n)                    # influence-function SE (sd divides by n - 1)
ci <- one_step + c(-1, 1) * 1.96 * se
cat(sprintf("TMLE = %.4f, one-step = %.4f\n", tmle, one_step))
cat(sprintf("sd(D) = %.4f, SE = sd(D)/sqrt(4) = %.4f, 95%% CI = (%.3f, %.3f)\n", sd(d$D), se, ci[1], ci[2]))
cat("With n = 4 this interval is arithmetic, not inference.\n")

# Expected output:
#  stratum A   Y    g m1    H   Hr     D
#    young 1 4.0 0.80  3 1.25 1.25  1.75
#    young 0 2.0 0.80  3 0.00 0.00  0.50
#      old 1 2.5 0.25  2 4.00 2.00  1.50
#      old 0 1.0 0.25  2 0.00 0.00 -0.50
# correction = 0.8125, one-step = 3.3125
# sum(H*r) = 3.25, sum(H^2) = 17.5625, eps = 0.1851
# young shift = eps * 1.25 = 0.2313, old shift = eps * 4 = 0.7402
# score after update, sum(H*(r - eps*H)) == 0: TRUE
# TMLE = 2.9858, one-step = 3.3125
# sd(D) = 1.0282, SE = sd(D)/sqrt(4) = 0.5141, 95% CI = (2.305, 4.320)
# With n = 4 this interval is arithmetic, not inference.
