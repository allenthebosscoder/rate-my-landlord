package org.acme.resource;

import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

import org.acme.AppUser;
import org.acme.AuthToken;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int TOKEN_VALID_DAYS = 30;

    public static class Credentials {
        public String username;
        public String password;
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
    public Response register(Credentials credentials) {
        if (credentials == null || credentials.username == null || credentials.username.isBlank()) {
            return error(Response.Status.BAD_REQUEST, "Username is required");
        }
        if (credentials.password == null || credentials.password.length() < MIN_PASSWORD_LENGTH) {
            return error(Response.Status.BAD_REQUEST,
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }

        String username = credentials.username.trim();
        boolean taken = AppUser.find("LOWER(username) = LOWER(?1)", username).firstResultOptional().isPresent();
        if (taken) {
            return error(Response.Status.CONFLICT, "Username is already taken");
        }

        AppUser user = new AppUser();
        user.username = username;
        user.passwordHash = BcryptUtil.bcryptHash(credentials.password);
        // Whoever registers while there are no admins yet becomes one — a
        // simple bootstrap so a fresh deployment always has a first admin
        // without a manual DB edit.
        user.isAdmin = AppUser.count("isAdmin", true) == 0;
        user.persist();

        return Response.ok(issueToken(user)).build();
    }

    @POST
    @Path("/login")
    @Transactional
    public Response login(Credentials credentials) {
        if (credentials == null || credentials.username == null || credentials.password == null) {
            return error(Response.Status.BAD_REQUEST, "Username and password are required");
        }

        AppUser user = AppUser.find("LOWER(username) = LOWER(?1)", credentials.username.trim())
                .firstResult();
        if (user == null || !BcryptUtil.matches(credentials.password, user.passwordHash)) {
            return error(Response.Status.UNAUTHORIZED, "Invalid username or password");
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

    public static Optional<String> tokenFrom(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }
        return Optional.of(authorizationHeader.substring("Bearer ".length()).trim());
    }
}
