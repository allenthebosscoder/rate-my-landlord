package org.acme.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.transaction.Transactional;
import jakarta.inject.Inject;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

import io.quarkus.panache.common.Sort;

import org.acme.AppUser;
import org.acme.AuthToken;
import org.acme.RateLimiter;
import org.acme.Review;
import org.acme.ReviewVote;
import org.acme.Property;
import org.acme.Landlord;

@Path("/reviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReviewResource {

    private static final Logger LOG = Logger.getLogger(ReviewResource.class.getName());

    @Inject
    RateLimiter rateLimiter;

    @GET
    public List<Review> getReviews(@HeaderParam("Authorization") String authorizationHeader) {
        List<Review> reviews = Review.listAll(Sort.descending("createdAt", "id"));

        AppUser user = authenticate(authorizationHeader);
        if (user != null) {
            Map<Long, String> myVoteByReviewId = new HashMap<>();
            for (ReviewVote vote : ReviewVote.<ReviewVote>list("user", user)) {
                myVoteByReviewId.put(vote.review.id, vote.voteType);
            }
            for (Review review : reviews) {
                review.myVote = myVoteByReviewId.get(review.id);
            }
        }

        return reviews;
    }

    @POST
    @Transactional
    public Response addReview(Review review, @HeaderParam("Authorization") String authorizationHeader) {
        try {
            LOG.info("Received review: " + review);

            AppUser user = authenticate(authorizationHeader);
            if (user == null) {
                return unauthorized();
            }
            if (!rateLimiter.tryAcquire("review-create:" + user.id, 10, Duration.ofHours(1))) {
                return Response.status(429)
                        .entity("{\"error\": \"Too many reviews submitted. Please try again later.\"}")
                        .build();
            }

            if (review == null || review.property == null) {
                LOG.severe("Review or property is null");
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"Review or property is required\"}")
                    .build();
            }

            if (review.property.landlord == null || review.property.landlord.name == null || review.property.landlord.name.isEmpty()) {
                LOG.severe("Landlord name is required");
                return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\": \"Landlord name is required\"}")
                    .build();
            }

            review.rating = normalizeRating(review.rating);
            review.createdAt = LocalDateTime.now();
            review.updatedAt = LocalDateTime.now();

            // Find or create landlord
            String landlordName = review.property.landlord.name.trim();
            Landlord existingLandlord = Landlord.find("name", landlordName).firstResult();
            
            if (existingLandlord == null) {
                LOG.info("Creating new landlord: " + landlordName);
                Landlord newLandlord = new Landlord();
                newLandlord.name = landlordName;
                newLandlord.persist();
                existingLandlord = newLandlord;
            } else {
                LOG.info("Found existing landlord: " + existingLandlord.id);
            }

            // Find or create property
            String zipCode = review.property.zipCode.trim();
            Property existingProperty = Property.find("zipCode = ?1 and landlord = ?2", zipCode, existingLandlord).firstResult();
            
            if (existingProperty == null) {
                LOG.info("Creating new property: " + zipCode);
                Property newProperty = new Property();
                newProperty.zipCode = zipCode;
                newProperty.city = review.property.city;
                newProperty.state = review.property.state;
                newProperty.country = review.property.country;
                newProperty.landlord = existingLandlord;
                newProperty.persist();
                existingProperty = newProperty;
            } else {
                LOG.info("Found existing property: " + existingProperty.id);
            }

            // Create the review
            review.property = existingProperty;
            review.owner = user;
            review.persist();
            LOG.info("Review created with id: " + review.id);
            return Response.ok(review).build();
        } catch (Exception e) {
            LOG.severe("Error creating review: " + e.getMessage());
            e.printStackTrace();
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("{\"error\": \"" + e.getMessage() + "\"}")
                    .build();
        }
    }

    @GET
    @Path("/{id}")
    public Review getReviewById(@PathParam("id") Long id) {
        return Review.findById(id);
    }

    @DELETE
    @Path("/{id}")
    @Transactional
    public Response deleteReview(@PathParam("id") Long id, @HeaderParam("Authorization") String authorizationHeader) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }

        Review review = Review.findById(id);
        if (review == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        if (!review.owner.id.equals(user.id) && !user.isAdmin) {
            return forbidden();
        }

        ReviewVote.delete("review", review);
        review.delete();
        return Response.noContent().build();
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public Response updateReview(@PathParam("id") Long id, Review updatedReview,
            @HeaderParam("Authorization") String authorizationHeader) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }

        Review review = Review.findById(id);
        if (review == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        if (!review.owner.id.equals(user.id)) {
            return forbidden();
        }

        review.rating = normalizeRating(updatedReview.rating);
        review.comment = updatedReview.comment;
        review.tenantName = updatedReview.tenantName;
        review.showName = updatedReview.showName;
        review.tenantLocation = updatedReview.tenantLocation;
        review.tenure = updatedReview.tenure;
        review.categories = updatedReview.categories;
        review.updatedAt = LocalDateTime.now();
        review.persist();

        return Response.ok(review).build();
    }

    @POST
    @Path("/{id}/helpful")
    @Transactional
    public Response markHelpful(@PathParam("id") Long id, @HeaderParam("Authorization") String authorizationHeader) {
        return applyVote(id, authorizationHeader, "HELPFUL");
    }

    @POST
    @Path("/{id}/unhelpful")
    @Transactional
    public Response markUnhelpful(@PathParam("id") Long id, @HeaderParam("Authorization") String authorizationHeader) {
        return applyVote(id, authorizationHeader, "UNHELPFUL");
    }

    // A user can cast at most one HELPFUL/UNHELPFUL vote per review. Casting the
    // same vote again removes it; casting the opposite vote switches it.
    private Response applyVote(Long reviewId, String authorizationHeader, String voteType) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }

        Review review = Review.findById(reviewId);
        if (review == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        ReviewVote existingVote = ReviewVote.find("review = ?1 and user = ?2", review, user).firstResult();
        if (existingVote == null) {
            ReviewVote vote = new ReviewVote();
            vote.review = review;
            vote.user = user;
            vote.voteType = voteType;
            vote.persist();
            adjustVoteCount(review, voteType, 1);
        } else if (existingVote.voteType.equals(voteType)) {
            existingVote.delete();
            adjustVoteCount(review, voteType, -1);
        } else {
            adjustVoteCount(review, existingVote.voteType, -1);
            adjustVoteCount(review, voteType, 1);
            existingVote.voteType = voteType;
            existingVote.persist();
        }

        review.persist();
        return Response.ok(review).build();
    }

    private static void adjustVoteCount(Review review, String voteType, int delta) {
        if ("HELPFUL".equals(voteType)) {
            review.helpfulCount = Math.max(0, review.helpfulCount + delta);
        } else {
            review.unhelpfulCount = Math.max(0, review.unhelpfulCount + delta);
        }
    }

    @POST
    @Path("/{id}/report")
    @Transactional
    public Response reportReview(@PathParam("id") Long id, @HeaderParam("Authorization") String authorizationHeader) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }

        Review review = Review.findById(id);
        if (review == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        review.isReported = true;
        review.persist();
        return Response.ok(review).build();
    }

    @GET
    @Path("/reported")
    public Response getReportedReviews(@HeaderParam("Authorization") String authorizationHeader) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }
        if (!user.isAdmin) {
            return forbidden();
        }

        return Response.ok(Review.list("isReported", Sort.descending("createdAt"), true)).build();
    }

    @POST
    @Path("/{id}/dismiss-report")
    @Transactional
    public Response dismissReport(@PathParam("id") Long id, @HeaderParam("Authorization") String authorizationHeader) {
        AppUser user = authenticate(authorizationHeader);
        if (user == null) {
            return unauthorized();
        }
        if (!user.isAdmin) {
            return forbidden();
        }

        Review review = Review.findById(id);
        if (review == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        review.isReported = false;
        review.persist();
        return Response.ok(review).build();
    }

    // Ratings are stored in half-star increments, clamped to [1.0, 5.0].
    private static double normalizeRating(double rating) {
        double rounded = Math.round(rating * 2.0) / 2.0;
        return Math.min(5.0, Math.max(1.0, rounded));
    }

    private static AppUser authenticate(String authorizationHeader) {
        return AuthResource.tokenFrom(authorizationHeader)
                .map(token -> (AuthToken) AuthToken.find("token = ?1 and expiresAt > ?2", token, LocalDateTime.now())
                        .firstResult())
                .map(authToken -> authToken.user)
                .orElse(null);
    }

    private static Response unauthorized() {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity("{\"error\": \"Sign in required\"}")
                .build();
    }

    private static Response forbidden() {
        return Response.status(Response.Status.FORBIDDEN)
                .entity("{\"error\": \"You don't have permission to do that\"}")
                .build();
    }
}

