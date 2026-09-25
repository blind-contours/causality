# Lesson 01: plug-in, IPW and one-step (AIPW) for the ATE, by hand in base R.
# Same generator as the course's ATE study (science/core.js): true ATE = 2.
# In practice AIPW::AIPW, tmle::tmle() or lmtp would do this for you.
set.seed(20260925)
n <- 2000
X <- rbinom(n, 1, 0.35)                              # high severity
A <- rbinom(n, 1, plogis(-0.8 + 1.6 * X))            # confounded treatment
Y <- 0.5 + X + 0.6 * X^2 + A * (2 + 0.4 * (X - 0.35)) + rnorm(n, 0, 0.8)

naive <- mean(Y[A == 1]) - mean(Y[A == 0])           # ignores confounding

g <- fitted(glm(A ~ X, family = binomial))            # logistic propensity
one_step <- function(om) {   # om: any outcome regression of Y on A (and X)
  m1 <- predict(om, newdata = data.frame(A = 1, X = X))
  m0 <- predict(om, newdata = data.frame(A = 0, X = X))
  resid_piece <- A / g * (Y - m1) - (1 - A) / (1 - g) * (Y - m0)
  plugin <- mean(m1 - m0)                            # g-computation
  aipw <- plugin + mean(resid_piece)                 # one-step = AIPW
  D <- m1 - m0 - aipw + resid_piece                  # estimated influence function
  c(plugin = plugin, aipw = aipw, se = sd(D) / sqrt(n))
}
ipw <- mean(A * Y / g) - mean((1 - A) * Y / (1 - g))  # Horvitz-Thompson IPW
right <- one_step(lm(Y ~ A * X))   # correct outcome model
wrong <- one_step(lm(Y ~ A))       # ignores severity: plug-in is biased

print(format(round(rbind(right, wrong), 4), nsmall = 4), quote = FALSE, right = TRUE)
cat(sprintf("naive = %.4f, IPW = %.4f, truth = 2\n", naive, ipw))
ci <- wrong["aipw"] + c(-1, 1) * qnorm(0.975) * wrong["se"]
cat(sprintf("One-step with the wrong outcome model: 95%% CI (%.3f, %.3f)\n", ci[1], ci[2]))
# X is binary, so the logistic propensity is saturated: AIPW then equals IPW
# whatever the outcome model. With continuous X they differ (crossfit-aipw.R).

# Expected output:
#       plugin   aipw     se
# right 2.0100 2.0100 0.0380
# wrong 2.6015 2.0100 0.0589
# naive = 2.6015, IPW = 2.0100, truth = 2
# One-step with the wrong outcome model: 95% CI (1.895, 2.125)
