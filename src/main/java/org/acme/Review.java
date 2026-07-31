package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Transient;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.time.LocalDateTime;

@Entity
public class Review extends PanacheEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    public Property property;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    public AppUser owner;

    @DecimalMin("1.0")
    @DecimalMax("5.0")
    public double rating;

    public String comment;

    public String tenantName;

    public boolean showName = true;

    public String tenantLocation;

    public String tenure; // e.g., "2022 - 2024"

    public long helpfulCount = 0;

    public long unhelpfulCount = 0;

    public boolean isReported = false;

    public String categories = ""; // comma-separated: "Communication,Maintenance,Value"

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;

    // Populated per-request for the requesting user; not persisted.
    @Transient
    public String myVote;
}