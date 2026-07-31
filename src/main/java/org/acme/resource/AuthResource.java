package org.acme.resource;

import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.mailer.Mail;
import io.quarkus.mailer.Mailer;
import io.vertx.core.http.HttpServerRequest;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Logger;
import java.util.regex.Pattern;

import org.acme.AppUser;
import org.acme.AuthToken;
import org.acme.PasswordResetToken;
import org.acme.RateLimiter;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final Logger LOG = Logger.getLogger(AuthResource.class.getName());
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int TOKEN_VALID_DAYS = 30;
    private static final int RESET_TOKEN_VALID_MINUTES = 60;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    @Inject
    RateLimiter rateLimiter;

    @Inject
    Mailer mailer;

    // Optional<String>, not String: SmallRye's plain String converter treats
    // an empty-string-resolved value (the common case here, since this is
    // "${ADMIN_USERNAMES:}" with the env var unset) as invalid rather than
    // as absent, and throws at startup instead of just giving back "".
    @ConfigProperty(name = "app.admin-usernames")
    Optional<String> adminUsernamesConfig;

    @ConfigProperty(name = "app.frontend-url", defaultValue = "http://localhost:3000")
    String frontendUrl;

    public static class Credentials {
        public String username;
        public String email;
        public String password;
    }

    public static class ForgotPasswordRequest {
        public String email;
    }

    public static class ResetPasswordRequest {
        public String token;
        public String newPassword;
    }

    public static class AuthResponse {
        public String token;
        public String username;
        public boolean isAdmin;

        public AuthResponse(String token, String username, boolean isAdmin) {
            this.token = token;
            this.username = username;
            this.isAdmin = isAdmin;
        }
    }

    @POST
    @Path("/register")
    @Transactional
    public Response register(Credentials credentials, @Context HttpServerRequest request,
            @HeaderParam("X-Forwarded-For") String forwardedFor) {
        if (!rateLimiter.tryAcquire("register:" + clientIp(request, forwardedFor), 5, Duration.ofHours(1))) {
            return tooManyRequests();
        }

        if (credentials == null || credentials.username == null || credentials.username.isBlank()) {
            return error(Response.Status.BAD_REQUEST, "Username is required");
        }
        if (credentials.email == null || !EMAIL_PATTERN.matcher(credentials.email.trim()).matches()) {
            return error(Response.Status.BAD_REQUEST, "A valid email is required");
        }
        if (credentials.password == null || credentials.password.length() < MIN_PASSWORD_LENGTH) {
            return error(Response.Status.BAD_REQUEST,
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }

        String username = credentials.username.trim();
        String email = credentials.email.trim();

        boolean usernameTaken = AppUser.find("LOWER(username) = LOWER(?1)", username)
                .firstResultOptional().isPresent();
        if (usernameTaken) {
            return error(Response.Status.CONFLICT, "Username is already taken");
        }
        boolean emailTaken = AppUser.find("LOWER(email) = LOWER(?1)", email).firstResultOptional().isPresent();
        if (emailTaken) {
            return error(Response.Status.CONFLICT, "An account with that email already exists");
        }

        AppUser user = new AppUser();
        user.username = username;
        user.email = email;
        user.passwordHash = BcryptUtil.bcryptHash(credentials.password);
        user.isAdmin = shouldBeAdmin(username);
        user.persist();

        return Response.ok(issueToken(user)).build();
    }

    @POST
    @Path("/login")
    @Transactional
    public Response login(Credentials credentials, @Context HttpServerRequest request,
            @HeaderParam("X-Forwarded-For") String forwardedFor) {
        if (!rateLimiter.tryAcquire("login:" + clientIp(request, forwardedFor), 10, Duration.ofMinutes(15))) {
            return tooManyRequests();
        }

        if (credentials == null || credentials.username == null || credentials.password == null) {
            return error(Response.Status.BAD_REQUEST, "Username and password are required");
        }

        AppUser user = AppUser.find("LOWER(username) = LOWER(?1)", credentials.username.trim())
                .firstResult();
        if (user == null || !BcryptUtil.matches(credentials.password, user.passwordHash)) {
            return error(Response.Status.UNAUTHORIZED, "Invalid username or password");
        }

        // Self-heals: if this username was added to the admin allowlist after
        // the account was created, promote it now instead of requiring a
        // manual DB edit.
        if (!user.isAdmin && shouldBeAdmin(user.username)) {
            user.isAdmin = true;
            user.persist();
        }

        return Response.ok(issueToken(user)).build();
    }

    @POST
    @Path("/logout")
    @Transactional
    public Response logout(@HeaderParam("Authorization") String authorizationHeader) {
        tokenFrom(authorizationHeader).ifPresent(token -> AuthToken.delete("token", token));
        return Response.noContent().build();
    }

    @POST
    @Path("/forgot-password")
    @Transactional
    public Response forgotPassword(ForgotPasswordRequest request, @Context HttpServerRequest httpRequest,
            @HeaderParam("X-Forwarded-For") String forwardedFor) {
        if (!rateLimiter.tryAcquire("forgot-password:" + clientIp(httpRequest, forwardedFor), 5,
                Duration.ofHours(1))) {
            return tooManyRequests();
        }

        // Always return the same generic response whether or not the email
        // matches an account — otherwise this endpoint becomes a way to probe
        // which emails have accounts here.
        Response generic = Response.ok(
                "{\"message\": \"If that email has an account, a reset link is on its way.\"}").build();

        if (request == null || request.email == null || request.email.isBlank()) {
            return generic;
        }

        AppUser user = AppUser.find("LOWER(email) = LOWER(?1)", request.email.trim()).firstResult();
        if (user == null) {
            return generic;
        }

        byte[] randomBytes = new byte[32];
        RANDOM.nextBytes(randomBytes);
        String tokenValue = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.token = tokenValue;
        resetToken.user = user;
        resetToken.expiresAt = LocalDateTime.now().plusMinutes(RESET_TOKEN_VALID_MINUTES);
        resetToken.persist();

        String resetLink = frontendUrl + "/?resetToken=" + tokenValue;
        LOG.info("Password reset requested for " + user.email + ": " + resetLink);

        try {
            mailer.send(Mail.withText(user.email, "Reset your RateMyLandlord password",
                    "Someone requested a password reset for your account.\n\n"
                            + "Reset it here (expires in " + RESET_TOKEN_VALID_MINUTES + " minutes):\n"
                            + resetLink + "\n\nIf this wasn't you, you can ignore this email."));
        } catch (Exception e) {
            LOG.severe("Failed to send password reset email: " + e.getMessage());
        }

        return generic;
    }

    @POST
    @Path("/reset-password")
    @Transactional
    public Response resetPassword(ResetPasswordRequest request) {
        if (request == null || request.token == null || request.token.isBlank()) {
            return error(Response.Status.BAD_REQUEST, "Reset token is required");
        }
        if (request.newPassword == null || request.newPassword.length() < MIN_PASSWORD_LENGTH) {
            return error(Response.Status.BAD_REQUEST,
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }

        PasswordResetToken resetToken = PasswordResetToken.find("token", request.token.trim()).firstResult();
        if (resetToken == null || resetToken.used || resetToken.expiresAt.isBefore(LocalDateTime.now())) {
            return error(Response.Status.BAD_REQUEST, "This reset link is invalid or has expired");
        }

        resetToken.user.passwordHash = BcryptUtil.bcryptHash(request.newPassword);
        resetToken.user.persist();
        resetToken.used = true;
        resetToken.persist();

        // Revoke existing sessions so a stolen/old token can't keep working
        // past a password reset.
        AuthToken.delete("user", resetToken.user);

        return Response.ok("{\"message\": \"Password updated. Please sign in again.\"}").build();
    }

    private boolean shouldBeAdmin(String username) {
        Set<String> adminUsernames = adminAllowlist();
        if (!adminUsernames.isEmpty()) {
            return adminUsernames.contains(username.toLowerCase());
        }
        // No allowlist configured (local dev/demo) — first account ever
        // becomes admin so there's always someone who can moderate.
        return AppUser.count("isAdmin", true) == 0;
    }

    private Set<String> adminAllowlist() {
        Set<String> result = new HashSet<>();
        String config = adminUsernamesConfig.orElse("");
        if (config.isBlank()) {
            return result;
        }
        for (String name : config.split(",")) {
            String trimmed = name.trim();
            if (!trimmed.isEmpty()) {
                result.add(trimmed.toLowerCase());
            }
        }
        return result;
    }

    private AuthResponse issueToken(AppUser user) {
        byte[] randomBytes = new byte[32];
        RANDOM.nextBytes(randomBytes);
        String tokenValue = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        AuthToken token = new AuthToken();
        token.token = tokenValue;
        token.user = user;
        token.expiresAt = LocalDateTime.now().plusDays(TOKEN_VALID_DAYS);
        token.persist();

        return new AuthResponse(tokenValue, user.username, user.isAdmin);
    }

    private Response error(Response.Status status, String message) {
        return Response.status(status).entity("{\"error\": \"" + message + "\"}").build();
    }

    private Response tooManyRequests() {
        return Response.status(429).entity("{\"error\": \"Too many attempts. Please try again later.\"}").build();
    }

    private static String clientIp(HttpServerRequest request, String forwardedFor) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request != null && request.remoteAddress() != null ? request.remoteAddress().host() : "unknown";
    }

    public static Optional<String> tokenFrom(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }
        return Optional.of(authorizationHeader.substring("Bearer ".length()).trim());
    }
}
