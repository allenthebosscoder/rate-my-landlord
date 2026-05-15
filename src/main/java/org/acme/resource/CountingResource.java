package org.acme.resource;

import org.acme.managers.CountingManager;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;

@Path("/count")
public class CountingResource {

    @Inject
    CountingManager manager;
    
    @GET
    public int getCount() {
        return manager.getCount();
    }

    @POST
    public String incrementCount() {
        manager.addCount();
        return "Success";
    }
}
