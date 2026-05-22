package org.acme.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.transaction.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.logging.Logger;

import org.acme.Review;
import org.acme.Property;
import org.acme.Landlord;

@Path("/reviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReviewResource {
    
    private static final Logger LOG = Logger.getLogger(ReviewResource.class.getName());

    @GET
    public List<Review> getReviews() {
        return Review.listAll();
    }

    @POST
    @Transactional
    public Response addReview(Review review) {
        try {
            LOG.info("Received review: " + review);
            
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

            // Normalize rating
            double rounded = Math.round(review.rating * 2.0) / 2.0;
            if (rounded < 0.5) rounded = 0.5;
            if (rounded > 5.0) rounded = 5.0;
            review.rating = rounded;

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
    public Review deleteReview(@PathParam("id") Long id) {
        Review review = Review.findById(id);

        if (review != null) {
            review.delete();
        }

        return review;
    }

    @PUT
    @Path("/{id}")
    @Transactional
    public Review updateReview(@PathParam("id") Long id, Review updatedReview) {
        Review review = Review.findById(id);

        if (review != null) {
            double rounded = Math.round(updatedReview.rating * 2.0) / 2.0;
            if (rounded < 0.5) rounded = 0.5;
            if (rounded > 5.0) rounded = 5.0;
            review.rating = rounded;
            review.comment = updatedReview.comment;
            review.tenantName = updatedReview.tenantName;
            review.tenantLocation = updatedReview.tenantLocation;
            review.tenure = updatedReview.tenure;
            review.categories = updatedReview.categories;
            review.updatedAt = LocalDateTime.now();
            review.persist();
        }

        return review;
    }

    @POST
    @Path("/{id}/helpful")
    @Transactional
    public Review markHelpful(@PathParam("id") Long id) {
        Review review = Review.findById(id);
        if (review != null) {
            review.helpfulCount++;
            review.persist();
        }
        return review;
    }

    @POST
    @Path("/{id}/unhelpful")
    @Transactional
    public Review markUnhelpful(@PathParam("id") Long id) {
        Review review = Review.findById(id);
        if (review != null) {
            review.unhelpfulCount++;
            review.persist();
        }
        return review;
    }

    @POST
    @Path("/{id}/report")
    @Transactional
    public Review reportReview(@PathParam("id") Long id) {
        Review review = Review.findById(id);
        if (review != null) {
            review.isReported = true;
            review.persist();
        }
        return review;
    }
}


