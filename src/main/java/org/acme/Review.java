package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;

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

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;
}