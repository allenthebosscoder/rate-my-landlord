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

import java.util.ArrayList;
import java.util.List;

import org.acme.Review;

@Path("/reviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ReviewResource {

    private static List<Review> reviews = new ArrayList<>();
    private static int nextId = 3;

    static {
        reviews.add(new Review(1, "John Smith", 2, "Ignored maintenance requests"));
        reviews.add(new Review(2, "Sarah Johnson", 5, "Very responsive and fair"));
    }

    @GET
    public List<Review> getReviews() {
        return reviews;
    }

    @POST
    public List<Review> addReview(Review review) {
        if(review != null){
            review.id = nextId;
            nextId++;
            reviews.add(review);
        }

        return reviews;
    }

    @GET
    @Path("/{id}")
    public Review getReviewById(@PathParam("id") int id) {
        for (Review review : reviews) {
            if (review.id == id) {
                return review;
            }
        }

        return null;
    }

    @DELETE
    @Path("/{id}")
    public List<Review> deleteReview(@PathParam("id") int id) {
        reviews.removeIf(review -> review.id == id);

        return reviews;
    }

    @PUT
    @Path("/{id}")
    public Review updateReview(@PathParam("id") int id, Review updatedReview) {
        for (Review review : reviews) {
            if (review.id == id) {
                review.landlord = updatedReview.landlord;
                review.rating = updatedReview.rating;
                review.comment = updatedReview.comment;

                return review;
            }
        }

        return null;
    }
}