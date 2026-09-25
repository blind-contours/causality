# Lesson 08, Four Patients: the one-step correction and the TMLE epsilon by hand.
# Target psi = E[mu1(X)], the mean outcome if everyone were treated.

# Part 1: four patients, known propensity pi(X) and initial fit mu1(X)
d <- data.frame(stratum = c("young", "young", "old", "old"),
                A  = c(1, 0, 1, 0),
                Y  = c(4.0, 2.0, 2.5, 1.0),
                pi = c(0.8, 0.8, 0.25, 0.25),
                mu = c(3.0, 3.0, 2.0, 2.0))
n <- nrow(d)
psi_hat <- mean(d$mu)                      # plug-in: 2.5
d$H  <- d$A / d$pi                         # clever covariate, 0 if untreated
d$Hr <- d$H * (d$Y - d$mu)                 # Y-piece of the influence function
d$D  <- (d$mu - psi_hat) + d$Hr            # X-piece + Y-piece
print(d, row.names = FALSE)

correction <- mean(d$Hr)                   # the one-step correction
one_step   <- psi_hat + correction
se <- sd(d$D) / sqrt(n)                    # influence-function standard error
ci <- one_step + c(-1, 1) * qnorm(0.975) * se
cat(sprintf("correction = %.4f, one-step = %.4f\n", correction, one_step))
cat(sprintf("SE = sd(D)/sqrt(n) = %.4f, 95%% CI = (%.3f, %.3f)\n", se, ci[1], ci[2]))
cat("With n = 4 this interval is arithmetic, not inference.\n")

# Part 2: epsilon for a linear fluctuation mu + eps * H, four treated residuals
H <- c(1.25, 1.25, 4, 4)
r <- c(1.0, 0.6, 0.5, 1.5)
eps <- sum(H * r) / sum(H^2)               # no-intercept least squares
stopifnot(all.equal(eps, unname(coef(lm(r ~ 0 + H)))))
cat(sprintf("sum(H*r) = %g, sum(H^2) = %g, eps = %.4f\n", sum(H * r), sum(H^2), eps))
cat(sprintf("young shift = %.3f, old shift = %.3f\n", eps * 1.25, eps * 4))
cat("score after update, sum(H*(r - eps*H)) == 0:", isTRUE(all.equal(sum(H * (r - eps * H)), 0)), fill = TRUE)

# Expected output:
#  stratum A   Y   pi mu    H   Hr     D
#    young 1 4.0 0.80  3 1.25 1.25  1.75
#    young 0 2.0 0.80  3 0.00 0.00  0.50
#      old 1 2.5 0.25  2 4.00 2.00  1.50
#      old 0 1.0 0.25  2 0.00 0.00 -0.50
# correction = 0.8125, one-step = 3.3125
# SE = sd(D)/sqrt(n) = 0.5141, 95% CI = (2.305, 4.320)
# With n = 4 this interval is arithmetic, not inference.
# sum(H*r) = 10, sum(H^2) = 35.125, eps = 0.2847
# young shift = 0.356, old shift = 1.139
# score after update, sum(H*(r - eps*H)) == 0: TRUE
