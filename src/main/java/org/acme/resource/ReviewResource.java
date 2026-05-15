package org.acme.resource;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/reviews")
public class ReviewResource {

    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String getReviews() {
        return "Reviews endpoint works!";
    }
}