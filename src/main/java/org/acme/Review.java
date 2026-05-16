package org.acme;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Entity;

import java.time.LocalDateTime;

@Entity
public class Review extends PanacheEntity {

    public String landlord;

    public int rating;

    public String comment;

    public LocalDateTime createdAt;

    public LocalDateTime updatedAt;
}