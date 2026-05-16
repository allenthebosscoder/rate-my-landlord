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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.acme.Review;

@Path("/reviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReviewResource {

    @GET
    public List<Review> getReviews() {
        return Review.listAll();
    }

    @POST
    public List<Review> addReview(Review review) {
        if (review != null) {
            review.createdAt = LocalDateTime.now();
            review.updatedAt = LocalDateTime.now();

            review.persist();
        }

        return Review.listAll();
    }

    @GET
    @Path("/{id}")
    public Review getReviewById(@PathParam("id") Long id) {
        return Review.findById(id);
    }

    @DELETE
    @Path("/{id}")
    public List<Review> deleteReview(@PathParam("id") Long id) {
        Review review = Review.findById(id);

        if (review != null) {
            review.delete();
        }

        return Review.listAll();
    }

    @PUT
    @Path("/{id}")
    public Review updateReview(@PathParam("id") Long id, Review updatedReview) {
        Review review = Review.findById(id);

        if (review != null) {
            review.landlord = updatedReview.landlord;
            review.rating = updatedReview.rating;
            review.comment = updatedReview.comment;

            review.updatedAt = java.time.LocalDateTime.now();

            review.persist();
        }

        return review;
    }
}