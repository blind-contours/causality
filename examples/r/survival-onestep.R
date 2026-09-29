# Targeted survival curves and Delta RMST: discrete-time one-step estimates of S_1(tau),
# S_0(tau) and the RMST difference with influence-function SEs, then a TMLE step for
# S_1(tau). Monthly world of the lesson (science/targeted-survival.js): severity
# x in {0,1,2}, sicker patients treated more, dropout depends on x and a. tau = 12.
#
# In practice: survtmle::survtmle(ftime, ftype, trt, adjustVars, t0, method = "hazard",
# SL.ftime, SL.ctime, SL.trt) targets S_a(t0) (as cumulative incidence) in discrete
# time; concrete (formatArguments(), doConcrete(), getOutput()) does continuous-time
# TMLE for survival and competing risks; lmtp::lmtp_tmle() or lmtp::lmtp_sdr() with
# outcome_type = "survival" on wide person-time data. RMST contrasts from these are
# sums of survival estimates, exactly as below.
set.seed(20260925)
n <- 1000; K <- 12; tau <- 12
x <- sample(0:2, n, TRUE, c(.4, .35, .25)); a <- rbinom(n, 1, plogis(-1.1 + 1.1 * x))
lamT <- function(t, a, x) plogis(-3.7 + .04 * (t - 1) + .75 * x - .6 * a + .15 * a * x)
Tm <- sapply(1:n, function(i) { t <- 1; while (t <= K && runif(1) > lamT(t, a[i], x[i])) t <- t + 1; t })
Cm <- sapply(1:n, function(i) { t <- 1; while (t < K && runif(1) > plogis(-2.8 - .5 * x[i] + .3 * a[i])) t <- t + 1; t })
time <- pmin(Tm, Cm); event <- as.integer(Tm <= Cm)

# Person-month rows: at risk in month t if time >= t; event is checked before dropout
pp <- data.frame(id = rep(1:n, time), t = sequence(time), x = rep(x, time), a = rep(a, time))
pp$dN <- as.integer(pp$t == time[pp$id] & event[pp$id] == 1)
pp$dC <- as.integer(pp$t == time[pp$id] & event[pp$id] == 0 & pp$t < K)
fitE <- glm(dN ~ factor(t) + interaction(a, x), binomial, pp)                 # event hazard
fitC <- glm(dC ~ factor(t) + interaction(a, x), binomial, pp, subset = dN == 0 & t < K)
g1 <- fitted(glm(a ~ factor(x), binomial)); gx <- as.vector(tapply(g1, x, mean)) # propensity g(1 | x)
haz <- function(fit, arm, tmax = K) matrix(predict(fit, expand.grid(t = pmin(1:K, tmax), x = 0:2, a = arm), type = "response"), K)

# One-step for psi_a(w) = E[sum_s w_s S(s | a, X)], w over s = 0..K (S(0) = 1)
onestep <- function(arm, w, lam = haz(fitE, arm)) {
  S <- rbind(1, apply(1 - lam, 2, cumprod))                                    # S(s | a, x), s = 0..K
  G <- rbind(1, apply(1 - haz(fitC, arm, K - 1), 2, cumprod))[1:K, ]           # G(t- | a, x)
  H <- apply(w * S, 2, function(v) rev(cumsum(rev(v))))[-1, ] / S[-1, ] / G    # clever covariate H(t | a, x)
  ga <- if (arm == 1) g1 else 1 - g1
  r <- pp[pp$a == arm & pp$t <= max(which(w > 0) - 1), ]
  ix <- cbind(r$t, r$x + 1)
  aug <- numeric(n); aug[unique(r$id)] <- -rowsum(H[ix] * (r$dN - lam[ix]), r$id)[, 1]
  aug <- aug * (a == arm) / ga
  Q <- colSums(w * S)[x + 1]; est <- mean(Q) + mean(aug)
  list(plugin = mean(Q), est = est, D = Q - est + aug, H = H, lam = lam)
}
wS <- as.numeric(0:K == tau); wR <- as.numeric(0:K < tau)                       # S(tau); RMST(tau) in months
res <- list(S1 = onestep(1, wS), S0 = onestep(0, wS), R1 = onestep(1, wR), R0 = onestep(0, wR))
se <- function(D) sqrt(mean(D^2) / n)
row <- function(p, e, D) c(plugin = p, onestep = e, SE = se(D), lower = e - 1.96 * se(D), upper = e + 1.96 * se(D))
truth <- function(arm, w) sum(c(.4, .35, .25) * sapply(0:2, function(xx) sum(w * c(1, cumprod(1 - lamT(1:K, arm, xx))))))
tab <- rbind(S1 = with(res$S1, row(plugin, est, D)), S0 = with(res$S0, row(plugin, est, D)),
             dS = row(res$S1$plugin - res$S0$plugin, res$S1$est - res$S0$est, res$S1$D - res$S0$D),
             dRMST = row(res$R1$plugin - res$R0$plugin, res$R1$est - res$R0$est, res$R1$D - res$R0$D))
print(round(cbind(tab, truth = c(truth(1, wS), truth(0, wS), truth(1, wS) - truth(0, wS), truth(1, wR) - truth(0, wR))), 4))

# TMLE for S_1(tau): move logit lambda(t | 1, x) along H(t | 1, x) / g(1 | x), refit, repeat
cur <- res$S1; it <- 0
while (abs(cur$est - cur$plugin) > 1e-4 * se(cur$D) && it < 20) {
  r <- pp[pp$a == 1 & pp$t <= tau, ]; ix <- cbind(r$t, r$x + 1)
  cov <- cur$H[ix] / gx[r$x + 1]
  eps <- coef(glm(r$dN ~ 0 + cov + offset(qlogis(cur$lam[ix])), family = binomial))
  lam <- cur$lam; lam[] <- plogis(qlogis(lam) + eps * cur$H / gx[col(lam)])  # H = 0 after tau
  cur <- onestep(1, wS, lam); it <- it + 1
}
cat(sprintf("TMLE S1(tau) = %.4f, SE %.4f, after %d update(s); one-step %.4f\n", cur$plugin, se(cur$D), it, res$S1$est))
cat("TMLE solves the score, |mean augmentation| < 1e-4 * SE:", abs(cur$est - cur$plugin) < 1e-4 * se(cur$D), fill = TRUE)

# Expected output:
#       plugin onestep     SE  lower  upper  truth
# S1    0.5924  0.6086 0.0270 0.5557 0.6614 0.6171
# S0    0.4896  0.4850 0.0265 0.4331 0.5368 0.4922
# dS    0.1027  0.1236 0.0364 0.0523 0.1950 0.1249
# dRMST 0.6812  0.5656 0.2601 0.0557 1.0754 0.8342
# TMLE S1(tau) = 0.6083, SE 0.0268, after 3 update(s); one-step 0.6086
# TMLE solves the score, |mean augmentation| < 1e-4 * SE: TRUE
