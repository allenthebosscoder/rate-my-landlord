package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

@Entity
public class Review extends PanacheEntity {

    @ManyToOne(fetch = FetchType.EAGER)
    public Property property;

    @DecimalMin("0.5")
    @DecimalMax("5.0")
    public double rating;

    public String comment;

    public String tenantName;

    public String tenantLocation;

    public String tenure; // e.g., "2022 - 2024"

    public long helpfulCount = 0;

    public long unhelpfulCount = 0;

    public boolean isReported = false;

    public String categories = ""; // comma-separated: "Communication,Maintenance,Value"

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;
}